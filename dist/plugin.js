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

        const results = [];

        try {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJDVVJSRU5UX1ZFUlNJT04iLCJERUZBVUxUX1NDSEVNQSIsImxvZyIsIndhcm4iLCJlcnJvciIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJydW5BbGxUcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb24iLCJiZWdpbiIsIlJlcXVlc3QiLCJxdWVyeSIsImNvbW1pdCIsImV4Iiwicm9sbGJhY2siLCJ0YWJsZU5hbWUiLCJyb3dJRCIsInVzZUFjY291bnRQcmVmaXgiLCJvblN5bmNTdGFydCIsInRhc2tzIiwib25TeW5jRmluaXNoIiwiY2xlYW51cEZyaWVuZGx5Vmlld3MiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwic2hvdWxkVXBkYXRlRm9ybSIsInVwZGF0ZUZvcm1PYmplY3QiLCJvcHRpb25zIiwiZGlzYWJsZUFycmF5cyIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJ1c2VyTW9kdWxlIiwidGFibGVTY2hlbWEiLCJjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0IiwibWV0YWRhdGEiLCJ1c2VSZXNvdXJjZUlEIiwicGVyc2lzdGVudFRhYmxlTmFtZXMiLCJhY2NvdW50UHJlZml4IiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZHJvcEZyaWVuZGx5VmlldyIsInJlcGVhdGFibGUiLCJlbGVtZW50c09mVHlwZSIsImxlbmd0aCIsImNyZWF0ZUZyaWVuZGx5VmlldyIsImludGVncml0eVdhcm5pbmciLCJtZXNzYWdlIiwicHJvY2VzcyIsInN0ZG91dCIsImlzVFRZIiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsInByb2dyZXNzIiwidGFzayIsImNsaSIsImNvbW1hbmQiLCJkZXNjIiwiYnVpbGRlciIsIm1zc3FsQ29ubmVjdGlvblN0cmluZyIsInR5cGUiLCJtc3NxbERhdGFiYXNlIiwiZGVmYXVsdCIsIm1zc3FsSG9zdCIsImhvc3QiLCJtc3NxbFBvcnQiLCJtc3NxbFVzZXIiLCJtc3NxbFBhc3N3b3JkIiwibXNzcWxTY2hlbWEiLCJtc3NxbFNjaGVtYVZpZXdzIiwibXNzcWxTeW5jRXZlbnRzIiwibXNzcWxCZWZvcmVGdW5jdGlvbiIsIm1zc3FsQWZ0ZXJGdW5jdGlvbiIsInJlcXVpcmVkIiwibXNzcWxSZXBvcnRCYXNlVXJsIiwibXNzcWxNZWRpYUJhc2VVcmwiLCJtc3NxbFVuZGVyc2NvcmVOYW1lcyIsIm1zc3FsUGVyc2lzdGVudFRhYmxlTmFtZXMiLCJtc3NxbFByZWZpeCIsImhhbmRsZXIiLCJzdWJzdHJpbmciLCJ1c2VTeW5jRXZlbnRzIiwidXNlciIsInBhc3N3b3JkIiwicmVxdWlyZSIsImFwcCIsImNvbm5lY3QiLCJvbiIsInNldHVwT3B0aW9ucyIsIm1heWJlSW5pdGlhbGl6ZSIsImRlYWN0aXZhdGUiLCJjbG9zZSIsIm9iamVjdCIsInZhbHVlcyIsImZpbGUiLCJhY2Nlc3Nfa2V5IiwidGFibGUiLCJkZWxldGVTdGF0ZW1lbnQiLCJyb3dfcmVzb3VyY2VfaWQiLCJpbnNlcnRTdGF0ZW1lbnQiLCJwayIsInN0YWNrIiwic2NoZW1hIiwidmFsdWVzVHJhbnNmb3JtZXIiLCJtZWRpYVVSTEZvcm1hdHRlciIsIm1lZGlhVmFsdWUiLCJpdGVtcyIsIml0ZW0iLCJlbGVtZW50IiwiaXNQaG90b0VsZW1lbnQiLCJtZWRpYUlEIiwiaXNWaWRlb0VsZW1lbnQiLCJpc0F1ZGlvRWxlbWVudCIsIm1lZGlhVmlld1VSTEZvcm1hdHRlciIsImlkcyIsInJlcG9ydFVSTEZvcm1hdHRlciIsImZlYXR1cmUiLCJ2aWV3TmFtZSIsImdldEZyaWVuZGx5VGFibGVOYW1lIiwidGFibGVOYW1lV2l0aEZvcm1BbmRTY2hlbWEiLCJkYXRhTmFtZSIsImZvcm1JRCIsInByZWZpeCIsImtleSIsIm9iamVjdE5hbWUiLCJiZWZvcmVTeW5jIiwiYWZ0ZXJTeW5jIiwiZmluZEVhY2hSZWNvcmQiLCJhY3RpdmVWaWV3TmFtZXMiLCJyZW1vdmUiLCJwcmVwYXJlTWlncmF0aW9uU2NyaXB0IiwiZGF0YWJhc2VOYW1lIiwic3BsaXQiLCJmaW5kRWFjaFBob3RvIiwiZmluZEVhY2hWaWRlbyIsImZpbmRFYWNoQXVkaW8iLCJmaW5kRWFjaFNpZ25hdHVyZSIsImZpbmRFYWNoQ2hhbmdlc2V0IiwiZmluZEVhY2hSb2xlIiwiZmluZEVhY2hQcm9qZWN0IiwiZmluZEVhY2hGb3JtIiwiZmluZEVhY2hNZW1iZXJzaGlwIiwiZmluZEVhY2hDaG9pY2VMaXN0IiwiZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCIsIm1heWJlUnVuTWlncmF0aW9ucyIsIm1pZ3JhdGlvbnMiLCJwb3B1bGF0ZVJlY29yZHMiLCJjb3VudCIsInZlcnNpb24iLCJuZWVkc01pZ3JhdGlvbiIsIm1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdCIsImZpZWxkcyIsImZpbHRlciIsImRpc3BsYXkiLCJpc0RhdGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOztJQUtZQSxHOztBQUpaOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBRUE7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7Ozs7O0FBRUEsTUFBTUMsd0JBQXdCLEdBQTlCOztBQUVBLE1BQU1DLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsVUFBUSxXQUZXO0FBR25CQyxRQUFNLElBSGE7QUFJbkJDLE9BQUssRUFKYztBQUtuQkMscUJBQW1CO0FBTEEsQ0FBckI7O0FBUUEsTUFBTUMsYUFBYTtBQUNqQiwwQkFEaUI7QUFFakIsMEJBRmlCO0FBR2pCLDBCQUhpQjtBQUlqQiwyQkFKaUI7QUFLakI7QUFMaUIsQ0FBbkI7O0FBUUEsTUFBTUMsa0JBQWtCLENBQXhCOztBQUVBLE1BQU1DLGlCQUFpQixLQUF2Qjs7QUFFQSxNQUFNLEVBQUVDLEdBQUYsRUFBT0MsSUFBUCxFQUFhQyxLQUFiLEtBQXVCQyxRQUFRQyxNQUFSLENBQWVDLFdB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QixFQUEwQjtBQUN4QlEsZ0JBQVEsQ0FBUjs7QUFFQSxjQUFNTixLQUFLNE4sY0FBTCxDQUFvQixFQUFwQjtBQUFBLHlDQUF3QixXQUFPbEssTUFBUCxFQUFrQjtBQUM5Q0EsbUJBQU8xRCxJQUFQLEdBQWNBLElBQWQ7O0FBRUEsZ0JBQUksRUFBRU0sS0FBRixHQUFVLEVBQVYsS0FBaUIsQ0FBckIsRUFBd0I7QUFDdEIsc0JBQUs0SSxRQUFMLENBQWNsSixLQUFLUSxJQUFuQixFQUF5QkYsS0FBekI7QUFDRDs7QUFFRCxrQkFBTSxRQUFLcUQsWUFBTCxDQUFrQkQsTUFBbEIsRUFBMEJsRSxPQUExQixFQUFtQyxLQUFuQyxDQUFOO0FBQ0QsV0FSSzs7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUFOO0FBU0Q7QUFqQjRCO0FBa0I5Qjs7QUFFSzJQLG1DQUFOLENBQXdDM1AsT0FBeEMsRUFBaUQ7QUFBQTs7QUFBQTtBQUMvQyxZQUFNTSxRQUFRLE1BQU1OLFFBQVFPLGVBQVIsQ0FBd0IsRUFBeEIsQ0FBcEI7O0FBRUEsV0FBSyxNQUFNQyxJQUFYLElBQW1CRixLQUFuQixFQUEwQjtBQUN4QixjQUFNc1AsU0FBU3BQLEtBQUt1SSxjQUFMLENBQW9CLGlCQUFwQixFQUF1QzhHLE1BQXZDLENBQThDO0FBQUEsaUJBQVc1QyxRQUFRNkMsT0FBUixDQUFnQkMsTUFBM0I7QUFBQSxTQUE5QyxDQUFmOztBQUVBLFlBQUlILE9BQU81RyxNQUFYLEVBQW1CO0FBQ2pCakssY0FBSSw4Q0FBSixFQUFvRHlCLEtBQUtRLElBQXpEOztBQUVBLGdCQUFNLFFBQUtILFdBQUwsQ0FBaUJMLElBQWpCLEVBQXVCUixPQUF2QixFQUFnQyxZQUFNLENBQUUsQ0FBeEMsQ0FBTjtBQUNEO0FBQ0Y7QUFYOEM7QUFZaEQ7O0FBN2dDa0IsQyIsImZpbGUiOiJwbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbXNzcWwgZnJvbSAnbXNzcWwnO1xuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgTVNTUUxTY2hlbWEgZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgTVNTUUwgfSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCBNU1NRTFJlY29yZFZhbHVlcyBmcm9tICcuL21zc3FsLXJlY29yZC12YWx1ZXMnXG5pbXBvcnQgc25ha2UgZnJvbSAnc25ha2UtY2FzZSc7XG5pbXBvcnQgdGVtcGxhdGVEcm9wIGZyb20gJy4vdGVtcGxhdGUuZHJvcC5zcWwnO1xuaW1wb3J0IFNjaGVtYU1hcCBmcm9tICcuL3NjaGVtYS1tYXAnO1xuaW1wb3J0ICogYXMgYXBpIGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IHsgY29tcGFjdCwgZGlmZmVyZW5jZSwgcGFkU3RhcnQgfSBmcm9tICdsb2Rhc2gnO1xuXG5pbXBvcnQgdmVyc2lvbjAwMSBmcm9tICcuL3ZlcnNpb24tMDAxLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMiBmcm9tICcuL3ZlcnNpb24tMDAyLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMyBmcm9tICcuL3ZlcnNpb24tMDAzLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNCBmcm9tICcuL3ZlcnNpb24tMDA0LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNSBmcm9tICcuL3ZlcnNpb24tMDA1LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNiBmcm9tICcuL3ZlcnNpb24tMDA2LnNxbCc7XG5cbmNvbnN0IE1BWF9JREVOVElGSUVSX0xFTkdUSCA9IDEwMDtcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBzZXJ2ZXI6ICdsb2NhbGhvc3QnLFxuICBwb3J0OiAxNDMzLFxuICBtYXg6IDEwLFxuICBpZGxlVGltZW91dE1pbGxpczogMzAwMDBcbn07XG5cbmNvbnN0IE1JR1JBVElPTlMgPSB7XG4gICcwMDInOiB2ZXJzaW9uMDAyLFxuICAnMDAzJzogdmVyc2lvbjAwMyxcbiAgJzAwNCc6IHZlcnNpb24wMDQsXG4gICcwMDUnOiB2ZXJzaW9uMDA1LFxuICAnMDA2JzogdmVyc2lvbjAwNlxufTtcblxuY29uc3QgQ1VSUkVOVF9WRVJTSU9OID0gNjtcblxuY29uc3QgREVGQVVMVF9TQ0hFTUEgPSAnZGJvJztcblxuY29uc3QgeyBsb2csIHdhcm4sIGVycm9yIH0gPSBmdWxjcnVtLmxvZ2dlci53aXRoQ29udGV4dCgnbXNzcWwnKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAnbXNzcWwnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgbXNzcWwgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBtc3NxbENvbm5lY3Rpb25TdHJpbmc6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgY29ubmVjdGlvbiBzdHJpbmcgKG92ZXJyaWRlcyBhbGwgaW5kaXZpZHVhbCBkYXRhYmFzZSBjb25uZWN0aW9uIHBhcmFtZXRlcnMpJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbERhdGFiYXNlOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGRhdGFiYXNlIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5kYXRhYmFzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEhvc3Q6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIGhvc3QnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5ob3N0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUG9ydDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgcG9ydCcsXG4gICAgICAgICAgdHlwZTogJ2ludGVnZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5wb3J0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsVXNlcjoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCB1c2VyJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBhc3N3b3JkOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHBhc3N3b3JkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNjaGVtYToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2NoZW1hVmlld3M6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hIGZvciB0aGUgZnJpZW5kbHkgdmlld3MnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3luY0V2ZW50czoge1xuICAgICAgICAgIGRlc2M6ICdhZGQgc3luYyBldmVudCBob29rcycsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxCZWZvcmVGdW5jdGlvbjoge1xuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYmVmb3JlIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbEFmdGVyRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGFmdGVyIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRm9ybToge1xuICAgICAgICAgIGRlc2M6ICd0aGUgZm9ybSBJRCB0byByZWJ1aWxkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlcG9ydEJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAncmVwb3J0IFVSTCBiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbE1lZGlhQmFzZVVybDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxVbmRlcnNjb3JlTmFtZXM6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHVuZGVyc2NvcmUgbmFtZXMgKGUuZy4gXCJQYXJrIEluc3BlY3Rpb25zXCIgYmVjb21lcyBcInBhcmtfaW5zcGVjdGlvbnNcIiknLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgc2VydmVyIGlkIGluIHRoZSBmb3JtIHRhYmxlIG5hbWVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUHJlZml4OiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgb3JnYW5pemF0aW9uIElEIGFzIGEgcHJlZml4IGluIHRoZSBvYmplY3QgbmFtZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlYnVpbGRWaWV3c09ubHk6IHtcbiAgICAgICAgICBkZXNjOiAnb25seSByZWJ1aWxkIHRoZSB2aWV3cycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEN1c3RvbU1vZHVsZToge1xuICAgICAgICAgIGRlc2M6ICdhIGN1c3RvbSBtb2R1bGUgdG8gbG9hZCB3aXRoIHN5bmMgZXh0ZW5zaW9ucyAoZXhwZXJpbWVudGFsKScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2V0dXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2V0dXAgdGhlIGRhdGFiYXNlJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRHJvcDoge1xuICAgICAgICAgIGRlc2M6ICdkcm9wIHRoZSBzeXN0ZW0gdGFibGVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3lzdGVtVGFibGVzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IGNyZWF0ZSB0aGUgc3lzdGVtIHJlY29yZHMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcERhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbERyb3ApIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcFN5c3RlbVRhYmxlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTZXR1cCkge1xuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTeXN0ZW1UYWJsZXNPbmx5KSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuXG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxGb3JtICYmIGZvcm0uaWQgIT09IGZ1bGNydW0uYXJncy5tc3NxbEZvcm0pIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZWJ1aWxkVmlld3NPbmx5KSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIChpbmRleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoZm9ybS5uYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCArICcgcmVjb3JkcycpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nKCcnKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgdHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikge1xuICAgIHJldHVybiBpZGVudGlmaWVyLnN1YnN0cmluZygwLCBNQVhfSURFTlRJRklFUl9MRU5HVEgpO1xuICB9XG5cbiAgZXNjYXBlSWRlbnRpZmllciA9IChpZGVudGlmaWVyKSA9PiB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIgJiYgdGhpcy5tc3NxbC5pZGVudCh0aGlzLnRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcbiAgfVxuXG4gIGdldCB1c2VTeW5jRXZlbnRzKCkge1xuICAgIHJldHVybiBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzICE9IG51bGwgPyBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzIDogdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIHRoaXMuYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zc3FsSG9zdCB8fCBNU1NRTF9DT05GSUcuc2VydmVyLFxuICAgICAgcG9ydDogZnVsY3J1bS5hcmdzLm1zc3FsUG9ydCB8fCBNU1NRTF9DT05GSUcucG9ydCxcbiAgICAgIGRhdGFiYXNlOiBmdWxjcnVtLmFyZ3MubXNzcWxEYXRhYmFzZSB8fCBNU1NRTF9DT05GSUcuZGF0YWJhc2UsXG4gICAgICB1c2VyOiBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyIHx8IE1TU1FMX0NPTkZJRy51c2VyLFxuICAgICAgcGFzc3dvcmQ6IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkIHx8IE1TU1FMX0NPTkZJRy51c2VyXG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxVc2VyKSB7XG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCkge1xuICAgICAgb3B0aW9ucy5wYXNzd29yZCA9IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpIHtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgPSByZXF1aXJlKGZ1bGNydW0uYXJncy5tc3NxbEN1c3RvbU1vZHVsZSk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwaSA9IGFwaTtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYXBwID0gZnVsY3J1bTtcbiAgICB9XG5cbiAgICB0aGlzLmRpc2FibGVBcnJheXMgPSBmYWxzZTtcbiAgICB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMgPSB0cnVlO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzID09PSB0cnVlKSB7XG4gICAgICB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLnVzZUFjY291bnRQcmVmaXggPSAoZnVsY3J1bS5hcmdzLm1zc3FsUHJlZml4ICE9PSBmYWxzZSk7XG5cbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KGZ1bGNydW0uYXJncy5tc3NxbENvbm5lY3Rpb25TdHJpbmcgfHwgb3B0aW9ucyk7XG5cbiAgICBpZiAodGhpcy51c2VTeW5jRXZlbnRzKSB7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOnN0YXJ0JywgdGhpcy5vblN5bmNTdGFydCk7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOmZpbmlzaCcsIHRoaXMub25TeW5jRmluaXNoKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Bob3RvOnNhdmUnLCB0aGlzLm9uUGhvdG9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3ZpZGVvOnNhdmUnLCB0aGlzLm9uVmlkZW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2F1ZGlvOnNhdmUnLCB0aGlzLm9uQXVkaW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3NpZ25hdHVyZTpzYXZlJywgdGhpcy5vblNpZ25hdHVyZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hhbmdlc2V0OnNhdmUnLCB0aGlzLm9uQ2hhbmdlc2V0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6c2F2ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpkZWxldGUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdmb3JtOnNhdmUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignZm9ybTpkZWxldGUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbi1zZXQ6c2F2ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OmRlbGV0ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdyb2xlOnNhdmUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncm9sZTpkZWxldGUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdwcm9qZWN0OnNhdmUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpkZWxldGUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdtZW1iZXJzaGlwOnNhdmUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpkZWxldGUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgIH1cblxuICAgIHRoaXMudmlld1NjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYVZpZXdzIHx8IERFRkFVTFRfU0NIRU1BO1xuICAgIHRoaXMuZGF0YVNjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYSB8fCBERUZBVUxUX1NDSEVNQTtcblxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcbiAgICAvLyBjcmVhdGlvbiBvZiBuZXcgdGFibGVzIGV2ZW4gd2hlbiB0aGUgZm9ybSBpc24ndCB2ZXJzaW9uIDEuIElmIHRoZSB0YWJsZSBkb2Vzbid0XG4gICAgLy8gZXhpc3QsIHdlIGNhbiBwcmV0ZW5kIHRoZSBmb3JtIGlzIHZlcnNpb24gMSBzbyBpdCBjcmVhdGVzIGFsbCBuZXcgdGFibGVzIGluc3RlYWRcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIC8vIG1ha2UgYSBjbGllbnQgc28gd2UgY2FuIHVzZSBpdCB0byBidWlsZCBTUUwgc3RhdGVtZW50c1xuICAgIHRoaXMubXNzcWwgPSBuZXcgTVNTUUwoe30pO1xuXG4gICAgdGhpcy5zZXR1cE9wdGlvbnMoKTtcblxuICAgIGF3YWl0IHRoaXMubWF5YmVJbml0aWFsaXplKCk7XG4gIH1cblxuICBhc3luYyBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLnBvb2wpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJ1biA9IGFzeW5jIChzcWwpID0+IHtcbiAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFwwL2csICcnKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgIGxvZyhzcWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucG9vbC5yZXF1ZXN0KCkuYmF0Y2goc3FsKTtcblxuICAgIHJldHVybiByZXN1bHQucmVjb3Jkc2V0O1xuICB9XG5cbiAgcnVuQWxsID0gYXN5bmMgKHN0YXRlbWVudHMpID0+IHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICByZXN1bHRzLnB1c2goYXdhaXQgdGhpcy5ydW4oc3FsKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBydW5BbGxUcmFuc2FjdGlvbiA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XG4gICAgY29uc3QgdHJhbnNhY3Rpb24gPSBuZXcgbXNzcWwuVHJhbnNhY3Rpb24odGhpcy5wb29sKTtcblxuICAgIGF3YWl0IHRyYW5zYWN0aW9uLmJlZ2luKCk7XG5cbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICB0cnkge1xuICAgICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gbmV3IG1zc3FsLlJlcXVlc3QodHJhbnNhY3Rpb24pO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3QucXVlcnkoc3FsKTtcblxuICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdHJhbnNhY3Rpb24uY29tbWl0KCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGF3YWl0IHRyYW5zYWN0aW9uLnJvbGxiYWNrKCk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIGxvZyA9ICguLi5hcmdzKSA9PiB7XG4gICAgLy8gY29uc29sZS5sb2coLi4uYXJncyk7XG4gIH1cblxuICB0YWJsZU5hbWUgPSAoYWNjb3VudCwgbmFtZSkgPT4ge1xuICAgIHJldHVybiAnYWNjb3VudF8nICsgYWNjb3VudC5yb3dJRCArICdfJyArIG5hbWU7XG5cbiAgICBpZiAodGhpcy51c2VBY2NvdW50UHJlZml4KSB7XG4gICAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuICAgIH1cblxuICAgIHJldHVybiBuYW1lO1xuICB9XG5cbiAgb25TeW5jU3RhcnQgPSBhc3luYyAoe2FjY291bnQsIHRhc2tzfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcbiAgfVxuXG4gIG9uU3luY0ZpbmlzaCA9IGFzeW5jICh7YWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLmNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMuaW52b2tlQWZ0ZXJGdW5jdGlvbigpO1xuICB9XG5cbiAgb25Gb3JtU2F2ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybX0pID0+IHtcbiAgICBsb2coJ2Zvcm06c2F2ZScsIGZvcm0uaWQpO1xuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcbiAgfVxuXG4gIG9uRm9ybURlbGV0ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudH0pID0+IHtcbiAgICBjb25zdCBvbGRGb3JtID0ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG51bGwpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuICB9XG5cbiAgb25QaG90b1NhdmUgPSBhc3luYyAoe3Bob3RvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICB9XG5cbiAgb25WaWRlb1NhdmUgPSBhc3luYyAoe3ZpZGVvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVmlkZW8odmlkZW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25BdWRpb1NhdmUgPSBhc3luYyAoe2F1ZGlvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25TaWduYXR1cmVTYXZlID0gYXN5bmMgKHtzaWduYXR1cmUsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hhbmdlc2V0U2F2ZSA9IGFzeW5jICh7Y2hhbmdlc2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNob2ljZUxpc3RTYXZlID0gYXN5bmMgKHtjaG9pY2VMaXN0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hvaWNlTGlzdChjaG9pY2VMaXN0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2xhc3NpZmljYXRpb25TZXRTYXZlID0gYXN5bmMgKHtjbGFzc2lmaWNhdGlvblNldCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KGNsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUHJvamVjdFNhdmUgPSBhc3luYyAoe3Byb2plY3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQcm9qZWN0KHByb2plY3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25Sb2xlU2F2ZSA9IGFzeW5jICh7cm9sZSwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJvbGUocm9sZSwgYWNjb3VudCk7XG4gIH1cblxuICBvbk1lbWJlcnNoaXBTYXZlID0gYXN5bmMgKHttZW1iZXJzaGlwLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChtZW1iZXJzaGlwLCBhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVBob3RvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5waG90byhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFBob3RvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3Bob3RvcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlVmlkZW8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnZpZGVvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0VmlkZW9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAndmlkZW9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAuYXVkaW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRBdWRpb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdhdWRpbycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlU2lnbmF0dXJlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5zaWduYXR1cmUob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRTaWduYXR1cmVVUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAnc2lnbmF0dXJlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2hhbmdlc2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaGFuZ2VzZXQob2JqZWN0KSwgJ2NoYW5nZXNldHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnByb2plY3Qob2JqZWN0KSwgJ3Byb2plY3RzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5tZW1iZXJzaGlwKG9iamVjdCksICdtZW1iZXJzaGlwcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucm9sZShvYmplY3QpLCAncm9sZXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmZvcm0ob2JqZWN0KSwgJ2Zvcm1zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaG9pY2VMaXN0KG9iamVjdCksICdjaG9pY2VfbGlzdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jbGFzc2lmaWNhdGlvblNldChvYmplY3QpLCAnY2xhc3NpZmljYXRpb25fc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlT2JqZWN0KHZhbHVlcywgdGFibGUpIHtcbiAgICBjb25zdCBkZWxldGVTdGF0ZW1lbnQgPSB0aGlzLm1zc3FsLmRlbGV0ZVN0YXRlbWVudChgJHsgdGhpcy5kYXRhU2NoZW1hIH0uc3lzdGVtXyR7dGFibGV9YCwge3Jvd19yZXNvdXJjZV9pZDogdmFsdWVzLnJvd19yZXNvdXJjZV9pZH0pO1xuICAgIGNvbnN0IGluc2VydFN0YXRlbWVudCA9IHRoaXMubXNzcWwuaW5zZXJ0U3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB2YWx1ZXMsIHtwazogJ2lkJ30pO1xuXG4gICAgY29uc3Qgc3FsID0gWyBkZWxldGVTdGF0ZW1lbnQuc3FsLCBpbnNlcnRTdGF0ZW1lbnQuc3FsIF0uam9pbignXFxuJyk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oc3FsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgd2FybihgdXBkYXRlT2JqZWN0ICR7dGFibGV9IGZhaWxlZGApO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cbiAgfVxuXG4gIHJlbG9hZFRhYmxlTGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG4gIH1cblxuICByZWxvYWRWaWV3TGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy52aWV3U2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnZpZXdOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIGJhc2VNZWRpYVVSTCA9ICgpID0+IHtcbiAgfVxuXG4gIGZvcm1hdFBob3RvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy8keyBpZCB9LmpwZ2A7XG4gIH1cblxuICBmb3JtYXRWaWRlb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS92aWRlb3MvJHsgaWQgfS5tcDRgO1xuICB9XG5cbiAgZm9ybWF0QXVkaW9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vJHsgaWQgfS5tNGFgO1xuICB9XG5cbiAgZm9ybWF0U2lnbmF0dXJlVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3NpZ25hdHVyZXMvJHsgaWQgfS5wbmdgO1xuICB9XG5cbiAgaW50ZWdyaXR5V2FybmluZyhleCkge1xuICAgIHdhcm4oYFxuLS0tLS0tLS0tLS0tLVxuISEgV0FSTklORyAhIVxuLS0tLS0tLS0tLS0tLVxuXG5NU1NRTCBkYXRhYmFzZSBpbnRlZ3JpdHkgaXNzdWUgZW5jb3VudGVyZWQuIENvbW1vbiBzb3VyY2VzIG9mIGRhdGFiYXNlIGlzc3VlcyBhcmU6XG5cbiogUmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBhbmQgdXNpbmcgYW4gb2xkIE1TU1FMIGRhdGFiYXNlIHdpdGhvdXQgcmVjcmVhdGluZ1xuICB0aGUgTVNTUUwgZGF0YWJhc2UuXG4qIERlbGV0aW5nIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZSBhbmQgdXNpbmcgYW4gZXhpc3RpbmcgTVNTUUwgZGF0YWJhc2VcbiogTWFudWFsbHkgbW9kaWZ5aW5nIHRoZSBNU1NRTCBkYXRhYmFzZVxuKiBDcmVhdGluZyBtdWx0aXBsZSBhcHBzIGluIEZ1bGNydW0gd2l0aCB0aGUgc2FtZSBuYW1lLiBUaGlzIGlzIGdlbmVyYWxseSBPSywgZXhjZXB0XG4gIHlvdSB3aWxsIG5vdCBiZSBhYmxlIHRvIHVzZSB0aGUgXCJmcmllbmRseSB2aWV3XCIgZmVhdHVyZSBvZiB0aGUgTVNTUUwgcGx1Z2luIHNpbmNlXG4gIHRoZSB2aWV3IG5hbWVzIGFyZSBkZXJpdmVkIGZyb20gdGhlIGZvcm0gbmFtZXMuXG5cbk5vdGU6IFdoZW4gcmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBvciBcInN0YXJ0aW5nIG92ZXJcIiB5b3UgbmVlZCB0byBkcm9wIGFuZCByZS1jcmVhdGVcbnRoZSBNU1NRTCBkYXRhYmFzZS4gVGhlIG5hbWVzIG9mIGRhdGFiYXNlIG9iamVjdHMgYXJlIHRpZWQgZGlyZWN0bHkgdG8gdGhlIGRhdGFiYXNlXG5vYmplY3RzIGluIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZS5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5SZXBvcnQgaXNzdWVzIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9mdWxjcnVtYXBwL2Z1bGNydW0tZGVza3RvcC9pc3N1ZXNcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuTWVzc2FnZTpcbiR7IGV4Lm1lc3NhZ2UgfVxuXG5TdGFjazpcbiR7IGV4LnN0YWNrIH1cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuYC5yZWRcbiAgICApO1xuICB9XG5cbiAgc2V0dXBPcHRpb25zKCkge1xuICAgIHRoaXMuYmFzZU1lZGlhVVJMID0gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsID8gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsIDogJ2h0dHBzOi8vYXBpLmZ1bGNydW1hcHAuY29tL2FwaS92Mic7XG5cbiAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyA9IHtcbiAgICAgIHNjaGVtYTogdGhpcy5kYXRhU2NoZW1hLFxuXG4gICAgICBlc2NhcGVJZGVudGlmaWVyOiB0aGlzLmVzY2FwZUlkZW50aWZpZXIsXG5cbiAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcblxuICAgICAgcGVyc2lzdGVudFRhYmxlTmFtZXM6IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMsXG5cbiAgICAgIGFjY291bnRQcmVmaXg6IHRoaXMudXNlQWNjb3VudFByZWZpeCA/ICdhY2NvdW50XycgKyB0aGlzLmFjY291bnQucm93SUQgOiBudWxsLFxuXG4gICAgICBjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0OiAnZGF0ZScsXG5cbiAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IHRoaXMuZGlzYWJsZUNvbXBsZXhUeXBlcyxcblxuICAgICAgdmFsdWVzVHJhbnNmb3JtZXI6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS52YWx1ZXNUcmFuc2Zvcm1lcixcblxuICAgICAgbWVkaWFVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG5cbiAgICAgICAgcmV0dXJuIG1lZGlhVmFsdWUuaXRlbXMubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1Bob3RvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0UGhvdG9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0VmlkZW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0QXVkaW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBtZWRpYVZpZXdVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG4gICAgICAgIGNvbnN0IGlkcyA9IG1lZGlhVmFsdWUuaXRlbXMubWFwKG8gPT4gby5tZWRpYUlEKTtcblxuICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy92aWV3P3Bob3Rvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy92aWV3P3ZpZGVvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvL3ZpZXc/YXVkaW89JHsgaWRzIH1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZXBvcnRCYXNlVXJsKSB7XG4gICAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucy5yZXBvcnRVUkxGb3JtYXR0ZXIgPSAoZmVhdHVyZSkgPT4ge1xuICAgICAgICByZXR1cm4gYCR7IGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwgfS9yZXBvcnRzLyR7IGZlYXR1cmUuaWQgfS5wZGZgO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVSZWNvcmQgPSBhc3luYyAocmVjb3JkLCBhY2NvdW50LCBza2lwVGFibGVDaGVjaykgPT4ge1xuICAgIGlmICghc2tpcFRhYmxlQ2hlY2sgJiYgIXRoaXMucm9vdFRhYmxlRXhpc3RzKHJlY29yZC5mb3JtKSkge1xuICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShyZWNvcmQuZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZVJlY29yZCh7cmVjb3JkLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMudXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcblxuICAgIGNvbnN0IHN5c3RlbVZhbHVlcyA9IE1TU1FMUmVjb3JkVmFsdWVzLnN5c3RlbUNvbHVtblZhbHVlc0ZvckZlYXR1cmUocmVjb3JkLCBudWxsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yZWNvcmQocmVjb3JkLCBzeXN0ZW1WYWx1ZXMpLCAncmVjb3JkcycpO1xuICB9XG5cbiAgcm9vdFRhYmxlRXhpc3RzID0gKGZvcm0pID0+IHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU5hbWVzLmluZGV4T2YoTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSwgbnVsbCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpKSAhPT0gLTE7XG4gIH1cblxuICByZWNyZWF0ZUZvcm1UYWJsZXMgPSBhc3luYyAoZm9ybSwgYWNjb3VudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSwgbnVsbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgZXJyb3IoZXgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBudWxsLCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pKTtcbiAgfVxuXG4gIHVwZGF0ZUZvcm0gPSBhc3luYyAoZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSkgPT4ge1xuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSAmJiAhdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtKHtmb3JtLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgbG9nKCdVcGRhdGluZyBmb3JtJywgZm9ybS5pZCk7XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybU9iamVjdChmb3JtLCBhY2NvdW50KTtcblxuICAgICAgaWYgKCF0aGlzLnJvb3RUYWJsZUV4aXN0cyhmb3JtKSAmJiBuZXdGb3JtICE9IG51bGwpIHtcbiAgICAgICAgb2xkRm9ybSA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcbiAgICAgICAgZGlzYWJsZUNvbXBsZXhUeXBlczogZmFsc2UsXG4gICAgICAgIHVzZXJNb2R1bGU6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUsXG4gICAgICAgIHRhYmxlU2NoZW1hOiB0aGlzLmRhdGFTY2hlbWEsXG4gICAgICAgIGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQ6ICdkYXRlJyxcbiAgICAgICAgbWV0YWRhdGE6IHRydWUsXG4gICAgICAgIHVzZVJlc291cmNlSUQ6IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMsXG4gICAgICAgIGFjY291bnRQcmVmaXg6IHRoaXMudXNlQWNjb3VudFByZWZpeCA/ICdhY2NvdW50XycgKyB0aGlzLmFjY291bnQucm93SUQgOiBudWxsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCB7c3RhdGVtZW50c30gPSBhd2FpdCBNU1NRTFNjaGVtYS5nZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMoYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSwgb3B0aW9ucyk7XG5cbiAgICAgIGxvZygnRHJvcHBpbmcgdmlld3MnLCBmb3JtLmlkKTtcblxuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgIH1cblxuICAgICAgbG9nKCdSdW5uaW5nIHNjaGVtYSBzdGF0ZW1lbnRzJywgZm9ybS5pZCwgc3RhdGVtZW50cy5sZW5ndGgpO1xuXG4gICAgICBhd2FpdCB0aGlzLnJ1bkFsbFRyYW5zYWN0aW9uKHN0YXRlbWVudHMpO1xuXG4gICAgICBsb2coJ0NyZWF0aW5nIHZpZXdzJywgZm9ybS5pZCk7XG5cbiAgICAgIGlmIChuZXdGb3JtKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsb2coJ0NvbXBsZXRlZCBmb3JtIHVwZGF0ZScsIGZvcm0uaWQpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB3YXJuKCd1cGRhdGVGb3JtIGZhaWxlZCcpO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoXCJJRiBPQkpFQ1RfSUQoJyVzLiVzJywgJ1YnKSBJUyBOT1QgTlVMTCBEUk9QIFZJRVcgJXMuJXM7XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSkpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgd2FybignZHJvcEZyaWVuZGx5VmlldyBmYWlsZWQnKTtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdDUkVBVEUgVklFVyAlcy4lcyBBUyBTRUxFQ1QgKiBGUk9NICVzOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybUFuZFNjaGVtYShmb3JtLCByZXBlYXRhYmxlLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucywgJ192aWV3X2Z1bGwnKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgICAgd2FybignY3JlYXRlRnJpZW5kbHlWaWV3IGZhaWxlZCcpO1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBnZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3QgbmFtZSA9IGNvbXBhY3QoW2Zvcm0ubmFtZSwgcmVwZWF0YWJsZSAmJiByZXBlYXRhYmxlLmRhdGFOYW1lXSkuam9pbignIC0gJylcblxuICAgIGNvbnN0IGZvcm1JRCA9IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMgPyBmb3JtLmlkIDogZm9ybS5yb3dJRDtcblxuICAgIGNvbnN0IHByZWZpeCA9IGNvbXBhY3QoWyd2aWV3JywgZm9ybUlELCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUua2V5XSkuam9pbignIC0gJyk7XG5cbiAgICBjb25zdCBvYmplY3ROYW1lID0gW3ByZWZpeCwgbmFtZV0uam9pbignIC0gJyk7XG5cbiAgICByZXR1cm4gdGhpcy50cmltSWRlbnRpZmllcihmdWxjcnVtLmFyZ3MubXNzcWxVbmRlcnNjb3JlTmFtZXMgIT09IGZhbHNlID8gc25ha2Uob2JqZWN0TmFtZSkgOiBvYmplY3ROYW1lKTtcbiAgfVxuXG4gIGFzeW5jIGludm9rZUJlZm9yZUZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxCZWZvcmVGdW5jdGlvbikge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdFWEVDVVRFICVzOycsIGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYmVmb3JlU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgaW52b2tlQWZ0ZXJGdW5jdGlvbigpIHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdFWEVDVVRFICVzOycsIGZ1bGNydW0uYXJncy5tc3NxbEFmdGVyRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMpIHtcbiAgICAgIGF3YWl0IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYWZ0ZXJTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgcHJvZ3Jlc3MpIHtcbiAgICBhd2FpdCB0aGlzLnJlY3JlYXRlRm9ybVRhYmxlcyhmb3JtLCBhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFRhYmxlTGlzdCgpO1xuXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIGF3YWl0IGZvcm0uZmluZEVhY2hSZWNvcmQoe30sIGFzeW5jIChyZWNvcmQpID0+IHtcbiAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcblxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcyhpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBwcm9ncmVzcyhpbmRleCk7XG4gIH1cblxuICBhc3luYyBjbGVhbnVwRnJpZW5kbHlWaWV3cyhhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRWaWV3TGlzdCgpO1xuXG4gICAgY29uc3QgYWN0aXZlVmlld05hbWVzID0gW107XG5cbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgYWN0aXZlVmlld05hbWVzLnB1c2godGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCBudWxsKSk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgYWN0aXZlVmlld05hbWVzLnB1c2godGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlID0gZGlmZmVyZW5jZSh0aGlzLnZpZXdOYW1lcywgYWN0aXZlVmlld05hbWVzKTtcblxuICAgIGZvciAoY29uc3Qgdmlld05hbWUgb2YgcmVtb3ZlKSB7XG4gICAgICBpZiAodmlld05hbWUuaW5kZXhPZigndmlld18nKSA9PT0gMCB8fCB2aWV3TmFtZS5pbmRleE9mKCd2aWV3IC0gJykgPT09IDApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoXCJJRiBPQkpFQ1RfSUQoJyVzLiVzJywgJ1YnKSBJUyBOT1QgTlVMTCBEUk9QIFZJRVcgJXMuJXM7XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgIHdhcm4oJ2NsZWFudXBGcmllbmRseVZpZXdzIGZhaWxlZCcpO1xuICAgICAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cblxuICB1cGRhdGVTdGF0dXMgPSAobWVzc2FnZSkgPT4ge1xuICAgIGlmIChwcm9jZXNzLnN0ZG91dC5pc1RUWSkge1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BTeXN0ZW1UYWJsZXMoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHRlbXBsYXRlRHJvcCkpO1xuICB9XG5cbiAgY3JlYXRlRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBDUkVBVEUgREFUQUJBU0UgJHtkYXRhYmFzZU5hbWV9O2ApO1xuICB9XG5cbiAgZHJvcERhdGFiYXNlKGRhdGFiYXNlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLnJ1bihgRFJPUCBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBhc3luYyBzZXR1cERhdGFiYXNlKCkge1xuICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdCh2ZXJzaW9uMDAxKSk7XG4gIH1cblxuICBwcmVwYXJlTWlncmF0aW9uU2NyaXB0KHNxbCkge1xuICAgIHJldHVybiBzcWwucmVwbGFjZSgvX19TQ0hFTUFfXy9nLCB0aGlzLmRhdGFTY2hlbWEpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9fX1ZJRVdfU0NIRU1BX18vZywgdGhpcy52aWV3U2NoZW1hKS5zcGxpdCgnOycpO1xuICB9XG5cbiAgYXN5bmMgc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCkge1xuICAgIGNvbnN0IHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gICAgfTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hQaG90byh7fSwgYXN5bmMgKHBob3RvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdQaG90b3MnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFZpZGVvKHt9LCBhc3luYyAodmlkZW8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1ZpZGVvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQXVkaW8oe30sIGFzeW5jIChhdWRpbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQXVkaW8nLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFNpZ25hdHVyZSh7fSwgYXN5bmMgKHNpZ25hdHVyZSwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnU2lnbmF0dXJlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDaGFuZ2VzZXQoe30sIGFzeW5jIChjaGFuZ2VzZXQsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NoYW5nZXNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUm9sZSh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUm9sZXMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFByb2plY3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Byb2plY3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hGb3JtKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdGb3JtcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoTWVtYmVyc2hpcCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnTWVtYmVyc2hpcHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENob2ljZUxpc3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Nob2ljZSBMaXN0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NsYXNzaWZpY2F0aW9uIFNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlSW5pdGlhbGl6ZSgpIHtcbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAodGhpcy50YWJsZU5hbWVzLmluZGV4T2YoJ21pZ3JhdGlvbnMnKSA9PT0gLTEpIHtcbiAgICAgIGxvZygnSW5pdGl0YWxpemluZyBkYXRhYmFzZS4uLicpO1xuXG4gICAgICBhd2FpdCB0aGlzLnNldHVwRGF0YWJhc2UoKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9ucyhhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlUnVuTWlncmF0aW9ucyhhY2NvdW50KSB7XG4gICAgdGhpcy5taWdyYXRpb25zID0gKGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgbmFtZSBGUk9NICR7IHRoaXMuZGF0YVNjaGVtYSB9Lm1pZ3JhdGlvbnNgKSkubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIGxldCBwb3B1bGF0ZVJlY29yZHMgPSBmYWxzZTtcblxuICAgIGZvciAobGV0IGNvdW50ID0gMjsgY291bnQgPD0gQ1VSUkVOVF9WRVJTSU9OOyArK2NvdW50KSB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gcGFkU3RhcnQoY291bnQsIDMsICcwJyk7XG5cbiAgICAgIGNvbnN0IG5lZWRzTWlncmF0aW9uID0gdGhpcy5taWdyYXRpb25zLmluZGV4T2YodmVyc2lvbikgPT09IC0xICYmIE1JR1JBVElPTlNbdmVyc2lvbl07XG5cbiAgICAgIGlmIChuZWVkc01pZ3JhdGlvbikge1xuICAgICAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQoTUlHUkFUSU9OU1t2ZXJzaW9uXSkpO1xuXG4gICAgICAgIGlmICh2ZXJzaW9uID09PSAnMDAyJykge1xuICAgICAgICAgIGxvZygnUG9wdWxhdGluZyBzeXN0ZW0gdGFibGVzLi4uJyk7XG4gICAgICAgICAgcG9wdWxhdGVSZWNvcmRzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2ZXJzaW9uID09PSAnMDA1Jykge1xuICAgICAgICAgIGxvZygnTWlncmF0aW5nIGRhdGUgY2FsY3VsYXRpb24gZmllbGRzLi4uJyk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5taWdyYXRlQ2FsY3VsYXRlZEZpZWxkc0RhdGVGb3JtYXQoYWNjb3VudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9wdWxhdGVSZWNvcmRzKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvcHVsYXRlUmVjb3JkcyhhY2NvdW50KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBwb3B1bGF0ZVJlY29yZHMoYWNjb3VudCkge1xuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgaW5kZXggPSAwO1xuXG4gICAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcblxuICAgICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5wcm9ncmVzcyhmb3JtLm5hbWUsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0KGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgY29uc3QgZmllbGRzID0gZm9ybS5lbGVtZW50c09mVHlwZSgnQ2FsY3VsYXRlZEZpZWxkJykuZmlsdGVyKGVsZW1lbnQgPT4gZWxlbWVudC5kaXNwbGF5LmlzRGF0ZSk7XG5cbiAgICAgIGlmIChmaWVsZHMubGVuZ3RoKSB7XG4gICAgICAgIGxvZygnTWlncmF0aW5nIGRhdGUgY2FsY3VsYXRpb24gZmllbGRzIGluIGZvcm0uLi4nLCBmb3JtLm5hbWUpO1xuXG4gICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgdGhpcy51cGRhdGVTdGF0dXMobmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQpO1xuICB9XG59XG4iXX0=