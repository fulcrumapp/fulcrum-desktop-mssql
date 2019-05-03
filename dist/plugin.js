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

        for (const sql of statements) {
          const request = new _mssql2.default.Request(transaction);

          if (fulcrum.args.debug) {
            log(sql);
          }

          const result = yield request.query(sql);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJDVVJSRU5UX1ZFUlNJT04iLCJERUZBVUxUX1NDSEVNQSIsImxvZyIsIndhcm4iLCJlcnJvciIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJydW5BbGxUcmFuc2FjdGlvbiIsInRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb24iLCJiZWdpbiIsIlJlcXVlc3QiLCJxdWVyeSIsImNvbW1pdCIsInRhYmxlTmFtZSIsInJvd0lEIiwidXNlQWNjb3VudFByZWZpeCIsIm9uU3luY1N0YXJ0IiwidGFza3MiLCJvblN5bmNGaW5pc2giLCJjbGVhbnVwRnJpZW5kbHlWaWV3cyIsIm9uRm9ybVNhdmUiLCJvbGRGb3JtIiwibmV3Rm9ybSIsInVwZGF0ZUZvcm0iLCJvbkZvcm1EZWxldGUiLCJfaWQiLCJyb3dfaWQiLCJfbmFtZSIsImVsZW1lbnRzIiwiX2VsZW1lbnRzSlNPTiIsIm9uUmVjb3JkU2F2ZSIsInJlY29yZCIsInVwZGF0ZVJlY29yZCIsIm9uUmVjb3JkRGVsZXRlIiwiZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyIsInJlY29yZFZhbHVlT3B0aW9ucyIsIm1hcCIsIm8iLCJqb2luIiwib25QaG90b1NhdmUiLCJwaG90byIsInVwZGF0ZVBob3RvIiwib25WaWRlb1NhdmUiLCJ2aWRlbyIsInVwZGF0ZVZpZGVvIiwib25BdWRpb1NhdmUiLCJhdWRpbyIsInVwZGF0ZUF1ZGlvIiwib25TaWduYXR1cmVTYXZlIiwic2lnbmF0dXJlIiwidXBkYXRlU2lnbmF0dXJlIiwib25DaGFuZ2VzZXRTYXZlIiwiY2hhbmdlc2V0IiwidXBkYXRlQ2hhbmdlc2V0Iiwib25DaG9pY2VMaXN0U2F2ZSIsImNob2ljZUxpc3QiLCJ1cGRhdGVDaG9pY2VMaXN0Iiwib25DbGFzc2lmaWNhdGlvblNldFNhdmUiLCJjbGFzc2lmaWNhdGlvblNldCIsInVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0Iiwib25Qcm9qZWN0U2F2ZSIsInByb2plY3QiLCJ1cGRhdGVQcm9qZWN0Iiwib25Sb2xlU2F2ZSIsInJvbGUiLCJ1cGRhdGVSb2xlIiwib25NZW1iZXJzaGlwU2F2ZSIsIm1lbWJlcnNoaXAiLCJ1cGRhdGVNZW1iZXJzaGlwIiwicmVsb2FkVGFibGVMaXN0Iiwicm93cyIsImRhdGFTY2hlbWEiLCJ0YWJsZU5hbWVzIiwicmVsb2FkVmlld0xpc3QiLCJ2aWV3U2NoZW1hIiwidmlld05hbWVzIiwiYmFzZU1lZGlhVVJMIiwiZm9ybWF0UGhvdG9VUkwiLCJmb3JtYXRWaWRlb1VSTCIsImZvcm1hdEF1ZGlvVVJMIiwiZm9ybWF0U2lnbmF0dXJlVVJMIiwic2tpcFRhYmxlQ2hlY2siLCJyb290VGFibGVFeGlzdHMiLCJtc3NxbEN1c3RvbU1vZHVsZSIsInNob3VsZFVwZGF0ZVJlY29yZCIsInVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJzeXN0ZW1WYWx1ZXMiLCJzeXN0ZW1Db2x1bW5WYWx1ZXNGb3JGZWF0dXJlIiwidXBkYXRlT2JqZWN0IiwiaW5kZXhPZiIsInRhYmxlTmFtZVdpdGhGb3JtIiwicmVjcmVhdGVGb3JtVGFibGVzIiwiZm9ybVZlcnNpb24iLCJleCIsInNob3VsZFVwZGF0ZUZvcm0iLCJ1cGRhdGVGb3JtT2JqZWN0Iiwib3B0aW9ucyIsImRpc2FibGVBcnJheXMiLCJkaXNhYmxlQ29tcGxleFR5cGVzIiwidXNlck1vZHVsZSIsInRhYmxlU2NoZW1hIiwiY2FsY3VsYXRlZEZpZWxkRGF0ZUZvcm1hdCIsIm1ldGFkYXRhIiwidXNlUmVzb3VyY2VJRCIsInBlcnNpc3RlbnRUYWJsZU5hbWVzIiwiYWNjb3VudFByZWZpeCIsImdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyIsImRyb3BGcmllbmRseVZpZXciLCJyZXBlYXRhYmxlIiwiZWxlbWVudHNPZlR5cGUiLCJsZW5ndGgiLCJjcmVhdGVGcmllbmRseVZpZXciLCJpbnRlZ3JpdHlXYXJuaW5nIiwibWVzc2FnZSIsInByb2Nlc3MiLCJzdGRvdXQiLCJpc1RUWSIsImNsZWFyTGluZSIsImN1cnNvclRvIiwid3JpdGUiLCJwcm9ncmVzcyIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJtc3NxbENvbm5lY3Rpb25TdHJpbmciLCJ0eXBlIiwibXNzcWxEYXRhYmFzZSIsImRlZmF1bHQiLCJtc3NxbEhvc3QiLCJob3N0IiwibXNzcWxQb3J0IiwibXNzcWxVc2VyIiwibXNzcWxQYXNzd29yZCIsIm1zc3FsU2NoZW1hIiwibXNzcWxTY2hlbWFWaWV3cyIsIm1zc3FsU3luY0V2ZW50cyIsIm1zc3FsQmVmb3JlRnVuY3Rpb24iLCJtc3NxbEFmdGVyRnVuY3Rpb24iLCJyZXF1aXJlZCIsIm1zc3FsUmVwb3J0QmFzZVVybCIsIm1zc3FsTWVkaWFCYXNlVXJsIiwibXNzcWxVbmRlcnNjb3JlTmFtZXMiLCJtc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzIiwibXNzcWxQcmVmaXgiLCJoYW5kbGVyIiwic3Vic3RyaW5nIiwidXNlU3luY0V2ZW50cyIsInVzZXIiLCJwYXNzd29yZCIsInJlcXVpcmUiLCJhcHAiLCJjb25uZWN0Iiwib24iLCJzZXR1cE9wdGlvbnMiLCJtYXliZUluaXRpYWxpemUiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJvYmplY3QiLCJ2YWx1ZXMiLCJmaWxlIiwiYWNjZXNzX2tleSIsInRhYmxlIiwiZGVsZXRlU3RhdGVtZW50Iiwicm93X3Jlc291cmNlX2lkIiwiaW5zZXJ0U3RhdGVtZW50IiwicGsiLCJzdGFjayIsInNjaGVtYSIsInZhbHVlc1RyYW5zZm9ybWVyIiwibWVkaWFVUkxGb3JtYXR0ZXIiLCJtZWRpYVZhbHVlIiwiaXRlbXMiLCJpdGVtIiwiZWxlbWVudCIsImlzUGhvdG9FbGVtZW50IiwibWVkaWFJRCIsImlzVmlkZW9FbGVtZW50IiwiaXNBdWRpb0VsZW1lbnQiLCJtZWRpYVZpZXdVUkxGb3JtYXR0ZXIiLCJpZHMiLCJyZXBvcnRVUkxGb3JtYXR0ZXIiLCJmZWF0dXJlIiwidmlld05hbWUiLCJnZXRGcmllbmRseVRhYmxlTmFtZSIsInRhYmxlTmFtZVdpdGhGb3JtQW5kU2NoZW1hIiwiZGF0YU5hbWUiLCJmb3JtSUQiLCJwcmVmaXgiLCJrZXkiLCJvYmplY3ROYW1lIiwiYmVmb3JlU3luYyIsImFmdGVyU3luYyIsImZpbmRFYWNoUmVjb3JkIiwiYWN0aXZlVmlld05hbWVzIiwicmVtb3ZlIiwicHJlcGFyZU1pZ3JhdGlvblNjcmlwdCIsImRhdGFiYXNlTmFtZSIsInNwbGl0IiwiZmluZEVhY2hQaG90byIsImZpbmRFYWNoVmlkZW8iLCJmaW5kRWFjaEF1ZGlvIiwiZmluZEVhY2hTaWduYXR1cmUiLCJmaW5kRWFjaENoYW5nZXNldCIsImZpbmRFYWNoUm9sZSIsImZpbmRFYWNoUHJvamVjdCIsImZpbmRFYWNoRm9ybSIsImZpbmRFYWNoTWVtYmVyc2hpcCIsImZpbmRFYWNoQ2hvaWNlTGlzdCIsImZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQiLCJtYXliZVJ1bk1pZ3JhdGlvbnMiLCJtaWdyYXRpb25zIiwicG9wdWxhdGVSZWNvcmRzIiwiY291bnQiLCJ2ZXJzaW9uIiwibmVlZHNNaWdyYXRpb24iLCJtaWdyYXRlQ2FsY3VsYXRlZEZpZWxkc0RhdGVGb3JtYXQiLCJmaWVsZHMiLCJmaWx0ZXIiLCJkaXNwbGF5IiwiaXNEYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBOzs7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7SUFLWUEsRzs7QUFKWjs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUVBOztBQUVBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7Ozs7OztBQUVBLE1BQU1DLHdCQUF3QixHQUE5Qjs7QUFFQSxNQUFNQyxlQUFlO0FBQ25CQyxZQUFVLFlBRFM7QUFFbkJDLFVBQVEsV0FGVztBQUduQkMsUUFBTSxJQUhhO0FBSW5CQyxPQUFLLEVBSmM7QUFLbkJDLHFCQUFtQjtBQUxBLENBQXJCOztBQVFBLE1BQU1DLGFBQWE7QUFDakIsMEJBRGlCO0FBRWpCLDBCQUZpQjtBQUdqQiwwQkFIaUI7QUFJakIsMkJBSmlCO0FBS2pCO0FBTGlCLENBQW5COztBQVFBLE1BQU1DLGtCQUFrQixDQUF4Qjs7QUFFQSxNQUFNQyxpQkFBaUIsS0FBdkI7O0FBRUEsTUFBTSxFQUFFQyxHQUFGLEVBQU9DLElBQVAsRUFBYUMsS0FBYixLQUF1QkMsUUFBUUMsTUFBUixDQUFlQyxXQUFmLENBQTJCLE9B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QUFNTixLQUFLMk4sY0FBTCxDQUFvQixFQUFwQjtBQUFBLHlDQUF3QixXQUFPbkssTUFBUCxFQUFrQjtBQUM5Q0EsbUJBQU94RCxJQUFQLEdBQWNBLElBQWQ7O0FBRUEsZ0JBQUksRUFBRU0sS0FBRixHQUFVLEVBQVYsS0FBaUIsQ0FBckIsRUFBd0I7QUFDdEIsc0JBQUsySSxRQUFMLENBQWNqSixLQUFLUSxJQUFuQixFQUF5QkYsS0FBekI7QUFDRDs7QUFFRCxrQkFBTSxRQUFLbUQsWUFBTCxDQUFrQkQsTUFBbEIsRUFBMEJoRSxPQUExQixFQUFtQyxLQUFuQyxDQUFOO0FBQ0QsV0FSSzs7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUFOO0FBU0Q7QUFqQjRCO0FBa0I5Qjs7QUFFSzBQLG1DQUFOLENBQXdDMVAsT0FBeEMsRUFBaUQ7QUFBQTs7QUFBQTtBQUMvQyxZQUFNTSxRQUFRLE1BQU1OLFFBQVFPLGVBQVIsQ0FBd0IsRUFBeEIsQ0FBcEI7O0FBRUEsV0FBSyxNQUFNQyxJQUFYLElBQW1CRixLQUFuQixFQUEwQjtBQUN4QixjQUFNcVAsU0FBU25QLEtBQUtzSSxjQUFMLENBQW9CLGlCQUFwQixFQUF1QzhHLE1BQXZDLENBQThDO0FBQUEsaUJBQVc1QyxRQUFRNkMsT0FBUixDQUFnQkMsTUFBM0I7QUFBQSxTQUE5QyxDQUFmOztBQUVBLFlBQUlILE9BQU81RyxNQUFYLEVBQW1CO0FBQ2pCaEssY0FBSSw4Q0FBSixFQUFvRHlCLEtBQUtRLElBQXpEOztBQUVBLGdCQUFNLFFBQUtILFdBQUwsQ0FBaUJMLElBQWpCLEVBQXVCUixPQUF2QixFQUFnQyxZQUFNLENBQUUsQ0FBeEMsQ0FBTjtBQUNEO0FBQ0Y7QUFYOEM7QUFZaEQ7O0FBNWdDa0IsQyIsImZpbGUiOiJwbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbXNzcWwgZnJvbSAnbXNzcWwnO1xuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgTVNTUUxTY2hlbWEgZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgTVNTUUwgfSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCBNU1NRTFJlY29yZFZhbHVlcyBmcm9tICcuL21zc3FsLXJlY29yZC12YWx1ZXMnXG5pbXBvcnQgc25ha2UgZnJvbSAnc25ha2UtY2FzZSc7XG5pbXBvcnQgdGVtcGxhdGVEcm9wIGZyb20gJy4vdGVtcGxhdGUuZHJvcC5zcWwnO1xuaW1wb3J0IFNjaGVtYU1hcCBmcm9tICcuL3NjaGVtYS1tYXAnO1xuaW1wb3J0ICogYXMgYXBpIGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IHsgY29tcGFjdCwgZGlmZmVyZW5jZSwgcGFkU3RhcnQgfSBmcm9tICdsb2Rhc2gnO1xuXG5pbXBvcnQgdmVyc2lvbjAwMSBmcm9tICcuL3ZlcnNpb24tMDAxLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMiBmcm9tICcuL3ZlcnNpb24tMDAyLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMyBmcm9tICcuL3ZlcnNpb24tMDAzLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNCBmcm9tICcuL3ZlcnNpb24tMDA0LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNSBmcm9tICcuL3ZlcnNpb24tMDA1LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNiBmcm9tICcuL3ZlcnNpb24tMDA2LnNxbCc7XG5cbmNvbnN0IE1BWF9JREVOVElGSUVSX0xFTkdUSCA9IDEwMDtcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBzZXJ2ZXI6ICdsb2NhbGhvc3QnLFxuICBwb3J0OiAxNDMzLFxuICBtYXg6IDEwLFxuICBpZGxlVGltZW91dE1pbGxpczogMzAwMDBcbn07XG5cbmNvbnN0IE1JR1JBVElPTlMgPSB7XG4gICcwMDInOiB2ZXJzaW9uMDAyLFxuICAnMDAzJzogdmVyc2lvbjAwMyxcbiAgJzAwNCc6IHZlcnNpb24wMDQsXG4gICcwMDUnOiB2ZXJzaW9uMDA1LFxuICAnMDA2JzogdmVyc2lvbjAwNlxufTtcblxuY29uc3QgQ1VSUkVOVF9WRVJTSU9OID0gNjtcblxuY29uc3QgREVGQVVMVF9TQ0hFTUEgPSAnZGJvJztcblxuY29uc3QgeyBsb2csIHdhcm4sIGVycm9yIH0gPSBmdWxjcnVtLmxvZ2dlci53aXRoQ29udGV4dCgnbXNzcWwnKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAnbXNzcWwnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgbXNzcWwgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBtc3NxbENvbm5lY3Rpb25TdHJpbmc6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgY29ubmVjdGlvbiBzdHJpbmcgKG92ZXJyaWRlcyBhbGwgaW5kaXZpZHVhbCBkYXRhYmFzZSBjb25uZWN0aW9uIHBhcmFtZXRlcnMpJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbERhdGFiYXNlOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGRhdGFiYXNlIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5kYXRhYmFzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEhvc3Q6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIGhvc3QnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5ob3N0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUG9ydDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgcG9ydCcsXG4gICAgICAgICAgdHlwZTogJ2ludGVnZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5wb3J0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsVXNlcjoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCB1c2VyJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBhc3N3b3JkOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHBhc3N3b3JkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNjaGVtYToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2NoZW1hVmlld3M6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hIGZvciB0aGUgZnJpZW5kbHkgdmlld3MnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3luY0V2ZW50czoge1xuICAgICAgICAgIGRlc2M6ICdhZGQgc3luYyBldmVudCBob29rcycsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxCZWZvcmVGdW5jdGlvbjoge1xuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYmVmb3JlIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbEFmdGVyRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGFmdGVyIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRm9ybToge1xuICAgICAgICAgIGRlc2M6ICd0aGUgZm9ybSBJRCB0byByZWJ1aWxkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlcG9ydEJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAncmVwb3J0IFVSTCBiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbE1lZGlhQmFzZVVybDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxVbmRlcnNjb3JlTmFtZXM6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHVuZGVyc2NvcmUgbmFtZXMgKGUuZy4gXCJQYXJrIEluc3BlY3Rpb25zXCIgYmVjb21lcyBcInBhcmtfaW5zcGVjdGlvbnNcIiknLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgc2VydmVyIGlkIGluIHRoZSBmb3JtIHRhYmxlIG5hbWVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUHJlZml4OiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgb3JnYW5pemF0aW9uIElEIGFzIGEgcHJlZml4IGluIHRoZSBvYmplY3QgbmFtZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlYnVpbGRWaWV3c09ubHk6IHtcbiAgICAgICAgICBkZXNjOiAnb25seSByZWJ1aWxkIHRoZSB2aWV3cycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEN1c3RvbU1vZHVsZToge1xuICAgICAgICAgIGRlc2M6ICdhIGN1c3RvbSBtb2R1bGUgdG8gbG9hZCB3aXRoIHN5bmMgZXh0ZW5zaW9ucyAoZXhwZXJpbWVudGFsKScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2V0dXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2V0dXAgdGhlIGRhdGFiYXNlJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRHJvcDoge1xuICAgICAgICAgIGRlc2M6ICdkcm9wIHRoZSBzeXN0ZW0gdGFibGVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3lzdGVtVGFibGVzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IGNyZWF0ZSB0aGUgc3lzdGVtIHJlY29yZHMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcERhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbERyb3ApIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcFN5c3RlbVRhYmxlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTZXR1cCkge1xuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTeXN0ZW1UYWJsZXNPbmx5KSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuXG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxGb3JtICYmIGZvcm0uaWQgIT09IGZ1bGNydW0uYXJncy5tc3NxbEZvcm0pIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZWJ1aWxkVmlld3NPbmx5KSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIChpbmRleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoZm9ybS5uYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCArICcgcmVjb3JkcycpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nKCcnKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgdHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikge1xuICAgIHJldHVybiBpZGVudGlmaWVyLnN1YnN0cmluZygwLCBNQVhfSURFTlRJRklFUl9MRU5HVEgpO1xuICB9XG5cbiAgZXNjYXBlSWRlbnRpZmllciA9IChpZGVudGlmaWVyKSA9PiB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIgJiYgdGhpcy5tc3NxbC5pZGVudCh0aGlzLnRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcbiAgfVxuXG4gIGdldCB1c2VTeW5jRXZlbnRzKCkge1xuICAgIHJldHVybiBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzICE9IG51bGwgPyBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzIDogdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIHRoaXMuYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zc3FsSG9zdCB8fCBNU1NRTF9DT05GSUcuc2VydmVyLFxuICAgICAgcG9ydDogZnVsY3J1bS5hcmdzLm1zc3FsUG9ydCB8fCBNU1NRTF9DT05GSUcucG9ydCxcbiAgICAgIGRhdGFiYXNlOiBmdWxjcnVtLmFyZ3MubXNzcWxEYXRhYmFzZSB8fCBNU1NRTF9DT05GSUcuZGF0YWJhc2UsXG4gICAgICB1c2VyOiBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyIHx8IE1TU1FMX0NPTkZJRy51c2VyLFxuICAgICAgcGFzc3dvcmQ6IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkIHx8IE1TU1FMX0NPTkZJRy51c2VyXG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxVc2VyKSB7XG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCkge1xuICAgICAgb3B0aW9ucy5wYXNzd29yZCA9IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpIHtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgPSByZXF1aXJlKGZ1bGNydW0uYXJncy5tc3NxbEN1c3RvbU1vZHVsZSk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwaSA9IGFwaTtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYXBwID0gZnVsY3J1bTtcbiAgICB9XG5cbiAgICB0aGlzLmRpc2FibGVBcnJheXMgPSBmYWxzZTtcbiAgICB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMgPSB0cnVlO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzID09PSB0cnVlKSB7XG4gICAgICB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLnVzZUFjY291bnRQcmVmaXggPSAoZnVsY3J1bS5hcmdzLm1zc3FsUHJlZml4ICE9PSBmYWxzZSk7XG5cbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KGZ1bGNydW0uYXJncy5tc3NxbENvbm5lY3Rpb25TdHJpbmcgfHwgb3B0aW9ucyk7XG5cbiAgICBpZiAodGhpcy51c2VTeW5jRXZlbnRzKSB7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOnN0YXJ0JywgdGhpcy5vblN5bmNTdGFydCk7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOmZpbmlzaCcsIHRoaXMub25TeW5jRmluaXNoKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Bob3RvOnNhdmUnLCB0aGlzLm9uUGhvdG9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3ZpZGVvOnNhdmUnLCB0aGlzLm9uVmlkZW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2F1ZGlvOnNhdmUnLCB0aGlzLm9uQXVkaW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3NpZ25hdHVyZTpzYXZlJywgdGhpcy5vblNpZ25hdHVyZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hhbmdlc2V0OnNhdmUnLCB0aGlzLm9uQ2hhbmdlc2V0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6c2F2ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpkZWxldGUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdmb3JtOnNhdmUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignZm9ybTpkZWxldGUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbi1zZXQ6c2F2ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OmRlbGV0ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdyb2xlOnNhdmUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncm9sZTpkZWxldGUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdwcm9qZWN0OnNhdmUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpkZWxldGUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdtZW1iZXJzaGlwOnNhdmUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpkZWxldGUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgIH1cblxuICAgIHRoaXMudmlld1NjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYVZpZXdzIHx8IERFRkFVTFRfU0NIRU1BO1xuICAgIHRoaXMuZGF0YVNjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYSB8fCBERUZBVUxUX1NDSEVNQTtcblxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcbiAgICAvLyBjcmVhdGlvbiBvZiBuZXcgdGFibGVzIGV2ZW4gd2hlbiB0aGUgZm9ybSBpc24ndCB2ZXJzaW9uIDEuIElmIHRoZSB0YWJsZSBkb2Vzbid0XG4gICAgLy8gZXhpc3QsIHdlIGNhbiBwcmV0ZW5kIHRoZSBmb3JtIGlzIHZlcnNpb24gMSBzbyBpdCBjcmVhdGVzIGFsbCBuZXcgdGFibGVzIGluc3RlYWRcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIC8vIG1ha2UgYSBjbGllbnQgc28gd2UgY2FuIHVzZSBpdCB0byBidWlsZCBTUUwgc3RhdGVtZW50c1xuICAgIHRoaXMubXNzcWwgPSBuZXcgTVNTUUwoe30pO1xuXG4gICAgdGhpcy5zZXR1cE9wdGlvbnMoKTtcblxuICAgIGF3YWl0IHRoaXMubWF5YmVJbml0aWFsaXplKCk7XG4gIH1cblxuICBhc3luYyBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLnBvb2wpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJ1biA9IGFzeW5jIChzcWwpID0+IHtcbiAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFwwL2csICcnKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgIGxvZyhzcWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucG9vbC5yZXF1ZXN0KCkuYmF0Y2goc3FsKTtcblxuICAgIHJldHVybiByZXN1bHQucmVjb3Jkc2V0O1xuICB9XG5cbiAgcnVuQWxsID0gYXN5bmMgKHN0YXRlbWVudHMpID0+IHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICByZXN1bHRzLnB1c2goYXdhaXQgdGhpcy5ydW4oc3FsKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBydW5BbGxUcmFuc2FjdGlvbiA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XG4gICAgY29uc3QgdHJhbnNhY3Rpb24gPSBuZXcgbXNzcWwuVHJhbnNhY3Rpb24odGhpcy5wb29sKTtcblxuICAgIGF3YWl0IHRyYW5zYWN0aW9uLmJlZ2luKCk7XG5cbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBjb25zdCByZXF1ZXN0ID0gbmV3IG1zc3FsLlJlcXVlc3QodHJhbnNhY3Rpb24pO1xuXG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGxvZyhzcWwpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0LnF1ZXJ5KHNxbCk7XG5cbiAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgIH1cblxuICAgIGF3YWl0IHRyYW5zYWN0aW9uLmNvbW1pdCgpO1xuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBsb2cgPSAoLi4uYXJncykgPT4ge1xuICAgIC8vIGNvbnNvbGUubG9nKC4uLmFyZ3MpO1xuICB9XG5cbiAgdGFibGVOYW1lID0gKGFjY291bnQsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuXG4gICAgaWYgKHRoaXMudXNlQWNjb3VudFByZWZpeCkge1xuICAgICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuXG4gIG9uU3luY1N0YXJ0ID0gYXN5bmMgKHthY2NvdW50LCB0YXNrc30pID0+IHtcbiAgICBhd2FpdCB0aGlzLmludm9rZUJlZm9yZUZ1bmN0aW9uKCk7XG4gIH1cblxuICBvblN5bmNGaW5pc2ggPSBhc3luYyAoe2FjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5jbGVhbnVwRnJpZW5kbHlWaWV3cyhhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLmludm9rZUFmdGVyRnVuY3Rpb24oKTtcbiAgfVxuXG4gIG9uRm9ybVNhdmUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm19KSA9PiB7XG4gICAgbG9nKCdmb3JtOnNhdmUnLCBmb3JtLmlkKTtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSk7XG4gIH1cblxuICBvbkZvcm1EZWxldGUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnR9KSA9PiB7XG4gICAgY29uc3Qgb2xkRm9ybSA9IHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBudWxsKTtcbiAgfVxuXG4gIG9uUmVjb3JkU2F2ZSA9IGFzeW5jICh7cmVjb3JkLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJlY29yZERlbGV0ZSA9IGFzeW5jICh7cmVjb3JkfSkgPT4ge1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy5kZWxldGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCwgcmVjb3JkLmZvcm0sIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIG9uUGhvdG9TYXZlID0gYXN5bmMgKHtwaG90bywgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVBob3RvKHBob3RvLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uVmlkZW9TYXZlID0gYXN5bmMgKHt2aWRlbywgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVZpZGVvKHZpZGVvLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQXVkaW9TYXZlID0gYXN5bmMgKHthdWRpbywgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUF1ZGlvKGF1ZGlvLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uU2lnbmF0dXJlU2F2ZSA9IGFzeW5jICh7c2lnbmF0dXJlLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlU2lnbmF0dXJlKHNpZ25hdHVyZSwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNoYW5nZXNldFNhdmUgPSBhc3luYyAoe2NoYW5nZXNldCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNoYW5nZXNldChjaGFuZ2VzZXQsIGFjY291bnQpO1xuICB9XG5cbiAgb25DaG9pY2VMaXN0U2F2ZSA9IGFzeW5jICh7Y2hvaWNlTGlzdCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3QoY2hvaWNlTGlzdCwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSA9IGFzeW5jICh7Y2xhc3NpZmljYXRpb25TZXQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChjbGFzc2lmaWNhdGlvblNldCwgYWNjb3VudCk7XG4gIH1cblxuICBvblByb2plY3RTYXZlID0gYXN5bmMgKHtwcm9qZWN0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChwcm9qZWN0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUm9sZVNhdmUgPSBhc3luYyAoe3JvbGUsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKHJvbGUsIGFjY291bnQpO1xuICB9XG5cbiAgb25NZW1iZXJzaGlwU2F2ZSA9IGFzeW5jICh7bWVtYmVyc2hpcCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU1lbWJlcnNoaXAobWVtYmVyc2hpcCwgYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVQaG90byhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAucGhvdG8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRQaG90b1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdwaG90b3MnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVZpZGVvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC52aWRlbyhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFZpZGVvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3ZpZGVvcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQXVkaW8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLmF1ZGlvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0QXVkaW9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAnYXVkaW8nKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVNpZ25hdHVyZShvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAuc2lnbmF0dXJlKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0U2lnbmF0dXJlVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3NpZ25hdHVyZXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNoYW5nZXNldChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuY2hhbmdlc2V0KG9iamVjdCksICdjaGFuZ2VzZXRzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVQcm9qZWN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5wcm9qZWN0KG9iamVjdCksICdwcm9qZWN0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlTWVtYmVyc2hpcChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAubWVtYmVyc2hpcChvYmplY3QpLCAnbWVtYmVyc2hpcHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVJvbGUob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnJvbGUob2JqZWN0KSwgJ3JvbGVzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVGb3JtT2JqZWN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5mb3JtKG9iamVjdCksICdmb3JtcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2hvaWNlTGlzdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuY2hvaWNlTGlzdChvYmplY3QpLCAnY2hvaWNlX2xpc3RzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuY2xhc3NpZmljYXRpb25TZXQob2JqZWN0KSwgJ2NsYXNzaWZpY2F0aW9uX3NldHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU9iamVjdCh2YWx1ZXMsIHRhYmxlKSB7XG4gICAgY29uc3QgZGVsZXRlU3RhdGVtZW50ID0gdGhpcy5tc3NxbC5kZWxldGVTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHtyb3dfcmVzb3VyY2VfaWQ6IHZhbHVlcy5yb3dfcmVzb3VyY2VfaWR9KTtcbiAgICBjb25zdCBpbnNlcnRTdGF0ZW1lbnQgPSB0aGlzLm1zc3FsLmluc2VydFN0YXRlbWVudChgJHsgdGhpcy5kYXRhU2NoZW1hIH0uc3lzdGVtXyR7dGFibGV9YCwgdmFsdWVzLCB7cGs6ICdpZCd9KTtcblxuICAgIGNvbnN0IHNxbCA9IFsgZGVsZXRlU3RhdGVtZW50LnNxbCwgaW5zZXJ0U3RhdGVtZW50LnNxbCBdLmpvaW4oJ1xcbicpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKHNxbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHdhcm4oYHVwZGF0ZU9iamVjdCAke3RhYmxlfSBmYWlsZWRgKTtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG4gIH1cblxuICByZWxvYWRUYWJsZUxpc3QgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9JyR7IHRoaXMuZGF0YVNjaGVtYSB9J2ApO1xuXG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgcmVsb2FkVmlld0xpc3QgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9JyR7IHRoaXMudmlld1NjaGVtYSB9J2ApO1xuXG4gICAgdGhpcy52aWV3TmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG4gIH1cblxuICBiYXNlTWVkaWFVUkwgPSAoKSA9PiB7XG4gIH1cblxuICBmb3JtYXRQaG90b1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9waG90b3MvJHsgaWQgfS5qcGdgO1xuICB9XG5cbiAgZm9ybWF0VmlkZW9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zLyR7IGlkIH0ubXA0YDtcbiAgfVxuXG4gIGZvcm1hdEF1ZGlvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvLyR7IGlkIH0ubTRhYDtcbiAgfVxuXG4gIGZvcm1hdFNpZ25hdHVyZVVSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9zaWduYXR1cmVzLyR7IGlkIH0ucG5nYDtcbiAgfVxuXG4gIGludGVncml0eVdhcm5pbmcoZXgpIHtcbiAgICB3YXJuKGBcbi0tLS0tLS0tLS0tLS1cbiEhIFdBUk5JTkcgISFcbi0tLS0tLS0tLS0tLS1cblxuTVNTUUwgZGF0YWJhc2UgaW50ZWdyaXR5IGlzc3VlIGVuY291bnRlcmVkLiBDb21tb24gc291cmNlcyBvZiBkYXRhYmFzZSBpc3N1ZXMgYXJlOlxuXG4qIFJlaW5zdGFsbGluZyBGdWxjcnVtIERlc2t0b3AgYW5kIHVzaW5nIGFuIG9sZCBNU1NRTCBkYXRhYmFzZSB3aXRob3V0IHJlY3JlYXRpbmdcbiAgdGhlIE1TU1FMIGRhdGFiYXNlLlxuKiBEZWxldGluZyB0aGUgaW50ZXJuYWwgYXBwbGljYXRpb24gZGF0YWJhc2UgYW5kIHVzaW5nIGFuIGV4aXN0aW5nIE1TU1FMIGRhdGFiYXNlXG4qIE1hbnVhbGx5IG1vZGlmeWluZyB0aGUgTVNTUUwgZGF0YWJhc2VcbiogQ3JlYXRpbmcgbXVsdGlwbGUgYXBwcyBpbiBGdWxjcnVtIHdpdGggdGhlIHNhbWUgbmFtZS4gVGhpcyBpcyBnZW5lcmFsbHkgT0ssIGV4Y2VwdFxuICB5b3Ugd2lsbCBub3QgYmUgYWJsZSB0byB1c2UgdGhlIFwiZnJpZW5kbHkgdmlld1wiIGZlYXR1cmUgb2YgdGhlIE1TU1FMIHBsdWdpbiBzaW5jZVxuICB0aGUgdmlldyBuYW1lcyBhcmUgZGVyaXZlZCBmcm9tIHRoZSBmb3JtIG5hbWVzLlxuXG5Ob3RlOiBXaGVuIHJlaW5zdGFsbGluZyBGdWxjcnVtIERlc2t0b3Agb3IgXCJzdGFydGluZyBvdmVyXCIgeW91IG5lZWQgdG8gZHJvcCBhbmQgcmUtY3JlYXRlXG50aGUgTVNTUUwgZGF0YWJhc2UuIFRoZSBuYW1lcyBvZiBkYXRhYmFzZSBvYmplY3RzIGFyZSB0aWVkIGRpcmVjdGx5IHRvIHRoZSBkYXRhYmFzZVxub2JqZWN0cyBpbiB0aGUgaW50ZXJuYWwgYXBwbGljYXRpb24gZGF0YWJhc2UuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuUmVwb3J0IGlzc3VlcyBhdCBodHRwczovL2dpdGh1Yi5jb20vZnVsY3J1bWFwcC9mdWxjcnVtLWRlc2t0b3AvaXNzdWVzXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbk1lc3NhZ2U6XG4keyBleC5tZXNzYWdlIH1cblxuU3RhY2s6XG4keyBleC5zdGFjayB9XG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmAucmVkXG4gICAgKTtcbiAgfVxuXG4gIHNldHVwT3B0aW9ucygpIHtcbiAgICB0aGlzLmJhc2VNZWRpYVVSTCA9IGZ1bGNydW0uYXJncy5tc3NxbE1lZGlhQmFzZVVybCA/IGZ1bGNydW0uYXJncy5tc3NxbE1lZGlhQmFzZVVybCA6ICdodHRwczovL2FwaS5mdWxjcnVtYXBwLmNvbS9hcGkvdjInO1xuXG4gICAgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMgPSB7XG4gICAgICBzY2hlbWE6IHRoaXMuZGF0YVNjaGVtYSxcblxuICAgICAgZXNjYXBlSWRlbnRpZmllcjogdGhpcy5lc2NhcGVJZGVudGlmaWVyLFxuXG4gICAgICBkaXNhYmxlQXJyYXlzOiB0aGlzLmRpc2FibGVBcnJheXMsXG5cbiAgICAgIHBlcnNpc3RlbnRUYWJsZU5hbWVzOiB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzLFxuXG4gICAgICBhY2NvdW50UHJlZml4OiB0aGlzLnVzZUFjY291bnRQcmVmaXggPyAnYWNjb3VudF8nICsgdGhpcy5hY2NvdW50LnJvd0lEIDogbnVsbCxcblxuICAgICAgY2FsY3VsYXRlZEZpZWxkRGF0ZUZvcm1hdDogJ2RhdGUnLFxuXG4gICAgICBkaXNhYmxlQ29tcGxleFR5cGVzOiB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMsXG5cbiAgICAgIHZhbHVlc1RyYW5zZm9ybWVyOiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUudmFsdWVzVHJhbnNmb3JtZXIsXG5cbiAgICAgIG1lZGlhVVJMRm9ybWF0dGVyOiAobWVkaWFWYWx1ZSkgPT4ge1xuXG4gICAgICAgIHJldHVybiBtZWRpYVZhbHVlLml0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNQaG90b0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZvcm1hdFBob3RvVVJMKGl0ZW0ubWVkaWFJRCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNWaWRlb0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZvcm1hdFZpZGVvVVJMKGl0ZW0ubWVkaWFJRCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNBdWRpb0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZvcm1hdEF1ZGlvVVJMKGl0ZW0ubWVkaWFJRCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0pO1xuICAgICAgfSxcblxuICAgICAgbWVkaWFWaWV3VVJMRm9ybWF0dGVyOiAobWVkaWFWYWx1ZSkgPT4ge1xuICAgICAgICBjb25zdCBpZHMgPSBtZWRpYVZhbHVlLml0ZW1zLm1hcChvID0+IG8ubWVkaWFJRCk7XG5cbiAgICAgICAgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1Bob3RvRWxlbWVudCkge1xuICAgICAgICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9waG90b3Mvdmlldz9waG90b3M9JHsgaWRzIH1gO1xuICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xuICAgICAgICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS92aWRlb3Mvdmlldz92aWRlb3M9JHsgaWRzIH1gO1xuICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xuICAgICAgICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9hdWRpby92aWV3P2F1ZGlvPSR7IGlkcyB9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUmVwb3J0QmFzZVVybCkge1xuICAgICAgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMucmVwb3J0VVJMRm9ybWF0dGVyID0gKGZlYXR1cmUpID0+IHtcbiAgICAgICAgcmV0dXJuIGAkeyBmdWxjcnVtLmFyZ3MubXNzcWxSZXBvcnRCYXNlVXJsIH0vcmVwb3J0cy8keyBmZWF0dXJlLmlkIH0ucGRmYDtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgdXBkYXRlUmVjb3JkID0gYXN5bmMgKHJlY29yZCwgYWNjb3VudCwgc2tpcFRhYmxlQ2hlY2spID0+IHtcbiAgICBpZiAoIXNraXBUYWJsZUNoZWNrICYmICF0aGlzLnJvb3RUYWJsZUV4aXN0cyhyZWNvcmQuZm9ybSkpIHtcbiAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0ocmVjb3JkLmZvcm0sIGFjY291bnQsICgpID0+IHt9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZVJlY29yZCAmJiAhdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVSZWNvcmQoe3JlY29yZCwgYWNjb3VudH0pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLnVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnRzLm1hcChvID0+IG8uc3FsKS5qb2luKCdcXG4nKSk7XG5cbiAgICBjb25zdCBzeXN0ZW1WYWx1ZXMgPSBNU1NRTFJlY29yZFZhbHVlcy5zeXN0ZW1Db2x1bW5WYWx1ZXNGb3JGZWF0dXJlKHJlY29yZCwgbnVsbCwgcmVjb3JkLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucmVjb3JkKHJlY29yZCwgc3lzdGVtVmFsdWVzKSwgJ3JlY29yZHMnKTtcbiAgfVxuXG4gIHJvb3RUYWJsZUV4aXN0cyA9IChmb3JtKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVOYW1lcy5pbmRleE9mKE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0sIG51bGwsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKSkgIT09IC0xO1xuICB9XG5cbiAgcmVjcmVhdGVGb3JtVGFibGVzID0gYXN5bmMgKGZvcm0sIGFjY291bnQpID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSksIG51bGwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGVycm9yKGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgbnVsbCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSk7XG4gIH1cblxuICB1cGRhdGVGb3JtID0gYXN5bmMgKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pID0+IHtcbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0gJiYgIXRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSh7Zm9ybSwgYWNjb3VudH0pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGxvZygnVXBkYXRpbmcgZm9ybScsIGZvcm0uaWQpO1xuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3QoZm9ybSwgYWNjb3VudCk7XG5cbiAgICAgIGlmICghdGhpcy5yb290VGFibGVFeGlzdHMoZm9ybSkgJiYgbmV3Rm9ybSAhPSBudWxsKSB7XG4gICAgICAgIG9sZEZvcm0gPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBkaXNhYmxlQXJyYXlzOiB0aGlzLmRpc2FibGVBcnJheXMsXG4gICAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IGZhbHNlLFxuICAgICAgICB1c2VyTW9kdWxlOiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLFxuICAgICAgICB0YWJsZVNjaGVtYTogdGhpcy5kYXRhU2NoZW1hLFxuICAgICAgICBjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0OiAnZGF0ZScsXG4gICAgICAgIG1ldGFkYXRhOiB0cnVlLFxuICAgICAgICB1c2VSZXNvdXJjZUlEOiB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzLFxuICAgICAgICBhY2NvdW50UHJlZml4OiB0aGlzLnVzZUFjY291bnRQcmVmaXggPyAnYWNjb3VudF8nICsgdGhpcy5hY2NvdW50LnJvd0lEIDogbnVsbFxuICAgICAgfTtcblxuICAgICAgY29uc3Qge3N0YXRlbWVudHN9ID0gYXdhaXQgTVNTUUxTY2hlbWEuZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzKGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0sIG9wdGlvbnMpO1xuXG4gICAgICBsb2coJ0Ryb3BwaW5nIHZpZXdzJywgZm9ybS5pZCk7XG5cbiAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgICB9XG5cbiAgICAgIGxvZygnUnVubmluZyBzY2hlbWEgc3RhdGVtZW50cycsIGZvcm0uaWQsIHN0YXRlbWVudHMubGVuZ3RoKTtcblxuICAgICAgYXdhaXQgdGhpcy5ydW5BbGxUcmFuc2FjdGlvbihzdGF0ZW1lbnRzKTtcblxuICAgICAgbG9nKCdDcmVhdGluZyB2aWV3cycsIGZvcm0uaWQpO1xuXG4gICAgICBpZiAobmV3Rm9ybSkge1xuICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbG9nKCdDb21wbGV0ZWQgZm9ybSB1cGRhdGUnLCBmb3JtLmlkKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgd2FybigndXBkYXRlRm9ybSBmYWlsZWQnKTtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KFwiSUYgT0JKRUNUX0lEKCclcy4lcycsICdWJykgSVMgTk9UIE5VTEwgRFJPUCBWSUVXICVzLiVzO1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHdhcm4oJ2Ryb3BGcmllbmRseVZpZXcgZmFpbGVkJyk7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnQ1JFQVRFIFZJRVcgJXMuJXMgQVMgU0VMRUNUICogRlJPTSAlczsnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm1BbmRTY2hlbWEoZm9ybSwgcmVwZWF0YWJsZSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMsICdfdmlld19mdWxsJykpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgLy8gc29tZXRpbWVzIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgIHdhcm4oJ2NyZWF0ZUZyaWVuZGx5VmlldyBmYWlsZWQnKTtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IG5hbWUgPSBjb21wYWN0KFtmb3JtLm5hbWUsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5kYXRhTmFtZV0pLmpvaW4oJyAtICcpXG5cbiAgICBjb25zdCBmb3JtSUQgPSB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzID8gZm9ybS5pZCA6IGZvcm0ucm93SUQ7XG5cbiAgICBjb25zdCBwcmVmaXggPSBjb21wYWN0KFsndmlldycsIGZvcm1JRCwgcmVwZWF0YWJsZSAmJiByZXBlYXRhYmxlLmtleV0pLmpvaW4oJyAtICcpO1xuXG4gICAgY29uc3Qgb2JqZWN0TmFtZSA9IFtwcmVmaXgsIG5hbWVdLmpvaW4oJyAtICcpO1xuXG4gICAgcmV0dXJuIHRoaXMudHJpbUlkZW50aWZpZXIoZnVsY3J1bS5hcmdzLm1zc3FsVW5kZXJzY29yZU5hbWVzICE9PSBmYWxzZSA/IHNuYWtlKG9iamVjdE5hbWUpIDogb2JqZWN0TmFtZSk7XG4gIH1cblxuICBhc3luYyBpbnZva2VCZWZvcmVGdW5jdGlvbigpIHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRVhFQ1VURSAlczsnLCBmdWxjcnVtLmFyZ3MubXNzcWxCZWZvcmVGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMpIHtcbiAgICAgIGF3YWl0IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYmVmb3JlU3luYygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGludm9rZUFmdGVyRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEFmdGVyRnVuY3Rpb24pIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRVhFQ1VURSAlczsnLCBmdWxjcnVtLmFyZ3MubXNzcWxBZnRlckZ1bmN0aW9uKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYWZ0ZXJTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFmdGVyU3luYygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIHByb2dyZXNzKSB7XG4gICAgYXdhaXQgdGhpcy5yZWNyZWF0ZUZvcm1UYWJsZXMoZm9ybSwgYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRUYWJsZUxpc3QoKTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIHRydWUpO1xuICAgIH0pO1xuXG4gICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICB9XG5cbiAgYXN5bmMgY2xlYW51cEZyaWVuZGx5Vmlld3MoYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVmlld0xpc3QoKTtcblxuICAgIGNvbnN0IGFjdGl2ZVZpZXdOYW1lcyA9IFtdO1xuXG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGFjdGl2ZVZpZXdOYW1lcy5wdXNoKHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgbnVsbCkpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgIGFjdGl2ZVZpZXdOYW1lcy5wdXNoKHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlbW92ZSA9IGRpZmZlcmVuY2UodGhpcy52aWV3TmFtZXMsIGFjdGl2ZVZpZXdOYW1lcyk7XG5cbiAgICBmb3IgKGNvbnN0IHZpZXdOYW1lIG9mIHJlbW92ZSkge1xuICAgICAgaWYgKHZpZXdOYW1lLmluZGV4T2YoJ3ZpZXdfJykgPT09IDAgfHwgdmlld05hbWUuaW5kZXhPZigndmlldyAtICcpID09PSAwKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KFwiSUYgT0JKRUNUX0lEKCclcy4lcycsICdWJykgSVMgTk9UIE5VTEwgRFJPUCBWSUVXICVzLiVzO1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSkpKTtcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICB3YXJuKCdjbGVhbnVwRnJpZW5kbHlWaWV3cyBmYWlsZWQnKTtcbiAgICAgICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVidWlsZEZyaWVuZGx5Vmlld3MoZm9ybSwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cbiAgfVxuXG4gIGZvcm1WZXJzaW9uID0gKGZvcm0pID0+IHtcbiAgICBpZiAoZm9ybSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuICB9XG5cbiAgdXBkYXRlU3RhdHVzID0gKG1lc3NhZ2UpID0+IHtcbiAgICBpZiAocHJvY2Vzcy5zdGRvdXQuaXNUVFkpIHtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY3Vyc29yVG8oMCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShtZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkcm9wU3lzdGVtVGFibGVzKCkge1xuICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdCh0ZW1wbGF0ZURyb3ApKTtcbiAgfVxuXG4gIGNyZWF0ZURhdGFiYXNlKGRhdGFiYXNlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLnJ1bihgQ1JFQVRFIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfTtgKTtcbiAgfVxuXG4gIGRyb3BEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5ydW4oYERST1AgREFUQUJBU0UgJHtkYXRhYmFzZU5hbWV9O2ApO1xuICB9XG5cbiAgYXN5bmMgc2V0dXBEYXRhYmFzZSgpIHtcbiAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodmVyc2lvbjAwMSkpO1xuICB9XG5cbiAgcHJlcGFyZU1pZ3JhdGlvblNjcmlwdChzcWwpIHtcbiAgICByZXR1cm4gc3FsLnJlcGxhY2UoL19fU0NIRU1BX18vZywgdGhpcy5kYXRhU2NoZW1hKVxuICAgICAgICAgICAgICAucmVwbGFjZSgvX19WSUVXX1NDSEVNQV9fL2csIHRoaXMudmlld1NjaGVtYSkuc3BsaXQoJzsnKTtcbiAgfVxuXG4gIGFzeW5jIHNldHVwU3lzdGVtVGFibGVzKGFjY291bnQpIHtcbiAgICBjb25zdCBwcm9ncmVzcyA9IChuYW1lLCBpbmRleCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVTdGF0dXMobmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQpO1xuICAgIH07XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUGhvdG8oe30sIGFzeW5jIChwaG90bywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUGhvdG9zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVBob3RvKHBob3RvLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hWaWRlbyh7fSwgYXN5bmMgKHZpZGVvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdWaWRlb3MnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlVmlkZW8odmlkZW8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaEF1ZGlvKHt9LCBhc3luYyAoYXVkaW8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0F1ZGlvJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUF1ZGlvKGF1ZGlvLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hTaWduYXR1cmUoe30sIGFzeW5jIChzaWduYXR1cmUsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1NpZ25hdHVyZXMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlU2lnbmF0dXJlKHNpZ25hdHVyZSwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hhbmdlc2V0KHt9LCBhc3luYyAoY2hhbmdlc2V0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdDaGFuZ2VzZXRzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNoYW5nZXNldChjaGFuZ2VzZXQsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFJvbGUoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1JvbGVzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJvbGUob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hQcm9qZWN0KHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdQcm9qZWN0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVQcm9qZWN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoRm9ybSh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnRm9ybXMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaE1lbWJlcnNoaXAoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ01lbWJlcnNoaXBzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZU1lbWJlcnNoaXAob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDaG9pY2VMaXN0KHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdDaG9pY2UgTGlzdHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hvaWNlTGlzdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENsYXNzaWZpY2F0aW9uU2V0KHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdDbGFzc2lmaWNhdGlvbiBTZXRzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBtYXliZUluaXRpYWxpemUoKSB7XG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKHRoaXMudGFibGVOYW1lcy5pbmRleE9mKCdtaWdyYXRpb25zJykgPT09IC0xKSB7XG4gICAgICBsb2coJ0luaXRpdGFsaXppbmcgZGF0YWJhc2UuLi4nKTtcblxuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyBtYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCkge1xuICAgIHRoaXMubWlncmF0aW9ucyA9IChhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIG5hbWUgRlJPTSAkeyB0aGlzLmRhdGFTY2hlbWEgfS5taWdyYXRpb25zYCkpLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICBsZXQgcG9wdWxhdGVSZWNvcmRzID0gZmFsc2U7XG5cbiAgICBmb3IgKGxldCBjb3VudCA9IDI7IGNvdW50IDw9IENVUlJFTlRfVkVSU0lPTjsgKytjb3VudCkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IHBhZFN0YXJ0KGNvdW50LCAzLCAnMCcpO1xuXG4gICAgICBjb25zdCBuZWVkc01pZ3JhdGlvbiA9IHRoaXMubWlncmF0aW9ucy5pbmRleE9mKHZlcnNpb24pID09PSAtMSAmJiBNSUdSQVRJT05TW3ZlcnNpb25dO1xuXG4gICAgICBpZiAobmVlZHNNaWdyYXRpb24pIHtcbiAgICAgICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KE1JR1JBVElPTlNbdmVyc2lvbl0pKTtcblxuICAgICAgICBpZiAodmVyc2lvbiA9PT0gJzAwMicpIHtcbiAgICAgICAgICBsb2coJ1BvcHVsYXRpbmcgc3lzdGVtIHRhYmxlcy4uLicpO1xuICAgICAgICAgIHBvcHVsYXRlUmVjb3JkcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmVyc2lvbiA9PT0gJzAwNScpIHtcbiAgICAgICAgICBsb2coJ01pZ3JhdGluZyBkYXRlIGNhbGN1bGF0aW9uIGZpZWxkcy4uLicpO1xuICAgICAgICAgIGF3YWl0IHRoaXMubWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0KGFjY291bnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvcHVsYXRlUmVjb3Jkcykge1xuICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZVJlY29yZHMoYWNjb3VudCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcG9wdWxhdGVSZWNvcmRzKGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGluZGV4ID0gMDtcblxuICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMucHJvZ3Jlc3MoZm9ybS5uYW1lLCBpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdChhY2NvdW50KSB7XG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGNvbnN0IGZpZWxkcyA9IGZvcm0uZWxlbWVudHNPZlR5cGUoJ0NhbGN1bGF0ZWRGaWVsZCcpLmZpbHRlcihlbGVtZW50ID0+IGVsZW1lbnQuZGlzcGxheS5pc0RhdGUpO1xuXG4gICAgICBpZiAoZmllbGRzLmxlbmd0aCkge1xuICAgICAgICBsb2coJ01pZ3JhdGluZyBkYXRlIGNhbGN1bGF0aW9uIGZpZWxkcyBpbiBmb3JtLi4uJywgZm9ybS5uYW1lKTtcblxuICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsICgpID0+IHt9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm9ncmVzcyA9IChuYW1lLCBpbmRleCkgPT4ge1xuICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgfVxufVxuIl19