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
          msConnectionString: {
            desc: 'mssql connection string',
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
    if (fulcrum.args.msConnectionString) {
      return fulcrum.args.msConnectionString;
    }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsImhvc3QiLCJwb3J0IiwibWF4IiwiaWRsZVRpbWVvdXRNaWxsaXMiLCJydW5Db21tYW5kIiwiZnVsY3J1bSIsImFyZ3MiLCJzZXR1cCIsImNyZWF0ZURhdGFiYXNlIiwibXNEYXRhYmFzZSIsImFjdGl2YXRlIiwiYWNjb3VudCIsImZldGNoQWNjb3VudCIsIm9yZyIsImZvcm1zIiwiZmluZEFjdGl2ZUZvcm1zIiwiZm9ybSIsInJlYnVpbGRGb3JtIiwiaW5kZXgiLCJ1cGRhdGVTdGF0dXMiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImNvbnNvbGUiLCJsb2ciLCJlcnJvciIsImlkZW50IiwicnVuIiwic3FsIiwicmVwbGFjZSIsImRlYnVnIiwicmVzdWx0IiwicG9vbCIsInJlcXVlc3QiLCJiYXRjaCIsInJlY29yZHNldCIsInRhYmxlTmFtZSIsInJvd0lEIiwib25Gb3JtU2F2ZSIsIm9sZEZvcm0iLCJuZXdGb3JtIiwidXBkYXRlRm9ybSIsIm9uUmVjb3JkU2F2ZSIsInJlY29yZCIsInVwZGF0ZVJlY29yZCIsIm9uUmVjb3JkRGVsZXRlIiwic3RhdGVtZW50cyIsImRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJtc3NxbCIsInN0YXRlbWVudCIsIm8iLCJvbkNob2ljZUxpc3RTYXZlIiwib2JqZWN0Iiwib25DbGFzc2lmaWNhdGlvblNldFNhdmUiLCJvblByb2plY3RTYXZlIiwicmVsb2FkVGFibGVMaXN0Iiwicm93cyIsInRhYmxlTmFtZXMiLCJtYXAiLCJza2lwVGFibGVDaGVjayIsInJvb3RUYWJsZUV4aXN0cyIsInVwZGF0ZUZvclJlY29yZFN0YXRlbWVudHMiLCJpbmRleE9mIiwidGFibGVOYW1lV2l0aEZvcm0iLCJyZWNyZWF0ZUZvcm1UYWJsZXMiLCJmb3JtVmVyc2lvbiIsImV4IiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZHJvcEZyaWVuZGx5VmlldyIsInJlcGVhdGFibGUiLCJlbGVtZW50c09mVHlwZSIsImNyZWF0ZUZyaWVuZGx5VmlldyIsImlkIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJtZXNzYWdlIiwicHJvY2VzcyIsInN0ZG91dCIsImlzVFRZIiwiY2xlYXJMaW5lIiwiY3Vyc29yVG8iLCJ3cml0ZSIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJ0eXBlIiwiZGVmYXVsdCIsIm1zSG9zdCIsIm1zUG9ydCIsIm1zVXNlciIsIm1zUGFzc3dvcmQiLCJtc1NjaGVtYSIsIm1zQ29ubmVjdGlvblN0cmluZyIsInJlcXVpcmVkIiwiaGFuZGxlciIsIm9wdGlvbnMiLCJjb25uZWN0aW9uT3B0aW9ucyIsImNvbm5lY3QiLCJvbiIsImRhdGFTY2hlbWEiLCJkZWFjdGl2YXRlIiwiY2xvc2UiLCJ2aWV3TmFtZSIsImRhdGFOYW1lIiwicHJvZ3Jlc3MiLCJmaW5kRWFjaFJlY29yZCIsInNlcnZlciIsInVzZXIiLCJwYXNzd29yZCIsImVuY3J5cHQiLCJkYXRhYmFzZU5hbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztBQUVBLE1BQU1BLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsUUFBTSxXQUZhO0FBR25CQyxRQUFNLElBSGE7QUFJbkJDLE9BQUssRUFKYztBQUtuQkMscUJBQW1CO0FBTEEsQ0FBckI7O2tCQVFlLE1BQU07QUFBQTtBQUFBOztBQUFBLFNBbURuQkMsVUFuRG1CLHFCQW1ETixhQUFZO0FBQ3ZCLFVBQUlDLFFBQVFDLElBQVIsQ0FBYUMsS0FBakIsRUFBd0I7QUFDdEIsY0FBTSxNQUFLQyxjQUFMLENBQW9CSCxRQUFRQyxJQUFSLENBQWFHLFVBQWIsSUFBMkIsWUFBL0MsQ0FBTjtBQUNBO0FBQ0Q7O0FBRUQsWUFBTSxNQUFLQyxRQUFMLEVBQU47O0FBRUEsWUFB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R0FBWjs7QUFFQSxZQUFNNEIsT0FBTyxNQUFNLE9BQUs3QixHQUFMLENBQVUsbUJBQWtCd0YsWUFBYSxFQUF6QyxDQUFuQjtBQVhpQztBQVlsQzs7QUE1VGtCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1zc3FsIGZyb20gJ21zc3FsJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IE1TU1FMU2NoZW1hIGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IE1TU1FMIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgTVNTUUxSZWNvcmRWYWx1ZXMgZnJvbSAnLi9tc3NxbC1yZWNvcmQtdmFsdWVzJztcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBob3N0OiAnbG9jYWxob3N0JyxcbiAgcG9ydDogMTQzMyxcbiAgbWF4OiAxMCxcbiAgaWRsZVRpbWVvdXRNaWxsaXM6IDMwMDAwXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXG4gICAgICBkZXNjOiAncnVuIHRoZSBNU1NRTCBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG1zRGF0YWJhc2U6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgZGF0YWJhc2UgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmRhdGFiYXNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zSG9zdDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgaG9zdCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcbiAgICAgICAgfSxcbiAgICAgICAgbXNQb3J0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcbiAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLnBvcnRcbiAgICAgICAgfSxcbiAgICAgICAgbXNVc2VyOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHVzZXInLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zUGFzc3dvcmQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zU2NoZW1hOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbXNDb25uZWN0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIGNvbm5lY3Rpb24gc3RyaW5nJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBzZXR1cDoge1xuICAgICAgICAgIGRlc2M6ICdzZXR1cCB0aGUgZGF0YWJhc2UnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJ1xuICAgICAgICB9LFxuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5zZXR1cCkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVEYXRhYmFzZShmdWxjcnVtLmFyZ3MubXNEYXRhYmFzZSB8fCAnZnVsY3J1bWFwcCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKGluZGV4KSA9PiB7XG4gICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoZm9ybS5uYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCArICcgcmVjb3JkcycpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5jb25uZWN0aW9uT3B0aW9ucztcblxuICAgIHRoaXMucG9vbCA9IGF3YWl0IG1zc3FsLmNvbm5lY3Qob3B0aW9ucylcblxuICAgIC8vIGZ1bGNydW0ub24oJ2Nob2ljZV9saXN0OnNhdmUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuICAgIC8vIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uX3NldDpzYXZlJywgdGhpcy5vbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSk7XG4gICAgLy8gZnVsY3J1bS5vbigncHJvamVjdDpzYXZlJywgdGhpcy5vblByb2plY3RTYXZlKTtcbiAgICBmdWxjcnVtLm9uKCdmb3JtOnNhdmUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuICAgIGZ1bGNydW0ub24oJ3JlY29yZDpzYXZlJywgdGhpcy5vblJlY29yZFNhdmUpO1xuICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcblxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcbiAgICAvLyBjcmVhdGlvbiBvZiBuZXcgdGFibGVzIGV2ZW4gd2hlbiB0aGUgZm9ybSBpc24ndCB2ZXJzaW9uIDEuIElmIHRoZSB0YWJsZSBkb2Vzbid0XG4gICAgLy8gZXhpc3QsIHdlIGNhbiBwcmV0ZW5kIHRoZSBmb3JtIGlzIHZlcnNpb24gMSBzbyBpdCBjcmVhdGVzIGFsbCBuZXcgdGFibGVzIGluc3RlYWRcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihcIlNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0nZGJvJ1wiKTtcblxuICAgIHRoaXMuZGF0YVNjaGVtYSA9IGZ1bGNydW0uYXJncy5tc1NjaGVtYSB8fCAnZGJvJztcbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICAvLyBtYWtlIGEgY2xpZW50IHNvIHdlIGNhbiB1c2UgaXQgdG8gYnVpbGQgU1FMIHN0YXRlbWVudHNcbiAgICB0aGlzLm1zc3FsID0gbmV3IE1TU1FMKHt9KTtcbiAgfVxuXG4gIGFzeW5jIGRlYWN0aXZhdGUoKSB7XG4gICAgaWYgKHRoaXMucG9vbCkge1xuICAgICAgYXdhaXQgdGhpcy5wb29sLmNsb3NlKCk7XG4gICAgfVxuICB9XG5cbiAgaWRlbnQgPSAobmFtZSkgPT4ge1xuICAgIHJldHVybiAnWycgKyBuYW1lICsgJ10nO1xuICB9XG5cbiAgcnVuID0gYXN5bmMgKHNxbCkgPT4ge1xuICAgIHNxbCA9IHNxbC5yZXBsYWNlKC9cXDAvZywgJycpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgY29uc29sZS5sb2coc3FsKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBvb2wucmVxdWVzdCgpLmJhdGNoKHNxbCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnJlY29yZHNldDtcbiAgfVxuXG4gIGxvZyA9ICguLi5hcmdzKSA9PiB7XG4gICAgLy8gY29uc29sZS5sb2coLi4uYXJncyk7XG4gIH1cblxuICB0YWJsZU5hbWUgPSAoYWNjb3VudCwgbmFtZSkgPT4ge1xuICAgIHJldHVybiAnYWNjb3VudF8nICsgYWNjb3VudC5yb3dJRCArICdfJyArIG5hbWU7XG4gIH1cblxuICBvbkZvcm1TYXZlID0gYXN5bmMgKHtmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtfSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcbiAgfVxuXG4gIG9uUmVjb3JkU2F2ZSA9IGFzeW5jICh7cmVjb3JkLCBhY2NvdW50fSkgPT4ge1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCk7XG4gIH1cblxuICBvblJlY29yZERlbGV0ZSA9IGFzeW5jICh7cmVjb3JkfSkgPT4ge1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBNU1NRTFJlY29yZFZhbHVlcy5kZWxldGVGb3JSZWNvcmRTdGF0ZW1lbnRzKHRoaXMubXNzcWwsIHJlY29yZCwgcmVjb3JkLmZvcm0pO1xuXG4gICAgZm9yIChjb25zdCBzdGF0ZW1lbnQgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oby5zcWwpO1xuICAgIH1cbiAgfVxuXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe29iamVjdH0pID0+IHtcbiAgfVxuXG4gIG9uQ2xhc3NpZmljYXRpb25TZXRTYXZlID0gYXN5bmMgKHtvYmplY3R9KSA9PiB7XG4gIH1cblxuICBvblByb2plY3RTYXZlID0gYXN5bmMgKHtvYmplY3R9KSA9PiB7XG4gIH1cblxuICByZWxvYWRUYWJsZUxpc3QgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKFwiU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSdwdWJsaWMnXCIpO1xuXG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgdXBkYXRlUmVjb3JkID0gYXN5bmMgKHJlY29yZCwgYWNjb3VudCwgc2tpcFRhYmxlQ2hlY2spID0+IHtcbiAgICBpZiAoIXNraXBUYWJsZUNoZWNrICYmICF0aGlzLnJvb3RUYWJsZUV4aXN0cyhyZWNvcmQuZm9ybSkpIHtcbiAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0ocmVjb3JkLmZvcm0sIGFjY291bnQsICgpID0+IHt9KTtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gTVNTUUxSZWNvcmRWYWx1ZXMudXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLm1zc3FsLCByZWNvcmQpO1xuXG4gICAgZm9yIChjb25zdCBzdGF0ZW1lbnQgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oc3RhdGVtZW50LnNxbCk7XG4gICAgfVxuICB9XG5cbiAgcm9vdFRhYmxlRXhpc3RzID0gKGZvcm0pID0+IHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU5hbWVzLmluZGV4T2YoTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSkpICE9PSAtMTtcbiAgfVxuXG4gIHJlY3JlYXRlRm9ybVRhYmxlcyA9IGFzeW5jIChmb3JtLCBhY2NvdW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlRm9ybShmb3JtLCBhY2NvdW50LCB0aGlzLmZvcm1WZXJzaW9uKGZvcm0pLCBudWxsKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBjb25zb2xlLmVycm9yKHNxbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG51bGwsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSkpO1xuICB9XG5cbiAgdXBkYXRlRm9ybSA9IGFzeW5jIChmb3JtLCBhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKSA9PiB7XG4gICAgaWYgKCF0aGlzLnJvb3RUYWJsZUV4aXN0cyhmb3JtKSAmJiBuZXdGb3JtICE9IG51bGwpIHtcbiAgICAgIG9sZEZvcm0gPSBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHtzdGF0ZW1lbnRzfSA9IGF3YWl0IE1TU1FMU2NoZW1hLmdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtKTtcblxuICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCBudWxsKTtcblxuICAgIGZvciAoY29uc3QgcmVwZWF0YWJsZSBvZiBmb3JtLmVsZW1lbnRzT2ZUeXBlKCdSZXBlYXRhYmxlJykpIHtcbiAgICAgIGF3YWl0IHRoaXMuZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHNxbCBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1bihzcWwpO1xuICAgIH1cbiAgICAvLyBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnRzLmpvaW4oJ1xcbicpKTtcblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgcmVwZWF0YWJsZSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZHJvcEZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSByZXBlYXRhYmxlID8gYCR7Zm9ybS5uYW1lfSAtICR7cmVwZWF0YWJsZS5kYXRhTmFtZX1gIDogZm9ybS5uYW1lO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnRFJPUCBWSUVXIElGIEVYSVNUUyAlcy4lczsnLCB0aGlzLmlkZW50KHRoaXMuZGF0YVNjaGVtYSksIHRoaXMuaWRlbnQodmlld05hbWUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihleCk7XG4gICAgICB9XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSByZXBlYXRhYmxlID8gYCR7Zm9ybS5uYW1lfSAtICR7cmVwZWF0YWJsZS5kYXRhTmFtZX1gIDogZm9ybS5uYW1lO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnQ1JFQVRFIFZJRVcgJXMuJXMgQVMgU0VMRUNUICogRlJPTSAlc192aWV3X2Z1bGw7JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmlkZW50KHRoaXMuZGF0YVNjaGVtYSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pZGVudCh2aWV3TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTVNTUUxSZWNvcmRWYWx1ZXMudGFibGVOYW1lV2l0aEZvcm0oZm9ybSwgcmVwZWF0YWJsZSkpKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgICBjb25zb2xlLmVycm9yKGV4KTtcbiAgICAgIH1cbiAgICAgIC8vIHNvbWV0aW1lcyBpdCBkb2Vzbid0IGV4aXN0XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgcHJvZ3Jlc3MpIHtcbiAgICBhd2FpdCB0aGlzLnJlY3JlYXRlRm9ybVRhYmxlcyhmb3JtLCBhY2NvdW50KTtcbiAgICBhd2FpdCB0aGlzLnJlbG9hZFRhYmxlTGlzdCgpO1xuXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIGF3YWl0IGZvcm0uZmluZEVhY2hSZWNvcmQoe30sIGFzeW5jIChyZWNvcmQpID0+IHtcbiAgICAgIHJlY29yZC5mb3JtID0gZm9ybTtcblxuICAgICAgaWYgKCsraW5kZXggJSAxMCA9PT0gMCkge1xuICAgICAgICBwcm9ncmVzcyhpbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUmVjb3JkKHJlY29yZCwgYWNjb3VudCwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBwcm9ncmVzcyhpbmRleCk7XG4gIH1cblxuICBmb3JtVmVyc2lvbiA9IChmb3JtKSA9PiB7XG4gICAgaWYgKGZvcm0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBmb3JtLl9pZCxcbiAgICAgIHJvd19pZDogZm9ybS5yb3dJRCxcbiAgICAgIG5hbWU6IGZvcm0uX25hbWUsXG4gICAgICBlbGVtZW50czogZm9ybS5fZWxlbWVudHNKU09OXG4gICAgfTtcbiAgfVxuXG4gIGdldCBjb25uZWN0aW9uT3B0aW9ucygpIHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zQ29ubmVjdGlvblN0cmluZykge1xuICAgICAgcmV0dXJuIGZ1bGNydW0uYXJncy5tc0Nvbm5lY3Rpb25TdHJpbmc7XG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLk1TU1FMX0NPTkZJRyxcbiAgICAgIHNlcnZlcjogZnVsY3J1bS5hcmdzLm1zSG9zdCB8fCBNU1NRTF9DT05GSUcuaG9zdCxcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc1BvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zRGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zVXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNQYXNzd29yZCB8fCBNU1NRTF9DT05GSUcucGFzc3dvcmQsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGVuY3J5cHQ6IHRydWUgLy8gVXNlIHRoaXMgaWYgeW91J3JlIG9uIFdpbmRvd3MgQXp1cmVcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc1VzZXIpIHtcbiAgICAgIG9wdGlvbnMudXNlciA9IGZ1bGNydW0uYXJncy5tc1VzZXI7XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5tc1Bhc3N3b3JkKSB7XG4gICAgICBvcHRpb25zLnBhc3N3b3JkID0gZnVsY3J1bS5hcmdzLm1zUGFzc3dvcmQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cblxuICBhc3luYyBjcmVhdGVEYXRhYmFzZShkYXRhYmFzZU5hbWUpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5jb25uZWN0aW9uT3B0aW9ucztcblxuICAgIG9wdGlvbnMuZGF0YWJhc2UgPSBudWxsO1xuXG4gICAgdGhpcy5wb29sID0gYXdhaXQgbXNzcWwuY29ubmVjdChvcHRpb25zKVxuXG4gICAgY29uc3Qgc3FsID0gYENSRUFURSBEQVRBQkFTRSAke2RhdGFiYXNlTmFtZX1gO1xuXG4gICAgY29uc29sZS5sb2coc3FsKTtcblxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihgQ1JFQVRFIERBVEFCQVNFICR7ZGF0YWJhc2VOYW1lfWApO1xuICB9XG5cbiAgdXBkYXRlU3RhdHVzID0gKG1lc3NhZ2UpID0+IHtcbiAgICBpZiAocHJvY2Vzcy5zdGRvdXQuaXNUVFkpIHtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQuY3Vyc29yVG8oMCk7XG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShtZXNzYWdlKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==