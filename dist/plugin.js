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
        yield _this.createDatabase(fulcrum.args.msDatabase || 'fulcrumapp');
        return;
      }

      yield _this.activate();

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (account) {
        const forms = yield account.findActiveForms({});

        for (const form of forms) {
          yield _this.rebuildForm(form, account, function (index) {
            _this.updateStatus(form.name.green + ' : ' + index.toString().red + ' records');
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

    this.updateStatus = message => {
      if (process.stdout.isTTY) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(message);
      }
    };
  }

  task(cli) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return cli.command({
        command: 'mssql',
        desc: 'run the MSSQL sync for a specific organization',
        builder: {
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

      _this3.dataSchema = fulcrum.args.msSchema || 'dbo';
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
      server: fulcrum.args.msHost || MSSQL_CONFIG.host,
      port: fulcrum.args.msPort || MSSQL_CONFIG.port,
      database: fulcrum.args.msDatabase || MSSQL_CONFIG.database,
      user: fulcrum.args.msUser || MSSQL_CONFIG.user,
      password: fulcrum.args.msPassword || MSSQL_CONFIG.password,
      options: {
        encrypt: true // Use this if you're on Windows Azure
      }
    });

    if (fulcrum.args.msUser) {
      options.user = fulcrum.args.msUser;
    }

    if (fulcrum.args.msPassword) {
      options.password = fulcrum.args.msPassword;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsImhvc3QiLCJwb3J0IiwibWF4IiwiaWRsZVRpbWVvdXRNaWxsaXMiLCJydW5Db21tYW5kIiwiZnVsY3J1bSIsImFyZ3MiLCJzZXR1cCIsImNyZWF0ZURhdGFiYXNlIiwibXNEYXRhYmFzZSIsImFjdGl2YXRlIiwiYWNjb3VudCIsImZldGNoQWNjb3VudCIsIm9yZyIsImZvcm1zIiwiZmluZEFjdGl2ZUZvcm1zIiwiZm9ybSIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImNvbnNvbGUiLCJsb2ciLCJlcnJvciIsImlkZW50IiwicnVuIiwic3FsIiwicmVwbGFjZSIsImRlYnVnIiwicmVzdWx0IiwicG9vbCIsInJlcXVlc3QiLCJiYXRjaCIsInJlY29yZHNldCIsInRhYmxlTmFtZSIsInJvd0lEIiwib25Gb3JtU2F2ZSIsIm9sZEZvcm0iLCJuZXdGb3JtIiwidXBkYXRlRm9ybSIsIm9uUmVjb3JkU2F2ZSIsInJlY29yZCIsInVwZGF0ZVJlY29yZCIsIm9uUmVjb3JkRGVsZXRlIiwic3RhdGVtZW50cyIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJtc3NxbCIsInN0YXRlbWVudCIsIm8iLCJvbkNob2ljZUxpc3RTYXZlIiwib2JqZWN0Iiwib25DbGFzc2lmaWNhdGlvblNldFNhdmUiLCJvblByb2plY3RTYXZlIiwicmVsb2FkVGFibGVMaXN0Iiwicm93cyIsInRhYmxlTmFtZXMiLCJtYXAiLCJza2lwVGFibGVDaGVjayIsInJvb3RUYWJsZUV4aXN0cyIsInVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJpbmRleE9mIiwidGFibGVOYW1lV2l0aEZvcm0iLCJyZWNyZWF0ZUZvcm1UYWJsZXMiLCJmb3JtVmVyc2lvbiIsImV4IiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZHJvcEZyaWVuZGx5VmlldyIsInJlcGVhdGFibGUiLCJlbGVtZW50c09mVHlwZSIsImNyZWF0ZUZyaWVuZGx5VmlldyIsImlkIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJtZXNzYWdlIiwicHJvY2VzcyIsInN0ZG91dCIsImlzVFRZIiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJ0eXBlIiwiZGVmYXVsdCIsIm1zSG9zdCIsIm1zUG9ydCIsIm1zVXNlciIsIm1zUGFzc3dvcmQiLCJtc1NjaGVtYSIsInJlcXVpcmVkIiwiaGFuZGxlciIsIm9wdGlvbnMiLCJjb25uZWN0aW9uT3B0aW9ucyIsImNvbm5lY3QiLCJvbiIsImRhdGFTY2hlbWEiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJ2aWV3TmFtZSIsImRhdGFOYW1lIiwicHJvZ3Jlc3MiLCJmaW5kRWFjaFJlY29yZCIsInNlcnZlciIsInVzZXIiLCJwYXNzd29yZCIsImVuY3J5cHQiLCJkYXRhYmFzZU5hbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztBQUVBLE1BQU1BLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsUUFBTSxXQUZhO0FBR25CQyxRQUFNLElBSGE7QUFJbkJDLE9BQUssRUFKYztBQUtuQkMscUJBQW1CO0FBTEEsQ0FBckI7O2tCQVFlLE1BQU07QUFBQTtBQUFBOztBQUFBLFNBK0NuQkMsVUEvQ21CLHFCQStDTixhQUFZO0FBQ3ZCLFVBQUlDLFFBQVFDLElBQVIsQ0FBYUMsS0FBakIsRUFBd0I7QUFDdEIsY0FBTSxNQUFLQyxjQUFMLENBQW9CSCxRQUFRQyxJQUFSLENBQWFHLFVBQWIsSUFBMkIsWUFBL0MsQ0FBTjtBQUNBO0FBQ0Q7O0FBRUQsWUFBTSxNQUFLQyxRQUFMLEVBQU47O0FBRUEsWUFBTUMsVUFBVSxNQUFNTixRQUFRTyxZ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QXVCL0YsYUFBYUUsSUFGeEM7QUFHSkMsWUFBTUksUUFBUUMsSUFBUixDQUFhd0YsTUFBYixJQUF1QmhHLGFBQWFHLElBSHRDO0FBSUpGLGdCQUFVTSxRQUFRQyxJQUFSLENBQWFHLFVBQWIsSUFBMkJYLGFBQWFDLFFBSjlDO0FBS0ppSCxZQUFNM0csUUFBUUMsSUFBUixDQUFheUYsTUFBYixJQUF1QmpHLGFBQWFrSCxJQUx0QztBQU1KQyxnQkFBVTVHLFFBQVFDLElBQVIsQ0FBYTBGLFVBQWIsSUFBMkJsRyxhQUFhbUgsUUFOOUM7QUFPSmIsZUFBUztBQUNQYyxpQkFBUyxJQURGLENBQ087QUFEUDtBQVBMLE1BQU47O0FBWUEsUUFBSTdHLFFBQVFDLElBQVIsQ0FBYXlGLE1BQWpCLEVBQXlCO0FBQ3ZCSyxjQUFRWSxJQUFSLEdBQWUzRyxRQUFRQyxJQUFSLENBQWF5RixNQUE1QjtBQUNEOztBQUVELFFBQUkxRixRQUFRQyxJQUFSLENBQWEwRixVQUFqQixFQUE2QjtBQUMzQkksY0FBUWEsUUFBUixHQUFtQjVHLFFBQVFDLElBQVIsQ0FBYTBGLFVBQWhDO0FBQ0Q7O0FBRUQsV0FBT0ksT0FBUDtBQUNEOztBQUVLNUYsZ0JBQU4sQ0FBcUIyRyxZQUFyQixFQUFtQztBQUFBOztBQUFBO0FBQ2pDLFlBQU1mLFVBQVUsT0FBS0MsaUJBQXJCOztBQUVBRCxjQUFRckcsUUFBUixHQUFtQixJQUFuQjs7QUFFQSxhQUFLa0MsSUFBTCxHQUFZLE1BQU0sZ0JBQU1xRSxPQUFOLENBQWNGLE9BQWQsQ0FBbEI7O0FBRUEsWUFBTXZFLE1BQU8sbUJBQWtCc0YsWUFBYSxFQUE1Qzs7QUFFQTNGLGNBQVFDLEdBQVIsQ0FBWUksR0FBWjs7QUFFQSxZQUFNNEIsT0FBTyxNQUFNLE9BQUs3QixHQUFMLENBQVUsbUJBQWtCdUYsWUFBYSxFQUF6QyxDQUFuQjtBQVhpQztBQVlsQzs7QUFwVGtCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1zc3FsIGZyb20gJ21zc3FsJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IE1TU1FMIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgTVNTUUxSZWNvcmRWYWx1ZXMgZnJvbSAnLi9tc3NxbC1yZWNvcmQtdmFsdWVzJztcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBob3N0OiAnbG9jYWxob3N0JyxcbiAgcG9ydDogMTQzMyxcbiAgbWF4OiAxMCxcbiAgaWRsZVRpbWVvdXRNaWxsaXM6IDMwMDAwXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXG4gICAgICBkZXNjOiAncnVuIHRoZSBNU1NRTCBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG1zRGF0YWJhc2U6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgZGF0YWJhc2UgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmRhdGFiYXNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zSG9zdDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgaG9zdCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcbiAgICAgICAgfSxcbiAgICAgICAgbXNQb3J0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcbiAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLnBvcnRcbiAgICAgICAgfSxcbiAgICAgICAgbXNVc2VyOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHVzZXInLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zUGFzc3dvcmQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zU2NoZW1hOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgc2V0dXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2V0dXAgdGhlIGRhdGFiYXNlJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbidcbiAgICAgICAgfSxcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChmdWxjcnVtLmFyZ3Muc2V0dXApIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRGF0YWJhc2UoZnVsY3J1bS5hcmdzLm1zRGF0YWJhc2UgfHwgJ2Z1bGNydW1hcHAnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgY29uc3QgZm9ybXMgPSBhd2FpdCBhY2NvdW50LmZpbmRBY3RpdmVGb3Jtcyh7fSk7XG5cbiAgICAgIGZvciAoY29uc3QgZm9ybSBvZiBmb3Jtcykge1xuICAgICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIChpbmRleCkgPT4ge1xuICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGZvcm0ubmFtZS5ncmVlbiArICcgOiAnICsgaW5kZXgudG9TdHJpbmcoKS5yZWQgKyAnIHJlY29yZHMnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGUoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuY29ubmVjdGlvbk9wdGlvbnM7XG5cbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KG9wdGlvbnMpXG5cbiAgICAvLyBmdWxjcnVtLm9uKCdjaG9pY2VfbGlzdDpzYXZlJywgdGhpcy5vbkNob2ljZUxpc3RTYXZlKTtcbiAgICAvLyBmdWxjcnVtLm9uKCdjbGFzc2lmaWNhdGlvbl9zZXQ6c2F2ZScsIHRoaXMub25DbGFzc2lmaWNhdGlvblNldFNhdmUpO1xuICAgIC8vIGZ1bGNydW0ub24oJ3Byb2plY3Q6c2F2ZScsIHRoaXMub25Qcm9qZWN0U2F2ZSk7XG4gICAgZnVsY3J1bS5vbignZm9ybTpzYXZlJywgdGhpcy5vbkZvcm1TYXZlKTtcbiAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6c2F2ZScsIHRoaXMub25SZWNvcmRTYXZlKTtcbiAgICBmdWxjcnVtLm9uKCdyZWNvcmQ6ZGVsZXRlJywgdGhpcy5vblJlY29yZERlbGV0ZSk7XG5cbiAgICAvLyBGZXRjaCBhbGwgdGhlIGV4aXN0aW5nIHRhYmxlcyBvbiBzdGFydHVwLiBUaGlzIGFsbG93cyB1cyB0byBzcGVjaWFsIGNhc2UgdGhlXG4gICAgLy8gY3JlYXRpb24gb2YgbmV3IHRhYmxlcyBldmVuIHdoZW4gdGhlIGZvcm0gaXNuJ3QgdmVyc2lvbiAxLiBJZiB0aGUgdGFibGUgZG9lc24ndFxuICAgIC8vIGV4aXN0LCB3ZSBjYW4gcHJldGVuZCB0aGUgZm9ybSBpcyB2ZXJzaW9uIDEgc28gaXQgY3JlYXRlcyBhbGwgbmV3IHRhYmxlcyBpbnN0ZWFkXG4gICAgLy8gb2YgYXBwbHlpbmcgYSBzY2hlbWEgZGlmZi5cbiAgICBjb25zdCByb3dzID0gYXdhaXQgdGhpcy5ydW4oXCJTRUxFQ1QgdGFibGVfbmFtZSBBUyBuYW1lIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyBXSEVSRSB0YWJsZV9zY2hlbWE9J2RibydcIik7XG5cbiAgICB0aGlzLmRhdGFTY2hlbWEgPSBmdWxjcnVtLmFyZ3MubXNTY2hlbWEgfHwgJ2Ribyc7XG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuXG4gICAgLy8gbWFrZSBhIGNsaWVudCBzbyB3ZSBjYW4gdXNlIGl0IHRvIGJ1aWxkIFNRTCBzdGF0ZW1lbnRzXG4gICAgdGhpcy5tc3NxbCA9IG5ldyBNU1NRTCh7fSk7XG4gIH1cblxuICBhc3luYyBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLnBvb2wpIHtcbiAgICAgIGF3YWl0IHRoaXMucG9vbC5jbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIGlkZW50ID0gKG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ1snICsgbmFtZSArICddJztcbiAgfVxuXG4gIHJ1biA9IGFzeW5jIChzcWwpID0+IHtcbiAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFwwL2csICcnKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgIGNvbnNvbGUubG9nKHNxbCk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wb29sLnJlcXVlc3QoKS5iYXRjaChzcWwpO1xuXG4gICAgcmV0dXJuIHJlc3VsdC5yZWNvcmRzZXQ7XG4gIH1cblxuICBsb2cgPSAoLi4uYXJncykgPT4ge1xuICAgIC8vIGNvbnNvbGUubG9nKC4uLmFyZ3MpO1xuICB9XG5cbiAgdGFibGVOYW1lID0gKGFjY291bnQsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXycgKyBuYW1lO1xuICB9XG5cbiAgb25Gb3JtU2F2ZSA9IGFzeW5jICh7Zm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybX0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSk7XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZCwgYWNjb3VudH0pID0+IHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQpO1xuICB9XG5cbiAgb25SZWNvcmREZWxldGUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMuZGVsZXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQsIHJlY29yZC5mb3JtKTtcblxuICAgIGZvciAoY29uc3Qgc3RhdGVtZW50IG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKG8uc3FsKTtcbiAgICB9XG4gIH1cblxuICBvbkNob2ljZUxpc3RTYXZlID0gYXN5bmMgKHtvYmplY3R9KSA9PiB7XG4gIH1cblxuICBvbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSA9IGFzeW5jICh7b2JqZWN0fSkgPT4ge1xuICB9XG5cbiAgb25Qcm9qZWN0U2F2ZSA9IGFzeW5jICh7b2JqZWN0fSkgPT4ge1xuICB9XG5cbiAgcmVsb2FkVGFibGVMaXN0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihcIlNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0ncHVibGljJ1wiKTtcblxuICAgIHRoaXMudGFibGVOYW1lcyA9IHJvd3MubWFwKG8gPT4gby5uYW1lKTtcbiAgfVxuXG4gIHVwZGF0ZVJlY29yZCA9IGFzeW5jIChyZWNvcmQsIGFjY291bnQsIHNraXBUYWJsZUNoZWNrKSA9PiB7XG4gICAgaWYgKCFza2lwVGFibGVDaGVjayAmJiAhdGhpcy5yb290VGFibGVFeGlzdHMocmVjb3JkLmZvcm0pKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlYnVpbGRGb3JtKHJlY29yZC5mb3JtLCBhY2NvdW50LCAoKSA9PiB7fSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IE1TU1FMUmVjb3JkVmFsdWVzLnVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5tc3NxbCwgcmVjb3JkKTtcblxuICAgIGZvciAoY29uc3Qgc3RhdGVtZW50IG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudC5zcWwpO1xuICAgIH1cbiAgfVxuXG4gIHJvb3RUYWJsZUV4aXN0cyA9IChmb3JtKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVOYW1lcy5pbmRleE9mKE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0pKSAhPT0gLTE7XG4gIH1cblxuICByZWNyZWF0ZUZvcm1UYWJsZXMgPSBhc3luYyAoZm9ybSwgYWNjb3VudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSwgbnVsbCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihzcWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBudWxsLCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pKTtcbiAgfVxuXG4gIHVwZGF0ZUZvcm0gPSBhc3luYyAoZm9ybSwgYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSkgPT4ge1xuICAgIGlmICghdGhpcy5yb290VGFibGVFeGlzdHMoZm9ybSkgJiYgbmV3Rm9ybSAhPSBudWxsKSB7XG4gICAgICBvbGRGb3JtID0gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB7c3RhdGVtZW50c30gPSBhd2FpdCBNU1NRTFNjaGVtYS5nZW5lcmF0ZVNjaGVtYVN0YXRlbWVudHMoYWNjb3VudCwgb2xkRm9ybSwgbmV3Rm9ybSk7XG5cbiAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBzcWwgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oc3FsKTtcbiAgICB9XG4gICAgLy8gYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50cy5qb2luKCdcXG4nKSk7XG5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRyb3BGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gcmVwZWF0YWJsZSA/IGAke2Zvcm0ubmFtZX0gLSAke3JlcGVhdGFibGUuZGF0YU5hbWV9YCA6IGZvcm0ubmFtZTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0RST1AgVklFVyBJRiBFWElTVFMgJXMuJXM7JywgdGhpcy5pZGVudCh0aGlzLmRhdGFTY2hlbWEpLCB0aGlzLmlkZW50KHZpZXdOYW1lKSkpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXgpO1xuICAgICAgfVxuICAgICAgLy8gc29tZXRpbWVzIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICB9XG4gIH1cblxuICBhc3luYyBjcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSkge1xuICAgIGNvbnN0IHZpZXdOYW1lID0gcmVwZWF0YWJsZSA/IGAke2Zvcm0ubmFtZX0gLSAke3JlcGVhdGFibGUuZGF0YU5hbWV9YCA6IGZvcm0ubmFtZTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihmb3JtYXQoJ0NSRUFURSBWSUVXICVzLiVzIEFTIFNFTEVDVCAqIEZST00gJXNfdmlld19mdWxsOycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pZGVudCh0aGlzLmRhdGFTY2hlbWEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaWRlbnQodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1TU1FMUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0sIHJlcGVhdGFibGUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihleCk7XG4gICAgICB9XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIHByb2dyZXNzKSB7XG4gICAgYXdhaXQgdGhpcy5yZWNyZWF0ZUZvcm1UYWJsZXMoZm9ybSwgYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRUYWJsZUxpc3QoKTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIHRydWUpO1xuICAgIH0pO1xuXG4gICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cblxuICBnZXQgY29ubmVjdGlvbk9wdGlvbnMoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zSG9zdCB8fCBNU1NRTF9DT05GSUcuaG9zdCxcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc1BvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zRGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zVXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNQYXNzd29yZCB8fCBNU1NRTF9DT05GSUcucGFzc3dvcmQsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGVuY3J5cHQ6IHRydWUgLy8gVXNlIHRoaXMgaWYgeW91J3JlIG9uIFdpbmRvd3MgQXp1cmVcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc1VzZXIpIHtcbiAgICAgIG9wdGlvbnMudXNlciA9IGZ1bGNydW0uYXJncy5tc1VzZXI7XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc1Bhc3N3b3JkKSB7XG4gICAgICBvcHRpb25zLnBhc3N3b3JkID0gZnVsY3J1bS5hcmdzLm1zUGFzc3dvcmQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cblxuICBhc3luYyBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5jb25uZWN0aW9uT3B0aW9ucztcblxuICAgIG9wdGlvbnMuZGF0YWJhc2UgPSBudWxsO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChvcHRpb25zKVxuXG4gICAgY29uc3Qgc3FsID0gYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX1gO1xuXG4gICAgY29uc29sZS5sb2coc3FsKTtcblxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgQ1JFQVRFIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfWApO1xuICB9XG5cbiAgdXBkYXRlU3RhdHVzID0gKG1lc3NhZ2UpID0+IHtcbiAgICBpZiAocHJvY2Vzcy5zdGRvdXQuaXNUVFkpIHtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY3Vyc29yVG8oMCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShtZXNzYWdlKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==