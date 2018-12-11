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
        yield _this17.run((0, _util.format)('DROP VIEW IF EXISTS %s.%s;', _this17.escapeIdentifier(_this17.viewSchema), _this17.escapeIdentifier(viewName)));
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
            yield _this22.run((0, _util.format)('DROP VIEW IF EXISTS %s.%s;', _this22.escapeIdentifier(_this22.viewSchema), _this22.escapeIdentifier(viewName)));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJDVVJSRU5UX1ZFUlNJT04iLCJERUZBVUxUX1NDSEVNQSIsImxvZyIsIndhcm4iLCJlcnJvciIsImZ1bGNydW0iLCJsb2dnZXIiLCJ3aXRoQ29udGV4dCIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImFyZ3MiLCJtc3NxbENyZWF0ZURhdGFiYXNlIiwiY3JlYXRlRGF0YWJhc2UiLCJtc3NxbERyb3BEYXRhYmFzZSIsImRyb3BEYXRhYmFzZSIsIm1zc3FsRHJvcCIsImRyb3BTeXN0ZW1UYWJsZXMiLCJtc3NxbFNldHVwIiwic2V0dXBEYXRhYmFzZSIsImFjY291bnQiLCJmZXRjaEFjY291bnQiLCJvcmciLCJtc3NxbFN5c3RlbVRhYmxlc09ubHkiLCJzZXR1cFN5c3RlbVRhYmxlcyIsImludm9rZUJlZm9yZUZ1bmN0aW9uIiwiZm9ybXMiLCJmaW5kQWN0aXZlRm9ybXMiLCJmb3JtIiwibXNzcWxGb3JtIiwiaWQiLCJtc3NxbFJlYnVpbGRWaWV3c09ubHkiLCJyZWJ1aWxkRnJpZW5kbHlWaWV3cyIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlc2NhcGVJZGVudGlmaWVyIiwiaWRlbnRpZmllciIsIm1zc3FsIiwiaWRlbnQiLCJ0cmltSWRlbnRpZmllciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJ0YWJsZU5hbWUiLCJyb3dJRCIsInVzZUFjY291bnRQcmVmaXgiLCJvblN5bmNTdGFydCIsInRhc2tzIiwib25TeW5jRmluaXNoIiwiY2xlYW51cEZyaWVuZGx5Vmlld3MiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJzaG91bGRVcGRhdGVGb3JtIiwidXBkYXRlRm9ybU9iamVjdCIsIm9wdGlvbnMiLCJkaXNhYmxlQXJyYXlzIiwiZGlzYWJsZUNvbXBsZXhUeXBlcyIsInVzZXJNb2R1bGUiLCJ0YWJsZVNjaGVtYSIsImNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQiLCJtZXRhZGF0YSIsInVzZVJlc291cmNlSUQiLCJwZXJzaXN0ZW50VGFibGVOYW1lcyIsImFjY291bnRQcmVmaXgiLCJnZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaW50ZWdyaXR5V2FybmluZyIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwic3Rkb3V0IiwiaXNUVFkiLCJjbGVhckxpbmUiLCJjdXJzb3JUbyIsIndyaXRlIiwicHJvZ3Jlc3MiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNzcWxDb25uZWN0aW9uU3RyaW5nIiwidHlwZSIsIm1zc3FsRGF0YWJhc2UiLCJkZWZhdWx0IiwibXNzcWxIb3N0IiwiaG9zdCIsIm1zc3FsUG9ydCIsIm1zc3FsVXNlciIsIm1zc3FsUGFzc3dvcmQiLCJtc3NxbFNjaGVtYSIsIm1zc3FsU2NoZW1hVmlld3MiLCJtc3NxbFN5bmNFdmVudHMiLCJtc3NxbEJlZm9yZUZ1bmN0aW9uIiwibXNzcWxBZnRlckZ1bmN0aW9uIiwicmVxdWlyZWQiLCJtc3NxbFJlcG9ydEJhc2VVcmwiLCJtc3NxbE1lZGlhQmFzZVVybCIsIm1zc3FsVW5kZXJzY29yZU5hbWVzIiwibXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lcyIsIm1zc3FsUHJlZml4IiwiaGFuZGxlciIsInN1YnN0cmluZyIsInVzZVN5bmNFdmVudHMiLCJ1c2VyIiwicGFzc3dvcmQiLCJyZXF1aXJlIiwiYXBwIiwiY29ubmVjdCIsIm9uIiwic2V0dXBPcHRpb25zIiwibWF5YmVJbml0aWFsaXplIiwiZGVhY3RpdmF0ZSIsImNsb3NlIiwib2JqZWN0IiwidmFsdWVzIiwiZmlsZSIsImFjY2Vzc19rZXkiLCJ0YWJsZSIsImRlbGV0ZVN0YXRlbWVudCIsInJvd19yZXNvdXJjZV9pZCIsImluc2VydFN0YXRlbWVudCIsInBrIiwic3RhY2siLCJzY2hlbWEiLCJ2YWx1ZXNUcmFuc2Zvcm1lciIsIm1lZGlhVVJMRm9ybWF0dGVyIiwibWVkaWFWYWx1ZSIsIml0ZW1zIiwiaXRlbSIsImVsZW1lbnQiLCJpc1Bob3RvRWxlbWVudCIsIm1lZGlhSUQiLCJpc1ZpZGVvRWxlbWVudCIsImlzQXVkaW9FbGVtZW50IiwibWVkaWFWaWV3VVJMRm9ybWF0dGVyIiwiaWRzIiwicmVwb3J0VVJMRm9ybWF0dGVyIiwiZmVhdHVyZSIsInZpZXdOYW1lIiwiZ2V0RnJpZW5kbHlUYWJsZU5hbWUiLCJ0YWJsZU5hbWVXaXRoRm9ybUFuZFNjaGVtYSIsImRhdGFOYW1lIiwiZm9ybUlEIiwicHJlZml4Iiwia2V5Iiwib2JqZWN0TmFtZSIsImJlZm9yZVN5bmMiLCJhZnRlclN5bmMiLCJmaW5kRWFjaFJlY29yZCIsImFjdGl2ZVZpZXdOYW1lcyIsInJlbW92ZSIsInByZXBhcmVNaWdyYXRpb25TY3JpcHQiLCJkYXRhYmFzZU5hbWUiLCJzcGxpdCIsImZpbmRFYWNoUGhvdG8iLCJmaW5kRWFjaFZpZGVvIiwiZmluZEVhY2hBdWRpbyIsImZpbmRFYWNoU2lnbmF0dXJlIiwiZmluZEVhY2hDaGFuZ2VzZXQiLCJmaW5kRWFjaFJvbGUiLCJmaW5kRWFjaFByb2plY3QiLCJmaW5kRWFjaEZvcm0iLCJmaW5kRWFjaE1lbWJlcnNoaXAiLCJmaW5kRWFjaENob2ljZUxpc3QiLCJmaW5kRWFjaENsYXNzaWZpY2F0aW9uU2V0IiwibWF5YmVSdW5NaWdyYXRpb25zIiwibWlncmF0aW9ucyIsInBvcHVsYXRlUmVjb3JkcyIsImNvdW50IiwidmVyc2lvbiIsIm5lZWRzTWlncmF0aW9uIiwibWlncmF0ZUNhbGN1bGF0ZWRGaWVsZHNEYXRlRm9ybWF0IiwiZmllbGRzIiwiZmlsdGVyIiwiZGlzcGxheSIsImlzRGF0ZSIsImxlbmd0aCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7O0lBS1lBLEc7O0FBSlo7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7Ozs7QUFFQSxNQUFNQyx3QkFBd0IsR0FBOUI7O0FBRUEsTUFBTUMsZUFBZTtBQUNuQkMsWUFBVSxZQURTO0FBRW5CQyxVQUFRLFdBRlc7QUFHbkJDLFFBQU0sSUFIYTtBQUluQkMsT0FBSyxFQUpjO0FBS25CQyxxQkFBbUI7QUFMQSxDQUFyQjs7QUFRQSxNQUFNQyxhQUFhO0FBQ2pCLDBCQURpQjtBQUVqQiwwQkFGaUI7QUFHakIsMEJBSGlCO0FBSWpCLDJCQUppQjtBQUtqQjtBQUxpQixDQUFuQjs7QUFRQSxNQUFNQyxrQkFBa0IsQ0FBeEI7O0FBRUEsTUFBTUMsaUJBQWlCLEtBQXZCOztBQUVBLE1BQU0sRUFBRUMsR0FBRixFQUFPQyxJQUFQLEVBQWFDLEtBQWIsS0FBdUJDLFFBQVFDLE1BQVIsQ0FBZUMsV0FBZixDQUEyQixPQUEzQixDQUE3Qjs7a0JBRWUsTUFBTTtBQUFBO0FBQUE7O0FBQUEsU0EwSG5CQyxVQTFIbUIscUJBMEhOLGFBQVk7QUFDdkIsWUFBTSxNQUFLQyxR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QUtRLElBQW5CLEVBQXlCRixLQUF6QjtBQUNEOztBQUVELGtCQUFNLFFBQUs0QyxZQUFMLENBQWtCRCxNQUFsQixFQUEwQnpELE9BQTFCLEVBQW1DLEtBQW5DLENBQU47QUFDRCxXQVJLOztBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQU47QUFTRDtBQWpCNEI7QUFrQjlCOztBQUVLa1AsbUNBQU4sQ0FBd0NsUCxPQUF4QyxFQUFpRDtBQUFBOztBQUFBO0FBQy9DLFlBQU1NLFFBQVEsTUFBTU4sUUFBUU8sZUFBUixDQUF3QixFQUF4QixDQUFwQjs7QUFFQSxXQUFLLE1BQU1DLElBQVgsSUFBbUJGLEtBQW5CLEVBQTBCO0FBQ3hCLGNBQU02TyxTQUFTM08sS0FBSytILGNBQUwsQ0FBb0IsaUJBQXBCLEVBQXVDNkcsTUFBdkMsQ0FBOEM7QUFBQSxpQkFBVzVDLFFBQVE2QyxPQUFSLENBQWdCQyxNQUEzQjtBQUFBLFNBQTlDLENBQWY7O0FBRUEsWUFBSUgsT0FBT0ksTUFBWCxFQUFtQjtBQUNqQnhRLGNBQUksOENBQUosRUFBb0R5QixLQUFLUSxJQUF6RDs7QUFFQSxnQkFBTSxRQUFLSCxXQUFMLENBQWlCTCxJQUFqQixFQUF1QlIsT0FBdkIsRUFBZ0MsWUFBTSxDQUFFLENBQXhDLENBQU47QUFDRDtBQUNGO0FBWDhDO0FBWWhEOztBQWwrQmtCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1zc3FsIGZyb20gJ21zc3FsJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IE1TU1FMIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgTVNTUUxSZWNvcmRWYWx1ZXMgZnJvbSAnLi9tc3NxbC1yZWNvcmQtdmFsdWVzJ1xuaW1wb3J0IHNuYWtlIGZyb20gJ3NuYWtlLWNhc2UnO1xuaW1wb3J0IHRlbXBsYXRlRHJvcCBmcm9tICcuL3RlbXBsYXRlLmRyb3Auc3FsJztcbmltcG9ydCBTY2hlbWFNYXAgZnJvbSAnLi9zY2hlbWEtbWFwJztcbmltcG9ydCAqIGFzIGFwaSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCB7IGNvbXBhY3QsIGRpZmZlcmVuY2UsIHBhZFN0YXJ0IH0gZnJvbSAnbG9kYXNoJztcblxuaW1wb3J0IHZlcnNpb24wMDEgZnJvbSAnLi92ZXJzaW9uLTAwMS5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDIgZnJvbSAnLi92ZXJzaW9uLTAwMi5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDMgZnJvbSAnLi92ZXJzaW9uLTAwMy5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDQgZnJvbSAnLi92ZXJzaW9uLTAwNC5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDUgZnJvbSAnLi92ZXJzaW9uLTAwNS5zcWwnO1xuaW1wb3J0IHZlcnNpb24wMDYgZnJvbSAnLi92ZXJzaW9uLTAwNi5zcWwnO1xuXG5jb25zdCBNQVhfSURFTlRJRklFUl9MRU5HVEggPSAxMDA7XG5cbmNvbnN0IE1TU1FMX0NPTkZJRyA9IHtcbiAgZGF0YWJhc2U6ICdmdWxjcnVtYXBwJyxcbiAgc2VydmVyOiAnbG9jYWxob3N0JyxcbiAgcG9ydDogMTQzMyxcbiAgbWF4OiAxMCxcbiAgaWRsZVRpbWVvdXRNaWxsaXM6IDMwMDAwXG59O1xuXG5jb25zdCBNSUdSQVRJT05TID0ge1xuICAnMDAyJzogdmVyc2lvbjAwMixcbiAgJzAwMyc6IHZlcnNpb24wMDMsXG4gICcwMDQnOiB2ZXJzaW9uMDA0LFxuICAnMDA1JzogdmVyc2lvbjAwNSxcbiAgJzAwNic6IHZlcnNpb24wMDZcbn07XG5cbmNvbnN0IENVUlJFTlRfVkVSU0lPTiA9IDY7XG5cbmNvbnN0IERFRkFVTFRfU0NIRU1BID0gJ2Ribyc7XG5cbmNvbnN0IHsgbG9nLCB3YXJuLCBlcnJvciB9ID0gZnVsY3J1bS5sb2dnZXIud2l0aENvbnRleHQoJ21zc3FsJyk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ21zc3FsJyxcbiAgICAgIGRlc2M6ICdydW4gdGhlIG1zc3FsIHN5bmMgZm9yIGEgc3BlY2lmaWMgb3JnYW5pemF0aW9uJyxcbiAgICAgIGJ1aWxkZXI6IHtcbiAgICAgICAgbXNzcWxDb25uZWN0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGNvbm5lY3Rpb24gc3RyaW5nIChvdmVycmlkZXMgYWxsIGluZGl2aWR1YWwgZGF0YWJhc2UgY29ubmVjdGlvbiBwYXJhbWV0ZXJzKScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxEYXRhYmFzZToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBkYXRhYmFzZSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuZGF0YWJhc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxIb3N0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBob3N0JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuaG9zdFxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBvcnQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIHBvcnQnLFxuICAgICAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcucG9ydFxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFVzZXI6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgdXNlcicsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQYXNzd29yZDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBwYXNzd29yZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTY2hlbWE6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNjaGVtYVZpZXdzOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYSBmb3IgdGhlIGZyaWVuZGx5IHZpZXdzJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFN5bmNFdmVudHM6IHtcbiAgICAgICAgICBkZXNjOiAnYWRkIHN5bmMgZXZlbnQgaG9va3MnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQmVmb3JlRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGJlZm9yZSB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxBZnRlckZ1bmN0aW9uOiB7XG4gICAgICAgICAgZGVzYzogJ2NhbGwgdGhpcyBmdW5jdGlvbiBhZnRlciB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbEZvcm06IHtcbiAgICAgICAgICBkZXNjOiAndGhlIGZvcm0gSUQgdG8gcmVidWlsZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxSZXBvcnRCYXNlVXJsOiB7XG4gICAgICAgICAgZGVzYzogJ3JlcG9ydCBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxNZWRpYUJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAnbWVkaWEgVVJMIGJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsVW5kZXJzY29yZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB1bmRlcnNjb3JlIG5hbWVzIChlLmcuIFwiUGFyayBJbnNwZWN0aW9uc1wiIGJlY29tZXMgXCJwYXJrX2luc3BlY3Rpb25zXCIpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lczoge1xuICAgICAgICAgIGRlc2M6ICd1c2UgdGhlIHNlcnZlciBpZCBpbiB0aGUgZm9ybSB0YWJsZSBuYW1lcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFByZWZpeDoge1xuICAgICAgICAgIGRlc2M6ICd1c2UgdGhlIG9yZ2FuaXphdGlvbiBJRCBhcyBhIHByZWZpeCBpbiB0aGUgb2JqZWN0IG5hbWVzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxSZWJ1aWxkVmlld3NPbmx5OiB7XG4gICAgICAgICAgZGVzYzogJ29ubHkgcmVidWlsZCB0aGUgdmlld3MnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxDdXN0b21Nb2R1bGU6IHtcbiAgICAgICAgICBkZXNjOiAnYSBjdXN0b20gbW9kdWxlIHRvIGxvYWQgd2l0aCBzeW5jIGV4dGVuc2lvbnMgKGV4cGVyaW1lbnRhbCknLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNldHVwOiB7XG4gICAgICAgICAgZGVzYzogJ3NldHVwIHRoZSBkYXRhYmFzZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbERyb3A6IHtcbiAgICAgICAgICBkZXNjOiAnZHJvcCB0aGUgc3lzdGVtIHRhYmxlcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFN5c3RlbVRhYmxlc09ubHk6IHtcbiAgICAgICAgICBkZXNjOiAnb25seSBjcmVhdGUgdGhlIHN5c3RlbSByZWNvcmRzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZURhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcERhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BTeXN0ZW1UYWJsZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU2V0dXApIHtcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU3lzdGVtVGFibGVzT25seSkge1xuICAgICAgICBhd2FpdCB0aGlzLnNldHVwU3lzdGVtVGFibGVzKGFjY291bnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcblxuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRm9ybSAmJiBmb3JtLmlkICE9PSBmdWxjcnVtLmFyZ3MubXNzcWxGb3JtKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUmVidWlsZFZpZXdzT25seSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZyaWVuZGx5Vmlld3MoZm9ybSwgYWNjb3VudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoaW5kZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvZygnJyk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQWZ0ZXJGdW5jdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIHRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gaWRlbnRpZmllci5zdWJzdHJpbmcoMCwgTUFYX0lERU5USUZJRVJfTEVOR1RIKTtcbiAgfVxuXG4gIGVzY2FwZUlkZW50aWZpZXIgPSAoaWRlbnRpZmllcikgPT4ge1xuICAgIHJldHVybiBpZGVudGlmaWVyICYmIHRoaXMubXNzcWwuaWRlbnQodGhpcy50cmltSWRlbnRpZmllcihpZGVudGlmaWVyKSk7XG4gIH1cblxuICBnZXQgdXNlU3luY0V2ZW50cygpIHtcbiAgICByZXR1cm4gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyAhPSBudWxsID8gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyA6IHRydWU7XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICB0aGlzLmFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAuLi5NU1NRTF9DT05GSUcsXG4gICAgICBzZXJ2ZXI6IGZ1bGNydW0uYXJncy5tc3NxbEhvc3QgfHwgTVNTUUxfQ09ORklHLnNlcnZlcixcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc3NxbFBvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zc3FsRGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zc3FsVXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCB8fCBNU1NRTF9DT05GSUcudXNlclxuICAgIH07XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsVXNlcikge1xuICAgICAgb3B0aW9ucy51c2VyID0gZnVsY3J1bS5hcmdzLm1zc3FsVXNlcjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUGFzc3dvcmQpIHtcbiAgICAgIG9wdGlvbnMucGFzc3dvcmQgPSBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZDtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3VzdG9tTW9kdWxlKSB7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlID0gcmVxdWlyZShmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpO1xuICAgICAgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hcGkgPSBhcGk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwcCA9IGZ1bGNydW07XG4gICAgfVxuXG4gICAgdGhpcy5kaXNhYmxlQXJyYXlzID0gZmFsc2U7XG4gICAgdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzID0gdHJ1ZTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQZXJzaXN0ZW50VGFibGVOYW1lcyA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy51c2VBY2NvdW50UHJlZml4ID0gKGZ1bGNydW0uYXJncy5tc3NxbFByZWZpeCAhPT0gZmFsc2UpO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChmdWxjcnVtLmFyZ3MubXNzcWxDb25uZWN0aW9uU3RyaW5nIHx8IG9wdGlvbnMpO1xuXG4gICAgaWYgKHRoaXMudXNlU3luY0V2ZW50cykge1xuICAgICAgZnVsY3J1bS5vbignc3luYzpzdGFydCcsIHRoaXMub25TeW5jU3RhcnQpO1xuICAgICAgZnVsY3J1bS5vbignc3luYzpmaW5pc2gnLCB0aGlzLm9uU3luY0ZpbmlzaCk7XG4gICAgICBmdWxjcnVtLm9uKCdwaG90bzpzYXZlJywgdGhpcy5vblBob3RvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCd2aWRlbzpzYXZlJywgdGhpcy5vblZpZGVvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdhdWRpbzpzYXZlJywgdGhpcy5vbkF1ZGlvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdzaWduYXR1cmU6c2F2ZScsIHRoaXMub25TaWduYXR1cmVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NoYW5nZXNldDpzYXZlJywgdGhpcy5vbkNoYW5nZXNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6ZGVsZXRlJywgdGhpcy5vblJlY29yZERlbGV0ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2Nob2ljZS1saXN0OnNhdmUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6ZGVsZXRlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignZm9ybTpzYXZlJywgdGhpcy5vbkZvcm1TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2Zvcm06ZGVsZXRlJywgdGhpcy5vbkZvcm1TYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OnNhdmUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uLXNldDpkZWxldGUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncm9sZTpzYXZlJywgdGhpcy5vblJvbGVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JvbGU6ZGVsZXRlJywgdGhpcy5vblJvbGVTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpzYXZlJywgdGhpcy5vblByb2plY3RTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Byb2plY3Q6ZGVsZXRlJywgdGhpcy5vblByb2plY3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpzYXZlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ21lbWJlcnNoaXA6ZGVsZXRlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICB9XG5cbiAgICB0aGlzLnZpZXdTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWFWaWV3cyB8fCBERUZBVUxUX1NDSEVNQTtcbiAgICB0aGlzLmRhdGFTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWEgfHwgREVGQVVMVF9TQ0hFTUE7XG5cbiAgICAvLyBGZXRjaCBhbGwgdGhlIGV4aXN0aW5nIHRhYmxlcyBvbiBzdGFydHVwLiBUaGlzIGFsbG93cyB1cyB0byBzcGVjaWFsIGNhc2UgdGhlXG4gICAgLy8gY3JlYXRpb24gb2YgbmV3IHRhYmxlcyBldmVuIHdoZW4gdGhlIGZvcm0gaXNuJ3QgdmVyc2lvbiAxLiBJZiB0aGUgdGFibGUgZG9lc24ndFxuICAgIC8vIGV4aXN0LCB3ZSBjYW4gcHJldGVuZCB0aGUgZm9ybSBpcyB2ZXJzaW9uIDEgc28gaXQgY3JlYXRlcyBhbGwgbmV3IHRhYmxlcyBpbnN0ZWFkXG4gICAgLy8gb2YgYXBwbHlpbmcgYSBzY2hlbWEgZGlmZi5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICAvLyBtYWtlIGEgY2xpZW50IHNvIHdlIGNhbiB1c2UgaXQgdG8gYnVpbGQgU1FMIHN0YXRlbWVudHNcbiAgICB0aGlzLm1zc3FsID0gbmV3IE1TU1FMKHt9KTtcblxuICAgIHRoaXMuc2V0dXBPcHRpb25zKCk7XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlSW5pdGlhbGl6ZSgpO1xuICB9XG5cbiAgYXN5bmMgZGVhY3RpdmF0ZSgpIHtcbiAgICBpZiAodGhpcy5wb29sKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvb2wuY2xvc2UoKTtcbiAgICB9XG4gIH1cblxuICBydW4gPSBhc3luYyAoc3FsKSA9PiB7XG4gICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcMC9nLCAnJyk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICBsb2coc3FsKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBvb2wucmVxdWVzdCgpLmJhdGNoKHNxbCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnJlY29yZHNldDtcbiAgfVxuXG4gIHJ1bkFsbCA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgcmVzdWx0cy5wdXNoKGF3YWl0IHRoaXMucnVuKHNxbCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgbG9nID0gKC4uLmFyZ3MpID0+IHtcbiAgICAvLyBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfVxuXG4gIHRhYmxlTmFtZSA9IChhY2NvdW50LCBuYW1lKSA9PiB7XG4gICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcblxuICAgIGlmICh0aGlzLnVzZUFjY291bnRQcmVmaXgpIHtcbiAgICAgIHJldHVybiAnYWNjb3VudF8nICsgYWNjb3VudC5yb3dJRCArICdfJyArIG5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxuICBvblN5bmNTdGFydCA9IGFzeW5jICh7YWNjb3VudCwgdGFza3N9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuICB9XG5cbiAgb25TeW5jRmluaXNoID0gYXN5bmMgKHthY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMuY2xlYW51cEZyaWVuZGx5Vmlld3MoYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gIH1cblxuICBvbkZvcm1TYXZlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcbiAgfVxuXG4gIG9uRm9ybURlbGV0ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudH0pID0+IHtcbiAgICBjb25zdCBvbGRGb3JtID0ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG51bGwpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuICB9XG5cbiAgb25QaG90b1NhdmUgPSBhc3luYyAoe3Bob3RvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICB9XG5cbiAgb25WaWRlb1NhdmUgPSBhc3luYyAoe3ZpZGVvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVmlkZW8odmlkZW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25BdWRpb1NhdmUgPSBhc3luYyAoe2F1ZGlvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25TaWduYXR1cmVTYXZlID0gYXN5bmMgKHtzaWduYXR1cmUsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hhbmdlc2V0U2F2ZSA9IGFzeW5jICh7Y2hhbmdlc2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNob2ljZUxpc3RTYXZlID0gYXN5bmMgKHtjaG9pY2VMaXN0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hvaWNlTGlzdChjaG9pY2VMaXN0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2xhc3NpZmljYXRpb25TZXRTYXZlID0gYXN5bmMgKHtjbGFzc2lmaWNhdGlvblNldCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KGNsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUHJvamVjdFNhdmUgPSBhc3luYyAoe3Byb2plY3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQcm9qZWN0KHByb2plY3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25Sb2xlU2F2ZSA9IGFzeW5jICh7cm9sZSwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJvbGUocm9sZSwgYWNjb3VudCk7XG4gIH1cblxuICBvbk1lbWJlcnNoaXBTYXZlID0gYXN5bmMgKHttZW1iZXJzaGlwLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChtZW1iZXJzaGlwLCBhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVBob3RvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5waG90byhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFBob3RvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3Bob3RvcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlVmlkZW8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnZpZGVvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0VmlkZW9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAndmlkZW9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVBdWRpbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAuYXVkaW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRBdWRpb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdhdWRpbycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlU2lnbmF0dXJlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5zaWduYXR1cmUob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRTaWduYXR1cmVVUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAnc2lnbmF0dXJlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2hhbmdlc2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaGFuZ2VzZXQob2JqZWN0KSwgJ2NoYW5nZXNldHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnByb2plY3Qob2JqZWN0KSwgJ3Byb2plY3RzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5tZW1iZXJzaGlwKG9iamVjdCksICdtZW1iZXJzaGlwcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucm9sZShvYmplY3QpLCAncm9sZXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmZvcm0ob2JqZWN0KSwgJ2Zvcm1zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaG9pY2VMaXN0KG9iamVjdCksICdjaG9pY2VfbGlzdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jbGFzc2lmaWNhdGlvblNldChvYmplY3QpLCAnY2xhc3NpZmljYXRpb25fc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlT2JqZWN0KHZhbHVlcywgdGFibGUpIHtcbiAgICBjb25zdCBkZWxldGVTdGF0ZW1lbnQgPSB0aGlzLm1zc3FsLmRlbGV0ZVN0YXRlbWVudChgJHsgdGhpcy5kYXRhU2NoZW1hIH0uc3lzdGVtXyR7dGFibGV9YCwge3Jvd19yZXNvdXJjZV9pZDogdmFsdWVzLnJvd19yZXNvdXJjZV9pZH0pO1xuICAgIGNvbnN0IGluc2VydFN0YXRlbWVudCA9IHRoaXMubXNzcWwuaW5zZXJ0U3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB2YWx1ZXMsIHtwazogJ2lkJ30pO1xuXG4gICAgY29uc3Qgc3FsID0gWyBkZWxldGVTdGF0ZW1lbnQuc3FsLCBpbnNlcnRTdGF0ZW1lbnQuc3FsIF0uam9pbignXFxuJyk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oc3FsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cbiAgfVxuXG4gIHJlbG9hZFRhYmxlTGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG4gIH1cblxuICByZWxvYWRWaWV3TGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy52aWV3U2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnZpZXdOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIGJhc2VNZWRpYVVSTCA9ICgpID0+IHtcbiAgfVxuXG4gIGZvcm1hdFBob3RvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy8keyBpZCB9LmpwZ2A7XG4gIH1cblxuICBmb3JtYXRWaWRlb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS92aWRlb3MvJHsgaWQgfS5tcDRgO1xuICB9XG5cbiAgZm9ybWF0QXVkaW9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vJHsgaWQgfS5tNGFgO1xuICB9XG5cbiAgZm9ybWF0U2lnbmF0dXJlVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3NpZ25hdHVyZXMvJHsgaWQgfS5wbmdgO1xuICB9XG5cbiAgaW50ZWdyaXR5V2FybmluZyhleCkge1xuICAgIHdhcm4oYFxuLS0tLS0tLS0tLS0tLVxuISEgV0FSTklORyAhIVxuLS0tLS0tLS0tLS0tLVxuXG5NU1NRTCBkYXRhYmFzZSBpbnRlZ3JpdHkgaXNzdWUgZW5jb3VudGVyZWQuIENvbW1vbiBzb3VyY2VzIG9mIGRhdGFiYXNlIGlzc3VlcyBhcmU6XG5cbiogUmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBhbmQgdXNpbmcgYW4gb2xkIE1TU1FMIGRhdGFiYXNlIHdpdGhvdXQgcmVjcmVhdGluZ1xuICB0aGUgTVNTUUwgZGF0YWJhc2UuXG4qIERlbGV0aW5nIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZSBhbmQgdXNpbmcgYW4gZXhpc3RpbmcgTVNTUUwgZGF0YWJhc2VcbiogTWFudWFsbHkgbW9kaWZ5aW5nIHRoZSBNU1NRTCBkYXRhYmFzZVxuKiBDcmVhdGluZyBtdWx0aXBsZSBhcHBzIGluIEZ1bGNydW0gd2l0aCB0aGUgc2FtZSBuYW1lLiBUaGlzIGlzIGdlbmVyYWxseSBPSywgZXhjZXB0XG4gIHlvdSB3aWxsIG5vdCBiZSBhYmxlIHRvIHVzZSB0aGUgXCJmcmllbmRseSB2aWV3XCIgZmVhdHVyZSBvZiB0aGUgTVNTUUwgcGx1Z2luIHNpbmNlXG4gIHRoZSB2aWV3IG5hbWVzIGFyZSBkZXJpdmVkIGZyb20gdGhlIGZvcm0gbmFtZXMuXG5cbk5vdGU6IFdoZW4gcmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBvciBcInN0YXJ0aW5nIG92ZXJcIiB5b3UgbmVlZCB0byBkcm9wIGFuZCByZS1jcmVhdGVcbnRoZSBNU1NRTCBkYXRhYmFzZS4gVGhlIG5hbWVzIG9mIGRhdGFiYXNlIG9iamVjdHMgYXJlIHRpZWQgZGlyZWN0bHkgdG8gdGhlIGRhdGFiYXNlXG5vYmplY3RzIGluIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZS5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5SZXBvcnQgaXNzdWVzIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9mdWxjcnVtYXBwL2Z1bGNydW0tZGVza3RvcC9pc3N1ZXNcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuTWVzc2FnZTpcbiR7IGV4Lm1lc3NhZ2UgfVxuXG5TdGFjazpcbiR7IGV4LnN0YWNrIH1cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuYC5yZWRcbiAgICApO1xuICB9XG5cbiAgc2V0dXBPcHRpb25zKCkge1xuICAgIHRoaXMuYmFzZU1lZGlhVVJMID0gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsID8gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsIDogJ2h0dHBzOi8vYXBpLmZ1bGNydW1hcHAuY29tL2FwaS92Mic7XG5cbiAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyA9IHtcbiAgICAgIHNjaGVtYTogdGhpcy5kYXRhU2NoZW1hLFxuXG4gICAgICBlc2NhcGVJZGVudGlmaWVyOiB0aGlzLmVzY2FwZUlkZW50aWZpZXIsXG5cbiAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcblxuICAgICAgcGVyc2lzdGVudFRhYmxlTmFtZXM6IHRoaXMucGVyc2lzdGVudFRhYmxlTmFtZXMsXG5cbiAgICAgIGFjY291bnRQcmVmaXg6IHRoaXMudXNlQWNjb3VudFByZWZpeCA/ICdhY2NvdW50XycgKyB0aGlzLmFjY291bnQucm93SUQgOiBudWxsLFxuXG4gICAgICBjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0OiAnZGF0ZScsXG5cbiAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IHRoaXMuZGlzYWJsZUNvbXBsZXhUeXBlcyxcblxuICAgICAgdmFsdWVzVHJhbnNmb3JtZXI6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS52YWx1ZXNUcmFuc2Zvcm1lcixcblxuICAgICAgbWVkaWFVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG5cbiAgICAgICAgcmV0dXJuIG1lZGlhVmFsdWUuaXRlbXMubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1Bob3RvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0UGhvdG9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0VmlkZW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0QXVkaW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBtZWRpYVZpZXdVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG4gICAgICAgIGNvbnN0IGlkcyA9IG1lZGlhVmFsdWUuaXRlbXMubWFwKG8gPT4gby5tZWRpYUlEKTtcblxuICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy92aWV3P3Bob3Rvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy92aWV3P3ZpZGVvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvL3ZpZXc/YXVkaW89JHsgaWRzIH1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZXBvcnRCYXNlVXJsKSB7XG4gICAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucy5yZXBvcnRVUkxGb3JtYXR0ZXIgPSAoZmVhdHVyZSkgPT4ge1xuICAgICAgICByZXR1cm4gYCR7IGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwgfS9yZXBvcnRzLyR7IGZlYXR1cmUuaWQgfS5wZGZgO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVSZWNvcmQgPSBhc3luYyAocmVjb3JkLCBhY2NvdW50LCBza2lwVGFibGVDaGVjaykgPT4ge1xuICAgIGlmICghc2tpcFRhYmxlQ2hlY2sgJiYgIXRoaXMucm9vdFRhYmxlRXhpc3RzKHJlY29yZC5mb3JtKSkge1xuICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShyZWNvcmQuZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZVJlY29yZCh7cmVjb3JkLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMudXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcblxuICAgIGNvbnN0IHN5c3RlbVZhbHVlcyA9IE1TU1FMUmVjb3JkVmFsdWVzLnN5c3RlbUNvbHVtblZhbHVlc0ZvckZlYXR1cmUocmVjb3JkLCBudWxsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yZWNvcmQocmVjb3JkLCBzeXN0ZW1WYWx1ZXMpLCAncmVjb3JkcycpO1xuICB9XG5cbiAgcm9vdFRhYmxlRXhpc3RzID0gKGZvcm0pID0+IHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU5hbWVzLmluZGV4T2YoTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSwgbnVsbCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpKSAhPT0gLTE7XG4gIH1cblxuICByZWNyZWF0ZUZvcm1UYWJsZXMgPSBhc3luYyAoZm9ybSwgYWNjb3VudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSwgbnVsbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgZXJyb3IoZXgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBudWxsLCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pKTtcbiAgfVxuXG4gIHVwZGF0ZUZvcm0gPSBhc3luYyAoZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSkgPT4ge1xuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSAmJiAhdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtKHtmb3JtLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KGZvcm0sIGFjY291bnQpO1xuXG4gICAgICBpZiAoIXRoaXMucm9vdFRhYmxlRXhpc3RzKGZvcm0pICYmIG5ld0Zvcm0gIT0gbnVsbCkge1xuICAgICAgICBvbGRGb3JtID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgZGlzYWJsZUFycmF5czogdGhpcy5kaXNhYmxlQXJyYXlzLFxuICAgICAgICBkaXNhYmxlQ29tcGxleFR5cGVzOiBmYWxzZSxcbiAgICAgICAgdXNlck1vZHVsZTogdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSxcbiAgICAgICAgdGFibGVTY2hlbWE6IHRoaXMuZGF0YVNjaGVtYSxcbiAgICAgICAgY2FsY3VsYXRlZEZpZWxkRGF0ZUZvcm1hdDogJ2RhdGUnLFxuICAgICAgICBtZXRhZGF0YTogdHJ1ZSxcbiAgICAgICAgdXNlUmVzb3VyY2VJRDogdGhpcy5wZXJzaXN0ZW50VGFibGVOYW1lcyxcbiAgICAgICAgYWNjb3VudFByZWZpeDogdGhpcy51c2VBY2NvdW50UHJlZml4ID8gJ2FjY291bnRfJyArIHRoaXMuYWNjb3VudC5yb3dJRCA6IG51bGxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHtzdGF0ZW1lbnRzfSA9IGF3YWl0IE1TU1FMU2NoZW1hLmdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtLCBvcHRpb25zKTtcblxuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5ydW5BbGwoWydCRUdJTiBUUkFOU0FDVElPTjsnLFxuICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnN0YXRlbWVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ0NPTU1JVCBUUkFOU0FDVElPTjsnXSk7XG5cbiAgICAgIGlmIChuZXdGb3JtKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRFJPUCBWSUVXIElGIEVYSVNUUyAlcy4lczsnLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnQ1JFQVRFIFZJRVcgJXMuJXMgQVMgU0VMRUNUICogRlJPTSAlczsnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm1BbmRTY2hlbWEoZm9ybSwgcmVwZWF0YWJsZSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMsICdfdmlld19mdWxsJykpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgLy8gc29tZXRpbWVzIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IG5hbWUgPSBjb21wYWN0KFtmb3JtLm5hbWUsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5kYXRhTmFtZV0pLmpvaW4oJyAtICcpXG5cbiAgICBjb25zdCBmb3JtSUQgPSB0aGlzLnBlcnNpc3RlbnRUYWJsZU5hbWVzID8gZm9ybS5pZCA6IGZvcm0ucm93SUQ7XG5cbiAgICBjb25zdCBwcmVmaXggPSBjb21wYWN0KFsndmlldycsIGZvcm1JRCwgcmVwZWF0YWJsZSAmJiByZXBlYXRhYmxlLmtleV0pLmpvaW4oJyAtICcpO1xuXG4gICAgY29uc3Qgb2JqZWN0TmFtZSA9IFtwcmVmaXgsIG5hbWVdLmpvaW4oJyAtICcpO1xuXG4gICAgcmV0dXJuIHRoaXMudHJpbUlkZW50aWZpZXIoZnVsY3J1bS5hcmdzLm1zc3FsVW5kZXJzY29yZU5hbWVzICE9PSBmYWxzZSA/IHNuYWtlKG9iamVjdE5hbWUpIDogb2JqZWN0TmFtZSk7XG4gIH1cblxuICBhc3luYyBpbnZva2VCZWZvcmVGdW5jdGlvbigpIHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRVhFQ1VURSAlczsnLCBmdWxjcnVtLmFyZ3MubXNzcWxCZWZvcmVGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMpIHtcbiAgICAgIGF3YWl0IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYmVmb3JlU3luYygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGludm9rZUFmdGVyRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEFmdGVyRnVuY3Rpb24pIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRVhFQ1VURSAlczsnLCBmdWxjcnVtLmFyZ3MubXNzcWxBZnRlckZ1bmN0aW9uKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYWZ0ZXJTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFmdGVyU3luYygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIHByb2dyZXNzKSB7XG4gICAgYXdhaXQgdGhpcy5yZWNyZWF0ZUZvcm1UYWJsZXMoZm9ybSwgYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRUYWJsZUxpc3QoKTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIHRydWUpO1xuICAgIH0pO1xuXG4gICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICB9XG5cbiAgYXN5bmMgY2xlYW51cEZyaWVuZGx5Vmlld3MoYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVmlld0xpc3QoKTtcblxuICAgIGNvbnN0IGFjdGl2ZVZpZXdOYW1lcyA9IFtdO1xuXG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGFjdGl2ZVZpZXdOYW1lcy5wdXNoKHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgbnVsbCkpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgIGFjdGl2ZVZpZXdOYW1lcy5wdXNoKHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlbW92ZSA9IGRpZmZlcmVuY2UodGhpcy52aWV3TmFtZXMsIGFjdGl2ZVZpZXdOYW1lcyk7XG5cbiAgICBmb3IgKGNvbnN0IHZpZXdOYW1lIG9mIHJlbW92ZSkge1xuICAgICAgaWYgKHZpZXdOYW1lLmluZGV4T2YoJ3ZpZXdfJykgPT09IDAgfHwgdmlld05hbWUuaW5kZXhPZigndmlldyAtICcpID09PSAwKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdEUk9QIFZJRVcgSUYgRVhJU1RTICVzLiVzOycsIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG4gIH1cblxuICBmb3JtVmVyc2lvbiA9IChmb3JtKSA9PiB7XG4gICAgaWYgKGZvcm0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcbiAgfVxuXG4gIHVwZGF0ZVN0YXR1cyA9IChtZXNzYWdlKSA9PiB7XG4gICAgaWYgKHByb2Nlc3Muc3Rkb3V0LmlzVFRZKSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcFN5c3RlbVRhYmxlcygpIHtcbiAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodGVtcGxhdGVEcm9wKSk7XG4gIH1cblxuICBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5ydW4oYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBkcm9wRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBEUk9QIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfTtgKTtcbiAgfVxuXG4gIGFzeW5jIHNldHVwRGF0YWJhc2UoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHZlcnNpb24wMDEpKTtcbiAgfVxuXG4gIHByZXBhcmVNaWdyYXRpb25TY3JpcHQoc3FsKSB7XG4gICAgcmV0dXJuIHNxbC5yZXBsYWNlKC9fX1NDSEVNQV9fL2csIHRoaXMuZGF0YVNjaGVtYSlcbiAgICAgICAgICAgICAgLnJlcGxhY2UoL19fVklFV19TQ0hFTUFfXy9nLCB0aGlzLnZpZXdTY2hlbWEpLnNwbGl0KCc7Jyk7XG4gIH1cblxuICBhc3luYyBzZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KSB7XG4gICAgY29uc3QgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgICB9O1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFBob3RvKHt9LCBhc3luYyAocGhvdG8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Bob3RvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoVmlkZW8oe30sIGFzeW5jICh2aWRlbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnVmlkZW9zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVZpZGVvKHZpZGVvLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hBdWRpbyh7fSwgYXN5bmMgKGF1ZGlvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdBdWRpbycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVBdWRpbyhhdWRpbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoU2lnbmF0dXJlKHt9LCBhc3luYyAoc2lnbmF0dXJlLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdTaWduYXR1cmVzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNpZ25hdHVyZShzaWduYXR1cmUsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENoYW5nZXNldCh7fSwgYXN5bmMgKGNoYW5nZXNldCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hhbmdlc2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hSb2xlKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdSb2xlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUHJvamVjdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUHJvamVjdHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaEZvcm0oe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Zvcm1zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hNZW1iZXJzaGlwKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdNZW1iZXJzaGlwcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hvaWNlTGlzdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hvaWNlIExpc3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2xhc3NpZmljYXRpb24gU2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgbWF5YmVJbml0aWFsaXplKCkge1xuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmICh0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZignbWlncmF0aW9ucycpID09PSAtMSkge1xuICAgICAgbG9nKCdJbml0aXRhbGl6aW5nIGRhdGFiYXNlLi4uJyk7XG5cbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMubWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgbWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpIHtcbiAgICB0aGlzLm1pZ3JhdGlvbnMgPSAoYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCBuYW1lIEZST00gJHsgdGhpcy5kYXRhU2NoZW1hIH0ubWlncmF0aW9uc2ApKS5tYXAobyA9PiBvLm5hbWUpO1xuXG4gICAgbGV0IHBvcHVsYXRlUmVjb3JkcyA9IGZhbHNlO1xuXG4gICAgZm9yIChsZXQgY291bnQgPSAyOyBjb3VudCA8PSBDVVJSRU5UX1ZFUlNJT047ICsrY291bnQpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBwYWRTdGFydChjb3VudCwgMywgJzAnKTtcblxuICAgICAgY29uc3QgbmVlZHNNaWdyYXRpb24gPSB0aGlzLm1pZ3JhdGlvbnMuaW5kZXhPZih2ZXJzaW9uKSA9PT0gLTEgJiYgTUlHUkFUSU9OU1t2ZXJzaW9uXTtcblxuICAgICAgaWYgKG5lZWRzTWlncmF0aW9uKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdChNSUdSQVRJT05TW3ZlcnNpb25dKSk7XG5cbiAgICAgICAgaWYgKHZlcnNpb24gPT09ICcwMDInKSB7XG4gICAgICAgICAgbG9nKCdQb3B1bGF0aW5nIHN5c3RlbSB0YWJsZXMuLi4nKTtcbiAgICAgICAgICBwb3B1bGF0ZVJlY29yZHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZlcnNpb24gPT09ICcwMDUnKSB7XG4gICAgICAgICAgbG9nKCdNaWdyYXRpbmcgZGF0ZSBjYWxjdWxhdGlvbiBmaWVsZHMuLi4nKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLm1pZ3JhdGVDYWxjdWxhdGVkRmllbGRzRGF0ZUZvcm1hdChhY2NvdW50KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3B1bGF0ZVJlY29yZHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9wdWxhdGVSZWNvcmRzKGFjY291bnQpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHBvcHVsYXRlUmVjb3JkcyhhY2NvdW50KSB7XG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBpbmRleCA9IDA7XG5cbiAgICAgIGF3YWl0IGZvcm0uZmluZEVhY2hSZWNvcmQoe30sIGFzeW5jIChyZWNvcmQpID0+IHtcbiAgICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgICB0aGlzLnByb2dyZXNzKGZvcm0ubmFtZSwgaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBtaWdyYXRlQ2FsY3VsYXRlZEZpZWxkc0RhdGVGb3JtYXQoYWNjb3VudCkge1xuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBjb25zdCBmaWVsZHMgPSBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdDYWxjdWxhdGVkRmllbGQnKS5maWx0ZXIoZWxlbWVudCA9PiBlbGVtZW50LmRpc3BsYXkuaXNEYXRlKTtcblxuICAgICAgaWYgKGZpZWxkcy5sZW5ndGgpIHtcbiAgICAgICAgbG9nKCdNaWdyYXRpbmcgZGF0ZSBjYWxjdWxhdGlvbiBmaWVsZHMgaW4gZm9ybS4uLicsIGZvcm0ubmFtZSk7XG5cbiAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcbiAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gIH1cbn1cbiJdfQ==