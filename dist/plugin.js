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
  host: 'fulcrumsql.cftaomirowsd.us-east-1.rds.amazonaws.com',
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsImhvc3QiLCJwb3J0IiwibWF4IiwiaWRsZVRpbWVvdXRNaWxsaXMiLCJydW5Db21tYW5kIiwiZnVsY3J1bSIsImFyZ3MiLCJzZXR1cCIsImNyZWF0ZURhdGFiYXNlIiwibXNkYXRhYmFzZSIsImFjdGl2YXRlIiwiYWNjb3VudCIsImZldGNoQWNjb3VudCIsIm9yZyIsImZvcm1zIiwiZmluZEFjdGl2ZUZvcm1zIiwiZm9ybSIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJwcm9jZXNzIiwic3Rkb3V0IiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsIm5hbWUiLCJncmVlbiIsInRvU3RyaW5nIiwicmVkIiwiY29uc29sZSIsImxvZyIsImVycm9yIiwiaWRlbnQiLCJydW4iLCJzcWwiLCJyZXBsYWNlIiwiZGVidWciLCJyZXN1bHQiLCJwb29sIiwicmVxdWVzdCIsImJhdGNoIiwicmVjb3Jkc2V0IiwidGFibGVOYW1lIiwicm93SUQiLCJvbkZvcm1TYXZlIiwib2xkRm9ybSIsIm5ld0Zvcm0iLCJ1cGRhdGVGb3JtIiwib25SZWNvcmRTYXZlIiwicmVjb3JkIiwidXBkYXRlUmVjb3JkIiwib25SZWNvcmREZWxldGUiLCJzdGF0ZW1lbnRzIiwiZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyIsIm1zc3FsIiwic3RhdGVtZW50IiwibyIsIm9uQ2hvaWNlTGlzdFNhdmUiLCJvYmplY3QiLCJvbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSIsIm9uUHJvamVjdFNhdmUiLCJyZWxvYWRUYWJsZUxpc3QiLCJyb3dzIiwidGFibGVOYW1lcyIsIm1hcCIsInNraXBUYWJsZUNoZWNrIiwicm9vdFRhYmxlRXhpc3RzIiwidXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyIsImluZGV4T2YiLCJ0YWJsZU5hbWVXaXRoRm9ybSIsInJlY3JlYXRlRm9ybVRhYmxlcyIsImZvcm1WZXJzaW9uIiwiZXgiLCJnZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMiLCJkcm9wRnJpZW5kbHlWaWV3IiwicmVwZWF0YWJsZSIsImVsZW1lbnRzT2ZUeXBlIiwiY3JlYXRlRnJpZW5kbHlWaWV3IiwiaWQiLCJfaWQiLCJyb3dfaWQiLCJfbmFtZSIsImVsZW1lbnRzIiwiX2VsZW1lbnRzSlNPTiIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJ0eXBlIiwiZGVmYXVsdCIsIm1zaG9zdCIsIm1zcG9ydCIsIm1zdXNlciIsIm1zcGFzc3dvcmQiLCJtc3NjaGVtYSIsInJlcXVpcmVkIiwiaGFuZGxlciIsIm9wdGlvbnMiLCJjb25uZWN0aW9uT3B0aW9ucyIsImNvbm5lY3QiLCJvbiIsImRhdGFTY2hlbWEiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJ2aWV3TmFtZSIsImRhdGFOYW1lIiwicHJvZ3Jlc3MiLCJmaW5kRWFjaFJlY29yZCIsInNlcnZlciIsInVzZXIiLCJwYXNzd29yZCIsImVuY3J5cHQiLCJkYXRhYmFzZU5hbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztBQUVBLE1BQU1BLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsUUFBTSxxREFGYTtBQUduQkMsUUFBTSxJQUhhO0FBSW5CQyxPQUFLLEVBSmM7QUFLbkJDLHFCQUFtQjtBQUxBLENBQXJCOztrQkFRZSxNQUFNO0FBQUE7QUFBQTs7QUFBQSxTQStDbkJDLFVBL0NtQixxQkErQ04sYUFBWTtBQUN2QixVQUFJQyxRQUFRQyxJQUFSLENBQWFDLEtBQWpCLEVBQXdCO0FBQ3RCLGNBQU0sTUFBS0MsY0FBTCxDQUFvQkgsUUFBUUMsSUFBUixDQUFhRyxVQUFiLElBQTJCLFlBQS9DLENBQU47QUFDQTtBQUNEOztBQUVELFlBQU0sTUFBS0MsUUFBTCxFQUFOOztBQUVBLFlBQU1DLFVBQVUsTUFBTU4sUUFBUU8sWUFBUixDQUFxQlAsUUFBUUMsSUFBUixDQUFhTyxHQUFs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QUFiLElBQXVCOUYsYUFBYStHLElBTHRDO0FBTUpDLGdCQUFVekcsUUFBUUMsSUFBUixDQUFhdUYsVUFBYixJQUEyQi9GLGFBQWFnSCxRQU45QztBQU9KYixlQUFTO0FBQ1BjLGlCQUFTLElBREYsQ0FDTztBQURQO0FBUEwsTUFBTjs7QUFZQSxRQUFJMUcsUUFBUUMsSUFBUixDQUFhc0YsTUFBakIsRUFBeUI7QUFDdkJLLGNBQVFZLElBQVIsR0FBZXhHLFFBQVFDLElBQVIsQ0FBYXNGLE1BQTVCO0FBQ0Q7O0FBRUQsUUFBSXZGLFFBQVFDLElBQVIsQ0FBYXVGLFVBQWpCLEVBQTZCO0FBQzNCSSxjQUFRYSxRQUFSLEdBQW1CekcsUUFBUUMsSUFBUixDQUFhdUYsVUFBaEM7QUFDRDs7QUFFRCxXQUFPSSxPQUFQO0FBQ0Q7O0FBRUt6RixnQkFBTixDQUFxQndHLFlBQXJCLEVBQW1DO0FBQUE7O0FBQUE7QUFDakMsWUFBTWYsVUFBVSxPQUFLQyxpQkFBckI7O0FBRUFELGNBQVFsRyxRQUFSLEdBQW1CLElBQW5COztBQUVBLGFBQUtzQyxJQUFMLEdBQVksTUFBTSxnQkFBTThELE9BQU4sQ0FBY0YsT0FBZCxDQUFsQjs7QUFFQSxZQUFNaEUsTUFBTyxtQkFBa0IrRSxZQUFhLEVBQTVDOztBQUVBcEYsY0FBUUMsR0FBUixDQUFZSSxHQUFaOztBQUVBLFlBQU00QixPQUFPLE1BQU0sT0FBSzdCLEdBQUwsQ0FBVSxtQkFBa0JnRixZQUFhLEVBQXpDLENBQW5CO0FBWGlDO0FBWWxDO0FBdFRrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtc3NxbCBmcm9tICdtc3NxbCc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICd1dGlsJztcbmltcG9ydCBNU1NRTFNjaGVtYSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBNU1NRTCB9IGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IE1TU1FMUmVjb3JkVmFsdWVzIGZyb20gJy4vbXNzcWwtcmVjb3JkLXZhbHVlcyc7XG5cbmNvbnN0IE1TU1FMX0NPTkZJRyA9IHtcbiAgZGF0YWJhc2U6ICdmdWxjcnVtYXBwJyxcbiAgaG9zdDogJ2Z1bGNydW1zcWwuY2Z0YW9taXJvd3NkLnVzLWVhc3QtMS5yZHMuYW1hem9uYXdzLmNvbScsXG4gIHBvcnQ6IDE0MzMsXG4gIG1heDogMTAsXG4gIGlkbGVUaW1lb3V0TWlsbGlzOiAzMDAwMFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAnbXNzcWwnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgTVNTUUwgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBtc2RhdGFiYXNlOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGRhdGFiYXNlIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5kYXRhYmFzZVxuICAgICAgICB9LFxuICAgICAgICBtc2hvc3Q6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgc2VydmVyIGhvc3QnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5ob3N0XG4gICAgICAgIH0sXG4gICAgICAgIG1zcG9ydDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgcG9ydCcsXG4gICAgICAgICAgdHlwZTogJ2ludGVnZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IE1TU1FMX0NPTkZJRy5wb3J0XG4gICAgICAgIH0sXG4gICAgICAgIG1zdXNlcjoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCB1c2VyJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3Bhc3N3b3JkOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHBhc3N3b3JkJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtc3NjaGVtYToge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzY2hlbWEnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHNldHVwOiB7XG4gICAgICAgICAgZGVzYzogJ3NldHVwIHRoZSBkYXRhYmFzZScsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nXG4gICAgICAgIH0sXG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLnNldHVwKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZURhdGFiYXNlKGZ1bGNydW0uYXJncy5tc2RhdGFiYXNlIHx8ICdmdWxjcnVtYXBwJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kQWN0aXZlRm9ybXMoe30pO1xuXG4gICAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCAoaW5kZXgpID0+IHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShmb3JtLm5hbWUuZ3JlZW4gKyAnIDogJyArIGluZGV4LnRvU3RyaW5nKCkucmVkICsgJyByZWNvcmRzJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLmNvbm5lY3Rpb25PcHRpb25zO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChvcHRpb25zKVxuXG4gICAgLy8gZnVsY3J1bS5vbignY2hvaWNlX2xpc3Q6c2F2ZScsIHRoaXMub25DaG9pY2VMaXN0U2F2ZSk7XG4gICAgLy8gZnVsY3J1bS5vbignY2xhc3NpZmljYXRpb25fc2V0OnNhdmUnLCB0aGlzLm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlKTtcbiAgICAvLyBmdWxjcnVtLm9uKCdwcm9qZWN0OnNhdmUnLCB0aGlzLm9uUHJvamVjdFNhdmUpO1xuICAgIGZ1bGNydW0ub24oJ2Zvcm06c2F2ZScsIHRoaXMub25Gb3JtU2F2ZSk7XG4gICAgZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gICAgZnVsY3J1bS5vbigncmVjb3JkOmRlbGV0ZScsIHRoaXMub25SZWNvcmREZWxldGUpO1xuXG4gICAgLy8gRmV0Y2ggYWxsIHRoZSBleGlzdGluZyB0YWJsZXMgb24gc3RhcnR1cC4gVGhpcyBhbGxvd3MgdXMgdG8gc3BlY2lhbCBjYXNlIHRoZVxuICAgIC8vIGNyZWF0aW9uIG9mIG5ldyB0YWJsZXMgZXZlbiB3aGVuIHRoZSBmb3JtIGlzbid0IHZlcnNpb24gMS4gSWYgdGhlIHRhYmxlIGRvZXNuJ3RcbiAgICAvLyBleGlzdCwgd2UgY2FuIHByZXRlbmQgdGhlIGZvcm0gaXMgdmVyc2lvbiAxIHNvIGl0IGNyZWF0ZXMgYWxsIG5ldyB0YWJsZXMgaW5zdGVhZFxuICAgIC8vIG9mIGFwcGx5aW5nIGEgc2NoZW1hIGRpZmYuXG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKFwiU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSdkYm8nXCIpO1xuXG4gICAgdGhpcy5kYXRhU2NoZW1hID0gZnVsY3J1bS5hcmdzLm1zc2NoZW1hIHx8ICdkYm8nO1xuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcblxuICAgIC8vIG1ha2UgYSBjbGllbnQgc28gd2UgY2FuIHVzZSBpdCB0byBidWlsZCBTUUwgc3RhdGVtZW50c1xuICAgIHRoaXMubXNzcWwgPSBuZXcgTVNTUUwoe30pO1xuICB9XG5cbiAgYXN5bmMgZGVhY3RpdmF0ZSgpIHtcbiAgICBpZiAodGhpcy5wb29sKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvb2wuY2xvc2UoKTtcbiAgICB9XG4gIH1cblxuICBpZGVudCA9IChuYW1lKSA9PiB7XG4gICAgcmV0dXJuICdbJyArIG5hbWUgKyAnXSc7XG4gIH1cblxuICBydW4gPSBhc3luYyAoc3FsKSA9PiB7XG4gICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcMC9nLCAnJyk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICBjb25zb2xlLmxvZyhzcWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucG9vbC5yZXF1ZXN0KCkuYmF0Y2goc3FsKTtcblxuICAgIHJldHVybiByZXN1bHQucmVjb3Jkc2V0O1xuICB9XG5cbiAgbG9nID0gKC4uLmFyZ3MpID0+IHtcbiAgICAvLyBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfVxuXG4gIHRhYmxlTmFtZSA9IChhY2NvdW50LCBuYW1lKSA9PiB7XG4gICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcbiAgfVxuXG4gIG9uRm9ybVNhdmUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm19KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkLCByZWNvcmQuZm9ybSk7XG5cbiAgICBmb3IgKGNvbnN0IHN0YXRlbWVudCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihvLnNxbCk7XG4gICAgfVxuICB9XG5cbiAgb25DaG9pY2VMaXN0U2F2ZSA9IGFzeW5jICh7b2JqZWN0fSkgPT4ge1xuICB9XG5cbiAgb25DbGFzc2lmaWNhdGlvblNldFNhdmUgPSBhc3luYyAoe29iamVjdH0pID0+IHtcbiAgfVxuXG4gIG9uUHJvamVjdFNhdmUgPSBhc3luYyAoe29iamVjdH0pID0+IHtcbiAgfVxuXG4gIHJlbG9hZFRhYmxlTGlzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oXCJTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9J3B1YmxpYydcIik7XG5cbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG4gIH1cblxuICB1cGRhdGVSZWNvcmQgPSBhc3luYyAocmVjb3JkLCBhY2NvdW50LCBza2lwVGFibGVDaGVjaykgPT4ge1xuICAgIGlmICghc2tpcFRhYmxlQ2hlY2sgJiYgIXRoaXMucm9vdFRhYmxlRXhpc3RzKHJlY29yZC5mb3JtKSkge1xuICAgICAgYXdhaXQgdGhpcy5yZWJ1aWxkRm9ybShyZWNvcmQuZm9ybSwgYWNjb3VudCwgKCkgPT4ge30pO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy51cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCk7XG5cbiAgICBmb3IgKGNvbnN0IHN0YXRlbWVudCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnQuc3FsKTtcbiAgICB9XG4gIH1cblxuICByb290VGFibGVFeGlzdHMgPSAoZm9ybSkgPT4ge1xuICAgIHJldHVybiB0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZihNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtKSkgIT09IC0xO1xuICB9XG5cbiAgcmVjcmVhdGVGb3JtVGFibGVzID0gYXN5bmMgKGZvcm0sIGFjY291bnQpID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSksIG51bGwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3Ioc3FsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgbnVsbCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSk7XG4gIH1cblxuICB1cGRhdGVGb3JtID0gYXN5bmMgKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pID0+IHtcbiAgICBpZiAoIXRoaXMucm9vdFRhYmxlRXhpc3RzKGZvcm0pICYmIG5ld0Zvcm0gIT0gbnVsbCkge1xuICAgICAgb2xkRm9ybSA9IG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qge3N0YXRlbWVudHN9ID0gYXdhaXQgTVNTUUxTY2hlbWEuZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzKGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pO1xuXG4gICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc3FsIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKHNxbCk7XG4gICAgfVxuICAgIC8vIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMuam9pbignXFxuJykpO1xuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHJlcGVhdGFibGUgPyBgJHtmb3JtLm5hbWV9IC0gJHtyZXBlYXRhYmxlLmRhdGFOYW1lfWAgOiBmb3JtLm5hbWU7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdEUk9QIFZJRVcgSUYgRVhJU1RTICVzLiVzOycsIHRoaXMuaWRlbnQodGhpcy5kYXRhU2NoZW1hKSwgdGhpcy5pZGVudCh2aWV3TmFtZSkpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBjb25zb2xlLmVycm9yKGV4KTtcbiAgICAgIH1cbiAgICAgIC8vIHNvbWV0aW1lcyBpdCBkb2Vzbid0IGV4aXN0XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHJlcGVhdGFibGUgPyBgJHtmb3JtLm5hbWV9IC0gJHtyZXBlYXRhYmxlLmRhdGFOYW1lfWAgOiBmb3JtLm5hbWU7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdDUkVBVEUgVklFVyAlcy4lcyBBUyBTRUxFQ1QgKiBGUk9NICVzX3ZpZXdfZnVsbDsnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaWRlbnQodGhpcy5kYXRhU2NoZW1hKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmlkZW50KHZpZXdOYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNU1NRTFJlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtLCByZXBlYXRhYmxlKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXgpO1xuICAgICAgfVxuICAgICAgLy8gc29tZXRpbWVzIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICB9XG4gIH1cblxuICBhc3luYyByZWJ1aWxkRm9ybShmb3JtLCBhY2NvdW50LCBwcm9ncmVzcykge1xuICAgIGF3YWl0IHRoaXMucmVjcmVhdGVGb3JtVGFibGVzKGZvcm0sIGFjY291bnQpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkVGFibGVMaXN0KCk7XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgcmVjb3JkLmZvcm0gPSBmb3JtO1xuXG4gICAgICBpZiAoKytpbmRleCAlIDEwID09PSAwKSB7XG4gICAgICAgIHByb2dyZXNzKGluZGV4KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIHByb2dyZXNzKGluZGV4KTtcbiAgfVxuXG4gIGZvcm1WZXJzaW9uID0gKGZvcm0pID0+IHtcbiAgICBpZiAoZm9ybSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGZvcm0uX2lkLFxuICAgICAgcm93X2lkOiBmb3JtLnJvd0lELFxuICAgICAgbmFtZTogZm9ybS5fbmFtZSxcbiAgICAgIGVsZW1lbnRzOiBmb3JtLl9lbGVtZW50c0pTT05cbiAgICB9O1xuICB9XG5cbiAgZ2V0IGNvbm5lY3Rpb25PcHRpb25zKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAuLi5NU1NRTF9DT05GSUcsXG4gICAgICBzZXJ2ZXI6IGZ1bGNydW0uYXJncy5tc2hvc3QgfHwgTVNTUUxfQ09ORklHLmhvc3QsXG4gICAgICBwb3J0OiBmdWxjcnVtLmFyZ3MubXNwb3J0IHx8IE1TU1FMX0NPTkZJRy5wb3J0LFxuICAgICAgZGF0YWJhc2U6IGZ1bGNydW0uYXJncy5tc2RhdGFiYXNlIHx8IE1TU1FMX0NPTkZJRy5kYXRhYmFzZSxcbiAgICAgIHVzZXI6IGZ1bGNydW0uYXJncy5tc3VzZXIgfHwgTVNTUUxfQ09ORklHLnVzZXIsXG4gICAgICBwYXNzd29yZDogZnVsY3J1bS5hcmdzLm1zcGFzc3dvcmQgfHwgTVNTUUxfQ09ORklHLnBhc3N3b3JkLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBlbmNyeXB0OiB0cnVlIC8vIFVzZSB0aGlzIGlmIHlvdSdyZSBvbiBXaW5kb3dzIEF6dXJlXG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXN1c2VyKSB7XG4gICAgICBvcHRpb25zLnVzZXIgPSBmdWxjcnVtLmFyZ3MubXN1c2VyO1xuICAgIH1cblxuICAgIGlmIChmdWxjcnVtLmFyZ3MubXNwYXNzd29yZCkge1xuICAgICAgb3B0aW9ucy5wYXNzd29yZCA9IGZ1bGNydW0uYXJncy5tc3Bhc3N3b3JkO1xuICAgIH1cblxuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG5cbiAgYXN5bmMgY3JlYXRlRGF0YWJhc2UoZGF0YWJhc2VOYW1lKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuY29ubmVjdGlvbk9wdGlvbnM7XG5cbiAgICBvcHRpb25zLmRhdGFiYXNlID0gbnVsbDtcblxuICAgIHRoaXMucG9vbCA9IGF3YWl0IG1zc3FsLmNvbm5lY3Qob3B0aW9ucylcblxuICAgIGNvbnN0IHNxbCA9IGBDUkVBVEUgREFUQUJBU0UgJHtkYXRhYmFzZU5hbWV9YDtcblxuICAgIGNvbnNvbGUubG9nKHNxbCk7XG5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX1gKTtcbiAgfVxufVxuIl19