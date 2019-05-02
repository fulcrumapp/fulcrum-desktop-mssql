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
            const request = new _mssql2.default.Request(transaction);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJDVVJSRU5UX1ZFUlNJT04iLCJERUZBVUxUX1NDSEVNQSIsImxvZyIsIndhcm4iLCJlcnJvciIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJydW5BbGxUcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb24iLCJiZWdpbiIsIlJlcXVlc3QiLCJxdWVyeSIsImNvbW1pdCIsImV4Iiwicm9sbGJhY2siLCJ0YWJsZU5hbWUiLCJyb3dJRCIsInVzZUFjY291bnRQcmVmaXgiLCJvblN5bmNTdGFydCIsInRhc2tzIiwib25TeW5jRmluaXNoIiwiY2xlYW51cEZyaWVuZGx5Vmlld3MiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwic2hvdWxkVXBkYXRlRm9ybSIsInVwZGF0ZUZvcm1PYmplY3QiLCJvcHRpb25zIiwiZGlzYWJsZUFycmF5cyIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJ1c2VyTW9kdWxlIiwidGFibGVTY2hlbWEiLCJjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0IiwibWV0YWRhdGEiLCJ1c2VSZXNvdXJjZUlEIiwicGVyc2lzdGVudFRhYmxlTmFtZXMiLCJhY2NvdW50UHJlZml4IiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZHJvcEZyaWVuZGx5VmlldyIsInJlcGVhdGFibGUiLCJlbGVtZW50c09mVHlwZSIsImxlbmd0aCIsImNyZWF0ZUZyaWVuZGx5VmlldyIsImludGVncml0eVdhcm5pbmciLCJtZXNzYWdlIiwicHJvY2VzcyIsInN0ZG91dCIsImlzVFRZIiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsInByb2dyZXNzIiwidGFzayIsImNsaSIsImNvbW1hbmQiLCJkZXNjIiwiYnVpbGRlciIsIm1zc3FsQ29ubmVjdGlvblN0cmluZyIsInR5cGUiLCJtc3NxbERhdGFiYXNlIiwiZGVmYXVsdCIsIm1zc3FsSG9zdCIsImhvc3QiLCJtc3NxbFBvcnQiLCJtc3NxbFVzZXIiLCJtc3NxbFBhc3N3b3JkIiwibXNzcWxTY2hlbWEiLCJtc3NxbFNjaGVtYVZpZXdzIiwibXNzcWxTeW5jRXZlbnRzIiwibXNzcWxCZWZvcmVGdW5jdGlvbiIsIm1zc3FsQWZ0ZXJGdW5jdGlvbiIsInJlcXVpcmVkIiwibXNzcWxSZXBvcnRCYXNlVXJsIiwibXNzcWxNZWRpYUJhc2VVcmwiLCJtc3NxbFVuZGVyc2NvcmVOYW1lcyIsIm1zc3FsUGVyc2lzdGVudFRhYmxlTmFtZXMiLCJtc3NxbFByZWZpeCIsImhhbmRsZXIiLCJzdWJzdHJpbmciLCJ1c2VTeW5jRXZlbnRzIiwidXNlciIsInBhc3N3b3JkIiwicmVxdWlyZSIsImFwcCIsImNvbm5lY3QiLCJvbiIsInNldHVwT3B0aW9ucyIsIm1heWJlSW5pdGlhbGl6ZSIsImRlYWN0aXZhdGUiLCJjbG9zZSIsIm9iamVjdCIsInZhbHVlcyIsImZpbGUiLCJhY2Nlc3Nfa2V5IiwidGFibGUiLCJkZWxldGVTdGF0ZW1lbnQiLCJyb3dfcmVzb3VyY2VfaWQiLCJpbnNlcnRTdGF0ZW1lbnQiLCJwayIsInN0YWNrIiwic2NoZW1hIiwidmFsdWVzVHJhbnNmb3JtZXIiLCJtZWRpYVVSTEZvcm1hdHRlciIsIm1lZGlhVmFsdWUiLCJpdGVtcyIsIml0ZW0iLCJlbGVtZW50IiwiaXNQaG90b0VsZW1lbnQiLCJtZWRpYUlEIiwiaXNWaWRlb0VsZW1lbnQiLCJpc0F1ZGlvRWxlbWVudCIsIm1lZGlhVmlld1VSTEZvcm1hdHRlciIsImlkcyIsInJlcG9ydFVSTEZvcm1hdHRlciIsImZlYXR1cmUiLCJ2aWV3TmFtZSIsImdldEZyaWVuZGx5VGFibGVOYW1lIiwidGFibGVOYW1lV2l0aEZvcm1BbmRTY2hlbWEiLCJkYXRhTmFtZSIsImZvcm1JRCIsInByZWZpeCIsImtleSIsIm9iamVjdE5hbWUiLCJiZWZvcmVTeW5jIiwiYWZ0ZXJTeW5jIiwiZmluZEVhY2hSZWNvcmQiLCJhY3RpdmVWaWV3TmFtZXMiLCJyZW1vdmUiLCJwcmVwYXJlTWlncmF0aW9uU2NyaXB0IiwiZGF0YWJhc2VOYW1lIiwic3BsaXQiLCJmaW5kRWFjaFBob3RvIiwiZmluZEVhY2hWaWRlbyIsImZpbmRFYWNoQXVkaW8iLCJmaW5kRWFjaFNpZ25hdHVyZSIsImZpbmRFYWNoQ2hhbmdlc2V0IiwiZmluZEVhY2hSb2xlIiwiZmluZEVhY2hQcm9qZWN0IiwiZmluZEVhY2hGb3JtIiwiZmluZEVhY2hNZW1iZXJzaGlwIiwiZmluZEVhY2hDaG9pY2VMaXN0IiwiZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCIsIm1heWJlUnVuTWlncmF0aW9ucyIsIm1pZ3JhdGlvbnMiLCJwb3B1bGF0ZVJlY29yZHMiLCJjb3VudCIsInZlcnNpb24iLCJuZWVkc01pZ3JhdGlvbiIsIm1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdCIsImZpZWxkcyIsImZpbHRlciIsImRpc3BsYXkiLCJpc0RhdGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOztJQUtZQSxHOztBQUpaOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBRUE7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7Ozs7O0FBRUEsTUFBTUMsd0JBQXdCLEdBQTlCOztBQUVBLE1BQU1DLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsVUFBUSxXQUZXO0FBR25CQyxRQUFNLElBSGE7QUFJbkJDLE9BQUssRUFKYztBQUtuQkMscUJBQW1CO0FBTEEsQ0FBckI7O0FBUUEsTUFBTUMsYUFBYTtBQUNqQiwwQkFEaUI7QUFFakIsMEJBRmlCO0FBR2pCLDBCQUhpQjtBQUlqQiwyQkFKaUI7QUFLakI7QUFMaUIsQ0FBbkI7O0FBUUEsTUFBTUMsa0JBQWtCLENBQXhCOztBQUVBLE1BQU1DLGlCQUFpQixLQUF2Qjs7QUFFQSxNQUFNLEVBQUVDLEdBQUYsRUFBT0MsSUFBUCxFQUFhQyxLQUFiLEtBQXVCQyxRQUFRQyxNQUFSLENBQWVDLFdB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bkIsRUFBMEI7QUFDeEJRLGdCQUFRLENBQVI7O0FBRUEsY0FBTU4sS0FBSzROLGNBQUwsQ0FBb0IsRUFBcEI7QUFBQSx5Q0FBd0IsV0FBT2xLLE1BQVAsRUFBa0I7QUFDOUNBLG1CQUFPMUQsSUFBUCxHQUFjQSxJQUFkOztBQUVBLGdCQUFJLEVBQUVNLEtBQUYsR0FBVSxFQUFWLEtBQWlCLENBQXJCLEVBQXdCO0FBQ3RCLHNCQUFLNEksUUFBTCxDQUFjbEosS0FBS1EsSUFBbkIsRUFBeUJGLEtBQXpCO0FBQ0Q7O0FBRUQsa0JBQU0sUUFBS3FELFlBQUwsQ0FBa0JELE1BQWxCLEVBQTBCbEUsT0FBMUIsRUFBbUMsS0FBbkMsQ0FBTjtBQUNELFdBUks7O0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBTjtBQVNEO0FBakI0QjtBQWtCOUI7O0FBRUsyUCxtQ0FBTixDQUF3QzNQLE9BQXhDLEVBQWlEO0FBQUE7O0FBQUE7QUFDL0MsWUFBTU0sUUFBUSxNQUFNTixRQUFRTyxlQUFSLENBQXdCLEVBQXhCLENBQXBCOztBQUVBLFdBQUssTUFBTUMsSUFBWCxJQUFtQkYsS0FBbkIsRUFBMEI7QUFDeEIsY0FBTXNQLFNBQVNwUCxLQUFLdUksY0FBTCxDQUFvQixpQkFBcEIsRUFBdUM4RyxNQUF2QyxDQUE4QztBQUFBLGlCQUFXNUMsUUFBUTZDLE9BQVIsQ0FBZ0JDLE1BQTNCO0FBQUEsU0FBOUMsQ0FBZjs7QUFFQSxZQUFJSCxPQUFPNUcsTUFBWCxFQUFtQjtBQUNqQmpLLGNBQUksOENBQUosRUFBb0R5QixLQUFLUSxJQUF6RDs7QUFFQSxnQkFBTSxRQUFLSCxXQUFMLENBQWlCTCxJQUFqQixFQUF1QlIsT0FBdkIsRUFBZ0MsWUFBTSxDQUFFLENBQXhDLENBQU47QUFDRDtBQUNGO0FBWDhDO0FBWWhEOztBQTdnQ2tCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1zc3FsIGZyb20gJ21zc3FsJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IE1TU1FMIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgTVNTUUxSZWNvcmRWYWx1ZXMgZnJvbSAnLi9tc3NxbC1yZWNvcmQtdmFsdWVzJ1xuaW1wb3J0IHNuYWtlIGZyb20gJ3NuYWtlLWNhc2UnO1xuaW1wb3J0IHRlbXBsYXRlRHJvcCBmcm9tICcuL3RlbXBsYXRlLmRyb3Auc3FsJztcbmltcG9ydCBTY2hlbWFNYXAgZnJvbSAnLi9zY2hlbWEtbWFwJztcbmltcG9ydCAqIGFzIGFwaSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCB7IGNvbXBhY3QsIGRpZmZlcmVuY2UsIHBhZFN0YXJ0IH0gZnJvbSAnbG9kYXNoJztcblxuaW1wb3J0IHZlcnNpb24wMDEgZnJvbSAnLi92ZXJzaW9uLTAwMS5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDIgZnJvbSAnLi92ZXJzaW9uLTAwMi5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDMgZnJvbSAnLi92ZXJzaW9uLTAwMy5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDQgZnJvbSAnLi92ZXJzaW9uLTAwNC5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDUgZnJvbSAnLi92ZXJzaW9uLTAwNS5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDYgZnJvbSAnLi92ZXJzaW9uLTAwNi5zcWwnO1xuXG5jb25zdCBNQVhfSURFTlRJRklFUl9MRU5HVEggPSAxMDA7XG5cbmNvbnN0IE1TU1FMX0NPTkZJRyA9IHtcbiAgZGF0YWJhc2U6ICdmdWxjcnVtYXBwJyxcbiAgc2VydmVyOiAnbG9jYWxob3N0JyxcbiAgcG9ydDogMTQzMyxcbiAgbWF4OiAxMCxcbiAgaWRsZVRpbWVvdXRNaWxsaXM6IDMwMDAwXG59O1xuXG5jb25zdCBNSUdSQVRJT05TID0ge1xuICAnMDAyJzogdmVyc2lvbjAwMixcbiAgJzAwMyc6IHZlcnNpb24wMDMsXG4gICcwMDQnOiB2ZXJzaW9uMDA0LFxuICAnMDA1JzogdmVyc2lvbjAwNSxcbiAgJzAwNic6IHZlcnNpb24wMDZcbn07XG5cbmNvbnN0IENVUlJFTlRfVkVSU0lPTiA9IDY7XG5cbmNvbnN0IERFRkFVTFRfU0NIRU1BID0gJ2Ribyc7XG5cbmNvbnN0IHsgbG9nLCB3YXJuLCBlcnJvciB9ID0gZnVsY3J1bS5sb2dnZXIud2l0aENvbnRleHQoJ21zc3FsJyk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ21zc3FsJyxcbiAgICAgIGRlc2M6ICdydW4gdGhlIG1zc3FsIHN5bmMgZm9yIGEgc3BlY2lmaWMgb3JnYW5pemF0aW9uJyxcbiAgICAgIGJ1aWxkZXI6IHtcbiAgICAgICAgbXNzcWxDb25uZWN0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGNvbm5lY3Rpb24gc3RyaW5nIChvdmVycmlkZXMgYWxsIGluZGl2aWR1YWwgZGF0YWJhc2UgY29ubmVjdGlvbiBwYXJhbWV0ZXJzKScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxEYXRhYmFzZToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBkYXRhYmFzZSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuZGF0YWJhc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxIb3N0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBob3N0JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuaG9zdFxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBvcnQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIHBvcnQnLFxuICAgICAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcucG9ydFxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFVzZXI6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgdXNlcicsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQYXNzd29yZDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBwYXNzd29yZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTY2hlbWE6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNjaGVtYVZpZXdzOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYSBmb3IgdGhlIGZyaWVuZGx5IHZpZXdzJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFN5bmNFdmVudHM6IHtcbiAgICAgICAgICBkZXNjOiAnYWRkIHN5bmMgZXZlbnQgaG9va3MnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQmVmb3JlRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGJlZm9yZSB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxBZnRlckZ1bmN0aW9uOiB7XG4gICAgICAgICAgZGVzYzogJ2NhbGwgdGhpcyBmdW5jdGlvbiBhZnRlciB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbEZvcm06IHtcbiAgICAgICAgICBkZXNjOiAndGhlIGZvcm0gSUQgdG8gcmVidWlsZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxSZXBvcnRCYXNlVXJsOiB7XG4gICAgICAgICAgZGVzYzogJ3JlcG9ydCBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxNZWRpYUJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAnbWVkaWEgVVJMIGJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsVW5kZXJzY29yZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB1bmRlcnNjb3JlIG5hbWVzIChlLmcuIFwiUGFyayBJbnNwZWN0aW9uc1wiIGJlY29tZXMgXCJwYXJrX2luc3BlY3Rpb25zXCIpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lczoge1xuICAgICAgICAgIGRlc2M6ICd1c2UgdGhlIHNlcnZlciBpZCBpbiB0aGUgZm9ybSB0YWJsZSBuYW1lcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFByZWZpeDoge1xuICAgICAgICAgIGRlc2M6ICd1c2UgdGhlIG9yZ2FuaXphdGlvbiBJRCBhcyBhIHByZWZpeCBpbiB0aGUgb2JqZWN0IG5hbWVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxSZWJ1aWxkVmlld3NPbmx5OiB7XG4gICAgICAgICAgZGVzYzogJ29ubHkgcmVidWlsZCB0aGUgdmlld3MnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxDdXN0b21Nb2R1bGU6IHtcbiAgICAgICAgICBkZXNjOiAnYSBjdXN0b20gbW9kdWxlIHRvIGxvYWQgd2l0aCBzeW5jIGV4dGVuc2lvbnMgKGV4cGVyaW1lbnRhbCknLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNldHVwOiB7XG4gICAgICAgICAgZGVzYzogJ3NldHVwIHRoZSBkYXRhYmFzZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbERyb3A6IHtcbiAgICAgICAgICBkZXNjOiAnZHJvcCB0aGUgc3lzdGVtIHRhYmxlcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFN5c3RlbVRhYmxlc09ubHk6IHtcbiAgICAgICAgICBkZXNjOiAnb25seSBjcmVhdGUgdGhlIHN5c3RlbSByZWNvcmRzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZURhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcERhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BTeXN0ZW1UYWJsZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU2V0dXApIHtcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU3lzdGVtVGFibGVzT25seSkge1xuICAgICAgICBhd2FpdCB0aGlzLnNldHVwU3lzdGVtVGFibGVzKGFjY291bnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcblxuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRm9ybSAmJiBmb3JtLmlkICE9PSBmdWxjcnVtLmFyZ3MubXNzcWxGb3JtKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUmVidWlsZFZpZXdzT25seSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZyaWVuZGx5Vmlld3MoZm9ybSwgYWNjb3VudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoaW5kZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvZygnJyk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQWZ0ZXJGdW5jdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIHRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gaWRlbnRpZmllci5zdWJzdHJpbmcoMCwgTUFYX0lERU5USUZJRVJfTEVOR1RIKTtcbiAgfVxuXG4gIGVzY2FwZUlkZW50aWZpZXIgPSAoaWRlbnRpZmllcikgPT4ge1xuICAgIHJldHVybiBpZGVudGlmaWVyICYmIHRoaXMubXNzcWwuaWRlbnQodGhpcy50cmltSWRlbnRpZmllcihpZGVudGlmaWVyKSk7XG4gIH1cblxuICBnZXQgdXNlU3luY0V2ZW50cygpIHtcbiAgICByZXR1cm4gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyAhPSBudWxsID8gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyA6IHRydWU7XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICB0aGlzLmFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAuLi5NU1NRTF9DT05GSUcsXG4gICAgICBzZXJ2ZXI6IGZ1bGNydW0uYXJncy5tc3NxbEhvc3QgfHwgTVNTUUxfQ09ORklHLnNlcnZlcixcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc3NxbFBvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zc3FsRGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zc3FsVXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCB8fCBNU1NRTF9DT05GSUcudXNlclxuICAgIH07XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsVXNlcikge1xuICAgICAgb3B0aW9ucy51c2VyID0gZnVsY3J1bS5hcmdzLm1zc3FsVXNlcjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUGFzc3dvcmQpIHtcbiAgICAgIG9wdGlvbnMucGFzc3dvcmQgPSBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZDtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3VzdG9tTW9kdWxlKSB7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlID0gcmVxdWlyZShmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpO1xuICAgICAgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hcGkgPSBhcGk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwcCA9IGZ1bGNydW07XG4gICAgfVxuXG4gICAgdGhpcy5kaXNhYmxlQXJyYXlzID0gZmFsc2U7XG4gICAgdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzID0gdHJ1ZTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lcyA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy51c2VBY2NvdW50UHJlZml4ID0gKGZ1bGNydW0uYXJncy5tc3NxbFByZWZpeCAhPT0gZmFsc2UpO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChmdWxjcnVtLmFyZ3MubXNzcWxDb25uZWN0aW9uU3RyaW5nIHx8IG9wdGlvbnMpO1xuXG4gICAgaWYgKHRoaXMudXNlU3luY0V2ZW50cykge1xuICAgICAgZnVsY3J1bS5vbignc3luYzpzdGFydCcsIHRoaXMub25TeW5jU3RhcnQpO1xuICAgICAgZnVsY3J1bS5vbignc3luYzpmaW5pc2gnLCB0aGlzLm9uU3luY0ZpbmlzaCk7XG4gICAgICBmdWxjcnVtLm9uKCdwaG90bzpzYXZlJywgdGhpcy5vblBob3RvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCd2aWRlbzpzYXZlJywgdGhpcy5vblZpZGVvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdhdWRpbzpzYXZlJywgdGhpcy5vbkF1ZGlvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdzaWduYXR1cmU6c2F2ZScsIHRoaXMub25TaWduYXR1cmVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NoYW5nZXNldDpzYXZlJywgdGhpcy5vbkNoYW5nZXNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6ZGVsZXRlJywgdGhpcy5vblJlY29yZERlbGV0ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2Nob2ljZS1saXN0OnNhdmUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6ZGVsZXRlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignZm9ybTpzYXZlJywgdGhpcy5vbkZvcm1TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2Zvcm06ZGVsZXRlJywgdGhpcy5vbkZvcm1TYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OnNhdmUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uLXNldDpkZWxldGUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncm9sZTpzYXZlJywgdGhpcy5vblJvbGVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JvbGU6ZGVsZXRlJywgdGhpcy5vblJvbGVTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpzYXZlJywgdGhpcy5vblByb2plY3RTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Byb2plY3Q6ZGVsZXRlJywgdGhpcy5vblByb2plY3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpzYXZlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ21lbWJlcnNoaXA6ZGVsZXRlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICB9XG5cbiAgICB0aGlzLnZpZXdTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWFWaWV3cyB8fCBERUZBVUxUX1NDSEVNQTtcbiAgICB0aGlzLmRhdGFTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWEgfHwgREVGQVVMVF9TQ0hFTUE7XG5cbiAgICAvLyBGZXRjaCBhbGwgdGhlIGV4aXN0aW5nIHRhYmxlcyBvbiBzdGFydHVwLiBUaGlzIGFsbG93cyB1cyB0byBzcGVjaWFsIGNhc2UgdGhlXG4gICAgLy8gY3JlYXRpb24gb2YgbmV3IHRhYmxlcyBldmVuIHdoZW4gdGhlIGZvcm0gaXNuJ3QgdmVyc2lvbiAxLiBJZiB0aGUgdGFibGUgZG9lc24ndFxuICAgIC8vIGV4aXN0LCB3ZSBjYW4gcHJldGVuZCB0aGUgZm9ybSBpcyB2ZXJzaW9uIDEgc28gaXQgY3JlYXRlcyBhbGwgbmV3IHRhYmxlcyBpbnN0ZWFkXG4gICAgLy8gb2YgYXBwbHlpbmcgYSBzY2hlbWEgZGlmZi5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICAvLyBtYWtlIGEgY2xpZW50IHNvIHdlIGNhbiB1c2UgaXQgdG8gYnVpbGQgU1FMIHN0YXRlbWVudHNcbiAgICB0aGlzLm1zc3FsID0gbmV3IE1TU1FMKHt9KTtcblxuICAgIHRoaXMuc2V0dXBPcHRpb25zKCk7XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlSW5pdGlhbGl6ZSgpO1xuICB9XG5cbiAgYXN5bmMgZGVhY3RpdmF0ZSgpIHtcbiAgICBpZiAodGhpcy5wb29sKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvb2wuY2xvc2UoKTtcbiAgICB9XG4gIH1cblxuICBydW4gPSBhc3luYyAoc3FsKSA9PiB7XG4gICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcMC9nLCAnJyk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICBsb2coc3FsKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBvb2wucmVxdWVzdCgpLmJhdGNoKHNxbCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnJlY29yZHNldDtcbiAgfVxuXG4gIHJ1bkFsbCA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgcmVzdWx0cy5wdXNoKGF3YWl0IHRoaXMucnVuKHNxbCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgcnVuQWxsVHJhbnNhY3Rpb24gPSBhc3luYyAoc3RhdGVtZW50cykgPT4ge1xuICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gbmV3IG1zc3FsLlRyYW5zYWN0aW9uKHRoaXMucG9vbCk7XG5cbiAgICBhd2FpdCB0cmFuc2FjdGlvbi5iZWdpbigpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gbmV3IG1zc3FsLlJlcXVlc3QodHJhbnNhY3Rpb24pO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3QucXVlcnkoc3FsKTtcblxuICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdHJhbnNhY3Rpb24uY29tbWl0KCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGF3YWl0IHRyYW5zYWN0aW9uLnJvbGxiYWNrKCk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIGxvZyA9ICguLi5hcmdzKSA9PiB7XG4gICAgLy8gY29uc29sZS5sb2coLi4uYXJncyk7XG4gIH1cblxuICB0YWJsZU5hbWUgPSAoYWNjb3VudCwgbmFtZSkgPT4ge1xuICAgIHJldHVybiAnYWNjb3VudF8nICsgYWNjb3VudC5yb3dJRCArICdfJyArIG5hbWU7XG5cbiAgICBpZiAodGhpcy51c2VBY2NvdW50UHJlZml4KSB7XG4gICAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuICAgIH1cblxuICAgIHJldHVybiBuYW1lO1xuICB9XG5cbiAgb25TeW5jU3RhcnQgPSBhc3luYyAoe2FjY291bnQsIHRhc2tzfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcbiAgfVxuXG4gIG9uU3luY0ZpbmlzaCA9IGFzeW5jICh7YWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLmNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMuaW52b2tlQWZ0ZXJGdW5jdGlvbigpO1xuICB9XG5cbiAgb25Gb3JtU2F2ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybX0pID0+IHtcbiAgICBsb2coJ2Zvcm06c2F2ZScsIGZvcm0uaWQpO1xuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcbiAgfVxuXG4gIG9uRm9ybURlbGV0ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudH0pID0+IHtcbiAgICBjb25zdCBvbGRGb3JtID0ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG51bGwpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuICB9XG5cbiAgb25QaG90b1NhdmUgPSBhc3luYyAoe3Bob3RvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICB9XG5cbiAgb25WaWRlb1NhdmUgPSBhc3luYyAoe3ZpZGVvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVmlkZW8odmlkZW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25BdWRpb1NhdmUgPSBhc3luYyAoe2F1ZGlvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25TaWduYXR1cmVTYXZlID0gYXN5bmMgKHtzaWduYXR1cmUsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hhbmdlc2V0U2F2ZSA9IGFzeW5jICh7Y2hhbmdlc2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNob2ljZUxpc3RTYXZlID0gYXN5bmMgKHtjaG9pY2VMaXN0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hvaWNlTGlzdChjaG9pY2VMaXN0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2xhc3NpZmljYXRpb25TZXRTYXZlID0gYXN5bmMgKHtjbGFzc2lmaWNhdGlvblNldCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KGNsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUHJvamVjdFNhdmUgPSBhc3luYyAoe3Byb2plY3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQcm9qZWN0KHByb2plY3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25Sb2xlU2F2ZSA9IGFzeW5jICh7cm9sZSwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJvbGUocm9sZSwgYWNjb3VudCk7XG4gIH1cblxuICBvbk1lbWJlcnNoaXBTYXZlID0gYXN5bmMgKHttZW1iZXJzaGlwLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChtZW1iZXJzaGlwLCBhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVBob3RvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5waG90byhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFBob3RvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3Bob3RvcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlVmlkZW8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnZpZGVvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0VmlkZW9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAndmlkZW9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAuYXVkaW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRBdWRpb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdhdWRpbycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlU2lnbmF0dXJlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5zaWduYXR1cmUob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRTaWduYXR1cmVVUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAnc2lnbmF0dXJlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2hhbmdlc2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaGFuZ2VzZXQob2JqZWN0KSwgJ2NoYW5nZXNldHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnByb2plY3Qob2JqZWN0KSwgJ3Byb2plY3RzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5tZW1iZXJzaGlwKG9iamVjdCksICdtZW1iZXJzaGlwcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucm9sZShvYmplY3QpLCAncm9sZXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmZvcm0ob2JqZWN0KSwgJ2Zvcm1zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaG9pY2VMaXN0KG9iamVjdCksICdjaG9pY2VfbGlzdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jbGFzc2lmaWNhdGlvblNldChvYmplY3QpLCAnY2xhc3NpZmljYXRpb25fc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlT2JqZWN0KHZhbHVlcywgdGFibGUpIHtcbiAgICBjb25zdCBkZWxldGVTdGF0ZW1lbnQgPSB0aGlzLm1zc3FsLmRlbGV0ZVN0YXRlbWVudChgJHsgdGhpcy5kYXRhU2NoZW1hIH0uc3lzdGVtXyR7dGFibGV9YCwge3Jvd19yZXNvdXJjZV9pZDogdmFsdWVzLnJvd19yZXNvdXJjZV9pZH0pO1xuICAgIGNvbnN0IGluc2VydFN0YXRlbWVudCA9IHRoaXMubXNzcWwuaW5zZXJ0U3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB2YWx1ZXMsIHtwazogJ2lkJ30pO1xuXG4gICAgY29uc3Qgc3FsID0gWyBkZWxldGVTdGF0ZW1lbnQuc3FsLCBpbnNlcnRTdGF0ZW1lbnQuc3FsIF0uam9pbignXFxuJyk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oc3FsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgd2FybihgdXBkYXRlT2JqZWN0ICR7dGFibGV9IGZhaWxlZGApO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cbiAgfVxuXG4gIHJlbG9hZFRhYmxlTGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG4gIH1cblxuICByZWxvYWRWaWV3TGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy52aWV3U2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnZpZXdOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIGJhc2VNZWRpYVVSTCA9ICgpID0+IHtcbiAgfVxuXG4gIGZvcm1hdFBob3RvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy8keyBpZCB9LmpwZ2A7XG4gIH1cblxuICBmb3JtYXRWaWRlb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS92aWRlb3MvJHsgaWQgfS5tcDRgO1xuICB9XG5cbiAgZm9ybWF0QXVkaW9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vJHsgaWQgfS5tNGFgO1xuICB9XG5cbiAgZm9ybWF0U2lnbmF0dXJlVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3NpZ25hdHVyZXMvJHsgaWQgfS5wbmdgO1xuICB9XG5cbiAgaW50ZWdyaXR5V2FybmluZyhleCkge1xuICAgIHdhcm4oYFxuLS0tLS0tLS0tLS0tLVxuISEgV0FSTklORyAhIVxuLS0tLS0tLS0tLS0tLVxuXG5NU1NRTCBkYXRhYmFzZSBpbnRlZ3JpdHkgaXNzdWUgZW5jb3VudGVyZWQuIENvbW1vbiBzb3VyY2VzIG9mIGRhdGFiYXNlIGlzc3VlcyBhcmU6XG5cbiogUmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBhbmQgdXNpbmcgYW4gb2xkIE1TU1FMIGRhdGFiYXNlIHdpdGhvdXQgcmVjcmVhdGluZ1xuICB0aGUgTVNTUUwgZGF0YWJhc2UuXG4qIERlbGV0aW5nIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZSBhbmQgdXNpbmcgYW4gZXhpc3RpbmcgTVNTUUwgZGF0YWJhc2VcbiogTWFudWFsbHkgbW9kaWZ5aW5nIHRoZSBNU1NRTCBkYXRhYmFzZVxuKiBDcmVhdGluZyBtdWx0aXBsZSBhcHBzIGluIEZ1bGNydW0gd2l0aCB0aGUgc2FtZSBuYW1lLiBUaGlzIGlzIGdlbmVyYWxseSBPSywgZXhjZXB0XG4gIHlvdSB3aWxsIG5vdCBiZSBhYmxlIHRvIHVzZSB0aGUgXCJmcmllbmRseSB2aWV3XCIgZmVhdHVyZSBvZiB0aGUgTVNTUUwgcGx1Z2luIHNpbmNlXG4gIHRoZSB2aWV3IG5hbWVzIGFyZSBkZXJpdmVkIGZyb20gdGhlIGZvcm0gbmFtZXMuXG5cbk5vdGU6IFdoZW4gcmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBvciBcInN0YXJ0aW5nIG92ZXJcIiB5b3UgbmVlZCB0byBkcm9wIGFuZCByZS1jcmVhdGVcbnRoZSBNU1NRTCBkYXRhYmFzZS4gVGhlIG5hbWVzIG9mIGRhdGFiYXNlIG9iamVjdHMgYXJlIHRpZWQgZGlyZWN0bHkgdG8gdGhlIGRhdGFiYXNlXG5vYmplY3RzIGluIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZS5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5SZXBvcnQgaXNzdWVzIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9mdWxjcnVtYXBwL2Z1bGNydW0tZGVza3RvcC9pc3N1ZXNcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuTWVzc2FnZTpcbiR7IGV4Lm1lc3NhZ2UgfVxuXG5TdGFjazpcbiR7IGV4LnN0YWNrIH1cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuYC5yZWRcbiAgICApO1xuICB9XG5cbiAgc2V0dXBPcHRpb25zKCkge1xuICAgIHRoaXMuYmFzZU1lZGlhVVJMID0gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsID8gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsIDogJ2h0dHBzOi8vYXBpLmZ1bGNydW1hcHAuY29tL2FwaS92Mic7XG5cbiAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyA9IHtcbiAgICAgIHNjaGVtYTogdGhpcy5kYXRhU2NoZW1hLFxuXG4gICAgICBlc2NhcGVJZGVudGlmaWVyOiB0aGlzLmVzY2FwZUlkZW50aWZpZXIsXG5cbiAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcblxuICAgICAgcGVyc2lzdGVudFRhYmxlTmFtZXM6IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMsXG5cbiAgICAgIGFjY291bnRQcmVmaXg6IHRoaXMudXNlQWNjb3VudFByZWZpeCA/ICdhY2NvdW50XycgKyB0aGlzLmFjY291bnQucm93SUQgOiBudWxsLFxuXG4gICAgICBjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0OiAnZGF0ZScsXG5cbiAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IHRoaXMuZGlzYWJsZUNvbXBsZXhUeXBlcyxcblxuICAgICAgdmFsdWVzVHJhbnNmb3JtZXI6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS52YWx1ZXNUcmFuc2Zvcm1lcixcblxuICAgICAgbWVkaWFVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG5cbiAgICAgICAgcmV0dXJuIG1lZGlhVmFsdWUuaXRlbXMubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1Bob3RvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0UGhvdG9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0VmlkZW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0QXVkaW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBtZWRpYVZpZXdVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG4gICAgICAgIGNvbnN0IGlkcyA9IG1lZGlhVmFsdWUuaXRlbXMubWFwKG8gPT4gby5tZWRpYUlEKTtcblxuICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy92aWV3P3Bob3Rvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy92aWV3P3ZpZGVvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvL3ZpZXc/YXVkaW89JHsgaWRzIH1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZXBvcnRCYXNlVXJsKSB7XG4gICAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucy5yZXBvcnRVUkxGb3JtYXR0ZXIgPSAoZmVhdHVyZSkgPT4ge1xuICAgICAgICByZXR1cm4gYCR7IGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwgfS9yZXBvcnRzLyR7IGZlYXR1cmUuaWQgfS5wZGZgO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVSZWNvcmQgPSBhc3luYyAocmVjb3JkLCBhY2NvdW50LCBza2lwVGFibGVDaGVjaykgPT4ge1xuICAgIGlmICghc2tpcFRhYmxlQ2hlY2sgJiYgIXRoaXMucm9vdFRhYmxlRXhpc3RzKHJlY29yZC5mb3JtKSkge1xuICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShyZWNvcmQuZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZVJlY29yZCh7cmVjb3JkLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMudXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcblxuICAgIGNvbnN0IHN5c3RlbVZhbHVlcyA9IE1TU1FMUmVjb3JkVmFsdWVzLnN5c3RlbUNvbHVtblZhbHVlc0ZvckZlYXR1cmUocmVjb3JkLCBudWxsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yZWNvcmQocmVjb3JkLCBzeXN0ZW1WYWx1ZXMpLCAncmVjb3JkcycpO1xuICB9XG5cbiAgcm9vdFRhYmxlRXhpc3RzID0gKGZvcm0pID0+IHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU5hbWVzLmluZGV4T2YoTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSwgbnVsbCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpKSAhPT0gLTE7XG4gIH1cblxuICByZWNyZWF0ZUZvcm1UYWJsZXMgPSBhc3luYyAoZm9ybSwgYWNjb3VudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSwgbnVsbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgZXJyb3IoZXgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBudWxsLCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pKTtcbiAgfVxuXG4gIHVwZGF0ZUZvcm0gPSBhc3luYyAoZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSkgPT4ge1xuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSAmJiAhdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtKHtmb3JtLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgbG9nKCdVcGRhdGluZyBmb3JtJywgZm9ybS5pZCk7XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybU9iamVjdChmb3JtLCBhY2NvdW50KTtcblxuICAgICAgaWYgKCF0aGlzLnJvb3RUYWJsZUV4aXN0cyhmb3JtKSAmJiBuZXdGb3JtICE9IG51bGwpIHtcbiAgICAgICAgb2xkRm9ybSA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcbiAgICAgICAgZGlzYWJsZUNvbXBsZXhUeXBlczogZmFsc2UsXG4gICAgICAgIHVzZXJNb2R1bGU6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUsXG4gICAgICAgIHRhYmxlU2NoZW1hOiB0aGlzLmRhdGFTY2hlbWEsXG4gICAgICAgIGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQ6ICdkYXRlJyxcbiAgICAgICAgbWV0YWRhdGE6IHRydWUsXG4gICAgICAgIHVzZVJlc291cmNlSUQ6IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMsXG4gICAgICAgIGFjY291bnRQcmVmaXg6IHRoaXMudXNlQWNjb3VudFByZWZpeCA/ICdhY2NvdW50XycgKyB0aGlzLmFjY291bnQucm93SUQgOiBudWxsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCB7c3RhdGVtZW50c30gPSBhd2FpdCBNU1NRTFNjaGVtYS5nZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMoYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSwgb3B0aW9ucyk7XG5cbiAgICAgIGxvZygnRHJvcHBpbmcgdmlld3MnLCBmb3JtLmlkKTtcblxuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgIH1cblxuICAgICAgbG9nKCdSdW5uaW5nIHNjaGVtYSBzdGF0ZW1lbnRzJywgZm9ybS5pZCwgc3RhdGVtZW50cy5sZW5ndGgpO1xuXG4gICAgICBhd2FpdCB0aGlzLnJ1bkFsbFRyYW5zYWN0aW9uKHN0YXRlbWVudHMpO1xuXG4gICAgICBsb2coJ0NyZWF0aW5nIHZpZXdzJywgZm9ybS5pZCk7XG5cbiAgICAgIGlmIChuZXdGb3JtKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsb2coJ0NvbXBsZXRlZCBmb3JtIHVwZGF0ZScsIGZvcm0uaWQpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB3YXJuKCd1cGRhdGVGb3JtIGZhaWxlZCcpO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoXCJJRiBPQkpFQ1RfSUQoJyVzLiVzJywgJ1YnKSBJUyBOT1QgTlVMTCBEUk9QIFZJRVcgJXMuJXM7XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSkpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgd2FybignZHJvcEZyaWVuZGx5VmlldyBmYWlsZWQnKTtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdDUkVBVEUgVklFVyAlcy4lcyBBUyBTRUxFQ1QgKiBGUk9NICVzOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybUFuZFNjaGVtYShmb3JtLCByZXBlYXRhYmxlLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucywgJ192aWV3X2Z1bGwnKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgICAgd2FybignY3JlYXRlRnJpZW5kbHlWaWV3IGZhaWxlZCcpO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBnZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3QgbmFtZSA9IGNvbXBhY3QoW2Zvcm0ubmFtZSwgcmVwZWF0YWJsZSAmJiByZXBlYXRhYmxlLmRhdGFOYW1lXSkuam9pbignIC0gJylcblxuICAgIGNvbnN0IGZvcm1JRCA9IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMgPyBmb3JtLmlkIDogZm9ybS5yb3dJRDtcblxuICAgIGNvbnN0IHByZWZpeCA9IGNvbXBhY3QoWyd2aWV3JywgZm9ybUlELCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUua2V5XSkuam9pbignIC0gJyk7XG5cbiAgICBjb25zdCBvYmplY3ROYW1lID0gW3ByZWZpeCwgbmFtZV0uam9pbignIC0gJyk7XG5cbiAgICByZXR1cm4gdGhpcy50cmltSWRlbnRpZmllcihmdWxjcnVtLmFyZ3MubXNzcWxVbmRlcnNjb3JlTmFtZXMgIT09IGZhbHNlID8gc25ha2Uob2JqZWN0TmFtZSkgOiBvYmplY3ROYW1lKTtcbiAgfVxuXG4gIGFzeW5jIGludm9rZUJlZm9yZUZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxCZWZvcmVGdW5jdGlvbikge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdFWEVDVVRFICVzOycsIGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYmVmb3JlU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgaW52b2tlQWZ0ZXJGdW5jdGlvbigpIHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdFWEVDVVRFICVzOycsIGZ1bGNydW0uYXJncy5tc3NxbEFmdGVyRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMpIHtcbiAgICAgIGF3YWl0IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYWZ0ZXJTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgcHJvZ3Jlc3MpIHtcbiAgICBhd2FpdCB0aGlzLnJlY3JlYXRlRm9ybVRhYmxlcyhmb3JtLCBhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFRhYmxlTGlzdCgpO1xuXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIGF3YWl0IGZvcm0uZmluZEVhY2hSZWNvcmQoe30sIGFzeW5jIChyZWNvcmQpID0+IHtcbiAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcblxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcyhpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBwcm9ncmVzcyhpbmRleCk7XG4gIH1cblxuICBhc3luYyBjbGVhbnVwRnJpZW5kbHlWaWV3cyhhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRWaWV3TGlzdCgpO1xuXG4gICAgY29uc3QgYWN0aXZlVmlld05hbWVzID0gW107XG5cbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgYWN0aXZlVmlld05hbWVzLnB1c2godGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCBudWxsKSk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgYWN0aXZlVmlld05hbWVzLnB1c2godGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlID0gZGlmZmVyZW5jZSh0aGlzLnZpZXdOYW1lcywgYWN0aXZlVmlld05hbWVzKTtcblxuICAgIGZvciAoY29uc3Qgdmlld05hbWUgb2YgcmVtb3ZlKSB7XG4gICAgICBpZiAodmlld05hbWUuaW5kZXhPZigndmlld18nKSA9PT0gMCB8fCB2aWV3TmFtZS5pbmRleE9mKCd2aWV3IC0gJykgPT09IDApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoXCJJRiBPQkpFQ1RfSUQoJyVzLiVzJywgJ1YnKSBJUyBOT1QgTlVMTCBEUk9QIFZJRVcgJXMuJXM7XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgIHdhcm4oJ2NsZWFudXBGcmllbmRseVZpZXdzIGZhaWxlZCcpO1xuICAgICAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cblxuICB1cGRhdGVTdGF0dXMgPSAobWVzc2FnZSkgPT4ge1xuICAgIGlmIChwcm9jZXNzLnN0ZG91dC5pc1RUWSkge1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BTeXN0ZW1UYWJsZXMoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHRlbXBsYXRlRHJvcCkpO1xuICB9XG5cbiAgY3JlYXRlRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBDUkVBVEUgREFUQUJBU0UgJHtkYXRhYmFzZU5hbWV9O2ApO1xuICB9XG5cbiAgZHJvcERhdGFiYXNlKGRhdGFiYXNlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLnJ1bihgRFJPUCBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBhc3luYyBzZXR1cERhdGFiYXNlKCkge1xuICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdCh2ZXJzaW9uMDAxKSk7XG4gIH1cblxuICBwcmVwYXJlTWlncmF0aW9uU2NyaXB0KHNxbCkge1xuICAgIHJldHVybiBzcWwucmVwbGFjZSgvX19TQ0hFTUFfXy9nLCB0aGlzLmRhdGFTY2hlbWEpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9fX1ZJRVdfU0NIRU1BX18vZywgdGhpcy52aWV3U2NoZW1hKS5zcGxpdCgnOycpO1xuICB9XG5cbiAgYXN5bmMgc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCkge1xuICAgIGNvbnN0IHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gICAgfTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hQaG90byh7fSwgYXN5bmMgKHBob3RvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdQaG90b3MnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFZpZGVvKHt9LCBhc3luYyAodmlkZW8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1ZpZGVvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQXVkaW8oe30sIGFzeW5jIChhdWRpbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQXVkaW8nLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFNpZ25hdHVyZSh7fSwgYXN5bmMgKHNpZ25hdHVyZSwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnU2lnbmF0dXJlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDaGFuZ2VzZXQoe30sIGFzeW5jIChjaGFuZ2VzZXQsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NoYW5nZXNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUm9sZSh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUm9sZXMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFByb2plY3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Byb2plY3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hGb3JtKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdGb3JtcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoTWVtYmVyc2hpcCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnTWVtYmVyc2hpcHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENob2ljZUxpc3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Nob2ljZSBMaXN0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NsYXNzaWZpY2F0aW9uIFNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlSW5pdGlhbGl6ZSgpIHtcbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAodGhpcy50YWJsZU5hbWVzLmluZGV4T2YoJ21pZ3JhdGlvbnMnKSA9PT0gLTEpIHtcbiAgICAgIGxvZygnSW5pdGl0YWxpemluZyBkYXRhYmFzZS4uLicpO1xuXG4gICAgICBhd2FpdCB0aGlzLnNldHVwRGF0YWJhc2UoKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9ucyhhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlUnVuTWlncmF0aW9ucyhhY2NvdW50KSB7XG4gICAgdGhpcy5taWdyYXRpb25zID0gKGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgbmFtZSBGUk9NICR7IHRoaXMuZGF0YVNjaGVtYSB9Lm1pZ3JhdGlvbnNgKSkubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIGxldCBwb3B1bGF0ZVJlY29yZHMgPSBmYWxzZTtcblxuICAgIGZvciAobGV0IGNvdW50ID0gMjsgY291bnQgPD0gQ1VSUkVOVF9WRVJTSU9OOyArK2NvdW50KSB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gcGFkU3RhcnQoY291bnQsIDMsICcwJyk7XG5cbiAgICAgIGNvbnN0IG5lZWRzTWlncmF0aW9uID0gdGhpcy5taWdyYXRpb25zLmluZGV4T2YodmVyc2lvbikgPT09IC0xICYmIE1JR1JBVElPTlNbdmVyc2lvbl07XG5cbiAgICAgIGlmIChuZWVkc01pZ3JhdGlvbikge1xuICAgICAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQoTUlHUkFUSU9OU1t2ZXJzaW9uXSkpO1xuXG4gICAgICAgIGlmICh2ZXJzaW9uID09PSAnMDAyJykge1xuICAgICAgICAgIGxvZygnUG9wdWxhdGluZyBzeXN0ZW0gdGFibGVzLi4uJyk7XG4gICAgICAgICAgcG9wdWxhdGVSZWNvcmRzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2ZXJzaW9uID09PSAnMDA1Jykge1xuICAgICAgICAgIGxvZygnTWlncmF0aW5nIGRhdGUgY2FsY3VsYXRpb24gZmllbGRzLi4uJyk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5taWdyYXRlQ2FsY3VsYXRlZEZpZWxkc0RhdGVGb3JtYXQoYWNjb3VudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9wdWxhdGVSZWNvcmRzKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvcHVsYXRlUmVjb3JkcyhhY2NvdW50KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBwb3B1bGF0ZVJlY29yZHMoYWNjb3VudCkge1xuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgaW5kZXggPSAwO1xuXG4gICAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcblxuICAgICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5wcm9ncmVzcyhmb3JtLm5hbWUsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0KGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgY29uc3QgZmllbGRzID0gZm9ybS5lbGVtZW50c09mVHlwZSgnQ2FsY3VsYXRlZEZpZWxkJykuZmlsdGVyKGVsZW1lbnQgPT4gZWxlbWVudC5kaXNwbGF5LmlzRGF0ZSk7XG5cbiAgICAgIGlmIChmaWVsZHMubGVuZ3RoKSB7XG4gICAgICAgIGxvZygnTWlncmF0aW5nIGRhdGUgY2FsY3VsYXRpb24gZmllbGRzIGluIGZvcm0uLi4nLCBmb3JtLm5hbWUpO1xuXG4gICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgdGhpcy51cGRhdGVTdGF0dXMobmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQpO1xuICB9XG59XG4iXX0=