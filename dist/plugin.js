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
      var _ref4 = _asyncToGenerator(function* ({ account, tasks }) {
        yield _this.invokeBeforeFunction();
      });

      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    })();

    this.onSyncFinish = (() => {
      var _ref5 = _asyncToGenerator(function* ({ account }) {
        yield _this.cleanupFriendlyViews(account);
        yield _this.invokeAfterFunction();
      });

      return function (_x4) {
        return _ref5.apply(this, arguments);
      };
    })();

    this.onFormSave = (() => {
      var _ref6 = _asyncToGenerator(function* ({ form, account, oldForm, newForm }) {
        yield _this.updateForm(form, account, oldForm, newForm);
      });

      return function (_x5) {
        return _ref6.apply(this, arguments);
      };
    })();

    this.onFormDelete = (() => {
      var _ref7 = _asyncToGenerator(function* ({ form, account }) {
        const oldForm = {
          id: form._id,
          row_id: form.rowID,
          name: form._name,
          elements: form._elementsJSON
        };

        yield _this.updateForm(form, account, oldForm, null);
      });

      return function (_x6) {
        return _ref7.apply(this, arguments);
      };
    })();

    this.onRecordSave = (() => {
      var _ref8 = _asyncToGenerator(function* ({ record, account }) {
        yield _this.updateRecord(record, account);
      });

      return function (_x7) {
        return _ref8.apply(this, arguments);
      };
    })();

    this.onRecordDelete = (() => {
      var _ref9 = _asyncToGenerator(function* ({ record }) {
        const statements = _mssqlRecordValues2.default.deleteForRecordStatements(_this.mssql, record, record.form, _this.recordValueOptions);

        yield _this.run(statements.map(function (o) {
          return o.sql;
        }).join('\n'));
      });

      return function (_x8) {
        return _ref9.apply(this, arguments);
      };
    })();

    this.onPhotoSave = (() => {
      var _ref10 = _asyncToGenerator(function* ({ photo, account }) {
        yield _this.updatePhoto(photo, account);
      });

      return function (_x9) {
        return _ref10.apply(this, arguments);
      };
    })();

    this.onVideoSave = (() => {
      var _ref11 = _asyncToGenerator(function* ({ video, account }) {
        yield _this.updateVideo(video, account);
      });

      return function (_x10) {
        return _ref11.apply(this, arguments);
      };
    })();

    this.onAudioSave = (() => {
      var _ref12 = _asyncToGenerator(function* ({ audio, account }) {
        yield _this.updateAudio(audio, account);
      });

      return function (_x11) {
        return _ref12.apply(this, arguments);
      };
    })();

    this.onSignatureSave = (() => {
      var _ref13 = _asyncToGenerator(function* ({ signature, account }) {
        yield _this.updateSignature(signature, account);
      });

      return function (_x12) {
        return _ref13.apply(this, arguments);
      };
    })();

    this.onChangesetSave = (() => {
      var _ref14 = _asyncToGenerator(function* ({ changeset, account }) {
        yield _this.updateChangeset(changeset, account);
      });

      return function (_x13) {
        return _ref14.apply(this, arguments);
      };
    })();

    this.onChoiceListSave = (() => {
      var _ref15 = _asyncToGenerator(function* ({ choiceList, account }) {
        yield _this.updateChoiceList(choiceList, account);
      });

      return function (_x14) {
        return _ref15.apply(this, arguments);
      };
    })();

    this.onClassificationSetSave = (() => {
      var _ref16 = _asyncToGenerator(function* ({ classificationSet, account }) {
        yield _this.updateClassificationSet(classificationSet, account);
      });

      return function (_x15) {
        return _ref16.apply(this, arguments);
      };
    })();

    this.onProjectSave = (() => {
      var _ref17 = _asyncToGenerator(function* ({ project, account }) {
        yield _this.updateProject(project, account);
      });

      return function (_x16) {
        return _ref17.apply(this, arguments);
      };
    })();

    this.onRoleSave = (() => {
      var _ref18 = _asyncToGenerator(function* ({ role, account }) {
        yield _this.updateRole(role, account);
      });

      return function (_x17) {
        return _ref18.apply(this, arguments);
      };
    })();

    this.onMembershipSave = (() => {
      var _ref19 = _asyncToGenerator(function* ({ membership, account }) {
        yield _this.updateMembership(membership, account);
      });

      return function (_x18) {
        return _ref19.apply(this, arguments);
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
      var _ref22 = _asyncToGenerator(function* (record, account, skipTableCheck) {
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

      return function (_x19, _x20, _x21) {
        return _ref22.apply(this, arguments);
      };
    })();

    this.rootTableExists = form => {
      return this.tableNames.indexOf(_mssqlRecordValues2.default.tableNameWithForm(form, null, this.recordValueOptions)) !== -1;
    };

    this.recreateFormTables = (() => {
      var _ref23 = _asyncToGenerator(function* (form, account) {
        try {
          yield _this.updateForm(form, account, _this.formVersion(form), null);
        } catch (ex) {
          if (fulcrum.args.debug) {
            error(ex);
          }
        }

        yield _this.updateForm(form, account, null, _this.formVersion(form));
      });

      return function (_x22, _x23) {
        return _ref23.apply(this, arguments);
      };
    })();

    this.updateForm = (() => {
      var _ref24 = _asyncToGenerator(function* (form, account, oldForm, newForm) {
        if (_this.mssqlCustomModule && _this.mssqlCustomModule.shouldUpdateForm && !_this.mssqlCustomModule.shouldUpdateForm({ form, account })) {
          return;
        }

        try {
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

          yield _this.dropFriendlyView(form, null);

          for (const repeatable of form.elementsOfType('Repeatable')) {
            yield _this.dropFriendlyView(form, repeatable);
          }

          yield _this.runAll(['BEGIN TRANSACTION;', ...statements, 'COMMIT TRANSACTION;']);

          if (newForm) {
            yield _this.createFriendlyView(form, null);

            for (const repeatable of form.elementsOfType('Repeatable')) {
              yield _this.createFriendlyView(form, repeatable);
            }
          }
        } catch (ex) {
          _this.integrityWarning(ex);
          throw ex;
        }
      });

      return function (_x24, _x25, _x26, _x27) {
        return _ref24.apply(this, arguments);
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
        var _ref25 = _asyncToGenerator(function* (record) {
          record.form = form;

          if (++index % 10 === 0) {
            progress(index);
          }

          yield _this21.updateRecord(record, account, true);
        });

        return function (_x28) {
          return _ref25.apply(this, arguments);
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
        var _ref26 = _asyncToGenerator(function* (photo, { index }) {
          if (++index % 10 === 0) {
            progress('Photos', index);
          }

          yield _this26.updatePhoto(photo, account);
        });

        return function (_x29, _x30) {
          return _ref26.apply(this, arguments);
        };
      })());

      yield account.findEachVideo({}, (() => {
        var _ref27 = _asyncToGenerator(function* (video, { index }) {
          if (++index % 10 === 0) {
            progress('Videos', index);
          }

          yield _this26.updateVideo(video, account);
        });

        return function (_x31, _x32) {
          return _ref27.apply(this, arguments);
        };
      })());

      yield account.findEachAudio({}, (() => {
        var _ref28 = _asyncToGenerator(function* (audio, { index }) {
          if (++index % 10 === 0) {
            progress('Audio', index);
          }

          yield _this26.updateAudio(audio, account);
        });

        return function (_x33, _x34) {
          return _ref28.apply(this, arguments);
        };
      })());

      yield account.findEachSignature({}, (() => {
        var _ref29 = _asyncToGenerator(function* (signature, { index }) {
          if (++index % 10 === 0) {
            progress('Signatures', index);
          }

          yield _this26.updateSignature(signature, account);
        });

        return function (_x35, _x36) {
          return _ref29.apply(this, arguments);
        };
      })());

      yield account.findEachChangeset({}, (() => {
        var _ref30 = _asyncToGenerator(function* (changeset, { index }) {
          if (++index % 10 === 0) {
            progress('Changesets', index);
          }

          yield _this26.updateChangeset(changeset, account);
        });

        return function (_x37, _x38) {
          return _ref30.apply(this, arguments);
        };
      })());

      yield account.findEachRole({}, (() => {
        var _ref31 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Roles', index);
          }

          yield _this26.updateRole(object, account);
        });

        return function (_x39, _x40) {
          return _ref31.apply(this, arguments);
        };
      })());

      yield account.findEachProject({}, (() => {
        var _ref32 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Projects', index);
          }

          yield _this26.updateProject(object, account);
        });

        return function (_x41, _x42) {
          return _ref32.apply(this, arguments);
        };
      })());

      yield account.findEachForm({}, (() => {
        var _ref33 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Forms', index);
          }

          yield _this26.updateFormObject(object, account);
        });

        return function (_x43, _x44) {
          return _ref33.apply(this, arguments);
        };
      })());

      yield account.findEachMembership({}, (() => {
        var _ref34 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Memberships', index);
          }

          yield _this26.updateMembership(object, account);
        });

        return function (_x45, _x46) {
          return _ref34.apply(this, arguments);
        };
      })());

      yield account.findEachChoiceList({}, (() => {
        var _ref35 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Choice Lists', index);
          }

          yield _this26.updateChoiceList(object, account);
        });

        return function (_x47, _x48) {
          return _ref35.apply(this, arguments);
        };
      })());

      yield account.findEachClassificationSet({}, (() => {
        var _ref36 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Classification Sets', index);
          }

          yield _this26.updateClassificationSet(object, account);
        });

        return function (_x49, _x50) {
          return _ref36.apply(this, arguments);
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
          var _ref37 = _asyncToGenerator(function* (record) {
            record.form = form;

            if (++index % 10 === 0) {
              _this29.progress(form.name, index);
            }

            yield _this29.updateRecord(record, account, false);
          });

          return function (_x51) {
            return _ref37.apply(this, arguments);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJDVVJSRU5UX1ZFUlNJT04iLCJERUZBVUxUX1NDSEVNQSIsImxvZyIsIndhcm4iLCJlcnJvciIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJ0YWJsZU5hbWUiLCJyb3dJRCIsInVzZUFjY291bnRQcmVmaXgiLCJvblN5bmNTdGFydCIsInRhc2tzIiwib25TeW5jRmluaXNoIiwiY2xlYW51cEZyaWVuZGx5Vmlld3MiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJzaG91bGRVcGRhdGVGb3JtIiwidXBkYXRlRm9ybU9iamVjdCIsIm9wdGlvbnMiLCJkaXNhYmxlQXJyYXlzIiwiZGlzYWJsZUNvbXBsZXhUeXBlcyIsInVzZXJNb2R1bGUiLCJ0YWJsZVNjaGVtYSIsImNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQiLCJtZXRhZGF0YSIsInVzZVJlc291cmNlSUQiLCJwZXJzaXN0ZW50VGFibGVOYW1lcyIsImFjY291bnRQcmVmaXgiLCJnZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaW50ZWdyaXR5V2FybmluZyIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwic3Rkb3V0IiwiaXNUVFkiLCJjbGVhckxpbmUiLCJjdXJzb3JUbyIsIndyaXRlIiwicHJvZ3Jlc3MiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNzcWxDb25uZWN0aW9uU3RyaW5nIiwidHlwZSIsIm1zc3FsRGF0YWJhc2UiLCJkZWZhdWx0IiwibXNzcWxIb3N0IiwiaG9zdCIsIm1zc3FsUG9ydCIsIm1zc3FsVXNlciIsIm1zc3FsUGFzc3dvcmQiLCJtc3NxbFNjaGVtYSIsIm1zc3FsU2NoZW1hVmlld3MiLCJtc3NxbFN5bmNFdmVudHMiLCJtc3NxbEJlZm9yZUZ1bmN0aW9uIiwibXNzcWxBZnRlckZ1bmN0aW9uIiwicmVxdWlyZWQiLCJtc3NxbFJlcG9ydEJhc2VVcmwiLCJtc3NxbE1lZGlhQmFzZVVybCIsIm1zc3FsVW5kZXJzY29yZU5hbWVzIiwibXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lcyIsIm1zc3FsUHJlZml4IiwiaGFuZGxlciIsInN1YnN0cmluZyIsInVzZVN5bmNFdmVudHMiLCJ1c2VyIiwicGFzc3dvcmQiLCJyZXF1aXJlIiwiYXBwIiwiY29ubmVjdCIsIm9uIiwic2V0dXBPcHRpb25zIiwibWF5YmVJbml0aWFsaXplIiwiZGVhY3RpdmF0ZSIsImNsb3NlIiwib2JqZWN0IiwidmFsdWVzIiwiZmlsZSIsImFjY2Vzc19rZXkiLCJ0YWJsZSIsImRlbGV0ZVN0YXRlbWVudCIsInJvd19yZXNvdXJjZV9pZCIsImluc2VydFN0YXRlbWVudCIsInBrIiwic3RhY2siLCJzY2hlbWEiLCJ2YWx1ZXNUcmFuc2Zvcm1lciIsIm1lZGlhVVJMRm9ybWF0dGVyIiwibWVkaWFWYWx1ZSIsIml0ZW1zIiwiaXRlbSIsImVsZW1lbnQiLCJpc1Bob3RvRWxlbWVudCIsIm1lZGlhSUQiLCJpc1ZpZGVvRWxlbWVudCIsImlzQXVkaW9FbGVtZW50IiwibWVkaWFWaWV3VVJMRm9ybWF0dGVyIiwiaWRzIiwicmVwb3J0VVJMRm9ybWF0dGVyIiwiZmVhdHVyZSIsInZpZXdOYW1lIiwiZ2V0RnJpZW5kbHlUYWJsZU5hbWUiLCJ0YWJsZU5hbWVXaXRoRm9ybUFuZFNjaGVtYSIsImRhdGFOYW1lIiwiZm9ybUlEIiwicHJlZml4Iiwia2V5Iiwib2JqZWN0TmFtZSIsImJlZm9yZVN5bmMiLCJhZnRlclN5bmMiLCJmaW5kRWFjaFJlY29yZCIsImFjdGl2ZVZpZXdOYW1lcyIsInJlbW92ZSIsInByZXBhcmVNaWdyYXRpb25TY3JpcHQiLCJkYXRhYmFzZU5hbWUiLCJzcGxpdCIsImZpbmRFYWNoUGhvdG8iLCJmaW5kRWFjaFZpZGVvIiwiZmluZEVhY2hBdWRpbyIsImZpbmRFYWNoU2lnbmF0dXJlIiwiZmluZEVhY2hDaGFuZ2VzZXQiLCJmaW5kRWFjaFJvbGUiLCJmaW5kRWFjaFByb2plY3QiLCJmaW5kRWFjaEZvcm0iLCJmaW5kRWFjaE1lbWJlcnNoaXAiLCJmaW5kRWFjaENob2ljZUxpc3QiLCJmaW5kRWFjaENsYXNzaWZpY2F0aW9uU2V0IiwibWF5YmVSdW5NaWdyYXRpb25zIiwibWlncmF0aW9ucyIsInBvcHVsYXRlUmVjb3JkcyIsImNvdW50IiwidmVyc2lvbiIsIm5lZWRzTWlncmF0aW9uIiwibWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0IiwiZmllbGRzIiwiZmlsdGVyIiwiZGlzcGxheSIsImlzRGF0ZSIsImxlbmd0aCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7O0lBS1lBLEc7O0FBSlo7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7Ozs7QUFFQSxNQUFNQyx3QkFBd0IsR0FBOUI7O0FBRUEsTUFBTUMsZUFBZTtBQUNuQkMsWUFBVSxZQURTO0FBRW5CQyxVQUFRLFdBRlc7QUFHbkJDLFFBQU0sSUFIYTtBQUluQkMsT0FBSyxFQUpjO0FBS25CQyxxQkFBbUI7QUFMQSxDQUFyQjs7QUFRQSxNQUFNQyxhQUFhO0FBQ2pCLDBCQURpQjtBQUVqQiwwQkFGaUI7QUFHakIsMEJBSGlCO0FBSWpCLDJCQUppQjtBQUtqQjtBQUxpQixDQUFuQjs7QUFRQSxNQUFNQyxrQkFBa0IsQ0FBeEI7O0FBRUEsTUFBTUMsaUJBQWlCLEtBQXZCOztBQUVBLE1BQU0sRUFBRUMsR0FBRixFQUFPQyxJQUFQLEVBQWFDLEtBQWIsS0FBdUJDLFFBQVFDLE1BQVIsQ0FBZUMsV0FBZixDQUEyQixPQUEzQixDQUE3Qjs7a0JBRWUsTUFBTTtBQUFBO0FBQUE7O0FBQUEsU0EwSG5CQyxVQTFIbUIscUJBMEhOLGFBQVk7QUFDdkIsWUFBTSxNQUFLQyxR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LGNBQUwsQ0FBb0IsRUFBcEI7QUFBQSx5Q0FBd0IsV0FBT2xLLE1BQVAsRUFBa0I7QUFDOUNBLG1CQUFPakQsSUFBUCxHQUFjQSxJQUFkOztBQUVBLGdCQUFJLEVBQUVNLEtBQUYsR0FBVSxFQUFWLEtBQWlCLENBQXJCLEVBQXdCO0FBQ3RCLHNCQUFLbUksUUFBTCxDQUFjekksS0FBS1EsSUFBbkIsRUFBeUJGLEtBQXpCO0FBQ0Q7O0FBRUQsa0JBQU0sUUFBSzRDLFlBQUwsQ0FBa0JELE1BQWxCLEVBQTBCekQsT0FBMUIsRUFBbUMsS0FBbkMsQ0FBTjtBQUNELFdBUks7O0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBTjtBQVNEO0FBakI0QjtBQWtCOUI7O0FBRUtrUCxtQ0FBTixDQUF3Q2xQLE9BQXhDLEVBQWlEO0FBQUE7O0FBQUE7QUFDL0MsWUFBTU0sUUFBUSxNQUFNTixRQUFRTyxlQUFSLENBQXdCLEVBQXhCLENBQXBCOztBQUVBLFdBQUssTUFBTUMsSUFBWCxJQUFtQkYsS0FBbkIsRUFBMEI7QUFDeEIsY0FBTTZPLFNBQVMzTyxLQUFLK0gsY0FBTCxDQUFvQixpQkFBcEIsRUFBdUM2RyxNQUF2QyxDQUE4QztBQUFBLGlCQUFXNUMsUUFBUTZDLE9BQVIsQ0FBZ0JDLE1BQTNCO0FBQUEsU0FBOUMsQ0FBZjs7QUFFQSxZQUFJSCxPQUFPSSxNQUFYLEVBQW1CO0FBQ2pCeFEsY0FBSSw4Q0FBSixFQUFvRHlCLEtBQUtRLElBQXpEOztBQUVBLGdCQUFNLFFBQUtILFdBQUwsQ0FBaUJMLElBQWpCLEVBQXVCUixPQUF2QixFQUFnQyxZQUFNLENBQUUsQ0FBeEMsQ0FBTjtBQUNEO0FBQ0Y7QUFYOEM7QUFZaEQ7O0FBdCtCa0IsQyIsImZpbGUiOiJwbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbXNzcWwgZnJvbSAnbXNzcWwnO1xuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgTVNTUUxTY2hlbWEgZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgTVNTUUwgfSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCBNU1NRTFJlY29yZFZhbHVlcyBmcm9tICcuL21zc3FsLXJlY29yZC12YWx1ZXMnXG5pbXBvcnQgc25ha2UgZnJvbSAnc25ha2UtY2FzZSc7XG5pbXBvcnQgdGVtcGxhdGVEcm9wIGZyb20gJy4vdGVtcGxhdGUuZHJvcC5zcWwnO1xuaW1wb3J0IFNjaGVtYU1hcCBmcm9tICcuL3NjaGVtYS1tYXAnO1xuaW1wb3J0ICogYXMgYXBpIGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IHsgY29tcGFjdCwgZGlmZmVyZW5jZSwgcGFkU3RhcnQgfSBmcm9tICdsb2Rhc2gnO1xuXG5pbXBvcnQgdmVyc2lvbjAwMSBmcm9tICcuL3ZlcnNpb24tMDAxLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMiBmcm9tICcuL3ZlcnNpb24tMDAyLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMyBmcm9tICcuL3ZlcnNpb24tMDAzLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNCBmcm9tICcuL3ZlcnNpb24tMDA0LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNSBmcm9tICcuL3ZlcnNpb24tMDA1LnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNiBmcm9tICcuL3ZlcnNpb24tMDA2LnNxbCc7XG5cbmNvbnN0IE1BWF9JREVOVElGSUVSX0xFTkdUSCA9IDEwMDtcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBzZXJ2ZXI6ICdsb2NhbGhvc3QnLFxuICBwb3J0OiAxNDMzLFxuICBtYXg6IDEwLFxuICBpZGxlVGltZW91dE1pbGxpczogMzAwMDBcbn07XG5cbmNvbnN0IE1JR1JBVElPTlMgPSB7XG4gICcwMDInOiB2ZXJzaW9uMDAyLFxuICAnMDAzJzogdmVyc2lvbjAwMyxcbiAgJzAwNCc6IHZlcnNpb24wMDQsXG4gICcwMDUnOiB2ZXJzaW9uMDA1LFxuICAnMDA2JzogdmVyc2lvbjAwNlxufTtcblxuY29uc3QgQ1VSUkVOVF9WRVJTSU9OID0gNjtcblxuY29uc3QgREVGQVVMVF9TQ0hFTUEgPSAnZGJvJztcblxuY29uc3QgeyBsb2csIHdhcm4sIGVycm9yIH0gPSBmdWxjcnVtLmxvZ2dlci53aXRoQ29udGV4dCgnbXNzcWwnKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAnbXNzcWwnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgbXNzcWwgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBtc3NxbENvbm5lY3Rpb25TdHJpbmc6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgY29ubmVjdGlvbiBzdHJpbmcgKG92ZXJyaWRlcyBhbGwgaW5kaXZpZHVhbCBkYXRhYmFzZSBjb25uZWN0aW9uIHBhcmFtZXRlcnMpJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbERhdGFiYXNlOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGRhdGFiYXNlIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5kYXRhYmFzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEhvc3Q6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIGhvc3QnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5ob3N0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUG9ydDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgcG9ydCcsXG4gICAgICAgICAgdHlwZTogJ2ludGVnZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5wb3J0XG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsVXNlcjoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCB1c2VyJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBhc3N3b3JkOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHBhc3N3b3JkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNjaGVtYToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2NoZW1hVmlld3M6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hIGZvciB0aGUgZnJpZW5kbHkgdmlld3MnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3luY0V2ZW50czoge1xuICAgICAgICAgIGRlc2M6ICdhZGQgc3luYyBldmVudCBob29rcycsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxCZWZvcmVGdW5jdGlvbjoge1xuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYmVmb3JlIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbEFmdGVyRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGFmdGVyIHRoZSBzeW5jJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRm9ybToge1xuICAgICAgICAgIGRlc2M6ICd0aGUgZm9ybSBJRCB0byByZWJ1aWxkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlcG9ydEJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAncmVwb3J0IFVSTCBiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbE1lZGlhQmFzZVVybDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxVbmRlcnNjb3JlTmFtZXM6IHtcbiAgICAgICAgICBkZXNjOiAndXNlIHVuZGVyc2NvcmUgbmFtZXMgKGUuZy4gXCJQYXJrIEluc3BlY3Rpb25zXCIgYmVjb21lcyBcInBhcmtfaW5zcGVjdGlvbnNcIiknLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgc2VydmVyIGlkIGluIHRoZSBmb3JtIHRhYmxlIG5hbWVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUHJlZml4OiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB0aGUgb3JnYW5pemF0aW9uIElEIGFzIGEgcHJlZml4IGluIHRoZSBvYmplY3QgbmFtZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFJlYnVpbGRWaWV3c09ubHk6IHtcbiAgICAgICAgICBkZXNjOiAnb25seSByZWJ1aWxkIHRoZSB2aWV3cycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEN1c3RvbU1vZHVsZToge1xuICAgICAgICAgIGRlc2M6ICdhIGN1c3RvbSBtb2R1bGUgdG8gbG9hZCB3aXRoIHN5bmMgZXh0ZW5zaW9ucyAoZXhwZXJpbWVudGFsKScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2V0dXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2V0dXAgdGhlIGRhdGFiYXNlJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRHJvcDoge1xuICAgICAgICAgIGRlc2M6ICdkcm9wIHRoZSBzeXN0ZW0gdGFibGVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU3lzdGVtVGFibGVzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IGNyZWF0ZSB0aGUgc3lzdGVtIHJlY29yZHMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcERhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbERyb3ApIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcFN5c3RlbVRhYmxlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTZXR1cCkge1xuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTeXN0ZW1UYWJsZXNPbmx5KSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuXG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxGb3JtICYmIGZvcm0uaWQgIT09IGZ1bGNydW0uYXJncy5tc3NxbEZvcm0pIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZWJ1aWxkVmlld3NPbmx5KSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIChpbmRleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoZm9ybS5uYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCArICcgcmVjb3JkcycpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nKCcnKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgdHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikge1xuICAgIHJldHVybiBpZGVudGlmaWVyLnN1YnN0cmluZygwLCBNQVhfSURFTlRJRklFUl9MRU5HVEgpO1xuICB9XG5cbiAgZXNjYXBlSWRlbnRpZmllciA9IChpZGVudGlmaWVyKSA9PiB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIgJiYgdGhpcy5tc3NxbC5pZGVudCh0aGlzLnRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcbiAgfVxuXG4gIGdldCB1c2VTeW5jRXZlbnRzKCkge1xuICAgIHJldHVybiBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzICE9IG51bGwgPyBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzIDogdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIHRoaXMuYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zc3FsSG9zdCB8fCBNU1NRTF9DT05GSUcuc2VydmVyLFxuICAgICAgcG9ydDogZnVsY3J1bS5hcmdzLm1zc3FsUG9ydCB8fCBNU1NRTF9DT05GSUcucG9ydCxcbiAgICAgIGRhdGFiYXNlOiBmdWxjcnVtLmFyZ3MubXNzcWxEYXRhYmFzZSB8fCBNU1NRTF9DT05GSUcuZGF0YWJhc2UsXG4gICAgICB1c2VyOiBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyIHx8IE1TU1FMX0NPTkZJRy51c2VyLFxuICAgICAgcGFzc3dvcmQ6IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkIHx8IE1TU1FMX0NPTkZJRy51c2VyXG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxVc2VyKSB7XG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCkge1xuICAgICAgb3B0aW9ucy5wYXNzd29yZCA9IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpIHtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgPSByZXF1aXJlKGZ1bGNydW0uYXJncy5tc3NxbEN1c3RvbU1vZHVsZSk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwaSA9IGFwaTtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYXBwID0gZnVsY3J1bTtcbiAgICB9XG5cbiAgICB0aGlzLmRpc2FibGVBcnJheXMgPSBmYWxzZTtcbiAgICB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMgPSB0cnVlO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFBlcnNpc3RlbnRUYWJsZU5hbWVzID09PSB0cnVlKSB7XG4gICAgICB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLnVzZUFjY291bnRQcmVmaXggPSAoZnVsY3J1bS5hcmdzLm1zc3FsUHJlZml4ICE9PSBmYWxzZSk7XG5cbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KGZ1bGNydW0uYXJncy5tc3NxbENvbm5lY3Rpb25TdHJpbmcgfHwgb3B0aW9ucyk7XG5cbiAgICBpZiAodGhpcy51c2VTeW5jRXZlbnRzKSB7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOnN0YXJ0JywgdGhpcy5vblN5bmNTdGFydCk7XG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOmZpbmlzaCcsIHRoaXMub25TeW5jRmluaXNoKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Bob3RvOnNhdmUnLCB0aGlzLm9uUGhvdG9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3ZpZGVvOnNhdmUnLCB0aGlzLm9uVmlkZW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2F1ZGlvOnNhdmUnLCB0aGlzLm9uQXVkaW9TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3NpZ25hdHVyZTpzYXZlJywgdGhpcy5vblNpZ25hdHVyZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hhbmdlc2V0OnNhdmUnLCB0aGlzLm9uQ2hhbmdlc2V0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6c2F2ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpkZWxldGUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdmb3JtOnNhdmUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignZm9ybTpkZWxldGUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbi1zZXQ6c2F2ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OmRlbGV0ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdyb2xlOnNhdmUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncm9sZTpkZWxldGUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdwcm9qZWN0OnNhdmUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpkZWxldGUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdtZW1iZXJzaGlwOnNhdmUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpkZWxldGUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgIH1cblxuICAgIHRoaXMudmlld1NjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYVZpZXdzIHx8IERFRkFVTFRfU0NIRU1BO1xuICAgIHRoaXMuZGF0YVNjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYSB8fCBERUZBVUxUX1NDSEVNQTtcblxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcbiAgICAvLyBjcmVhdGlvbiBvZiBuZXcgdGFibGVzIGV2ZW4gd2hlbiB0aGUgZm9ybSBpc24ndCB2ZXJzaW9uIDEuIElmIHRoZSB0YWJsZSBkb2Vzbid0XG4gICAgLy8gZXhpc3QsIHdlIGNhbiBwcmV0ZW5kIHRoZSBmb3JtIGlzIHZlcnNpb24gMSBzbyBpdCBjcmVhdGVzIGFsbCBuZXcgdGFibGVzIGluc3RlYWRcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIC8vIG1ha2UgYSBjbGllbnQgc28gd2UgY2FuIHVzZSBpdCB0byBidWlsZCBTUUwgc3RhdGVtZW50c1xuICAgIHRoaXMubXNzcWwgPSBuZXcgTVNTUUwoe30pO1xuXG4gICAgdGhpcy5zZXR1cE9wdGlvbnMoKTtcblxuICAgIGF3YWl0IHRoaXMubWF5YmVJbml0aWFsaXplKCk7XG4gIH1cblxuICBhc3luYyBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLnBvb2wpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJ1biA9IGFzeW5jIChzcWwpID0+IHtcbiAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFwwL2csICcnKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgIGxvZyhzcWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucG9vbC5yZXF1ZXN0KCkuYmF0Y2goc3FsKTtcblxuICAgIHJldHVybiByZXN1bHQucmVjb3Jkc2V0O1xuICB9XG5cbiAgcnVuQWxsID0gYXN5bmMgKHN0YXRlbWVudHMpID0+IHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICByZXN1bHRzLnB1c2goYXdhaXQgdGhpcy5ydW4oc3FsKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBsb2cgPSAoLi4uYXJncykgPT4ge1xuICAgIC8vIGNvbnNvbGUubG9nKC4uLmFyZ3MpO1xuICB9XG5cbiAgdGFibGVOYW1lID0gKGFjY291bnQsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuXG4gICAgaWYgKHRoaXMudXNlQWNjb3VudFByZWZpeCkge1xuICAgICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuXG4gIG9uU3luY1N0YXJ0ID0gYXN5bmMgKHthY2NvdW50LCB0YXNrc30pID0+IHtcbiAgICBhd2FpdCB0aGlzLmludm9rZUJlZm9yZUZ1bmN0aW9uKCk7XG4gIH1cblxuICBvblN5bmNGaW5pc2ggPSBhc3luYyAoe2FjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5jbGVhbnVwRnJpZW5kbHlWaWV3cyhhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLmludm9rZUFmdGVyRnVuY3Rpb24oKTtcbiAgfVxuXG4gIG9uRm9ybVNhdmUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm19KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pO1xuICB9XG5cbiAgb25Gb3JtRGVsZXRlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50fSkgPT4ge1xuICAgIGNvbnN0IG9sZEZvcm0gPSB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbnVsbCk7XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQpO1xuICB9XG5cbiAgb25SZWNvcmREZWxldGUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMuZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHJlY29yZC5mb3JtLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnRzLm1hcChvID0+IG8uc3FsKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICBvblBob3RvU2F2ZSA9IGFzeW5jICh7cGhvdG8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XG4gIH1cblxuICBvblZpZGVvU2F2ZSA9IGFzeW5jICh7dmlkZW8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gIH1cblxuICBvbkF1ZGlvU2F2ZSA9IGFzeW5jICh7YXVkaW8sIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVBdWRpbyhhdWRpbywgYWNjb3VudCk7XG4gIH1cblxuICBvblNpZ25hdHVyZVNhdmUgPSBhc3luYyAoe3NpZ25hdHVyZSwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVNpZ25hdHVyZShzaWduYXR1cmUsIGFjY291bnQpO1xuICB9XG5cbiAgb25DaGFuZ2VzZXRTYXZlID0gYXN5bmMgKHtjaGFuZ2VzZXQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe2Nob2ljZUxpc3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KGNob2ljZUxpc3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25DbGFzc2lmaWNhdGlvblNldFNhdmUgPSBhc3luYyAoe2NsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQoY2xhc3NpZmljYXRpb25TZXQsIGFjY291bnQpO1xuICB9XG5cbiAgb25Qcm9qZWN0U2F2ZSA9IGFzeW5jICh7cHJvamVjdCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3QocHJvamVjdCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJvbGVTYXZlID0gYXN5bmMgKHtyb2xlLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShyb2xlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uTWVtYmVyc2hpcFNhdmUgPSBhc3luYyAoe21lbWJlcnNoaXAsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG1lbWJlcnNoaXAsIGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUGhvdG8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnBob3RvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0UGhvdG9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAncGhvdG9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVWaWRlbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAudmlkZW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRWaWRlb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICd2aWRlb3MnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUF1ZGlvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5hdWRpbyhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdEF1ZGlvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ2F1ZGlvJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVTaWduYXR1cmUob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnNpZ25hdHVyZShvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFNpZ25hdHVyZVVSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdzaWduYXR1cmVzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaGFuZ2VzZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNoYW5nZXNldChvYmplY3QpLCAnY2hhbmdlc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucHJvamVjdChvYmplY3QpLCAncHJvamVjdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU1lbWJlcnNoaXAob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLm1lbWJlcnNoaXAob2JqZWN0KSwgJ21lbWJlcnNoaXBzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yb2xlKG9iamVjdCksICdyb2xlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuZm9ybShvYmplY3QpLCAnZm9ybXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNob2ljZUxpc3Qob2JqZWN0KSwgJ2Nob2ljZV9saXN0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCksICdjbGFzc2lmaWNhdGlvbl9zZXRzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVPYmplY3QodmFsdWVzLCB0YWJsZSkge1xuICAgIGNvbnN0IGRlbGV0ZVN0YXRlbWVudCA9IHRoaXMubXNzcWwuZGVsZXRlU3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB7cm93X3Jlc291cmNlX2lkOiB2YWx1ZXMucm93X3Jlc291cmNlX2lkfSk7XG4gICAgY29uc3QgaW5zZXJ0U3RhdGVtZW50ID0gdGhpcy5tc3NxbC5pbnNlcnRTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHZhbHVlcywge3BrOiAnaWQnfSk7XG5cbiAgICBjb25zdCBzcWwgPSBbIGRlbGV0ZVN0YXRlbWVudC5zcWwsIGluc2VydFN0YXRlbWVudC5zcWwgXS5qb2luKCdcXG4nKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihzcWwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgcmVsb2FkVGFibGVMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIHJlbG9hZFZpZXdMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLnZpZXdTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudmlld05hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgYmFzZU1lZGlhVVJMID0gKCkgPT4ge1xuICB9XG5cbiAgZm9ybWF0UGhvdG9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zLyR7IGlkIH0uanBnYDtcbiAgfVxuXG4gIGZvcm1hdFZpZGVvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy8keyBpZCB9Lm1wNGA7XG4gIH1cblxuICBmb3JtYXRBdWRpb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9hdWRpby8keyBpZCB9Lm00YWA7XG4gIH1cblxuICBmb3JtYXRTaWduYXR1cmVVUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vc2lnbmF0dXJlcy8keyBpZCB9LnBuZ2A7XG4gIH1cblxuICBpbnRlZ3JpdHlXYXJuaW5nKGV4KSB7XG4gICAgd2FybihgXG4tLS0tLS0tLS0tLS0tXG4hISBXQVJOSU5HICEhXG4tLS0tLS0tLS0tLS0tXG5cbk1TU1FMIGRhdGFiYXNlIGludGVncml0eSBpc3N1ZSBlbmNvdW50ZXJlZC4gQ29tbW9uIHNvdXJjZXMgb2YgZGF0YWJhc2UgaXNzdWVzIGFyZTpcblxuKiBSZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIGFuZCB1c2luZyBhbiBvbGQgTVNTUUwgZGF0YWJhc2Ugd2l0aG91dCByZWNyZWF0aW5nXG4gIHRoZSBNU1NRTCBkYXRhYmFzZS5cbiogRGVsZXRpbmcgdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlIGFuZCB1c2luZyBhbiBleGlzdGluZyBNU1NRTCBkYXRhYmFzZVxuKiBNYW51YWxseSBtb2RpZnlpbmcgdGhlIE1TU1FMIGRhdGFiYXNlXG4qIENyZWF0aW5nIG11bHRpcGxlIGFwcHMgaW4gRnVsY3J1bSB3aXRoIHRoZSBzYW1lIG5hbWUuIFRoaXMgaXMgZ2VuZXJhbGx5IE9LLCBleGNlcHRcbiAgeW91IHdpbGwgbm90IGJlIGFibGUgdG8gdXNlIHRoZSBcImZyaWVuZGx5IHZpZXdcIiBmZWF0dXJlIG9mIHRoZSBNU1NRTCBwbHVnaW4gc2luY2VcbiAgdGhlIHZpZXcgbmFtZXMgYXJlIGRlcml2ZWQgZnJvbSB0aGUgZm9ybSBuYW1lcy5cblxuTm90ZTogV2hlbiByZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIG9yIFwic3RhcnRpbmcgb3ZlclwiIHlvdSBuZWVkIHRvIGRyb3AgYW5kIHJlLWNyZWF0ZVxudGhlIE1TU1FMIGRhdGFiYXNlLiBUaGUgbmFtZXMgb2YgZGF0YWJhc2Ugb2JqZWN0cyBhcmUgdGllZCBkaXJlY3RseSB0byB0aGUgZGF0YWJhc2Vcbm9iamVjdHMgaW4gdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlLlxuXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblJlcG9ydCBpc3N1ZXMgYXQgaHR0cHM6Ly9naXRodWIuY29tL2Z1bGNydW1hcHAvZnVsY3J1bS1kZXNrdG9wL2lzc3Vlc1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5NZXNzYWdlOlxuJHsgZXgubWVzc2FnZSB9XG5cblN0YWNrOlxuJHsgZXguc3RhY2sgfVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5gLnJlZFxuICAgICk7XG4gIH1cblxuICBzZXR1cE9wdGlvbnMoKSB7XG4gICAgdGhpcy5iYXNlTWVkaWFVUkwgPSBmdWxjcnVtLmFyZ3MubXNzcWxNZWRpYUJhc2VVcmwgPyBmdWxjcnVtLmFyZ3MubXNzcWxNZWRpYUJhc2VVcmwgOiAnaHR0cHM6Ly9hcGkuZnVsY3J1bWFwcC5jb20vYXBpL3YyJztcblxuICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zID0ge1xuICAgICAgc2NoZW1hOiB0aGlzLmRhdGFTY2hlbWEsXG5cbiAgICAgIGVzY2FwZUlkZW50aWZpZXI6IHRoaXMuZXNjYXBlSWRlbnRpZmllcixcblxuICAgICAgZGlzYWJsZUFycmF5czogdGhpcy5kaXNhYmxlQXJyYXlzLFxuXG4gICAgICBwZXJzaXN0ZW50VGFibGVOYW1lczogdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyxcblxuICAgICAgYWNjb3VudFByZWZpeDogdGhpcy51c2VBY2NvdW50UHJlZml4ID8gJ2FjY291bnRfJyArIHRoaXMuYWNjb3VudC5yb3dJRCA6IG51bGwsXG5cbiAgICAgIGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQ6ICdkYXRlJyxcblxuICAgICAgZGlzYWJsZUNvbXBsZXhUeXBlczogdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzLFxuXG4gICAgICB2YWx1ZXNUcmFuc2Zvcm1lcjogdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnZhbHVlc1RyYW5zZm9ybWVyLFxuXG4gICAgICBtZWRpYVVSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcblxuICAgICAgICByZXR1cm4gbWVkaWFWYWx1ZS5pdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRQaG90b1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRWaWRlb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRBdWRpb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIG1lZGlhVmlld1VSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgaWRzID0gbWVkaWFWYWx1ZS5pdGVtcy5tYXAobyA9PiBvLm1lZGlhSUQpO1xuXG4gICAgICAgIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNQaG90b0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zL3ZpZXc/cGhvdG9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNWaWRlb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zL3ZpZXc/dmlkZW9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNBdWRpb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vdmlldz9hdWRpbz0keyBpZHMgfWA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwpIHtcbiAgICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zLnJlcG9ydFVSTEZvcm1hdHRlciA9IChmZWF0dXJlKSA9PiB7XG4gICAgICAgIHJldHVybiBgJHsgZnVsY3J1bS5hcmdzLm1zc3FsUmVwb3J0QmFzZVVybCB9L3JlcG9ydHMvJHsgZmVhdHVyZS5pZCB9LnBkZmA7XG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZVJlY29yZCA9IGFzeW5jIChyZWNvcmQsIGFjY291bnQsIHNraXBUYWJsZUNoZWNrKSA9PiB7XG4gICAgaWYgKCFza2lwVGFibGVDaGVjayAmJiAhdGhpcy5yb290VGFibGVFeGlzdHMocmVjb3JkLmZvcm0pKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKHJlY29yZC5mb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVSZWNvcmQgJiYgIXRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkKHtyZWNvcmQsIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy51cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuXG4gICAgY29uc3Qgc3lzdGVtVmFsdWVzID0gTVNTUUxSZWNvcmRWYWx1ZXMuc3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZShyZWNvcmQsIG51bGwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnJlY29yZChyZWNvcmQsIHN5c3RlbVZhbHVlcyksICdyZWNvcmRzJyk7XG4gIH1cblxuICByb290VGFibGVFeGlzdHMgPSAoZm9ybSkgPT4ge1xuICAgIHJldHVybiB0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZihNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtLCBudWxsLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucykpICE9PSAtMTtcbiAgfVxuXG4gIHJlY3JlYXRlRm9ybVRhYmxlcyA9IGFzeW5jIChmb3JtLCBhY2NvdW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pLCBudWxsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBlcnJvcihleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG51bGwsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSkpO1xuICB9XG5cbiAgdXBkYXRlRm9ybSA9IGFzeW5jIChmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKSA9PiB7XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0oe2Zvcm0sIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3QoZm9ybSwgYWNjb3VudCk7XG5cbiAgICAgIGlmICghdGhpcy5yb290VGFibGVFeGlzdHMoZm9ybSkgJiYgbmV3Rm9ybSAhPSBudWxsKSB7XG4gICAgICAgIG9sZEZvcm0gPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBkaXNhYmxlQXJyYXlzOiB0aGlzLmRpc2FibGVBcnJheXMsXG4gICAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IGZhbHNlLFxuICAgICAgICB1c2VyTW9kdWxlOiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLFxuICAgICAgICB0YWJsZVNjaGVtYTogdGhpcy5kYXRhU2NoZW1hLFxuICAgICAgICBjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0OiAnZGF0ZScsXG4gICAgICAgIG1ldGFkYXRhOiB0cnVlLFxuICAgICAgICB1c2VSZXNvdXJjZUlEOiB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzLFxuICAgICAgICBhY2NvdW50UHJlZml4OiB0aGlzLnVzZUFjY291bnRQcmVmaXggPyAnYWNjb3VudF8nICsgdGhpcy5hY2NvdW50LnJvd0lEIDogbnVsbFxuICAgICAgfTtcblxuICAgICAgY29uc3Qge3N0YXRlbWVudHN9ID0gYXdhaXQgTVNTUUxTY2hlbWEuZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzKGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0sIG9wdGlvbnMpO1xuXG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnJ1bkFsbChbJ0JFR0lOIFRSQU5TQUNUSU9OOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgLi4uc3RhdGVtZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAnQ09NTUlUIFRSQU5TQUNUSU9OOyddKTtcblxuICAgICAgaWYgKG5ld0Zvcm0pIHtcbiAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KFwiSUYgT0JKRUNUX0lEKCclcy4lcycsICdWJykgSVMgTk9UIE5VTEwgRFJPUCBWSUVXICVzLiVzO1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdDUkVBVEUgVklFVyAlcy4lcyBBUyBTRUxFQ1QgKiBGUk9NICVzOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybUFuZFNjaGVtYShmb3JtLCByZXBlYXRhYmxlLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucywgJ192aWV3X2Z1bGwnKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBnZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3QgbmFtZSA9IGNvbXBhY3QoW2Zvcm0ubmFtZSwgcmVwZWF0YWJsZSAmJiByZXBlYXRhYmxlLmRhdGFOYW1lXSkuam9pbignIC0gJylcblxuICAgIGNvbnN0IGZvcm1JRCA9IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMgPyBmb3JtLmlkIDogZm9ybS5yb3dJRDtcblxuICAgIGNvbnN0IHByZWZpeCA9IGNvbXBhY3QoWyd2aWV3JywgZm9ybUlELCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUua2V5XSkuam9pbignIC0gJyk7XG5cbiAgICBjb25zdCBvYmplY3ROYW1lID0gW3ByZWZpeCwgbmFtZV0uam9pbignIC0gJyk7XG5cbiAgICByZXR1cm4gdGhpcy50cmltSWRlbnRpZmllcihmdWxjcnVtLmFyZ3MubXNzcWxVbmRlcnNjb3JlTmFtZXMgIT09IGZhbHNlID8gc25ha2Uob2JqZWN0TmFtZSkgOiBvYmplY3ROYW1lKTtcbiAgfVxuXG4gIGFzeW5jIGludm9rZUJlZm9yZUZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxCZWZvcmVGdW5jdGlvbikge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdFWEVDVVRFICVzOycsIGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYmVmb3JlU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgaW52b2tlQWZ0ZXJGdW5jdGlvbigpIHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdFWEVDVVRFICVzOycsIGZ1bGNydW0uYXJncy5tc3NxbEFmdGVyRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMpIHtcbiAgICAgIGF3YWl0IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYWZ0ZXJTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgcHJvZ3Jlc3MpIHtcbiAgICBhd2FpdCB0aGlzLnJlY3JlYXRlRm9ybVRhYmxlcyhmb3JtLCBhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFRhYmxlTGlzdCgpO1xuXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIGF3YWl0IGZvcm0uZmluZEVhY2hSZWNvcmQoe30sIGFzeW5jIChyZWNvcmQpID0+IHtcbiAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcblxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcyhpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBwcm9ncmVzcyhpbmRleCk7XG4gIH1cblxuICBhc3luYyBjbGVhbnVwRnJpZW5kbHlWaWV3cyhhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRWaWV3TGlzdCgpO1xuXG4gICAgY29uc3QgYWN0aXZlVmlld05hbWVzID0gW107XG5cbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgYWN0aXZlVmlld05hbWVzLnB1c2godGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCBudWxsKSk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgYWN0aXZlVmlld05hbWVzLnB1c2godGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlID0gZGlmZmVyZW5jZSh0aGlzLnZpZXdOYW1lcywgYWN0aXZlVmlld05hbWVzKTtcblxuICAgIGZvciAoY29uc3Qgdmlld05hbWUgb2YgcmVtb3ZlKSB7XG4gICAgICBpZiAodmlld05hbWUuaW5kZXhPZigndmlld18nKSA9PT0gMCB8fCB2aWV3TmFtZS5pbmRleE9mKCd2aWV3IC0gJykgPT09IDApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoXCJJRiBPQkpFQ1RfSUQoJyVzLiVzJywgJ1YnKSBJUyBOT1QgTlVMTCBEUk9QIFZJRVcgJXMuJXM7XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cblxuICB1cGRhdGVTdGF0dXMgPSAobWVzc2FnZSkgPT4ge1xuICAgIGlmIChwcm9jZXNzLnN0ZG91dC5pc1RUWSkge1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BTeXN0ZW1UYWJsZXMoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHRlbXBsYXRlRHJvcCkpO1xuICB9XG5cbiAgY3JlYXRlRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBDUkVBVEUgREFUQUJBU0UgJHtkYXRhYmFzZU5hbWV9O2ApO1xuICB9XG5cbiAgZHJvcERhdGFiYXNlKGRhdGFiYXNlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLnJ1bihgRFJPUCBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBhc3luYyBzZXR1cERhdGFiYXNlKCkge1xuICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdCh2ZXJzaW9uMDAxKSk7XG4gIH1cblxuICBwcmVwYXJlTWlncmF0aW9uU2NyaXB0KHNxbCkge1xuICAgIHJldHVybiBzcWwucmVwbGFjZSgvX19TQ0hFTUFfXy9nLCB0aGlzLmRhdGFTY2hlbWEpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9fX1ZJRVdfU0NIRU1BX18vZywgdGhpcy52aWV3U2NoZW1hKS5zcGxpdCgnOycpO1xuICB9XG5cbiAgYXN5bmMgc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCkge1xuICAgIGNvbnN0IHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gICAgfTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hQaG90byh7fSwgYXN5bmMgKHBob3RvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdQaG90b3MnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFZpZGVvKHt9LCBhc3luYyAodmlkZW8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1ZpZGVvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQXVkaW8oe30sIGFzeW5jIChhdWRpbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQXVkaW8nLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFNpZ25hdHVyZSh7fSwgYXN5bmMgKHNpZ25hdHVyZSwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnU2lnbmF0dXJlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDaGFuZ2VzZXQoe30sIGFzeW5jIChjaGFuZ2VzZXQsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NoYW5nZXNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUm9sZSh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUm9sZXMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFByb2plY3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Byb2plY3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hGb3JtKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdGb3JtcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoTWVtYmVyc2hpcCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnTWVtYmVyc2hpcHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENob2ljZUxpc3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Nob2ljZSBMaXN0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NsYXNzaWZpY2F0aW9uIFNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlSW5pdGlhbGl6ZSgpIHtcbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAodGhpcy50YWJsZU5hbWVzLmluZGV4T2YoJ21pZ3JhdGlvbnMnKSA9PT0gLTEpIHtcbiAgICAgIGxvZygnSW5pdGl0YWxpemluZyBkYXRhYmFzZS4uLicpO1xuXG4gICAgICBhd2FpdCB0aGlzLnNldHVwRGF0YWJhc2UoKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9ucyhhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlUnVuTWlncmF0aW9ucyhhY2NvdW50KSB7XG4gICAgdGhpcy5taWdyYXRpb25zID0gKGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgbmFtZSBGUk9NICR7IHRoaXMuZGF0YVNjaGVtYSB9Lm1pZ3JhdGlvbnNgKSkubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIGxldCBwb3B1bGF0ZVJlY29yZHMgPSBmYWxzZTtcblxuICAgIGZvciAobGV0IGNvdW50ID0gMjsgY291bnQgPD0gQ1VSUkVOVF9WRVJTSU9OOyArK2NvdW50KSB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gcGFkU3RhcnQoY291bnQsIDMsICcwJyk7XG5cbiAgICAgIGNvbnN0IG5lZWRzTWlncmF0aW9uID0gdGhpcy5taWdyYXRpb25zLmluZGV4T2YodmVyc2lvbikgPT09IC0xICYmIE1JR1JBVElPTlNbdmVyc2lvbl07XG5cbiAgICAgIGlmIChuZWVkc01pZ3JhdGlvbikge1xuICAgICAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQoTUlHUkFUSU9OU1t2ZXJzaW9uXSkpO1xuXG4gICAgICAgIGlmICh2ZXJzaW9uID09PSAnMDAyJykge1xuICAgICAgICAgIGxvZygnUG9wdWxhdGluZyBzeXN0ZW0gdGFibGVzLi4uJyk7XG4gICAgICAgICAgcG9wdWxhdGVSZWNvcmRzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2ZXJzaW9uID09PSAnMDA1Jykge1xuICAgICAgICAgIGxvZygnTWlncmF0aW5nIGRhdGUgY2FsY3VsYXRpb24gZmllbGRzLi4uJyk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5taWdyYXRlQ2FsY3VsYXRlZEZpZWxkc0RhdGVGb3JtYXQoYWNjb3VudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9wdWxhdGVSZWNvcmRzKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvcHVsYXRlUmVjb3JkcyhhY2NvdW50KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBwb3B1bGF0ZVJlY29yZHMoYWNjb3VudCkge1xuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgaW5kZXggPSAwO1xuXG4gICAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcblxuICAgICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5wcm9ncmVzcyhmb3JtLm5hbWUsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgZmFsc2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0KGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgY29uc3QgZmllbGRzID0gZm9ybS5lbGVtZW50c09mVHlwZSgnQ2FsY3VsYXRlZEZpZWxkJykuZmlsdGVyKGVsZW1lbnQgPT4gZWxlbWVudC5kaXNwbGF5LmlzRGF0ZSk7XG5cbiAgICAgIGlmIChmaWVsZHMubGVuZ3RoKSB7XG4gICAgICAgIGxvZygnTWlncmF0aW5nIGRhdGUgY2FsY3VsYXRpb24gZmllbGRzIGluIGZvcm0uLi4nLCBmb3JtLm5hbWUpO1xuXG4gICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgdGhpcy51cGRhdGVTdGF0dXMobmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQpO1xuICB9XG59XG4iXX0=