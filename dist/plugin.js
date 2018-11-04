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

      if (fulcrum.args.msDrop) {
        yield _this.dropSystemTables();
        return;
      }

      if (fulcrum.args.msSetup) {
        yield _this.setupDatabase();
        return;
      }

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (account) {
        if (fulcrum.args.msSystemTablesOnly) {
          yield _this.setupSystemTables(account);
          return;
        }

        yield _this.invokeBeforeFunction();

        const forms = yield account.findActiveForms({});

        for (const form of forms) {
          if (fulcrum.args.msForm && form.id !== fulcrum.args.msForm) {
            continue;
          }

          if (fulcrum.args.msRebuildViewsOnly) {
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
      var _ref20 = _asyncToGenerator(function* (record, account, skipTableCheck) {
        if (!skipTableCheck && !_this.rootTableExists(record.form)) {
          yield _this.rebuildForm(record.form, account, function () {});
        }

        if (_this.msCustomModule && _this.msCustomModule.shouldUpdateRecord && !_this.msCustomModule.shouldUpdateRecord({ record, account })) {
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
        return _ref20.apply(this, arguments);
      };
    })();

    this.rootTableExists = form => {
      return this.tableNames.indexOf(_mssqlRecordValues2.default.tableNameWithForm(form)) !== -1;
    };

    this.recreateFormTables = (() => {
      var _ref21 = _asyncToGenerator(function* (form, account) {
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
        return _ref21.apply(this, arguments);
      };
    })();

    this.updateForm = (() => {
      var _ref22 = _asyncToGenerator(function* (form, account, oldForm, newForm) {
        if (_this.msCustomModule && _this.msCustomModule.shouldUpdateForm && !_this.msCustomModule.shouldUpdateForm({ form, account })) {
          return;
        }

        try {
          yield _this.updateFormObject(form, account);

          if (!_this.rootTableExists(form) && newForm != null) {
            oldForm = null;
          }

          const { statements } = yield _schema2.default.generateSchemaStatements(account, oldForm, newForm, _this.disableArrays, false /* disableComplexTypes */, _this.msCustomModule, _this.dataSchema);

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
        return _ref22.apply(this, arguments);
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
          msConnectionString: {
            desc: 'mssql connection string (overrides all individual database connection parameters)',
            type: 'string'
          },
          msDatabase: {
            desc: 'mssql database name',
            type: 'string',
            default: MSSQL_CONFIG.database
          },
          msHost: {
            desc: 'mssql server host',
            type: 'string',
            default: MSSQL_CONFIG.host
          },
          msPort: {
            desc: 'mssql server port',
            type: 'integer',
            default: MSSQL_CONFIG.port
          },
          msUser: {
            desc: 'mssql user',
            type: 'string'
          },
          msPassword: {
            desc: 'mssql password',
            type: 'string'
          },
          msSchema: {
            desc: 'mssql schema',
            type: 'string'
          },
          msSchemaViews: {
            desc: 'mssql schema for the friendly views',
            type: 'string'
          },
          msSyncEvents: {
            desc: 'add sync event hooks',
            type: 'boolean',
            default: true
          },
          msBeforeFunction: {
            desc: 'call this function before the sync',
            type: 'string'
          },
          msAfterFunction: {
            desc: 'call this function after the sync',
            type: 'string'
          },
          org: {
            desc: 'organization name',
            required: true,
            type: 'string'
          },
          msForm: {
            desc: 'the form ID to rebuild',
            type: 'string'
          },
          msReportBaseUrl: {
            desc: 'report URL base',
            type: 'string'
          },
          msMediaBaseUrl: {
            desc: 'media URL base',
            type: 'string'
          },
          msUnderscoreNames: {
            desc: 'use underscore names (e.g. "Park Inspections" becomes "park_inspections")',
            required: false,
            type: 'boolean',
            default: false
          },
          msRebuildViewsOnly: {
            desc: 'only rebuild the views',
            required: false,
            type: 'boolean',
            default: false
          },
          msCustomModule: {
            desc: 'a custom module to load with sync extensions (experimental)',
            required: false,
            type: 'string'
          },
          msSetup: {
            desc: 'setup the database',
            required: false,
            type: 'boolean'
          },
          msDrop: {
            desc: 'drop the system tables',
            required: false,
            type: 'boolean',
            default: false
          },
          msSystemTablesOnly: {
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

  escapeIdentifier(identifier) {
    return identifier && this.mssql.ident(identifier.substring(0, MAX_IDENTIFIER_LENGTH));
  }

  get useSyncEvents() {
    return fulcrum.args.msSyncEvents != null ? fulcrum.args.msSyncEvents : true;
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const options = _extends({}, MSSQL_CONFIG, {
        server: fulcrum.args.msHost || MSSQL_CONFIG.server,
        port: fulcrum.args.msPort || MSSQL_CONFIG.port,
        database: fulcrum.args.msDatabase || MSSQL_CONFIG.database,
        user: fulcrum.args.msUser || MSSQL_CONFIG.user,
        password: fulcrum.args.msPassword || MSSQL_CONFIG.user
      });

      if (fulcrum.args.msUser) {
        options.user = fulcrum.args.msUser;
      }

      if (fulcrum.args.msPassword) {
        options.password = fulcrum.args.msPassword;
      }

      if (fulcrum.args.msCustomModule) {
        _this3.msCustomModule = require(fulcrum.args.msCustomModule);
        _this3.msCustomModule.api = api;
        _this3.msCustomModule.app = fulcrum;
      }

      _this3.disableArrays = false;
      _this3.disableComplexTypes = true;

      _this3.pool = yield _mssql2.default.connect(fulcrum.args.msConnectionString || options);

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

      _this3.viewSchema = fulcrum.args.msSchemaViews || DEFAULT_SCHEMA;
      _this3.dataSchema = fulcrum.args.msSchema || DEFAULT_SCHEMA;

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
    this.baseMediaURL = fulcrum.args.msMediaBaseUrl ? fulcrum.args.msMediaBaseUrl : 'https://api.fulcrumapp.com/api/v2';

    this.recordValueOptions = {
      schema: this.dataSchema,

      disableArrays: this.disableArrays,

      disableComplexTypes: this.disableComplexTypes,

      valuesTransformer: this.msCustomModule && this.msCustomModule.valuesTransformer,

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

    if (fulcrum.args.msReportBaseUrl) {
      this.recordValueOptions.reportURLFormatter = feature => {
        return `${fulcrum.args.msReportBaseUrl}/reports/${feature.id}.pdf`;
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
    const name = repeatable ? `${form.name} - ${repeatable.dataName}` : form.name;

    return fulcrum.args.msUnderscoreNames ? (0, _snakeCase2.default)(name) : name;
  }

  invokeBeforeFunction() {
    var _this18 = this;

    return _asyncToGenerator(function* () {
      if (fulcrum.args.msBeforeFunction) {
        yield _this18.run((0, _util.format)('EXECUTE %s;', fulcrum.args.msBeforeFunction));
      }
      if (_this18.msCustomModule && _this18.msCustomModule.beforeSync) {
        yield _this18.msCustomModule.beforeSync();
      }
    })();
  }

  invokeAfterFunction() {
    var _this19 = this;

    return _asyncToGenerator(function* () {
      if (fulcrum.args.msAfterFunction) {
        yield _this19.run((0, _util.format)('EXECUTE %s;', fulcrum.args.msAfterFunction));
      }
      if (_this19.msCustomModule && _this19.msCustomModule.afterSync) {
        yield _this19.msCustomModule.afterSync();
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
        var _ref23 = _asyncToGenerator(function* (record) {
          record.form = form;

          if (++index % 10 === 0) {
            progress(index);
          }

          yield _this20.updateRecord(record, account, true);
        });

        return function (_x27) {
          return _ref23.apply(this, arguments);
        };
      })());

      progress(index);
    })();
  }

  rebuildFriendlyViews(form, account) {
    var _this21 = this;

    return _asyncToGenerator(function* () {
      yield _this21.dropFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        yield _this21.dropFriendlyView(form, repeatable);
      }

      yield _this21.createFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        yield _this21.createFriendlyView(form, repeatable);
      }
    })();
  }

  dropSystemTables() {
    var _this22 = this;

    return _asyncToGenerator(function* () {
      yield _this22.runAll(_this22.prepareMigrationScript(_templateDrop2.default));
    })();
  }

  setupDatabase() {
    var _this23 = this;

    return _asyncToGenerator(function* () {
      // console.log('SCRIPT\n', this.prepareMigrationScript(version001));
      yield _this23.runAll(_this23.prepareMigrationScript(_version2.default));
    })();
  }

  prepareMigrationScript(sql) {
    return sql.replace(/__SCHEMA__/g, this.dataSchema).replace(/__VIEW_SCHEMA__/g, this.viewSchema).split(';');
  }

  setupSystemTables(account) {
    var _this24 = this;

    return _asyncToGenerator(function* () {
      const progress = function (name, index) {
        _this24.updateStatus(name.green + ' : ' + index.toString().red);
      };

      yield account.findEachPhoto({}, (() => {
        var _ref24 = _asyncToGenerator(function* (photo, { index }) {
          if (++index % 10 === 0) {
            progress('Photos', index);
          }

          yield _this24.updatePhoto(photo, account);
        });

        return function (_x28, _x29) {
          return _ref24.apply(this, arguments);
        };
      })());

      yield account.findEachVideo({}, (() => {
        var _ref25 = _asyncToGenerator(function* (video, { index }) {
          if (++index % 10 === 0) {
            progress('Videos', index);
          }

          yield _this24.updateVideo(video, account);
        });

        return function (_x30, _x31) {
          return _ref25.apply(this, arguments);
        };
      })());

      yield account.findEachAudio({}, (() => {
        var _ref26 = _asyncToGenerator(function* (audio, { index }) {
          if (++index % 10 === 0) {
            progress('Audio', index);
          }

          yield _this24.updateAudio(audio, account);
        });

        return function (_x32, _x33) {
          return _ref26.apply(this, arguments);
        };
      })());

      yield account.findEachChangeset({}, (() => {
        var _ref27 = _asyncToGenerator(function* (changeset, { index }) {
          if (++index % 10 === 0) {
            progress('Changesets', index);
          }

          yield _this24.updateChangeset(changeset, account);
        });

        return function (_x34, _x35) {
          return _ref27.apply(this, arguments);
        };
      })());

      yield account.findEachRole({}, (() => {
        var _ref28 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Roles', index);
          }

          yield _this24.updateRole(object, account);
        });

        return function (_x36, _x37) {
          return _ref28.apply(this, arguments);
        };
      })());

      yield account.findEachProject({}, (() => {
        var _ref29 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Projects', index);
          }

          yield _this24.updateProject(object, account);
        });

        return function (_x38, _x39) {
          return _ref29.apply(this, arguments);
        };
      })());

      yield account.findEachForm({}, (() => {
        var _ref30 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Forms', index);
          }

          yield _this24.updateFormObject(object, account);
        });

        return function (_x40, _x41) {
          return _ref30.apply(this, arguments);
        };
      })());

      yield account.findEachMembership({}, (() => {
        var _ref31 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Memberships', index);
          }

          yield _this24.updateMembership(object, account);
        });

        return function (_x42, _x43) {
          return _ref31.apply(this, arguments);
        };
      })());

      yield account.findEachChoiceList({}, (() => {
        var _ref32 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Choice Lists', index);
          }

          yield _this24.updateChoiceList(object, account);
        });

        return function (_x44, _x45) {
          return _ref32.apply(this, arguments);
        };
      })());

      yield account.findEachClassificationSet({}, (() => {
        var _ref33 = _asyncToGenerator(function* (object, { index }) {
          if (++index % 10 === 0) {
            progress('Classification Sets', index);
          }

          yield _this24.updateClassificationSet(object, account);
        });

        return function (_x46, _x47) {
          return _ref33.apply(this, arguments);
        };
      })());
    })();
  }

  maybeInitialize() {
    var _this25 = this;

    return _asyncToGenerator(function* () {
      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (_this25.tableNames.indexOf('migrations') === -1) {
        console.log('Inititalizing database...');

        yield _this25.setupDatabase();
      }

      yield _this25.maybeRunMigrations(account);
    })();
  }

  maybeRunMigrations(account) {
    var _this26 = this;

    return _asyncToGenerator(function* () {
      _this26.migrations = (yield _this26.run(`SELECT name FROM ${_this26.dataSchema}.migrations`)).map(function (o) {
        return o.name;
      });

      yield _this26.maybeRunMigration('002', account);
      yield _this26.maybeRunMigration('003', account);
    })();
  }

  maybeRunMigration(version, account) {
    var _this27 = this;

    return _asyncToGenerator(function* () {
      if (_this27.migrations.indexOf(version) === -1 && MIGRATIONS[version]) {
        yield _this27.runAll(_this27.prepareMigrationScript(MIGRATIONS[version]));

        if (version === '002') {
          console.log('Populating system tables...');

          // await this.setupSystemTables(account);
          yield _this27.populateRecords(account);
        }
      }
    })();
  }

  populateRecords(account) {
    var _this28 = this;

    return _asyncToGenerator(function* () {
      const forms = yield account.findActiveForms({});

      let index = 0;

      for (const form of forms) {
        index = 0;

        yield form.findEachRecord({}, (() => {
          var _ref34 = _asyncToGenerator(function* (record) {
            record.form = form;

            if (++index % 10 === 0) {
              _this28.progress(form.name, index);
            }

            yield _this28.updateRecord(record, account, false);
          });

          return function (_x48) {
            return _ref34.apply(this, arguments);
          };
        })());
      }
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJhcGkiLCJNQVhfSURFTlRJRklFUl9MRU5HVEgiLCJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsInNlcnZlciIsInBvcnQiLCJtYXgiLCJpZGxlVGltZW91dE1pbGxpcyIsIk1JR1JBVElPTlMiLCJERUZBVUxUX1NDSEVNQSIsInJ1bkNvbW1hbmQiLCJhY3RpdmF0ZSIsImZ1bGNydW0iLCJhcmdzIiwibXNEcm9wIiwiZHJvcFN5c3RlbVRhYmxlcyIsIm1zU2V0dXAiLCJzZXR1cERhdGFiYXNlIiwiYWNjb3VudCIsImZldGNoQWNjb3VudCIsIm9yZyIsIm1zU3lzdGVtVGFibGVzT25seSIsInNldHVwU3lzdGVtVGFibGVzIiwiaW52b2tlQmVmb3JlRnVuY3Rpb24iLCJmb3JtcyIsImZpbmRBY3RpdmVGb3JtcyIsImZvcm0iLCJtc0Zvcm0iLCJpZCIsIm1zUmVidWlsZFZpZXdzT25seSIsInJlYnVpbGRGcmllbmRseVZpZXdzIiwicmVidWlsZEZvcm0iLCJpbmRleCIsInVwZGF0ZVN0YXR1cyIsIm5hbWUiLCJncmVlbiIsInRvU3RyaW5nIiwicmVkIiwiY29uc29sZSIsImxvZyIsImludm9rZUFmdGVyRnVuY3Rpb24iLCJlcnJvciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInJlc3VsdCIsInBvb2wiLCJyZXF1ZXN0IiwiYmF0Y2giLCJyZWNvcmRzZXQiLCJydW5BbGwiLCJzdGF0ZW1lbnRzIiwicmVzdWx0cyIsInB1c2giLCJ0YWJsZU5hbWUiLCJyb3dJRCIsIm9uU3luY1N0YXJ0IiwidGFza3MiLCJvblN5bmNGaW5pc2giLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25Gb3JtRGVsZXRlIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJtc3NxbCIsInJlY29yZFZhbHVlT3B0aW9ucyIsIm1hcCIsIm8iLCJqb2luIiwib25QaG90b1NhdmUiLCJwaG90byIsInVwZGF0ZVBob3RvIiwib25WaWRlb1NhdmUiLCJ2aWRlbyIsInVwZGF0ZVZpZGVvIiwib25BdWRpb1NhdmUiLCJhdWRpbyIsInVwZGF0ZUF1ZGlvIiwib25DaGFuZ2VzZXRTYXZlIiwiY2hhbmdlc2V0IiwidXBkYXRlQ2hhbmdlc2V0Iiwib25DaG9pY2VMaXN0U2F2ZSIsImNob2ljZUxpc3QiLCJ1cGRhdGVDaG9pY2VMaXN0Iiwib25DbGFzc2lmaWNhdGlvblNldFNhdmUiLCJjbGFzc2lmaWNhdGlvblNldCIsInVwZGF0ZUNsYXNzaWZpY2F0aW9uU2V0Iiwib25Qcm9qZWN0U2F2ZSIsInByb2plY3QiLCJ1cGRhdGVQcm9qZWN0Iiwib25Sb2xlU2F2ZSIsInJvbGUiLCJ1cGRhdGVSb2xlIiwib25NZW1iZXJzaGlwU2F2ZSIsIm1lbWJlcnNoaXAiLCJ1cGRhdGVNZW1iZXJzaGlwIiwicmVsb2FkVGFibGVMaXN0Iiwicm93cyIsImRhdGFTY2hlbWEiLCJ0YWJsZU5hbWVzIiwiYmFzZU1lZGlhVVJMIiwiZm9ybWF0UGhvdG9VUkwiLCJmb3JtYXRWaWRlb1VSTCIsImZvcm1hdEF1ZGlvVVJMIiwic2tpcFRhYmxlQ2hlY2siLCJyb290VGFibGVFeGlzdHMiLCJtc0N1c3RvbU1vZHVsZSIsInNob3VsZFVwZGF0ZVJlY29yZCIsInVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJzeXN0ZW1WYWx1ZXMiLCJzeXN0ZW1Db2x1bW5WYWx1ZXNGb3JGZWF0dXJlIiwidXBkYXRlT2JqZWN0IiwiaW5kZXhPZiIsInRhYmxlTmFtZVdpdGhGb3JtIiwicmVjcmVhdGVGb3JtVGFibGVzIiwiZm9ybVZlcnNpb24iLCJleCIsInNob3VsZFVwZGF0ZUZvcm0iLCJ1cGRhdGVGb3JtT2JqZWN0IiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZGlzYWJsZUFycmF5cyIsImRyb3BGcmllbmRseVZpZXciLCJyZXBlYXRhYmxlIiwiZWxlbWVudHNPZlR5cGUiLCJjcmVhdGVGcmllbmRseVZpZXciLCJpbnRlZ3JpdHlXYXJuaW5nIiwibWVzc2FnZSIsInByb2Nlc3MiLCJzdGRvdXQiLCJpc1RUWSIsImNsZWFyTGluZSIsImN1cnNvclRvIiwid3JpdGUiLCJwcm9ncmVzcyIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJtc0Nvbm5lY3Rpb25TdHJpbmciLCJ0eXBlIiwibXNEYXRhYmFzZSIsImRlZmF1bHQiLCJtc0hvc3QiLCJob3N0IiwibXNQb3J0IiwibXNVc2VyIiwibXNQYXNzd29yZCIsIm1zU2NoZW1hIiwibXNTY2hlbWFWaWV3cyIsIm1zU3luY0V2ZW50cyIsIm1zQmVmb3JlRnVuY3Rpb24iLCJtc0FmdGVyRnVuY3Rpb24iLCJyZXF1aXJlZCIsIm1zUmVwb3J0QmFzZVVybCIsIm1zTWVkaWFCYXNlVXJsIiwibXNVbmRlcnNjb3JlTmFtZXMiLCJoYW5kbGVyIiwiZXNjYXBlSWRlbnRpZmllciIsImlkZW50aWZpZXIiLCJpZGVudCIsInN1YnN0cmluZyIsInVzZVN5bmNFdmVudHMiLCJvcHRpb25zIiwidXNlciIsInBhc3N3b3JkIiwicmVxdWlyZSIsImFwcCIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJjb25uZWN0Iiwib24iLCJ2aWV3U2NoZW1hIiwic2V0dXBPcHRpb25zIiwibWF5YmVJbml0aWFsaXplIiwiZGVhY3RpdmF0ZSIsImNsb3NlIiwib2JqZWN0IiwidmFsdWVzIiwiZmlsZSIsImFjY2Vzc19rZXkiLCJ0YWJsZSIsImRlbGV0ZVN0YXRlbWVudCIsInJvd19yZXNvdXJjZV9pZCIsImluc2VydFN0YXRlbWVudCIsInBrIiwid2FybiIsInN0YWNrIiwic2NoZW1hIiwidmFsdWVzVHJhbnNmb3JtZXIiLCJtZWRpYVVSTEZvcm1hdHRlciIsIm1lZGlhVmFsdWUiLCJpdGVtcyIsIml0ZW0iLCJlbGVtZW50IiwiaXNQaG90b0VsZW1lbnQiLCJtZWRpYUlEIiwiaXNWaWRlb0VsZW1lbnQiLCJpc0F1ZGlvRWxlbWVudCIsIm1lZGlhVmlld1VSTEZvcm1hdHRlciIsImlkcyIsInJlcG9ydFVSTEZvcm1hdHRlciIsImZlYXR1cmUiLCJ2aWV3TmFtZSIsImdldEZyaWVuZGx5VGFibGVOYW1lIiwiZGF0YU5hbWUiLCJiZWZvcmVTeW5jIiwiYWZ0ZXJTeW5jIiwiZmluZEVhY2hSZWNvcmQiLCJwcmVwYXJlTWlncmF0aW9uU2NyaXB0Iiwic3BsaXQiLCJmaW5kRWFjaFBob3RvIiwiZmluZEVhY2hWaWRlbyIsImZpbmRFYWNoQXVkaW8iLCJmaW5kRWFjaENoYW5nZXNldCIsImZpbmRFYWNoUm9sZSIsImZpbmRFYWNoUHJvamVjdCIsImZpbmRFYWNoRm9ybSIsImZpbmRFYWNoTWVtYmVyc2hpcCIsImZpbmRFYWNoQ2hvaWNlTGlzdCIsImZpbmRFYWNoQ2xhc3NpZmljYXRpb25TZXQiLCJtYXliZVJ1bk1pZ3JhdGlvbnMiLCJtaWdyYXRpb25zIiwibWF5YmVSdW5NaWdyYXRpb24iLCJ2ZXJzaW9uIiwicG9wdWxhdGVSZWNvcmRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBOzs7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7SUFLWUEsRzs7QUFKWjs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUdBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7Ozs7OztBQUVBLE1BQU1DLHdCQUF3QixFQUE5Qjs7QUFFQSxNQUFNQyxlQUFlO0FBQ25CQyxZQUFVLFlBRFM7QUFFbkJDLFVBQVEsV0FGVztBQUduQkMsUUFBTSxJQUhhO0FBSW5CQyxPQUFLLEVBSmM7QUFLbkJDLHFCQUFtQjtBQUxBLENBQXJCOztBQVFBLE1BQU1DLGFBQWE7QUFDakIsMEJBRGlCO0FBRWpCO0FBRmlCLENBQW5COztBQUtBLE1BQU1DLGlCQUFpQixLQUF2Qjs7a0JBRWUsTUFBTTtBQUFBO0FBQUE7O0FBQUEsU0E4R25CQyxVQTlHbUIscUJBOEdOLGFBQVk7QUFD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O0FBQ0QsV0FSSzs7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUFOO0FBU0Q7QUFqQjRCO0FBa0I5Qjs7QUF6MEJrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtc3NxbCBmcm9tICdtc3NxbCc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICd1dGlsJztcbmltcG9ydCBNU1NRTFNjaGVtYSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBNU1NRTCB9IGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IE1TU1FMUmVjb3JkVmFsdWVzIGZyb20gJy4vbXNzcWwtcmVjb3JkLXZhbHVlcydcbmltcG9ydCBzbmFrZSBmcm9tICdzbmFrZS1jYXNlJztcbmltcG9ydCB0ZW1wbGF0ZURyb3AgZnJvbSAnLi90ZW1wbGF0ZS5kcm9wLnNxbCc7XG5pbXBvcnQgU2NoZW1hTWFwIGZyb20gJy4vc2NoZW1hLW1hcCc7XG5pbXBvcnQgKiBhcyBhcGkgZnJvbSAnZnVsY3J1bSc7XG5cbmltcG9ydCB2ZXJzaW9uMDAxIGZyb20gJy4vdmVyc2lvbi0wMDEuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDAyIGZyb20gJy4vdmVyc2lvbi0wMDIuc3FsJztcbmltcG9ydCB2ZXJzaW9uMDAzIGZyb20gJy4vdmVyc2lvbi0wMDMuc3FsJztcblxuY29uc3QgTUFYX0lERU5USUZJRVJfTEVOR1RIID0gNjM7XG5cbmNvbnN0IE1TU1FMX0NPTkZJRyA9IHtcbiAgZGF0YWJhc2U6ICdmdWxjcnVtYXBwJyxcbiAgc2VydmVyOiAnbG9jYWxob3N0JyxcbiAgcG9ydDogMTQzMyxcbiAgbWF4OiAxMCxcbiAgaWRsZVRpbWVvdXRNaWxsaXM6IDMwMDAwXG59O1xuXG5jb25zdCBNSUdSQVRJT05TID0ge1xuICAnMDAyJzogdmVyc2lvbjAwMixcbiAgJzAwMyc6IHZlcnNpb24wMDNcbn07XG5cbmNvbnN0IERFRkFVTFRfU0NIRU1BID0gJ2Ribyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ21zc3FsJyxcbiAgICAgIGRlc2M6ICdydW4gdGhlIG1zc3FsIHN5bmMgZm9yIGEgc3BlY2lmaWMgb3JnYW5pemF0aW9uJyxcbiAgICAgIGJ1aWxkZXI6IHtcbiAgICAgICAgbXNDb25uZWN0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGNvbm5lY3Rpb24gc3RyaW5nIChvdmVycmlkZXMgYWxsIGluZGl2aWR1YWwgZGF0YWJhc2UgY29ubmVjdGlvbiBwYXJhbWV0ZXJzKScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNEYXRhYmFzZToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBkYXRhYmFzZSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuZGF0YWJhc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNIb3N0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBob3N0JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcuaG9zdFxuICAgICAgICB9LFxuICAgICAgICBtc1BvcnQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIHBvcnQnLFxuICAgICAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICAgICAgICBkZWZhdWx0OiBNU1NRTF9DT05GSUcucG9ydFxuICAgICAgICB9LFxuICAgICAgICBtc1VzZXI6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgdXNlcicsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNQYXNzd29yZDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBwYXNzd29yZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNTY2hlbWE6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2NoZW1hJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc1NjaGVtYVZpZXdzOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYSBmb3IgdGhlIGZyaWVuZGx5IHZpZXdzJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc1N5bmNFdmVudHM6IHtcbiAgICAgICAgICBkZXNjOiAnYWRkIHN5bmMgZXZlbnQgaG9va3MnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIG1zQmVmb3JlRnVuY3Rpb246IHtcbiAgICAgICAgICBkZXNjOiAnY2FsbCB0aGlzIGZ1bmN0aW9uIGJlZm9yZSB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNBZnRlckZ1bmN0aW9uOiB7XG4gICAgICAgICAgZGVzYzogJ2NhbGwgdGhpcyBmdW5jdGlvbiBhZnRlciB0aGUgc3luYycsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc0Zvcm06IHtcbiAgICAgICAgICBkZXNjOiAndGhlIGZvcm0gSUQgdG8gcmVidWlsZCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNSZXBvcnRCYXNlVXJsOiB7XG4gICAgICAgICAgZGVzYzogJ3JlcG9ydCBVUkwgYmFzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNNZWRpYUJhc2VVcmw6IHtcbiAgICAgICAgICBkZXNjOiAnbWVkaWEgVVJMIGJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zVW5kZXJzY29yZU5hbWVzOiB7XG4gICAgICAgICAgZGVzYzogJ3VzZSB1bmRlcnNjb3JlIG5hbWVzIChlLmcuIFwiUGFyayBJbnNwZWN0aW9uc1wiIGJlY29tZXMgXCJwYXJrX2luc3BlY3Rpb25zXCIpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zUmVidWlsZFZpZXdzT25seToge1xuICAgICAgICAgIGRlc2M6ICdvbmx5IHJlYnVpbGQgdGhlIHZpZXdzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zQ3VzdG9tTW9kdWxlOiB7XG4gICAgICAgICAgZGVzYzogJ2EgY3VzdG9tIG1vZHVsZSB0byBsb2FkIHdpdGggc3luYyBleHRlbnNpb25zIChleHBlcmltZW50YWwpJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNTZXR1cDoge1xuICAgICAgICAgIGRlc2M6ICdzZXR1cCB0aGUgZGF0YWJhc2UnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbidcbiAgICAgICAgfSxcbiAgICAgICAgbXNEcm9wOiB7XG4gICAgICAgICAgZGVzYzogJ2Ryb3AgdGhlIHN5c3RlbSB0YWJsZXMnLFxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgbXNTeXN0ZW1UYWJsZXNPbmx5OiB7XG4gICAgICAgICAgZGVzYzogJ29ubHkgY3JlYXRlIHRoZSBzeXN0ZW0gcmVjb3JkcycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNEcm9wKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BTeXN0ZW1UYWJsZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zU2V0dXApIHtcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBEYXRhYmFzZSgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zU3lzdGVtVGFibGVzT25seSkge1xuICAgICAgICBhd2FpdCB0aGlzLnNldHVwU3lzdGVtVGFibGVzKGFjY291bnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuaW52b2tlQmVmb3JlRnVuY3Rpb24oKTtcblxuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zRm9ybSAmJiBmb3JtLmlkICE9PSBmdWxjcnVtLmFyZ3MubXNGb3JtKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnVsY3J1bS5hcmdzLm1zUmVidWlsZFZpZXdzT25seSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZyaWVuZGx5Vmlld3MoZm9ybSwgYWNjb3VudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoaW5kZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBlc2NhcGVJZGVudGlmaWVyKGlkZW50aWZpZXIpIHtcbiAgICByZXR1cm4gaWRlbnRpZmllciAmJiB0aGlzLm1zc3FsLmlkZW50KGlkZW50aWZpZXIuc3Vic3RyaW5nKDAsIE1BWF9JREVOVElGSUVSX0xFTkdUSCkpO1xuICB9XG5cbiAgZ2V0IHVzZVN5bmNFdmVudHMoKSB7XG4gICAgcmV0dXJuIGZ1bGNydW0uYXJncy5tc1N5bmNFdmVudHMgIT0gbnVsbCA/IGZ1bGNydW0uYXJncy5tc1N5bmNFdmVudHMgOiB0cnVlO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGUoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zSG9zdCB8fCBNU1NRTF9DT05GSUcuc2VydmVyLFxuICAgICAgcG9ydDogZnVsY3J1bS5hcmdzLm1zUG9ydCB8fCBNU1NRTF9DT05GSUcucG9ydCxcbiAgICAgIGRhdGFiYXNlOiBmdWxjcnVtLmFyZ3MubXNEYXRhYmFzZSB8fCBNU1NRTF9DT05GSUcuZGF0YWJhc2UsXG4gICAgICB1c2VyOiBmdWxjcnVtLmFyZ3MubXNVc2VyIHx8IE1TU1FMX0NPTkZJRy51c2VyLFxuICAgICAgcGFzc3dvcmQ6IGZ1bGNydW0uYXJncy5tc1Bhc3N3b3JkIHx8IE1TU1FMX0NPTkZJRy51c2VyXG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNVc2VyKSB7XG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXNVc2VyO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNQYXNzd29yZCkge1xuICAgICAgb3B0aW9ucy5wYXNzd29yZCA9IGZ1bGNydW0uYXJncy5tc1Bhc3N3b3JkO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNDdXN0b21Nb2R1bGUpIHtcbiAgICAgIHRoaXMubXNDdXN0b21Nb2R1bGUgPSByZXF1aXJlKGZ1bGNydW0uYXJncy5tc0N1c3RvbU1vZHVsZSk7XG4gICAgICB0aGlzLm1zQ3VzdG9tTW9kdWxlLmFwaSA9IGFwaTtcbiAgICAgIHRoaXMubXNDdXN0b21Nb2R1bGUuYXBwID0gZnVsY3J1bTtcbiAgICB9XG5cbiAgICB0aGlzLmRpc2FibGVBcnJheXMgPSBmYWxzZTtcbiAgICB0aGlzLmRpc2FibGVDb21wbGV4VHlwZXMgPSB0cnVlO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChmdWxjcnVtLmFyZ3MubXNDb25uZWN0aW9uU3RyaW5nIHx8IG9wdGlvbnMpO1xuXG4gICAgaWYgKHRoaXMudXNlU3luY0V2ZW50cykge1xuICAgICAgZnVsY3J1bS5vbignc3luYzpzdGFydCcsIHRoaXMub25TeW5jU3RhcnQpO1xuICAgICAgZnVsY3J1bS5vbignc3luYzpmaW5pc2gnLCB0aGlzLm9uU3luY0ZpbmlzaCk7XG4gICAgICBmdWxjcnVtLm9uKCdwaG90bzpzYXZlJywgdGhpcy5vblBob3RvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCd2aWRlbzpzYXZlJywgdGhpcy5vblZpZGVvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdhdWRpbzpzYXZlJywgdGhpcy5vbkF1ZGlvU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjaGFuZ2VzZXQ6c2F2ZScsIHRoaXMub25DaGFuZ2VzZXRTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ3JlY29yZDpzYXZlJywgdGhpcy5vblJlY29yZFNhdmUpO1xuICAgICAgZnVsY3J1bS5vbigncmVjb3JkOmRlbGV0ZScsIHRoaXMub25SZWNvcmREZWxldGUpO1xuXG4gICAgICBmdWxjcnVtLm9uKCdjaG9pY2UtbGlzdDpzYXZlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcbiAgICAgIGZ1bGNydW0ub24oJ2Nob2ljZS1saXN0OmRlbGV0ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2Zvcm06c2F2ZScsIHRoaXMub25Gb3JtU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdmb3JtOmRlbGV0ZScsIHRoaXMub25Gb3JtU2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uLXNldDpzYXZlJywgdGhpcy5vbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbi1zZXQ6ZGVsZXRlJywgdGhpcy5vbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ3JvbGU6c2F2ZScsIHRoaXMub25Sb2xlU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdyb2xlOmRlbGV0ZScsIHRoaXMub25Sb2xlU2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ3Byb2plY3Q6c2F2ZScsIHRoaXMub25Qcm9qZWN0U2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdwcm9qZWN0OmRlbGV0ZScsIHRoaXMub25Qcm9qZWN0U2F2ZSk7XG5cbiAgICAgIGZ1bGNydW0ub24oJ21lbWJlcnNoaXA6c2F2ZScsIHRoaXMub25NZW1iZXJzaGlwU2F2ZSk7XG4gICAgICBmdWxjcnVtLm9uKCdtZW1iZXJzaGlwOmRlbGV0ZScsIHRoaXMub25NZW1iZXJzaGlwU2F2ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52aWV3U2NoZW1hID0gZnVsY3J1bS5hcmdzLm1zU2NoZW1hVmlld3MgfHwgREVGQVVMVF9TQ0hFTUE7XG4gICAgdGhpcy5kYXRhU2NoZW1hID0gZnVsY3J1bS5hcmdzLm1zU2NoZW1hIHx8IERFRkFVTFRfU0NIRU1BO1xuXG4gICAgLy8gRmV0Y2ggYWxsIHRoZSBleGlzdGluZyB0YWJsZXMgb24gc3RhcnR1cC4gVGhpcyBhbGxvd3MgdXMgdG8gc3BlY2lhbCBjYXNlIHRoZVxuICAgIC8vIGNyZWF0aW9uIG9mIG5ldyB0YWJsZXMgZXZlbiB3aGVuIHRoZSBmb3JtIGlzbid0IHZlcnNpb24gMS4gSWYgdGhlIHRhYmxlIGRvZXNuJ3RcbiAgICAvLyBleGlzdCwgd2UgY2FuIHByZXRlbmQgdGhlIGZvcm0gaXMgdmVyc2lvbiAxIHNvIGl0IGNyZWF0ZXMgYWxsIG5ldyB0YWJsZXMgaW5zdGVhZFxuICAgIC8vIG9mIGFwcGx5aW5nIGEgc2NoZW1hIGRpZmYuXG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKGBTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9JyR7IHRoaXMuZGF0YVNjaGVtYSB9J2ApO1xuXG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuXG4gICAgLy8gbWFrZSBhIGNsaWVudCBzbyB3ZSBjYW4gdXNlIGl0IHRvIGJ1aWxkIFNRTCBzdGF0ZW1lbnRzXG4gICAgdGhpcy5tc3NxbCA9IG5ldyBNU1NRTCh7fSk7XG5cbiAgICB0aGlzLnNldHVwT3B0aW9ucygpO1xuXG4gICAgYXdhaXQgdGhpcy5tYXliZUluaXRpYWxpemUoKTtcbiAgfVxuXG4gIGFzeW5jIGRlYWN0aXZhdGUoKSB7XG4gICAgaWYgKHRoaXMucG9vbCkge1xuICAgICAgYXdhaXQgdGhpcy5wb29sLmNsb3NlKCk7XG4gICAgfVxuICB9XG5cbiAgcnVuID0gYXN5bmMgKHNxbCkgPT4ge1xuICAgIHNxbCA9IHNxbC5yZXBsYWNlKC9cXDAvZywgJycpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgY29uc29sZS5sb2coc3FsKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBvb2wucmVxdWVzdCgpLmJhdGNoKHNxbCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnJlY29yZHNldDtcbiAgfVxuXG4gIHJ1bkFsbCA9IGFzeW5jIChzdGF0ZW1lbnRzKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgcmVzdWx0cy5wdXNoKGF3YWl0IHRoaXMucnVuKHNxbCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgbG9nID0gKC4uLmFyZ3MpID0+IHtcbiAgICAvLyBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfVxuXG4gIHRhYmxlTmFtZSA9IChhY2NvdW50LCBuYW1lKSA9PiB7XG4gICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcbiAgfVxuXG4gIG9uU3luY1N0YXJ0ID0gYXN5bmMgKHthY2NvdW50LCB0YXNrc30pID0+IHtcbiAgICBhd2FpdCB0aGlzLmludm9rZUJlZm9yZUZ1bmN0aW9uKCk7XG4gIH1cblxuICBvblN5bmNGaW5pc2ggPSBhc3luYyAoe2FjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy5pbnZva2VBZnRlckZ1bmN0aW9uKCk7XG4gIH1cblxuICBvbkZvcm1TYXZlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcbiAgfVxuXG4gIG9uRm9ybURlbGV0ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudH0pID0+IHtcbiAgICBjb25zdCBvbGRGb3JtID0ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG51bGwpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuICB9XG5cbiAgb25QaG90b1NhdmUgPSBhc3luYyAoe3Bob3RvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICB9XG5cbiAgb25WaWRlb1NhdmUgPSBhc3luYyAoe3ZpZGVvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVmlkZW8odmlkZW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25BdWRpb1NhdmUgPSBhc3luYyAoe2F1ZGlvLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICB9XG5cbiAgb25DaGFuZ2VzZXRTYXZlID0gYXN5bmMgKHtjaGFuZ2VzZXQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe2Nob2ljZUxpc3QsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVDaG9pY2VMaXN0KGNob2ljZUxpc3QsIGFjY291bnQpO1xuICB9XG5cbiAgb25DbGFzc2lmaWNhdGlvblNldFNhdmUgPSBhc3luYyAoe2NsYXNzaWZpY2F0aW9uU2V0LCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlQ2xhc3NpZmljYXRpb25TZXQoY2xhc3NpZmljYXRpb25TZXQsIGFjY291bnQpO1xuICB9XG5cbiAgb25Qcm9qZWN0U2F2ZSA9IGFzeW5jICh7cHJvamVjdCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb2plY3QocHJvamVjdCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJvbGVTYXZlID0gYXN5bmMgKHtyb2xlLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUm9sZShyb2xlLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uTWVtYmVyc2hpcFNhdmUgPSBhc3luYyAoe21lbWJlcnNoaXAsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG1lbWJlcnNoaXAsIGFjY291bnQpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUGhvdG8ob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgY29uc3QgdmFsdWVzID0gU2NoZW1hTWFwLnBob3RvKG9iamVjdCk7XG5cbiAgICB2YWx1ZXMuZmlsZSA9IHRoaXMuZm9ybWF0UGhvdG9VUkwodmFsdWVzLmFjY2Vzc19rZXkpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QodmFsdWVzLCAncGhvdG9zJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVWaWRlbyhvYmplY3QsIGFjY291bnQpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSBTY2hlbWFNYXAudmlkZW8ob2JqZWN0KTtcblxuICAgIHZhbHVlcy5maWxlID0gdGhpcy5mb3JtYXRWaWRlb1VSTCh2YWx1ZXMuYWNjZXNzX2tleSk7XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdCh2YWx1ZXMsICd2aWRlb3MnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUF1ZGlvKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IFNjaGVtYU1hcC5hdWRpbyhvYmplY3QpO1xuXG4gICAgdmFsdWVzLmZpbGUgPSB0aGlzLmZvcm1hdEF1ZGlvVVJMKHZhbHVlcy5hY2Nlc3Nfa2V5KTtcblxuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KHZhbHVlcywgJ2F1ZGlvJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVDaGFuZ2VzZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNoYW5nZXNldChvYmplY3QpLCAnY2hhbmdlc2V0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAucHJvamVjdChvYmplY3QpLCAncHJvamVjdHMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZU1lbWJlcnNoaXAob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLm1lbWJlcnNoaXAob2JqZWN0KSwgJ21lbWJlcnNoaXBzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCkge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlT2JqZWN0KFNjaGVtYU1hcC5yb2xlKG9iamVjdCksICdyb2xlcycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlRm9ybU9iamVjdChvYmplY3QsIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZU9iamVjdChTY2hlbWFNYXAuZm9ybShvYmplY3QpLCAnZm9ybXMnKTtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNob2ljZUxpc3Qob2JqZWN0KSwgJ2Nob2ljZV9saXN0cycpO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlQ2xhc3NpZmljYXRpb25TZXQob2JqZWN0LCBhY2NvdW50KSB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLmNsYXNzaWZpY2F0aW9uU2V0KG9iamVjdCksICdjbGFzc2lmaWNhdGlvbl9zZXRzJyk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVPYmplY3QodmFsdWVzLCB0YWJsZSkge1xuICAgIGNvbnN0IGRlbGV0ZVN0YXRlbWVudCA9IHRoaXMubXNzcWwuZGVsZXRlU3RhdGVtZW50KGAkeyB0aGlzLmRhdGFTY2hlbWEgfS5zeXN0ZW1fJHt0YWJsZX1gLCB7cm93X3Jlc291cmNlX2lkOiB2YWx1ZXMucm93X3Jlc291cmNlX2lkfSk7XG4gICAgY29uc3QgaW5zZXJ0U3RhdGVtZW50ID0gdGhpcy5tc3NxbC5pbnNlcnRTdGF0ZW1lbnQoYCR7IHRoaXMuZGF0YVNjaGVtYSB9LnN5c3RlbV8ke3RhYmxlfWAsIHZhbHVlcywge3BrOiAnaWQnfSk7XG5cbiAgICBjb25zdCBzcWwgPSBbIGRlbGV0ZVN0YXRlbWVudC5zcWwsIGluc2VydFN0YXRlbWVudC5zcWwgXS5qb2luKCdcXG4nKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihzcWwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICB0aGlzLmludGVncml0eVdhcm5pbmcoZXgpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9XG5cbiAgcmVsb2FkVGFibGVMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSckeyB0aGlzLmRhdGFTY2hlbWEgfSdgKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIGJhc2VNZWRpYVVSTCA9ICgpID0+IHtcbiAgfVxuXG4gIGZvcm1hdFBob3RvVVJMID0gKGlkKSA9PiB7XG4gICAgcmV0dXJuIGAkeyB0aGlzLmJhc2VNZWRpYVVSTCB9L3Bob3Rvcy8keyBpZCB9LmpwZ2A7XG4gIH1cblxuICBmb3JtYXRWaWRlb1VSTCA9IChpZCkgPT4ge1xuICAgIHJldHVybiBgJHsgdGhpcy5iYXNlTWVkaWFVUkwgfS92aWRlb3MvJHsgaWQgfS5tcDRgO1xuICB9XG5cbiAgZm9ybWF0QXVkaW9VUkwgPSAoaWQpID0+IHtcbiAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vJHsgaWQgfS5tNGFgO1xuICB9XG5cbiAgaW50ZWdyaXR5V2FybmluZyhleCkge1xuICAgIGNvbnNvbGUud2FybihgXG4tLS0tLS0tLS0tLS0tXG4hISBXQVJOSU5HICEhXG4tLS0tLS0tLS0tLS0tXG5cbk1TU1FMIGRhdGFiYXNlIGludGVncml0eSBpc3N1ZSBlbmNvdW50ZXJlZC4gQ29tbW9uIHNvdXJjZXMgb2YgZGF0YWJhc2UgaXNzdWVzIGFyZTpcblxuKiBSZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIGFuZCB1c2luZyBhbiBvbGQgTVNTUUwgZGF0YWJhc2Ugd2l0aG91dCByZWNyZWF0aW5nXG4gIHRoZSBNU1NRTCBkYXRhYmFzZS5cbiogRGVsZXRpbmcgdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlIGFuZCB1c2luZyBhbiBleGlzdGluZyBNU1NRTCBkYXRhYmFzZVxuKiBNYW51YWxseSBtb2RpZnlpbmcgdGhlIE1TU1FMIGRhdGFiYXNlXG4qIENyZWF0aW5nIG11bHRpcGxlIGFwcHMgaW4gRnVsY3J1bSB3aXRoIHRoZSBzYW1lIG5hbWUuIFRoaXMgaXMgZ2VuZXJhbGx5IE9LLCBleGNlcHRcbiAgeW91IHdpbGwgbm90IGJlIGFibGUgdG8gdXNlIHRoZSBcImZyaWVuZGx5IHZpZXdcIiBmZWF0dXJlIG9mIHRoZSBNU1NRTCBwbHVnaW4gc2luY2VcbiAgdGhlIHZpZXcgbmFtZXMgYXJlIGRlcml2ZWQgZnJvbSB0aGUgZm9ybSBuYW1lcy5cblxuTm90ZTogV2hlbiByZWluc3RhbGxpbmcgRnVsY3J1bSBEZXNrdG9wIG9yIFwic3RhcnRpbmcgb3ZlclwiIHlvdSBuZWVkIHRvIGRyb3AgYW5kIHJlLWNyZWF0ZVxudGhlIE1TU1FMIGRhdGFiYXNlLiBUaGUgbmFtZXMgb2YgZGF0YWJhc2Ugb2JqZWN0cyBhcmUgdGllZCBkaXJlY3RseSB0byB0aGUgZGF0YWJhc2Vcbm9iamVjdHMgaW4gdGhlIGludGVybmFsIGFwcGxpY2F0aW9uIGRhdGFiYXNlLlxuXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblJlcG9ydCBpc3N1ZXMgYXQgaHR0cHM6Ly9naXRodWIuY29tL2Z1bGNydW1hcHAvZnVsY3J1bS1kZXNrdG9wL2lzc3Vlc1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5NZXNzYWdlOlxuJHsgZXgubWVzc2FnZSB9XG5cblN0YWNrOlxuJHsgZXguc3RhY2sgfVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5gLnJlZFxuICAgICk7XG4gIH1cblxuICBzZXR1cE9wdGlvbnMoKSB7XG4gICAgdGhpcy5iYXNlTWVkaWFVUkwgPSBmdWxjcnVtLmFyZ3MubXNNZWRpYUJhc2VVcmwgPyBmdWxjcnVtLmFyZ3MubXNNZWRpYUJhc2VVcmwgOiAnaHR0cHM6Ly9hcGkuZnVsY3J1bWFwcC5jb20vYXBpL3YyJztcblxuICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zID0ge1xuICAgICAgc2NoZW1hOiB0aGlzLmRhdGFTY2hlbWEsXG5cbiAgICAgIGRpc2FibGVBcnJheXM6IHRoaXMuZGlzYWJsZUFycmF5cyxcblxuICAgICAgZGlzYWJsZUNvbXBsZXhUeXBlczogdGhpcy5kaXNhYmxlQ29tcGxleFR5cGVzLFxuXG4gICAgICB2YWx1ZXNUcmFuc2Zvcm1lcjogdGhpcy5tc0N1c3RvbU1vZHVsZSAmJiB0aGlzLm1zQ3VzdG9tTW9kdWxlLnZhbHVlc1RyYW5zZm9ybWVyLFxuXG4gICAgICBtZWRpYVVSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcblxuICAgICAgICByZXR1cm4gbWVkaWFWYWx1ZS5pdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzUGhvdG9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRQaG90b1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzVmlkZW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRWaWRlb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWVkaWFWYWx1ZS5lbGVtZW50LmlzQXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mb3JtYXRBdWRpb1VSTChpdGVtLm1lZGlhSUQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIG1lZGlhVmlld1VSTEZvcm1hdHRlcjogKG1lZGlhVmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgaWRzID0gbWVkaWFWYWx1ZS5pdGVtcy5tYXAobyA9PiBvLm1lZGlhSUQpO1xuXG4gICAgICAgIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNQaG90b0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vcGhvdG9zL3ZpZXc/cGhvdG9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNWaWRlb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vdmlkZW9zL3ZpZXc/dmlkZW9zPSR7IGlkcyB9YDtcbiAgICAgICAgfSBlbHNlIGlmIChtZWRpYVZhbHVlLmVsZW1lbnQuaXNBdWRpb0VsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gYCR7IHRoaXMuYmFzZU1lZGlhVVJMIH0vYXVkaW8vdmlldz9hdWRpbz0keyBpZHMgfWA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc1JlcG9ydEJhc2VVcmwpIHtcbiAgICAgIHRoaXMucmVjb3JkVmFsdWVPcHRpb25zLnJlcG9ydFVSTEZvcm1hdHRlciA9IChmZWF0dXJlKSA9PiB7XG4gICAgICAgIHJldHVybiBgJHsgZnVsY3J1bS5hcmdzLm1zUmVwb3J0QmFzZVVybCB9L3JlcG9ydHMvJHsgZmVhdHVyZS5pZCB9LnBkZmA7XG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZVJlY29yZCA9IGFzeW5jIChyZWNvcmQsIGFjY291bnQsIHNraXBUYWJsZUNoZWNrKSA9PiB7XG4gICAgaWYgKCFza2lwVGFibGVDaGVjayAmJiAhdGhpcy5yb290VGFibGVFeGlzdHMocmVjb3JkLmZvcm0pKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKHJlY29yZC5mb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubXNDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc0N1c3RvbU1vZHVsZS5zaG91bGRVcGRhdGVSZWNvcmQgJiYgIXRoaXMubXNDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlUmVjb3JkKHtyZWNvcmQsIGFjY291bnR9KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy51cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5tYXAobyA9PiBvLnNxbCkuam9pbignXFxuJykpO1xuXG4gICAgY29uc3Qgc3lzdGVtVmFsdWVzID0gTVNTUUxSZWNvcmRWYWx1ZXMuc3lzdGVtQ29sdW1uVmFsdWVzRm9yRmVhdHVyZShyZWNvcmQsIG51bGwsIHJlY29yZCwgdGhpcy5yZWNvcmRWYWx1ZU9wdGlvbnMpO1xuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVPYmplY3QoU2NoZW1hTWFwLnJlY29yZChyZWNvcmQsIHN5c3RlbVZhbHVlcyksICdyZWNvcmRzJyk7XG4gIH1cblxuICByb290VGFibGVFeGlzdHMgPSAoZm9ybSkgPT4ge1xuICAgIHJldHVybiB0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZihNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtKSkgIT09IC0xO1xuICB9XG5cbiAgcmVjcmVhdGVGb3JtVGFibGVzID0gYXN5bmMgKGZvcm0sIGFjY291bnQpID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSksIG51bGwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3Ioc3FsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgbnVsbCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSk7XG4gIH1cblxuICB1cGRhdGVGb3JtID0gYXN5bmMgKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pID0+IHtcbiAgICBpZiAodGhpcy5tc0N1c3RvbU1vZHVsZSAmJiB0aGlzLm1zQ3VzdG9tTW9kdWxlLnNob3VsZFVwZGF0ZUZvcm0gJiYgIXRoaXMubXNDdXN0b21Nb2R1bGUuc2hvdWxkVXBkYXRlRm9ybSh7Zm9ybSwgYWNjb3VudH0pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybU9iamVjdChmb3JtLCBhY2NvdW50KTtcblxuICAgICAgaWYgKCF0aGlzLnJvb3RUYWJsZUV4aXN0cyhmb3JtKSAmJiBuZXdGb3JtICE9IG51bGwpIHtcbiAgICAgICAgb2xkRm9ybSA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHtzdGF0ZW1lbnRzfSA9IGF3YWl0IE1TU1FMU2NoZW1hLmdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtLCB0aGlzLmRpc2FibGVBcnJheXMsXG4gICAgICAgIGZhbHNlIC8qIGRpc2FibGVDb21wbGV4VHlwZXMgKi8sIHRoaXMubXNDdXN0b21Nb2R1bGUsIHRoaXMuZGF0YVNjaGVtYSk7XG5cbiAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMucnVuQWxsKFsnQkVHSU4gVFJBTlNBQ1RJT047JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAuLi5zdGF0ZW1lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICdDT01NSVQgVFJBTlNBQ1RJT047J10pO1xuXG4gICAgICBpZiAobmV3Rm9ybSkge1xuICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICAgIHRocm93IGV4O1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0RST1AgVklFVyBJRiBFWElTVFMgJXMuJXM7JywgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksIHRoaXMuZXNjYXBlSWRlbnRpZmllcih2aWV3TmFtZSkpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBjcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gdGhpcy5nZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0NSRUFURSBWSUVXICVzLiVzIEFTIFNFTEVDVCAqIEZST00gJXMuJXNfdmlld19mdWxsOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHRoaXMudmlld1NjaGVtYSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lc2NhcGVJZGVudGlmaWVyKHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVzY2FwZUlkZW50aWZpZXIodGhpcy5kYXRhU2NoZW1hKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtLCByZXBlYXRhYmxlKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgICAgdGhpcy5pbnRlZ3JpdHlXYXJuaW5nKGV4KTtcbiAgICB9XG4gIH1cblxuICBnZXRGcmllbmRseVRhYmxlTmFtZShmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3QgbmFtZSA9IHJlcGVhdGFibGUgPyBgJHtmb3JtLm5hbWV9IC0gJHtyZXBlYXRhYmxlLmRhdGFOYW1lfWAgOiBmb3JtLm5hbWU7XG5cbiAgICByZXR1cm4gZnVsY3J1bS5hcmdzLm1zVW5kZXJzY29yZU5hbWVzID8gc25ha2UobmFtZSkgOiBuYW1lO1xuICB9XG5cbiAgYXN5bmMgaW52b2tlQmVmb3JlRnVuY3Rpb24oKSB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc0JlZm9yZUZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zQmVmb3JlRnVuY3Rpb24pKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubXNDdXN0b21Nb2R1bGUgJiYgdGhpcy5tc0N1c3RvbU1vZHVsZS5iZWZvcmVTeW5jKSB7XG4gICAgICBhd2FpdCB0aGlzLm1zQ3VzdG9tTW9kdWxlLmJlZm9yZVN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBpbnZva2VBZnRlckZ1bmN0aW9uKCkge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNBZnRlckZ1bmN0aW9uKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0VYRUNVVEUgJXM7JywgZnVsY3J1bS5hcmdzLm1zQWZ0ZXJGdW5jdGlvbikpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tc0N1c3RvbU1vZHVsZSAmJiB0aGlzLm1zQ3VzdG9tTW9kdWxlLmFmdGVyU3luYykge1xuICAgICAgYXdhaXQgdGhpcy5tc0N1c3RvbU1vZHVsZS5hZnRlclN5bmMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCBwcm9ncmVzcykge1xuICAgIGF3YWl0IHRoaXMucmVjcmVhdGVGb3JtVGFibGVzKGZvcm0sIGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIHByb2dyZXNzKGluZGV4KTtcbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGcmllbmRseVZpZXdzKGZvcm0sIGFjY291bnQpIHtcbiAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG4gIH1cblxuICBmb3JtVmVyc2lvbiA9IChmb3JtKSA9PiB7XG4gICAgaWYgKGZvcm0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcbiAgfVxuXG4gIHVwZGF0ZVN0YXR1cyA9IChtZXNzYWdlKSA9PiB7XG4gICAgaWYgKHByb2Nlc3Muc3Rkb3V0LmlzVFRZKSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUobWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcFN5c3RlbVRhYmxlcygpIHtcbiAgICBhd2FpdCB0aGlzLnJ1bkFsbCh0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodGVtcGxhdGVEcm9wKSk7XG4gIH1cblxuICBhc3luYyBzZXR1cERhdGFiYXNlKCkge1xuICAgIC8vIGNvbnNvbGUubG9nKCdTQ1JJUFRcXG4nLCB0aGlzLnByZXBhcmVNaWdyYXRpb25TY3JpcHQodmVyc2lvbjAwMSkpO1xuICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdCh2ZXJzaW9uMDAxKSk7XG4gIH1cblxuICBwcmVwYXJlTWlncmF0aW9uU2NyaXB0KHNxbCkge1xuICAgIHJldHVybiBzcWwucmVwbGFjZSgvX19TQ0hFTUFfXy9nLCB0aGlzLmRhdGFTY2hlbWEpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9fX1ZJRVdfU0NIRU1BX18vZywgdGhpcy52aWV3U2NoZW1hKS5zcGxpdCgnOycpO1xuICB9XG5cbiAgYXN5bmMgc2V0dXBTeXN0ZW1UYWJsZXMoYWNjb3VudCkge1xuICAgIGNvbnN0IHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhuYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCk7XG4gICAgfTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hQaG90byh7fSwgYXN5bmMgKHBob3RvLCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdQaG90b3MnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUGhvdG8ocGhvdG8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaFZpZGVvKHt9LCBhc3luYyAodmlkZW8sIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ1ZpZGVvcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVWaWRlbyh2aWRlbywgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQXVkaW8oe30sIGFzeW5jIChhdWRpbywge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQXVkaW8nLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlQXVkaW8oYXVkaW8sIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaENoYW5nZXNldCh7fSwgYXN5bmMgKGNoYW5nZXNldCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hhbmdlc2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDaGFuZ2VzZXQoY2hhbmdlc2V0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hSb2xlKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdSb2xlcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSb2xlKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoUHJvamVjdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnUHJvamVjdHMnLCBpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgYWNjb3VudC5maW5kRWFjaEZvcm0oe30sIGFzeW5jIChvYmplY3QsIHtpbmRleH0pID0+IHtcbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoJ0Zvcm1zJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm1PYmplY3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hNZW1iZXJzaGlwKHt9LCBhc3luYyAob2JqZWN0LCB7aW5kZXh9KSA9PiB7XG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKCdNZW1iZXJzaGlwcycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVNZW1iZXJzaGlwKG9iamVjdCwgYWNjb3VudCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBhY2NvdW50LmZpbmRFYWNoQ2hvaWNlTGlzdCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2hvaWNlIExpc3RzJywgaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUNob2ljZUxpc3Qob2JqZWN0LCBhY2NvdW50KTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFjY291bnQuZmluZEVhY2hDbGFzc2lmaWNhdGlvblNldCh7fSwgYXN5bmMgKG9iamVjdCwge2luZGV4fSkgPT4ge1xuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcygnQ2xhc3NpZmljYXRpb24gU2V0cycsIGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVDbGFzc2lmaWNhdGlvblNldChvYmplY3QsIGFjY291bnQpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgbWF5YmVJbml0aWFsaXplKCkge1xuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmICh0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZignbWlncmF0aW9ucycpID09PSAtMSkge1xuICAgICAgY29uc29sZS5sb2coJ0luaXRpdGFsaXppbmcgZGF0YWJhc2UuLi4nKTtcblxuICAgICAgYXdhaXQgdGhpcy5zZXR1cERhdGFiYXNlKCk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5tYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCk7XG4gIH1cblxuICBhc3luYyBtYXliZVJ1bk1pZ3JhdGlvbnMoYWNjb3VudCkge1xuICAgIHRoaXMubWlncmF0aW9ucyA9IChhd2FpdCB0aGlzLnJ1bihgU0VMRUNUIG5hbWUgRlJPTSAkeyB0aGlzLmRhdGFTY2hlbWEgfS5taWdyYXRpb25zYCkpLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9uKCcwMDInLCBhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLm1heWJlUnVuTWlncmF0aW9uKCcwMDMnLCBhY2NvdW50KTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlUnVuTWlncmF0aW9uKHZlcnNpb24sIGFjY291bnQpIHtcbiAgICBpZiAodGhpcy5taWdyYXRpb25zLmluZGV4T2YodmVyc2lvbikgPT09IC0xICYmIE1JR1JBVElPTlNbdmVyc2lvbl0pIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuQWxsKHRoaXMucHJlcGFyZU1pZ3JhdGlvblNjcmlwdChNSUdSQVRJT05TW3ZlcnNpb25dKSk7XG5cbiAgICAgIGlmICh2ZXJzaW9uID09PSAnMDAyJykge1xuICAgICAgICBjb25zb2xlLmxvZygnUG9wdWxhdGluZyBzeXN0ZW0gdGFibGVzLi4uJyk7XG5cbiAgICAgICAgLy8gYXdhaXQgdGhpcy5zZXR1cFN5c3RlbVRhYmxlcyhhY2NvdW50KTtcbiAgICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZVJlY29yZHMoYWNjb3VudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcG9wdWxhdGVSZWNvcmRzKGFjY291bnQpIHtcbiAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgIGluZGV4ID0gMDtcblxuICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMucHJvZ3Jlc3MoZm9ybS5uYW1lLCBpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIGZhbHNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByb2dyZXNzID0gKG5hbWUsIGluZGV4KSA9PiB7XG4gICAgdGhpcy51cGRhdGVTdGF0dXMobmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQpO1xuICB9XG59XG4iXX0=