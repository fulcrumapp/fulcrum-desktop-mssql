'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _mssql = require('mssql');

var _mssql2 = _interopRequireDefault(_mssql);

var _util = require('util');

var _schema = require('./schema');

var _schema2 = _interopRequireDefault(_schema);

var _fulcrumDesktopPlugin = require('fulcrum-desktop-plugin');

var api = _interopRequireWildcard(_fulcrumDesktopPlugin);

var _mssqlRecordValues = require('./mssql-record-values');

var _mssqlRecordValues2 = _interopRequireDefault(_mssqlRecordValues);

var _snakeCase = require('snake-case');

var _snakeCase2 = _interopRequireDefault(_snakeCase);

var _templateDrop = require('./template.drop.sql');

var _templateDrop2 = _interopRequireDefault(_templateDrop);

var _schemaMap = require('./schema-map');

var _schemaMap2 = _interopRequireDefault(_schemaMap);

var _lodash = require('lodash');

var _version = require('./version-001.sql');

var _version2 = _interopRequireDefault(_version);

var _version3 = require('./version-002.sql');

var _version4 = _interopRequireDefault(_version3);

var _version5 = require('./version-003.sql');

var _version6 = _interopRequireDefault(_version5);

var _version7 = require('./version-004.sql');

var _version8 = _interopRequireDefault(_version7);

var _version9 = require('./version-005.sql');

var _version10 = _interopRequireDefault(_version9);

var _version11 = require('./version-006.sql');

var _version12 = _interopRequireDefault(_version11);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const MAX_IDENTIFIER_LENGTH = 100;

const MSSQL_CONFIG = {
  database: 'fulcrumapp',
  server: 'localhost',
  port: 1433,
  max: 10,
  idleTimeoutMillis: 30000,
  requestTimeout: 120000
};

const MIGRATIONS = {
  '002': _version4.default,
  '003': _version6.default,
  '004': _version8.default,
  '005': _version10.default,
  '006': _version12.default
};

const CURRENT_VERSION = 6;

const DEFAULT_SCHEMA = 'dbo';

const { log, warn, error, info } = fulcrum.logger.withContext('mssql');

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
      yield _this.activate();

      if (fulcrum.args.mssqlCreateDatabase) {
        yield _this.createDatabase(fulcrum.args.mssqlCreateDatabase);
        return;
      }

      if (fulcrum.args.mssqlDropDatabase) {
        yield _this.dropDatabase(fulcrum.args.mssqlDropDatabase);
        return;
      }

      if (fulcrum.args.mssqlDrop) {
        yield _this.dropSystemTables();
        return;
      }

      if (fulcrum.args.mssqlSetup) {
        yield _this.setupDatabase();
        return;
      }

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (account) {
        if (fulcrum.args.mssqlSystemTablesOnly) {
          yield _this.setupSystemTables(account);
          return;
        }

        yield _this.invokeBeforeFunction();

        const forms = yield account.findActiveForms({});

        for (const form of forms) {
          if (fulcrum.args.mssqlForm && form.id !== fulcrum.args.mssqlForm) {
            continue;
          }

          if (fulcrum.args.mssqlRebuildViewsOnly) {
            yield _this.rebuildFriendlyViews(form, account);
          } else {
            yield _this.rebuildForm(form, account, function (index) {
              _this.updateStatus(form.name.green + ' : ' + index.toString().red + ' records');
            });
          }

          log('');
        }

        yield _this.invokeAfterFunction();
      } else {
        error('Unable to find account', fulcrum.args.org);
      }
    });

    this.escapeIdentifier = identifier => {
      return identifier && this.mssql.ident(this.trimIdentifier(identifier));
    };

    this.run = (() => {
      var _ref2 = _asyncToGenerator(function* (sql) {
        sql = sql.replace(/\0/g, '');

        if (fulcrum.args.debug) {
          log(sql);
        }

        const result = yield _this.pool.request().batch(sql);

        return result.recordset;
      });

      return function (_x) {
        return _ref2.apply(this, arguments);
      };
    })();

    this.runAll = (() => {
      var _ref3 = _asyncToGenerator(function* (statements) {
        const results = [];

        for (const sql of statements) {
          results.push((yield _this.run(sql)));
        }

        return results;
      });

      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    })();

    this.runAllTransaction = (() => {
      var _ref4 = _asyncToGenerator(function* (statements) {
        const transaction = new _mssql2.default.Transaction(_this.pool);

        yield transaction.begin();

        const results = [];

        for (const sql of statements) {
          const request = new _mssql2.default.Request(transaction);

          if (fulcrum.args.debug) {
            log(sql);
          }

          const result = yield request.batch(sql);

          results.push(result);
        }

        yield transaction.commit();

        return results;
      });

      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    })();

    this.log = (...args) => {
      // console.log(...args);
    };

    this.tableName = (account, name) => {
      return 'account_' + account.rowID + '_' + name;

      if (this.useAccountPrefix) {
        return 'account_' + account.rowID + '_' + name;
      }

      return name;
    };

    this.onSyncStart = (() => {
      var _ref5 = _asyncToGenerator(function* ({ account, tasks }) {
        yield _this.invokeBeforeFunction();
      });

      return function (_x4) {
        return _ref5.apply(this, arguments);
      };
    })();

    this.onSyncFinish = (() => {
      var _ref6 = _asyncToGenerator(function* ({ account }) {
        yield _this.cleanupFriendlyViews(account);
        yield _this.invokeAfterFunction();
      });

      return function (_x5) {
        return _ref6.apply(this, arguments);
      };
    })();

    this.onFormSave = (() => {
      var _ref7 = _asyncToGenerator(function* ({ form, account, oldForm, newForm }) {
        yield _this.updateForm(form, account, oldForm, newForm);
      });

      return function (_x6) {
        return _ref7.apply(this, arguments);
      };
    })();

    this.onFormDelete = (() => {
      var _ref8 = _asyncToGenerator(function* ({ form, account }) {
        const oldForm = {
          id: form._id,
          row_id: form.rowID,
          name: form._name,
          elements: form._elementsJSON
        };

        yield _this.updateForm(form, account, oldForm, null);
      });

      return function (_x7) {
        return _ref8.apply(this, arguments);
      };
    })();

    this.onRecordSave = (() => {
      var _ref9 = _asyncToGenerator(function* ({ record, account }) {
        yield _this.updateRecord(record, account);
      });

      return function (_x8) {
        return _ref9.apply(this, arguments);
      };
    })();

    this.onRecordDelete = (() => {
      var _ref10 = _asyncToGenerator(function* ({ record }) {
        const statements = _mssqlRecordValues2.default.deleteForRecordStatements(_this.mssql, record, record.form, _this.recordValueOptions);

        yield _this.run(statements.map(function (o) {
          return o.sql;
        }).join('\n'));
      });

      return function (_x9) {
        return _ref10.apply(this, arguments);
      };
    })();

    this.onPhotoSave = (() => {
      var _ref11 = _asyncToGenerator(function* ({ photo, account }) {
        yield _this.updatePhoto(photo, account);
      });

      return function (_x10) {
        return _ref11.apply(this, arguments);
      };
    })();

    this.onVideoSave = (() => {
      var _ref12 = _asyncToGenerator(function* ({ video, account }) {
        yield _this.updateVideo(video, account);
      });

      return function (_x11) {
        return _ref12.apply(this, arguments);
      };
    })();

    this.onAudioSave = (() => {
      var _ref13 = _asyncToGenerator(function* ({ audio, account }) {
        yield _this.updateAudio(audio, account);
      });

      return function (_x12) {
        return _ref13.apply(this, arguments);
      };
    })();

    this.onSignatureSave = (() => {
      var _ref14 = _asyncToGenerator(function* ({ signature, account }) {
        yield _this.updateSignature(signature, account);
      });

      return function (_x13) {
        return _ref14.apply(this, arguments);
      };
    })();

    this.onChangesetSave = (() => {
      var _ref15 = _asyncToGenerator(function* ({ changeset, account }) {
        yield _this.updateChangeset(changeset, account);
      });

      return function (_x14) {
        return _ref15.apply(this, arguments);
      };
    })();

    this.onChoiceListSave = (() => {
      var _ref16 = _asyncToGenerator(function* ({ choiceList, account }) {
        yield _this.updateChoiceList(choiceList, account);
      });

      return function (_x15) {
        return _ref16.apply(this, arguments);
      };
    })();

    this.onClassificationSetSave = (() => {
      var _ref17 = _asyncToGenerator(function* ({ classificationSet, account }) {
        yield _this.updateClassificationSet(classificationSet, account);
      });

      return function (_x16) {
        return _ref17.apply(this, arguments);
      };
    })();

    this.onProjectSave = (() => {
      var _ref18 = _asyncToGenerator(function* ({ project, account }) {
        yield _this.updateProject(project, account);
      });

      return function (_x17) {
        return _ref18.apply(this, arguments);
      };
    })();

    this.onRoleSave = (() => {
      var _ref19 = _asyncToGenerator(function* ({ role, account }) {
        yield _this.updateRole(role, account);
      });

      return function (_x18) {
        return _ref19.apply(this, arguments);
      };
    })();

    this.onMembershipSave = (() => {
      var _ref20 = _asyncToGenerator(function* ({ membership, account }) {
        yield _this.updateMembership(membership, account);
      });

      return function (_x19) {
        return _ref20.apply(this, arguments);
      };
    })();

    this.reloadTableList = _asyncToGenerator(function* () {
      const rows = yield _this.run(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='${_this.dataSchema}'`);

      _this.tableNames = rows.map(function (o) {
        return o.name;
      });
    });
    this.reloadViewList = _asyncToGenerator(function* () {
      const rows = yield _this.run(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='${_this.viewSchema}'`);

      _this.viewNames = rows.map(function (o) {
        return o.name;
      });
    });

    this.baseMediaURL = () => {};

    this.formatPhotoURL = id => {
      return `${this.baseMediaURL}/photos/${id}.jpg`;
    };

    this.formatVideoURL = id => {
      return `${this.baseMediaURL}/videos/${id}.mp4`;
    };

    this.formatAudioURL = id => {
      return `${this.baseMediaURL}/audio/${id}.m4a`;
    };

    this.formatSignatureURL = id => {
      return `${this.baseMediaURL}/signatures/${id}.png`;
    };

    this.updateRecord = (() => {
      var _ref23 = _asyncToGenerator(function* (record, account, skipTableCheck) {
        if (!skipTableCheck && !_this.rootTableExists(record.form)) {
          yield _this.rebuildForm(record.form, account, function () {});
        }

        if (_this.mssqlCustomModule && _this.mssqlCustomModule.shouldUpdateRecord && !_this.mssqlCustomModule.shouldUpdateRecord({ record, account })) {
          return;
        }

        const statements = _mssqlRecordValues2.default.updateForRecordStatements(_this.mssql, record, _this.recordValueOptions);

        yield _this.runSkippingFailures(`Skipping record ${record.id} in form ${record.form.id}.`, function () {
          return _this.run(statements.map(function (o) {
            return o.sql;
          }).join('\n'));
        });

        const systemValues = _mssqlRecordValues2.default.systemColumnValuesForFeature(record, null, record, _this.recordValueOptions);

        yield _this.updateObject(_schemaMap2.default.record(record, systemValues), 'records');
      });

      return function (_x20, _x21, _x22) {
        return _ref23.apply(this, arguments);
      };
    })();

    this.rootTableExists = form => {
      return this.tableNames.indexOf(_mssqlRecordValues2.default.tableNameWithForm(form, null, this.recordValueOptions)) !== -1;
    };

    this.recreateFormTables = (() => {
      var _ref24 = _asyncToGenerator(function* (form, account) {
        try {
          yield _this.updateForm(form, account, _this.formVersion(form), null);
        } catch (ex) {
          if (fulcrum.args.debug) {
            error(ex);
          }
        }

        yield _this.updateForm(form, account, null, _this.formVersion(form));
      });

      return function (_x23, _x24) {
        return _ref24.apply(this, arguments);
      };
    })();

    this.updateForm = (() => {
      var _ref25 = _asyncToGenerator(function* (form, account, oldForm, newForm) {
        if (_this.mssqlCustomModule && _this.mssqlCustomModule.shouldUpdateForm && !_this.mssqlCustomModule.shouldUpdateForm({ form, account })) {
          return;
        }

        try {
          info('Updating form', form.id);

          yield _this.updateFormObject(form, account);

          if (!_this.rootTableExists(form) && newForm != null) {
            oldForm = null;
          }

          const options = {
            disableArrays: _this.disableArrays,
            disableComplexTypes: false,
            userModule: _this.mssqlCustomModule,
            tableSchema: _this.dataSchema,
            calculatedFieldDateFormat: 'date',
            metadata: true,
            useResourceID: _this.persistentTableNames,
            accountPrefix: _this.useAccountPrefix ? 'account_' + _this.account.rowID : null
          };

          const { statements } = yield _schema2.default.generateSchemaStatements(account, oldForm, newForm, options);

          info('Dropping views', form.id);

          yield _this.dropFriendlyView(form, null);

          for (const repeatable of form.elementsOfType('Repeatable')) {
            yield _this.dropFriendlyView(form, repeatable);
          }

          info('Running schema statements', form.id, statements.length);

          info('Schema statements', '\n', statements.join('\n'));

          yield _this.runSkippingFailures(`Skipping form ${form.id}.`, _asyncToGenerator(function* () {
            yield _this.runAllTransaction(statements);

            info('Creating views', form.id);

            if (newForm) {
              yield _this.createFriendlyView(form, null);

              for (const repeatable of form.elementsOfType('Repeatable')) {
                yield _this.createFriendlyView(form, repeatable);
              }
            }

            info('Completed form update', form.id);
          }));
        } catch (ex) {
          info('updateForm failed');
          _this.integrityWarning(ex);
          throw ex;
        }
      });

      return function (_x25, _x26, _x27, _x28) {
        return _ref25.apply(this, arguments);
      };
    })();

    this.formVersion = form => {
      if (form == null) {
        return null;
      }

      return {
        id: form._id,
        row_id: form.rowID,
        name: form._name,
        elements: form._elementsJSON
      };
    };

    this.updateStatus = message => {
      if (process.stdout.isTTY) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(message);
      }
    };

    this.progress = (name, index) => {
      this.updateStatus(name.green + ' : ' + index.toString().red);
    };

    this.runSkippingFailures = (() => {
      var _ref27 = _asyncToGenerator(function* (context, block) {
        if (!fulcrum.args.mssqlSkipFailures) {
          return block();
        }

        try {
          yield block();
        } catch (ex) {
          if (ex.message.indexOf('maximum row size of 8060') !== -1) {
            log('Row too large.', context, ex.message);
          } else if (ex.message.indexOf('maximum of 1024 columns') !== -1) {
            log('Table too large.', context, ex.message);
          } else if (ex.message.indexOf('Invalid object name') !== -1) {
            log('Invalid object name.', context, ex.message);
          } else {
            throw ex;
          }
        }
      });

      return function (_x29, _x30) {
        return _ref27.apply(this, arguments);
      };
    })();
  }

  task(cli) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return cli.command({
        command: 'mssql',
        desc: 'run the mssql sync for a specific organization',
        builder: {
          mssqlConnectionString: {
            desc: 'mssql connection string (overrides all individual database connection parameters)',
            type: 'string'
          },
          mssqlDatabase: {
            desc: 'mssql database name',
            type: 'string',
            default: MSSQL_CONFIG.database
          },
          mssqlHost: {
            desc: 'mssql server host',
            type: 'string',
            default: MSSQL_CONFIG.host
          },
          mssqlPort: {
            desc: 'mssql server port',
            type: 'integer',
            default: MSSQL_CONFIG.port
          },
          mssqlUser: {
            desc: 'mssql user',
            type: 'string'
          },
          mssqlPassword: {
            desc: 'mssql password',
            type: 'string'
          },
          mssqlSchema: {
            desc: 'mssql schema',
            type: 'string'
          },
          mssqlSchemaViews: {
            desc: 'mssql schema for the friendly views',
            type: 'string'
          },
          mssqlSyncEvents: {
            desc: 'add sync event hooks',
            type: 'boolean',
            default: true
          },
          mssqlBeforeFunction: {
            desc: 'call this function before the sync',
            type: 'string'
          },
          mssqlAfterFunction: {
            desc: 'call this function after the sync',
            type: 'string'
          },
          org: {
            desc: 'organization name',
            required: true,
            type: 'string'
          },
          mssqlForm: {
            desc: 'the form ID to rebuild',
            type: 'string'
          },
          mssqlReportBaseUrl: {
            desc: 'report URL base',
            type: 'string'
          },
          mssqlMediaBaseUrl: {
            desc: 'media URL base',
            type: 'string'
          },
          mssqlUnderscoreNames: {
            desc: 'use underscore names (e.g. "Park Inspections" becomes "park_inspections")',
            required: false,
            type: 'boolean',
            default: true
          },
          mssqlPersistentTableNames: {
            desc: 'use the server id in the form table names',
            required: false,
            type: 'boolean',
            default: false
          },
          mssqlPrefix: {
            desc: 'use the organization ID as a prefix in the object names',
            required: false,
            type: 'boolean',
            default: true
          },
          mssqlRebuildViewsOnly: {
            desc: 'only rebuild the views',
            required: false,
            type: 'boolean',
            default: false
          },
          mssqlCustomModule: {
            desc: 'a custom module to load with sync extensions (experimental)',
            required: false,
            type: 'string'
          },
          mssqlSetup: {
            desc: 'setup the database',
            required: false,
            type: 'boolean'
          },
          mssqlDrop: {
            desc: 'drop the system tables',
            required: false,
            type: 'boolean',
            default: false
          },
          mssqlSystemTablesOnly: {
            desc: 'only create the system records',
            required: false,
            type: 'boolean',
            default: false
          },
          mssqlSkipFailures: {
            desc: 'skip failures in rows and tables that are too large',
            required: false,
            type: 'boolean',
            default: false
          }
        },
        handler: _this2.runCommand
      });
    })();
  }

  trimIdentifier(identifier) {
    return identifier.substring(0, MAX_IDENTIFIER_LENGTH);
  }

  get useSyncEvents() {
    return fulcrum.args.mssqlSyncEvents != null ? fulcrum.args.mssqlSyncEvents : true;
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      _this3.account = yield fulcrum.fetchAccount(fulcrum.args.org);

      const options = _extends({}, MSSQL_CONFIG, {
        server: fulcrum.args.mssqlHost || MSSQL_CONFIG.server,
        port: fulcrum.args.mssqlPort || MSSQL_CONFIG.port,
        database: fulcrum.args.mssqlDatabase || MSSQL_CONFIG.database,
        user: fulcrum.args.mssqlUser || MSSQL_CONFIG.user,
        password: fulcrum.args.mssqlPassword || MSSQL_CONFIG.user
      });

      if (fulcrum.args.mssqlUser) {
        options.user = fulcrum.args.mssqlUser;
      }

      if (fulcrum.args.mssqlPassword) {
        options.password = fulcrum.args.mssqlPassword;
      }

      if (fulcrum.args.mssqlCustomModule) {
        _this3.mssqlCustomModule = require(fulcrum.args.mssqlCustomModule);
        _this3.mssqlCustomModule.api = api;
        _this3.mssqlCustomModule.app = fulcrum;
      }

      _this3.disableArrays = false;
      _this3.disableComplexTypes = true;

      if (fulcrum.args.mssqlPersistentTableNames === true) {
        _this3.persistentTableNames = true;
      }

      _this3.useAccountPrefix = fulcrum.args.mssqlPrefix !== false;

      _this3.pool = yield _mssql2.default.connect(fulcrum.args.mssqlConnectionString || options);

      if (_this3.useSyncEvents) {
        fulcrum.on('sync:start', _this3.onSyncStart);
        fulcrum.on('sync:finish', _this3.onSyncFinish);
        fulcrum.on('photo:save', _this3.onPhotoSave);
        fulcrum.on('video:save', _this3.onVideoSave);
        fulcrum.on('audio:save', _this3.onAudioSave);
        fulcrum.on('signature:save', _this3.onSignatureSave);
        fulcrum.on('changeset:save', _this3.onChangesetSave);
        fulcrum.on('record:save', _this3.onRecordSave);
        fulcrum.on('record:delete', _this3.onRecordDelete);

        fulcrum.on('choice-list:save', _this3.onChoiceListSave);
        fulcrum.on('choice-list:delete', _this3.onChoiceListSave);

        fulcrum.on('form:save', _this3.onFormSave);
        fulcrum.on('form:delete', _this3.onFormSave);

        fulcrum.on('classification-set:save', _this3.onClassificationSetSave);
        fulcrum.on('classification-set:delete', _this3.onClassificationSetSave);

        fulcrum.on('role:save', _this3.onRoleSave);
        fulcrum.on('role:delete', _this3.onRoleSave);

        fulcrum.on('project:save', _this3.onProjectSave);
        fulcrum.on('project:delete', _this3.onProjectSave);

        fulcrum.on('membership:save', _this3.onMembershipSave);
        fulcrum.on('membership:delete', _this3.onMembershipSave);
      }

      _this3.viewSchema = fulcrum.args.mssqlSchemaViews || DEFAULT_SCHEMA;
      _this3.dataSchema = fulcrum.args.mssqlSchema || DEFAULT_SCHEMA;

      // Fetch all the existing tables on startup. This allows us to special case the
      // creation of new tables even when the form isn't version 1. If the table doesn't
      // exist, we can pretend the form is version 1 so it creates all new tables instead
      // of applying a schema diff.
      const rows = yield _this3.run(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='${_this3.dataSchema}'`);

      _this3.tableNames = rows.map(function (o) {
        return o.name;
      });

      // make a client so we can use it to build SQL statements
      _this3.mssql = new _fulcrumDesktopPlugin.MSSQL({});

      _this3.setupOptions();

      yield _this3.maybeInitialize();
    })();
  }

  deactivate() {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      if (_this4.pool) {
        yield _this4.pool.close();
      }
    })();
  }

  updatePhoto(object, account) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const values = _schemaMap2.default.photo(object);

      values.file = _this5.formatPhotoURL(values.access_key);

      yield _this5.updateObject(values, 'photos');
    })();
  }

  updateVideo(object, account) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      const values = _schemaMap2.default.video(object);

      values.file = _this6.formatVideoURL(values.access_key);

      yield _this6.updateObject(values, 'videos');
    })();
  }

  updateAudio(object, account) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      const values = _schemaMap2.default.audio(object);

      values.file = _this7.formatAudioURL(values.access_key);

      yield _this7.updateObject(values, 'audio');
    })();
  }

  updateSignature(object, account) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      const values = _schemaMap2.default.signature(object);

      values.file = _this8.formatSignatureURL(values.access_key);

      yield _this8.updateObject(values, 'signatures');
    })();
  }

  updateChangeset(object, account) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      yield _this9.updateObject(_schemaMap2.default.changeset(object), 'changesets');
    })();
  }

  updateProject(object, account) {
    var _this10 = this;

    return _asyncToGenerator(function* () {
      yield _this10.updateObject(_schemaMap2.default.project(object), 'projects');
    })();
  }

  updateMembership(object, account) {
    var _this11 = this;

    return _asyncToGenerator(function* () {
      yield _this11.updateObject(_schemaMap2.default.membership(object), 'memberships');
    })();
  }

  updateRole(object, account) {
    var _this12 = this;

    return _asyncToGenerator(function* () {
      yield _this12.updateObject(_schemaMap2.default.role(object), 'roles');
    })();
  }

  updateFormObject(object, account) {
    var _this13 = this;

    return _asyncToGenerator(function* () {
      yield _this13.updateObject(_schemaMap2.default.form(object), 'forms');
    })();
  }

  updateChoiceList(object, account) {
    var _this14 = this;

    return _asyncToGenerator(function* () {
      yield _this14.updateObject(_schemaMap2.default.choiceList(object), 'choice_lists');
    })();
  }

  updateClassificationSet(object, account) {
    var _this15 = this;

    return _asyncToGenerator(function* () {
      yield _this15.updateObject(_schemaMap2.default.classificationSet(object), 'classification_sets');
    })();
  }

  updateObject(values, table) {
    var _this16 = this;

    return _asyncToGenerator(function* () {
      const deleteStatement = _this16.mssql.deleteStatement(`${_this16.dataSchema}.system_${table}`, { row_resource_id: values.row_resource_id });
      const insertStatement = _this16.mssql.insertStatement(`${_this16.dataSchema}.system_${table}`, values, { pk: 'id' });

      const sql = [deleteStatement.sql, insertStatement.sql].join('\n');

      try {
        yield _this16.run(sql);
      } catch (ex) {
        warn(`updateObject ${table} failed`);
        _this16.integrityWarning(ex);
        throw ex;
      }
    })();
  }

  integrityWarning(ex) {
    warn(`
-------------
!! WARNING !!
-------------

MSSQL database integrity issue encountered. Common sources of database issues are:

* Reinstalling Fulcrum Desktop and using an old MSSQL database without recreating
  the MSSQL database.
* Deleting the internal application database and using an existing MSSQL database
* Manually modifying the MSSQL database
* Creating multiple apps in Fulcrum with the same name. This is generally OK, except
  you will not be able to use the "friendly view" feature of the MSSQL plugin since
  the view names are derived from the form names.

Note: When reinstalling Fulcrum Desktop or "starting over" you need to drop and re-create
the MSSQL database. The names of database objects are tied directly to the database
objects in the internal application database.

---------------------------------------------------------------------
Report issues at https://github.com/fulcrumapp/fulcrum-desktop/issues
---------------------------------------------------------------------
Message:
${ex.message}

Stack:
${ex.stack}
---------------------------------------------------------------------
`.red);
  }

  setupOptions() {
    this.baseMediaURL = fulcrum.args.mssqlMediaBaseUrl ? fulcrum.args.mssqlMediaBaseUrl : 'https://api.fulcrumapp.com/api/v2';

    this.recordValueOptions = {
      schema: this.dataSchema,

      escapeIdentifier: this.escapeIdentifier,

      disableArrays: this.disableArrays,

      persistentTableNames: this.persistentTableNames,

      accountPrefix: this.useAccountPrefix ? 'account_' + this.account.rowID : null,

      calculatedFieldDateFormat: 'date',

      disableComplexTypes: this.disableComplexTypes,

      valuesTransformer: this.mssqlCustomModule && this.mssqlCustomModule.valuesTransformer,

      mediaURLFormatter: mediaValue => {

        return mediaValue.items.map(item => {
          if (mediaValue.element.isPhotoElement) {
            return this.formatPhotoURL(item.mediaID);
          } else if (mediaValue.element.isVideoElement) {
            return this.formatVideoURL(item.mediaID);
          } else if (mediaValue.element.isAudioElement) {
            return this.formatAudioURL(item.mediaID);
          }

          return null;
        });
      },

      mediaViewURLFormatter: mediaValue => {
        const ids = mediaValue.items.map(o => o.mediaID);

        if (mediaValue.element.isPhotoElement) {
          return `${this.baseMediaURL}/photos/view?photos=${ids}`;
        } else if (mediaValue.element.isVideoElement) {
          return `${this.baseMediaURL}/videos/view?videos=${ids}`;
        } else if (mediaValue.element.isAudioElement) {
          return `${this.baseMediaURL}/audio/view?audio=${ids}`;
        }

        return null;
      }
    };

    if (fulcrum.args.mssqlReportBaseUrl) {
      this.recordValueOptions.reportURLFormatter = feature => {
        return `${fulcrum.args.mssqlReportBaseUrl}/reports/${feature.id}.pdf`;
      };
    }
  }

  dropFriendlyView(form, repeatable) {
    var _this17 = this;

    return _asyncToGenerator(function* () {
      const viewName = _this17.getFriendlyTableName(form, repeatable);

      try {
        yield _this17.run((0, _util.format)("IF OBJECT_ID('%s.%s', 'V') IS NOT NULL DROP VIEW %s.%s;", _this17.escapeIdentifier(_this17.viewSchema), _this17.escapeIdentifier(viewName), _this17.escapeIdentifier(_this17.viewSchema), _this17.escapeIdentifier(viewName)));
      } catch (ex) {
        warn('dropFriendlyView failed');
        _this17.integrityWarning(ex);
      }
    })();
  }

  createFriendlyView(form, repeatable) {
    var _this18 = this;

    return _asyncToGenerator(function* () {
      const viewName = _this18.getFriendlyTableName(form, repeatable);

      try {
        yield _this18.run((0, _util.format)('CREATE VIEW %s.%s AS SELECT * FROM %s;', _this18.escapeIdentifier(_this18.viewSchema), _this18.escapeIdentifier(viewName), _mssqlRecordValues2.default.tableNameWithFormAndSchema(form, repeatable, _this18.recordValueOptions, '_view_full')));
      } catch (ex) {
        // sometimes it doesn't exist
        warn('createFriendlyView failed');
        _this18.integrityWarning(ex);
      }
    })();
  }

  getFriendlyTableName(form, repeatable) {
    const name = (0, _lodash.compact)([form.name, repeatable && repeatable.dataName]).join(' - ');

    const formID = this.persistentTableNames ? form.id : form.rowID;

    const prefix = (0, _lodash.compact)(['view', formID, repeatable && repeatable.key]).join(' - ');

    const objectName = [prefix, name].join(' - ');

    return this.trimIdentifier(fulcrum.args.mssqlUnderscoreNames !== false ? (0, _snakeCase2.default)(objectName) : objectName);
  }

  invokeBeforeFunction() {
    var _this19 = this;

    return _asyncToGenerator(function* () {
      if (fulcrum.args.mssqlBeforeFunction) {
        yield _this19.run((0, _util.format)('EXECUTE %s;', fulcrum.args.mssqlBeforeFunction));
      }
      if (_this19.mssqlCustomModule && _this19.mssqlCustomModule.beforeSync) {
        yield _this19.mssqlCustomModule.beforeSync();
      }
    })();
  }

  invokeAfterFunction() {
    var _this20 = this;

    return _asyncToGenerator(function* () {
      if (fulcrum.args.mssqlAfterFunction) {
        yield _this20.run((0, _util.format)('EXECUTE %s;', fulcrum.args.mssqlAfterFunction));
      }
      if (_this20.mssqlCustomModule && _this20.mssqlCustomModule.afterSync) {
        yield _this20.mssqlCustomModule.afterSync();
      }
    })();
  }

  rebuildForm(form, account, progress) {
    var _this21 = this;

    return _asyncToGenerator(function* () {
      yield _this21.recreateFormTables(form, account);
      yield _this21.reloadTableList();

      let index = 0;

      yield form.findEachRecord({}, (() => {
        var _ref28 = _asyncToGenerator(function* (record) {
          record.form = form;

          if (++index % 10 === 0) {
            progress(index);
          }

          yield _this21.updateRecord(record, account, true);
        });

        return function (_x31) {
          return _ref28.apply(this, arguments);
        };
      })());

      progress(index);
    })();
  }

  cleanupFriendlyViews(account) {
    var _this22 = this;

    return _asyncToGenerator(function* () {
      yield _this22.reloadViewList();

      const activeViewNames = [];

      const forms = yield account.findActiveForms({});

      for (const form of forms) {
        activeViewNames.push(_this22.getFriendlyTableName(form, null));

        for (const repeatable of form.elementsOfType('Repeatable')) {
          activeViewNames.push(_this22.getFriendlyTableName(form, repeatable));
        }
      }

      const remove = (0, _lodash.difference)(_this22.viewNames, activeViewNames);

      for (const viewName of remove) {
        if (viewName.indexOf('view_') === 0 || viewName.indexOf('view - ') === 0) {
          try {
            yield _this22.run((0, _util.format)("IF OBJECT_ID('%s.%s', 'V') IS NOT NULL DROP VIEW %s.%s;", _this22.escapeIdentifier(_this22.viewSchema), _this22.escapeIdentifier(viewName), _this22.escapeIdentifier(_this22.viewSchema), _this22.escapeIdentifier(viewName)));
          } catch (ex) {
            warn('cleanupFriendlyViews failed');
            _this22.integrityWarning(ex);
          }
        }
      }
    })();
  }

  rebuildFriendlyViews(form, account) {
    var _this23 = this;

    return _asyncToGenerator(function* () {
      yield _this23.dropFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        yield _this23.dropFriendlyView(form, repeatable);
      }

      yield _this23.createFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        yield _this23.createFriendlyView(form, repeatable);
      }
    })();
  }

  dropSystemTables() {
    var _this24 = this;

    return _asyncToGenerator(function* () {
      yield _this24.runAll(_this24.prepareMigrationScript(_templateDrop2.default));
    })();
  }

  createDatabase(databaseName) {
    log('Creating database', databaseName);
    return this.run(`CREATE DATABASE ${databaseName};`);
  }

  dropDatabase(databaseName) {
    log('Dropping database', databaseName);
    return this.run(`DROP DATABASE ${databaseName};`);
  }

  setupDatabase() {
    var _this25 = this;

    return _asyncToGenerator(function* () {
      yield _this25.runAll(_this25.prepareMigrationScript(_version2.default));
    })();
  }

  prepareMigrationScript(sql) {
    return sql.replace(/__SCHEMA__/g, this.dataSchema).replace(/__VIEW_SCHEMA__/g, this.viewSchema).split(';');
  }

  setupSystemTables(account) {
    var _this26 = this;

    return _asyncToGenerator(function* () {
      const progress = function (name, index) {
        _this26.updateStatus(name.green + ' : ' + index.toString().red);
      };

      yield account.findEachPhoto({}, (() => {
        var _ref29 = _asyncToGenerator(function* (photo, { index }) {
          if (++index % 10 === 0) {
            progress('Photos', index);
          }

          yield _this26.updatePhoto(photo, account);
        });

        return function (_x32, _x33) {
          return _ref29.apply(this, arguments);
        };
      })());

      yield account.findEachVideo({}, (() => {
        var _ref30 = _asyncToGenerator(function* (video, { index }) {
          if (++index % 10 === 0) {
            progress('Videos', index);
          }

          yield _this26.updateVideo(video, account);
        });

        return function (_x34, _x35) {
          return _ref30.apply(this, arguments);
        };
      })());

      yield account.findEachAudio({}, (() => {
        var _ref31 = _asyncToGenerator(function* (audio, { index }) {
          if (++index % 10 === 0) {
            progress('Audio', index);
          }

          yield _this26.updateAudio(audio, account);
        });

        return function (_x36, _x37) {
          return _ref31.apply(this, arguments);
        };
      })());

      yield account.findEachSignature({}, (() => {
        var _ref32 = _asyncToGenerator(function* (signature, { index }) {
          if (++index % 10 === 0) {
            progress('Signatures', index);
          }

          yield _this26.updateSignature(signature, account);
        });

        return function (_x38, _x39) {
          return _ref32.apply(this, arguments);
        };
      })());

      yield account.findEachChangeset({}, (() => {
        var _ref33 = _asyncToGenerator(function* (changeset, { index }) {
          if (++index % 10 === 0) {
            progress('Changesets', index);
          }

          yield _this26.updateChangeset(changeset, account);
        });

        return function (_x40, _x41) {
          return _ref33.apply(this, arguments);
        };
      })());

      yield account.findEachRole({}, (() => {
        var _ref34 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Roles', index);
          }

          yield _this26.updateRole(object, account);
        });

        return function (_x42, _x43) {
          return _ref34.apply(this, arguments);
        };
      })());

      yield account.findEachProject({}, (() => {
        var _ref35 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Projects', index);
          }

          yield _this26.updateProject(object, account);
        });

        return function (_x44, _x45) {
          return _ref35.apply(this, arguments);
        };
      })());

      yield account.findEachForm({}, (() => {
        var _ref36 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Forms', index);
          }

          yield _this26.updateFormObject(object, account);
        });

        return function (_x46, _x47) {
          return _ref36.apply(this, arguments);
        };
      })());

      yield account.findEachMembership({}, (() => {
        var _ref37 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Memberships', index);
          }

          yield _this26.updateMembership(object, account);
        });

        return function (_x48, _x49) {
          return _ref37.apply(this, arguments);
        };
      })());

      yield account.findEachChoiceList({}, (() => {
        var _ref38 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Choice Lists', index);
          }

          yield _this26.updateChoiceList(object, account);
        });

        return function (_x50, _x51) {
          return _ref38.apply(this, arguments);
        };
      })());

      yield account.findEachClassificationSet({}, (() => {
        var _ref39 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Classification Sets', index);
          }

          yield _this26.updateClassificationSet(object, account);
        });

        return function (_x52, _x53) {
          return _ref39.apply(this, arguments);
        };
      })());
    })();
  }

  get isAutomaticInitializationDisabled() {
    return fulcrum.args.mssqlCreateDatabase || fulcrum.args.mssqlDropDatabase || fulcrum.args.mssqlDrop || fulcrum.args.mssqlSetup;
  }

  maybeInitialize() {
    var _this27 = this;

    return _asyncToGenerator(function* () {
      if (_this27.isAutomaticInitializationDisabled) {
        return;
      }

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (_this27.tableNames.indexOf('migrations') === -1) {
        log('Inititalizing database...');

        yield _this27.setupDatabase();
      }

      yield _this27.maybeRunMigrations(account);
    })();
  }

  maybeRunMigrations(account) {
    var _this28 = this;

    return _asyncToGenerator(function* () {
      _this28.migrations = (yield _this28.run(`SELECT name FROM ${_this28.dataSchema}.migrations`)).map(function (o) {
        return o.name;
      });

      let populateRecords = false;

      for (let count = 2; count <= CURRENT_VERSION; ++count) {
        const version = (0, _lodash.padStart)(count, 3, '0');

        const needsMigration = _this28.migrations.indexOf(version) === -1 && MIGRATIONS[version];

        if (needsMigration) {
          yield _this28.runAll(_this28.prepareMigrationScript(MIGRATIONS[version]));

          if (version === '002') {
            log('Populating system tables...');
            populateRecords = true;
          } else if (version === '005') {
            log('Migrating date calculation fields...');
            yield _this28.migrateCalculatedFieldsDateFormat(account);
          }
        }
      }

      if (populateRecords) {
        yield _this28.populateRecords(account);
      }
    })();
  }

  populateRecords(account) {
    var _this29 = this;

    return _asyncToGenerator(function* () {
      const forms = yield account.findActiveForms({});

      let index = 0;

      for (const form of forms) {
        index = 0;

        yield form.findEachRecord({}, (() => {
          var _ref40 = _asyncToGenerator(function* (record) {
            record.form = form;

            if (++index % 10 === 0) {
              _this29.progress(form.name, index);
            }

            yield _this29.updateRecord(record, account, false);
          });

          return function (_x54) {
            return _ref40.apply(this, arguments);
          };
        })());
      }
    })();
  }

  migrateCalculatedFieldsDateFormat(account) {
    var _this30 = this;

    return _asyncToGenerator(function* () {
      const forms = yield account.findActiveForms({});

      for (const form of forms) {
        const fields = form.elementsOfType('CalculatedField').filter(function (element) {
          return element.display.isDate;
        });

        if (fields.length) {
          log('Migrating date calculation fields in form...', form.name);

          yield _this30.rebuildForm(form, account, function () {});
        }
      }
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsInJlcXVlc3RUaW1lb3V0IiwiTUlHUkFUSU9OUyIsIkNVUlJFTlRfVkVSU0lPTiIsIkRFRkFVTFRfU0NIRU1BIiwibG9nIiwid2FybiIsImVycm9yIiwiaW5mbyIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJydW5BbGxUcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb24iLCJiZWdpbiIsIlJlcXVlc3QiLCJjb21taXQiLCJ0YWJsZU5hbWUiLCJyb3dJRCIsInVzZUFjY291bnRQcmVmaXgiLCJvblN5bmNTdGFydCIsInRhc2tzIiwib25TeW5jRmluaXNoIiwiY2xlYW51cEZyaWVuZGx5Vmlld3MiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwicnVuU2tpcHBpbmdGYWlsdXJlcyIsInN5c3RlbVZhbHVlcyIsInN5c3RlbUNvbHVtblZhbHVlc0ZvckZlYXR1cmUiLCJ1cGRhdGVPYmplY3QiLCJpbmRleE9mIiwidGFibGVOYW1lV2l0aEZvcm0iLCJyZWNyZWF0ZUZvcm1UYWJsZXMiLCJmb3JtVmVyc2lvbiIsImV4Iiwic2hvdWxkVXBkYXRlRm9ybSIsInVwZGF0ZUZvcm1PYmplY3QiLCJvcHRpb25zIiwiZGlzYWJsZUFycmF5cyIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJ1c2VyTW9kdWxlIiwidGFibGVTY2hlbWEiLCJjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0IiwibWV0YWRhdGEiLCJ1c2VSZXNvdXJjZUlEIiwicGVyc2lzdGVudFRhYmxlTmFtZXMiLCJhY2NvdW50UHJlZml4IiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZHJvcEZyaWVuZGx5VmlldyIsInJlcGVhdGFibGUiLCJlbGVtZW50c09mVHlwZSIsImxlbmd0aCIsImNyZWF0ZUZyaWVuZGx5VmlldyIsImludGVncml0eVdhcm5pbmciLCJtZXNzYWdlIiwicHJvY2VzcyIsInN0ZG91dCIsImlzVFRZIiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsInByb2dyZXNzIiwiY29udGV4dCIsImJsb2NrIiwibXNzcWxTa2lwRmFpbHVyZXMiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNzcWxDb25uZWN0aW9uU3RyaW5nIiwidHlwZSIsIm1zc3FsRGF0YWJhc2UiLCJkZWZhdWx0IiwibXNzcWxIb3N0IiwiaG9zdCIsIm1zc3FsUG9ydCIsIm1zc3FsVXNlciIsIm1zc3FsUGFzc3dvcmQiLCJtc3NxbFNjaGVtYSIsIm1zc3FsU2NoZW1hVmlld3MiLCJtc3NxbFN5bmNFdmVudHMiLCJtc3NxbEJlZm9yZUZ1bmN0aW9uIiwibXNzcWxBZnRlckZ1bmN0aW9uIiwicmVxdWlyZWQiLCJtc3NxbFJlcG9ydEJhc2VVcmwiLCJtc3NxbE1lZGlhQmFzZVVybCIsIm1zc3FsVW5kZXJzY29yZU5hbWVzIiwibXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lcyIsIm1zc3FsUHJlZml4IiwiaGFuZGxlciIsInN1YnN0cmluZyIsInVzZVN5bmNFdmVudHMiLCJ1c2VyIiwicGFzc3dvcmQiLCJyZXF1aXJlIiwiYXBwIiwiY29ubmVjdCIsIm9uIiwic2V0dXBPcHRpb25zIiwibWF5YmVJbml0aWFsaXplIiwiZGVhY3RpdmF0ZSIsImNsb3NlIiwib2JqZWN0IiwidmFsdWVzIiwiZmlsZSIsImFjY2Vzc19rZXkiLCJ0YWJsZSIsImRlbGV0ZVN0YXRlbWVudCIsInJvd19yZXNvdXJjZV9pZCIsImluc2VydFN0YXRlbWVudCIsInBrIiwic3RhY2siLCJzY2hlbWEiLCJ2YWx1ZXNUcmFuc2Zvcm1lciIsIm1lZGlhVVJMRm9ybWF0dGVyIiwibWVkaWFWYWx1ZSIsIml0ZW1zIiwiaXRlbSIsImVsZW1lbnQiLCJpc1Bob3RvRWxlbWVudCIsIm1lZGlhSUQiLCJpc1ZpZGVvRWxlbWVudCIsImlzQXVkaW9FbGVtZW50IiwibWVkaWFWaWV3VVJMRm9ybWF0dGVyIiwiaWRzIiwicmVwb3J0VVJMRm9ybWF0dGVyIiwiZmVhdHVyZSIsInZpZXdOYW1lIiwiZ2V0RnJpZW5kbHlUYWJsZU5hbWUiLCJ0YWJsZU5hbWVXaXRoRm9ybUFuZFNjaGVtYSIsImRhdGFOYW1lIiwiZm9ybUlEIiwicHJlZml4Iiwia2V5Iiwib2JqZWN0TmFtZSIsImJlZm9yZVN5bmMiLCJhZnRlclN5bmMiLCJmaW5kRWFjaFJlY29yZCIsImFjdGl2ZVZpZXdOYW1lcyIsInJlbW92ZSIsInByZXBhcmVNaWdyYXRpb25TY3JpcHQiLCJkYXRhYmFzZU5hbWUiLCJzcGxpdCIsImZpbmRFYWNoUGhvdG8iLCJmaW5kRWFjaFZpZGVvIiwiZmluZEVhY2hBdWRpbyIsImZpbmRFYWNoU2lnbmF0dXJlIiwiZmluZEVhY2hDaGFuZ2VzZXQiLCJmaW5kRWFjaFJvbGUiLCJmaW5kRWFjaFByb2plY3QiLCJmaW5kRWFjaEZvcm0iLCJmaW5kRWFjaE1lbWJlcnNoaXAiLCJmaW5kRWFjaENob2ljZUxpc3QiLCJmaW5kRWFjaENsYXNzaWZpY2F0aW9uU2V0IiwiaXNBdXRvbWF0aWNJbml0aWFsaXphdGlvbkRpc2FibGVkIiwibWF5YmVSdW5NaWdyYXRpb25zIiwibWlncmF0aW9ucyIsInBvcHVsYXRlUmVjb3JkcyIsImNvdW50IiwidmVyc2lvbiIsIm5lZWRzTWlncmF0aW9uIiwibWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0IiwiZmllbGRzIiwiZmlsdGVyIiwiZGlzcGxheSIsImlzRGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7O0lBS1lBLEc7O0FBSlo7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7Ozs7QUFFQSxNQUFNQyx3QkFBd0IsR0FBOUI7O0FBRUEsTUFBTUMsZUFBZTtBQUNuQkMsWUFBVSxZQURTO0FBRW5CQyxVQUFRLFdBRlc7QUFHbkJDLFFBQU0sSUFIYTtBQUluQkMsT0FBSyxFQUpjO0FBS25CQyxxQkFBbUIsS0FMQTtBQU1uQkMsa0JBQWdCO0FBTkcsQ0FBckI7O0FBU0EsTUFBTUMsYUFBYTtBQUNqQiwwQkFEaUI7QUFFakIsMEJBRmlCO0FBR2pCLDBCQUhpQjtBQUlqQiwyQkFKaUI7QUFLakI7QUFMaUIsQ0FBbkI7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QixFQUF4QixDQUFwQjs7QUFFQSxXQUFLLE1BQU1DLElBQVgsSUFBbUJGLEtBQW5CLEVBQTBCO0FBQ3hCLGNBQU15UCxTQUFTdlAsS0FBS3NJLGNBQUwsQ0FBb0IsaUJBQXBCLEVBQXVDa0gsTUFBdkMsQ0FBOEM7QUFBQSxpQkFBVzdDLFFBQVE4QyxPQUFSLENBQWdCQyxNQUEzQjtBQUFBLFNBQTlDLENBQWY7O0FBRUEsWUFBSUgsT0FBT2hILE1BQVgsRUFBbUI7QUFDakJqSyxjQUFJLDhDQUFKLEVBQW9EMEIsS0FBS1EsSUFBekQ7O0FBRUEsZ0JBQU0sUUFBS0gsV0FBTCxDQUFpQkwsSUFBakIsRUFBdUJSLE9BQXZCLEVBQWdDLFlBQU0sQ0FBRSxDQUF4QyxDQUFOO0FBQ0Q7QUFDRjtBQVg4QztBQVloRDs7QUF4aUNrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtc3NxbCBmcm9tICdtc3NxbCc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICd1dGlsJztcbmltcG9ydCBNU1NRTFNjaGVtYSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBNU1NRTCB9IGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IE1TU1FMUmVjb3JkVmFsdWVzIGZyb20gJy4vbXNzcWwtcmVjb3JkLXZhbHVlcydcbmltcG9ydCBzbmFrZSBmcm9tICdzbmFrZS1jYXNlJztcbmltcG9ydCB0ZW1wbGF0ZURyb3AgZnJvbSAnLi90ZW1wbGF0ZS5kcm9wLnNxbCc7XG5pbXBvcnQgU2NoZW1hTWFwIGZyb20gJy4vc2NoZW1hLW1hcCc7XG5pbXBvcnQgKiBhcyBhcGkgZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgeyBjb21wYWN0LCBkaWZmZXJlbmNlLCBwYWRTdGFydCB9IGZyb20gJ2xvZGFzaCc7XG5cbmltcG9ydCB2ZXJzaW9uMDAxIGZyb20gJy4vdmVyc2lvbi0wMDEuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDAyIGZyb20gJy4vdmVyc2lvbi0wMDIuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDAzIGZyb20gJy4vdmVyc2lvbi0wMDMuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDA0IGZyb20gJy4vdmVyc2lvbi0wMDQuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDA1IGZyb20gJy4vdmVyc2lvbi0wMDUuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDA2IGZyb20gJy4vdmVyc2lvbi0wMDYuc3FsJztcblxuY29uc3QgTUFYX0lERU5USUZJRVJfTEVOR1RIID0gMTAwO1xuXG5jb25zdCBNU1NRTF9DT05GSUcgPSB7XG4gIGRhdGFiYXNlOiAnZnVsY3J1bWFwcCcsXG4gIHNlcnZlcjogJ2xvY2FsaG9zdCcsXG4gIHBvcnQ6IDE0MzMsXG4gIG1heDogMTAsXG4gIGlkbGVUaW1lb3V0TWlsbGlzOiAzMDAwMCxcbiAgcmVxdWVzdFRpbWVvdXQ6IDEyMDAwMFxufTtcblxuY29uc3QgTUlHUkFUSU9OUyA9IHtcbiAgJzAwMic6IHZlcnNpb24wMDIsXG4gICcwMDMnOiB2ZXJzaW9uMDAzLFxuICAnMDA0JzogdmVyc2lvbjAwNCxcbiAgJzAwNSc6IHZlcnNpb24wMDUsXG4gICcwMDYnOiB2ZXJzaW9uMDA2XG59O1xuXG5jb25zdCBDVVJSRU5UX1ZFUlNJT04gPSA2O1xuXG5jb25zdCBERUZBVUxUX1NDSEVNQSA9ICdkYm8nO1xuXG5jb25zdCB7IGxvZywgd2FybiwgZXJyb3IsIGluZm8gfSA9IGZ1bGNydW0ubG9nZ2VyLndpdGhDb250ZXh0KCdtc3NxbCcpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXG4gICAgICBkZXNjOiAncnVuIHRoZSBtc3NxbCBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG1zc3FsQ29ubmVjdGlvblN0cmluZzoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBjb25uZWN0aW9uIHN0cmluZyAob3ZlcnJpZGVzIGFsbCBpbmRpdmlkdWFsIGRhdGFiYXNlIGNvbm5lY3Rpb24gcGFyYW1ldGVycyknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRGF0YWJhc2U6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgZGF0YWJhc2UgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmRhdGFiYXNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsSG9zdDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgaG9zdCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQb3J0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcbiAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLnBvcnRcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxVc2VyOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHVzZXInLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUGFzc3dvcmQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2NoZW1hOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTY2hlbWFWaWV3czoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEgZm9yIHRoZSBmcmllbmRseSB2aWV3cycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTeW5jRXZlbnRzOiB7XG4gICAgICAgICAgZGVzYzogJ2FkZCBzeW5jIGV2ZW50IGhvb2tzJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEJlZm9yZUZ1bmN0aW9uOiB7XG4gICAgICAgICAgZGVzYzogJ2NhbGwgdGhpcyBmdW5jdGlvbiBiZWZvcmUgdGhlIHN5bmMnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQWZ0ZXJGdW5jdGlvbjoge1xuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYWZ0ZXIgdGhlIHN5bmMnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxGb3JtOiB7XG4gICAgICAgICAgZGVzYzogJ3RoZSBmb3JtIElEIHRvIHJlYnVpbGQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUmVwb3J0QmFzZVVybDoge1xuICAgICAgICAgIGRlc2M6ICdyZXBvcnQgVVJMIGJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsTWVkaWFCYXNlVXJsOiB7XG4gICAgICAgICAgZGVzYzogJ21lZGlhIFVSTCBiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFVuZGVyc2NvcmVOYW1lczoge1xuICAgICAgICAgIGRlc2M6ICd1c2UgdW5kZXJzY29yZSBuYW1lcyAoZS5nLiBcIlBhcmsgSW5zcGVjdGlvbnNcIiBiZWNvbWVzIFwicGFya19pbnNwZWN0aW9uc1wiKScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUGVyc2lzdGVudFRhYmxlTmFtZXM6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHRoZSBzZXJ2ZXIgaWQgaW4gdGhlIGZvcm0gdGFibGUgbmFtZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQcmVmaXg6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHRoZSBvcmdhbml6YXRpb24gSUQgYXMgYSBwcmVmaXggaW4gdGhlIG9iamVjdCBuYW1lcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUmVidWlsZFZpZXdzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IHJlYnVpbGQgdGhlIHZpZXdzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQ3VzdG9tTW9kdWxlOiB7XG4gICAgICAgICAgZGVzYzogJ2EgY3VzdG9tIG1vZHVsZSB0byBsb2FkIHdpdGggc3luYyBleHRlbnNpb25zIChleHBlcmltZW50YWwpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTZXR1cDoge1xuICAgICAgICAgIGRlc2M6ICdzZXR1cCB0aGUgZGF0YWJhc2UnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbidcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxEcm9wOiB7XG4gICAgICAgICAgZGVzYzogJ2Ryb3AgdGhlIHN5c3RlbSB0YWJsZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTeXN0ZW1UYWJsZXNPbmx5OiB7XG4gICAgICAgICAgZGVzYzogJ29ubHkgY3JlYXRlIHRoZSBzeXN0ZW0gcmVjb3JkcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNraXBGYWlsdXJlczoge1xuICAgICAgICAgIGRlc2M6ICdza2lwIGZhaWx1cmVzIGluIHJvd3MgYW5kIHRhYmxlcyB0aGF0IGFyZSB0b28gbGFyZ2UnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZURhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcERhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BTeXN0ZW1UYWJsZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU2V0dXApIHtcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU3lzdGVtVGFibGVzT25seSkge1xuICAgICAgICBhd2FpdCB0aGlzLnNldHVwU3lzdGVtVGFibGVzKGFjY291bnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcblxuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRm9ybSAmJiBmb3JtLmlkICE9PSBmdWxjcnVtLmFyZ3MubXNzcWxGb3JtKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUmVidWlsZFZpZXdzT25seSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZyaWVuZGx5Vmlld3MoZm9ybSwgYWNjb3VudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoaW5kZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvZygnJyk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQWZ0ZXJGdW5jdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIHRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gaWRlbnRpZmllci5zdWJzdHJpbmcoMCwgTUFYX0lERU5USUZJRVJfTEVOR1RIKTtcbiAgfVxuXG4gIGVzY2FwZUlkZW50aWZpZXIgPSAoaWRlbnRpZmllcikgPT4ge1xuICAgIHJldHVybiBpZGVudGlmaWVyICYmIHRoaXMubXNzcWwuaWRlbnQodGhpcy50cmltSWRlbnRpZmllcihpZGVudGlmaWVyKSk7XG4gIH1cblxuICBnZXQgdXNlU3luY0V2ZW50cygpIHtcbiAgICByZXR1cm4gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyAhPSBudWxsID8gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyA6IHRydWU7XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICB0aGlzLmFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAuLi5NU1NRTF9DT05GSUcsXG4gICAgICBzZXJ2ZXI6IGZ1bGNydW0uYXJncy5tc3NxbEhvc3QgfHwgTVNTUUxfQ09ORklHLnNlcnZlcixcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc3NxbFBvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zc3FsRGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zc3FsVXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCB8fCBNU1NRTF9DT05GSUcudXNlclxuICAgIH07XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsVXNlcikge1xuICAgICAgb3B0aW9ucy51c2VyID0gZnVsY3J1bS5hcmdzLm1zc3FsVXNlcjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUGFzc3dvcmQpIHtcbiAgICAgIG9wdGlvbnMucGFzc3dvcmQgPSBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZDtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3VzdG9tTW9kdWxlKSB7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlID0gcmVxdWlyZShmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpO1xuICAgICAgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hcGkgPSBhcGk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwcCA9IGZ1bGNydW07XG4gICAgfVxuXG4gICAgdGhpcy5kaXNhYmxlQXJyYXlzID0gZmFsc2U7XG4gICAgdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzID0gdHJ1ZTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lcyA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy51c2VBY2NvdW50UHJlZml4ID0gKGZ1bGNydW0uYXJncy5tc3NxbFByZWZpeCAhPT0gZmFsc2UpO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChmdWxjcnVtLmFyZ3MubXNzcWxDb25uZWN0aW9uU3RyaW5nIHx8IG9wdGlvbnMpO1xuXG4gICAgaWYgKHRoaXMudXNlU3luY0V2ZW50cykge1xuICAgICAgZnVsY3J1bS5vbignc3luYzpzdGFydCcsIHRoaXMub25TeW5jU3RhcnQpO1xuICAgICAgZnVsY3J1bS5vbignc3luYzpmaW5pc2gnLCB0aGlzLm9uU3luY0ZpbmlzaCk7XG4gICAgICBmdWxjcnVtLm9uKCdwaG90bzpzYXZlJywgdGhpcy5vblBob3RvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCd2aWRlbzpzYXZlJywgdGhpcy5vblZpZGVvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdhdWRpbzpzYXZlJywgdGhpcy5vbkF1ZGlvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdzaWduYXR1cmU6c2F2ZScsIHRoaXMub25TaWduYXR1cmVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NoYW5nZXNldDpzYXZlJywgdGhpcy5vbkNoYW5nZXNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6ZGVsZXRlJywgdGhpcy5vblJlY29yZERlbGV0ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2Nob2ljZS1saXN0OnNhdmUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6ZGVsZXRlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignZm9ybTpzYXZlJywgdGhpcy5vbkZvcm1TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2Zvcm06ZGVsZXRlJywgdGhpcy5vbkZvcm1TYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OnNhdmUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uLXNldDpkZWxldGUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncm9sZTpzYXZlJywgdGhpcy5vblJvbGVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JvbGU6ZGVsZXRlJywgdGhpcy5vblJvbGVTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpzYXZlJywgdGhpcy5vblByb2plY3RTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Byb2plY3Q6ZGVsZXRlJywgdGhpcy5vblByb2plY3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpzYXZlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ21lbWJlcnNoaXA6ZGVsZXRlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICB9XG5cbiAgICB0aGlzLnZpZXdTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWFWaWV3cyB8fCBERUZBVUxUX1NDSEVNQTtcbiAgICB0aGlzLmRhdGFTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWEgfHwgREVGQVVMVF9TQ0hFTUE7XG5cbiAgICAvLyBGZXRjaCBhbGwgdGhlIGV4aXN0aW5nIHRhYmxlcyBvbiBzdGFydHVwLiBUaGlzIGFsbG93cyB1cyB0byBzcGVjaWFsIGNhc2UgdGhlXG4gICAgLy8gY3JlYXRpb24gb2YgbmV3IHRhYmxlcyBldmVuIHdoZW4gdGhlIGZvcm0gaXNuJ3QgdmVyc2lvbiAxLiBJZiB0aGUgdGFibGUgZG9lc24ndFxuICAgIC8vIGV4aXN0LCB3ZSBjYW4gcHJldGVuZCB0aGUgZm9ybSBpcyB2ZXJzaW9uIDEgc28gaXQgY3JlYXRlcyBhbGwgbmV3IHRhYmxlcyBpbnN0ZWFkXG4gICAgLy8gb2YgYXBwbHlpbmcgYSBzY2hlbWEgZGlmZi5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICAvLyBtYWtlIGEgY2xpZW50IHNvIHdlIGNhbiB1c2UgaXQgdG8gYnVpbGQgU1FMIHN0YXRlbWVudHNcbiAgICB0aGlzLm1zc3FsID0gbmV3IE1TU1FMKHt9KTtcblxuICAgIHRoaXMuc2V0dXBPcHRpb25zKCk7XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlSW5pdGlhbGl6ZSgpO1xuICB9XG5cbiAgYXN5bmMgZGVhY3RpdmF0ZSgpIHtcbiAgICBpZiAodGhpcy5wb29sKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvb2wuY2xvc2UoKTtcbiAgICB9XG4gIH1cblxuICBydW4gPSBhc3luYyAoc3FsKSA9PiB7XG4gICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcMC9nLCAnJyk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICBsb2coc3FsKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBvb2wucmVxdWVzdCgpLmJhdGNoKHNxbCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnJlY29yZHNldDtcbiAgfVxuXG4gIHJ1bkFsbCA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgcmVzdWx0cy5wdXNoKGF3YWl0IHRoaXMucnVuKHNxbCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgcnVuQWxsVHJhbnNhY3Rpb24gPSBhc3luYyAoc3RhdGVtZW50cykgPT4ge1xuICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gbmV3IG1zc3FsLlRyYW5zYWN0aW9uKHRoaXMucG9vbCk7XG5cbiAgICBhd2FpdCB0cmFuc2FjdGlvbi5iZWdpbigpO1xuXG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgY29uc3QgcmVxdWVzdCA9IG5ldyBtc3NxbC5SZXF1ZXN0KHRyYW5zYWN0aW9uKTtcblxuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBsb2coc3FsKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdC5iYXRjaChzcWwpO1xuXG4gICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICB9XG5cbiAgICBhd2FpdCB0cmFuc2FjdGlvbi5jb21taXQoKTtcblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgbG9nID0gKC4uLmFyZ3MpID0+IHtcbiAgICAvLyBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfVxuXG4gIHRhYmxlTmFtZSA9IChhY2NvdW50LCBuYW1lKSA9PiB7XG4gICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcblxuICAgIGlmICh0aGlzLnVzZUFjY291bnRQcmVmaXgpIHtcbiAgICAgIHJldHVybiAnYWNjb3VudF8nICsgYWNjb3VudC5yb3dJRCArICdfJyArIG5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxuICBvblN5bmNTdGFydCA9IGFzeW5jICh7YWNjb3VudCwgdGFza3N9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuICB9XG5cbiAgb25TeW5jRmluaXNoID0gYXN5bmMgKHthY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMuY2xlYW51cEZyaWVuZGx5Vmlld3MoYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gIH1cblxuICBvbkZvcm1TYXZlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcbiAgfVxuXG4gIG9uRm9ybURlbGV0ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudH0pID0+IHtcbiAgICBjb25zdCBvbGRGb3JtID0ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG51bGwpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuICB9XG5cbiAgb25QaG90b1NhdmUgPSBhc3luYyAoe3Bob3RvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICB9XG5cbiAgb25WaWRlb1NhdmUgPSBhc3luYyAoe3ZpZGVvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVmlkZW8odmlkZW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25BdWRpb1NhdmUgPSBhc3luYyAoe2F1ZGlvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25TaWduYXR1cmVTYXZlID0gYXN5bmMgKHtzaWduYXR1cmUsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hhbmdlc2V0U2F2ZSA9IGFzeW5jICh7Y2hhbmdlc2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNob2ljZUxpc3RTYXZlID0gYXN5bmMgKHtjaG9pY2VMaXN0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hvaWNlTGlzdChjaG9pY2VMaXN0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2xhc3NpZmljYXRpb25TZXRTYXZlID0gYXN5bmMgKHtjbGFzc2lmaWNhdGlvblNldCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KGNsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUHJvamVjdFNhdmUgPSBhc3luYyAoe3Byb2plY3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQcm9qZWN0KHByb2plY3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25Sb2xlU2F2ZSA9IGFzeW5jICh7cm9sZSwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJvbGUocm9sZSwgYWNjb3VudCk7XG4gIH1cblxuICBvbk1lbWJlcnNoaXBTYXZlID0gYXN5bmMgKHttZW1iZXJzaGlwLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChtZW1iZXJzaGlwLCBhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVBob3RvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5waG90byhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFBob3RvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3Bob3RvcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlVmlkZW8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnZpZGVvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0VmlkZW9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAndmlkZW9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAuYXVkaW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRBdWRpb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdhdWRpbycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlU2lnbmF0dXJlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5zaWduYXR1cmUob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRTaWduYXR1cmVVUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAnc2lnbmF0dXJlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2hhbmdlc2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaGFuZ2VzZXQob2JqZWN0KSwgJ2NoYW5nZXNldHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnByb2plY3Qob2JqZWN0KSwgJ3Byb2plY3RzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5tZW1iZXJzaGlwKG9iamVjdCksICdtZW1iZXJzaGlwcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucm9sZShvYmplY3QpLCAncm9sZXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmZvcm0ob2JqZWN0KSwgJ2Zvcm1zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaG9pY2VMaXN0KG9iamVjdCksICdjaG9pY2VfbGlzdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jbGFzc2lmaWNhdGlvblNldChvYmplY3QpLCAnY2xhc3NpZmljYXRpb25fc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlT2JqZWN0KHZhbHVlcywgdGFibGUpIHtcbiAgICBjb25zdCBkZWxldGVTdGF0ZW1lbnQgPSB0aGlzLm1zc3FsLmRlbGV0ZVN0YXRlbWVudChgJHsgdGhpcy5kYXRhU2NoZW1hIH0uc3lzdGVtXyR7dGFibGV9YCwge3Jvd19yZXNvdXJjZV9pZDogdmFsdWVzLnJvd19yZXNvdXJjZV9pZH0pO1xuICAgIGNvbnN0IGluc2VydFN0YXRlbWVudCA9IHRoaXMubXNzcWwuaW5zZXJ0U3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB2YWx1ZXMsIHtwazogJ2lkJ30pO1xuXG4gICAgY29uc3Qgc3FsID0gWyBkZWxldGVTdGF0ZW1lbnQuc3FsLCBpbnNlcnRTdGF0ZW1lbnQuc3FsIF0uam9pbignXFxuJyk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oc3FsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgd2FybihgdXBkYXRlT2JqZWN0ICR7dGFibGV9IGZhaWxlZGApO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cbiAgfVxuXG4gIHJlbG9hZFRhYmxlTGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG4gIH1cblxuICByZWxvYWRWaWV3TGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy52aWV3U2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnZpZXdOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIGJhc2VNZWRpYVVSTCA9ICgpID0+IHtcbiAgfVxuXG4gIGZvcm1hdFBob3RvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy8keyBpZCB9LmpwZ2A7XG4gIH1cblxuICBmb3JtYXRWaWRlb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS92aWRlb3MvJHsgaWQgfS5tcDRgO1xuICB9XG5cbiAgZm9ybWF0QXVkaW9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vJHsgaWQgfS5tNGFgO1xuICB9XG5cbiAgZm9ybWF0U2lnbmF0dXJlVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3NpZ25hdHVyZXMvJHsgaWQgfS5wbmdgO1xuICB9XG5cbiAgaW50ZWdyaXR5V2FybmluZyhleCkge1xuICAgIHdhcm4oYFxuLS0tLS0tLS0tLS0tLVxuISEgV0FSTklORyAhIVxuLS0tLS0tLS0tLS0tLVxuXG5NU1NRTCBkYXRhYmFzZSBpbnRlZ3JpdHkgaXNzdWUgZW5jb3VudGVyZWQuIENvbW1vbiBzb3VyY2VzIG9mIGRhdGFiYXNlIGlzc3VlcyBhcmU6XG5cbiogUmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBhbmQgdXNpbmcgYW4gb2xkIE1TU1FMIGRhdGFiYXNlIHdpdGhvdXQgcmVjcmVhdGluZ1xuICB0aGUgTVNTUUwgZGF0YWJhc2UuXG4qIERlbGV0aW5nIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZSBhbmQgdXNpbmcgYW4gZXhpc3RpbmcgTVNTUUwgZGF0YWJhc2VcbiogTWFudWFsbHkgbW9kaWZ5aW5nIHRoZSBNU1NRTCBkYXRhYmFzZVxuKiBDcmVhdGluZyBtdWx0aXBsZSBhcHBzIGluIEZ1bGNydW0gd2l0aCB0aGUgc2FtZSBuYW1lLiBUaGlzIGlzIGdlbmVyYWxseSBPSywgZXhjZXB0XG4gIHlvdSB3aWxsIG5vdCBiZSBhYmxlIHRvIHVzZSB0aGUgXCJmcmllbmRseSB2aWV3XCIgZmVhdHVyZSBvZiB0aGUgTVNTUUwgcGx1Z2luIHNpbmNlXG4gIHRoZSB2aWV3IG5hbWVzIGFyZSBkZXJpdmVkIGZyb20gdGhlIGZvcm0gbmFtZXMuXG5cbk5vdGU6IFdoZW4gcmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBvciBcInN0YXJ0aW5nIG92ZXJcIiB5b3UgbmVlZCB0byBkcm9wIGFuZCByZS1jcmVhdGVcbnRoZSBNU1NRTCBkYXRhYmFzZS4gVGhlIG5hbWVzIG9mIGRhdGFiYXNlIG9iamVjdHMgYXJlIHRpZWQgZGlyZWN0bHkgdG8gdGhlIGRhdGFiYXNlXG5vYmplY3RzIGluIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZS5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5SZXBvcnQgaXNzdWVzIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9mdWxjcnVtYXBwL2Z1bGNydW0tZGVza3RvcC9pc3N1ZXNcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuTWVzc2FnZTpcbiR7IGV4Lm1lc3NhZ2UgfVxuXG5TdGFjazpcbiR7IGV4LnN0YWNrIH1cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuYC5yZWRcbiAgICApO1xuICB9XG5cbiAgc2V0dXBPcHRpb25zKCkge1xuICAgIHRoaXMuYmFzZU1lZGlhVVJMID0gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsID8gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsIDogJ2h0dHBzOi8vYXBpLmZ1bGNydW1hcHAuY29tL2FwaS92Mic7XG5cbiAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyA9IHtcbiAgICAgIHNjaGVtYTogdGhpcy5kYXRhU2NoZW1hLFxuXG4gICAgICBlc2NhcGVJZGVudGlmaWVyOiB0aGlzLmVzY2FwZUlkZW50aWZpZXIsXG5cbiAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcblxuICAgICAgcGVyc2lzdGVudFRhYmxlTmFtZXM6IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMsXG5cbiAgICAgIGFjY291bnRQcmVmaXg6IHRoaXMudXNlQWNjb3VudFByZWZpeCA/ICdhY2NvdW50XycgKyB0aGlzLmFjY291bnQucm93SUQgOiBudWxsLFxuXG4gICAgICBjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0OiAnZGF0ZScsXG5cbiAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IHRoaXMuZGlzYWJsZUNvbXBsZXhUeXBlcyxcblxuICAgICAgdmFsdWVzVHJhbnNmb3JtZXI6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS52YWx1ZXNUcmFuc2Zvcm1lcixcblxuICAgICAgbWVkaWFVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG5cbiAgICAgICAgcmV0dXJuIG1lZGlhVmFsdWUuaXRlbXMubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1Bob3RvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0UGhvdG9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0VmlkZW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0QXVkaW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBtZWRpYVZpZXdVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG4gICAgICAgIGNvbnN0IGlkcyA9IG1lZGlhVmFsdWUuaXRlbXMubWFwKG8gPT4gby5tZWRpYUlEKTtcblxuICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy92aWV3P3Bob3Rvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy92aWV3P3ZpZGVvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvL3ZpZXc/YXVkaW89JHsgaWRzIH1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZXBvcnRCYXNlVXJsKSB7XG4gICAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucy5yZXBvcnRVUkxGb3JtYXR0ZXIgPSAoZmVhdHVyZSkgPT4ge1xuICAgICAgICByZXR1cm4gYCR7IGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwgfS9yZXBvcnRzLyR7IGZlYXR1cmUuaWQgfS5wZGZgO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVSZWNvcmQgPSBhc3luYyAocmVjb3JkLCBhY2NvdW50LCBza2lwVGFibGVDaGVjaykgPT4ge1xuICAgIGlmICghc2tpcFRhYmxlQ2hlY2sgJiYgIXRoaXMucm9vdFRhYmxlRXhpc3RzKHJlY29yZC5mb3JtKSkge1xuICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShyZWNvcmQuZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZVJlY29yZCh7cmVjb3JkLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMudXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMucnVuU2tpcHBpbmdGYWlsdXJlcyhcbiAgICAgIGBTa2lwcGluZyByZWNvcmQgJHtyZWNvcmQuaWR9IGluIGZvcm0gJHtyZWNvcmQuZm9ybS5pZH0uYCxcbiAgICAgICgpID0+IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKVxuICAgICk7XG5cbiAgICBjb25zdCBzeXN0ZW1WYWx1ZXMgPSBNU1NRTFJlY29yZFZhbHVlcy5zeXN0ZW1Db2x1bW5WYWx1ZXNGb3JGZWF0dXJlKHJlY29yZCwgbnVsbCwgcmVjb3JkLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucmVjb3JkKHJlY29yZCwgc3lzdGVtVmFsdWVzKSwgJ3JlY29yZHMnKTtcbiAgfVxuXG4gIHJvb3RUYWJsZUV4aXN0cyA9IChmb3JtKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVOYW1lcy5pbmRleE9mKE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0sIG51bGwsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKSkgIT09IC0xO1xuICB9XG5cbiAgcmVjcmVhdGVGb3JtVGFibGVzID0gYXN5bmMgKGZvcm0sIGFjY291bnQpID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSksIG51bGwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGVycm9yKGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgbnVsbCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSk7XG4gIH1cblxuICB1cGRhdGVGb3JtID0gYXN5bmMgKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pID0+IHtcbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0gJiYgIXRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSh7Zm9ybSwgYWNjb3VudH0pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGluZm8oJ1VwZGF0aW5nIGZvcm0nLCBmb3JtLmlkKTtcblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KGZvcm0sIGFjY291bnQpO1xuXG4gICAgICBpZiAoIXRoaXMucm9vdFRhYmxlRXhpc3RzKGZvcm0pICYmIG5ld0Zvcm0gIT0gbnVsbCkge1xuICAgICAgICBvbGRGb3JtID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgZGlzYWJsZUFycmF5czogdGhpcy5kaXNhYmxlQXJyYXlzLFxuICAgICAgICBkaXNhYmxlQ29tcGxleFR5cGVzOiBmYWxzZSxcbiAgICAgICAgdXNlck1vZHVsZTogdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSxcbiAgICAgICAgdGFibGVTY2hlbWE6IHRoaXMuZGF0YVNjaGVtYSxcbiAgICAgICAgY2FsY3VsYXRlZEZpZWxkRGF0ZUZvcm1hdDogJ2RhdGUnLFxuICAgICAgICBtZXRhZGF0YTogdHJ1ZSxcbiAgICAgICAgdXNlUmVzb3VyY2VJRDogdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyxcbiAgICAgICAgYWNjb3VudFByZWZpeDogdGhpcy51c2VBY2NvdW50UHJlZml4ID8gJ2FjY291bnRfJyArIHRoaXMuYWNjb3VudC5yb3dJRCA6IG51bGxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHtzdGF0ZW1lbnRzfSA9IGF3YWl0IE1TU1FMU2NoZW1hLmdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtLCBvcHRpb25zKTtcblxuICAgICAgaW5mbygnRHJvcHBpbmcgdmlld3MnLCBmb3JtLmlkKTtcblxuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgIH1cblxuICAgICAgaW5mbygnUnVubmluZyBzY2hlbWEgc3RhdGVtZW50cycsIGZvcm0uaWQsIHN0YXRlbWVudHMubGVuZ3RoKTtcblxuICAgICAgaW5mbygnU2NoZW1hIHN0YXRlbWVudHMnLCAnXFxuJywgc3RhdGVtZW50cy5qb2luKCdcXG4nKSk7XG5cbiAgICAgIGF3YWl0IHRoaXMucnVuU2tpcHBpbmdGYWlsdXJlcyhcbiAgICAgICAgYFNraXBwaW5nIGZvcm0gJHtmb3JtLmlkfS5gLFxuICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5ydW5BbGxUcmFuc2FjdGlvbihzdGF0ZW1lbnRzKTtcblxuICAgICAgICAgIGluZm8oJ0NyZWF0aW5nIHZpZXdzJywgZm9ybS5pZCk7XG4gICAgXG4gICAgICAgICAgaWYgKG5ld0Zvcm0pIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuICAgIFxuICAgICAgICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgXG4gICAgICAgICAgaW5mbygnQ29tcGxldGVkIGZvcm0gdXBkYXRlJywgZm9ybS5pZCk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGluZm8oJ3VwZGF0ZUZvcm0gZmFpbGVkJyk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdChcIklGIE9CSkVDVF9JRCgnJXMuJXMnLCAnVicpIElTIE5PVCBOVUxMIERST1AgVklFVyAlcy4lcztcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB3YXJuKCdkcm9wRnJpZW5kbHlWaWV3IGZhaWxlZCcpO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBjcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0NSRUFURSBWSUVXICVzLiVzIEFTIFNFTEVDVCAqIEZST00gJXM7JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtQW5kU2NoZW1hKGZvcm0sIHJlcGVhdGFibGUsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zLCAnX3ZpZXdfZnVsbCcpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIC8vIHNvbWV0aW1lcyBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICB3YXJuKCdjcmVhdGVGcmllbmRseVZpZXcgZmFpbGVkJyk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgIH1cbiAgfVxuXG4gIGdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCBuYW1lID0gY29tcGFjdChbZm9ybS5uYW1lLCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUuZGF0YU5hbWVdKS5qb2luKCcgLSAnKVxuXG4gICAgY29uc3QgZm9ybUlEID0gdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyA/IGZvcm0uaWQgOiBmb3JtLnJvd0lEO1xuXG4gICAgY29uc3QgcHJlZml4ID0gY29tcGFjdChbJ3ZpZXcnLCBmb3JtSUQsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5rZXldKS5qb2luKCcgLSAnKTtcblxuICAgIGNvbnN0IG9iamVjdE5hbWUgPSBbcHJlZml4LCBuYW1lXS5qb2luKCcgLSAnKTtcblxuICAgIHJldHVybiB0aGlzLnRyaW1JZGVudGlmaWVyKGZ1bGNydW0uYXJncy5tc3NxbFVuZGVyc2NvcmVOYW1lcyAhPT0gZmFsc2UgPyBzbmFrZShvYmplY3ROYW1lKSA6IG9iamVjdE5hbWUpO1xuICB9XG5cbiAgYXN5bmMgaW52b2tlQmVmb3JlRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBpbnZva2VBZnRlckZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxBZnRlckZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFmdGVyU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCBwcm9ncmVzcykge1xuICAgIGF3YWl0IHRoaXMucmVjcmVhdGVGb3JtVGFibGVzKGZvcm0sIGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIHByb2dyZXNzKGluZGV4KTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFZpZXdMaXN0KCk7XG5cbiAgICBjb25zdCBhY3RpdmVWaWV3TmFtZXMgPSBbXTtcblxuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIG51bGwpKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmUgPSBkaWZmZXJlbmNlKHRoaXMudmlld05hbWVzLCBhY3RpdmVWaWV3TmFtZXMpO1xuXG4gICAgZm9yIChjb25zdCB2aWV3TmFtZSBvZiByZW1vdmUpIHtcbiAgICAgIGlmICh2aWV3TmFtZS5pbmRleE9mKCd2aWV3XycpID09PSAwIHx8IHZpZXdOYW1lLmluZGV4T2YoJ3ZpZXcgLSAnKSA9PT0gMCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdChcIklGIE9CSkVDVF9JRCgnJXMuJXMnLCAnVicpIElTIE5PVCBOVUxMIERST1AgVklFVyAlcy4lcztcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgd2FybignY2xlYW51cEZyaWVuZGx5Vmlld3MgZmFpbGVkJyk7XG4gICAgICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG4gIH1cblxuICBmb3JtVmVyc2lvbiA9IChmb3JtKSA9PiB7XG4gICAgaWYgKGZvcm0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcbiAgfVxuXG4gIHVwZGF0ZVN0YXR1cyA9IChtZXNzYWdlKSA9PiB7XG4gICAgaWYgKHByb2Nlc3Muc3Rkb3V0LmlzVFRZKSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcFN5c3RlbVRhYmxlcygpIHtcbiAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodGVtcGxhdGVEcm9wKSk7XG4gIH1cblxuICBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICBsb2coJ0NyZWF0aW5nIGRhdGFiYXNlJywgZGF0YWJhc2VOYW1lKTtcbiAgICByZXR1cm4gdGhpcy5ydW4oYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBkcm9wRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgbG9nKCdEcm9wcGluZyBkYXRhYmFzZScsIGRhdGFiYXNlTmFtZSk7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBEUk9QIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfTtgKTtcbiAgfVxuXG4gIGFzeW5jIHNldHVwRGF0YWJhc2UoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHZlcnNpb24wMDEpKTtcbiAgfVxuXG4gIHByZXBhcmVNaWdyYXRpb25TY3JpcHQoc3FsKSB7XG4gICAgcmV0dXJuIHNxbC5yZXBsYWNlKC9fX1NDSEVNQV9fL2csIHRoaXMuZGF0YVNjaGVtYSlcbiAgICAgICAgICAgICAgLnJlcGxhY2UoL19fVklFV19TQ0hFTUFfXy9nLCB0aGlzLnZpZXdTY2hlbWEpLnNwbGl0KCc7Jyk7XG4gIH1cblxuICBhc3luYyBzZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KSB7XG4gICAgY29uc3QgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgICB9O1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFBob3RvKHt9LCBhc3luYyAocGhvdG8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Bob3RvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoVmlkZW8oe30sIGFzeW5jICh2aWRlbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnVmlkZW9zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVZpZGVvKHZpZGVvLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hBdWRpbyh7fSwgYXN5bmMgKGF1ZGlvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdBdWRpbycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVBdWRpbyhhdWRpbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoU2lnbmF0dXJlKHt9LCBhc3luYyAoc2lnbmF0dXJlLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdTaWduYXR1cmVzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNpZ25hdHVyZShzaWduYXR1cmUsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENoYW5nZXNldCh7fSwgYXN5bmMgKGNoYW5nZXNldCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hhbmdlc2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hSb2xlKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdSb2xlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUHJvamVjdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUHJvamVjdHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaEZvcm0oe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Zvcm1zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hNZW1iZXJzaGlwKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdNZW1iZXJzaGlwcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hvaWNlTGlzdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hvaWNlIExpc3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2xhc3NpZmljYXRpb24gU2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0IGlzQXV0b21hdGljSW5pdGlhbGl6YXRpb25EaXNhYmxlZCgpIHtcbiAgICByZXR1cm4gZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UgfHxcbiAgICAgIGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSB8fFxuICAgICAgZnVsY3J1bS5hcmdzLm1zc3FsRHJvcCB8fFxuICAgICAgZnVsY3J1bS5hcmdzLm1zc3FsU2V0dXA7XG4gIH1cblxuICBhc3luYyBtYXliZUluaXRpYWxpemUoKSB7XG4gICAgaWYgKHRoaXMuaXNBdXRvbWF0aWNJbml0aWFsaXphdGlvbkRpc2FibGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKHRoaXMudGFibGVOYW1lcy5pbmRleE9mKCdtaWdyYXRpb25zJykgPT09IC0xKSB7XG4gICAgICBsb2coJ0luaXRpdGFsaXppbmcgZGF0YWJhc2UuLi4nKTtcblxuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyBtYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCkge1xuICAgIHRoaXMubWlncmF0aW9ucyA9IChhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIG5hbWUgRlJPTSAkeyB0aGlzLmRhdGFTY2hlbWEgfS5taWdyYXRpb25zYCkpLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICBsZXQgcG9wdWxhdGVSZWNvcmRzID0gZmFsc2U7XG5cbiAgICBmb3IgKGxldCBjb3VudCA9IDI7IGNvdW50IDw9IENVUlJFTlRfVkVSU0lPTjsgKytjb3VudCkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IHBhZFN0YXJ0KGNvdW50LCAzLCAnMCcpO1xuXG4gICAgICBjb25zdCBuZWVkc01pZ3JhdGlvbiA9IHRoaXMubWlncmF0aW9ucy5pbmRleE9mKHZlcnNpb24pID09PSAtMSAmJiBNSUdSQVRJT05TW3ZlcnNpb25dO1xuXG4gICAgICBpZiAobmVlZHNNaWdyYXRpb24pIHtcbiAgICAgICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KE1JR1JBVElPTlNbdmVyc2lvbl0pKTtcblxuICAgICAgICBpZiAodmVyc2lvbiA9PT0gJzAwMicpIHtcbiAgICAgICAgICBsb2coJ1BvcHVsYXRpbmcgc3lzdGVtIHRhYmxlcy4uLicpO1xuICAgICAgICAgIHBvcHVsYXRlUmVjb3JkcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmVyc2lvbiA9PT0gJzAwNScpIHtcbiAgICAgICAgICBsb2coJ01pZ3JhdGluZyBkYXRlIGNhbGN1bGF0aW9uIGZpZWxkcy4uLicpO1xuICAgICAgICAgIGF3YWl0IHRoaXMubWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0KGFjY291bnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvcHVsYXRlUmVjb3Jkcykge1xuICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZVJlY29yZHMoYWNjb3VudCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcG9wdWxhdGVSZWNvcmRzKGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGluZGV4ID0gMDtcblxuICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMucHJvZ3Jlc3MoZm9ybS5uYW1lLCBpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdChhY2NvdW50KSB7XG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGNvbnN0IGZpZWxkcyA9IGZvcm0uZWxlbWVudHNPZlR5cGUoJ0NhbGN1bGF0ZWRGaWVsZCcpLmZpbHRlcihlbGVtZW50ID0+IGVsZW1lbnQuZGlzcGxheS5pc0RhdGUpO1xuXG4gICAgICBpZiAoZmllbGRzLmxlbmd0aCkge1xuICAgICAgICBsb2coJ01pZ3JhdGluZyBkYXRlIGNhbGN1bGF0aW9uIGZpZWxkcyBpbiBmb3JtLi4uJywgZm9ybS5uYW1lKTtcblxuICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsICgpID0+IHt9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm9ncmVzcyA9IChuYW1lLCBpbmRleCkgPT4ge1xuICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgfVxuXG4gIHJ1blNraXBwaW5nRmFpbHVyZXMgPSBhc3luYyAoY29udGV4dCwgYmxvY2spID0+IHtcbiAgICBpZiAoIWZ1bGNydW0uYXJncy5tc3NxbFNraXBGYWlsdXJlcykge1xuICAgICAgcmV0dXJuIGJsb2NrKCk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGJsb2NrKCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChleC5tZXNzYWdlLmluZGV4T2YoJ21heGltdW0gcm93IHNpemUgb2YgODA2MCcpICE9PSAtMSkge1xuICAgICAgICBsb2coJ1JvdyB0b28gbGFyZ2UuJywgY29udGV4dCwgZXgubWVzc2FnZSk7XG4gICAgICB9IGVsc2UgaWYgKGV4Lm1lc3NhZ2UuaW5kZXhPZignbWF4aW11bSBvZiAxMDI0IGNvbHVtbnMnKSAhPT0gLTEpIHtcbiAgICAgICAgbG9nKCdUYWJsZSB0b28gbGFyZ2UuJywgY29udGV4dCwgZXgubWVzc2FnZSk7XG4gICAgICB9IGVsc2UgaWYgKGV4Lm1lc3NhZ2UuaW5kZXhPZignSW52YWxpZCBvYmplY3QgbmFtZScpICE9PSAtMSkge1xuICAgICAgICBsb2coJ0ludmFsaWQgb2JqZWN0IG5hbWUuJywgY29udGV4dCwgZXgubWVzc2FnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBleDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==