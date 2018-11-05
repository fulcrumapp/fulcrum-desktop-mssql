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

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const MAX_IDENTIFIER_LENGTH = 63;

const MSSQL_CONFIG = {
  database: 'fulcrumapp',
  server: 'localhost',
  port: 1433,
  max: 10,
  idleTimeoutMillis: 30000
};

const MIGRATIONS = {
  '002': _version4.default,
  '003': _version6.default
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
        yield _this16.run((0, _util.format)('DROP VIEW IF EXISTS %s.%s;', _this16.escapeIdentifier(_this16.viewSchema), _this16.escapeIdentifier(viewName)));
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

    return this.trimIdentifier(fulcrum.args.mssqlUnderscoreNames ? (0, _snakeCase2.default)(objectName) : objectName);
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
            yield _this21.run((0, _util.format)('DROP VIEW IF EXISTS %s.%s;', _this21.escapeIdentifier(_this21.viewSchema), _this21.escapeIdentifier(viewName)));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJERUZBVUxUX1NDSEVNQSIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImZ1bGNydW0iLCJhcmdzIiwibXNzcWxDcmVhdGVEYXRhYmFzZSIsImNyZWF0ZURhdGFiYXNlIiwibXNzcWxEcm9wRGF0YWJhc2UiLCJkcm9wRGF0YWJhc2UiLCJtc3NxbERyb3AiLCJkcm9wU3lzdGVtVGFibGVzIiwibXNzcWxTZXR1cCIsInNldHVwRGF0YWJhc2UiLCJhY2NvdW50IiwiZmV0Y2hBY2NvdW50Iiwib3JnIiwibXNzcWxTeXN0ZW1UYWJsZXNPbmx5Iiwic2V0dXBTeXN0ZW1UYWJsZXMiLCJpbnZva2VCZWZvcmVGdW5jdGlvbiIsImZvcm1zIiwiZmluZEFjdGl2ZUZvcm1zIiwiZm9ybSIsIm1zc3FsRm9ybSIsImlkIiwibXNzcWxSZWJ1aWxkVmlld3NPbmx5IiwicmVidWlsZEZyaWVuZGx5Vmlld3MiLCJyZWJ1aWxkRm9ybSIsImluZGV4IiwidXBkYXRlU3RhdHVzIiwibmFtZSIsImdyZWVuIiwidG9TdHJpbmciLCJyZWQiLCJjb25zb2xlIiwibG9nIiwiaW52b2tlQWZ0ZXJGdW5jdGlvbiIsImVycm9yIiwicnVuIiwic3FsIiwicmVwbGFjZSIsImRlYnVnIiwicmVzdWx0IiwicG9vbCIsInJlcXVlc3QiLCJiYXRjaCIsInJlY29yZHNldCIsInJ1bkFsbCIsInN0YXRlbWVudHMiLCJyZXN1bHRzIiwicHVzaCIsInRhYmxlTmFtZSIsInJvd0lEIiwib25TeW5jU3RhcnQiLCJ0YXNrcyIsIm9uU3luY0ZpbmlzaCIsImNsZWFudXBGcmllbmRseVZpZXdzIiwib25Gb3JtU2F2ZSIsIm9sZEZvcm0iLCJuZXdGb3JtIiwidXBkYXRlRm9ybSIsIm9uRm9ybURlbGV0ZSIsIl9pZCIsInJvd19pZCIsIl9uYW1lIiwiZWxlbWVudHMiLCJfZWxlbWVudHNKU09OIiwib25SZWNvcmRTYXZlIiwicmVjb3JkIiwidXBkYXRlUmVjb3JkIiwib25SZWNvcmREZWxldGUiLCJkZWxldGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwibXNzcWwiLCJyZWNvcmRWYWx1ZU9wdGlvbnMiLCJtYXAiLCJvIiwiam9pbiIsIm9uUGhvdG9TYXZlIiwicGhvdG8iLCJ1cGRhdGVQaG90byIsIm9uVmlkZW9TYXZlIiwidmlkZW8iLCJ1cGRhdGVWaWRlbyIsIm9uQXVkaW9TYXZlIiwiYXVkaW8iLCJ1cGRhdGVBdWRpbyIsIm9uQ2hhbmdlc2V0U2F2ZSIsImNoYW5nZXNldCIsInVwZGF0ZUNoYW5nZXNldCIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJjaG9pY2VMaXN0IiwidXBkYXRlQ2hvaWNlTGlzdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwiY2xhc3NpZmljYXRpb25TZXQiLCJ1cGRhdGVDbGFzc2lmaWNhdGlvblNldCIsIm9uUHJvamVjdFNhdmUiLCJwcm9qZWN0IiwidXBkYXRlUHJvamVjdCIsIm9uUm9sZVNhdmUiLCJyb2xlIiwidXBkYXRlUm9sZSIsIm9uTWVtYmVyc2hpcFNhdmUiLCJtZW1iZXJzaGlwIiwidXBkYXRlTWVtYmVyc2hpcCIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJkYXRhU2NoZW1hIiwidGFibGVOYW1lcyIsInJlbG9hZFZpZXdMaXN0Iiwidmlld1NjaGVtYSIsInZpZXdOYW1lcyIsImJhc2VNZWRpYVVSTCIsImZvcm1hdFBob3RvVVJMIiwiZm9ybWF0VmlkZW9VUkwiLCJmb3JtYXRBdWRpb1VSTCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwibXNzcWxDdXN0b21Nb2R1bGUiLCJzaG91bGRVcGRhdGVSZWNvcmQiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwic3lzdGVtVmFsdWVzIiwic3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZSIsInVwZGF0ZU9iamVjdCIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJzaG91bGRVcGRhdGVGb3JtIiwidXBkYXRlRm9ybU9iamVjdCIsImdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyIsImRpc2FibGVBcnJheXMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaW50ZWdyaXR5V2FybmluZyIsIm1lc3NhZ2UiLCJwcm9jZXNzIiwic3Rkb3V0IiwiaXNUVFkiLCJjbGVhckxpbmUiLCJjdXJzb3JUbyIsIndyaXRlIiwicHJvZ3Jlc3MiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNzcWxDb25uZWN0aW9uU3RyaW5nIiwidHlwZSIsIm1zc3FsRGF0YWJhc2UiLCJkZWZhdWx0IiwibXNzcWxIb3N0IiwiaG9zdCIsIm1zc3FsUG9ydCIsIm1zc3FsVXNlciIsIm1zc3FsUGFzc3dvcmQiLCJtc3NxbFNjaGVtYSIsIm1zc3FsU2NoZW1hVmlld3MiLCJtc3NxbFN5bmNFdmVudHMiLCJtc3NxbEJlZm9yZUZ1bmN0aW9uIiwibXNzcWxBZnRlckZ1bmN0aW9uIiwicmVxdWlyZWQiLCJtc3NxbFJlcG9ydEJhc2VVcmwiLCJtc3NxbE1lZGlhQmFzZVVybCIsIm1zc3FsVW5kZXJzY29yZU5hbWVzIiwiaGFuZGxlciIsInRyaW1JZGVudGlmaWVyIiwiaWRlbnRpZmllciIsInN1YnN0cmluZyIsImVzY2FwZUlkZW50aWZpZXIiLCJpZGVudCIsInVzZVN5bmNFdmVudHMiLCJvcHRpb25zIiwidXNlciIsInBhc3N3b3JkIiwicmVxdWlyZSIsImFwcCIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJjb25uZWN0Iiwib24iLCJzZXR1cE9wdGlvbnMiLCJtYXliZUluaXRpYWxpemUiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJvYmplY3QiLCJ2YWx1ZXMiLCJmaWxlIiwiYWNjZXNzX2tleSIsInRhYmxlIiwiZGVsZXRlU3RhdGVtZW50Iiwicm93X3Jlc291cmNlX2lkIiwiaW5zZXJ0U3RhdGVtZW50IiwicGsiLCJ3YXJuIiwic3RhY2siLCJzY2hlbWEiLCJ2YWx1ZXNUcmFuc2Zvcm1lciIsIm1lZGlhVVJMRm9ybWF0dGVyIiwibWVkaWFWYWx1ZSIsIml0ZW1zIiwiaXRlbSIsImVsZW1lbnQiLCJpc1Bob3RvRWxlbWVudCIsIm1lZGlhSUQiLCJpc1ZpZGVvRWxlbWVudCIsImlzQXVkaW9FbGVtZW50IiwibWVkaWFWaWV3VVJMRm9ybWF0dGVyIiwiaWRzIiwicmVwb3J0VVJMRm9ybWF0dGVyIiwiZmVhdHVyZSIsInZpZXdOYW1lIiwiZ2V0RnJpZW5kbHlUYWJsZU5hbWUiLCJkYXRhTmFtZSIsInByZWZpeCIsImtleSIsIm9iamVjdE5hbWUiLCJiZWZvcmVTeW5jIiwiYWZ0ZXJTeW5jIiwiZmluZEVhY2hSZWNvcmQiLCJhY3RpdmVWaWV3TmFtZXMiLCJyZW1vdmUiLCJwcmVwYXJlTWlncmF0aW9uU2NyaXB0IiwiZGF0YWJhc2VOYW1lIiwic3BsaXQiLCJmaW5kRWFjaFBob3RvIiwiZmluZEVhY2hWaWRlbyIsImZpbmRFYWNoQXVkaW8iLCJmaW5kRWFjaENoYW5nZXNldCIsImZpbmRFYWNoUm9sZSIsImZpbmRFYWNoUHJvamVjdCIsImZpbmRFYWNoRm9ybSIsImZpbmRFYWNoTWVtYmVyc2hpcCIsImZpbmRFYWNoQ2hvaWNlTGlzdCIsImZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQiLCJtYXliZVJ1bk1pZ3JhdGlvbnMiLCJtaWdyYXRpb25zIiwibWF5YmVSdW5NaWdyYXRpb24iLCJ2ZXJzaW9uIiwicG9wdWxhdGVSZWNvcmRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBOzs7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7SUFLWUEsRzs7QUFKWjs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUVBOztBQUVBOzs7O0FBQ0E7Ozs7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QW5CLEVBQTBCO0FBQ3hCUSxnQkFBUSxDQUFSOztBQUVBLGNBQU1OLEtBQUt1TSxjQUFMLENBQW9CLEVBQXBCO0FBQUEseUNBQXdCLFdBQU96SixNQUFQLEVBQWtCO0FBQzlDQSxtQkFBTzlDLElBQVAsR0FBY0EsSUFBZDs7QUFFQSxnQkFBSSxFQUFFTSxLQUFGLEdBQVUsRUFBVixLQUFpQixDQUFyQixFQUF3QjtBQUN0QixzQkFBS29ILFFBQUwsQ0FBYzFILEtBQUtRLElBQW5CLEVBQXlCRixLQUF6QjtBQUNEOztBQUVELGtCQUFNLFFBQUt5QyxZQUFMLENBQWtCRCxNQUFsQixFQUEwQnRELE9BQTFCLEVBQW1DLEtBQW5DLENBQU47QUFDRCxXQVJLOztBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQU47QUFTRDtBQWpCNEI7QUFrQjlCOztBQXI0QmtCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1zc3FsIGZyb20gJ21zc3FsJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IE1TU1FMIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgTVNTUUxSZWNvcmRWYWx1ZXMgZnJvbSAnLi9tc3NxbC1yZWNvcmQtdmFsdWVzJ1xuaW1wb3J0IHNuYWtlIGZyb20gJ3NuYWtlLWNhc2UnO1xuaW1wb3J0IHRlbXBsYXRlRHJvcCBmcm9tICcuL3RlbXBsYXRlLmRyb3Auc3FsJztcbmltcG9ydCBTY2hlbWFNYXAgZnJvbSAnLi9zY2hlbWEtbWFwJztcbmltcG9ydCAqIGFzIGFwaSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCB7IGNvbXBhY3QsIGRpZmZlcmVuY2UgfSBmcm9tICdsb2Rhc2gnO1xuXG5pbXBvcnQgdmVyc2lvbjAwMSBmcm9tICcuL3ZlcnNpb24tMDAxLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMiBmcm9tICcuL3ZlcnNpb24tMDAyLnNxbCc7XG5pbXBvcnQgdmVyc2lvbjAwMyBmcm9tICcuL3ZlcnNpb24tMDAzLnNxbCc7XG5cbmNvbnN0IE1BWF9JREVOVElGSUVSX0xFTkdUSCA9IDYzO1xuXG5jb25zdCBNU1NRTF9DT05GSUcgPSB7XG4gIGRhdGFiYXNlOiAnZnVsY3J1bWFwcCcsXG4gIHNlcnZlcjogJ2xvY2FsaG9zdCcsXG4gIHBvcnQ6IDE0MzMsXG4gIG1heDogMTAsXG4gIGlkbGVUaW1lb3V0TWlsbGlzOiAzMDAwMFxufTtcblxuY29uc3QgTUlHUkFUSU9OUyA9IHtcbiAgJzAwMic6IHZlcnNpb24wMDIsXG4gICcwMDMnOiB2ZXJzaW9uMDAzXG59O1xuXG5jb25zdCBERUZBVUxUX1NDSEVNQSA9ICdkYm8nO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXG4gICAgICBkZXNjOiAncnVuIHRoZSBtc3NxbCBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG1zc3FsQ29ubmVjdGlvblN0cmluZzoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBjb25uZWN0aW9uIHN0cmluZyAob3ZlcnJpZGVzIGFsbCBpbmRpdmlkdWFsIGRhdGFiYXNlIGNvbm5lY3Rpb24gcGFyYW1ldGVycyknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsRGF0YWJhc2U6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgZGF0YWJhc2UgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmRhdGFiYXNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsSG9zdDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgaG9zdCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxQb3J0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcbiAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLnBvcnRcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxVc2VyOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHVzZXInLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUGFzc3dvcmQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsU2NoZW1hOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTY2hlbWFWaWV3czoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEgZm9yIHRoZSBmcmllbmRseSB2aWV3cycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTeW5jRXZlbnRzOiB7XG4gICAgICAgICAgZGVzYzogJ2FkZCBzeW5jIGV2ZW50IGhvb2tzJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBtc3NxbEJlZm9yZUZ1bmN0aW9uOiB7XG4gICAgICAgICAgZGVzYzogJ2NhbGwgdGhpcyBmdW5jdGlvbiBiZWZvcmUgdGhlIHN5bmMnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQWZ0ZXJGdW5jdGlvbjoge1xuICAgICAgICAgIGRlc2M6ICdjYWxsIHRoaXMgZnVuY3Rpb24gYWZ0ZXIgdGhlIHN5bmMnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxGb3JtOiB7XG4gICAgICAgICAgZGVzYzogJ3RoZSBmb3JtIElEIHRvIHJlYnVpbGQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUmVwb3J0QmFzZVVybDoge1xuICAgICAgICAgIGRlc2M6ICdyZXBvcnQgVVJMIGJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsTWVkaWFCYXNlVXJsOiB7XG4gICAgICAgICAgZGVzYzogJ21lZGlhIFVSTCBiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NxbFVuZGVyc2NvcmVOYW1lczoge1xuICAgICAgICAgIGRlc2M6ICd1c2UgdW5kZXJzY29yZSBuYW1lcyAoZS5nLiBcIlBhcmsgSW5zcGVjdGlvbnNcIiBiZWNvbWVzIFwicGFya19pbnNwZWN0aW9uc1wiKScsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsUmVidWlsZFZpZXdzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IHJlYnVpbGQgdGhlIHZpZXdzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zc3FsQ3VzdG9tTW9kdWxlOiB7XG4gICAgICAgICAgZGVzYzogJ2EgY3VzdG9tIG1vZHVsZSB0byBsb2FkIHdpdGggc3luYyBleHRlbnNpb25zIChleHBlcmltZW50YWwpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTZXR1cDoge1xuICAgICAgICAgIGRlc2M6ICdzZXR1cCB0aGUgZGF0YWJhc2UnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbidcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxEcm9wOiB7XG4gICAgICAgICAgZGVzYzogJ2Ryb3AgdGhlIHN5c3RlbSB0YWJsZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNzcWxTeXN0ZW1UYWJsZXNPbmx5OiB7XG4gICAgICAgICAgZGVzYzogJ29ubHkgY3JlYXRlIHRoZSBzeXN0ZW0gcmVjb3JkcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxDcmVhdGVEYXRhYmFzZSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNzcWxDcmVhdGVEYXRhYmFzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbERyb3BEYXRhYmFzZSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcERhdGFiYXNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsRHJvcCkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wU3lzdGVtVGFibGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFNldHVwKSB7XG4gICAgICBhd2FpdCB0aGlzLnNldHVwRGF0YWJhc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFN5c3RlbVRhYmxlc09ubHkpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5zZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLmludm9rZUJlZm9yZUZ1bmN0aW9uKCk7XG5cbiAgICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEZvcm0gJiYgZm9ybS5pZCAhPT0gZnVsY3J1bS5hcmdzLm1zc3FsRm9ybSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbFJlYnVpbGRWaWV3c09ubHkpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKGluZGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhmb3JtLm5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkICsgJyByZWNvcmRzJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQWZ0ZXJGdW5jdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgdHJpbUlkZW50aWZpZXIoaWRlbnRpZmllcikge1xuICAgIHJldHVybiBpZGVudGlmaWVyLnN1YnN0cmluZygwLCBNQVhfSURFTlRJRklFUl9MRU5HVEgpO1xuICB9XG5cbiAgZXNjYXBlSWRlbnRpZmllcihpZGVudGlmaWVyKSB7XG4gICAgcmV0dXJuIGlkZW50aWZpZXIgJiYgdGhpcy5tc3NxbC5pZGVudCh0aGlzLnRyaW1JZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcbiAgfVxuXG4gIGdldCB1c2VTeW5jRXZlbnRzKCkge1xuICAgIHJldHVybiBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzICE9IG51bGwgPyBmdWxjcnVtLmFyZ3MubXNzcWxTeW5jRXZlbnRzIDogdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAuLi5NU1NRTF9DT05GSUcsXG4gICAgICBzZXJ2ZXI6IGZ1bGNydW0uYXJncy5tc3NxbEhvc3QgfHwgTVNTUUxfQ09ORklHLnNlcnZlcixcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc3NxbFBvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zc3FsRGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zc3FsVXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZCB8fCBNU1NRTF9DT05GSUcudXNlclxuICAgIH07XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsVXNlcikge1xuICAgICAgb3B0aW9ucy51c2VyID0gZnVsY3J1bS5hcmdzLm1zc3FsVXNlcjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUGFzc3dvcmQpIHtcbiAgICAgIG9wdGlvbnMucGFzc3dvcmQgPSBmdWxjcnVtLmFyZ3MubXNzcWxQYXNzd29yZDtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsQ3VzdG9tTW9kdWxlKSB7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlID0gcmVxdWlyZShmdWxjcnVtLmFyZ3MubXNzcWxDdXN0b21Nb2R1bGUpO1xuICAgICAgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hcGkgPSBhcGk7XG4gICAgICB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFwcCA9IGZ1bGNydW07XG4gICAgfVxuXG4gICAgdGhpcy5kaXNhYmxlQXJyYXlzID0gZmFsc2U7XG4gICAgdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzID0gdHJ1ZTtcblxuICAgIHRoaXMucG9vbCA9IGF3YWl0IG1zc3FsLmNvbm5lY3QoZnVsY3J1bS5hcmdzLm1zc3FsQ29ubmVjdGlvblN0cmluZyB8fCBvcHRpb25zKTtcblxuICAgIGlmICh0aGlzLnVzZVN5bmNFdmVudHMpIHtcbiAgICAgIGZ1bGNydW0ub24oJ3N5bmM6c3RhcnQnLCB0aGlzLm9uU3luY1N0YXJ0KTtcbiAgICAgIGZ1bGNydW0ub24oJ3N5bmM6ZmluaXNoJywgdGhpcy5vblN5bmNGaW5pc2gpO1xuICAgICAgZnVsY3J1bS5vbigncGhvdG86c2F2ZScsIHRoaXMub25QaG90b1NhdmUpO1xuICAgICAgZnVsY3J1bS5vbigndmlkZW86c2F2ZScsIHRoaXMub25WaWRlb1NhdmUpO1xuICAgICAgZnVsY3J1bS5vbignYXVkaW86c2F2ZScsIHRoaXMub25BdWRpb1NhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2hhbmdlc2V0OnNhdmUnLCB0aGlzLm9uQ2hhbmdlc2V0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcblxuICAgICAgZnVsY3J1bS5vbignY2hvaWNlLWxpc3Q6c2F2ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpkZWxldGUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdmb3JtOnNhdmUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignZm9ybTpkZWxldGUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbi1zZXQ6c2F2ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb24tc2V0OmRlbGV0ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdyb2xlOnNhdmUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncm9sZTpkZWxldGUnLCB0aGlzLm9uUm9sZVNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdwcm9qZWN0OnNhdmUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncHJvamVjdDpkZWxldGUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdtZW1iZXJzaGlwOnNhdmUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbignbWVtYmVyc2hpcDpkZWxldGUnLCB0aGlzLm9uTWVtYmVyc2hpcFNhdmUpO1xuICAgIH1cblxuICAgIHRoaXMudmlld1NjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYVZpZXdzIHx8IERFRkFVTFRfU0NIRU1BO1xuICAgIHRoaXMuZGF0YVNjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NxbFNjaGVtYSB8fCBERUZBVUxUX1NDSEVNQTtcblxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcbiAgICAvLyBjcmVhdGlvbiBvZiBuZXcgdGFibGVzIGV2ZW4gd2hlbiB0aGUgZm9ybSBpc24ndCB2ZXJzaW9uIDEuIElmIHRoZSB0YWJsZSBkb2Vzbid0XG4gICAgLy8gZXhpc3QsIHdlIGNhbiBwcmV0ZW5kIHRoZSBmb3JtIGlzIHZlcnNpb24gMSBzbyBpdCBjcmVhdGVzIGFsbCBuZXcgdGFibGVzIGluc3RlYWRcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIC8vIG1ha2UgYSBjbGllbnQgc28gd2UgY2FuIHVzZSBpdCB0byBidWlsZCBTUUwgc3RhdGVtZW50c1xuICAgIHRoaXMubXNzcWwgPSBuZXcgTVNTUUwoe30pO1xuXG4gICAgdGhpcy5zZXR1cE9wdGlvbnMoKTtcblxuICAgIGF3YWl0IHRoaXMubWF5YmVJbml0aWFsaXplKCk7XG4gIH1cblxuICBhc3luYyBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLnBvb2wpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJ1biA9IGFzeW5jIChzcWwpID0+IHtcbiAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFwwL2csICcnKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgIGNvbnNvbGUubG9nKHNxbCk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wb29sLnJlcXVlc3QoKS5iYXRjaChzcWwpO1xuXG4gICAgcmV0dXJuIHJlc3VsdC5yZWNvcmRzZXQ7XG4gIH1cblxuICBydW5BbGwgPSBhc3luYyAoc3RhdGVtZW50cykgPT4ge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgIGZvciAoY29uc3Qgc3FsIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIHJlc3VsdHMucHVzaChhd2FpdCB0aGlzLnJ1bihzcWwpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIGxvZyA9ICguLi5hcmdzKSA9PiB7XG4gICAgLy8gY29uc29sZS5sb2coLi4uYXJncyk7XG4gIH1cblxuICB0YWJsZU5hbWUgPSAoYWNjb3VudCwgbmFtZSkgPT4ge1xuICAgIHJldHVybiAnYWNjb3VudF8nICsgYWNjb3VudC5yb3dJRCArICdfJyArIG5hbWU7XG4gIH1cblxuICBvblN5bmNTdGFydCA9IGFzeW5jICh7YWNjb3VudCwgdGFza3N9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VCZWZvcmVGdW5jdGlvbigpO1xuICB9XG5cbiAgb25TeW5jRmluaXNoID0gYXN5bmMgKHthY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMuY2xlYW51cEZyaWVuZGx5Vmlld3MoYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gIH1cblxuICBvbkZvcm1TYXZlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcbiAgfVxuXG4gIG9uRm9ybURlbGV0ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudH0pID0+IHtcbiAgICBjb25zdCBvbGRGb3JtID0ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG51bGwpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuICB9XG5cbiAgb25QaG90b1NhdmUgPSBhc3luYyAoe3Bob3RvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICB9XG5cbiAgb25WaWRlb1NhdmUgPSBhc3luYyAoe3ZpZGVvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVmlkZW8odmlkZW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25BdWRpb1NhdmUgPSBhc3luYyAoe2F1ZGlvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25DaGFuZ2VzZXRTYXZlID0gYXN5bmMgKHtjaGFuZ2VzZXQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe2Nob2ljZUxpc3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KGNob2ljZUxpc3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25DbGFzc2lmaWNhdGlvblNldFNhdmUgPSBhc3luYyAoe2NsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQoY2xhc3NpZmljYXRpb25TZXQsIGFjY291bnQpO1xuICB9XG5cbiAgb25Qcm9qZWN0U2F2ZSA9IGFzeW5jICh7cHJvamVjdCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3QocHJvamVjdCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJvbGVTYXZlID0gYXN5bmMgKHtyb2xlLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShyb2xlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uTWVtYmVyc2hpcFNhdmUgPSBhc3luYyAoe21lbWJlcnNoaXAsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG1lbWJlcnNoaXAsIGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUGhvdG8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnBob3RvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0UGhvdG9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAncGhvdG9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVWaWRlbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAudmlkZW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRWaWRlb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICd2aWRlb3MnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUF1ZGlvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5hdWRpbyhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdEF1ZGlvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ2F1ZGlvJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaGFuZ2VzZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNoYW5nZXNldChvYmplY3QpLCAnY2hhbmdlc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucHJvamVjdChvYmplY3QpLCAncHJvamVjdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU1lbWJlcnNoaXAob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLm1lbWJlcnNoaXAob2JqZWN0KSwgJ21lbWJlcnNoaXBzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yb2xlKG9iamVjdCksICdyb2xlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuZm9ybShvYmplY3QpLCAnZm9ybXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNob2ljZUxpc3Qob2JqZWN0KSwgJ2Nob2ljZV9saXN0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCksICdjbGFzc2lmaWNhdGlvbl9zZXRzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVPYmplY3QodmFsdWVzLCB0YWJsZSkge1xuICAgIGNvbnN0IGRlbGV0ZVN0YXRlbWVudCA9IHRoaXMubXNzcWwuZGVsZXRlU3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB7cm93X3Jlc291cmNlX2lkOiB2YWx1ZXMucm93X3Jlc291cmNlX2lkfSk7XG4gICAgY29uc3QgaW5zZXJ0U3RhdGVtZW50ID0gdGhpcy5tc3NxbC5pbnNlcnRTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHZhbHVlcywge3BrOiAnaWQnfSk7XG5cbiAgICBjb25zdCBzcWwgPSBbIGRlbGV0ZVN0YXRlbWVudC5zcWwsIGluc2VydFN0YXRlbWVudC5zcWwgXS5qb2luKCdcXG4nKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihzcWwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgcmVsb2FkVGFibGVMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIHJlbG9hZFZpZXdMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLnZpZXdTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudmlld05hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgYmFzZU1lZGlhVVJMID0gKCkgPT4ge1xuICB9XG5cbiAgZm9ybWF0UGhvdG9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zLyR7IGlkIH0uanBnYDtcbiAgfVxuXG4gIGZvcm1hdFZpZGVvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3ZpZGVvcy8keyBpZCB9Lm1wNGA7XG4gIH1cblxuICBmb3JtYXRBdWRpb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9hdWRpby8keyBpZCB9Lm00YWA7XG4gIH1cblxuICBpbnRlZ3JpdHlXYXJuaW5nKGV4KSB7XG4gICAgY29uc29sZS53YXJuKGBcbi0tLS0tLS0tLS0tLS1cbiEhIFdBUk5JTkcgISFcbi0tLS0tLS0tLS0tLS1cblxuTVNTUUwgZGF0YWJhc2UgaW50ZWdyaXR5IGlzc3VlIGVuY291bnRlcmVkLiBDb21tb24gc291cmNlcyBvZiBkYXRhYmFzZSBpc3N1ZXMgYXJlOlxuXG4qIFJlaW5zdGFsbGluZyBGdWxjcnVtIERlc2t0b3AgYW5kIHVzaW5nIGFuIG9sZCBNU1NRTCBkYXRhYmFzZSB3aXRob3V0IHJlY3JlYXRpbmdcbiAgdGhlIE1TU1FMIGRhdGFiYXNlLlxuKiBEZWxldGluZyB0aGUgaW50ZXJuYWwgYXBwbGljYXRpb24gZGF0YWJhc2UgYW5kIHVzaW5nIGFuIGV4aXN0aW5nIE1TU1FMIGRhdGFiYXNlXG4qIE1hbnVhbGx5IG1vZGlmeWluZyB0aGUgTVNTUUwgZGF0YWJhc2VcbiogQ3JlYXRpbmcgbXVsdGlwbGUgYXBwcyBpbiBGdWxjcnVtIHdpdGggdGhlIHNhbWUgbmFtZS4gVGhpcyBpcyBnZW5lcmFsbHkgT0ssIGV4Y2VwdFxuICB5b3Ugd2lsbCBub3QgYmUgYWJsZSB0byB1c2UgdGhlIFwiZnJpZW5kbHkgdmlld1wiIGZlYXR1cmUgb2YgdGhlIE1TU1FMIHBsdWdpbiBzaW5jZVxuICB0aGUgdmlldyBuYW1lcyBhcmUgZGVyaXZlZCBmcm9tIHRoZSBmb3JtIG5hbWVzLlxuXG5Ob3RlOiBXaGVuIHJlaW5zdGFsbGluZyBGdWxjcnVtIERlc2t0b3Agb3IgXCJzdGFydGluZyBvdmVyXCIgeW91IG5lZWQgdG8gZHJvcCBhbmQgcmUtY3JlYXRlXG50aGUgTVNTUUwgZGF0YWJhc2UuIFRoZSBuYW1lcyBvZiBkYXRhYmFzZSBvYmplY3RzIGFyZSB0aWVkIGRpcmVjdGx5IHRvIHRoZSBkYXRhYmFzZVxub2JqZWN0cyBpbiB0aGUgaW50ZXJuYWwgYXBwbGljYXRpb24gZGF0YWJhc2UuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuUmVwb3J0IGlzc3VlcyBhdCBodHRwczovL2dpdGh1Yi5jb20vZnVsY3J1bWFwcC9mdWxjcnVtLWRlc2t0b3AvaXNzdWVzXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbk1lc3NhZ2U6XG4keyBleC5tZXNzYWdlIH1cblxuU3RhY2s6XG4keyBleC5zdGFjayB9XG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmAucmVkXG4gICAgKTtcbiAgfVxuXG4gIHNldHVwT3B0aW9ucygpIHtcbiAgICB0aGlzLmJhc2VNZWRpYVVSTCA9IGZ1bGNydW0uYXJncy5tc3NxbE1lZGlhQmFzZVVybCA/IGZ1bGNydW0uYXJncy5tc3NxbE1lZGlhQmFzZVVybCA6ICdodHRwczovL2FwaS5mdWxjcnVtYXBwLmNvbS9hcGkvdjInO1xuXG4gICAgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMgPSB7XG4gICAgICBzY2hlbWE6IHRoaXMuZGF0YVNjaGVtYSxcblxuICAgICAgZGlzYWJsZUFycmF5czogdGhpcy5kaXNhYmxlQXJyYXlzLFxuXG4gICAgICBkaXNhYmxlQ29tcGxleFR5cGVzOiB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMsXG5cbiAgICAgIHZhbHVlc1RyYW5zZm9ybWVyOiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUudmFsdWVzVHJhbnNmb3JtZXIsXG5cbiAgICAgIG1lZGlhVVJMRm9ybWF0dGVyOiAobWVkaWFWYWx1ZSkgPT4ge1xuXG4gICAgICAgIHJldHVybiBtZWRpYVZhbHVlLml0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNQaG90b0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZvcm1hdFBob3RvVVJMKGl0ZW0ubWVkaWFJRCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNWaWRlb0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZvcm1hdFZpZGVvVVJMKGl0ZW0ubWVkaWFJRCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNBdWRpb0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZvcm1hdEF1ZGlvVVJMKGl0ZW0ubWVkaWFJRCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0pO1xuICAgICAgfSxcblxuICAgICAgbWVkaWFWaWV3VVJMRm9ybWF0dGVyOiAobWVkaWFWYWx1ZSkgPT4ge1xuICAgICAgICBjb25zdCBpZHMgPSBtZWRpYVZhbHVlLml0ZW1zLm1hcChvID0+IG8ubWVkaWFJRCk7XG5cbiAgICAgICAgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1Bob3RvRWxlbWVudCkge1xuICAgICAgICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9waG90b3Mvdmlldz9waG90b3M9JHsgaWRzIH1gO1xuICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc1ZpZGVvRWxlbWVudCkge1xuICAgICAgICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS92aWRlb3Mvdmlldz92aWRlb3M9JHsgaWRzIH1gO1xuICAgICAgICB9IGVsc2UgaWYgKG1lZGlhVmFsdWUuZWxlbWVudC5pc0F1ZGlvRWxlbWVudCkge1xuICAgICAgICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS9hdWRpby92aWV3P2F1ZGlvPSR7IGlkcyB9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zc3FsUmVwb3J0QmFzZVVybCkge1xuICAgICAgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMucmVwb3J0VVJMRm9ybWF0dGVyID0gKGZlYXR1cmUpID0+IHtcbiAgICAgICAgcmV0dXJuIGAkeyBmdWxjcnVtLmFyZ3MubXNzcWxSZXBvcnRCYXNlVXJsIH0vcmVwb3J0cy8keyBmZWF0dXJlLmlkIH0ucGRmYDtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgdXBkYXRlUmVjb3JkID0gYXN5bmMgKHJlY29yZCwgYWNjb3VudCwgc2tpcFRhYmxlQ2hlY2spID0+IHtcbiAgICBpZiAoIXNraXBUYWJsZUNoZWNrICYmICF0aGlzLnJvb3RUYWJsZUV4aXN0cyhyZWNvcmQuZm9ybSkpIHtcbiAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0ocmVjb3JkLmZvcm0sIGFjY291bnQsICgpID0+IHt9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZVJlY29yZCAmJiAhdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVSZWNvcmQoe3JlY29yZCwgYWNjb3VudH0pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLnVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnRzLm1hcChvID0+IG8uc3FsKS5qb2luKCdcXG4nKSk7XG5cbiAgICBjb25zdCBzeXN0ZW1WYWx1ZXMgPSBNU1NRTFJlY29yZFZhbHVlcy5zeXN0ZW1Db2x1bW5WYWx1ZXNGb3JGZWF0dXJlKHJlY29yZCwgbnVsbCwgcmVjb3JkLCB0aGlzLnJlY29yZFZhbHVlT3B0aW9ucyk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucmVjb3JkKHJlY29yZCwgc3lzdGVtVmFsdWVzKSwgJ3JlY29yZHMnKTtcbiAgfVxuXG4gIHJvb3RUYWJsZUV4aXN0cyA9IChmb3JtKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVOYW1lcy5pbmRleE9mKE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0pKSAhPT0gLTE7XG4gIH1cblxuICByZWNyZWF0ZUZvcm1UYWJsZXMgPSBhc3luYyAoZm9ybSwgYWNjb3VudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSwgbnVsbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihzcWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBudWxsLCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pKTtcbiAgfVxuXG4gIHVwZGF0ZUZvcm0gPSBhc3luYyAoZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSkgPT4ge1xuICAgIGlmICh0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlICYmIHRoaXMubXNzcWxDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSAmJiAhdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVGb3JtKHtmb3JtLCBhY2NvdW50fSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtT2JqZWN0KGZvcm0sIGFjY291bnQpO1xuXG4gICAgICBpZiAoIXRoaXMucm9vdFRhYmxlRXhpc3RzKGZvcm0pICYmIG5ld0Zvcm0gIT0gbnVsbCkge1xuICAgICAgICBvbGRGb3JtID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qge3N0YXRlbWVudHN9ID0gYXdhaXQgTVNTUUxTY2hlbWEuZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzKGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0sIHRoaXMuZGlzYWJsZUFycmF5cyxcbiAgICAgICAgZmFsc2UgLyogZGlzYWJsZUNvbXBsZXhUeXBlcyAqLywgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZSwgdGhpcy5kYXRhU2NoZW1hKTtcblxuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5ydW5BbGwoWydCRUdJTiBUUkFOU0FDVElPTjsnLFxuICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnN0YXRlbWVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ0NPTU1JVCBUUkFOU0FDVElPTjsnXSk7XG5cbiAgICAgIGlmIChuZXdGb3JtKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRFJPUCBWSUVXIElGIEVYSVNUUyAlcy4lczsnLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSB0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnQ1JFQVRFIFZJRVcgJXMuJXMgQVMgU0VMRUNUICogRlJPTSAlcy4lc192aWV3X2Z1bGw7JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXNjYXBlSWRlbnRpZmllcih0aGlzLmRhdGFTY2hlbWEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0sIHJlcGVhdGFibGUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIC8vIHNvbWV0aW1lcyBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgIH1cbiAgfVxuXG4gIGdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCBuYW1lID0gY29tcGFjdChbZm9ybS5uYW1lLCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUuZGF0YU5hbWVdKS5qb2luKCcgLSAnKVxuXG4gICAgY29uc3QgcHJlZml4ID0gY29tcGFjdChbJ3ZpZXcnLCBmb3JtLnJvd0lELCByZXBlYXRhYmxlICYmIHJlcGVhdGFibGUua2V5XSkuam9pbignIC0gJyk7XG5cbiAgICBjb25zdCBvYmplY3ROYW1lID0gW3ByZWZpeCwgbmFtZV0uam9pbignIC0gJyk7XG5cbiAgICByZXR1cm4gdGhpcy50cmltSWRlbnRpZmllcihmdWxjcnVtLmFyZ3MubXNzcWxVbmRlcnNjb3JlTmFtZXMgPyBzbmFrZShvYmplY3ROYW1lKSA6IG9iamVjdE5hbWUpO1xuICB9XG5cbiAgYXN5bmMgaW52b2tlQmVmb3JlRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3NxbEJlZm9yZUZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQmVmb3JlRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNzcWxDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBpbnZva2VBZnRlckZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNzcWxBZnRlckZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zc3FsQWZ0ZXJGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc3NxbEN1c3RvbU1vZHVsZSAmJiB0aGlzLm1zc3FsQ3VzdG9tTW9kdWxlLmFmdGVyU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc3NxbEN1c3RvbU1vZHVsZS5hZnRlclN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCBwcm9ncmVzcykge1xuICAgIGF3YWl0IHRoaXMucmVjcmVhdGVGb3JtVGFibGVzKGZvcm0sIGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIHByb2dyZXNzKGluZGV4KTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFudXBGcmllbmRseVZpZXdzKGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFZpZXdMaXN0KCk7XG5cbiAgICBjb25zdCBhY3RpdmVWaWV3TmFtZXMgPSBbXTtcblxuICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIG51bGwpKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhY3RpdmVWaWV3TmFtZXMucHVzaCh0aGlzLmdldEZyaWVuZGx5VGFibGVOYW1lKGZvcm0sIHJlcGVhdGFibGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmUgPSBkaWZmZXJlbmNlKHRoaXMudmlld05hbWVzLCBhY3RpdmVWaWV3TmFtZXMpO1xuXG4gICAgZm9yIChjb25zdCB2aWV3TmFtZSBvZiByZW1vdmUpIHtcbiAgICAgIGlmICh2aWV3TmFtZS5pbmRleE9mKCd2aWV3XycpID09PSAwIHx8IHZpZXdOYW1lLmluZGV4T2YoJ3ZpZXcgLSAnKSA9PT0gMCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRFJPUCBWSUVXIElGIEVYSVNUUyAlcy4lczsnLCB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy52aWV3U2NoZW1hKSwgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSkpO1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgIHRoaXMuaW50ZWdyaXR5V2FybmluZyhleCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRnJpZW5kbHlWaWV3cyhmb3JtLCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cblxuICB1cGRhdGVTdGF0dXMgPSAobWVzc2FnZSkgPT4ge1xuICAgIGlmIChwcm9jZXNzLnN0ZG91dC5pc1RUWSkge1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BTeXN0ZW1UYWJsZXMoKSB7XG4gICAgYXdhaXQgdGhpcy5ydW5BbGwodGhpcy5wcmVwYXJlTWlncmF0aW9uU2NyaXB0KHRlbXBsYXRlRHJvcCkpO1xuICB9XG5cbiAgY3JlYXRlRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMucnVuKGBDUkVBVEUgREFUQUJBU0UgJHtkYXRhYmFzZU5hbWV9O2ApO1xuICB9XG5cbiAgZHJvcERhdGFiYXNlKGRhdGFiYXNlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLnJ1bihgRFJPUCBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX07YCk7XG4gIH1cblxuICBhc3luYyBzZXR1cERhdGFiYXNlKCkge1xuICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdCh2ZXJzaW9uMDAxKSk7XG4gIH1cblxuICBwcmVwYXJlTWlncmF0aW9uU2NyaXB0KHNxbCkge1xuICAgIHJldHVybiBzcWwucmVwbGFjZSgvX19TQ0hFTUFfXy9nLCB0aGlzLmRhdGFTY2hlbWEpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9fX1ZJRVdfU0NIRU1BX18vZywgdGhpcy52aWV3U2NoZW1hKS5zcGxpdCgnOycpO1xuICB9XG5cbiAgYXN5bmMgc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCkge1xuICAgIGNvbnN0IHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gICAgfTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hQaG90byh7fSwgYXN5bmMgKHBob3RvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdQaG90b3MnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFZpZGVvKHt9LCBhc3luYyAodmlkZW8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1ZpZGVvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQXVkaW8oe30sIGFzeW5jIChhdWRpbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQXVkaW8nLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENoYW5nZXNldCh7fSwgYXN5bmMgKGNoYW5nZXNldCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hhbmdlc2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hSb2xlKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdSb2xlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUHJvamVjdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUHJvamVjdHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaEZvcm0oe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Zvcm1zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hNZW1iZXJzaGlwKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdNZW1iZXJzaGlwcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hvaWNlTGlzdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hvaWNlIExpc3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2xhc3NpZmljYXRpb24gU2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgbWF5YmVJbml0aWFsaXplKCkge1xuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmICh0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZignbWlncmF0aW9ucycpID09PSAtMSkge1xuICAgICAgY29uc29sZS5sb2coJ0luaXRpdGFsaXppbmcgZGF0YWJhc2UuLi4nKTtcblxuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyBtYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCkge1xuICAgIHRoaXMubWlncmF0aW9ucyA9IChhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIG5hbWUgRlJPTSAkeyB0aGlzLmRhdGFTY2hlbWEgfS5taWdyYXRpb25zYCkpLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9uKCcwMDInLCBhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9uKCcwMDMnLCBhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlUnVuTWlncmF0aW9uKHZlcnNpb24sIGFjY291bnQpIHtcbiAgICBpZiAodGhpcy5taWdyYXRpb25zLmluZGV4T2YodmVyc2lvbikgPT09IC0xICYmIE1JR1JBVElPTlNbdmVyc2lvbl0pIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdChNSUdSQVRJT05TW3ZlcnNpb25dKSk7XG5cbiAgICAgIGlmICh2ZXJzaW9uID09PSAnMDAyJykge1xuICAgICAgICBjb25zb2xlLmxvZygnUG9wdWxhdGluZyBzeXN0ZW0gdGFibGVzLi4uJyk7XG5cbiAgICAgICAgLy8gYXdhaXQgdGhpcy5zZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KTtcbiAgICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZVJlY29yZHMoYWNjb3VudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcG9wdWxhdGVSZWNvcmRzKGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGluZGV4ID0gMDtcblxuICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMucHJvZ3Jlc3MoZm9ybS5uYW1lLCBpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgdGhpcy51cGRhdGVTdGF0dXMobmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQpO1xuICB9XG59XG4iXX0=