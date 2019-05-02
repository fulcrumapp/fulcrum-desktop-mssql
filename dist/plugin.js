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
  idleTimeoutMillis: 30000
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

const { log, warn, error } = fulcrum.logger.withContext('mssql');

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

        try {
          const results = [];

          for (const sql of statements) {
            const request = new sql.Request(transaction);

            const result = yield request.query(sql);

            results.push(result);
          }

          yield transaction.commit();
        } catch (ex) {
          yield transaction.rollback();
          throw ex;
        }

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
        log('form:save', form.id);
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
          log('Updating form', form.id);

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

          log('Dropping views', form.id);

          yield _this.dropFriendlyView(form, null);

          for (const repeatable of form.elementsOfType('Repeatable')) {
            yield _this.dropFriendlyView(form, repeatable);
          }

          log('Running schema statements', form.id, statements.length);

          yield _this.runAllTransaction(statements);

          log('Creating views', form.id);

          if (newForm) {
            yield _this.createFriendlyView(form, null);

            for (const repeatable of form.elementsOfType('Repeatable')) {
              yield _this.createFriendlyView(form, repeatable);
            }
          }

          log('Completed form update', form.id);
        } catch (ex) {
          warn('updateForm failed');
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
    return this.run(`CREATE DATABASE ${databaseName};`);
  }

  dropDatabase(databaseName) {
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

  maybeInitialize() {
    var _this27 = this;

    return _asyncToGenerator(function* () {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJDVVJSRU5UX1ZFUlNJT04iLCJERUZBVUxUX1NDSEVNQSIsImxvZyIsIndhcm4iLCJlcnJvciIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJydW5BbGxUcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb24iLCJiZWdpbiIsIlJlcXVlc3QiLCJxdWVyeSIsImNvbW1pdCIsImV4Iiwicm9sbGJhY2siLCJ0YWJsZU5hbWUiLCJyb3dJRCIsInVzZUFjY291bnRQcmVmaXgiLCJvblN5bmNTdGFydCIsInRhc2tzIiwib25TeW5jRmluaXNoIiwiY2xlYW51cEZyaWVuZGx5Vmlld3MiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwic2hvdWxkVXBkYXRlRm9ybSIsInVwZGF0ZUZvcm1PYmplY3QiLCJvcHRpb25zIiwiZGlzYWJsZUFycmF5cyIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJ1c2VyTW9kdWxlIiwidGFibGVTY2hlbWEiLCJjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0IiwibWV0YWRhdGEiLCJ1c2VSZXNvdXJjZUlEIiwicGVyc2lzdGVudFRhYmxlTmFtZXMiLCJhY2NvdW50UHJlZml4IiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZHJvcEZyaWVuZGx5VmlldyIsInJlcGVhdGFibGUiLCJlbGVtZW50c09mVHlwZSIsImxlbmd0aCIsImNyZWF0ZUZyaWVuZGx5VmlldyIsImludGVncml0eVdhcm5pbmciLCJtZXNzYWdlIiwicHJvY2VzcyIsInN0ZG91dCIsImlzVFRZIiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsInByb2dyZXNzIiwidGFzayIsImNsaSIsImNvbW1hbmQiLCJkZXNjIiwiYnVpbGRlciIsIm1zc3FsQ29ubmVjdGlvblN0cmluZyIsInR5cGUiLCJtc3NxbERhdGFiYXNlIiwiZGVmYXVsdCIsIm1zc3FsSG9zdCIsImhvc3QiLCJtc3NxbFBvcnQiLCJtc3NxbFVzZXIiLCJtc3NxbFBhc3N3b3JkIiwibXNzcWxTY2hlbWEiLCJtc3NxbFNjaGVtYVZpZXdzIiwibXNzcWxTeW5jRXZlbnRzIiwibXNzcWxCZWZvcmVGdW5jdGlvbiIsIm1zc3FsQWZ0ZXJGdW5jdGlvbiIsInJlcXVpcmVkIiwibXNzcWxSZXBvcnRCYXNlVXJsIiwibXNzcWxNZWRpYUJhc2VVcmwiLCJtc3NxbFVuZGVyc2NvcmVOYW1lcyIsIm1zc3FsUGVyc2lzdGVudFRhYmxlTmFtZXMiLCJtc3NxbFByZWZpeCIsImhhbmRsZXIiLCJzdWJzdHJpbmciLCJ1c2VTeW5jRXZlbnRzIiwidXNlciIsInBhc3N3b3JkIiwicmVxdWlyZSIsImFwcCIsImNvbm5lY3QiLCJvbiIsInNldHVwT3B0aW9ucyIsIm1heWJlSW5pdGlhbGl6ZSIsImRlYWN0aXZhdGUiLCJjbG9zZSIsIm9iamVjdCIsInZhbHVlcyIsImZpbGUiLCJhY2Nlc3Nfa2V5IiwidGFibGUiLCJkZWxldGVTdGF0ZW1lbnQiLCJyb3dfcmVzb3VyY2VfaWQiLCJpbnNlcnRTdGF0ZW1lbnQiLCJwayIsInN0YWNrIiwic2NoZW1hIiwidmFsdWVzVHJhbnNmb3JtZXIiLCJtZWRpYVVSTEZvcm1hdHRlciIsIm1lZGlhVmFsdWUiLCJpdGVtcyIsIml0ZW0iLCJlbGVtZW50IiwiaXNQaG90b0VsZW1lbnQiLCJtZWRpYUlEIiwiaXNWaWRlb0VsZW1lbnQiLCJpc0F1ZGlvRWxlbWVudCIsIm1lZGlhVmlld1VSTEZvcm1hdHRlciIsImlkcyIsInJlcG9ydFVSTEZvcm1hdHRlciIsImZlYXR1cmUiLCJ2aWV3TmFtZSIsImdldEZyaWVuZGx5VGFibGVOYW1lIiwidGFibGVOYW1lV2l0aEZvcm1BbmRTY2hlbWEiLCJkYXRhTmFtZSIsImZvcm1JRCIsInByZWZpeCIsImtleSIsIm9iamVjdE5hbWUiLCJiZWZvcmVTeW5jIiwiYWZ0ZXJTeW5jIiwiZmluZEVhY2hSZWNvcmQiLCJhY3RpdmVWaWV3TmFtZXMiLCJyZW1vdmUiLCJwcmVwYXJlTWlncmF0aW9uU2NyaXB0IiwiZGF0YWJhc2VOYW1lIiwic3BsaXQiLCJmaW5kRWFjaFBob3RvIiwiZmluZEVhY2hWaWRlbyIsImZpbmRFYWNoQXVkaW8iLCJmaW5kRWFjaFNpZ25hdHVyZSIsImZpbmRFYWNoQ2hhbmdlc2V0IiwiZmluZEVhY2hSb2xlIiwiZmluZEVhY2hQcm9qZWN0IiwiZmluZEVhY2hGb3JtIiwiZmluZEVhY2hNZW1iZXJzaGlwIiwiZmluZEVhY2hDaG9pY2VMaXN0IiwiZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCIsIm1heWJlUnVuTWlncmF0aW9ucyIsIm1pZ3JhdGlvbnMiLCJwb3B1bGF0ZVJlY29yZHMiLCJjb3VudCIsInZlcnNpb24iLCJuZWVkc01pZ3JhdGlvbiIsIm1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdCIsImZpZWxkcyIsImZpbHRlciIsImRpc3BsYXkiLCJpc0RhdGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOztJQUtZQSxHOztBQUpaOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBRUE7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7Ozs7O0FBRUEsTUFBTUMsd0JBQXdCLEdBQTlCOztBQUVBLE1BQU1DLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsVUFBUSxXQUZXO0FBR25CQyxRQUFNLElBSGE7QUFJbkJDLE9BQUssRUFKYztBQUtuQkMscUJBQW1CO0FBTEEsQ0FBckI7O0FBUUEsTUFBTUMsYUFBYTtBQUNqQiwwQkFEaUI7QUFFakIsMEJBRmlCO0FBR2pCLDBCQUhpQjtBQUlqQiwyQkFKaUI7QUFLakI7QUFMaUIsQ0FBbkI7O0FBUUEsTUFBTUMsa0JBQWtCLENBQXhCOztBQUVBLE1BQU1DLGlCQUFpQixLQUF2Qjs7QUFFQSxNQUFNLEVBQUVDLEdBQUYsRUFBT0MsSUFBUCxFQUFhQyxLQUFiLEtBQXVCQyxRQUFRQyxNQUFSLENBQWVDLFdB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QW5CLEVBQTBCO0FBQ3hCUSxnQkFBUSxDQUFSOztBQUVBLGNBQU1OLEtBQUs0TixjQUFMLENBQW9CLEVBQXBCO0FBQUEseUNBQXdCLFdBQU9sSyxNQUFQLEVBQWtCO0FBQzlDQSxtQkFBTzFELElBQVAsR0FBY0EsSUFBZDs7QUFFQSxnQkFBSSxFQUFFTSxLQUFGLEdBQVUsRUFBVixLQUFpQixDQUFyQixFQUF3QjtBQUN0QixzQkFBSzRJLFFBQUwsQ0FBY2xKLEtBQUtRLElBQW5CLEVBQXlCRixLQUF6QjtBQUNEOztBQUVELGtCQUFNLFFBQUtxRCxZQUFMLENBQWtCRCxNQUFsQixFQUEwQmxFLE9BQTFCLEVBQW1DLEtBQW5DLENBQU47QUFDRCxXQVJLOztBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQU47QUFTRDtBQWpCNEI7QUFrQjlCOztBQUVLMlAsbUNBQU4sQ0FBd0MzUCxPQUF4QyxFQUFpRDtBQUFBOztBQUFBO0FBQy9DLFlBQU1NLFFBQVEsTUFBTU4sUUFBUU8sZUFBUixDQUF3QixFQUF4QixDQUFwQjs7QUFFQSxXQUFLLE1BQU1DLElBQVgsSUFBbUJGLEtBQW5CLEVBQTBCO0FBQ3hCLGNBQU1zUCxTQUFTcFAsS0FBS3VJLGNBQUwsQ0FBb0IsaUJBQXBCLEVBQXVDOEcsTUFBdkMsQ0FBOEM7QUFBQSxpQkFBVzVDLFFBQVE2QyxPQUFSLENBQWdCQyxNQUEzQjtBQUFBLFNBQTlDLENBQWY7O0FBRUEsWUFBSUgsT0FBTzVHLE1BQVgsRUFBbUI7QUFDakJqSyxjQUFJLDhDQUFKLEVBQW9EeUIsS0FBS1EsSUFBekQ7O0FBRUEsZ0JBQU0sUUFBS0gsV0FBTCxDQUFpQkwsSUFBakIsRUFBdUJSLE9BQXZCLEVBQWdDLFlBQU0sQ0FBRSxDQUF4QyxDQUFOO0FBQ0Q7QUFDRjtBQVg4QztBQVloRDs7QUE3Z0NrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtc3NxbCBmcm9tICdtc3NxbCc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICd1dGlsJztcbmltcG9ydCBNU1NRTFNjaGVtYSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBNU1NRTCB9IGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IE1TU1FMUmVjb3JkVmFsdWVzIGZyb20gJy4vbXNzcWwtcmVjb3JkLXZhbHVlcydcbmltcG9ydCBzbmFrZSBmcm9tICdzbmFrZS1jYXNlJztcbmltcG9ydCB0ZW1wbGF0ZURyb3AgZnJvbSAnLi90ZW1wbGF0ZS5kcm9wLnNxbCc7XG5pbXBvcnQgU2NoZW1hTWFwIGZyb20gJy4vc2NoZW1hLW1hcCc7XG5pbXBvcnQgKiBhcyBhcGkgZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgeyBjb21wYWN0LCBkaWZmZXJlbmNlLCBwYWRTdGFydCB9IGZyb20gJ2xvZGFzaCc7XG5cbmltcG9ydCB2ZXJzaW9uMDAxIGZyb20gJy4vdmVyc2lvbi0wMDEuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDAyIGZyb20gJy4vdmVyc2lvbi0wMDIuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDAzIGZyb20gJy4vdmVyc2lvbi0wMDMuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDA0IGZyb20gJy4vdmVyc2lvbi0wMDQuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDA1IGZyb20gJy4vdmVyc2lvbi0wMDUuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDA2IGZyb20gJy4vdmVyc2lvbi0wMDYuc3FsJztcblxuY29uc3QgTUFYX0lERU5USUZJRVJfTEVOR1RIID0gMTAwO1xuXG5jb25zdCBNU1NRTF9DT05GSUcgPSB7XG4gIGRhdGFiYXNlOiAnZnVsY3J1bWFwcCcsXG4gIHNlcnZlcjogJ2xvY2FsaG9zdCcsXG4gIHBvcnQ6IDE0MzMsXG4gIG1heDogMTAsXG4gIGlkbGVUaW1lb3V0TWlsbGlzOiAzMDAwMFxufTtcblxuY29uc3QgTUlHUkFUSU9OUyA9IHtcbiAgJzAwMic6IHZlcnNpb24wMDIsXG4gICcwMDMnOiB2ZXJzaW9uMDAzLFxuICAnMDA0JzogdmVyc2lvbjAwNCxcbiAgJzAwNSc6IHZlcnNpb24wMDUsXG4gICcwMDYnOiB2ZXJzaW9uMDA2XG59O1xuXG5jb25zdCBDVVJSRU5UX1ZFUlNJT04gPSA2O1xuXG5jb25zdCBERUZBVUxUX1NDSEVNQSA9ICdkYm8nO1xuXG5jb25zdCB7IGxvZywgd2FybiwgZXJyb3IgfSA9IGZ1bGNydW0ubG9nZ2VyLndpdGhDb250ZXh0KCdtc3NxbCcpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXG4gICAgICBkZXNjOiAncnVuIHRoZSBtc3NxbCBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG1zc3FsQ29ubmVjdGlvblN0cmluZzoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBjb25uZWN0aW9uIHN0cmluZyAob3ZlcnJpZGVzIGFsbCBpbmRpdmlkdWFsIGRhdGFiYXNlIGNvbm5lY3Rpb24gcGFyYW1ldGVycyknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRGF0YWJhc2U6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgZGF0YWJhc2UgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmRhdGFiYXNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsSG9zdDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgaG9zdCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQb3J0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcbiAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLnBvcnRcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxVc2VyOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHVzZXInLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUGFzc3dvcmQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2NoZW1hOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTY2hlbWFWaWV3czoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEgZm9yIHRoZSBmcmllbmRseSB2aWV3cycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTeW5jRXZlbnRzOiB7XG4gICAgICAgICAgZGVzYzogJ2FkZCBzeW5jIGV2ZW50IGhvb2tzJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEJlZm9yZUZ1bmN0aW9uOiB7XG4gICAgICAgICAgZGVzYzogJ2NhbGwgdGhpcyBmdW5jdGlvbiBiZWZvcmUgdGhlIHN5bmMnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQWZ0ZXJGdW5jdGlvbjoge1xuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYWZ0ZXIgdGhlIHN5bmMnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxGb3JtOiB7XG4gICAgICAgICAgZGVzYzogJ3RoZSBmb3JtIElEIHRvIHJlYnVpbGQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUmVwb3J0QmFzZVVybDoge1xuICAgICAgICAgIGRlc2M6ICdyZXBvcnQgVVJMIGJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsTWVkaWFCYXNlVXJsOiB7XG4gICAgICAgICAgZGVzYzogJ21lZGlhIFVSTCBiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFVuZGVyc2NvcmVOYW1lczoge1xuICAgICAgICAgIGRlc2M6ICd1c2UgdW5kZXJzY29yZSBuYW1lcyAoZS5nLiBcIlBhcmsgSW5zcGVjdGlvbnNcIiBiZWNvbWVzIFwicGFya19pbnNwZWN0aW9uc1wiKScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUGVyc2lzdGVudFRhYmxlTmFtZXM6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHRoZSBzZXJ2ZXIgaWQgaW4gdGhlIGZvcm0gdGFibGUgbmFtZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQcmVmaXg6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHRoZSBvcmdhbml6YXRpb24gSUQgYXMgYSBwcmVmaXggaW4gdGhlIG9iamVjdCBuYW1lcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUmVidWlsZFZpZXdzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IHJlYnVpbGQgdGhlIHZpZXdzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQ3VzdG9tTW9kdWxlOiB7XG4gICAgICAgICAgZGVzYzogJ2EgY3VzdG9tIG1vZHVsZSB0byBsb2FkIHdpdGggc3luYyBleHRlbnNpb25zIChleHBlcmltZW50YWwpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTZXR1cDoge1xuICAgICAgICAgIGRlc2M6ICdzZXR1cCB0aGUgZGF0YWJhc2UnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbidcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxEcm9wOiB7XG4gICAgICAgICAgZGVzYzogJ2Ryb3AgdGhlIHN5c3RlbSB0YWJsZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTeXN0ZW1UYWJsZXNPbmx5OiB7XG4gICAgICAgICAgZGVzYzogJ29ubHkgY3JlYXRlIHRoZSBzeXN0ZW0gcmVjb3JkcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxDcmVhdGVEYXRhYmFzZSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNzcWxDcmVhdGVEYXRhYmFzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcERhdGFiYXNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcCkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wU3lzdGVtVGFibGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFNldHVwKSB7XG4gICAgICBhd2FpdCB0aGlzLnNldHVwRGF0YWJhc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFN5c3RlbVRhYmxlc09ubHkpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5zZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLmludm9rZUJlZm9yZUZ1bmN0aW9uKCk7XG5cbiAgICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEZvcm0gJiYgZm9ybS5pZCAhPT0gZnVsY3J1bS5hcmdzLm1zc3FsRm9ybSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFJlYnVpbGRWaWV3c09ubHkpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKGluZGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhmb3JtLm5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkICsgJyByZWNvcmRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsb2coJycpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLmludm9rZUFmdGVyRnVuY3Rpb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICB0cmltSWRlbnRpZmllcihpZGVudGlmaWVyKSB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIuc3Vic3RyaW5nKDAsIE1BWF9JREVOVElGSUVSX0xFTkdUSCk7XG4gIH1cblxuICBlc2NhcGVJZGVudGlmaWVyID0gKGlkZW50aWZpZXIpID0+IHtcbiAgICByZXR1cm4gaWRlbnRpZmllciAmJiB0aGlzLm1zc3FsLmlkZW50KHRoaXMudHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuICB9XG5cbiAgZ2V0IHVzZVN5bmNFdmVudHMoKSB7XG4gICAgcmV0dXJuIGZ1bGNydW0uYXJncy5tc3NxbFN5bmNFdmVudHMgIT0gbnVsbCA/IGZ1bGNydW0uYXJncy5tc3NxbFN5bmNFdmVudHMgOiB0cnVlO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGUoKSB7XG4gICAgdGhpcy5hY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgLi4uTVNTUUxfQ09ORklHLFxuICAgICAgc2VydmVyOiBmdWxjcnVtLmFyZ3MubXNzcWxIb3N0IHx8IE1TU1FMX0NPTkZJRy5zZXJ2ZXIsXG4gICAgICBwb3J0OiBmdWxjcnVtLmFyZ3MubXNzcWxQb3J0IHx8IE1TU1FMX0NPTkZJRy5wb3J0LFxuICAgICAgZGF0YWJhc2U6IGZ1bGNydW0uYXJncy5tc3NxbERhdGFiYXNlIHx8IE1TU1FMX0NPTkZJRy5kYXRhYmFzZSxcbiAgICAgIHVzZXI6IGZ1bGNydW0uYXJncy5tc3NxbFVzZXIgfHwgTVNTUUxfQ09ORklHLnVzZXIsXG4gICAgICBwYXNzd29yZDogZnVsY3J1bS5hcmdzLm1zc3FsUGFzc3dvcmQgfHwgTVNTUUxfQ09ORklHLnVzZXJcbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFVzZXIpIHtcbiAgICAgIG9wdGlvbnMudXNlciA9IGZ1bGNydW0uYXJncy5tc3NxbFVzZXI7XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkKSB7XG4gICAgICBvcHRpb25zLnBhc3N3b3JkID0gZnVsY3J1bS5hcmdzLm1zc3FsUGFzc3dvcmQ7XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEN1c3RvbU1vZHVsZSkge1xuICAgICAgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSA9IHJlcXVpcmUoZnVsY3J1bS5hcmdzLm1zc3FsQ3VzdG9tTW9kdWxlKTtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYXBpID0gYXBpO1xuICAgICAgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hcHAgPSBmdWxjcnVtO1xuICAgIH1cblxuICAgIHRoaXMuZGlzYWJsZUFycmF5cyA9IGZhbHNlO1xuICAgIHRoaXMuZGlzYWJsZUNvbXBsZXhUeXBlcyA9IHRydWU7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUGVyc2lzdGVudFRhYmxlTmFtZXMgPT09IHRydWUpIHtcbiAgICAgIHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMudXNlQWNjb3VudFByZWZpeCA9IChmdWxjcnVtLmFyZ3MubXNzcWxQcmVmaXggIT09IGZhbHNlKTtcblxuICAgIHRoaXMucG9vbCA9IGF3YWl0IG1zc3FsLmNvbm5lY3QoZnVsY3J1bS5hcmdzLm1zc3FsQ29ubmVjdGlvblN0cmluZyB8fCBvcHRpb25zKTtcblxuICAgIGlmICh0aGlzLnVzZVN5bmNFdmVudHMpIHtcbiAgICAgIGZ1bGNydW0ub24oJ3N5bmM6c3RhcnQnLCB0aGlzLm9uU3luY1N0YXJ0KTtcbiAgICAgIGZ1bGNydW0ub24oJ3N5bmM6ZmluaXNoJywgdGhpcy5vblN5bmNGaW5pc2gpO1xuICAgICAgZnVsY3J1bS5vbigncGhvdG86c2F2ZScsIHRoaXMub25QaG90b1NhdmUpO1xuICAgICAgZnVsY3J1bS5vbigndmlkZW86c2F2ZScsIHRoaXMub25WaWRlb1NhdmUpO1xuICAgICAgZnVsY3J1bS5vbignYXVkaW86c2F2ZScsIHRoaXMub25BdWRpb1NhdmUpO1xuICAgICAgZnVsY3J1bS5vbignc2lnbmF0dXJlOnNhdmUnLCB0aGlzLm9uU2lnbmF0dXJlU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjaGFuZ2VzZXQ6c2F2ZScsIHRoaXMub25DaGFuZ2VzZXRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpzYXZlJywgdGhpcy5vblJlY29yZFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncmVjb3JkOmRlbGV0ZScsIHRoaXMub25SZWNvcmREZWxldGUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpzYXZlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2Nob2ljZS1saXN0OmRlbGV0ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2Zvcm06c2F2ZScsIHRoaXMub25Gb3JtU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdmb3JtOmRlbGV0ZScsIHRoaXMub25Gb3JtU2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uLXNldDpzYXZlJywgdGhpcy5vbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbi1zZXQ6ZGVsZXRlJywgdGhpcy5vbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ3JvbGU6c2F2ZScsIHRoaXMub25Sb2xlU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyb2xlOmRlbGV0ZScsIHRoaXMub25Sb2xlU2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ3Byb2plY3Q6c2F2ZScsIHRoaXMub25Qcm9qZWN0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdwcm9qZWN0OmRlbGV0ZScsIHRoaXMub25Qcm9qZWN0U2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ21lbWJlcnNoaXA6c2F2ZScsIHRoaXMub25NZW1iZXJzaGlwU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdtZW1iZXJzaGlwOmRlbGV0ZScsIHRoaXMub25NZW1iZXJzaGlwU2F2ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52aWV3U2NoZW1hID0gZnVsY3J1bS5hcmdzLm1zc3FsU2NoZW1hVmlld3MgfHwgREVGQVVMVF9TQ0hFTUE7XG4gICAgdGhpcy5kYXRhU2NoZW1hID0gZnVsY3J1bS5hcmdzLm1zc3FsU2NoZW1hIHx8IERFRkFVTFRfU0NIRU1BO1xuXG4gICAgLy8gRmV0Y2ggYWxsIHRoZSBleGlzdGluZyB0YWJsZXMgb24gc3RhcnR1cC4gVGhpcyBhbGxvd3MgdXMgdG8gc3BlY2lhbCBjYXNlIHRoZVxuICAgIC8vIGNyZWF0aW9uIG9mIG5ldyB0YWJsZXMgZXZlbiB3aGVuIHRoZSBmb3JtIGlzbid0IHZlcnNpb24gMS4gSWYgdGhlIHRhYmxlIGRvZXNuJ3RcbiAgICAvLyBleGlzdCwgd2UgY2FuIHByZXRlbmQgdGhlIGZvcm0gaXMgdmVyc2lvbiAxIHNvIGl0IGNyZWF0ZXMgYWxsIG5ldyB0YWJsZXMgaW5zdGVhZFxuICAgIC8vIG9mIGFwcGx5aW5nIGEgc2NoZW1hIGRpZmYuXG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9JyR7IHRoaXMuZGF0YVNjaGVtYSB9J2ApO1xuXG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuXG4gICAgLy8gbWFrZSBhIGNsaWVudCBzbyB3ZSBjYW4gdXNlIGl0IHRvIGJ1aWxkIFNRTCBzdGF0ZW1lbnRzXG4gICAgdGhpcy5tc3NxbCA9IG5ldyBNU1NRTCh7fSk7XG5cbiAgICB0aGlzLnNldHVwT3B0aW9ucygpO1xuXG4gICAgYXdhaXQgdGhpcy5tYXliZUluaXRpYWxpemUoKTtcbiAgfVxuXG4gIGFzeW5jIGRlYWN0aXZhdGUoKSB7XG4gICAgaWYgKHRoaXMucG9vbCkge1xuICAgICAgYXdhaXQgdGhpcy5wb29sLmNsb3NlKCk7XG4gICAgfVxuICB9XG5cbiAgcnVuID0gYXN5bmMgKHNxbCkgPT4ge1xuICAgIHNxbCA9IHNxbC5yZXBsYWNlKC9cXDAvZywgJycpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgbG9nKHNxbCk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wb29sLnJlcXVlc3QoKS5iYXRjaChzcWwpO1xuXG4gICAgcmV0dXJuIHJlc3VsdC5yZWNvcmRzZXQ7XG4gIH1cblxuICBydW5BbGwgPSBhc3luYyAoc3RhdGVtZW50cykgPT4ge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgIGZvciAoY29uc3Qgc3FsIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIHJlc3VsdHMucHVzaChhd2FpdCB0aGlzLnJ1bihzcWwpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIHJ1bkFsbFRyYW5zYWN0aW9uID0gYXN5bmMgKHN0YXRlbWVudHMpID0+IHtcbiAgICBjb25zdCB0cmFuc2FjdGlvbiA9IG5ldyBtc3NxbC5UcmFuc2FjdGlvbih0aGlzLnBvb2wpO1xuXG4gICAgYXdhaXQgdHJhbnNhY3Rpb24uYmVnaW4oKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgIGZvciAoY29uc3Qgc3FsIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IG5ldyBzcWwuUmVxdWVzdCh0cmFuc2FjdGlvbik7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdC5xdWVyeShzcWwpO1xuXG4gICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0cmFuc2FjdGlvbi5jb21taXQoKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgYXdhaXQgdHJhbnNhY3Rpb24ucm9sbGJhY2soKTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgbG9nID0gKC4uLmFyZ3MpID0+IHtcbiAgICAvLyBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfVxuXG4gIHRhYmxlTmFtZSA9IChhY2NvdW50LCBuYW1lKSA9PiB7XG4gICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcblxuICAgIGlmICh0aGlzLnVzZUFjY291bnRQcmVmaXgpIHtcbiAgICAgIHJldHVybiAnYWNjb3VudF8nICsgYWNjb3VudC5yb3dJRCArICdfJyArIG5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxuICBvblN5bmNTdGFydCA9IGFzeW5jICh7YWNjb3VudCwgdGFza3N9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuICB9XG5cbiAgb25TeW5jRmluaXNoID0gYXN5bmMgKHthY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMuY2xlYW51cEZyaWVuZGx5Vmlld3MoYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gIH1cblxuICBvbkZvcm1TYXZlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtfSkgPT4ge1xuICAgIGxvZygnZm9ybTpzYXZlJywgZm9ybS5pZCk7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pO1xuICB9XG5cbiAgb25Gb3JtRGVsZXRlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50fSkgPT4ge1xuICAgIGNvbnN0IG9sZEZvcm0gPSB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbnVsbCk7XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQpO1xuICB9XG5cbiAgb25SZWNvcmREZWxldGUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMuZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHJlY29yZC5mb3JtLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnRzLm1hcChvID0+IG8uc3FsKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICBvblBob3RvU2F2ZSA9IGFzeW5jICh7cGhvdG8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XG4gIH1cblxuICBvblZpZGVvU2F2ZSA9IGFzeW5jICh7dmlkZW8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gIH1cblxuICBvbkF1ZGlvU2F2ZSA9IGFzeW5jICh7YXVkaW8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVBdWRpbyhhdWRpbywgYWNjb3VudCk7XG4gIH1cblxuICBvblNpZ25hdHVyZVNhdmUgPSBhc3luYyAoe3NpZ25hdHVyZSwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVNpZ25hdHVyZShzaWduYXR1cmUsIGFjY291bnQpO1xuICB9XG5cbiAgb25DaGFuZ2VzZXRTYXZlID0gYXN5bmMgKHtjaGFuZ2VzZXQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe2Nob2ljZUxpc3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KGNob2ljZUxpc3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25DbGFzc2lmaWNhdGlvblNldFNhdmUgPSBhc3luYyAoe2NsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQoY2xhc3NpZmljYXRpb25TZXQsIGFjY291bnQpO1xuICB9XG5cbiAgb25Qcm9qZWN0U2F2ZSA9IGFzeW5jICh7cHJvamVjdCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3QocHJvamVjdCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJvbGVTYXZlID0gYXN5bmMgKHtyb2xlLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShyb2xlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uTWVtYmVyc2hpcFNhdmUgPSBhc3luYyAoe21lbWJlcnNoaXAsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG1lbWJlcnNoaXAsIGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUGhvdG8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnBob3RvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0UGhvdG9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAncGhvdG9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVWaWRlbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAudmlkZW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRWaWRlb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICd2aWRlb3MnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUF1ZGlvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5hdWRpbyhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdEF1ZGlvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ2F1ZGlvJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVTaWduYXR1cmUob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnNpZ25hdHVyZShvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFNpZ25hdHVyZVVSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdzaWduYXR1cmVzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaGFuZ2VzZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNoYW5nZXNldChvYmplY3QpLCAnY2hhbmdlc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucHJvamVjdChvYmplY3QpLCAncHJvamVjdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU1lbWJlcnNoaXAob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLm1lbWJlcnNoaXAob2JqZWN0KSwgJ21lbWJlcnNoaXBzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yb2xlKG9iamVjdCksICdyb2xlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuZm9ybShvYmplY3QpLCAnZm9ybXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNob2ljZUxpc3Qob2JqZWN0KSwgJ2Nob2ljZV9saXN0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCksICdjbGFzc2lmaWNhdGlvbl9zZXRzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVPYmplY3QodmFsdWVzLCB0YWJsZSkge1xuICAgIGNvbnN0IGRlbGV0ZVN0YXRlbWVudCA9IHRoaXMubXNzcWwuZGVsZXRlU3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB7cm93X3Jlc291cmNlX2lkOiB2YWx1ZXMucm93X3Jlc291cmNlX2lkfSk7XG4gICAgY29uc3QgaW5zZXJ0U3RhdGVtZW50ID0gdGhpcy5tc3NxbC5pbnNlcnRTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHZhbHVlcywge3BrOiAnaWQnfSk7XG5cbiAgICBjb25zdCBzcWwgPSBbIGRlbGV0ZVN0YXRlbWVudC5zcWwsIGluc2VydFN0YXRlbWVudC5zcWwgXS5qb2luKCdcXG4nKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihzcWwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB3YXJuKGB1cGRhdGVPYmplY3QgJHt0YWJsZX0gZmFpbGVkYCk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgcmVsb2FkVGFibGVMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIHJlbG9hZFZpZXdMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLnZpZXdTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudmlld05hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgYmFzZU1lZGlhVVJMID0gKCkgPT4ge1xuICB9XG5cbiAgZm9ybWF0UGhvdG9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zLyR7IGlkIH0uanBnYDtcbiAgfVxuXG4gIGZvcm1hdFZpZGVvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy8keyBpZCB9Lm1wNGA7XG4gIH1cblxuICBmb3JtYXRBdWRpb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9hdWRpby8keyBpZCB9Lm00YWA7XG4gIH1cblxuICBmb3JtYXRTaWduYXR1cmVVUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vc2lnbmF0dXJlcy8keyBpZCB9LnBuZ2A7XG4gIH1cblxuICBpbnRlZ3JpdHlXYXJuaW5nKGV4KSB7XG4gICAgd2FybihgXG4tLS0tLS0tLS0tLS0tXG4hISBXQVJOSU5HICEhXG4tLS0tLS0tLS0tLS0tXG5cbk1TU1FMIGRhdGFiYXNlIGludGVncml0eSBpc3N1ZSBlbmNvdW50ZXJlZC4gQ29tbW9uIHNvdXJjZXMgb2YgZGF0YWJhc2UgaXNzdWVzIGFyZTpcblxuKiBSZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIGFuZCB1c2luZyBhbiBvbGQgTVNTUUwgZGF0YWJhc2Ugd2l0aG91dCByZWNyZWF0aW5nXG4gIHRoZSBNU1NRTCBkYXRhYmFzZS5cbiogRGVsZXRpbmcgdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlIGFuZCB1c2luZyBhbiBleGlzdGluZyBNU1NRTCBkYXRhYmFzZVxuKiBNYW51YWxseSBtb2RpZnlpbmcgdGhlIE1TU1FMIGRhdGFiYXNlXG4qIENyZWF0aW5nIG11bHRpcGxlIGFwcHMgaW4gRnVsY3J1bSB3aXRoIHRoZSBzYW1lIG5hbWUuIFRoaXMgaXMgZ2VuZXJhbGx5IE9LLCBleGNlcHRcbiAgeW91IHdpbGwgbm90IGJlIGFibGUgdG8gdXNlIHRoZSBcImZyaWVuZGx5IHZpZXdcIiBmZWF0dXJlIG9mIHRoZSBNU1NRTCBwbHVnaW4gc2luY2VcbiAgdGhlIHZpZXcgbmFtZXMgYXJlIGRlcml2ZWQgZnJvbSB0aGUgZm9ybSBuYW1lcy5cblxuTm90ZTogV2hlbiByZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIG9yIFwic3RhcnRpbmcgb3ZlclwiIHlvdSBuZWVkIHRvIGRyb3AgYW5kIHJlLWNyZWF0ZVxudGhlIE1TU1FMIGRhdGFiYXNlLiBUaGUgbmFtZXMgb2YgZGF0YWJhc2Ugb2JqZWN0cyBhcmUgdGllZCBkaXJlY3RseSB0byB0aGUgZGF0YWJhc2Vcbm9iamVjdHMgaW4gdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlLlxuXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblJlcG9ydCBpc3N1ZXMgYXQgaHR0cHM6Ly9naXRodWIuY29tL2Z1bGNydW1hcHAvZnVsY3J1bS1kZXNrdG9wL2lzc3Vlc1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5NZXNzYWdlOlxuJHsgZXgubWVzc2FnZSB9XG5cblN0YWNrOlxuJHsgZXguc3RhY2sgfVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5gLnJlZFxuICAgICk7XG4gIH1cblxuICBzZXR1cE9wdGlvbnMoKSB7XG4gICAgdGhpcy5iYXNlTWVkaWFVUkwgPSBmdWxjcnVtLmFyZ3MubXNzcWxNZWRpYUJhc2VVcmwgPyBmdWxjcnVtLmFyZ3MubXNzcWxNZWRpYUJhc2VVcmwgOiAnaHR0cHM6Ly9hcGkuZnVsY3J1bWFwcC5jb20vYXBpL3YyJztcblxuICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zID0ge1xuICAgICAgc2NoZW1hOiB0aGlzLmRhdGFTY2hlbWEsXG5cbiAgICAgIGVzY2FwZUlkZW50aWZpZXI6IHRoaXMuZXNjYXBlSWRlbnRpZmllcixcblxuICAgICAgZGlzYWJsZUFycmF5czogdGhpcy5kaXNhYmxlQXJyYXlzLFxuXG4gICAgICBwZXJzaXN0ZW50VGFibGVOYW1lczogdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyxcblxuICAgICAgYWNjb3VudFByZWZpeDogdGhpcy51c2VBY2NvdW50UHJlZml4ID8gJ2FjY291bnRfJyArIHRoaXMuYWNjb3VudC5yb3dJRCA6IG51bGwsXG5cbiAgICAgIGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQ6ICdkYXRlJyxcblxuICAgICAgZGlzYWJsZUNvbXBsZXhUeXBlczogdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzLFxuXG4gICAgICB2YWx1ZXNUcmFuc2Zvcm1lcjogdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnZhbHVlc1RyYW5zZm9ybWVyLFxuXG4gICAgICBtZWRpYVVSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcblxuICAgICAgICByZXR1cm4gbWVkaWFWYWx1ZS5pdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRQaG90b1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRWaWRlb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRBdWRpb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIG1lZGlhVmlld1VSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgaWRzID0gbWVkaWFWYWx1ZS5pdGVtcy5tYXAobyA9PiBvLm1lZGlhSUQpO1xuXG4gICAgICAgIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNQaG90b0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zL3ZpZXc/cGhvdG9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNWaWRlb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zL3ZpZXc/dmlkZW9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNBdWRpb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vdmlldz9hdWRpbz0keyBpZHMgfWA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwpIHtcbiAgICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zLnJlcG9ydFVSTEZvcm1hdHRlciA9IChmZWF0dXJlKSA9PiB7XG4gICAgICAgIHJldHVybiBgJHsgZnVsY3J1bS5hcmdzLm1zc3FsUmVwb3J0QmFzZVVybCB9L3JlcG9ydHMvJHsgZmVhdHVyZS5pZCB9LnBkZmA7XG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZVJlY29yZCA9IGFzeW5jIChyZWNvcmQsIGFjY291bnQsIHNraXBUYWJsZUNoZWNrKSA9PiB7XG4gICAgaWYgKCFza2lwVGFibGVDaGVjayAmJiAhdGhpcy5yb290VGFibGVFeGlzdHMocmVjb3JkLmZvcm0pKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKHJlY29yZC5mb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVSZWNvcmQgJiYgIXRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkKHtyZWNvcmQsIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy51cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuXG4gICAgY29uc3Qgc3lzdGVtVmFsdWVzID0gTVNTUUxSZWNvcmRWYWx1ZXMuc3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZShyZWNvcmQsIG51bGwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnJlY29yZChyZWNvcmQsIHN5c3RlbVZhbHVlcyksICdyZWNvcmRzJyk7XG4gIH1cblxuICByb290VGFibGVFeGlzdHMgPSAoZm9ybSkgPT4ge1xuICAgIHJldHVybiB0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZihNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtLCBudWxsLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucykpICE9PSAtMTtcbiAgfVxuXG4gIHJlY3JlYXRlRm9ybVRhYmxlcyA9IGFzeW5jIChmb3JtLCBhY2NvdW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pLCBudWxsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBlcnJvcihleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG51bGwsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSkpO1xuICB9XG5cbiAgdXBkYXRlRm9ybSA9IGFzeW5jIChmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKSA9PiB7XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0oe2Zvcm0sIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBsb2coJ1VwZGF0aW5nIGZvcm0nLCBmb3JtLmlkKTtcblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KGZvcm0sIGFjY291bnQpO1xuXG4gICAgICBpZiAoIXRoaXMucm9vdFRhYmxlRXhpc3RzKGZvcm0pICYmIG5ld0Zvcm0gIT0gbnVsbCkge1xuICAgICAgICBvbGRGb3JtID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgZGlzYWJsZUFycmF5czogdGhpcy5kaXNhYmxlQXJyYXlzLFxuICAgICAgICBkaXNhYmxlQ29tcGxleFR5cGVzOiBmYWxzZSxcbiAgICAgICAgdXNlck1vZHVsZTogdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSxcbiAgICAgICAgdGFibGVTY2hlbWE6IHRoaXMuZGF0YVNjaGVtYSxcbiAgICAgICAgY2FsY3VsYXRlZEZpZWxkRGF0ZUZvcm1hdDogJ2RhdGUnLFxuICAgICAgICBtZXRhZGF0YTogdHJ1ZSxcbiAgICAgICAgdXNlUmVzb3VyY2VJRDogdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyxcbiAgICAgICAgYWNjb3VudFByZWZpeDogdGhpcy51c2VBY2NvdW50UHJlZml4ID8gJ2FjY291bnRfJyArIHRoaXMuYWNjb3VudC5yb3dJRCA6IG51bGxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHtzdGF0ZW1lbnRzfSA9IGF3YWl0IE1TU1FMU2NoZW1hLmdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtLCBvcHRpb25zKTtcblxuICAgICAgbG9nKCdEcm9wcGluZyB2aWV3cycsIGZvcm0uaWQpO1xuXG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgICAgfVxuXG4gICAgICBsb2coJ1J1bm5pbmcgc2NoZW1hIHN0YXRlbWVudHMnLCBmb3JtLmlkLCBzdGF0ZW1lbnRzLmxlbmd0aCk7XG5cbiAgICAgIGF3YWl0IHRoaXMucnVuQWxsVHJhbnNhY3Rpb24oc3RhdGVtZW50cyk7XG5cbiAgICAgIGxvZygnQ3JlYXRpbmcgdmlld3MnLCBmb3JtLmlkKTtcblxuICAgICAgaWYgKG5ld0Zvcm0pIHtcbiAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvZygnQ29tcGxldGVkIGZvcm0gdXBkYXRlJywgZm9ybS5pZCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHdhcm4oJ3VwZGF0ZUZvcm0gZmFpbGVkJyk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdChcIklGIE9CSkVDVF9JRCgnJXMuJXMnLCAnVicpIElTIE5PVCBOVUxMIERST1AgVklFVyAlcy4lcztcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB3YXJuKCdkcm9wRnJpZW5kbHlWaWV3IGZhaWxlZCcpO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBjcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0NSRUFURSBWSUVXICVzLiVzIEFTIFNFTEVDVCAqIEZST00gJXM7JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtQW5kU2NoZW1hKGZvcm0sIHJlcGVhdGFibGUsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zLCAnX3ZpZXdfZnVsbCcpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIC8vIHNvbWV0aW1lcyBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICB3YXJuKCdjcmVhdGVGcmllbmRseVZpZXcgZmFpbGVkJyk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgIH1cbiAgfVxuXG4gIGdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCBuYW1lID0gY29tcGFjdChbZm9ybS5uYW1lLCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUuZGF0YU5hbWVdKS5qb2luKCcgLSAnKVxuXG4gICAgY29uc3QgZm9ybUlEID0gdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyA/IGZvcm0uaWQgOiBmb3JtLnJvd0lEO1xuXG4gICAgY29uc3QgcHJlZml4ID0gY29tcGFjdChbJ3ZpZXcnLCBmb3JtSUQsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5rZXldKS5qb2luKCcgLSAnKTtcblxuICAgIGNvbnN0IG9iamVjdE5hbWUgPSBbcHJlZml4LCBuYW1lXS5qb2luKCcgLSAnKTtcblxuICAgIHJldHVybiB0aGlzLnRyaW1JZGVudGlmaWVyKGZ1bGNydW0uYXJncy5tc3NxbFVuZGVyc2NvcmVOYW1lcyAhPT0gZmFsc2UgPyBzbmFrZShvYmplY3ROYW1lKSA6IG9iamVjdE5hbWUpO1xuICB9XG5cbiAgYXN5bmMgaW52b2tlQmVmb3JlRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBpbnZva2VBZnRlckZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxBZnRlckZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFmdGVyU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCBwcm9ncmVzcykge1xuICAgIGF3YWl0IHRoaXMucmVjcmVhdGVGb3JtVGFibGVzKGZvcm0sIGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIHByb2dyZXNzKGluZGV4KTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFZpZXdMaXN0KCk7XG5cbiAgICBjb25zdCBhY3RpdmVWaWV3TmFtZXMgPSBbXTtcblxuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIG51bGwpKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmUgPSBkaWZmZXJlbmNlKHRoaXMudmlld05hbWVzLCBhY3RpdmVWaWV3TmFtZXMpO1xuXG4gICAgZm9yIChjb25zdCB2aWV3TmFtZSBvZiByZW1vdmUpIHtcbiAgICAgIGlmICh2aWV3TmFtZS5pbmRleE9mKCd2aWV3XycpID09PSAwIHx8IHZpZXdOYW1lLmluZGV4T2YoJ3ZpZXcgLSAnKSA9PT0gMCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdChcIklGIE9CSkVDVF9JRCgnJXMuJXMnLCAnVicpIElTIE5PVCBOVUxMIERST1AgVklFVyAlcy4lcztcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgd2FybignY2xlYW51cEZyaWVuZGx5Vmlld3MgZmFpbGVkJyk7XG4gICAgICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG4gIH1cblxuICBmb3JtVmVyc2lvbiA9IChmb3JtKSA9PiB7XG4gICAgaWYgKGZvcm0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcbiAgfVxuXG4gIHVwZGF0ZVN0YXR1cyA9IChtZXNzYWdlKSA9PiB7XG4gICAgaWYgKHByb2Nlc3Muc3Rkb3V0LmlzVFRZKSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcFN5c3RlbVRhYmxlcygpIHtcbiAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodGVtcGxhdGVEcm9wKSk7XG4gIH1cblxuICBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5ydW4oYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBkcm9wRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBEUk9QIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfTtgKTtcbiAgfVxuXG4gIGFzeW5jIHNldHVwRGF0YWJhc2UoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHZlcnNpb24wMDEpKTtcbiAgfVxuXG4gIHByZXBhcmVNaWdyYXRpb25TY3JpcHQoc3FsKSB7XG4gICAgcmV0dXJuIHNxbC5yZXBsYWNlKC9fX1NDSEVNQV9fL2csIHRoaXMuZGF0YVNjaGVtYSlcbiAgICAgICAgICAgICAgLnJlcGxhY2UoL19fVklFV19TQ0hFTUFfXy9nLCB0aGlzLnZpZXdTY2hlbWEpLnNwbGl0KCc7Jyk7XG4gIH1cblxuICBhc3luYyBzZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KSB7XG4gICAgY29uc3QgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgICB9O1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFBob3RvKHt9LCBhc3luYyAocGhvdG8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Bob3RvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoVmlkZW8oe30sIGFzeW5jICh2aWRlbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnVmlkZW9zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVZpZGVvKHZpZGVvLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hBdWRpbyh7fSwgYXN5bmMgKGF1ZGlvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdBdWRpbycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVBdWRpbyhhdWRpbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoU2lnbmF0dXJlKHt9LCBhc3luYyAoc2lnbmF0dXJlLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdTaWduYXR1cmVzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNpZ25hdHVyZShzaWduYXR1cmUsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENoYW5nZXNldCh7fSwgYXN5bmMgKGNoYW5nZXNldCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hhbmdlc2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hSb2xlKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdSb2xlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUHJvamVjdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUHJvamVjdHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaEZvcm0oe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Zvcm1zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hNZW1iZXJzaGlwKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdNZW1iZXJzaGlwcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hvaWNlTGlzdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hvaWNlIExpc3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2xhc3NpZmljYXRpb24gU2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgbWF5YmVJbml0aWFsaXplKCkge1xuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmICh0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZignbWlncmF0aW9ucycpID09PSAtMSkge1xuICAgICAgbG9nKCdJbml0aXRhbGl6aW5nIGRhdGFiYXNlLi4uJyk7XG5cbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMubWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgbWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpIHtcbiAgICB0aGlzLm1pZ3JhdGlvbnMgPSAoYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCBuYW1lIEZST00gJHsgdGhpcy5kYXRhU2NoZW1hIH0ubWlncmF0aW9uc2ApKS5tYXAobyA9PiBvLm5hbWUpO1xuXG4gICAgbGV0IHBvcHVsYXRlUmVjb3JkcyA9IGZhbHNlO1xuXG4gICAgZm9yIChsZXQgY291bnQgPSAyOyBjb3VudCA8PSBDVVJSRU5UX1ZFUlNJT047ICsrY291bnQpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBwYWRTdGFydChjb3VudCwgMywgJzAnKTtcblxuICAgICAgY29uc3QgbmVlZHNNaWdyYXRpb24gPSB0aGlzLm1pZ3JhdGlvbnMuaW5kZXhPZih2ZXJzaW9uKSA9PT0gLTEgJiYgTUlHUkFUSU9OU1t2ZXJzaW9uXTtcblxuICAgICAgaWYgKG5lZWRzTWlncmF0aW9uKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdChNSUdSQVRJT05TW3ZlcnNpb25dKSk7XG5cbiAgICAgICAgaWYgKHZlcnNpb24gPT09ICcwMDInKSB7XG4gICAgICAgICAgbG9nKCdQb3B1bGF0aW5nIHN5c3RlbSB0YWJsZXMuLi4nKTtcbiAgICAgICAgICBwb3B1bGF0ZVJlY29yZHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZlcnNpb24gPT09ICcwMDUnKSB7XG4gICAgICAgICAgbG9nKCdNaWdyYXRpbmcgZGF0ZSBjYWxjdWxhdGlvbiBmaWVsZHMuLi4nKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLm1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdChhY2NvdW50KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3B1bGF0ZVJlY29yZHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9wdWxhdGVSZWNvcmRzKGFjY291bnQpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHBvcHVsYXRlUmVjb3JkcyhhY2NvdW50KSB7XG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBpbmRleCA9IDA7XG5cbiAgICAgIGF3YWl0IGZvcm0uZmluZEVhY2hSZWNvcmQoe30sIGFzeW5jIChyZWNvcmQpID0+IHtcbiAgICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgICB0aGlzLnByb2dyZXNzKGZvcm0ubmFtZSwgaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBtaWdyYXRlQ2FsY3VsYXRlZEZpZWxkc0RhdGVGb3JtYXQoYWNjb3VudCkge1xuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBjb25zdCBmaWVsZHMgPSBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdDYWxjdWxhdGVkRmllbGQnKS5maWx0ZXIoZWxlbWVudCA9PiBlbGVtZW50LmRpc3BsYXkuaXNEYXRlKTtcblxuICAgICAgaWYgKGZpZWxkcy5sZW5ndGgpIHtcbiAgICAgICAgbG9nKCdNaWdyYXRpbmcgZGF0ZSBjYWxjdWxhdGlvbiBmaWVsZHMgaW4gZm9ybS4uLicsIGZvcm0ubmFtZSk7XG5cbiAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcbiAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gIH1cbn1cbiJdfQ==