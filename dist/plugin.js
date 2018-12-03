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
  '004': _version8.default
};

const DEFAULT_SCHEMA = 'dbo';

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

          console.log('');
        }

        yield _this.invokeAfterFunction();
      } else {
        console.error('Unable to find account', fulcrum.args.org);
      }
    });

    this.run = (() => {
      var _ref2 = _asyncToGenerator(function* (sql) {
        sql = sql.replace(/\0/g, '');

        if (fulcrum.args.debug) {
          console.log(sql);
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
      return this.tableNames.indexOf(_mssqlRecordValues2.default.tableNameWithForm(form)) !== -1;
    };

    this.recreateFormTables = (() => {
      var _ref23 = _asyncToGenerator(function* (form, account) {
        try {
          yield _this.updateForm(form, account, _this.formVersion(form), null);
        } catch (ex) {
          if (fulcrum.args.debug) {
            console.error(sql);
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

          const { statements } = yield _schema2.default.generateSchemaStatements(account, oldForm, newForm, _this.disableArrays, false /* disableComplexTypes */, _this.mssqlCustomModule, _this.dataSchema);

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

  escapeIdentifier(identifier) {
    return identifier && this.mssql.ident(this.trimIdentifier(identifier));
  }

  get useSyncEvents() {
    return fulcrum.args.mssqlSyncEvents != null ? fulcrum.args.mssqlSyncEvents : true;
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
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
    console.warn(`
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

      disableArrays: this.disableArrays,

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
        yield _this18.run((0, _util.format)('CREATE VIEW %s.%s AS SELECT * FROM %s.%s_view_full;', _this18.escapeIdentifier(_this18.viewSchema), _this18.escapeIdentifier(viewName), _this18.escapeIdentifier(_this18.dataSchema), _mssqlRecordValues2.default.tableNameWithForm(form, repeatable)));
      } catch (ex) {
        // sometimes it doesn't exist
        _this18.integrityWarning(ex);
      }
    })();
  }

  getFriendlyTableName(form, repeatable) {
    const name = (0, _lodash.compact)([form.name, repeatable && repeatable.dataName]).join(' - ');

    const prefix = (0, _lodash.compact)(['view', form.rowID, repeatable && repeatable.key]).join(' - ');

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
        console.log('Inititalizing database...');

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

      yield _this28.maybeRunMigration('002', account);
      yield _this28.maybeRunMigration('003', account);
      yield _this28.maybeRunMigration('004', account);
    })();
  }

  maybeRunMigration(version, account) {
    var _this29 = this;

    return _asyncToGenerator(function* () {
      if (_this29.migrations.indexOf(version) === -1 && MIGRATIONS[version]) {
        yield _this29.runAll(_this29.prepareMigrationScript(MIGRATIONS[version]));

        if (version === '002') {
          console.log('Populating system tables...');

          // await this.setupSystemTables(account);
          yield _this29.populateRecords(account);
        }
      }
    })();
  }

  populateRecords(account) {
    var _this30 = this;

    return _asyncToGenerator(function* () {
      const forms = yield account.findActiveForms({});

      let index = 0;

      for (const form of forms) {
        index = 0;

        yield form.findEachRecord({}, (() => {
          var _ref37 = _asyncToGenerator(function* (record) {
            record.form = form;

            if (++index % 10 === 0) {
              _this30.progress(form.name, index);
            }

            yield _this30.updateRecord(record, account, false);
          });

          return function (_x51) {
            return _ref37.apply(this, arguments);
          };
        })());
      }
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJERUZBVUxUX1NDSEVNQSIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImZ1bGNydW0iLCJhcmdzIiwibXNzcWxDcmVhdGVEYXRhYmFzZSIsImNyZWF0ZURhdGFiYXNlIiwibXNzcWxEcm9wRGF0YWJhc2UiLCJkcm9wRGF0YWJhc2UiLCJtc3NxbERyb3AiLCJkcm9wU3lzdGVtVGFibGVzIiwibXNzcWxTZXR1cCIsInNldHVwRGF0YWJhc2UiLCJhY2NvdW50IiwiZmV0Y2hBY2NvdW50Iiwib3JnIiwibXNzcWxTeXN0ZW1UYWJsZXNPbmx5Iiwic2V0dXBTeXN0ZW1UYWJsZXMiLCJpbnZva2VCZWZvcmVGdW5jdGlvbiIsImZvcm1zIiwiZmluZEFjdGl2ZUZvcm1zIiwiZm9ybSIsIm1zc3FsRm9ybSIsImlkIiwibXNzcWxSZWJ1aWxkVmlld3NPbmx5IiwicmVidWlsZEZyaWVuZGx5Vmlld3MiLCJyZWJ1aWxkRm9ybSIsImluZGV4IiwidXBkYXRlU3RhdHVzIiwibmFtZSIsImdyZWVuIiwidG9TdHJpbmciLCJyZWQiLCJjb25zb2xlIiwibG9nIiwiaW52b2tlQWZ0ZXJGdW5jdGlvbiIsImVycm9yIiwicnVuIiwic3FsIiwicmVwbGFjZSIsImRlYnVnIiwicmVzdWx0IiwicG9vbCIsInJlcXVlc3QiLCJiYXRjaCIsInJlY29yZHNldCIsInJ1bkFsbCIsInN0YXRlbWVudHMiLCJyZXN1bHRzIiwicHVzaCIsInRhYmxlTmFtZSIsInJvd0lEIiwib25TeW5jU3RhcnQiLCJ0YXNrcyIsIm9uU3luY0ZpbmlzaCIsImNsZWFudXBGcmllbmRseVZpZXdzIiwib25Gb3JtU2F2ZSIsIm9sZEZvcm0iLCJuZXdGb3JtIiwidXBkYXRlRm9ybSIsIm9uRm9ybURlbGV0ZSIsIl9pZCIsInJvd19pZCIsIl9uYW1lIiwiZWxlbWVudHMiLCJfZWxlbWVudHNKU09OIiwib25SZWNvcmRTYXZlIiwicmVjb3JkIiwidXBkYXRlUmVjb3JkIiwib25SZWNvcmREZWxldGUiLCJkZWxldGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwibXNzcWwiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uU2lnbmF0dXJlU2F2ZSIsInNpZ25hdHVyZSIsInVwZGF0ZVNpZ25hdHVyZSIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsImZvcm1hdFNpZ25hdHVyZVVSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJzaG91bGRVcGRhdGVGb3JtIiwidXBkYXRlRm9ybU9iamVjdCIsImdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyIsImRpc2FibGVBcnJheXMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaW50ZWdyaXR5V2FybmluZyIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwic3Rkb3V0IiwiaXNUVFkiLCJjbGVhckxpbmUiLCJjdXJzb3JUbyIsIndyaXRlIiwicHJvZ3Jlc3MiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNzcWxDb25uZWN0aW9uU3RyaW5nIiwidHlwZSIsIm1zc3FsRGF0YWJhc2UiLCJkZWZhdWx0IiwibXNzcWxIb3N0IiwiaG9zdCIsIm1zc3FsUG9ydCIsIm1zc3FsVXNlciIsIm1zc3FsUGFzc3dvcmQiLCJtc3NxbFNjaGVtYSIsIm1zc3FsU2NoZW1hVmlld3MiLCJtc3NxbFN5bmNFdmVudHMiLCJtc3NxbEJlZm9yZUZ1bmN0aW9uIiwibXNzcWxBZnRlckZ1bmN0aW9uIiwicmVxdWlyZWQiLCJtc3NxbFJlcG9ydEJhc2VVcmwiLCJtc3NxbE1lZGlhQmFzZVVybCIsIm1zc3FsVW5kZXJzY29yZU5hbWVzIiwiaGFuZGxlciIsInRyaW1JZGVudGlmaWVyIiwiaWRlbnRpZmllciIsInN1YnN0cmluZyIsImVzY2FwZUlkZW50aWZpZXIiLCJpZGVudCIsInVzZVN5bmNFdmVudHMiLCJvcHRpb25zIiwidXNlciIsInBhc3N3b3JkIiwicmVxdWlyZSIsImFwcCIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJjb25uZWN0Iiwib24iLCJzZXR1cE9wdGlvbnMiLCJtYXliZUluaXRpYWxpemUiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJvYmplY3QiLCJ2YWx1ZXMiLCJmaWxlIiwiYWNjZXNzX2tleSIsInRhYmxlIiwiZGVsZXRlU3RhdGVtZW50Iiwicm93X3Jlc291cmNlX2lkIiwiaW5zZXJ0U3RhdGVtZW50IiwicGsiLCJ3YXJuIiwic3RhY2siLCJzY2hlbWEiLCJ2YWx1ZXNUcmFuc2Zvcm1lciIsIm1lZGlhVVJMRm9ybWF0dGVyIiwibWVkaWFWYWx1ZSIsIml0ZW1zIiwiaXRlbSIsImVsZW1lbnQiLCJpc1Bob3RvRWxlbWVudCIsIm1lZGlhSUQiLCJpc1ZpZGVvRWxlbWVudCIsImlzQXVkaW9FbGVtZW50IiwibWVkaWFWaWV3VVJMRm9ybWF0dGVyIiwiaWRzIiwicmVwb3J0VVJMRm9ybWF0dGVyIiwiZmVhdHVyZSIsInZpZXdOYW1lIiwiZ2V0RnJpZW5kbHlUYWJsZU5hbWUiLCJkYXRhTmFtZSIsInByZWZpeCIsImtleSIsIm9iamVjdE5hbWUiLCJiZWZvcmVTeW5jIiwiYWZ0ZXJTeW5jIiwiZmluZEVhY2hSZWNvcmQiLCJhY3RpdmVWaWV3TmFtZXMiLCJyZW1vdmUiLCJwcmVwYXJlTWlncmF0aW9uU2NyaXB0IiwiZGF0YWJhc2VOYW1lIiwic3BsaXQiLCJmaW5kRWFjaFBob3RvIiwiZmluZEVhY2hWaWRlbyIsImZpbmRFYWNoQXVkaW8iLCJmaW5kRWFjaFNpZ25hdHVyZSIsImZpbmRFYWNoQ2hhbmdlc2V0IiwiZmluZEVhY2hSb2xlIiwiZmluZEVhY2hQcm9qZWN0IiwiZmluZEVhY2hGb3JtIiwiZmluZEVhY2hNZW1iZXJzaGlwIiwiZmluZEVhY2hDaG9pY2VMaXN0IiwiZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCIsIm1heWJlUnVuTWlncmF0aW9ucyIsIm1pZ3JhdGlvbnMiLCJtYXliZVJ1bk1pZ3JhdGlvbiIsInZlcnNpb24iLCJwb3B1bGF0ZVJlY29yZHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FB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UUFBUSxNQUFNTixRQUFRTyxlQUFSLENBQXdCLEVBQXhCLENBQXBCOztBQUVBLFVBQUlPLFFBQVEsQ0FBWjs7QUFFQSxXQUFLLE1BQU1OLElBQVgsSUFBbUJGLEtBQW5CLEVBQTBCO0FBQ3hCUSxnQkFBUSxDQUFSOztBQUVBLGNBQU1OLEtBQUsyTSxjQUFMLENBQW9CLEVBQXBCO0FBQUEseUNBQXdCLFdBQU83SixNQUFQLEVBQWtCO0FBQzlDQSxtQkFBTzlDLElBQVAsR0FBY0EsSUFBZDs7QUFFQSxnQkFBSSxFQUFFTSxLQUFGLEdBQVUsRUFBVixLQUFpQixDQUFyQixFQUF3QjtBQUN0QixzQkFBS3dILFFBQUwsQ0FBYzlILEtBQUtRLElBQW5CLEVBQXlCRixLQUF6QjtBQUNEOztBQUVELGtCQUFNLFFBQUt5QyxZQUFMLENBQWtCRCxNQUFsQixFQUEwQnRELE9BQTFCLEVBQW1DLEtBQW5DLENBQU47QUFDRCxXQVJLOztBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQU47QUFTRDtBQWpCNEI7QUFrQjlCOztBQS81QmtCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1zc3FsIGZyb20gJ21zc3FsJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IE1TU1FMIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgTVNTUUxSZWNvcmRWYWx1ZXMgZnJvbSAnLi9tc3NxbC1yZWNvcmQtdmFsdWVzJ1xuaW1wb3J0IHNuYWtlIGZyb20gJ3NuYWtlLWNhc2UnO1xuaW1wb3J0IHRlbXBsYXRlRHJvcCBmcm9tICcuL3RlbXBsYXRlLmRyb3Auc3FsJztcbmltcG9ydCBTY2hlbWFNYXAgZnJvbSAnLi9zY2hlbWEtbWFwJztcbmltcG9ydCAqIGFzIGFwaSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCB7IGNvbXBhY3QsIGRpZmZlcmVuY2UgfSBmcm9tICdsb2Rhc2gnO1xuXG5pbXBvcnQgdmVyc2lvbjAwMSBmcm9tICcuL3ZlcnNpb24tMDAxLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMiBmcm9tICcuL3ZlcnNpb24tMDAyLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMyBmcm9tICcuL3ZlcnNpb24tMDAzLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwNCBmcm9tICcuL3ZlcnNpb24tMDA0LnNxbCc7XG5cbmNvbnN0IE1BWF9JREVOVElGSUVSX0xFTkdUSCA9IDEwMDtcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBzZXJ2ZXI6ICdsb2NhbGhvc3QnLFxuICBwb3J0OiAxNDMzLFxuICBtYXg6IDEwLFxuICBpZGxlVGltZW91dE1pbGxpczogMzAwMDBcbn07XG5cbmNvbnN0IE1JR1JBVElPTlMgPSB7XG4gICcwMDInOiB2ZXJzaW9uMDAyLFxuICAnMDAzJzogdmVyc2lvbjAwMyxcbiAgJzAwNCc6IHZlcnNpb24wMDRcbn07XG5cbmNvbnN0IERFRkFVTFRfU0NIRU1BID0gJ2Ribyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ21zc3FsJyxcbiAgICAgIGRlc2M6ICdydW4gdGhlIG1zc3FsIHN5bmMgZm9yIGEgc3BlY2lmaWMgb3JnYW5pemF0aW9uJyxcbiAgICAgIGJ1aWxkZXI6IHtcbiAgICAgICAgbXNzcWxDb25uZWN0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGNvbm5lY3Rpb24gc3RyaW5nIChvdmVycmlkZXMgYWxsIGluZGl2aWR1YWwgZGF0YWJhc2UgY29ubmVjdGlvbiBwYXJhbWV0ZXJzKScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxEYXRhYmFzZToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBkYXRhYmFzZSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuZGF0YWJhc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxIb3N0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBob3N0JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuaG9zdFxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFBvcnQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIHBvcnQnLFxuICAgICAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcucG9ydFxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFVzZXI6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgdXNlcicsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQYXNzd29yZDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBwYXNzd29yZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTY2hlbWE6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNjaGVtYVZpZXdzOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYSBmb3IgdGhlIGZyaWVuZGx5IHZpZXdzJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFN5bmNFdmVudHM6IHtcbiAgICAgICAgICBkZXNjOiAnYWRkIHN5bmMgZXZlbnQgaG9va3MnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQmVmb3JlRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGJlZm9yZSB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxBZnRlckZ1bmN0aW9uOiB7XG4gICAgICAgICAgZGVzYzogJ2NhbGwgdGhpcyBmdW5jdGlvbiBhZnRlciB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbEZvcm06IHtcbiAgICAgICAgICBkZXNjOiAndGhlIGZvcm0gSUQgdG8gcmVidWlsZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxSZXBvcnRCYXNlVXJsOiB7XG4gICAgICAgICAgZGVzYzogJ3JlcG9ydCBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxNZWRpYUJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAnbWVkaWEgVVJMIGJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsVW5kZXJzY29yZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB1bmRlcnNjb3JlIG5hbWVzIChlLmcuIFwiUGFyayBJbnNwZWN0aW9uc1wiIGJlY29tZXMgXCJwYXJrX2luc3BlY3Rpb25zXCIpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxSZWJ1aWxkVmlld3NPbmx5OiB7XG4gICAgICAgICAgZGVzYzogJ29ubHkgcmVidWlsZCB0aGUgdmlld3MnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxDdXN0b21Nb2R1bGU6IHtcbiAgICAgICAgICBkZXNjOiAnYSBjdXN0b20gbW9kdWxlIHRvIGxvYWQgd2l0aCBzeW5jIGV4dGVuc2lvbnMgKGV4cGVyaW1lbnRhbCknLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFNldHVwOiB7XG4gICAgICAgICAgZGVzYzogJ3NldHVwIHRoZSBkYXRhYmFzZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbERyb3A6IHtcbiAgICAgICAgICBkZXNjOiAnZHJvcCB0aGUgc3lzdGVtIHRhYmxlcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbFN5c3RlbVRhYmxlc09ubHk6IHtcbiAgICAgICAgICBkZXNjOiAnb25seSBjcmVhdGUgdGhlIHN5c3RlbSByZWNvcmRzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZURhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbENyZWF0ZURhdGFiYXNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcERhdGFiYXNlKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNzcWxEcm9wRGF0YWJhc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxEcm9wKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BTeXN0ZW1UYWJsZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU2V0dXApIHtcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU3lzdGVtVGFibGVzT25seSkge1xuICAgICAgICBhd2FpdCB0aGlzLnNldHVwU3lzdGVtVGFibGVzKGFjY291bnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcblxuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRm9ybSAmJiBmb3JtLmlkICE9PSBmdWxjcnVtLmFyZ3MubXNzcWxGb3JtKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUmVidWlsZFZpZXdzT25seSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZyaWVuZGx5Vmlld3MoZm9ybSwgYWNjb3VudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoaW5kZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICB0cmltSWRlbnRpZmllcihpZGVudGlmaWVyKSB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIuc3Vic3RyaW5nKDAsIE1BWF9JREVOVElGSUVSX0xFTkdUSCk7XG4gIH1cblxuICBlc2NhcGVJZGVudGlmaWVyKGlkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gaWRlbnRpZmllciAmJiB0aGlzLm1zc3FsLmlkZW50KHRoaXMudHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuICB9XG5cbiAgZ2V0IHVzZVN5bmNFdmVudHMoKSB7XG4gICAgcmV0dXJuIGZ1bGNydW0uYXJncy5tc3NxbFN5bmNFdmVudHMgIT0gbnVsbCA/IGZ1bGNydW0uYXJncy5tc3NxbFN5bmNFdmVudHMgOiB0cnVlO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGUoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zc3FsSG9zdCB8fCBNU1NRTF9DT05GSUcuc2VydmVyLFxuICAgICAgcG9ydDogZnVsY3J1bS5hcmdzLm1zc3FsUG9ydCB8fCBNU1NRTF9DT05GSUcucG9ydCxcbiAgICAgIGRhdGFiYXNlOiBmdWxjcnVtLmFyZ3MubXNzcWxEYXRhYmFzZSB8fCBNU1NRTF9DT05GSUcuZGF0YWJhc2UsXG4gICAgICB1c2VyOiBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyIHx8IE1TU1FMX0NPTkZJRy51c2VyLFxuICAgICAgcGFzc3dvcmQ6IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkIHx8IE1TU1FMX0NPTkZJRy51c2VyXG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxVc2VyKSB7XG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCkge1xuICAgICAgb3B0aW9ucy5wYXNzd29yZCA9IGZ1bGNydW0uYXJncy5tc3NxbFBhc3N3b3JkO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpIHtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgPSByZXF1aXJlKGZ1bGNydW0uYXJncy5tc3NxbEN1c3RvbU1vZHVsZSk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwaSA9IGFwaTtcbiAgICAgIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYXBwID0gZnVsY3J1bTtcbiAgICB9XG5cbiAgICB0aGlzLmRpc2FibGVBcnJheXMgPSBmYWxzZTtcbiAgICB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMgPSB0cnVlO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChmdWxjcnVtLmFyZ3MubXNzcWxDb25uZWN0aW9uU3RyaW5nIHx8IG9wdGlvbnMpO1xuXG4gICAgaWYgKHRoaXMudXNlU3luY0V2ZW50cykge1xuICAgICAgZnVsY3J1bS5vbignc3luYzpzdGFydCcsIHRoaXMub25TeW5jU3RhcnQpO1xuICAgICAgZnVsY3J1bS5vbignc3luYzpmaW5pc2gnLCB0aGlzLm9uU3luY0ZpbmlzaCk7XG4gICAgICBmdWxjcnVtLm9uKCdwaG90bzpzYXZlJywgdGhpcy5vblBob3RvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCd2aWRlbzpzYXZlJywgdGhpcy5vblZpZGVvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdhdWRpbzpzYXZlJywgdGhpcy5vbkF1ZGlvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdzaWduYXR1cmU6c2F2ZScsIHRoaXMub25TaWduYXR1cmVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NoYW5nZXNldDpzYXZlJywgdGhpcy5vbkNoYW5nZXNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6ZGVsZXRlJywgdGhpcy5vblJlY29yZERlbGV0ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2Nob2ljZS1saXN0OnNhdmUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6ZGVsZXRlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignZm9ybTpzYXZlJywgdGhpcy5vbkZvcm1TYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2Zvcm06ZGVsZXRlJywgdGhpcy5vbkZvcm1TYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OnNhdmUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uLXNldDpkZWxldGUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncm9sZTpzYXZlJywgdGhpcy5vblJvbGVTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JvbGU6ZGVsZXRlJywgdGhpcy5vblJvbGVTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpzYXZlJywgdGhpcy5vblByb2plY3RTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3Byb2plY3Q6ZGVsZXRlJywgdGhpcy5vblByb2plY3RTYXZlKTtcblxuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpzYXZlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ21lbWJlcnNoaXA6ZGVsZXRlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcbiAgICB9XG5cbiAgICB0aGlzLnZpZXdTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWFWaWV3cyB8fCBERUZBVUxUX1NDSEVNQTtcbiAgICB0aGlzLmRhdGFTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzcWxTY2hlbWEgfHwgREVGQVVMVF9TQ0hFTUE7XG5cbiAgICAvLyBGZXRjaCBhbGwgdGhlIGV4aXN0aW5nIHRhYmxlcyBvbiBzdGFydHVwLiBUaGlzIGFsbG93cyB1cyB0byBzcGVjaWFsIGNhc2UgdGhlXG4gICAgLy8gY3JlYXRpb24gb2YgbmV3IHRhYmxlcyBldmVuIHdoZW4gdGhlIGZvcm0gaXNuJ3QgdmVyc2lvbiAxLiBJZiB0aGUgdGFibGUgZG9lc24ndFxuICAgIC8vIGV4aXN0LCB3ZSBjYW4gcHJldGVuZCB0aGUgZm9ybSBpcyB2ZXJzaW9uIDEgc28gaXQgY3JlYXRlcyBhbGwgbmV3IHRhYmxlcyBpbnN0ZWFkXG4gICAgLy8gb2YgYXBwbHlpbmcgYSBzY2hlbWEgZGlmZi5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nJHsgdGhpcy5kYXRhU2NoZW1hIH0nYCk7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICAvLyBtYWtlIGEgY2xpZW50IHNvIHdlIGNhbiB1c2UgaXQgdG8gYnVpbGQgU1FMIHN0YXRlbWVudHNcbiAgICB0aGlzLm1zc3FsID0gbmV3IE1TU1FMKHt9KTtcblxuICAgIHRoaXMuc2V0dXBPcHRpb25zKCk7XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlSW5pdGlhbGl6ZSgpO1xuICB9XG5cbiAgYXN5bmMgZGVhY3RpdmF0ZSgpIHtcbiAgICBpZiAodGhpcy5wb29sKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvb2wuY2xvc2UoKTtcbiAgICB9XG4gIH1cblxuICBydW4gPSBhc3luYyAoc3FsKSA9PiB7XG4gICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcMC9nLCAnJyk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICBjb25zb2xlLmxvZyhzcWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucG9vbC5yZXF1ZXN0KCkuYmF0Y2goc3FsKTtcblxuICAgIHJldHVybiByZXN1bHQucmVjb3Jkc2V0O1xuICB9XG5cbiAgcnVuQWxsID0gYXN5bmMgKHN0YXRlbWVudHMpID0+IHtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICByZXN1bHRzLnB1c2goYXdhaXQgdGhpcy5ydW4oc3FsKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBsb2cgPSAoLi4uYXJncykgPT4ge1xuICAgIC8vIGNvbnNvbGUubG9nKC4uLmFyZ3MpO1xuICB9XG5cbiAgdGFibGVOYW1lID0gKGFjY291bnQsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuICB9XG5cbiAgb25TeW5jU3RhcnQgPSBhc3luYyAoe2FjY291bnQsIHRhc2tzfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcbiAgfVxuXG4gIG9uU3luY0ZpbmlzaCA9IGFzeW5jICh7YWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLmNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMuaW52b2tlQWZ0ZXJGdW5jdGlvbigpO1xuICB9XG5cbiAgb25Gb3JtU2F2ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybX0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSk7XG4gIH1cblxuICBvbkZvcm1EZWxldGUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnR9KSA9PiB7XG4gICAgY29uc3Qgb2xkRm9ybSA9IHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBudWxsKTtcbiAgfVxuXG4gIG9uUmVjb3JkU2F2ZSA9IGFzeW5jICh7cmVjb3JkLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJlY29yZERlbGV0ZSA9IGFzeW5jICh7cmVjb3JkfSkgPT4ge1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy5kZWxldGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCwgcmVjb3JkLmZvcm0sIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIG9uUGhvdG9TYXZlID0gYXN5bmMgKHtwaG90bywgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVBob3RvKHBob3RvLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uVmlkZW9TYXZlID0gYXN5bmMgKHt2aWRlbywgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVZpZGVvKHZpZGVvLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQXVkaW9TYXZlID0gYXN5bmMgKHthdWRpbywgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUF1ZGlvKGF1ZGlvLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uU2lnbmF0dXJlU2F2ZSA9IGFzeW5jICh7c2lnbmF0dXJlLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlU2lnbmF0dXJlKHNpZ25hdHVyZSwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNoYW5nZXNldFNhdmUgPSBhc3luYyAoe2NoYW5nZXNldCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNoYW5nZXNldChjaGFuZ2VzZXQsIGFjY291bnQpO1xuICB9XG5cbiAgb25DaG9pY2VMaXN0U2F2ZSA9IGFzeW5jICh7Y2hvaWNlTGlzdCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3QoY2hvaWNlTGlzdCwgYWNjb3VudCk7XG4gIH1cblxuICBvbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSA9IGFzeW5jICh7Y2xhc3NpZmljYXRpb25TZXQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChjbGFzc2lmaWNhdGlvblNldCwgYWNjb3VudCk7XG4gIH1cblxuICBvblByb2plY3RTYXZlID0gYXN5bmMgKHtwcm9qZWN0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChwcm9qZWN0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUm9sZVNhdmUgPSBhc3luYyAoe3JvbGUsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKHJvbGUsIGFjY291bnQpO1xuICB9XG5cbiAgb25NZW1iZXJzaGlwU2F2ZSA9IGFzeW5jICh7bWVtYmVyc2hpcCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU1lbWJlcnNoaXAobWVtYmVyc2hpcCwgYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVQaG90byhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAucGhvdG8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRQaG90b1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdwaG90b3MnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVZpZGVvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC52aWRlbyhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFZpZGVvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3ZpZGVvcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQXVkaW8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLmF1ZGlvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0QXVkaW9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAnYXVkaW8nKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVNpZ25hdHVyZShvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAuc2lnbmF0dXJlKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0U2lnbmF0dXJlVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ3NpZ25hdHVyZXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNoYW5nZXNldChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuY2hhbmdlc2V0KG9iamVjdCksICdjaGFuZ2VzZXRzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVQcm9qZWN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5wcm9qZWN0KG9iamVjdCksICdwcm9qZWN0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlTWVtYmVyc2hpcChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAubWVtYmVyc2hpcChvYmplY3QpLCAnbWVtYmVyc2hpcHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVJvbGUob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnJvbGUob2JqZWN0KSwgJ3JvbGVzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVGb3JtT2JqZWN0KG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5mb3JtKG9iamVjdCksICdmb3JtcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2hvaWNlTGlzdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuY2hvaWNlTGlzdChvYmplY3QpLCAnY2hvaWNlX2xpc3RzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuY2xhc3NpZmljYXRpb25TZXQob2JqZWN0KSwgJ2NsYXNzaWZpY2F0aW9uX3NldHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU9iamVjdCh2YWx1ZXMsIHRhYmxlKSB7XG4gICAgY29uc3QgZGVsZXRlU3RhdGVtZW50ID0gdGhpcy5tc3NxbC5kZWxldGVTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHtyb3dfcmVzb3VyY2VfaWQ6IHZhbHVlcy5yb3dfcmVzb3VyY2VfaWR9KTtcbiAgICBjb25zdCBpbnNlcnRTdGF0ZW1lbnQgPSB0aGlzLm1zc3FsLmluc2VydFN0YXRlbWVudChgJHsgdGhpcy5kYXRhU2NoZW1hIH0uc3lzdGVtXyR7dGFibGV9YCwgdmFsdWVzLCB7cGs6ICdpZCd9KTtcblxuICAgIGNvbnN0IHNxbCA9IFsgZGVsZXRlU3RhdGVtZW50LnNxbCwgaW5zZXJ0U3RhdGVtZW50LnNxbCBdLmpvaW4oJ1xcbicpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKHNxbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG4gIH1cblxuICByZWxvYWRUYWJsZUxpc3QgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9JyR7IHRoaXMuZGF0YVNjaGVtYSB9J2ApO1xuXG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgcmVsb2FkVmlld0xpc3QgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9JyR7IHRoaXMudmlld1NjaGVtYSB9J2ApO1xuXG4gICAgdGhpcy52aWV3TmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG4gIH1cblxuICBiYXNlTWVkaWFVUkwgPSAoKSA9PiB7XG4gIH1cblxuICBmb3JtYXRQaG90b1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9waG90b3MvJHsgaWQgfS5qcGdgO1xuICB9XG5cbiAgZm9ybWF0VmlkZW9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zLyR7IGlkIH0ubXA0YDtcbiAgfVxuXG4gIGZvcm1hdEF1ZGlvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvLyR7IGlkIH0ubTRhYDtcbiAgfVxuXG4gIGZvcm1hdFNpZ25hdHVyZVVSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9zaWduYXR1cmVzLyR7IGlkIH0ucG5nYDtcbiAgfVxuXG4gIGludGVncml0eVdhcm5pbmcoZXgpIHtcbiAgICBjb25zb2xlLndhcm4oYFxuLS0tLS0tLS0tLS0tLVxuISEgV0FSTklORyAhIVxuLS0tLS0tLS0tLS0tLVxuXG5NU1NRTCBkYXRhYmFzZSBpbnRlZ3JpdHkgaXNzdWUgZW5jb3VudGVyZWQuIENvbW1vbiBzb3VyY2VzIG9mIGRhdGFiYXNlIGlzc3VlcyBhcmU6XG5cbiogUmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBhbmQgdXNpbmcgYW4gb2xkIE1TU1FMIGRhdGFiYXNlIHdpdGhvdXQgcmVjcmVhdGluZ1xuICB0aGUgTVNTUUwgZGF0YWJhc2UuXG4qIERlbGV0aW5nIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZSBhbmQgdXNpbmcgYW4gZXhpc3RpbmcgTVNTUUwgZGF0YWJhc2VcbiogTWFudWFsbHkgbW9kaWZ5aW5nIHRoZSBNU1NRTCBkYXRhYmFzZVxuKiBDcmVhdGluZyBtdWx0aXBsZSBhcHBzIGluIEZ1bGNydW0gd2l0aCB0aGUgc2FtZSBuYW1lLiBUaGlzIGlzIGdlbmVyYWxseSBPSywgZXhjZXB0XG4gIHlvdSB3aWxsIG5vdCBiZSBhYmxlIHRvIHVzZSB0aGUgXCJmcmllbmRseSB2aWV3XCIgZmVhdHVyZSBvZiB0aGUgTVNTUUwgcGx1Z2luIHNpbmNlXG4gIHRoZSB2aWV3IG5hbWVzIGFyZSBkZXJpdmVkIGZyb20gdGhlIGZvcm0gbmFtZXMuXG5cbk5vdGU6IFdoZW4gcmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBvciBcInN0YXJ0aW5nIG92ZXJcIiB5b3UgbmVlZCB0byBkcm9wIGFuZCByZS1jcmVhdGVcbnRoZSBNU1NRTCBkYXRhYmFzZS4gVGhlIG5hbWVzIG9mIGRhdGFiYXNlIG9iamVjdHMgYXJlIHRpZWQgZGlyZWN0bHkgdG8gdGhlIGRhdGFiYXNlXG5vYmplY3RzIGluIHRoZSBpbnRlcm5hbCBhcHBsaWNhdGlvbiBkYXRhYmFzZS5cblxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5SZXBvcnQgaXNzdWVzIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9mdWxjcnVtYXBwL2Z1bGNydW0tZGVza3RvcC9pc3N1ZXNcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuTWVzc2FnZTpcbiR7IGV4Lm1lc3NhZ2UgfVxuXG5TdGFjazpcbiR7IGV4LnN0YWNrIH1cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuYC5yZWRcbiAgICApO1xuICB9XG5cbiAgc2V0dXBPcHRpb25zKCkge1xuICAgIHRoaXMuYmFzZU1lZGlhVVJMID0gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsID8gZnVsY3J1bS5hcmdzLm1zc3FsTWVkaWFCYXNlVXJsIDogJ2h0dHBzOi8vYXBpLmZ1bGNydW1hcHAuY29tL2FwaS92Mic7XG5cbiAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyA9IHtcbiAgICAgIHNjaGVtYTogdGhpcy5kYXRhU2NoZW1hLFxuXG4gICAgICBkaXNhYmxlQXJyYXlzOiB0aGlzLmRpc2FibGVBcnJheXMsXG5cbiAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IHRoaXMuZGlzYWJsZUNvbXBsZXhUeXBlcyxcblxuICAgICAgdmFsdWVzVHJhbnNmb3JtZXI6IHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS52YWx1ZXNUcmFuc2Zvcm1lcixcblxuICAgICAgbWVkaWFVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG5cbiAgICAgICAgcmV0dXJuIG1lZGlhVmFsdWUuaXRlbXMubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1Bob3RvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0UGhvdG9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0VmlkZW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0QXVkaW9VUkwoaXRlbS5tZWRpYUlEKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBtZWRpYVZpZXdVUkxGb3JtYXR0ZXI6IChtZWRpYVZhbHVlKSA9PiB7XG4gICAgICAgIGNvbnN0IGlkcyA9IG1lZGlhVmFsdWUuaXRlbXMubWFwKG8gPT4gby5tZWRpYUlEKTtcblxuICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy92aWV3P3Bob3Rvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy92aWV3P3ZpZGVvcz0keyBpZHMgfWA7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvL3ZpZXc/YXVkaW89JHsgaWRzIH1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxSZXBvcnRCYXNlVXJsKSB7XG4gICAgICB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucy5yZXBvcnRVUkxGb3JtYXR0ZXIgPSAoZmVhdHVyZSkgPT4ge1xuICAgICAgICByZXR1cm4gYCR7IGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwgfS9yZXBvcnRzLyR7IGZlYXR1cmUuaWQgfS5wZGZgO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVSZWNvcmQgPSBhc3luYyAocmVjb3JkLCBhY2NvdW50LCBza2lwVGFibGVDaGVjaykgPT4ge1xuICAgIGlmICghc2tpcFRhYmxlQ2hlY2sgJiYgIXRoaXMucm9vdFRhYmxlRXhpc3RzKHJlY29yZC5mb3JtKSkge1xuICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShyZWNvcmQuZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZVJlY29yZCh7cmVjb3JkLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMudXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcblxuICAgIGNvbnN0IHN5c3RlbVZhbHVlcyA9IE1TU1FMUmVjb3JkVmFsdWVzLnN5c3RlbUNvbHVtblZhbHVlc0ZvckZlYXR1cmUocmVjb3JkLCBudWxsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yZWNvcmQocmVjb3JkLCBzeXN0ZW1WYWx1ZXMpLCAncmVjb3JkcycpO1xuICB9XG5cbiAgcm9vdFRhYmxlRXhpc3RzID0gKGZvcm0pID0+IHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU5hbWVzLmluZGV4T2YoTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSkpICE9PSAtMTtcbiAgfVxuXG4gIHJlY3JlYXRlRm9ybVRhYmxlcyA9IGFzeW5jIChmb3JtLCBhY2NvdW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pLCBudWxsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBjb25zb2xlLmVycm9yKHNxbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG51bGwsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSkpO1xuICB9XG5cbiAgdXBkYXRlRm9ybSA9IGFzeW5jIChmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKSA9PiB7XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtICYmICF0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0oe2Zvcm0sIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3QoZm9ybSwgYWNjb3VudCk7XG5cbiAgICAgIGlmICghdGhpcy5yb290VGFibGVFeGlzdHMoZm9ybSkgJiYgbmV3Rm9ybSAhPSBudWxsKSB7XG4gICAgICAgIG9sZEZvcm0gPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7c3RhdGVtZW50c30gPSBhd2FpdCBNU1NRTFNjaGVtYS5nZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMoYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSwgdGhpcy5kaXNhYmxlQXJyYXlzLFxuICAgICAgICBmYWxzZSAvKiBkaXNhYmxlQ29tcGxleFR5cGVzICovLCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLCB0aGlzLmRhdGFTY2hlbWEpO1xuXG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnJ1bkFsbChbJ0JFR0lOIFRSQU5TQUNUSU9OOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgLi4uc3RhdGVtZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAnQ09NTUlUIFRSQU5TQUNUSU9OOyddKTtcblxuICAgICAgaWYgKG5ld0Zvcm0pIHtcbiAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICB0aHJvdyBleDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdEUk9QIFZJRVcgSUYgRVhJU1RTICVzLiVzOycsIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdDUkVBVEUgVklFVyAlcy4lcyBBUyBTRUxFQ1QgKiBGUk9NICVzLiVzX3ZpZXdfZnVsbDsnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMuZGF0YVNjaGVtYSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSwgcmVwZWF0YWJsZSkpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgLy8gc29tZXRpbWVzIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IG5hbWUgPSBjb21wYWN0KFtmb3JtLm5hbWUsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5kYXRhTmFtZV0pLmpvaW4oJyAtICcpXG5cbiAgICBjb25zdCBwcmVmaXggPSBjb21wYWN0KFsndmlldycsIGZvcm0ucm93SUQsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5rZXldKS5qb2luKCcgLSAnKTtcblxuICAgIGNvbnN0IG9iamVjdE5hbWUgPSBbcHJlZml4LCBuYW1lXS5qb2luKCcgLSAnKTtcblxuICAgIHJldHVybiB0aGlzLnRyaW1JZGVudGlmaWVyKGZ1bGNydW0uYXJncy5tc3NxbFVuZGVyc2NvcmVOYW1lcyAhPT0gZmFsc2UgPyBzbmFrZShvYmplY3ROYW1lKSA6IG9iamVjdE5hbWUpO1xuICB9XG5cbiAgYXN5bmMgaW52b2tlQmVmb3JlRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBpbnZva2VBZnRlckZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxBZnRlckZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFmdGVyU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCBwcm9ncmVzcykge1xuICAgIGF3YWl0IHRoaXMucmVjcmVhdGVGb3JtVGFibGVzKGZvcm0sIGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIHByb2dyZXNzKGluZGV4KTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFZpZXdMaXN0KCk7XG5cbiAgICBjb25zdCBhY3RpdmVWaWV3TmFtZXMgPSBbXTtcblxuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIG51bGwpKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmUgPSBkaWZmZXJlbmNlKHRoaXMudmlld05hbWVzLCBhY3RpdmVWaWV3TmFtZXMpO1xuXG4gICAgZm9yIChjb25zdCB2aWV3TmFtZSBvZiByZW1vdmUpIHtcbiAgICAgIGlmICh2aWV3TmFtZS5pbmRleE9mKCd2aWV3XycpID09PSAwIHx8IHZpZXdOYW1lLmluZGV4T2YoJ3ZpZXcgLSAnKSA9PT0gMCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRFJPUCBWSUVXIElGIEVYSVNUUyAlcy4lczsnLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cblxuICB1cGRhdGVTdGF0dXMgPSAobWVzc2FnZSkgPT4ge1xuICAgIGlmIChwcm9jZXNzLnN0ZG91dC5pc1RUWSkge1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BTeXN0ZW1UYWJsZXMoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHRlbXBsYXRlRHJvcCkpO1xuICB9XG5cbiAgY3JlYXRlRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBDUkVBVEUgREFUQUJBU0UgJHtkYXRhYmFzZU5hbWV9O2ApO1xuICB9XG5cbiAgZHJvcERhdGFiYXNlKGRhdGFiYXNlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLnJ1bihgRFJPUCBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBhc3luYyBzZXR1cERhdGFiYXNlKCkge1xuICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdCh2ZXJzaW9uMDAxKSk7XG4gIH1cblxuICBwcmVwYXJlTWlncmF0aW9uU2NyaXB0KHNxbCkge1xuICAgIHJldHVybiBzcWwucmVwbGFjZSgvX19TQ0hFTUFfXy9nLCB0aGlzLmRhdGFTY2hlbWEpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9fX1ZJRVdfU0NIRU1BX18vZywgdGhpcy52aWV3U2NoZW1hKS5zcGxpdCgnOycpO1xuICB9XG5cbiAgYXN5bmMgc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCkge1xuICAgIGNvbnN0IHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gICAgfTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hQaG90byh7fSwgYXN5bmMgKHBob3RvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdQaG90b3MnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFZpZGVvKHt9LCBhc3luYyAodmlkZW8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1ZpZGVvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQXVkaW8oe30sIGFzeW5jIChhdWRpbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQXVkaW8nLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFNpZ25hdHVyZSh7fSwgYXN5bmMgKHNpZ25hdHVyZSwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnU2lnbmF0dXJlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVTaWduYXR1cmUoc2lnbmF0dXJlLCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDaGFuZ2VzZXQoe30sIGFzeW5jIChjaGFuZ2VzZXQsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NoYW5nZXNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2hhbmdlc2V0KGNoYW5nZXNldCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUm9sZSh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUm9sZXMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFByb2plY3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1Byb2plY3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hGb3JtKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdGb3JtcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoTWVtYmVyc2hpcCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnTWVtYmVyc2hpcHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENob2ljZUxpc3Qoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Nob2ljZSBMaXN0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0NsYXNzaWZpY2F0aW9uIFNldHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlSW5pdGlhbGl6ZSgpIHtcbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAodGhpcy50YWJsZU5hbWVzLmluZGV4T2YoJ21pZ3JhdGlvbnMnKSA9PT0gLTEpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdJbml0aXRhbGl6aW5nIGRhdGFiYXNlLi4uJyk7XG5cbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMubWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgbWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpIHtcbiAgICB0aGlzLm1pZ3JhdGlvbnMgPSAoYXdhaXQgdGhpcy5ydW4oYFNFTEVDVCBuYW1lIEZST00gJHsgdGhpcy5kYXRhU2NoZW1hIH0ubWlncmF0aW9uc2ApKS5tYXAobyA9PiBvLm5hbWUpO1xuXG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbignMDAyJywgYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbignMDAzJywgYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbignMDA0JywgYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyBtYXliZVJ1bk1pZ3JhdGlvbih2ZXJzaW9uLCBhY2NvdW50KSB7XG4gICAgaWYgKHRoaXMubWlncmF0aW9ucy5pbmRleE9mKHZlcnNpb24pID09PSAtMSAmJiBNSUdSQVRJT05TW3ZlcnNpb25dKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQoTUlHUkFUSU9OU1t2ZXJzaW9uXSkpO1xuXG4gICAgICBpZiAodmVyc2lvbiA9PT0gJzAwMicpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1BvcHVsYXRpbmcgc3lzdGVtIHRhYmxlcy4uLicpO1xuXG4gICAgICAgIC8vIGF3YWl0IHRoaXMuc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCk7XG4gICAgICAgIGF3YWl0IHRoaXMucG9wdWxhdGVSZWNvcmRzKGFjY291bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHBvcHVsYXRlUmVjb3JkcyhhY2NvdW50KSB7XG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBpbmRleCA9IDA7XG5cbiAgICAgIGF3YWl0IGZvcm0uZmluZEVhY2hSZWNvcmQoe30sIGFzeW5jIChyZWNvcmQpID0+IHtcbiAgICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgICB0aGlzLnByb2dyZXNzKGZvcm0ubmFtZSwgaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCBmYWxzZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcm9ncmVzcyA9IChuYW1lLCBpbmRleCkgPT4ge1xuICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcbiAgfVxufVxuIl19