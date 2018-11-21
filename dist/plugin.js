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

    this.onChangesetSave = (() => {
      var _ref13 = _asyncToGenerator(function* ({ changeset, account }) {
        yield _this.updateChangeset(changeset, account);
      });

      return function (_x12) {
        return _ref13.apply(this, arguments);
      };
    })();

    this.onChoiceListSave = (() => {
      var _ref14 = _asyncToGenerator(function* ({ choiceList, account }) {
        yield _this.updateChoiceList(choiceList, account);
      });

      return function (_x13) {
        return _ref14.apply(this, arguments);
      };
    })();

    this.onClassificationSetSave = (() => {
      var _ref15 = _asyncToGenerator(function* ({ classificationSet, account }) {
        yield _this.updateClassificationSet(classificationSet, account);
      });

      return function (_x14) {
        return _ref15.apply(this, arguments);
      };
    })();

    this.onProjectSave = (() => {
      var _ref16 = _asyncToGenerator(function* ({ project, account }) {
        yield _this.updateProject(project, account);
      });

      return function (_x15) {
        return _ref16.apply(this, arguments);
      };
    })();

    this.onRoleSave = (() => {
      var _ref17 = _asyncToGenerator(function* ({ role, account }) {
        yield _this.updateRole(role, account);
      });

      return function (_x16) {
        return _ref17.apply(this, arguments);
      };
    })();

    this.onMembershipSave = (() => {
      var _ref18 = _asyncToGenerator(function* ({ membership, account }) {
        yield _this.updateMembership(membership, account);
      });

      return function (_x17) {
        return _ref18.apply(this, arguments);
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

    this.updateRecord = (() => {
      var _ref21 = _asyncToGenerator(function* (record, account, skipTableCheck) {
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

      return function (_x18, _x19, _x20) {
        return _ref21.apply(this, arguments);
      };
    })();

    this.rootTableExists = form => {
      return this.tableNames.indexOf(_mssqlRecordValues2.default.tableNameWithForm(form)) !== -1;
    };

    this.recreateFormTables = (() => {
      var _ref22 = _asyncToGenerator(function* (form, account) {
        try {
          yield _this.updateForm(form, account, _this.formVersion(form), null);
        } catch (ex) {
          if (fulcrum.args.debug) {
            console.error(sql);
          }
        }

        yield _this.updateForm(form, account, null, _this.formVersion(form));
      });

      return function (_x21, _x22) {
        return _ref22.apply(this, arguments);
      };
    })();

    this.updateForm = (() => {
      var _ref23 = _asyncToGenerator(function* (form, account, oldForm, newForm) {
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

      return function (_x23, _x24, _x25, _x26) {
        return _ref23.apply(this, arguments);
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

  updateChangeset(object, account) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      yield _this8.updateObject(_schemaMap2.default.changeset(object), 'changesets');
    })();
  }

  updateProject(object, account) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      yield _this9.updateObject(_schemaMap2.default.project(object), 'projects');
    })();
  }

  updateMembership(object, account) {
    var _this10 = this;

    return _asyncToGenerator(function* () {
      yield _this10.updateObject(_schemaMap2.default.membership(object), 'memberships');
    })();
  }

  updateRole(object, account) {
    var _this11 = this;

    return _asyncToGenerator(function* () {
      yield _this11.updateObject(_schemaMap2.default.role(object), 'roles');
    })();
  }

  updateFormObject(object, account) {
    var _this12 = this;

    return _asyncToGenerator(function* () {
      yield _this12.updateObject(_schemaMap2.default.form(object), 'forms');
    })();
  }

  updateChoiceList(object, account) {
    var _this13 = this;

    return _asyncToGenerator(function* () {
      yield _this13.updateObject(_schemaMap2.default.choiceList(object), 'choice_lists');
    })();
  }

  updateClassificationSet(object, account) {
    var _this14 = this;

    return _asyncToGenerator(function* () {
      yield _this14.updateObject(_schemaMap2.default.classificationSet(object), 'classification_sets');
    })();
  }

  updateObject(values, table) {
    var _this15 = this;

    return _asyncToGenerator(function* () {
      const deleteStatement = _this15.mssql.deleteStatement(`${_this15.dataSchema}.system_${table}`, { row_resource_id: values.row_resource_id });
      const insertStatement = _this15.mssql.insertStatement(`${_this15.dataSchema}.system_${table}`, values, { pk: 'id' });

      const sql = [deleteStatement.sql, insertStatement.sql].join('\n');

      try {
        yield _this15.run(sql);
      } catch (ex) {
        _this15.integrityWarning(ex);
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
    var _this16 = this;

    return _asyncToGenerator(function* () {
      const viewName = _this16.getFriendlyTableName(form, repeatable);

      try {
        yield _this16.run((0, _util.format)('IF (EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'[%s].[%s]\'))) DROP VIEW [%s].[%s];', _this16.escapeIdentifier(_this16.viewSchema), _this16.escapeIdentifier(viewName), _this16.escapeIdentifier(_this16.viewSchema), _this16.escapeIdentifier(viewName)));
      } catch (ex) {
        _this16.integrityWarning(ex);
      }
    })();
  }

  createFriendlyView(form, repeatable) {
    var _this17 = this;

    return _asyncToGenerator(function* () {
      const viewName = _this17.getFriendlyTableName(form, repeatable);

      try {
        yield _this17.run((0, _util.format)('CREATE VIEW %s.%s AS SELECT * FROM %s.%s_view_full;', _this17.escapeIdentifier(_this17.viewSchema), _this17.escapeIdentifier(viewName), _this17.escapeIdentifier(_this17.dataSchema), _mssqlRecordValues2.default.tableNameWithForm(form, repeatable)));
      } catch (ex) {
        // sometimes it doesn't exist
        _this17.integrityWarning(ex);
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
    var _this18 = this;

    return _asyncToGenerator(function* () {
      if (fulcrum.args.mssqlBeforeFunction) {
        yield _this18.run((0, _util.format)('EXECUTE %s;', fulcrum.args.mssqlBeforeFunction));
      }
      if (_this18.mssqlCustomModule && _this18.mssqlCustomModule.beforeSync) {
        yield _this18.mssqlCustomModule.beforeSync();
      }
    })();
  }

  invokeAfterFunction() {
    var _this19 = this;

    return _asyncToGenerator(function* () {
      if (fulcrum.args.mssqlAfterFunction) {
        yield _this19.run((0, _util.format)('EXECUTE %s;', fulcrum.args.mssqlAfterFunction));
      }
      if (_this19.mssqlCustomModule && _this19.mssqlCustomModule.afterSync) {
        yield _this19.mssqlCustomModule.afterSync();
      }
    })();
  }

  rebuildForm(form, account, progress) {
    var _this20 = this;

    return _asyncToGenerator(function* () {
      yield _this20.recreateFormTables(form, account);
      yield _this20.reloadTableList();

      let index = 0;

      yield form.findEachRecord({}, (() => {
        var _ref24 = _asyncToGenerator(function* (record) {
          record.form = form;

          if (++index % 10 === 0) {
            progress(index);
          }

          yield _this20.updateRecord(record, account, true);
        });

        return function (_x27) {
          return _ref24.apply(this, arguments);
        };
      })());

      progress(index);
    })();
  }

  cleanupFriendlyViews(account) {
    var _this21 = this;

    return _asyncToGenerator(function* () {
      yield _this21.reloadViewList();

      const activeViewNames = [];

      const forms = yield account.findActiveForms({});

      for (const form of forms) {
        activeViewNames.push(_this21.getFriendlyTableName(form, null));

        for (const repeatable of form.elementsOfType('Repeatable')) {
          activeViewNames.push(_this21.getFriendlyTableName(form, repeatable));
        }
      }

      const remove = (0, _lodash.difference)(_this21.viewNames, activeViewNames);

      for (const viewName of remove) {
        if (viewName.indexOf('view_') === 0 || viewName.indexOf('view - ') === 0) {
          try {
            yield _this21.run((0, _util.format)('IF  (EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'[%s].[%s]\'))) DROP VIEW [%s].[%s];', _this21.escapeIdentifier(_this21.viewSchema), _this21.escapeIdentifier(viewName), _this21.escapeIdentifier(_this21.viewSchema), _this21.escapeIdentifier(viewName)));
          } catch (ex) {
            _this21.integrityWarning(ex);
          }
        }
      }
    })();
  }

  rebuildFriendlyViews(form, account) {
    var _this22 = this;

    return _asyncToGenerator(function* () {
      yield _this22.dropFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        yield _this22.dropFriendlyView(form, repeatable);
      }

      yield _this22.createFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        yield _this22.createFriendlyView(form, repeatable);
      }
    })();
  }

  dropSystemTables() {
    var _this23 = this;

    return _asyncToGenerator(function* () {
      yield _this23.runAll(_this23.prepareMigrationScript(_templateDrop2.default));
    })();
  }

  createDatabase(databaseName) {
    return this.run(`CREATE DATABASE ${databaseName};`);
  }

  dropDatabase(databaseName) {
    return this.run(`DROP DATABASE ${databaseName};`);
  }

  setupDatabase() {
    var _this24 = this;

    return _asyncToGenerator(function* () {
      yield _this24.runAll(_this24.prepareMigrationScript(_version2.default));
    })();
  }

  prepareMigrationScript(sql) {
    return sql.replace(/__SCHEMA__/g, this.dataSchema).replace(/__VIEW_SCHEMA__/g, this.viewSchema).split(';');
  }

  setupSystemTables(account) {
    var _this25 = this;

    return _asyncToGenerator(function* () {
      const progress = function (name, index) {
        _this25.updateStatus(name.green + ' : ' + index.toString().red);
      };

      yield account.findEachPhoto({}, (() => {
        var _ref25 = _asyncToGenerator(function* (photo, { index }) {
          if (++index % 10 === 0) {
            progress('Photos', index);
          }

          yield _this25.updatePhoto(photo, account);
        });

        return function (_x28, _x29) {
          return _ref25.apply(this, arguments);
        };
      })());

      yield account.findEachVideo({}, (() => {
        var _ref26 = _asyncToGenerator(function* (video, { index }) {
          if (++index % 10 === 0) {
            progress('Videos', index);
          }

          yield _this25.updateVideo(video, account);
        });

        return function (_x30, _x31) {
          return _ref26.apply(this, arguments);
        };
      })());

      yield account.findEachAudio({}, (() => {
        var _ref27 = _asyncToGenerator(function* (audio, { index }) {
          if (++index % 10 === 0) {
            progress('Audio', index);
          }

          yield _this25.updateAudio(audio, account);
        });

        return function (_x32, _x33) {
          return _ref27.apply(this, arguments);
        };
      })());

      yield account.findEachChangeset({}, (() => {
        var _ref28 = _asyncToGenerator(function* (changeset, { index }) {
          if (++index % 10 === 0) {
            progress('Changesets', index);
          }

          yield _this25.updateChangeset(changeset, account);
        });

        return function (_x34, _x35) {
          return _ref28.apply(this, arguments);
        };
      })());

      yield account.findEachRole({}, (() => {
        var _ref29 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Roles', index);
          }

          yield _this25.updateRole(object, account);
        });

        return function (_x36, _x37) {
          return _ref29.apply(this, arguments);
        };
      })());

      yield account.findEachProject({}, (() => {
        var _ref30 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Projects', index);
          }

          yield _this25.updateProject(object, account);
        });

        return function (_x38, _x39) {
          return _ref30.apply(this, arguments);
        };
      })());

      yield account.findEachForm({}, (() => {
        var _ref31 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Forms', index);
          }

          yield _this25.updateFormObject(object, account);
        });

        return function (_x40, _x41) {
          return _ref31.apply(this, arguments);
        };
      })());

      yield account.findEachMembership({}, (() => {
        var _ref32 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Memberships', index);
          }

          yield _this25.updateMembership(object, account);
        });

        return function (_x42, _x43) {
          return _ref32.apply(this, arguments);
        };
      })());

      yield account.findEachChoiceList({}, (() => {
        var _ref33 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Choice Lists', index);
          }

          yield _this25.updateChoiceList(object, account);
        });

        return function (_x44, _x45) {
          return _ref33.apply(this, arguments);
        };
      })());

      yield account.findEachClassificationSet({}, (() => {
        var _ref34 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Classification Sets', index);
          }

          yield _this25.updateClassificationSet(object, account);
        });

        return function (_x46, _x47) {
          return _ref34.apply(this, arguments);
        };
      })());
    })();
  }

  maybeInitialize() {
    var _this26 = this;

    return _asyncToGenerator(function* () {
      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (_this26.tableNames.indexOf('migrations') === -1) {
        console.log('Inititalizing database...');

        yield _this26.setupDatabase();
      }

      yield _this26.maybeRunMigrations(account);
    })();
  }

  maybeRunMigrations(account) {
    var _this27 = this;

    return _asyncToGenerator(function* () {
      _this27.migrations = (yield _this27.run(`SELECT name FROM ${_this27.dataSchema}.migrations`)).map(function (o) {
        return o.name;
      });

      yield _this27.maybeRunMigration('002', account);
      yield _this27.maybeRunMigration('003', account);
      yield _this27.maybeRunMigration('004', account);
    })();
  }

  maybeRunMigration(version, account) {
    var _this28 = this;

    return _asyncToGenerator(function* () {
      if (_this28.migrations.indexOf(version) === -1 && MIGRATIONS[version]) {
        yield _this28.runAll(_this28.prepareMigrationScript(MIGRATIONS[version]));

        if (version === '002') {
          console.log('Populating system tables...');

          // await this.setupSystemTables(account);
          yield _this28.populateRecords(account);
        }
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
          var _ref35 = _asyncToGenerator(function* (record) {
            record.form = form;

            if (++index % 10 === 0) {
              _this29.progress(form.name, index);
            }

            yield _this29.updateRecord(record, account, false);
          });

          return function (_x48) {
            return _ref35.apply(this, arguments);
          };
        })());
      }
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJERUZBVUxUX1NDSEVNQSIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImZ1bGNydW0iLCJhcmdzIiwibXNzcWxDcmVhdGVEYXRhYmFzZSIsImNyZWF0ZURhdGFiYXNlIiwibXNzcWxEcm9wRGF0YWJhc2UiLCJkcm9wRGF0YWJhc2UiLCJtc3NxbERyb3AiLCJkcm9wU3lzdGVtVGFibGVzIiwibXNzcWxTZXR1cCIsInNldHVwRGF0YWJhc2UiLCJhY2NvdW50IiwiZmV0Y2hBY2NvdW50Iiwib3JnIiwibXNzcWxTeXN0ZW1UYWJsZXNPbmx5Iiwic2V0dXBTeXN0ZW1UYWJsZXMiLCJpbnZva2VCZWZvcmVGdW5jdGlvbiIsImZvcm1zIiwiZmluZEFjdGl2ZUZvcm1zIiwiZm9ybSIsIm1zc3FsRm9ybSIsImlkIiwibXNzcWxSZWJ1aWxkVmlld3NPbmx5IiwicmVidWlsZEZyaWVuZGx5Vmlld3MiLCJyZWJ1aWxkRm9ybSIsImluZGV4IiwidXBkYXRlU3RhdHVzIiwibmFtZSIsImdyZWVuIiwidG9TdHJpbmciLCJyZWQiLCJjb25zb2xlIiwibG9nIiwiaW52b2tlQWZ0ZXJGdW5jdGlvbiIsImVycm9yIiwicnVuIiwic3FsIiwicmVwbGFjZSIsImRlYnVnIiwicmVzdWx0IiwicG9vbCIsInJlcXVlc3QiLCJiYXRjaCIsInJlY29yZHNldCIsInJ1bkFsbCIsInN0YXRlbWVudHMiLCJyZXN1bHRzIiwicHVzaCIsInRhYmxlTmFtZSIsInJvd0lEIiwib25TeW5jU3RhcnQiLCJ0YXNrcyIsIm9uU3luY0ZpbmlzaCIsImNsZWFudXBGcmllbmRseVZpZXdzIiwib25Gb3JtU2F2ZSIsIm9sZEZvcm0iLCJuZXdGb3JtIiwidXBkYXRlRm9ybSIsIm9uRm9ybURlbGV0ZSIsIl9pZCIsInJvd19pZCIsIl9uYW1lIiwiZWxlbWVudHMiLCJfZWxlbWVudHNKU09OIiwib25SZWNvcmRTYXZlIiwicmVjb3JkIiwidXBkYXRlUmVjb3JkIiwib25SZWNvcmREZWxldGUiLCJkZWxldGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwibXNzcWwiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJzaG91bGRVcGRhdGVGb3JtIiwidXBkYXRlRm9ybU9iamVjdCIsImdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyIsImRpc2FibGVBcnJheXMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaW50ZWdyaXR5V2FybmluZyIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwic3Rkb3V0IiwiaXNUVFkiLCJjbGVhckxpbmUiLCJjdXJzb3JUbyIsIndyaXRlIiwicHJvZ3Jlc3MiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNzcWxDb25uZWN0aW9uU3RyaW5nIiwidHlwZSIsIm1zc3FsRGF0YWJhc2UiLCJkZWZhdWx0IiwibXNzcWxIb3N0IiwiaG9zdCIsIm1zc3FsUG9ydCIsIm1zc3FsVXNlciIsIm1zc3FsUGFzc3dvcmQiLCJtc3NxbFNjaGVtYSIsIm1zc3FsU2NoZW1hVmlld3MiLCJtc3NxbFN5bmNFdmVudHMiLCJtc3NxbEJlZm9yZUZ1bmN0aW9uIiwibXNzcWxBZnRlckZ1bmN0aW9uIiwicmVxdWlyZWQiLCJtc3NxbFJlcG9ydEJhc2VVcmwiLCJtc3NxbE1lZGlhQmFzZVVybCIsIm1zc3FsVW5kZXJzY29yZU5hbWVzIiwiaGFuZGxlciIsInRyaW1JZGVudGlmaWVyIiwiaWRlbnRpZmllciIsInN1YnN0cmluZyIsImVzY2FwZUlkZW50aWZpZXIiLCJpZGVudCIsInVzZVN5bmNFdmVudHMiLCJvcHRpb25zIiwidXNlciIsInBhc3N3b3JkIiwicmVxdWlyZSIsImFwcCIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJjb25uZWN0Iiwib24iLCJzZXR1cE9wdGlvbnMiLCJtYXliZUluaXRpYWxpemUiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJvYmplY3QiLCJ2YWx1ZXMiLCJmaWxlIiwiYWNjZXNzX2tleSIsInRhYmxlIiwiZGVsZXRlU3RhdGVtZW50Iiwicm93X3Jlc291cmNlX2lkIiwiaW5zZXJ0U3RhdGVtZW50IiwicGsiLCJ3YXJuIiwic3RhY2siLCJzY2hlbWEiLCJ2YWx1ZXNUcmFuc2Zvcm1lciIsIm1lZGlhVVJMRm9ybWF0dGVyIiwibWVkaWFWYWx1ZSIsIml0ZW1zIiwiaXRlbSIsImVsZW1lbnQiLCJpc1Bob3RvRWxlbWVudCIsIm1lZGlhSUQiLCJpc1ZpZGVvRWxlbWVudCIsImlzQXVkaW9FbGVtZW50IiwibWVkaWFWaWV3VVJMRm9ybWF0dGVyIiwiaWRzIiwicmVwb3J0VVJMRm9ybWF0dGVyIiwiZmVhdHVyZSIsInZpZXdOYW1lIiwiZ2V0RnJpZW5kbHlUYWJsZU5hbWUiLCJkYXRhTmFtZSIsInByZWZpeCIsImtleSIsIm9iamVjdE5hbWUiLCJiZWZvcmVTeW5jIiwiYWZ0ZXJTeW5jIiwiZmluZEVhY2hSZWNvcmQiLCJhY3RpdmVWaWV3TmFtZXMiLCJyZW1vdmUiLCJwcmVwYXJlTWlncmF0aW9uU2NyaXB0IiwiZGF0YWJhc2VOYW1lIiwic3BsaXQiLCJmaW5kRWFjaFBob3RvIiwiZmluZEVhY2hWaWRlbyIsImZpbmRFYWNoQXVkaW8iLCJmaW5kRWFjaENoYW5nZXNldCIsImZpbmRFYWNoUm9sZSIsImZpbmRFYWNoUHJvamVjdCIsImZpbmRFYWNoRm9ybSIsImZpbmRFYWNoTWVtYmVyc2hpcCIsImZpbmRFYWNoQ2hvaWNlTGlzdCIsImZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQiLCJtYXliZVJ1bk1pZ3JhdGlvbnMiLCJtaWdyYXRpb25zIiwibWF5YmVSdW5NaWdyYXRpb24iLCJ2ZXJzaW9uIiwicG9wdWxhdGVSZWNvcmRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBOzs7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7SUFLWUEsRzs7QUFKWjs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUVBOztBQUVBOzs7O0FBQ0E7Ozs7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TSxrQkFBUUMsR0FBUixDQUFZLDZCQUFaOztBQUVBO0FBQ0EsZ0JBQU0sUUFBSzhNLGVBQUwsQ0FBcUJuTyxPQUFyQixDQUFOO0FBQ0Q7QUFDRjtBQVZ1QztBQVd6Qzs7QUFFS21PLGlCQUFOLENBQXNCbk8sT0FBdEIsRUFBK0I7QUFBQTs7QUFBQTtBQUM3QixZQUFNTSxRQUFRLE1BQU1OLFFBQVFPLGVBQVIsQ0FBd0IsRUFBeEIsQ0FBcEI7O0FBRUEsVUFBSU8sUUFBUSxDQUFaOztBQUVBLFdBQUssTUFBTU4sSUFBWCxJQUFtQkYsS0FBbkIsRUFBMEI7QUFDeEJRLGdCQUFRLENBQVI7O0FBRUEsY0FBTU4sS0FBS3VNLGNBQUwsQ0FBb0IsRUFBcEI7QUFBQSx5Q0FBd0IsV0FBT3pKLE1BQVAsRUFBa0I7QUFDOUNBLG1CQUFPOUMsSUFBUCxHQUFjQSxJQUFkOztBQUVBLGdCQUFJLEVBQUVNLEtBQUYsR0FBVSxFQUFWLEtBQWlCLENBQXJCLEVBQXdCO0FBQ3RCLHNCQUFLb0gsUUFBTCxDQUFjMUgsS0FBS1EsSUFBbkIsRUFBeUJGLEtBQXpCO0FBQ0Q7O0FBRUQsa0JBQU0sUUFBS3lDLFlBQUwsQ0FBa0JELE1BQWxCLEVBQTBCdEQsT0FBMUIsRUFBbUMsS0FBbkMsQ0FBTjtBQUNELFdBUks7O0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBTjtBQVNEO0FBakI0QjtBQWtCOUI7O0FBMTRCa0IsQyIsImZpbGUiOiJwbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbXNzcWwgZnJvbSAnbXNzcWwnO1xyXG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICd1dGlsJztcclxuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcclxuaW1wb3J0IHsgTVNTUUwgfSBmcm9tICdmdWxjcnVtJztcclxuaW1wb3J0IE1TU1FMUmVjb3JkVmFsdWVzIGZyb20gJy4vbXNzcWwtcmVjb3JkLXZhbHVlcydcclxuaW1wb3J0IHNuYWtlIGZyb20gJ3NuYWtlLWNhc2UnO1xyXG5pbXBvcnQgdGVtcGxhdGVEcm9wIGZyb20gJy4vdGVtcGxhdGUuZHJvcC5zcWwnO1xyXG5pbXBvcnQgU2NoZW1hTWFwIGZyb20gJy4vc2NoZW1hLW1hcCc7XHJcbmltcG9ydCAqIGFzIGFwaSBmcm9tICdmdWxjcnVtJztcclxuaW1wb3J0IHsgY29tcGFjdCwgZGlmZmVyZW5jZSB9IGZyb20gJ2xvZGFzaCc7XHJcblxyXG5pbXBvcnQgdmVyc2lvbjAwMSBmcm9tICcuL3ZlcnNpb24tMDAxLnNxbCc7XHJcbmltcG9ydCB2ZXJzaW9uMDAyIGZyb20gJy4vdmVyc2lvbi0wMDIuc3FsJztcclxuaW1wb3J0IHZlcnNpb24wMDMgZnJvbSAnLi92ZXJzaW9uLTAwMy5zcWwnO1xyXG5pbXBvcnQgdmVyc2lvbjAwNCBmcm9tICcuL3ZlcnNpb24tMDA0LnNxbCc7XHJcblxyXG5jb25zdCBNQVhfSURFTlRJRklFUl9MRU5HVEggPSAxMDA7XHJcblxyXG5jb25zdCBNU1NRTF9DT05GSUcgPSB7XHJcbiAgZGF0YWJhc2U6ICdmdWxjcnVtYXBwJyxcclxuICBzZXJ2ZXI6ICdsb2NhbGhvc3QnLFxyXG4gIHBvcnQ6IDE0MzMsXHJcbiAgbWF4OiAxMCxcclxuICBpZGxlVGltZW91dE1pbGxpczogMzAwMDBcclxufTtcclxuXHJcbmNvbnN0IE1JR1JBVElPTlMgPSB7XHJcbiAgJzAwMic6IHZlcnNpb24wMDIsXHJcbiAgJzAwMyc6IHZlcnNpb24wMDMsXHJcbiAgJzAwNCc6IHZlcnNpb24wMDRcclxufTtcclxuXHJcbmNvbnN0IERFRkFVTFRfU0NIRU1BID0gJ2Ribyc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XHJcbiAgYXN5bmMgdGFzayhjbGkpIHtcclxuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XHJcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXHJcbiAgICAgIGRlc2M6ICdydW4gdGhlIG1zc3FsIHN5bmMgZm9yIGEgc3BlY2lmaWMgb3JnYW5pemF0aW9uJyxcclxuICAgICAgYnVpbGRlcjoge1xyXG4gICAgICAgIG1zc3FsQ29ubmVjdGlvblN0cmluZzoge1xyXG4gICAgICAgICAgZGVzYzogJ21zc3FsIGNvbm5lY3Rpb24gc3RyaW5nIChvdmVycmlkZXMgYWxsIGluZGl2aWR1YWwgZGF0YWJhc2UgY29ubmVjdGlvbiBwYXJhbWV0ZXJzKScsXHJcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXNzcWxEYXRhYmFzZToge1xyXG4gICAgICAgICAgZGVzYzogJ21zc3FsIGRhdGFiYXNlIG5hbWUnLFxyXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuZGF0YWJhc2VcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1zc3FsSG9zdDoge1xyXG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBob3N0JyxcclxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1zc3FsUG9ydDoge1xyXG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcclxuICAgICAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcclxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5wb3J0XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtc3NxbFVzZXI6IHtcclxuICAgICAgICAgIGRlc2M6ICdtc3NxbCB1c2VyJyxcclxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBtc3NxbFBhc3N3b3JkOiB7XHJcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxyXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1zc3FsU2NoZW1hOiB7XHJcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hJyxcclxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBtc3NxbFNjaGVtYVZpZXdzOiB7XHJcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hIGZvciB0aGUgZnJpZW5kbHkgdmlld3MnLFxyXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1zc3FsU3luY0V2ZW50czoge1xyXG4gICAgICAgICAgZGVzYzogJ2FkZCBzeW5jIGV2ZW50IGhvb2tzJyxcclxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1zc3FsQmVmb3JlRnVuY3Rpb246IHtcclxuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYmVmb3JlIHRoZSBzeW5jJyxcclxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBtc3NxbEFmdGVyRnVuY3Rpb246IHtcclxuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYWZ0ZXIgdGhlIHN5bmMnLFxyXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9yZzoge1xyXG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcclxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxyXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1zc3FsRm9ybToge1xyXG4gICAgICAgICAgZGVzYzogJ3RoZSBmb3JtIElEIHRvIHJlYnVpbGQnLFxyXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1zc3FsUmVwb3J0QmFzZVVybDoge1xyXG4gICAgICAgICAgZGVzYzogJ3JlcG9ydCBVUkwgYmFzZScsXHJcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXNzcWxNZWRpYUJhc2VVcmw6IHtcclxuICAgICAgICAgIGRlc2M6ICdtZWRpYSBVUkwgYmFzZScsXHJcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXNzcWxVbmRlcnNjb3JlTmFtZXM6IHtcclxuICAgICAgICAgIGRlc2M6ICd1c2UgdW5kZXJzY29yZSBuYW1lcyAoZS5nLiBcIlBhcmsgSW5zcGVjdGlvbnNcIiBiZWNvbWVzIFwicGFya19pbnNwZWN0aW9uc1wiKScsXHJcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXHJcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXHJcbiAgICAgICAgfSxcclxuICAgICAgICBtc3NxbFJlYnVpbGRWaWV3c09ubHk6IHtcclxuICAgICAgICAgIGRlc2M6ICdvbmx5IHJlYnVpbGQgdGhlIHZpZXdzJyxcclxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXHJcbiAgICAgICAgfSxcclxuICAgICAgICBtc3NxbEN1c3RvbU1vZHVsZToge1xyXG4gICAgICAgICAgZGVzYzogJ2EgY3VzdG9tIG1vZHVsZSB0byBsb2FkIHdpdGggc3luYyBleHRlbnNpb25zIChleHBlcmltZW50YWwpJyxcclxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBtc3NxbFNldHVwOiB7XHJcbiAgICAgICAgICBkZXNjOiAnc2V0dXAgdGhlIGRhdGFiYXNlJyxcclxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXNzcWxEcm9wOiB7XHJcbiAgICAgICAgICBkZXNjOiAnZHJvcCB0aGUgc3lzdGVtIHRhYmxlcycsXHJcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXHJcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXNzcWxTeXN0ZW1UYWJsZXNPbmx5OiB7XHJcbiAgICAgICAgICBkZXNjOiAnb25seSBjcmVhdGUgdGhlIHN5c3RlbSByZWNvcmRzJyxcclxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcclxuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcclxuXHJcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3JlYXRlRGF0YWJhc2UpIHtcclxuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNzcWxDcmVhdGVEYXRhYmFzZSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcERhdGFiYXNlKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMuZHJvcERhdGFiYXNlKGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcCkge1xyXG4gICAgICBhd2FpdCB0aGlzLmRyb3BTeXN0ZW1UYWJsZXMoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxTZXR1cCkge1xyXG4gICAgICBhd2FpdCB0aGlzLnNldHVwRGF0YWJhc2UoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcclxuXHJcbiAgICBpZiAoYWNjb3VudCkge1xyXG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsU3lzdGVtVGFibGVzT25seSkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLmludm9rZUJlZm9yZUZ1bmN0aW9uKCk7XHJcblxyXG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcclxuXHJcbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xyXG4gICAgICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxGb3JtICYmIGZvcm0uaWQgIT09IGZ1bGNydW0uYXJncy5tc3NxbEZvcm0pIHtcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFJlYnVpbGRWaWV3c09ubHkpIHtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZyaWVuZGx5Vmlld3MoZm9ybSwgYWNjb3VudCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKGluZGV4KSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coJycpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLmludm9rZUFmdGVyRnVuY3Rpb24oKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpIHtcclxuICAgIHJldHVybiBpZGVudGlmaWVyLnN1YnN0cmluZygwLCBNQVhfSURFTlRJRklFUl9MRU5HVEgpO1xyXG4gIH1cclxuXHJcbiAgZXNjYXBlSWRlbnRpZmllcihpZGVudGlmaWVyKSB7XHJcbiAgICByZXR1cm4gaWRlbnRpZmllciAmJiB0aGlzLm1zc3FsLmlkZW50KHRoaXMudHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikpO1xyXG4gIH1cclxuXHJcbiAgZ2V0IHVzZVN5bmNFdmVudHMoKSB7XHJcbiAgICByZXR1cm4gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyAhPSBudWxsID8gZnVsY3J1bS5hcmdzLm1zc3FsU3luY0V2ZW50cyA6IHRydWU7XHJcbiAgfVxyXG5cclxuICBhc3luYyBhY3RpdmF0ZSgpIHtcclxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XHJcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcclxuICAgICAgc2VydmVyOiBmdWxjcnVtLmFyZ3MubXNzcWxIb3N0IHx8IE1TU1FMX0NPTkZJRy5zZXJ2ZXIsXHJcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc3NxbFBvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXHJcbiAgICAgIGRhdGFiYXNlOiBmdWxjcnVtLmFyZ3MubXNzcWxEYXRhYmFzZSB8fCBNU1NRTF9DT05GSUcuZGF0YWJhc2UsXHJcbiAgICAgIHVzZXI6IGZ1bGNydW0uYXJncy5tc3NxbFVzZXIgfHwgTVNTUUxfQ09ORklHLnVzZXIsXHJcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCB8fCBNU1NRTF9DT05GSUcudXNlclxyXG4gICAgfTtcclxuXHJcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsVXNlcikge1xyXG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXNzcWxVc2VyO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCkge1xyXG4gICAgICBvcHRpb25zLnBhc3N3b3JkID0gZnVsY3J1bS5hcmdzLm1zc3FsUGFzc3dvcmQ7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEN1c3RvbU1vZHVsZSkge1xyXG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlID0gcmVxdWlyZShmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpO1xyXG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwaSA9IGFwaTtcclxuICAgICAgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hcHAgPSBmdWxjcnVtO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZGlzYWJsZUFycmF5cyA9IGZhbHNlO1xyXG4gICAgdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzID0gdHJ1ZTtcclxuXHJcbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KGZ1bGNydW0uYXJncy5tc3NxbENvbm5lY3Rpb25TdHJpbmcgfHwgb3B0aW9ucyk7XHJcblxyXG4gICAgaWYgKHRoaXMudXNlU3luY0V2ZW50cykge1xyXG4gICAgICBmdWxjcnVtLm9uKCdzeW5jOnN0YXJ0JywgdGhpcy5vblN5bmNTdGFydCk7XHJcbiAgICAgIGZ1bGNydW0ub24oJ3N5bmM6ZmluaXNoJywgdGhpcy5vblN5bmNGaW5pc2gpO1xyXG4gICAgICBmdWxjcnVtLm9uKCdwaG90bzpzYXZlJywgdGhpcy5vblBob3RvU2F2ZSk7XHJcbiAgICAgIGZ1bGNydW0ub24oJ3ZpZGVvOnNhdmUnLCB0aGlzLm9uVmlkZW9TYXZlKTtcclxuICAgICAgZnVsY3J1bS5vbignYXVkaW86c2F2ZScsIHRoaXMub25BdWRpb1NhdmUpO1xyXG4gICAgICBmdWxjcnVtLm9uKCdjaGFuZ2VzZXQ6c2F2ZScsIHRoaXMub25DaGFuZ2VzZXRTYXZlKTtcclxuICAgICAgZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XHJcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcclxuXHJcbiAgICAgIGZ1bGNydW0ub24oJ2Nob2ljZS1saXN0OnNhdmUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xyXG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpkZWxldGUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xyXG5cclxuICAgICAgZnVsY3J1bS5vbignZm9ybTpzYXZlJywgdGhpcy5vbkZvcm1TYXZlKTtcclxuICAgICAgZnVsY3J1bS5vbignZm9ybTpkZWxldGUnLCB0aGlzLm9uRm9ybVNhdmUpO1xyXG5cclxuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OnNhdmUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcclxuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OmRlbGV0ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xyXG5cclxuICAgICAgZnVsY3J1bS5vbigncm9sZTpzYXZlJywgdGhpcy5vblJvbGVTYXZlKTtcclxuICAgICAgZnVsY3J1bS5vbigncm9sZTpkZWxldGUnLCB0aGlzLm9uUm9sZVNhdmUpO1xyXG5cclxuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpzYXZlJywgdGhpcy5vblByb2plY3RTYXZlKTtcclxuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpkZWxldGUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xyXG5cclxuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpzYXZlJywgdGhpcy5vbk1lbWJlcnNoaXBTYXZlKTtcclxuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpkZWxldGUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudmlld1NjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYVZpZXdzIHx8IERFRkFVTFRfU0NIRU1BO1xyXG4gICAgdGhpcy5kYXRhU2NoZW1hID0gZnVsY3J1bS5hcmdzLm1zc3FsU2NoZW1hIHx8IERFRkFVTFRfU0NIRU1BO1xyXG5cclxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcclxuICAgIC8vIGNyZWF0aW9uIG9mIG5ldyB0YWJsZXMgZXZlbiB3aGVuIHRoZSBmb3JtIGlzbid0IHZlcnNpb24gMS4gSWYgdGhlIHRhYmxlIGRvZXNuJ3RcclxuICAgIC8vIGV4aXN0LCB3ZSBjYW4gcHJldGVuZCB0aGUgZm9ybSBpcyB2ZXJzaW9uIDEgc28gaXQgY3JlYXRlcyBhbGwgbmV3IHRhYmxlcyBpbnN0ZWFkXHJcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxyXG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9JyR7IHRoaXMuZGF0YVNjaGVtYSB9J2ApO1xyXG5cclxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcclxuXHJcbiAgICAvLyBtYWtlIGEgY2xpZW50IHNvIHdlIGNhbiB1c2UgaXQgdG8gYnVpbGQgU1FMIHN0YXRlbWVudHNcclxuICAgIHRoaXMubXNzcWwgPSBuZXcgTVNTUUwoe30pO1xyXG5cclxuICAgIHRoaXMuc2V0dXBPcHRpb25zKCk7XHJcblxyXG4gICAgYXdhaXQgdGhpcy5tYXliZUluaXRpYWxpemUoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGRlYWN0aXZhdGUoKSB7XHJcbiAgICBpZiAodGhpcy5wb29sKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcnVuID0gYXN5bmMgKHNxbCkgPT4ge1xyXG4gICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcMC9nLCAnJyk7XHJcblxyXG4gICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xyXG4gICAgICBjb25zb2xlLmxvZyhzcWwpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucG9vbC5yZXF1ZXN0KCkuYmF0Y2goc3FsKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0LnJlY29yZHNldDtcclxuICB9XHJcblxyXG4gIHJ1bkFsbCA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XHJcbiAgICBjb25zdCByZXN1bHRzID0gW107XHJcblxyXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xyXG4gICAgICByZXN1bHRzLnB1c2goYXdhaXQgdGhpcy5ydW4oc3FsKSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdHM7XHJcbiAgfVxyXG5cclxuICBsb2cgPSAoLi4uYXJncykgPT4ge1xyXG4gICAgLy8gY29uc29sZS5sb2coLi4uYXJncyk7XHJcbiAgfVxyXG5cclxuICB0YWJsZU5hbWUgPSAoYWNjb3VudCwgbmFtZSkgPT4ge1xyXG4gICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcclxuICB9XHJcblxyXG4gIG9uU3luY1N0YXJ0ID0gYXN5bmMgKHthY2NvdW50LCB0YXNrc30pID0+IHtcclxuICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcclxuICB9XHJcblxyXG4gIG9uU3luY0ZpbmlzaCA9IGFzeW5jICh7YWNjb3VudH0pID0+IHtcclxuICAgIGF3YWl0IHRoaXMuY2xlYW51cEZyaWVuZGx5Vmlld3MoYWNjb3VudCk7XHJcbiAgICBhd2FpdCB0aGlzLmludm9rZUFmdGVyRnVuY3Rpb24oKTtcclxuICB9XHJcblxyXG4gIG9uRm9ybVNhdmUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm19KSA9PiB7XHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSk7XHJcbiAgfVxyXG5cclxuICBvbkZvcm1EZWxldGUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnR9KSA9PiB7XHJcbiAgICBjb25zdCBvbGRGb3JtID0ge1xyXG4gICAgICBpZDogZm9ybS5faWQsXHJcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcclxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcclxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxyXG4gICAgfTtcclxuXHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbnVsbCk7XHJcbiAgfVxyXG5cclxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZCwgYWNjb3VudH0pID0+IHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCk7XHJcbiAgfVxyXG5cclxuICBvblJlY29yZERlbGV0ZSA9IGFzeW5jICh7cmVjb3JkfSkgPT4ge1xyXG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xyXG5cclxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcclxuICB9XHJcblxyXG4gIG9uUGhvdG9TYXZlID0gYXN5bmMgKHtwaG90bywgYWNjb3VudH0pID0+IHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xyXG4gIH1cclxuXHJcbiAgb25WaWRlb1NhdmUgPSBhc3luYyAoe3ZpZGVvLCBhY2NvdW50fSkgPT4ge1xyXG4gICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XHJcbiAgfVxyXG5cclxuICBvbkF1ZGlvU2F2ZSA9IGFzeW5jICh7YXVkaW8sIGFjY291bnR9KSA9PiB7XHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUF1ZGlvKGF1ZGlvLCBhY2NvdW50KTtcclxuICB9XHJcblxyXG4gIG9uQ2hhbmdlc2V0U2F2ZSA9IGFzeW5jICh7Y2hhbmdlc2V0LCBhY2NvdW50fSkgPT4ge1xyXG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcclxuICB9XHJcblxyXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe2Nob2ljZUxpc3QsIGFjY291bnR9KSA9PiB7XHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3QoY2hvaWNlTGlzdCwgYWNjb3VudCk7XHJcbiAgfVxyXG5cclxuICBvbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSA9IGFzeW5jICh7Y2xhc3NpZmljYXRpb25TZXQsIGFjY291bnR9KSA9PiB7XHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KGNsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50KTtcclxuICB9XHJcblxyXG4gIG9uUHJvamVjdFNhdmUgPSBhc3luYyAoe3Byb2plY3QsIGFjY291bnR9KSA9PiB7XHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3QocHJvamVjdCwgYWNjb3VudCk7XHJcbiAgfVxyXG5cclxuICBvblJvbGVTYXZlID0gYXN5bmMgKHtyb2xlLCBhY2NvdW50fSkgPT4ge1xyXG4gICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKHJvbGUsIGFjY291bnQpO1xyXG4gIH1cclxuXHJcbiAgb25NZW1iZXJzaGlwU2F2ZSA9IGFzeW5jICh7bWVtYmVyc2hpcCwgYWNjb3VudH0pID0+IHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlTWVtYmVyc2hpcChtZW1iZXJzaGlwLCBhY2NvdW50KTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHVwZGF0ZVBob3RvKG9iamVjdCwgYWNjb3VudCkge1xyXG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnBob3RvKG9iamVjdCk7XHJcblxyXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFBob3RvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcclxuXHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdwaG90b3MnKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHVwZGF0ZVZpZGVvKG9iamVjdCwgYWNjb3VudCkge1xyXG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnZpZGVvKG9iamVjdCk7XHJcblxyXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdFZpZGVvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcclxuXHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICd2aWRlb3MnKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHVwZGF0ZUF1ZGlvKG9iamVjdCwgYWNjb3VudCkge1xyXG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLmF1ZGlvKG9iamVjdCk7XHJcblxyXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdEF1ZGlvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcclxuXHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICdhdWRpbycpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgdXBkYXRlQ2hhbmdlc2V0KG9iamVjdCwgYWNjb3VudCkge1xyXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNoYW5nZXNldChvYmplY3QpLCAnY2hhbmdlc2V0cycpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgdXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpIHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5wcm9qZWN0KG9iamVjdCksICdwcm9qZWN0cycpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgdXBkYXRlTWVtYmVyc2hpcChvYmplY3QsIGFjY291bnQpIHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5tZW1iZXJzaGlwKG9iamVjdCksICdtZW1iZXJzaGlwcycpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgdXBkYXRlUm9sZShvYmplY3QsIGFjY291bnQpIHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yb2xlKG9iamVjdCksICdyb2xlcycpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgdXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpIHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5mb3JtKG9iamVjdCksICdmb3JtcycpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgdXBkYXRlQ2hvaWNlTGlzdChvYmplY3QsIGFjY291bnQpIHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5jaG9pY2VMaXN0KG9iamVjdCksICdjaG9pY2VfbGlzdHMnKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCwgYWNjb3VudCkge1xyXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCksICdjbGFzc2lmaWNhdGlvbl9zZXRzJyk7XHJcbiAgfVxyXG5cclxuICBhc3luYyB1cGRhdGVPYmplY3QodmFsdWVzLCB0YWJsZSkge1xyXG4gICAgY29uc3QgZGVsZXRlU3RhdGVtZW50ID0gdGhpcy5tc3NxbC5kZWxldGVTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHtyb3dfcmVzb3VyY2VfaWQ6IHZhbHVlcy5yb3dfcmVzb3VyY2VfaWR9KTtcclxuICAgIGNvbnN0IGluc2VydFN0YXRlbWVudCA9IHRoaXMubXNzcWwuaW5zZXJ0U3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB2YWx1ZXMsIHtwazogJ2lkJ30pO1xyXG5cclxuICAgIGNvbnN0IHNxbCA9IFsgZGVsZXRlU3RhdGVtZW50LnNxbCwgaW5zZXJ0U3RhdGVtZW50LnNxbCBdLmpvaW4oJ1xcbicpO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucnVuKHNxbCk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xyXG4gICAgICB0aHJvdyBleDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJlbG9hZFRhYmxlTGlzdCA9IGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcclxuXHJcbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XHJcbiAgfVxyXG5cclxuICByZWxvYWRWaWV3TGlzdCA9IGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLnZpZXdTY2hlbWEgfSdgKTtcclxuXHJcbiAgICB0aGlzLnZpZXdOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcclxuICB9XHJcblxyXG4gIGJhc2VNZWRpYVVSTCA9ICgpID0+IHtcclxuICB9XHJcblxyXG4gIGZvcm1hdFBob3RvVVJMID0gKGlkKSA9PiB7XHJcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zLyR7IGlkIH0uanBnYDtcclxuICB9XHJcblxyXG4gIGZvcm1hdFZpZGVvVVJMID0gKGlkKSA9PiB7XHJcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zLyR7IGlkIH0ubXA0YDtcclxuICB9XHJcblxyXG4gIGZvcm1hdEF1ZGlvVVJMID0gKGlkKSA9PiB7XHJcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vJHsgaWQgfS5tNGFgO1xyXG4gIH1cclxuXHJcbiAgaW50ZWdyaXR5V2FybmluZyhleCkge1xyXG4gICAgY29uc29sZS53YXJuKGBcclxuLS0tLS0tLS0tLS0tLVxyXG4hISBXQVJOSU5HICEhXHJcbi0tLS0tLS0tLS0tLS1cclxuXHJcbk1TU1FMIGRhdGFiYXNlIGludGVncml0eSBpc3N1ZSBlbmNvdW50ZXJlZC4gQ29tbW9uIHNvdXJjZXMgb2YgZGF0YWJhc2UgaXNzdWVzIGFyZTpcclxuXHJcbiogUmVpbnN0YWxsaW5nIEZ1bGNydW0gRGVza3RvcCBhbmQgdXNpbmcgYW4gb2xkIE1TU1FMIGRhdGFiYXNlIHdpdGhvdXQgcmVjcmVhdGluZ1xyXG4gIHRoZSBNU1NRTCBkYXRhYmFzZS5cclxuKiBEZWxldGluZyB0aGUgaW50ZXJuYWwgYXBwbGljYXRpb24gZGF0YWJhc2UgYW5kIHVzaW5nIGFuIGV4aXN0aW5nIE1TU1FMIGRhdGFiYXNlXHJcbiogTWFudWFsbHkgbW9kaWZ5aW5nIHRoZSBNU1NRTCBkYXRhYmFzZVxyXG4qIENyZWF0aW5nIG11bHRpcGxlIGFwcHMgaW4gRnVsY3J1bSB3aXRoIHRoZSBzYW1lIG5hbWUuIFRoaXMgaXMgZ2VuZXJhbGx5IE9LLCBleGNlcHRcclxuICB5b3Ugd2lsbCBub3QgYmUgYWJsZSB0byB1c2UgdGhlIFwiZnJpZW5kbHkgdmlld1wiIGZlYXR1cmUgb2YgdGhlIE1TU1FMIHBsdWdpbiBzaW5jZVxyXG4gIHRoZSB2aWV3IG5hbWVzIGFyZSBkZXJpdmVkIGZyb20gdGhlIGZvcm0gbmFtZXMuXHJcblxyXG5Ob3RlOiBXaGVuIHJlaW5zdGFsbGluZyBGdWxjcnVtIERlc2t0b3Agb3IgXCJzdGFydGluZyBvdmVyXCIgeW91IG5lZWQgdG8gZHJvcCBhbmQgcmUtY3JlYXRlXHJcbnRoZSBNU1NRTCBkYXRhYmFzZS4gVGhlIG5hbWVzIG9mIGRhdGFiYXNlIG9iamVjdHMgYXJlIHRpZWQgZGlyZWN0bHkgdG8gdGhlIGRhdGFiYXNlXHJcbm9iamVjdHMgaW4gdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlLlxyXG5cclxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblJlcG9ydCBpc3N1ZXMgYXQgaHR0cHM6Ly9naXRodWIuY29tL2Z1bGNydW1hcHAvZnVsY3J1bS1kZXNrdG9wL2lzc3Vlc1xyXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuTWVzc2FnZTpcclxuJHsgZXgubWVzc2FnZSB9XHJcblxyXG5TdGFjazpcclxuJHsgZXguc3RhY2sgfVxyXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuYC5yZWRcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBzZXR1cE9wdGlvbnMoKSB7XHJcbiAgICB0aGlzLmJhc2VNZWRpYVVSTCA9IGZ1bGNydW0uYXJncy5tc3NxbE1lZGlhQmFzZVVybCA/IGZ1bGNydW0uYXJncy5tc3NxbE1lZGlhQmFzZVVybCA6ICdodHRwczovL2FwaS5mdWxjcnVtYXBwLmNvbS9hcGkvdjInO1xyXG5cclxuICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zID0ge1xyXG4gICAgICBzY2hlbWE6IHRoaXMuZGF0YVNjaGVtYSxcclxuXHJcbiAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcclxuXHJcbiAgICAgIGRpc2FibGVDb21wbGV4VHlwZXM6IHRoaXMuZGlzYWJsZUNvbXBsZXhUeXBlcyxcclxuXHJcbiAgICAgIHZhbHVlc1RyYW5zZm9ybWVyOiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUudmFsdWVzVHJhbnNmb3JtZXIsXHJcblxyXG4gICAgICBtZWRpYVVSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1lZGlhVmFsdWUuaXRlbXMubWFwKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZvcm1hdFBob3RvVVJMKGl0ZW0ubWVkaWFJRCk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRWaWRlb1VSTChpdGVtLm1lZGlhSUQpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNBdWRpb0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZm9ybWF0QXVkaW9VUkwoaXRlbS5tZWRpYUlEKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9KTtcclxuICAgICAgfSxcclxuXHJcbiAgICAgIG1lZGlhVmlld1VSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcclxuICAgICAgICBjb25zdCBpZHMgPSBtZWRpYVZhbHVlLml0ZW1zLm1hcChvID0+IG8ubWVkaWFJRCk7XHJcblxyXG4gICAgICAgIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNQaG90b0VsZW1lbnQpIHtcclxuICAgICAgICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9waG90b3Mvdmlldz9waG90b3M9JHsgaWRzIH1gO1xyXG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XHJcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zL3ZpZXc/dmlkZW9zPSR7IGlkcyB9YDtcclxuICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xyXG4gICAgICAgICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L2F1ZGlvL3ZpZXc/YXVkaW89JHsgaWRzIH1gO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwpIHtcclxuICAgICAgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMucmVwb3J0VVJMRm9ybWF0dGVyID0gKGZlYXR1cmUpID0+IHtcclxuICAgICAgICByZXR1cm4gYCR7IGZ1bGNydW0uYXJncy5tc3NxbFJlcG9ydEJhc2VVcmwgfS9yZXBvcnRzLyR7IGZlYXR1cmUuaWQgfS5wZGZgO1xyXG4gICAgICB9O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgdXBkYXRlUmVjb3JkID0gYXN5bmMgKHJlY29yZCwgYWNjb3VudCwgc2tpcFRhYmxlQ2hlY2spID0+IHtcclxuICAgIGlmICghc2tpcFRhYmxlQ2hlY2sgJiYgIXRoaXMucm9vdFRhYmxlRXhpc3RzKHJlY29yZC5mb3JtKSkge1xyXG4gICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKHJlY29yZC5mb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVSZWNvcmQgJiYgIXRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkKHtyZWNvcmQsIGFjY291bnR9KSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLnVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XHJcblxyXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xyXG5cclxuICAgIGNvbnN0IHN5c3RlbVZhbHVlcyA9IE1TU1FMUmVjb3JkVmFsdWVzLnN5c3RlbUNvbHVtblZhbHVlc0ZvckZlYXR1cmUocmVjb3JkLCBudWxsLCByZWNvcmQsIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zKTtcclxuXHJcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucmVjb3JkKHJlY29yZCwgc3lzdGVtVmFsdWVzKSwgJ3JlY29yZHMnKTtcclxuICB9XHJcblxyXG4gIHJvb3RUYWJsZUV4aXN0cyA9IChmb3JtKSA9PiB7XHJcbiAgICByZXR1cm4gdGhpcy50YWJsZU5hbWVzLmluZGV4T2YoTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSkpICE9PSAtMTtcclxuICB9XHJcblxyXG4gIHJlY3JlYXRlRm9ybVRhYmxlcyA9IGFzeW5jIChmb3JtLCBhY2NvdW50KSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSwgbnVsbCk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihzcWwpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG51bGwsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSkpO1xyXG4gIH1cclxuXHJcbiAgdXBkYXRlRm9ybSA9IGFzeW5jIChmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKSA9PiB7XHJcbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0gJiYgIXRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSh7Zm9ybSwgYWNjb3VudH0pKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3QoZm9ybSwgYWNjb3VudCk7XHJcblxyXG4gICAgICBpZiAoIXRoaXMucm9vdFRhYmxlRXhpc3RzKGZvcm0pICYmIG5ld0Zvcm0gIT0gbnVsbCkge1xyXG4gICAgICAgIG9sZEZvcm0gPSBudWxsO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCB7c3RhdGVtZW50c30gPSBhd2FpdCBNU1NRTFNjaGVtYS5nZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMoYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSwgdGhpcy5kaXNhYmxlQXJyYXlzLFxyXG4gICAgICAgIGZhbHNlIC8qIGRpc2FibGVDb21wbGV4VHlwZXMgKi8sIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUsIHRoaXMuZGF0YVNjaGVtYSk7XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLnJ1bkFsbChbJ0JFR0lOIFRSQU5TQUNUSU9OOycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAuLi5zdGF0ZW1lbnRzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ0NPTU1JVCBUUkFOU0FDVElPTjsnXSk7XHJcblxyXG4gICAgICBpZiAobmV3Rm9ybSkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XHJcbiAgICBjb25zdCB2aWV3TmFtZSA9IHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSk7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdJRiAoRVhJU1RTIChTRUxFQ1QgKiBGUk9NIHN5cy52aWV3cyBXSEVSRSBvYmplY3RfaWQgPSBPQkpFQ1RfSUQoTlxcJ1slc10uWyVzXVxcJykpKSBEUk9QIFZJRVcgWyVzXS5bJXNdOycsXHJcbiAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcclxuICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLnZpZXdTY2hlbWEpLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpKSk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcclxuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0NSRUFURSBWSUVXICVzLiVzIEFTIFNFTEVDVCAqIEZST00gJXMuJXNfdmlld19mdWxsOycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy5kYXRhU2NoZW1hKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0sIHJlcGVhdGFibGUpKSk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxyXG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSkge1xyXG4gICAgY29uc3QgbmFtZSA9IGNvbXBhY3QoW2Zvcm0ubmFtZSwgcmVwZWF0YWJsZSAmJiByZXBlYXRhYmxlLmRhdGFOYW1lXSkuam9pbignIC0gJylcclxuXHJcbiAgICBjb25zdCBwcmVmaXggPSBjb21wYWN0KFsndmlldycsIGZvcm0ucm93SUQsIHJlcGVhdGFibGUgJiYgcmVwZWF0YWJsZS5rZXldKS5qb2luKCcgLSAnKTtcclxuXHJcbiAgICBjb25zdCBvYmplY3ROYW1lID0gW3ByZWZpeCwgbmFtZV0uam9pbignIC0gJyk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMudHJpbUlkZW50aWZpZXIoZnVsY3J1bS5hcmdzLm1zc3FsVW5kZXJzY29yZU5hbWVzICE9PSBmYWxzZSA/IHNuYWtlKG9iamVjdE5hbWUpIDogb2JqZWN0TmFtZSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBpbnZva2VCZWZvcmVGdW5jdGlvbigpIHtcclxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxCZWZvcmVGdW5jdGlvbikge1xyXG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pKTtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuYmVmb3JlU3luYykge1xyXG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGludm9rZUFmdGVyRnVuY3Rpb24oKSB7XHJcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikge1xyXG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikpO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMpIHtcclxuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIHByb2dyZXNzKSB7XHJcbiAgICBhd2FpdCB0aGlzLnJlY3JlYXRlRm9ybVRhYmxlcyhmb3JtLCBhY2NvdW50KTtcclxuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XHJcblxyXG4gICAgbGV0IGluZGV4ID0gMDtcclxuXHJcbiAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XHJcbiAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcclxuXHJcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcclxuICAgICAgICBwcm9ncmVzcyhpbmRleCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgdHJ1ZSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBwcm9ncmVzcyhpbmRleCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBjbGVhbnVwRnJpZW5kbHlWaWV3cyhhY2NvdW50KSB7XHJcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFZpZXdMaXN0KCk7XHJcblxyXG4gICAgY29uc3QgYWN0aXZlVmlld05hbWVzID0gW107XHJcblxyXG4gICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XHJcbiAgICAgIGFjdGl2ZVZpZXdOYW1lcy5wdXNoKHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgbnVsbCkpO1xyXG5cclxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xyXG4gICAgICAgIGFjdGl2ZVZpZXdOYW1lcy5wdXNoKHRoaXMuZ2V0RnJpZW5kbHlUYWJsZU5hbWUoZm9ybSwgcmVwZWF0YWJsZSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVtb3ZlID0gZGlmZmVyZW5jZSh0aGlzLnZpZXdOYW1lcywgYWN0aXZlVmlld05hbWVzKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHZpZXdOYW1lIG9mIHJlbW92ZSkge1xyXG4gICAgICBpZiAodmlld05hbWUuaW5kZXhPZigndmlld18nKSA9PT0gMCB8fCB2aWV3TmFtZS5pbmRleE9mKCd2aWV3IC0gJykgPT09IDApIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdJRiAgKEVYSVNUUyAoU0VMRUNUICogRlJPTSBzeXMudmlld3MgV0hFUkUgb2JqZWN0X2lkID0gT0JKRUNUX0lEKE5cXCdbJXNdLlslc11cXCcpKSkgRFJPUCBWSUVXIFslc10uWyVzXTsnLFxyXG4gICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcclxuICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSkpKTtcclxuICAgICAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpIHtcclxuICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xyXG4gICAgaWYgKGZvcm0gPT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpZDogZm9ybS5faWQsXHJcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcclxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcclxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHVwZGF0ZVN0YXR1cyA9IChtZXNzYWdlKSA9PiB7XHJcbiAgICBpZiAocHJvY2Vzcy5zdGRvdXQuaXNUVFkpIHtcclxuICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XHJcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xyXG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShtZXNzYWdlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGRyb3BTeXN0ZW1UYWJsZXMoKSB7XHJcbiAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodGVtcGxhdGVEcm9wKSk7XHJcbiAgfVxyXG5cclxuICBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcclxuICAgIHJldHVybiB0aGlzLnJ1bihgQ1JFQVRFIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfTtgKTtcclxuICB9XHJcblxyXG4gIGRyb3BEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcclxuICAgIHJldHVybiB0aGlzLnJ1bihgRFJPUCBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBzZXR1cERhdGFiYXNlKCkge1xyXG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHZlcnNpb24wMDEpKTtcclxuICB9XHJcblxyXG4gIHByZXBhcmVNaWdyYXRpb25TY3JpcHQoc3FsKSB7XHJcbiAgICByZXR1cm4gc3FsLnJlcGxhY2UoL19fU0NIRU1BX18vZywgdGhpcy5kYXRhU2NoZW1hKVxyXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9fX1ZJRVdfU0NIRU1BX18vZywgdGhpcy52aWV3U2NoZW1hKS5zcGxpdCgnOycpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCkge1xyXG4gICAgY29uc3QgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcclxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMobmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQpO1xyXG4gICAgfTtcclxuXHJcbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUGhvdG8oe30sIGFzeW5jIChwaG90bywge2luZGV4fSkgPT4ge1xyXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XHJcbiAgICAgICAgcHJvZ3Jlc3MoJ1Bob3RvcycsIGluZGV4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVQaG90byhwaG90bywgYWNjb3VudCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoVmlkZW8oe30sIGFzeW5jICh2aWRlbywge2luZGV4fSkgPT4ge1xyXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XHJcbiAgICAgICAgcHJvZ3Jlc3MoJ1ZpZGVvcycsIGluZGV4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQXVkaW8oe30sIGFzeW5jIChhdWRpbywge2luZGV4fSkgPT4ge1xyXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XHJcbiAgICAgICAgcHJvZ3Jlc3MoJ0F1ZGlvJywgaW5kZXgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUF1ZGlvKGF1ZGlvLCBhY2NvdW50KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDaGFuZ2VzZXQoe30sIGFzeW5jIChjaGFuZ2VzZXQsIHtpbmRleH0pID0+IHtcclxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xyXG4gICAgICAgIHByb2dyZXNzKCdDaGFuZ2VzZXRzJywgaW5kZXgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNoYW5nZXNldChjaGFuZ2VzZXQsIGFjY291bnQpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFJvbGUoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcclxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xyXG4gICAgICAgIHByb2dyZXNzKCdSb2xlcycsIGluZGV4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUHJvamVjdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xyXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XHJcbiAgICAgICAgcHJvZ3Jlc3MoJ1Byb2plY3RzJywgaW5kZXgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3Qob2JqZWN0LCBhY2NvdW50KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hGb3JtKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XHJcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcclxuICAgICAgICBwcm9ncmVzcygnRm9ybXMnLCBpbmRleCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaE1lbWJlcnNoaXAoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcclxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xyXG4gICAgICAgIHByb2dyZXNzKCdNZW1iZXJzaGlwcycsIGluZGV4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hvaWNlTGlzdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xyXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XHJcbiAgICAgICAgcHJvZ3Jlc3MoJ0Nob2ljZSBMaXN0cycsIGluZGV4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KG9iamVjdCwgYWNjb3VudCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQoe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcclxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xyXG4gICAgICAgIHByb2dyZXNzKCdDbGFzc2lmaWNhdGlvbiBTZXRzJywgaW5kZXgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCwgYWNjb3VudCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGFzeW5jIG1heWJlSW5pdGlhbGl6ZSgpIHtcclxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcclxuXHJcbiAgICBpZiAodGhpcy50YWJsZU5hbWVzLmluZGV4T2YoJ21pZ3JhdGlvbnMnKSA9PT0gLTEpIHtcclxuICAgICAgY29uc29sZS5sb2coJ0luaXRpdGFsaXppbmcgZGF0YWJhc2UuLi4nKTtcclxuXHJcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHRoaXMubWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbWF5YmVSdW5NaWdyYXRpb25zKGFjY291bnQpIHtcclxuICAgIHRoaXMubWlncmF0aW9ucyA9IChhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIG5hbWUgRlJPTSAkeyB0aGlzLmRhdGFTY2hlbWEgfS5taWdyYXRpb25zYCkpLm1hcChvID0+IG8ubmFtZSk7XHJcblxyXG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbignMDAyJywgYWNjb3VudCk7XHJcbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9uKCcwMDMnLCBhY2NvdW50KTtcclxuICAgIGF3YWl0IHRoaXMubWF5YmVSdW5NaWdyYXRpb24oJzAwNCcsIGFjY291bnQpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbWF5YmVSdW5NaWdyYXRpb24odmVyc2lvbiwgYWNjb3VudCkge1xyXG4gICAgaWYgKHRoaXMubWlncmF0aW9ucy5pbmRleE9mKHZlcnNpb24pID09PSAtMSAmJiBNSUdSQVRJT05TW3ZlcnNpb25dKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdChNSUdSQVRJT05TW3ZlcnNpb25dKSk7XHJcblxyXG4gICAgICBpZiAodmVyc2lvbiA9PT0gJzAwMicpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnUG9wdWxhdGluZyBzeXN0ZW0gdGFibGVzLi4uJyk7XHJcblxyXG4gICAgICAgIC8vIGF3YWl0IHRoaXMuc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZVJlY29yZHMoYWNjb3VudCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHBvcHVsYXRlUmVjb3JkcyhhY2NvdW50KSB7XHJcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcclxuXHJcbiAgICBsZXQgaW5kZXggPSAwO1xyXG5cclxuICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xyXG4gICAgICBpbmRleCA9IDA7XHJcblxyXG4gICAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XHJcbiAgICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xyXG5cclxuICAgICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XHJcbiAgICAgICAgICB0aGlzLnByb2dyZXNzKGZvcm0ubmFtZSwgaW5kZXgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCBmYWxzZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJvZ3Jlc3MgPSAobmFtZSwgaW5kZXgpID0+IHtcclxuICAgIHRoaXMudXBkYXRlU3RhdHVzKG5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkKTtcclxuICB9XHJcbn1cclxuIl19