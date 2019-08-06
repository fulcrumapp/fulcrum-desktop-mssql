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

        yield _this.run(statements.map(function (o) {
          return o.sql;
        }).join('\n'));

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

          yield _this.runAllTransaction(statements);

          info('Creating views', form.id);

          if (newForm) {
            yield _this.createFriendlyView(form, null);

            for (const repeatable of form.elementsOfType('Repeatable')) {
              yield _this.createFriendlyView(form, repeatable);
            }
          }

          info('Completed form update', form.id);
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
        var _ref26 = _asyncToGenerator(function* (record) {
          record.form = form;

          if (++index % 10 === 0) {
            progress(index);
          }

          yield _this21.updateRecord(record, account, true);
        });

        return function (_x29) {
          return _ref26.apply(this, arguments);
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
        var _ref27 = _asyncToGenerator(function* (photo, { index }) {
          if (++index % 10 === 0) {
            progress('Photos', index);
          }

          yield _this26.updatePhoto(photo, account);
        });

        return function (_x30, _x31) {
          return _ref27.apply(this, arguments);
        };
      })());

      yield account.findEachVideo({}, (() => {
        var _ref28 = _asyncToGenerator(function* (video, { index }) {
          if (++index % 10 === 0) {
            progress('Videos', index);
          }

          yield _this26.updateVideo(video, account);
        });

        return function (_x32, _x33) {
          return _ref28.apply(this, arguments);
        };
      })());

      yield account.findEachAudio({}, (() => {
        var _ref29 = _asyncToGenerator(function* (audio, { index }) {
          if (++index % 10 === 0) {
            progress('Audio', index);
          }

          yield _this26.updateAudio(audio, account);
        });

        return function (_x34, _x35) {
          return _ref29.apply(this, arguments);
        };
      })());

      yield account.findEachSignature({}, (() => {
        var _ref30 = _asyncToGenerator(function* (signature, { index }) {
          if (++index % 10 === 0) {
            progress('Signatures', index);
          }

          yield _this26.updateSignature(signature, account);
        });

        return function (_x36, _x37) {
          return _ref30.apply(this, arguments);
        };
      })());

      yield account.findEachChangeset({}, (() => {
        var _ref31 = _asyncToGenerator(function* (changeset, { index }) {
          if (++index % 10 === 0) {
            progress('Changesets', index);
          }

          yield _this26.updateChangeset(changeset, account);
        });

        return function (_x38, _x39) {
          return _ref31.apply(this, arguments);
        };
      })());

      yield account.findEachRole({}, (() => {
        var _ref32 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Roles', index);
          }

          yield _this26.updateRole(object, account);
        });

        return function (_x40, _x41) {
          return _ref32.apply(this, arguments);
        };
      })());

      yield account.findEachProject({}, (() => {
        var _ref33 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Projects', index);
          }

          yield _this26.updateProject(object, account);
        });

        return function (_x42, _x43) {
          return _ref33.apply(this, arguments);
        };
      })());

      yield account.findEachForm({}, (() => {
        var _ref34 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Forms', index);
          }

          yield _this26.updateFormObject(object, account);
        });

        return function (_x44, _x45) {
          return _ref34.apply(this, arguments);
        };
      })());

      yield account.findEachMembership({}, (() => {
        var _ref35 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Memberships', index);
          }

          yield _this26.updateMembership(object, account);
        });

        return function (_x46, _x47) {
          return _ref35.apply(this, arguments);
        };
      })());

      yield account.findEachChoiceList({}, (() => {
        var _ref36 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Choice Lists', index);
          }

          yield _this26.updateChoiceList(object, account);
        });

        return function (_x48, _x49) {
          return _ref36.apply(this, arguments);
        };
      })());

      yield account.findEachClassificationSet({}, (() => {
        var _ref37 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Classification Sets', index);
          }

          yield _this26.updateClassificationSet(object, account);
        });

        return function (_x50, _x51) {
          return _ref37.apply(this, arguments);
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
          var _ref38 = _asyncToGenerator(function* (record) {
            record.form = form;

            if (++index % 10 === 0) {
              _this29.progress(form.name, index);
            }

            yield _this29.updateRecord(record, account, false);
          });

          return function (_x52) {
            return _ref38.apply(this, arguments);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsInJlcXVlc3RUaW1lb3V0IiwiTUlHUkFUSU9OUyIsIkNVUlJFTlRfVkVSU0lPTiIsIkRFRkFVTFRfU0NIRU1BIiwibG9nIiwid2FybiIsImVycm9yIiwiaW5mbyIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJydW5BbGxUcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb24iLCJiZWdpbiIsIlJlcXVlc3QiLCJjb21taXQiLCJ0YWJsZU5hbWUiLCJyb3dJRCIsInVzZUFjY291bnRQcmVmaXgiLCJvblN5bmNTdGFydCIsInRhc2tzIiwib25TeW5jRmluaXNoIiwiY2xlYW51cEZyaWVuZGx5Vmlld3MiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJzaG91bGRVcGRhdGVGb3JtIiwidXBkYXRlRm9ybU9iamVjdCIsIm9wdGlvbnMiLCJkaXNhYmxlQXJyYXlzIiwiZGlzYWJsZUNvbXBsZXhUeXBlcyIsInVzZXJNb2R1bGUiLCJ0YWJsZVNjaGVtYSIsImNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQiLCJtZXRhZGF0YSIsInVzZVJlc291cmNlSUQiLCJwZXJzaXN0ZW50VGFibGVOYW1lcyIsImFjY291bnRQcmVmaXgiLCJnZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwibGVuZ3RoIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaW50ZWdyaXR5V2FybmluZyIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwic3Rkb3V0IiwiaXNUVFkiLCJjbGVhckxpbmUiLCJjdXJzb3JUbyIsIndyaXRlIiwicHJvZ3Jlc3MiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNzcWxDb25uZWN0aW9uU3RyaW5nIiwidHlwZSIsIm1zc3FsRGF0YWJhc2UiLCJkZWZhdWx0IiwibXNzcWxIb3N0IiwiaG9zdCIsIm1zc3FsUG9ydCIsIm1zc3FsVXNlciIsIm1zc3FsUGFzc3dvcmQiLCJtc3NxbFNjaGVtYSIsIm1zc3FsU2NoZW1hVmlld3MiLCJtc3NxbFN5bmNFdmVudHMiLCJtc3NxbEJlZm9yZUZ1bmN0aW9uIiwibXNzcWxBZnRlckZ1bmN0aW9uIiwicmVxdWlyZWQiLCJtc3NxbFJlcG9ydEJhc2VVcmwiLCJtc3NxbE1lZGlhQmFzZVVybCIsIm1zc3FsVW5kZXJzY29yZU5hbWVzIiwibXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lcyIsIm1zc3FsUHJlZml4IiwiaGFuZGxlciIsInN1YnN0cmluZyIsInVzZVN5bmNFdmVudHMiLCJ1c2VyIiwicGFzc3dvcmQiLCJyZXF1aXJlIiwiYXBwIiwiY29ubmVjdCIsIm9uIiwic2V0dXBPcHRpb25zIiwibWF5YmVJbml0aWFsaXplIiwiZGVhY3RpdmF0ZSIsImNsb3NlIiwib2JqZWN0IiwidmFsdWVzIiwiZmlsZSIsImFjY2Vzc19rZXkiLCJ0YWJsZSIsImRlbGV0ZVN0YXRlbWVudCIsInJvd19yZXNvdXJjZV9pZCIsImluc2VydFN0YXRlbWVudCIsInBrIiwic3RhY2siLCJzY2hlbWEiLCJ2YWx1ZXNUcmFuc2Zvcm1lciIsIm1lZGlhVVJMRm9ybWF0dGVyIiwibWVkaWFWYWx1ZSIsIml0ZW1zIiwiaXRlbSIsImVsZW1lbnQiLCJpc1Bob3RvRWxlbWVudCIsIm1lZGlhSUQiLCJpc1ZpZGVvRWxlbWVudCIsImlzQXVkaW9FbGVtZW50IiwibWVkaWFWaWV3VVJMRm9ybWF0dGVyIiwiaWRzIiwicmVwb3J0VVJMRm9ybWF0dGVyIiwiZmVhdHVyZSIsInZpZXdOYW1lIiwiZ2V0RnJpZW5kbHlUYWJsZU5hbWUiLCJ0YWJsZU5hbWVXaXRoRm9ybUFuZFNjaGVtYSIsImRhdGFOYW1lIiwiZm9ybUlEIiwicHJlZml4Iiwia2V5Iiwib2JqZWN0TmFtZSIsImJlZm9yZVN5bmMiLCJhZnRlclN5bmMiLCJmaW5kRWFjaFJlY29yZCIsImFjdGl2ZVZpZXdOYW1lcyIsInJlbW92ZSIsInByZXBhcmVNaWdyYXRpb25TY3JpcHQiLCJkYXRhYmFzZU5hbWUiLCJzcGxpdCIsImZpbmRFYWNoUGhvdG8iLCJmaW5kRWFjaFZpZGVvIiwiZmluZEVhY2hBdWRpbyIsImZpbmRFYWNoU2lnbmF0dXJlIiwiZmluZEVhY2hDaGFuZ2VzZXQiLCJmaW5kRWFjaFJvbGUiLCJmaW5kRWFjaFByb2plY3QiLCJmaW5kRWFjaEZvcm0iLCJmaW5kRWFjaE1lbWJlcnNoaXAiLCJmaW5kRWFjaENob2ljZUxpc3QiLCJmaW5kRWFjaENsYXNzaWZpY2F0aW9uU2V0IiwiaXNBdXRvbWF0aWNJbml0aWFsaXphdGlvbkRpc2FibGVkIiwibWF5YmVSdW5NaWdyYXRpb25zIiwibWlncmF0aW9ucyIsInBvcHVsYXRlUmVjb3JkcyIsImNvdW50IiwidmVyc2lvbiIsIm5lZWRzTWlncmF0aW9uIiwibWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0IiwiZmllbGRzIiwiZmlsdGVyIiwiZGlzcGxheSIsImlzRGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7O0lBS1lBLEc7O0FBSlo7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7Ozs7QUFFQSxNQUFNQyx3QkFBd0IsR0FBOUI7O0FBRUEsTUFBTUMsZUFBZTtBQUNuQkMsWUFBVSxZQURTO0FBRW5CQyxVQUFRLFdBRlc7QUFHbkJDLFFBQU0sSUFIYTtBQUluQkMsT0FBSyxFQUpjO0FBS25CQyxxQkFBbUIsS0FMQTtBQU1uQkMsa0JBQWdCO0FBTkcsQ0FBckI7O0FBU0EsTUFBTUMsYUFBYTtBQUNqQiwwQkFEaUI7QUFFakIsMEJBRmlCO0FBR2pCLDBCQUhpQjtBQUlqQiwyQkFKaUI7QUFLakI7QUFMaUIsQ0FBbkI7O0FBUUEsTUFBTUMsa0JBQWtCLENBQXhCOztBQUVBLE1BQU1DLGlCQUFpQixLQUF2Qjs7QUFFQSxNQUFN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QyxRQUFROEMsT0FBUixDQUFnQkMsTUFBM0I7QUFBQSxTQUE5QyxDQUFmOztBQUVBLFlBQUlILE9BQU83RyxNQUFYLEVBQW1CO0FBQ2pCaEssY0FBSSw4Q0FBSixFQUFvRDBCLEtBQUtRLElBQXpEOztBQUVBLGdCQUFNLFFBQUtILFdBQUwsQ0FBaUJMLElBQWpCLEVBQXVCUixPQUF2QixFQUFnQyxZQUFNLENBQUUsQ0FBeEMsQ0FBTjtBQUNEO0FBQ0Y7QUFYOEM7QUFZaEQ7O0FBMWhDa0IsQyIsImZpbGUiOiJwbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbXNzcWwgZnJvbSAnbXNzcWwnO1xuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgTVNTUUxTY2hlbWEgZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgTVNTUUwgfSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCBNU1NRTFJlY29yZFZhbHVlcyBmcm9tICcuL21zc3FsLXJlY29yZC12YWx1ZXMnXG5pbXBvcnQgc25ha2UgZnJvbSAnc25ha2UtY2FzZSc7XG5pbXBvcnQgdGVtcGxhdGVEcm9wIGZyb20gJy4vdGVtcGxhdGUuZHJvcC5zcWwnO1xuaW1wb3J0IFNjaGVtYU1hcCBmcm9tICcuL3NjaGVtYS1tYXAnO1xuaW1wb3J0ICogYXMgYXBpIGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IHsgY29tcGFjdCwgZGlmZmVyZW5jZSwgcGFkU3RhcnQgfSBmcm9tICdsb2Rhc2gnO1xuXG5pbXBvcnQgdmVyc2lvbjAwMSBmcm9tICcuL3ZlcnNpb24tMDAxLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMiBmcm9tICcuL3ZlcnNpb24tMDAyLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMyBmcm9tICcuL3ZlcnNpb24tMDAzLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNCBmcm9tICcuL3ZlcnNpb24tMDA0LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNSBmcm9tICcuL3ZlcnNpb24tMDA1LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNiBmcm9tICcuL3ZlcnNpb24tMDA2LnNxbCc7XG5cbmNvbnN0IE1BWF9JREVOVElGSUVSX0xFTkdUSCA9IDEwMDtcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBzZXJ2ZXI6ICdsb2NhbGhvc3QnLFxuICBwb3J0OiAxNDMzLFxuICBtYXg6IDEwLFxuICBpZGxlVGltZW91dE1pbGxpczogMzAwMDAsXG4gIHJlcXVlc3RUaW1lb3V0OiAxMjAwMDBcbn07XG5cbmNvbnN0IE1JR1JBVElPTlMgPSB7XG4gICcwMDInOiB2ZXJzaW9uMDAyLFxuICAnMDAzJzogdmVyc2lvbjAwMyxcbiAgJzAwNCc6IHZlcnNpb24wMDQsXG4gICcwMDUnOiB2ZXJzaW9uMDA1LFxuICAnMDA2JzogdmVyc2lvbjAwNlxufTtcblxuY29uc3QgQ1VSUkVOVF9WRVJTSU9OID0gNjtcblxuY29uc3QgREVGQVVMVF9TQ0hFTUEgPSAnZGJvJztcblxuY29uc3QgeyBsb2csIHdhcm4sIGVycm9yLCBpbmZvIH0gPSBmdWxjcnVtLmxvZ2dlci53aXRoQ29udGV4dCgnbXNzcWwnKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAnbXNzcWwnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgbXNzcWwgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBtc3NxbENvbm5lY3Rpb25TdHJpbmc6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgY29ubmVjdGlvbiBzdHJpbmcgKG92ZXJyaWRlcyBhbGwgaW5kaXZpZHVhbCBkYXRhYmFzZSBjb25uZWN0aW9uIHBhcmFtZXRlcnMpJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbERhdGFiYXNlOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGRhdGFiYXNlIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5kYXRhYmFzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEhvc3Q6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIGhvc3QnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5ob3N0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUG9ydDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgcG9ydCcsXG4gICAgICAgICAgdHlwZTogJ2ludGVnZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5wb3J0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsVXNlcjoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCB1c2VyJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBhc3N3b3JkOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHBhc3N3b3JkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNjaGVtYToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2NoZW1hVmlld3M6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hIGZvciB0aGUgZnJpZW5kbHkgdmlld3MnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3luY0V2ZW50czoge1xuICAgICAgICAgIGRlc2M6ICdhZGQgc3luYyBldmVudCBob29rcycsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxCZWZvcmVGdW5jdGlvbjoge1xuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYmVmb3JlIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbEFmdGVyRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGFmdGVyIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRm9ybToge1xuICAgICAgICAgIGRlc2M6ICd0aGUgZm9ybSBJRCB0byByZWJ1aWxkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlcG9ydEJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAncmVwb3J0IFVSTCBiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbE1lZGlhQmFzZVVybDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxVbmRlcnNjb3JlTmFtZXM6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHVuZGVyc2NvcmUgbmFtZXMgKGUuZy4gXCJQYXJrIEluc3BlY3Rpb25zXCIgYmVjb21lcyBcInBhcmtfaW5zcGVjdGlvbnNcIiknLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgc2VydmVyIGlkIGluIHRoZSBmb3JtIHRhYmxlIG5hbWVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUHJlZml4OiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgb3JnYW5pemF0aW9uIElEIGFzIGEgcHJlZml4IGluIHRoZSBvYmplY3QgbmFtZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlYnVpbGRWaWV3c09ubHk6IHtcbiAgICAgICAgICBkZXNjOiAnb25seSByZWJ1aWxkIHRoZSB2aWV3cycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEN1c3RvbU1vZHVsZToge1xuICAgICAgICAgIGRlc2M6ICdhIGN1c3RvbSBtb2R1bGUgdG8gbG9hZCB3aXRoIHN5bmMgZXh0ZW5zaW9ucyAoZXhwZXJpbWVudGFsKScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2V0dXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2V0dXAgdGhlIGRhdGFiYXNlJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRHJvcDoge1xuICAgICAgICAgIGRlc2M6ICdkcm9wIHRoZSBzeXN0ZW0gdGFibGVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3lzdGVtVGFibGVzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IGNyZWF0ZSB0aGUgc3lzdGVtIHJlY29yZHMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcERhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbERyb3ApIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcFN5c3RlbVRhYmxlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTZXR1cCkge1xuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTeXN0ZW1UYWJsZXNPbmx5KSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuXG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxGb3JtICYmIGZvcm0uaWQgIT09IGZ1bGNydW0uYXJncy5tc3NxbEZvcm0pIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZWJ1aWxkVmlld3NPbmx5KSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIChpbmRleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoZm9ybS5uYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCArICcgcmVjb3JkcycpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nKCcnKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgdHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikge1xuICAgIHJldHVybiBpZGVudGlmaWVyLnN1YnN0cmluZygwLCBNQVhfSURFTlRJRklFUl9MRU5HVEgpO1xuICB9XG5cbiAgZXNjYXBlSWRlbnRpZmllciA9IChpZGVudGlmaWVyKSA9PiB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIgJiYgdGhpcy5tc3NxbC5pZGVudCh0aGlzLnRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcbiAgfVxuXG4gIGdldCB1c2VTeW5jRXZlbnRzKCkge1xuICAgIHJldHVybiBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzICE9IG51bGwgPyBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzIDogdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIHRoaXMuYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zc3FsSG9zdCB8fCBNU1NRTF9DT05GSUcuc2VydmVyLFxuICAgICAgcG9ydDogZnVsY3J1bS5hcmdzLm1zc3FsUG9ydCB8fCBNU1NRTF9DT05GSUcucG9ydCxcbiAgICAgIGRhdGFiYXNlOiBmdWxjcnVtLmFyZ3MubXNzcWxEYXRhYmFzZSB8fCBNU1NRTF9DT05GSUcuZGF0YWJhc2UsXG4gICAgICB1c2VyOiBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyIHx8IE1TU1FMX0NPTkZJRy51c2VyLFxuICAgICAgcGFzc3dvcmQ6IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkIHx8IE1TU1FMX0NPTkZJRy51c2VyXG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxVc2VyKSB7XG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCkge1xuICAgICAgb3B0aW9ucy5wYXNzd29yZCA9IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpIHtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgPSByZXF1aXJlKGZ1bGNydW0uYXJncy5tc3NxbEN1c3RvbU1vZHVsZSk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwaSA9IGFwaTtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYXBwID0gZnVsY3J1bTtcbiAgICB9XG5cbiAgICB0aGlzLmRpc2FibGVBcnJheXMgPSBmYWxzZTtcbiAgICB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMgPSB0cnVlO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzID09PSB0cnVlKSB7XG4gICAgICB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLnVzZUFjY291bnRQcmVmaXggPSAoZnVsY3J1bS5hcmdzLm1zc3FsUHJlZml4ICE9PSBmYWxzZSk7XG5cbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KGZ1bGNydW0uYXJncy5tc3NxbENvbm5lY3Rpb25TdHJpbmcgfHwgb3B0aW9ucyk7XG5cbiAgICBpZiAodGhpcy51c2VTeW5jRXZlbnRzKSB7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOnN0YXJ0JywgdGhpcy5vblN5bmNTdGFydCk7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOmZpbmlzaCcsIHRoaXMub25TeW5jRmluaXNoKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Bob3RvOnNhdmUnLCB0aGlzLm9uUGhvdG9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3ZpZGVvOnNhdmUnLCB0aGlzLm9uVmlkZW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2F1ZGlvOnNhdmUnLCB0aGlzLm9uQXVkaW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3NpZ25hdHVyZTpzYXZlJywgdGhpcy5vblNpZ25hdHVyZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hhbmdlc2V0OnNhdmUnLCB0aGlzLm9uQ2hhbmdlc2V0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6c2F2ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpkZWxldGUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdmb3JtOnNhdmUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignZm9ybTpkZWxldGUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbi1zZXQ6c2F2ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OmRlbGV0ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdyb2xlOnNhdmUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncm9sZTpkZWxldGUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdwcm9qZWN0OnNhdmUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpkZWxldGUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdtZW1iZXJzaGlwOnNhdmUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpkZWxldGUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgIH1cblxuICAgIHRoaXMudmlld1NjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYVZpZXdzIHx8IERFRkFVTFRfU0NIRU1BO1xuICAgIHRoaXMuZGF0YVNjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYSB8fCBERUZBVUxUX1NDSEVNQTtcblxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcbiAgICAvLyBjcmVhdGlvbiBvZiBuZXcgdGFibGVzIGV2ZW4gd2hlbiB0aGUgZm9ybSBpc24ndCB2ZXJzaW9uIDEuIElmIHRoZSB0YWJsZSBkb2Vzbid0XG4gICAgLy8gZXhpc3QsIHdlIGNhbiBwcmV0ZW5kIHRoZSBmb3JtIGlzIHZlcnNpb24gMSBzbyBpdCBjcmVhdGVzIGFsbCBuZXcgdGFibGVzIGluc3RlYWRcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIC8vIG1ha2UgYSBjbGllbnQgc28gd2UgY2FuIHVzZSBpdCB0byBidWlsZCBTUUwgc3RhdGVtZW50c1xuICAgIHRoaXMubXNzcWwgPSBuZXcgTVNTUUwoe30pO1xuXG4gICAgdGhpcy5zZXR1cE9wdGlvbnMoKTtcblxuICAgIGF3YWl0IHRoaXMubWF5YmVJbml0aWFsaXplKCk7XG4gIH1cblxuICBhc3luYyBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLnBvb2wpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJ1biA9IGFzeW5jIChzcWwpID0+IHtcbiAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFwwL2csICcnKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgIGxvZyhzcWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucG9vbC5yZXF1ZXN0KCkuYmF0Y2goc3FsKTtcblxuICAgIHJldHVybiByZXN1bHQucmVjb3Jkc2V0O1xuICB9XG5cbiAgcnVuQWxsID0gYXN5bmMgKHN0YXRlbWVudHMpID0+IHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICByZXN1bHRzLnB1c2goYXdhaXQgdGhpcy5ydW4oc3FsKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBydW5BbGxUcmFuc2FjdGlvbiA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XG4gICAgY29uc3QgdHJhbnNhY3Rpb24gPSBuZXcgbXNzcWwuVHJhbnNhY3Rpb24odGhpcy5wb29sKTtcblxuICAgIGF3YWl0IHRyYW5zYWN0aW9uLmJlZ2luKCk7XG5cbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBjb25zdCByZXF1ZXN0ID0gbmV3IG1zc3FsLlJlcXVlc3QodHJhbnNhY3Rpb24pO1xuXG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGxvZyhzcWwpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0LmJhdGNoKHNxbCk7XG5cbiAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgIH1cblxuICAgIGF3YWl0IHRyYW5zYWN0aW9uLmNvbW1pdCgpO1xuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBsb2cgPSAoLi4uYXJncykgPT4ge1xuICAgIC8vIGNvbnNvbGUubG9nKC4uLmFyZ3MpO1xuICB9XG5cbiAgdGFibGVOYW1lID0gKGFjY291bnQsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuXG4gICAgaWYgKHRoaXMudXNlQWNjb3VudFByZWZpeCkge1xuICAgICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuXG4gIG9uU3luY1N0YXJ0ID0gYXN5bmMgKHthY2NvdW50LCB0YXNrc30pID0+IHtcbiAgICBhd2FpdCB0aGlzLmludm9rZUJlZm9yZUZ1bmN0aW9uKCk7XG4gIH1cblxuICBvblN5bmNGaW5pc2ggPSBhc3luYyAoe2FjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5jbGVhbnVwRnJpZW5kbHlWaWV3cyhhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLmludm9rZUFmdGVyRnVuY3Rpb24oKTtcbiAgfVxuXG4gIG9uRm9ybVNhdmUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm19KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pO1xuICB9XG5cbiAgb25Gb3JtRGVsZXRlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50fSkgPT4ge1xuICAgIGNvbnN0IG9sZEZvcm0gPSB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbnVsbCk7XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQpO1xuICB9XG5cbiAgb25SZWNvcmREZWxldGUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMuZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHJlY29yZC5mb3JtLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnRzLm1hcChvID0+IG8uc3FsKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICBvblBob3RvU2F2ZSA9IGFzeW5jICh7cGhvdG8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XG4gIH1cblxuICBvblZpZGVvU2F2ZSA9IGFzeW5jICh7dmlkZW8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gIH1cblxuICBvbkF1ZGlvU2F2ZSA9IGFzeW5jICh7YXVkaW8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVBdWRpbyhhdWRpbywgYWNjb3VudCk7XG4gIH1cblxuICBvblNpZ25hdHVyZVNhdmUgPSBhc3luYyAoe3NpZ25hdHVyZSwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVNpZ25hdHVyZShzaWduYXR1cmUsIGFjY291bnQpO1xuICB9XG5cbiAgb25DaGFuZ2VzZXRTYXZlID0gYXN5bmMgKHtjaGFuZ2VzZXQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe2Nob2ljZUxpc3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KGNob2ljZUxpc3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25DbGFzc2lmaWNhdGlvblNldFNhdmUgPSBhc3luYyAoe2NsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQoY2xhc3NpZmljYXRpb25TZXQsIGFjY291bnQpO1xuICB9XG5cbiAgb25Qcm9qZWN0U2F2ZSA9IGFzeW5jICh7cHJvamVjdCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3QocHJvamVjdCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJvbGVTYXZlID0gYXN5bmMgKHtyb2xlLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShyb2xlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uTWVtYmVyc2hpcFNhdmUgPSBhc3luYyAoe21lbWJlcnNoaXAsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG1lbWJlcnNoaXAsIGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUGhvdG8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnBob3RvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0UGhvdG9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAncGhvdG9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVWaWRlbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAudmlkZW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRWaWRlb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICd2aWRlb3MnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUF1ZGlvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5hdWRpbyhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdEF1ZGlvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ2F1ZGlvJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVTaWduYXR1cmUob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnNpZ25hdHVyZShvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFNpZ25hdHVyZVVSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdzaWduYXR1cmVzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaGFuZ2VzZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNoYW5nZXNldChvYmplY3QpLCAnY2hhbmdlc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucHJvamVjdChvYmplY3QpLCAncHJvamVjdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU1lbWJlcnNoaXAob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLm1lbWJlcnNoaXAob2JqZWN0KSwgJ21lbWJlcnNoaXBzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yb2xlKG9iamVjdCksICdyb2xlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuZm9ybShvYmplY3QpLCAnZm9ybXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNob2ljZUxpc3Qob2JqZWN0KSwgJ2Nob2ljZV9saXN0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCksICdjbGFzc2lmaWNhdGlvbl9zZXRzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVPYmplY3QodmFsdWVzLCB0YWJsZSkge1xuICAgIGNvbnN0IGRlbGV0ZVN0YXRlbWVudCA9IHRoaXMubXNzcWwuZGVsZXRlU3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB7cm93X3Jlc291cmNlX2lkOiB2YWx1ZXMucm93X3Jlc291cmNlX2lkfSk7XG4gICAgY29uc3QgaW5zZXJ0U3RhdGVtZW50ID0gdGhpcy5tc3NxbC5pbnNlcnRTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHZhbHVlcywge3BrOiAnaWQnfSk7XG5cbiAgICBjb25zdCBzcWwgPSBbIGRlbGV0ZVN0YXRlbWVudC5zcWwsIGluc2VydFN0YXRlbWVudC5zcWwgXS5qb2luKCdcXG4nKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihzcWwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB3YXJuKGB1cGRhdGVPYmplY3QgJHt0YWJsZX0gZmFpbGVkYCk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgcmVsb2FkVGFibGVMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIHJlbG9hZFZpZXdMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLnZpZXdTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudmlld05hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgYmFzZU1lZGlhVVJMID0gKCkgPT4ge1xuICB9XG5cbiAgZm9ybWF0UGhvdG9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zLyR7IGlkIH0uanBnYDtcbiAgfVxuXG4gIGZvcm1hdFZpZGVvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy8keyBpZCB9Lm1wNGA7XG4gIH1cblxuICBmb3JtYXRBdWRpb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9hdWRpby8keyBpZCB9Lm00YWA7XG4gIH1cblxuICBmb3JtYXRTaWduYXR1cmVVUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vc2lnbmF0dXJlcy8keyBpZCB9LnBuZ2A7XG4gIH1cblxuICBpbnRlZ3JpdHlXYXJuaW5nKGV4KSB7XG4gICAgd2FybihgXG4tLS0tLS0tLS0tLS0tXG4hISBXQVJOSU5HICEhXG4tLS0tLS0tLS0tLS0tXG5cbk1TU1FMIGRhdGFiYXNlIGludGVncml0eSBpc3N1ZSBlbmNvdW50ZXJlZC4gQ29tbW9uIHNvdXJjZXMgb2YgZGF0YWJhc2UgaXNzdWVzIGFyZTpcblxuKiBSZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIGFuZCB1c2luZyBhbiBvbGQgTVNTUUwgZGF0YWJhc2Ugd2l0aG91dCByZWNyZWF0aW5nXG4gIHRoZSBNU1NRTCBkYXRhYmFzZS5cbiogRGVsZXRpbmcgdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlIGFuZCB1c2luZyBhbiBleGlzdGluZyBNU1NRTCBkYXRhYmFzZVxuKiBNYW51YWxseSBtb2RpZnlpbmcgdGhlIE1TU1FMIGRhdGFiYXNlXG4qIENyZWF0aW5nIG11bHRpcGxlIGFwcHMgaW4gRnVsY3J1bSB3aXRoIHRoZSBzYW1lIG5hbWUuIFRoaXMgaXMgZ2VuZXJhbGx5IE9LLCBleGNlcHRcbiAgeW91IHdpbGwgbm90IGJlIGFibGUgdG8gdXNlIHRoZSBcImZyaWVuZGx5IHZpZXdcIiBmZWF0dXJlIG9mIHRoZSBNU1NRTCBwbHVnaW4gc2luY2VcbiAgdGhlIHZpZXcgbmFtZXMgYXJlIGRlcml2ZWQgZnJvbSB0aGUgZm9ybSBuYW1lcy5cblxuTm90ZTogV2hlbiByZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIG9yIFwic3RhcnRpbmcgb3ZlclwiIHlvdSBuZWVkIHRvIGRyb3AgYW5kIHJlLWNyZWF0ZVxudGhlIE1TU1FMIGRhdGFiYXNlLiBUaGUgbmFtZXMgb2YgZGF0YWJhc2Ugb2JqZWN0cyBhcmUgdGllZCBkaXJlY3RseSB0byB0aGUgZGF0YWJhc2Vcbm9iamVjdHMgaW4gdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlLlxuXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblJlcG9ydCBpc3N1ZXMgYXQgaHR0cHM6Ly9naXRodWIuY29tL2Z1bGNydW1hcHAvZnVsY3J1bS1kZXNrdG9wL2lzc3Vlc1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5NZXNzYWdlOlxuJHsgZXgubWVzc2FnZSB9XG5cblN0YWNrOlxuJHsgZXguc3RhY2sgfVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5gLnJlZFxuICAgICk7XG4gIH1cblxuICBzZXR1cE9wdGlvbnMoKSB7XG4gICAgdGhpcy5iYXNlTWVkaWFVUkwgPSBmdWxjcnVtLmFyZ3MubXNzcWxNZWRpYUJhc2VVcmwgPyBmdWxjcnVtLmFyZ3MubXNzcWxNZWRpYUJhc2VVcmwgOiAnaHR0cHM6Ly9hcGkuZnVsY3J1bWFwcC5jb20vYXBpL3YyJztcblxuICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zID0ge1xuICAgICAgc2NoZW1hOiB0aGlzLmRhdGFTY2hlbWEsXG5cbiAgICAgIGVzY2FwZUlkZW50aWZpZXI6IHRoaXMuZXNjYXBlSWRlbnRpZmllcixcblxuICAgICAgZGlzYWJsZUFycmF5czogdGhpcy5kaXNhYmxlQXJyYXlzLFxuXG4gICAgICBwZXJzaXN0ZW50VGFibGVOYW1lczogdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyxcblxuICAgICAgYWNjb3VudFByZWZpeDogdGhpcy51c2VBY2NvdW50UHJlZml4ID8gJ2FjY291bnRfJyArIHRoaXMuYWNjb3VudC5yb3dJRCA6IG51bGwsXG5cbiAgICAgIGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQ6ICdkYXRlJyxcblxuICAgICAgZGlzYWJsZUNvbXBsZXhUeXBlczogdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzLFxuXG4gICAgICB2YWx1ZXNUcmFuc2Zvcm1lcjogdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnZhbHVlc1RyYW5zZm9ybWVyLFxuXG4gICAgICBtZWRpYVVSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcblxuICAgICAgICByZXR1cm4gbWVkaWFWYWx1ZS5pdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRQaG90b1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRWaWRlb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRBdWRpb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIG1lZGlhVmlld1VSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgaWRzID0gbWVkaWFWYWx1ZS5pdGVtcy5tYXAobyA9PiBvLm1lZGlhSUQpO1xuXG4gICAgICAgIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNQaG90b0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zL3ZpZXc/cGhvdG9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNWaWRlb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zL3ZpZXc/dmlkZW9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNBdWRpb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vdmlldz9hdWRpbz0keyBpZHMgfWA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwpIHtcbiAgICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zLnJlcG9ydFVSTEZvcm1hdHRlciA9IChmZWF0dXJlKSA9PiB7XG4gICAgICAgIHJldHVybiBgJHsgZnVsY3J1bS5hcmdzLm1zc3FsUmVwb3J0QmFzZVVybCB9L3JlcG9ydHMvJHsgZmVhdHVyZS5pZCB9LnBkZmA7XG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZVJlY29yZCA9IGFzeW5jIChyZWNvcmQsIGFjY291bnQsIHNraXBUYWJsZUNoZWNrKSA9PiB7XG4gICAgaWYgKCFza2lwVGFibGVDaGVjayAmJiAhdGhpcy5yb290VGFibGVFeGlzdHMocmVjb3JkLmZvcm0pKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKHJlY29yZC5mb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVSZWNvcmQgJiYgIXRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkKHtyZWNvcmQsIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy51cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuXG4gICAgY29uc3Qgc3lzdGVtVmFsdWVzID0gTVNTUUxSZWNvcmRWYWx1ZXMuc3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZShyZWNvcmQsIG51bGwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnJlY29yZChyZWNvcmQsIHN5c3RlbVZhbHVlcyksICdyZWNvcmRzJyk7XG4gIH1cblxuICByb290VGFibGVFeGlzdHMgPSAoZm9ybSkgPT4ge1xuICAgIHJldHVybiB0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZihNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtLCBudWxsLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucykpICE9PSAtMTtcbiAgfVxuXG4gIHJlY3JlYXRlRm9ybVRhYmxlcyA9IGFzeW5jIChmb3JtLCBhY2NvdW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pLCBudWxsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBlcnJvcihleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG51bGwsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSkpO1xuICB9XG5cbiAgdXBkYXRlRm9ybSA9IGFzeW5jIChmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKSA9PiB7XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0oe2Zvcm0sIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBpbmZvKCdVcGRhdGluZyBmb3JtJywgZm9ybS5pZCk7XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybU9iamVjdChmb3JtLCBhY2NvdW50KTtcblxuICAgICAgaWYgKCF0aGlzLnJvb3RUYWJsZUV4aXN0cyhmb3JtKSAmJiBuZXdGb3JtICE9IG51bGwpIHtcbiAgICAgICAgb2xkRm9ybSA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcbiAgICAgICAgZGlzYWJsZUNvbXBsZXhUeXBlczogZmFsc2UsXG4gICAgICAgIHVzZXJNb2R1bGU6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUsXG4gICAgICAgIHRhYmxlU2NoZW1hOiB0aGlzLmRhdGFTY2hlbWEsXG4gICAgICAgIGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQ6ICdkYXRlJyxcbiAgICAgICAgbWV0YWRhdGE6IHRydWUsXG4gICAgICAgIHVzZVJlc291cmNlSUQ6IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMsXG4gICAgICAgIGFjY291bnRQcmVmaXg6IHRoaXMudXNlQWNjb3VudFByZWZpeCA/ICdhY2NvdW50XycgKyB0aGlzLmFjY291bnQucm93SUQgOiBudWxsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCB7c3RhdGVtZW50c30gPSBhd2FpdCBNU1NRTFNjaGVtYS5nZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMoYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSwgb3B0aW9ucyk7XG5cbiAgICAgIGluZm8oJ0Ryb3BwaW5nIHZpZXdzJywgZm9ybS5pZCk7XG5cbiAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgICB9XG5cbiAgICAgIGluZm8oJ1J1bm5pbmcgc2NoZW1hIHN0YXRlbWVudHMnLCBmb3JtLmlkLCBzdGF0ZW1lbnRzLmxlbmd0aCk7XG5cbiAgICAgIGluZm8oJ1NjaGVtYSBzdGF0ZW1lbnRzJywgJ1xcbicsIHN0YXRlbWVudHMuam9pbignXFxuJykpO1xuXG4gICAgICBhd2FpdCB0aGlzLnJ1bkFsbFRyYW5zYWN0aW9uKHN0YXRlbWVudHMpO1xuXG4gICAgICBpbmZvKCdDcmVhdGluZyB2aWV3cycsIGZvcm0uaWQpO1xuXG4gICAgICBpZiAobmV3Rm9ybSkge1xuICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaW5mbygnQ29tcGxldGVkIGZvcm0gdXBkYXRlJywgZm9ybS5pZCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGluZm8oJ3VwZGF0ZUZvcm0gZmFpbGVkJyk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdChcIklGIE9CSkVDVF9JRCgnJXMuJXMnLCAnVicpIElTIE5PVCBOVUxMIERST1AgVklFVyAlcy4lcztcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB3YXJuKCdkcm9wRnJpZW5kbHlWaWV3IGZhaWxlZCcpO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBjcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0NSRUFURSBWSUVXICVzLiVzIEFTIFNFTEVDVCAqIEZST00gJXM7JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtQW5kU2NoZW1hKGZvcm0sIHJlcGVhdGFibGUsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zLCAnX3ZpZXdfZnVsbCcpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIC8vIHNvbWV0aW1lcyBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICB3YXJuKCdjcmVhdGVGcmllbmRseVZpZXcgZmFpbGVkJyk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgIH1cbiAgfVxuXG4gIGdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCBuYW1lID0gY29tcGFjdChbZm9ybS5uYW1lLCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUuZGF0YU5hbWVdKS5qb2luKCcgLSAnKVxuXG4gICAgY29uc3QgZm9ybUlEID0gdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyA/IGZvcm0uaWQgOiBmb3JtLnJvd0lEO1xuXG4gICAgY29uc3QgcHJlZml4ID0gY29tcGFjdChbJ3ZpZXcnLCBmb3JtSUQsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5rZXldKS5qb2luKCcgLSAnKTtcblxuICAgIGNvbnN0IG9iamVjdE5hbWUgPSBbcHJlZml4LCBuYW1lXS5qb2luKCcgLSAnKTtcblxuICAgIHJldHVybiB0aGlzLnRyaW1JZGVudGlmaWVyKGZ1bGNydW0uYXJncy5tc3NxbFVuZGVyc2NvcmVOYW1lcyAhPT0gZmFsc2UgPyBzbmFrZShvYmplY3ROYW1lKSA6IG9iamVjdE5hbWUpO1xuICB9XG5cbiAgYXN5bmMgaW52b2tlQmVmb3JlRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBpbnZva2VBZnRlckZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxBZnRlckZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFmdGVyU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCBwcm9ncmVzcykge1xuICAgIGF3YWl0IHRoaXMucmVjcmVhdGVGb3JtVGFibGVzKGZvcm0sIGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIHByb2dyZXNzKGluZGV4KTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFZpZXdMaXN0KCk7XG5cbiAgICBjb25zdCBhY3RpdmVWaWV3TmFtZXMgPSBbXTtcblxuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIG51bGwpKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmUgPSBkaWZmZXJlbmNlKHRoaXMudmlld05hbWVzLCBhY3RpdmVWaWV3TmFtZXMpO1xuXG4gICAgZm9yIChjb25zdCB2aWV3TmFtZSBvZiByZW1vdmUpIHtcbiAgICAgIGlmICh2aWV3TmFtZS5pbmRleE9mKCd2aWV3XycpID09PSAwIHx8IHZpZXdOYW1lLmluZGV4T2YoJ3ZpZXcgLSAnKSA9PT0gMCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdChcIklGIE9CSkVDVF9JRCgnJXMuJXMnLCAnVicpIElTIE5PVCBOVUxMIERST1AgVklFVyAlcy4lcztcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgd2FybignY2xlYW51cEZyaWVuZGx5Vmlld3MgZmFpbGVkJyk7XG4gICAgICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG4gIH1cblxuICBmb3JtVmVyc2lvbiA9IChmb3JtKSA9PiB7XG4gICAgaWYgKGZvcm0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcbiAgfVxuXG4gIHVwZGF0ZVN0YXR1cyA9IChtZXNzYWdlKSA9PiB7XG4gICAgaWYgKHByb2Nlc3Muc3Rkb3V0LmlzVFRZKSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcFN5c3RlbVRhYmxlcygpIHtcbiAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodGVtcGxhdGVEcm9wKSk7XG4gIH1cblxuICBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICBsb2coJ0NyZWF0aW5nIGRhdGFiYXNlJywgZGF0YWJhc2VOYW1lKTtcbiAgICByZXR1cm4gdGhpcy5ydW4oYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBkcm9wRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgbG9nKCdEcm9wcGluZyBkYXRhYmFzZScsIGRhdGFiYXNlTmFtZSk7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBEUk9QIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfTtgKTtcbiAgfVxuXG4gIGFzeW5jIHNldHVwRGF0YWJhc2UoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHZlcnNpb24wMDEpKTtcbiAgfVxuXG4gIHByZXBhcmVNaWdyYXRpb25TY3JpcHQoc3FsKSB7XG4gICAgcmV0dXJuIHNxbC5yZXBsYWNlKC9fX1NDSEVNQV9fL2csIHRoaXMuZGF0YVNjaGVtYSlcbiAgICAgICAgICAgICAgLnJlcGxhY2UoL19fVklFV19TQ0hFTUFfXy9nLCB0aGlzLnZpZXdTY2hlbWEpLnNwbGl0KCc7Jyk7XG4gIH1cblxuICBhc3luYyBzZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KSB7XG4gICAgY29uc3QgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgICB9O1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFBob3RvKHt9LCBhc3luYyAocGhvdG8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Bob3RvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoVmlkZW8oe30sIGFzeW5jICh2aWRlbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnVmlkZW9zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVZpZGVvKHZpZGVvLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hBdWRpbyh7fSwgYXN5bmMgKGF1ZGlvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdBdWRpbycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVBdWRpbyhhdWRpbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoU2lnbmF0dXJlKHt9LCBhc3luYyAoc2lnbmF0dXJlLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdTaWduYXR1cmVzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNpZ25hdHVyZShzaWduYXR1cmUsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENoYW5nZXNldCh7fSwgYXN5bmMgKGNoYW5nZXNldCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hhbmdlc2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hSb2xlKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdSb2xlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUHJvamVjdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUHJvamVjdHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaEZvcm0oe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Zvcm1zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hNZW1iZXJzaGlwKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdNZW1iZXJzaGlwcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hvaWNlTGlzdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hvaWNlIExpc3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2xhc3NpZmljYXRpb24gU2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0IGlzQXV0b21hdGljSW5pdGlhbGl6YXRpb25EaXNhYmxlZCgpIHtcbiAgICByZXR1cm4gZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UgfHxcbiAgICAgIGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSB8fFxuICAgICAgZnVsY3J1bS5hcmdzLm1zc3FsRHJvcCB8fFxuICAgICAgZnVsY3J1bS5hcmdzLm1zc3FsU2V0dXA7XG4gIH1cblxuICBhc3luYyBtYXliZUluaXRpYWxpemUoKSB7XG4gICAgaWYgKHRoaXMuaXNBdXRvbWF0aWNJbml0aWFsaXphdGlvbkRpc2FibGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKHRoaXMudGFibGVOYW1lcy5pbmRleE9mKCdtaWdyYXRpb25zJykgPT09IC0xKSB7XG4gICAgICBsb2coJ0luaXRpdGFsaXppbmcgZGF0YWJhc2UuLi4nKTtcblxuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyBtYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCkge1xuICAgIHRoaXMubWlncmF0aW9ucyA9IChhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIG5hbWUgRlJPTSAkeyB0aGlzLmRhdGFTY2hlbWEgfS5taWdyYXRpb25zYCkpLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICBsZXQgcG9wdWxhdGVSZWNvcmRzID0gZmFsc2U7XG5cbiAgICBmb3IgKGxldCBjb3VudCA9IDI7IGNvdW50IDw9IENVUlJFTlRfVkVSU0lPTjsgKytjb3VudCkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IHBhZFN0YXJ0KGNvdW50LCAzLCAnMCcpO1xuXG4gICAgICBjb25zdCBuZWVkc01pZ3JhdGlvbiA9IHRoaXMubWlncmF0aW9ucy5pbmRleE9mKHZlcnNpb24pID09PSAtMSAmJiBNSUdSQVRJT05TW3ZlcnNpb25dO1xuXG4gICAgICBpZiAobmVlZHNNaWdyYXRpb24pIHtcbiAgICAgICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KE1JR1JBVElPTlNbdmVyc2lvbl0pKTtcblxuICAgICAgICBpZiAodmVyc2lvbiA9PT0gJzAwMicpIHtcbiAgICAgICAgICBsb2coJ1BvcHVsYXRpbmcgc3lzdGVtIHRhYmxlcy4uLicpO1xuICAgICAgICAgIHBvcHVsYXRlUmVjb3JkcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmVyc2lvbiA9PT0gJzAwNScpIHtcbiAgICAgICAgICBsb2coJ01pZ3JhdGluZyBkYXRlIGNhbGN1bGF0aW9uIGZpZWxkcy4uLicpO1xuICAgICAgICAgIGF3YWl0IHRoaXMubWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0KGFjY291bnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvcHVsYXRlUmVjb3Jkcykge1xuICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZVJlY29yZHMoYWNjb3VudCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcG9wdWxhdGVSZWNvcmRzKGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGluZGV4ID0gMDtcblxuICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMucHJvZ3Jlc3MoZm9ybS5uYW1lLCBpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdChhY2NvdW50KSB7XG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGNvbnN0IGZpZWxkcyA9IGZvcm0uZWxlbWVudHNPZlR5cGUoJ0NhbGN1bGF0ZWRGaWVsZCcpLmZpbHRlcihlbGVtZW50ID0+IGVsZW1lbnQuZGlzcGxheS5pc0RhdGUpO1xuXG4gICAgICBpZiAoZmllbGRzLmxlbmd0aCkge1xuICAgICAgICBsb2coJ01pZ3JhdGluZyBkYXRlIGNhbGN1bGF0aW9uIGZpZWxkcyBpbiBmb3JtLi4uJywgZm9ybS5uYW1lKTtcblxuICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsICgpID0+IHt9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm9ncmVzcyA9IChuYW1lLCBpbmRleCkgPT4ge1xuICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgfVxufVxuIl19