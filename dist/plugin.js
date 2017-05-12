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

var _mssqlRecordValues = require('./mssql-record-values');

var _mssqlRecordValues2 = _interopRequireDefault(_mssqlRecordValues);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const MSSQL_CONFIG = {
  database: 'fulcrumapp',
  host: 'localhost',
  port: 1433,
  max: 10,
  idleTimeoutMillis: 30000
};

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
      if (fulcrum.args.setup) {
        yield _this.createDatabase(fulcrum.args.msdatabase || 'fulcrumapp');
        return;
      }

      yield _this.activate();

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (account) {
        const forms = yield account.findActiveForms({});

        for (const form of forms) {
          yield _this.rebuildForm(form, account, function (index) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(form.name.green + ' : ' + index.toString().red + ' records');
          });

          console.log('');
        }
      } else {
        console.error('Unable to find account', fulcrum.args.org);
      }
    });

    this.ident = name => {
      return '[' + name + ']';
    };

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

    this.log = (...args) => {
      // console.log(...args);
    };

    this.tableName = (account, name) => {
      return 'account_' + account.rowID + '_' + name;
    };

    this.onFormSave = (() => {
      var _ref3 = _asyncToGenerator(function* ({ form, account, oldForm, newForm }) {
        yield _this.updateForm(form, account, oldForm, newForm);
      });

      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    })();

    this.onRecordSave = (() => {
      var _ref4 = _asyncToGenerator(function* ({ record, account }) {
        yield _this.updateRecord(record, account);
      });

      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    })();

    this.onRecordDelete = (() => {
      var _ref5 = _asyncToGenerator(function* ({ record }) {
        const statements = _mssqlRecordValues2.default.deleteForRecordStatements(_this.mssql, record, record.form);

        for (const statement of statements) {
          yield _this.run(o.sql);
        }
      });

      return function (_x4) {
        return _ref5.apply(this, arguments);
      };
    })();

    this.onChoiceListSave = (() => {
      var _ref6 = _asyncToGenerator(function* ({ object }) {});

      return function (_x5) {
        return _ref6.apply(this, arguments);
      };
    })();

    this.onClassificationSetSave = (() => {
      var _ref7 = _asyncToGenerator(function* ({ object }) {});

      return function (_x6) {
        return _ref7.apply(this, arguments);
      };
    })();

    this.onProjectSave = (() => {
      var _ref8 = _asyncToGenerator(function* ({ object }) {});

      return function (_x7) {
        return _ref8.apply(this, arguments);
      };
    })();

    this.reloadTableList = _asyncToGenerator(function* () {
      const rows = yield _this.run("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'");

      _this.tableNames = rows.map(function (o) {
        return o.name;
      });
    });

    this.updateRecord = (() => {
      var _ref10 = _asyncToGenerator(function* (record, account, skipTableCheck) {
        if (!skipTableCheck && !_this.rootTableExists(record.form)) {
          yield _this.rebuildForm(record.form, account, function () {});
        }

        const statements = _mssqlRecordValues2.default.updateForRecordStatements(_this.mssql, record);

        for (const statement of statements) {
          yield _this.run(statement.sql);
        }
      });

      return function (_x8, _x9, _x10) {
        return _ref10.apply(this, arguments);
      };
    })();

    this.rootTableExists = form => {
      return this.tableNames.indexOf(_mssqlRecordValues2.default.tableNameWithForm(form)) !== -1;
    };

    this.recreateFormTables = (() => {
      var _ref11 = _asyncToGenerator(function* (form, account) {
        try {
          yield _this.updateForm(form, account, _this.formVersion(form), null);
        } catch (ex) {
          if (fulcrum.args.debug) {
            console.error(sql);
          }
        }

        yield _this.updateForm(form, account, null, _this.formVersion(form));
      });

      return function (_x11, _x12) {
        return _ref11.apply(this, arguments);
      };
    })();

    this.updateForm = (() => {
      var _ref12 = _asyncToGenerator(function* (form, account, oldForm, newForm) {
        if (!_this.rootTableExists(form) && newForm != null) {
          oldForm = null;
        }

        const { statements } = yield _schema2.default.generateSchemaStatements(account, oldForm, newForm);

        yield _this.dropFriendlyView(form, null);

        for (const repeatable of form.elementsOfType('Repeatable')) {
          yield _this.dropFriendlyView(form, repeatable);
        }

        for (const sql of statements) {
          yield _this.run(sql);
        }
        // await this.run(statements.join('\n'));

        yield _this.createFriendlyView(form, null);

        for (const repeatable of form.elementsOfType('Repeatable')) {
          yield _this.createFriendlyView(form, repeatable);
        }
      });

      return function (_x13, _x14, _x15, _x16) {
        return _ref12.apply(this, arguments);
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
  }

  task(cli) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return cli.command({
        command: 'mssql',
        desc: 'run the MSSQL sync for a specific organization',
        builder: {
          msdatabase: {
            desc: 'mssql database name',
            type: 'string',
            default: MSSQL_CONFIG.database
          },
          mshost: {
            desc: 'mssql server host',
            type: 'string',
            default: MSSQL_CONFIG.host
          },
          msport: {
            desc: 'mssql server port',
            type: 'integer',
            default: MSSQL_CONFIG.port
          },
          msuser: {
            desc: 'mssql user',
            type: 'string'
          },
          mspassword: {
            desc: 'mssql password',
            type: 'string'
          },
          msschema: {
            desc: 'mssql schema',
            type: 'string'
          },
          setup: {
            desc: 'setup the database',
            type: 'boolean'
          },
          org: {
            desc: 'organization name',
            required: true,
            type: 'string'
          }
        },
        handler: _this2.runCommand
      });
    })();
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const options = _this3.connectionOptions;

      _this3.pool = yield _mssql2.default.connect(options);

      // fulcrum.on('choice_list:save', this.onChoiceListSave);
      // fulcrum.on('classification_set:save', this.onClassificationSetSave);
      // fulcrum.on('project:save', this.onProjectSave);
      fulcrum.on('form:save', _this3.onFormSave);
      fulcrum.on('record:save', _this3.onRecordSave);
      fulcrum.on('record:delete', _this3.onRecordDelete);

      // Fetch all the existing tables on startup. This allows us to special case the
      // creation of new tables even when the form isn't version 1. If the table doesn't
      // exist, we can pretend the form is version 1 so it creates all new tables instead
      // of applying a schema diff.
      const rows = yield _this3.run("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='dbo'");

      _this3.dataSchema = fulcrum.args.msschema || 'dbo';
      _this3.tableNames = rows.map(function (o) {
        return o.name;
      });

      // make a client so we can use it to build SQL statements
      _this3.mssql = new _fulcrumDesktopPlugin.MSSQL({});
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

  dropFriendlyView(form, repeatable) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const viewName = repeatable ? `${form.name} - ${repeatable.dataName}` : form.name;

      try {
        yield _this5.run((0, _util.format)('DROP VIEW IF EXISTS %s.%s;', _this5.ident(_this5.dataSchema), _this5.ident(viewName)));
      } catch (ex) {
        if (fulcrum.args.debug) {
          console.error(ex);
        }
        // sometimes it doesn't exist
      }
    })();
  }

  createFriendlyView(form, repeatable) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      const viewName = repeatable ? `${form.name} - ${repeatable.dataName}` : form.name;

      try {
        yield _this6.run((0, _util.format)('CREATE VIEW %s.%s AS SELECT * FROM %s_view_full;', _this6.ident(_this6.dataSchema), _this6.ident(viewName), _mssqlRecordValues2.default.tableNameWithForm(form, repeatable)));
      } catch (ex) {
        if (fulcrum.args.debug) {
          console.error(ex);
        }
        // sometimes it doesn't exist
      }
    })();
  }

  rebuildForm(form, account, progress) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      yield _this7.recreateFormTables(form, account);
      yield _this7.reloadTableList();

      let index = 0;

      yield form.findEachRecord({}, (() => {
        var _ref13 = _asyncToGenerator(function* (record) {
          record.form = form;

          if (++index % 10 === 0) {
            progress(index);
          }

          yield _this7.updateRecord(record, account, true);
        });

        return function (_x17) {
          return _ref13.apply(this, arguments);
        };
      })());

      progress(index);
    })();
  }

  get connectionOptions() {
    const options = _extends({}, MSSQL_CONFIG, {
      server: fulcrum.args.mshost || MSSQL_CONFIG.host,
      port: fulcrum.args.msport || MSSQL_CONFIG.port,
      database: fulcrum.args.msdatabase || MSSQL_CONFIG.database,
      user: fulcrum.args.msuser || MSSQL_CONFIG.user,
      password: fulcrum.args.mspassword || MSSQL_CONFIG.password,
      options: {
        encrypt: true // Use this if you're on Windows Azure
      }
    });

    if (fulcrum.args.msuser) {
      options.user = fulcrum.args.msuser;
    }

    if (fulcrum.args.mspassword) {
      options.password = fulcrum.args.mspassword;
    }

    return options;
  }

  createDatabase(databaseName) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      const options = _this8.connectionOptions;

      options.database = null;

      _this8.pool = yield _mssql2.default.connect(options);

      const sql = `CREATE DATABASE ${databaseName}`;

      console.log(sql);

      const rows = yield _this8.run(`CREATE DATABASE ${databaseName}`);
    })();
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsImhvc3QiLCJwb3J0IiwibWF4IiwiaWRsZVRpbWVvdXRNaWxsaXMiLCJydW5Db21tYW5kIiwiZnVsY3J1bSIsImFyZ3MiLCJzZXR1cCIsImNyZWF0ZURhdGFiYXNlIiwibXNkYXRhYmFzZSIsImFjdGl2YXRlIiwiYWNjb3VudCIsImZldGNoQWNjb3VudCIsIm9yZyIsImZvcm1zIiwiZmluZEFjdGl2ZUZvcm1zIiwiZm9ybSIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJwcm9jZXNzIiwic3Rkb3V0IiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsIm5hbWUiLCJncmVlbiIsInRvU3RyaW5nIiwicmVkIiwiY29uc29sZSIsImxvZyIsImVycm9yIiwiaWRlbnQiLCJydW4iLCJzcWwiLCJyZXBsYWNlIiwiZGVidWciLCJyZXN1bHQiLCJwb29sIiwicmVxdWVzdCIsImJhdGNoIiwicmVjb3Jkc2V0IiwidGFibGVOYW1lIiwicm93SUQiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25SZWNvcmRTYXZlIiwicmVjb3JkIiwidXBkYXRlUmVjb3JkIiwib25SZWNvcmREZWxldGUiLCJzdGF0ZW1lbnRzIiwiZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyIsIm1zc3FsIiwic3RhdGVtZW50IiwibyIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJvYmplY3QiLCJvbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSIsIm9uUHJvamVjdFNhdmUiLCJyZWxvYWRUYWJsZUxpc3QiLCJyb3dzIiwidGFibGVOYW1lcyIsIm1hcCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwidXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJnZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaWQiLCJfaWQiLCJyb3dfaWQiLCJfbmFtZSIsImVsZW1lbnRzIiwiX2VsZW1lbnRzSlNPTiIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJ0eXBlIiwiZGVmYXVsdCIsIm1zaG9zdCIsIm1zcG9ydCIsIm1zdXNlciIsIm1zcGFzc3dvcmQiLCJtc3NjaGVtYSIsInJlcXVpcmVkIiwiaGFuZGxlciIsIm9wdGlvbnMiLCJjb25uZWN0aW9uT3B0aW9ucyIsImNvbm5lY3QiLCJvbiIsImRhdGFTY2hlbWEiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJ2aWV3TmFtZSIsImRhdGFOYW1lIiwicHJvZ3Jlc3MiLCJmaW5kRWFjaFJlY29yZCIsInNlcnZlciIsInVzZXIiLCJwYXNzd29yZCIsImVuY3J5cHQiLCJkYXRhYmFzZU5hbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztBQUVBLE1BQU1BLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsUUFBTSxXQUZhO0FBR25CQyxRQUFNLElBSGE7QUFJbkJDLE9BQUssRUFKYztBQUtuQkMscUJBQW1CO0FBTEEsQ0FBckI7O2tCQVFlLE1BQU07QUFBQTtBQUFBOztBQUFBLFNBK0NuQkMsVUEvQ21CLHFCQStDTixhQUFZO0FBQ3ZCLFVBQUlDLFFBQVFDLElBQVIsQ0FBYUMsS0FBakIsRUFBd0I7QUFDdEIsY0FBTSxNQUFLQyxjQUFMLENBQW9CSCxRQUFRQyxJQUFSLENBQWFHLFVBQWIsSUFBMkIsWUFBL0MsQ0FBTjtBQUNBO0FBQ0Q7O0FBRUQsWUFBTSxNQUFLQyxRQUFMLEVBQU47O0FBRUEsWUFBTUMsVUFBVSxNQUFNTixRQUFRTyxZQUFSLENBQXFCUCxRQUFRQyxJQUFSLENBQWFPLEdBQWxD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QWIsSUFBdUI5RixhQUFhK0csSUFMdEM7QUFNSkMsZ0JBQVV6RyxRQUFRQyxJQUFSLENBQWF1RixVQUFiLElBQTJCL0YsYUFBYWdILFFBTjlDO0FBT0piLGVBQVM7QUFDUGMsaUJBQVMsSUFERixDQUNPO0FBRFA7QUFQTCxNQUFOOztBQVlBLFFBQUkxRyxRQUFRQyxJQUFSLENBQWFzRixNQUFqQixFQUF5QjtBQUN2QkssY0FBUVksSUFBUixHQUFleEcsUUFBUUMsSUFBUixDQUFhc0YsTUFBNUI7QUFDRDs7QUFFRCxRQUFJdkYsUUFBUUMsSUFBUixDQUFhdUYsVUFBakIsRUFBNkI7QUFDM0JJLGNBQVFhLFFBQVIsR0FBbUJ6RyxRQUFRQyxJQUFSLENBQWF1RixVQUFoQztBQUNEOztBQUVELFdBQU9JLE9BQVA7QUFDRDs7QUFFS3pGLGdCQUFOLENBQXFCd0csWUFBckIsRUFBbUM7QUFBQTs7QUFBQTtBQUNqQyxZQUFNZixVQUFVLE9BQUtDLGlCQUFyQjs7QUFFQUQsY0FBUWxHLFFBQVIsR0FBbUIsSUFBbkI7O0FBRUEsYUFBS3NDLElBQUwsR0FBWSxNQUFNLGdCQUFNOEQsT0FBTixDQUFjRixPQUFkLENBQWxCOztBQUVBLFlBQU1oRSxNQUFPLG1CQUFrQitFLFlBQWEsRUFBNUM7O0FBRUFwRixjQUFRQyxHQUFSLENBQVlJLEdBQVo7O0FBRUEsWUFBTTRCLE9BQU8sTUFBTSxPQUFLN0IsR0FBTCxDQUFVLG1CQUFrQmdGLFlBQWEsRUFBekMsQ0FBbkI7QUFYaUM7QUFZbEM7QUF0VGtCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1zc3FsIGZyb20gJ21zc3FsJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IE1TU1FMIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgTVNTUUxSZWNvcmRWYWx1ZXMgZnJvbSAnLi9tc3NxbC1yZWNvcmQtdmFsdWVzJztcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBob3N0OiAnbG9jYWxob3N0JyxcbiAgcG9ydDogMTQzMyxcbiAgbWF4OiAxMCxcbiAgaWRsZVRpbWVvdXRNaWxsaXM6IDMwMDAwXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXG4gICAgICBkZXNjOiAncnVuIHRoZSBNU1NRTCBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG1zZGF0YWJhc2U6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgZGF0YWJhc2UgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmRhdGFiYXNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zaG9zdDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgaG9zdCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcbiAgICAgICAgfSxcbiAgICAgICAgbXNwb3J0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcbiAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLnBvcnRcbiAgICAgICAgfSxcbiAgICAgICAgbXN1c2VyOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHVzZXInLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zcGFzc3dvcmQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc2NoZW1hOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgc2V0dXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2V0dXAgdGhlIGRhdGFiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbidcbiAgICAgICAgfSxcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChmdWxjcnVtLmFyZ3Muc2V0dXApIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zZGF0YWJhc2UgfHwgJ2Z1bGNydW1hcHAnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIChpbmRleCkgPT4ge1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGUoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuY29ubmVjdGlvbk9wdGlvbnM7XG5cbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KG9wdGlvbnMpXG5cbiAgICAvLyBmdWxjcnVtLm9uKCdjaG9pY2VfbGlzdDpzYXZlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcbiAgICAvLyBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbl9zZXQ6c2F2ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuICAgIC8vIGZ1bGNydW0ub24oJ3Byb2plY3Q6c2F2ZScsIHRoaXMub25Qcm9qZWN0U2F2ZSk7XG4gICAgZnVsY3J1bS5vbignZm9ybTpzYXZlJywgdGhpcy5vbkZvcm1TYXZlKTtcbiAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6ZGVsZXRlJywgdGhpcy5vblJlY29yZERlbGV0ZSk7XG5cbiAgICAvLyBGZXRjaCBhbGwgdGhlIGV4aXN0aW5nIHRhYmxlcyBvbiBzdGFydHVwLiBUaGlzIGFsbG93cyB1cyB0byBzcGVjaWFsIGNhc2UgdGhlXG4gICAgLy8gY3JlYXRpb24gb2YgbmV3IHRhYmxlcyBldmVuIHdoZW4gdGhlIGZvcm0gaXNuJ3QgdmVyc2lvbiAxLiBJZiB0aGUgdGFibGUgZG9lc24ndFxuICAgIC8vIGV4aXN0LCB3ZSBjYW4gcHJldGVuZCB0aGUgZm9ybSBpcyB2ZXJzaW9uIDEgc28gaXQgY3JlYXRlcyBhbGwgbmV3IHRhYmxlcyBpbnN0ZWFkXG4gICAgLy8gb2YgYXBwbHlpbmcgYSBzY2hlbWEgZGlmZi5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oXCJTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9J2RibydcIik7XG5cbiAgICB0aGlzLmRhdGFTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNzY2hlbWEgfHwgJ2Ribyc7XG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuXG4gICAgLy8gbWFrZSBhIGNsaWVudCBzbyB3ZSBjYW4gdXNlIGl0IHRvIGJ1aWxkIFNRTCBzdGF0ZW1lbnRzXG4gICAgdGhpcy5tc3NxbCA9IG5ldyBNU1NRTCh7fSk7XG4gIH1cblxuICBhc3luYyBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLnBvb2wpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIGlkZW50ID0gKG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ1snICsgbmFtZSArICddJztcbiAgfVxuXG4gIHJ1biA9IGFzeW5jIChzcWwpID0+IHtcbiAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFwwL2csICcnKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgIGNvbnNvbGUubG9nKHNxbCk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wb29sLnJlcXVlc3QoKS5iYXRjaChzcWwpO1xuXG4gICAgcmV0dXJuIHJlc3VsdC5yZWNvcmRzZXQ7XG4gIH1cblxuICBsb2cgPSAoLi4uYXJncykgPT4ge1xuICAgIC8vIGNvbnNvbGUubG9nKC4uLmFyZ3MpO1xuICB9XG5cbiAgdGFibGVOYW1lID0gKGFjY291bnQsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuICB9XG5cbiAgb25Gb3JtU2F2ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybX0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSk7XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQpO1xuICB9XG5cbiAgb25SZWNvcmREZWxldGUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMuZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHJlY29yZC5mb3JtKTtcblxuICAgIGZvciAoY29uc3Qgc3RhdGVtZW50IG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKG8uc3FsKTtcbiAgICB9XG4gIH1cblxuICBvbkNob2ljZUxpc3RTYXZlID0gYXN5bmMgKHtvYmplY3R9KSA9PiB7XG4gIH1cblxuICBvbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSA9IGFzeW5jICh7b2JqZWN0fSkgPT4ge1xuICB9XG5cbiAgb25Qcm9qZWN0U2F2ZSA9IGFzeW5jICh7b2JqZWN0fSkgPT4ge1xuICB9XG5cbiAgcmVsb2FkVGFibGVMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihcIlNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0ncHVibGljJ1wiKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIHVwZGF0ZVJlY29yZCA9IGFzeW5jIChyZWNvcmQsIGFjY291bnQsIHNraXBUYWJsZUNoZWNrKSA9PiB7XG4gICAgaWYgKCFza2lwVGFibGVDaGVjayAmJiAhdGhpcy5yb290VGFibGVFeGlzdHMocmVjb3JkLmZvcm0pKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKHJlY29yZC5mb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLnVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkKTtcblxuICAgIGZvciAoY29uc3Qgc3RhdGVtZW50IG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudC5zcWwpO1xuICAgIH1cbiAgfVxuXG4gIHJvb3RUYWJsZUV4aXN0cyA9IChmb3JtKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVOYW1lcy5pbmRleE9mKE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0pKSAhPT0gLTE7XG4gIH1cblxuICByZWNyZWF0ZUZvcm1UYWJsZXMgPSBhc3luYyAoZm9ybSwgYWNjb3VudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSwgbnVsbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihzcWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBudWxsLCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pKTtcbiAgfVxuXG4gIHVwZGF0ZUZvcm0gPSBhc3luYyAoZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSkgPT4ge1xuICAgIGlmICghdGhpcy5yb290VGFibGVFeGlzdHMoZm9ybSkgJiYgbmV3Rm9ybSAhPSBudWxsKSB7XG4gICAgICBvbGRGb3JtID0gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB7c3RhdGVtZW50c30gPSBhd2FpdCBNU1NRTFNjaGVtYS5nZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMoYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSk7XG5cbiAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oc3FsKTtcbiAgICB9XG4gICAgLy8gYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5qb2luKCdcXG4nKSk7XG5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gcmVwZWF0YWJsZSA/IGAke2Zvcm0ubmFtZX0gLSAke3JlcGVhdGFibGUuZGF0YU5hbWV9YCA6IGZvcm0ubmFtZTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0RST1AgVklFVyBJRiBFWElTVFMgJXMuJXM7JywgdGhpcy5pZGVudCh0aGlzLmRhdGFTY2hlbWEpLCB0aGlzLmlkZW50KHZpZXdOYW1lKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXgpO1xuICAgICAgfVxuICAgICAgLy8gc29tZXRpbWVzIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICB9XG4gIH1cblxuICBhc3luYyBjcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gcmVwZWF0YWJsZSA/IGAke2Zvcm0ubmFtZX0gLSAke3JlcGVhdGFibGUuZGF0YU5hbWV9YCA6IGZvcm0ubmFtZTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0NSRUFURSBWSUVXICVzLiVzIEFTIFNFTEVDVCAqIEZST00gJXNfdmlld19mdWxsOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pZGVudCh0aGlzLmRhdGFTY2hlbWEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaWRlbnQodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0sIHJlcGVhdGFibGUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihleCk7XG4gICAgICB9XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIHByb2dyZXNzKSB7XG4gICAgYXdhaXQgdGhpcy5yZWNyZWF0ZUZvcm1UYWJsZXMoZm9ybSwgYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRUYWJsZUxpc3QoKTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIHRydWUpO1xuICAgIH0pO1xuXG4gICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cblxuICBnZXQgY29ubmVjdGlvbk9wdGlvbnMoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zaG9zdCB8fCBNU1NRTF9DT05GSUcuaG9zdCxcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc3BvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zZGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zdXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNwYXNzd29yZCB8fCBNU1NRTF9DT05GSUcucGFzc3dvcmQsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGVuY3J5cHQ6IHRydWUgLy8gVXNlIHRoaXMgaWYgeW91J3JlIG9uIFdpbmRvd3MgQXp1cmVcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3VzZXIpIHtcbiAgICAgIG9wdGlvbnMudXNlciA9IGZ1bGNydW0uYXJncy5tc3VzZXI7XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc3Bhc3N3b3JkKSB7XG4gICAgICBvcHRpb25zLnBhc3N3b3JkID0gZnVsY3J1bS5hcmdzLm1zcGFzc3dvcmQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cblxuICBhc3luYyBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5jb25uZWN0aW9uT3B0aW9ucztcblxuICAgIG9wdGlvbnMuZGF0YWJhc2UgPSBudWxsO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChvcHRpb25zKVxuXG4gICAgY29uc3Qgc3FsID0gYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX1gO1xuXG4gICAgY29uc29sZS5sb2coc3FsKTtcblxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgQ1JFQVRFIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfWApO1xuICB9XG59XG4iXX0=