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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const MSSQL_CONFIG = {
  database: 'fulcrumapp',
  host: 'localhost',
  port: 5432,
  max: 10,
  idleTimeoutMillis: 30000
};

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
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

    this.run = (() => {
      var _ref2 = _asyncToGenerator(function* (sql) {
        sql = sql.replace(/\0/g, '');

        if (fulcrum.args.debug) {
          console.log(sql);
        }

        return yield pool.request().query(sql);
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
        const statements = _fulcrumDesktopPlugin.PostgresRecordValues.deleteForRecordStatements(_this.pgdb, record, record.form);

        yield _this.run(statements.map(function (o) {
          return o.sql;
        }).join('\n'));
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

        const statements = _fulcrumDesktopPlugin.PostgresRecordValues.updateForRecordStatements(_this.pgdb, record);

        yield _this.run(statements.map(function (o) {
          return o.sql;
        }).join('\n'));
      });

      return function (_x8, _x9, _x10) {
        return _ref10.apply(this, arguments);
      };
    })();

    this.rootTableExists = form => {
      return this.tableNames.indexOf(_fulcrumDesktopPlugin.PostgresRecordValues.tableNameWithForm(form)) !== -1;
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

        const { statements } = yield PostgresSchema.generateSchemaStatements(account, oldForm, newForm);

        yield _this.dropFriendlyView(form, null);

        for (const repeatable of form.elementsOfType('Repeatable')) {
          yield _this.dropFriendlyView(form, repeatable);
        }

        yield _this.run(statements.join('\n'));

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
      const options = _extends({}, MSSQL_CONFIG, {
        host: fulcrum.args.mshost || MSSQL_CONFIG.host,
        port: fulcrum.args.msport || MSSQL_CONFIG.port,
        database: fulcrum.args.msdatabase || MSSQL_CONFIG.database,
        user: fulcrum.args.msuser || MSSQL_CONFIG.user,
        password: fulcrum.args.mspassword || MSSQL_CONFIG.user
      });

      if (fulcrum.args.msuser) {
        options.user = fulcrum.args.msuser;
      }

      if (fulcrum.args.mspassword) {
        options.password = fulcrum.args.mspassword;
      }

      _this3.pool = yield _mssql2.default.connect(config);

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
      const rows = yield _this3.run("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'");

      _this3.dataSchema = fulcrum.args.msschema || 'public';
      _this3.tableNames = rows.map(function (o) {
        return o.name;
      });

      // make a client so we can use it to build SQL statements
      _this3.pgdb = new _fulcrumDesktopPlugin.Postgres({});
    })();
  }

  deactivate() {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      if (_this4.pool) {
        yield _this4.pool.end();
      }
    })();
  }

  dropFriendlyView(form, repeatable) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const viewName = repeatable ? `${form.name} - ${repeatable.dataName}` : form.name;

      try {
        yield _this5.run((0, _util.format)('DROP VIEW IF EXISTS %s.%s;', _this5.pgdb.ident(_this5.dataSchema), _this5.pgdb.ident(viewName)));
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
        yield _this6.run((0, _util.format)('CREATE VIEW %s.%s AS SELECT * FROM %s_view_full;', _this6.pgdb.ident(_this6.dataSchema), _this6.pgdb.ident(viewName), _fulcrumDesktopPlugin.PostgresRecordValues.tableNameWithForm(form, repeatable)));
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

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJNU1NRTF9DT05GSUciLCJkYXRhYmFzZSIsImhvc3QiLCJwb3J0IiwibWF4IiwiaWRsZVRpbWVvdXRNaWxsaXMiLCJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJmb3JtcyIsImZpbmRBY3RpdmVGb3JtcyIsImZvcm0iLCJyZWJ1aWxkRm9ybSIsImluZGV4IiwicHJvY2VzcyIsInN0ZG91dCIsImNsZWFyTGluZSIsImN1cnNvclRvIiwid3JpdGUiLCJuYW1lIiwiZ3JlZW4iLCJ0b1N0cmluZyIsInJlZCIsImNvbnNvbGUiLCJsb2ciLCJlcnJvciIsInJ1biIsInNxbCIsInJlcGxhY2UiLCJkZWJ1ZyIsInBvb2wiLCJyZXF1ZXN0IiwicXVlcnkiLCJ0YWJsZU5hbWUiLCJyb3dJRCIsIm9uRm9ybVNhdmUiLCJvbGRGb3JtIiwibmV3Rm9ybSIsInVwZGF0ZUZvcm0iLCJvblJlY29yZFNhdmUiLCJyZWNvcmQiLCJ1cGRhdGVSZWNvcmQiLCJvblJlY29yZERlbGV0ZSIsInN0YXRlbWVudHMiLCJkZWxldGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwicGdkYiIsIm1hcCIsIm8iLCJqb2luIiwib25DaG9pY2VMaXN0U2F2ZSIsIm9iamVjdCIsIm9uQ2xhc3NpZmljYXRpb25TZXRTYXZlIiwib25Qcm9qZWN0U2F2ZSIsInJlbG9hZFRhYmxlTGlzdCIsInJvd3MiLCJ0YWJsZU5hbWVzIiwic2tpcFRhYmxlQ2hlY2siLCJyb290VGFibGVFeGlzdHMiLCJ1cGRhdGVGb3JSZWNvcmRTdGF0ZW1lbnRzIiwiaW5kZXhPZiIsInRhYmxlTmFtZVdpdGhGb3JtIiwicmVjcmVhdGVGb3JtVGFibGVzIiwiZm9ybVZlcnNpb24iLCJleCIsIlBvc3RncmVzU2NoZW1hIiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiZHJvcEZyaWVuZGx5VmlldyIsInJlcGVhdGFibGUiLCJlbGVtZW50c09mVHlwZSIsImNyZWF0ZUZyaWVuZGx5VmlldyIsImlkIiwiX2lkIiwicm93X2lkIiwiX25hbWUiLCJlbGVtZW50cyIsIl9lbGVtZW50c0pTT04iLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwibXNkYXRhYmFzZSIsInR5cGUiLCJkZWZhdWx0IiwibXNob3N0IiwibXNwb3J0IiwibXN1c2VyIiwibXNwYXNzd29yZCIsIm1zc2NoZW1hIiwicmVxdWlyZWQiLCJoYW5kbGVyIiwib3B0aW9ucyIsInVzZXIiLCJwYXNzd29yZCIsImNvbm5lY3QiLCJjb25maWciLCJvbiIsImRhdGFTY2hlbWEiLCJkZWFjdGl2YXRlIiwiZW5kIiwidmlld05hbWUiLCJkYXRhTmFtZSIsImlkZW50IiwicHJvZ3Jlc3MiLCJmaW5kRWFjaFJlY29yZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBLE1BQU1BLGVBQWU7QUFDbkJDLFlBQVUsWUFEUztBQUVuQkMsUUFBTSxXQUZhO0FBR25CQyxRQUFNLElBSGE7QUFJbkJDLE9BQUssRUFKYztBQUtuQkMscUJBQW1CO0FBTEEsQ0FBckI7O2tCQVFlLE1BQU07QUFBQTtBQUFBOztBQUFBLFNBMkNuQkMsVUEzQ21CLHFCQTJDTixhQUFZO0FBQ3ZCLFlBQU0sTUFBS0MsUUFBTCxFQUFOOztBQUVBLFlBQU1DLFVBQVUsTUFBTUMsUUFBUUMsWUFBUixDQUFxQkQsUUFBUUUsSUFBUixDQUFhQyxHQUFsQyxDQUF0Qjs7QUFFQSxVQUFJSixPQUFKLEVBQWE7QUFDWCxjQUFNSyxRQUFRLE1BQU1MLFFBQVFNLGVBQVIsQ0FBd0IsRUFBeEIsQ0FBcEI7O0FBRUEsYUFBSyxNQUFNQyxJQUFYLElBQW1CRixLQUFuQixFQUEwQjtBQUN4QixnQkFBTSxNQUFLRyxXQUFMLENBQWlCRCxJQUFqQixFQUF1QlAsT0FBdkIsRUFBZ0MsVUFBQ1MsS0FBRCxFQUFXO0FBQy9DQyxvQkFBUUMsTUFB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UyxrQkFBTyxrREFBUCxFQUNPLE9BQUttQixJQUFMLENBQVV5RCxLQUFWLENBQWdCLE9BQUtMLFVBQXJCLENBRFAsRUFFTyxPQUFLcEQsSUFBTCxDQUFVeUQsS0FBVixDQUFnQkYsUUFBaEIsQ0FGUCxFQUdPLDJDQUFxQnhDLGlCQUFyQixDQUF1Q2pELElBQXZDLEVBQTZDd0QsVUFBN0MsQ0FIUCxDQUFULENBQU47QUFJRCxPQUxELENBS0UsT0FBT0osRUFBUCxFQUFXO0FBQ1gsWUFBSTFELFFBQVFFLElBQVIsQ0FBYXNCLEtBQWpCLEVBQXdCO0FBQ3RCTixrQkFBUUUsS0FBUixDQUFjc0MsRUFBZDtBQUNEO0FBQ0Q7QUFDRDtBQWJ3QztBQWMxQzs7QUFFS25ELGFBQU4sQ0FBa0JELElBQWxCLEVBQXdCUCxPQUF4QixFQUFpQ21HLFFBQWpDLEVBQTJDO0FBQUE7O0FBQUE7QUFDekMsWUFBTSxPQUFLMUMsa0JBQUwsQ0FBd0JsRCxJQUF4QixFQUE4QlAsT0FBOUIsQ0FBTjtBQUNBLFlBQU0sT0FBS2lELGVBQUwsRUFBTjs7QUFFQSxVQUFJeEMsUUFBUSxDQUFaOztBQUVBLFlBQU1GLEtBQUs2RixjQUFMLENBQW9CLEVBQXBCO0FBQUEsdUNBQXdCLFdBQU9oRSxNQUFQLEVBQWtCO0FBQzlDQSxpQkFBTzdCLElBQVAsR0FBY0EsSUFBZDs7QUFFQSxjQUFJLEVBQUVFLEtBQUYsR0FBVSxFQUFWLEtBQWlCLENBQXJCLEVBQXdCO0FBQ3RCMEYscUJBQVMxRixLQUFUO0FBQ0Q7O0FBRUQsZ0JBQU0sT0FBSzRCLFlBQUwsQ0FBa0JELE1BQWxCLEVBQTBCcEMsT0FBMUIsRUFBbUMsSUFBbkMsQ0FBTjtBQUNELFNBUks7O0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBTjs7QUFVQW1HLGVBQVMxRixLQUFUO0FBaEJ5QztBQWlCMUM7O0FBNVBrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtc3NxbCBmcm9tICdtc3NxbCc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICd1dGlsJztcbmltcG9ydCBNU1NRTFNjaGVtYSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBQb3N0Z3Jlc1JlY29yZFZhbHVlcywgUG9zdGdyZXMgfSBmcm9tICdmdWxjcnVtJztcblxuY29uc3QgTVNTUUxfQ09ORklHID0ge1xuICBkYXRhYmFzZTogJ2Z1bGNydW1hcHAnLFxuICBob3N0OiAnbG9jYWxob3N0JyxcbiAgcG9ydDogNTQzMixcbiAgbWF4OiAxMCxcbiAgaWRsZVRpbWVvdXRNaWxsaXM6IDMwMDAwXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdtc3NxbCcsXG4gICAgICBkZXNjOiAncnVuIHRoZSBNU1NRTCBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG1zZGF0YWJhc2U6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgZGF0YWJhc2UgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmRhdGFiYXNlXG4gICAgICAgIH0sXG4gICAgICAgIG1zaG9zdDoge1xuICAgICAgICAgIGRlc2M6ICdtc3NxbCBzZXJ2ZXIgaG9zdCcsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLmhvc3RcbiAgICAgICAgfSxcbiAgICAgICAgbXNwb3J0OiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNlcnZlciBwb3J0JyxcbiAgICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgICAgZGVmYXVsdDogTVNTUUxfQ09ORklHLnBvcnRcbiAgICAgICAgfSxcbiAgICAgICAgbXN1c2VyOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHVzZXInLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zcGFzc3dvcmQ6IHtcbiAgICAgICAgICBkZXNjOiAnbXNzcWwgcGFzc3dvcmQnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1zc2NoZW1hOiB7XG4gICAgICAgICAgZGVzYzogJ21zc3FsIHNjaGVtYScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEFjdGl2ZUZvcm1zKHt9KTtcblxuICAgICAgZm9yIChjb25zdCBmb3JtIG9mIGZvcm1zKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0oZm9ybSwgYWNjb3VudCwgKGluZGV4KSA9PiB7XG4gICAgICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XG4gICAgICAgICAgcHJvY2Vzcy5zdGRvdXQuY3Vyc29yVG8oMCk7XG4gICAgICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoZm9ybS5uYW1lLmdyZWVuICsgJyA6ICcgKyBpbmRleC50b1N0cmluZygpLnJlZCArICcgcmVjb3JkcycpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgLi4uTVNTUUxfQ09ORklHLFxuICAgICAgaG9zdDogZnVsY3J1bS5hcmdzLm1zaG9zdCB8fCBNU1NRTF9DT05GSUcuaG9zdCxcbiAgICAgIHBvcnQ6IGZ1bGNydW0uYXJncy5tc3BvcnQgfHwgTVNTUUxfQ09ORklHLnBvcnQsXG4gICAgICBkYXRhYmFzZTogZnVsY3J1bS5hcmdzLm1zZGF0YWJhc2UgfHwgTVNTUUxfQ09ORklHLmRhdGFiYXNlLFxuICAgICAgdXNlcjogZnVsY3J1bS5hcmdzLm1zdXNlciB8fCBNU1NRTF9DT05GSUcudXNlcixcbiAgICAgIHBhc3N3b3JkOiBmdWxjcnVtLmFyZ3MubXNwYXNzd29yZCB8fCBNU1NRTF9DT05GSUcudXNlclxuICAgIH07XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zdXNlcikge1xuICAgICAgb3B0aW9ucy51c2VyID0gZnVsY3J1bS5hcmdzLm1zdXNlcjtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1zcGFzc3dvcmQpIHtcbiAgICAgIG9wdGlvbnMucGFzc3dvcmQgPSBmdWxjcnVtLmFyZ3MubXNwYXNzd29yZDtcbiAgICB9XG5cbiAgICB0aGlzLnBvb2wgPSBhd2FpdCBtc3NxbC5jb25uZWN0KGNvbmZpZylcblxuICAgIC8vIGZ1bGNydW0ub24oJ2Nob2ljZV9saXN0OnNhdmUnLCB0aGlzLm9uQ2hvaWNlTGlzdFNhdmUpO1xuICAgIC8vIGZ1bGNydW0ub24oJ2NsYXNzaWZpY2F0aW9uX3NldDpzYXZlJywgdGhpcy5vbkNsYXNzaWZpY2F0aW9uU2V0U2F2ZSk7XG4gICAgLy8gZnVsY3J1bS5vbigncHJvamVjdDpzYXZlJywgdGhpcy5vblByb2plY3RTYXZlKTtcbiAgICBmdWxjcnVtLm9uKCdmb3JtOnNhdmUnLCB0aGlzLm9uRm9ybVNhdmUpO1xuICAgIGZ1bGNydW0ub24oJ3JlY29yZDpzYXZlJywgdGhpcy5vblJlY29yZFNhdmUpO1xuICAgIGZ1bGNydW0ub24oJ3JlY29yZDpkZWxldGUnLCB0aGlzLm9uUmVjb3JkRGVsZXRlKTtcblxuICAgIC8vIEZldGNoIGFsbCB0aGUgZXhpc3RpbmcgdGFibGVzIG9uIHN0YXJ0dXAuIFRoaXMgYWxsb3dzIHVzIHRvIHNwZWNpYWwgY2FzZSB0aGVcbiAgICAvLyBjcmVhdGlvbiBvZiBuZXcgdGFibGVzIGV2ZW4gd2hlbiB0aGUgZm9ybSBpc24ndCB2ZXJzaW9uIDEuIElmIHRoZSB0YWJsZSBkb2Vzbid0XG4gICAgLy8gZXhpc3QsIHdlIGNhbiBwcmV0ZW5kIHRoZSBmb3JtIGlzIHZlcnNpb24gMSBzbyBpdCBjcmVhdGVzIGFsbCBuZXcgdGFibGVzIGluc3RlYWRcbiAgICAvLyBvZiBhcHBseWluZyBhIHNjaGVtYSBkaWZmLlxuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCB0aGlzLnJ1bihcIlNFTEVDVCB0YWJsZV9uYW1lIEFTIG5hbWUgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFdIRVJFIHRhYmxlX3NjaGVtYT0ncHVibGljJ1wiKTtcblxuICAgIHRoaXMuZGF0YVNjaGVtYSA9IGZ1bGNydW0uYXJncy5tc3NjaGVtYSB8fCAncHVibGljJztcbiAgICB0aGlzLnRhYmxlTmFtZXMgPSByb3dzLm1hcChvID0+IG8ubmFtZSk7XG5cbiAgICAvLyBtYWtlIGEgY2xpZW50IHNvIHdlIGNhbiB1c2UgaXQgdG8gYnVpbGQgU1FMIHN0YXRlbWVudHNcbiAgICB0aGlzLnBnZGIgPSBuZXcgUG9zdGdyZXMoe30pO1xuICB9XG5cbiAgYXN5bmMgZGVhY3RpdmF0ZSgpIHtcbiAgICBpZiAodGhpcy5wb29sKSB7XG4gICAgICBhd2FpdCB0aGlzLnBvb2wuZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgcnVuID0gYXN5bmMgKHNxbCkgPT4ge1xuICAgIHNxbCA9IHNxbC5yZXBsYWNlKC9cXDAvZywgJycpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5kZWJ1Zykge1xuICAgICAgY29uc29sZS5sb2coc3FsKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXdhaXQgcG9vbC5yZXF1ZXN0KCkucXVlcnkoc3FsKVxuICB9XG5cbiAgbG9nID0gKC4uLmFyZ3MpID0+IHtcbiAgICAvLyBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgfVxuXG4gIHRhYmxlTmFtZSA9IChhY2NvdW50LCBuYW1lKSA9PiB7XG4gICAgcmV0dXJuICdhY2NvdW50XycgKyBhY2NvdW50LnJvd0lEICsgJ18nICsgbmFtZTtcbiAgfVxuXG4gIG9uRm9ybVNhdmUgPSBhc3luYyAoe2Zvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm19KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmQsIGFjY291bnR9KSA9PiB7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVSZWNvcmQocmVjb3JkLCBhY2NvdW50KTtcbiAgfVxuXG4gIG9uUmVjb3JkRGVsZXRlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IFBvc3RncmVzUmVjb3JkVmFsdWVzLmRlbGV0ZUZvclJlY29yZFN0YXRlbWVudHModGhpcy5wZ2RiLCByZWNvcmQsIHJlY29yZC5mb3JtKTtcblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMubWFwKG8gPT4gby5zcWwpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIG9uQ2hvaWNlTGlzdFNhdmUgPSBhc3luYyAoe29iamVjdH0pID0+IHtcbiAgfVxuXG4gIG9uQ2xhc3NpZmljYXRpb25TZXRTYXZlID0gYXN5bmMgKHtvYmplY3R9KSA9PiB7XG4gIH1cblxuICBvblByb2plY3RTYXZlID0gYXN5bmMgKHtvYmplY3R9KSA9PiB7XG4gIH1cblxuICByZWxvYWRUYWJsZUxpc3QgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IHRoaXMucnVuKFwiU0VMRUNUIHRhYmxlX25hbWUgQVMgbmFtZSBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgV0hFUkUgdGFibGVfc2NoZW1hPSdwdWJsaWMnXCIpO1xuXG4gICAgdGhpcy50YWJsZU5hbWVzID0gcm93cy5tYXAobyA9PiBvLm5hbWUpO1xuICB9XG5cbiAgdXBkYXRlUmVjb3JkID0gYXN5bmMgKHJlY29yZCwgYWNjb3VudCwgc2tpcFRhYmxlQ2hlY2spID0+IHtcbiAgICBpZiAoIXNraXBUYWJsZUNoZWNrICYmICF0aGlzLnJvb3RUYWJsZUV4aXN0cyhyZWNvcmQuZm9ybSkpIHtcbiAgICAgIGF3YWl0IHRoaXMucmVidWlsZEZvcm0ocmVjb3JkLmZvcm0sIGFjY291bnQsICgpID0+IHt9KTtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gUG9zdGdyZXNSZWNvcmRWYWx1ZXMudXBkYXRlRm9yUmVjb3JkU3RhdGVtZW50cyh0aGlzLnBnZGIsIHJlY29yZCk7XG5cbiAgICBhd2FpdCB0aGlzLnJ1bihzdGF0ZW1lbnRzLm1hcChvID0+IG8uc3FsKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICByb290VGFibGVFeGlzdHMgPSAoZm9ybSkgPT4ge1xuICAgIHJldHVybiB0aGlzLnRhYmxlTmFtZXMuaW5kZXhPZihQb3N0Z3Jlc1JlY29yZFZhbHVlcy50YWJsZU5hbWVXaXRoRm9ybShmb3JtKSkgIT09IC0xO1xuICB9XG5cbiAgcmVjcmVhdGVGb3JtVGFibGVzID0gYXN5bmMgKGZvcm0sIGFjY291bnQpID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVGb3JtKGZvcm0sIGFjY291bnQsIHRoaXMuZm9ybVZlcnNpb24oZm9ybSksIG51bGwpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICBpZiAoZnVsY3J1bS5hcmdzLmRlYnVnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3Ioc3FsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUZvcm0oZm9ybSwgYWNjb3VudCwgbnVsbCwgdGhpcy5mb3JtVmVyc2lvbihmb3JtKSk7XG4gIH1cblxuICB1cGRhdGVGb3JtID0gYXN5bmMgKGZvcm0sIGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pID0+IHtcbiAgICBpZiAoIXRoaXMucm9vdFRhYmxlRXhpc3RzKGZvcm0pICYmIG5ld0Zvcm0gIT0gbnVsbCkge1xuICAgICAgb2xkRm9ybSA9IG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qge3N0YXRlbWVudHN9ID0gYXdhaXQgUG9zdGdyZXNTY2hlbWEuZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzKGFjY291bnQsIG9sZEZvcm0sIG5ld0Zvcm0pO1xuXG4gICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIG51bGwpO1xuXG4gICAgZm9yIChjb25zdCByZXBlYXRhYmxlIG9mIGZvcm0uZWxlbWVudHNPZlR5cGUoJ1JlcGVhdGFibGUnKSkge1xuICAgICAgYXdhaXQgdGhpcy5kcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMucnVuKHN0YXRlbWVudHMuam9pbignXFxuJykpO1xuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVGcmllbmRseVZpZXcoZm9ybSwgbnVsbCk7XG5cbiAgICBmb3IgKGNvbnN0IHJlcGVhdGFibGUgb2YgZm9ybS5lbGVtZW50c09mVHlwZSgnUmVwZWF0YWJsZScpKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkcm9wRnJpZW5kbHlWaWV3KGZvcm0sIHJlcGVhdGFibGUpIHtcbiAgICBjb25zdCB2aWV3TmFtZSA9IHJlcGVhdGFibGUgPyBgJHtmb3JtLm5hbWV9IC0gJHtyZXBlYXRhYmxlLmRhdGFOYW1lfWAgOiBmb3JtLm5hbWU7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5ydW4oZm9ybWF0KCdEUk9QIFZJRVcgSUYgRVhJU1RTICVzLiVzOycsIHRoaXMucGdkYi5pZGVudCh0aGlzLmRhdGFTY2hlbWEpLCB0aGlzLnBnZGIuaWRlbnQodmlld05hbWUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihleCk7XG4gICAgICB9XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZUZyaWVuZGx5Vmlldyhmb3JtLCByZXBlYXRhYmxlKSB7XG4gICAgY29uc3Qgdmlld05hbWUgPSByZXBlYXRhYmxlID8gYCR7Zm9ybS5uYW1lfSAtICR7cmVwZWF0YWJsZS5kYXRhTmFtZX1gIDogZm9ybS5uYW1lO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKGZvcm1hdCgnQ1JFQVRFIFZJRVcgJXMuJXMgQVMgU0VMRUNUICogRlJPTSAlc192aWV3X2Z1bGw7JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBnZGIuaWRlbnQodGhpcy5kYXRhU2NoZW1hKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBnZGIuaWRlbnQodmlld05hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBvc3RncmVzUmVjb3JkVmFsdWVzLnRhYmxlTmFtZVdpdGhGb3JtKGZvcm0sIHJlcGVhdGFibGUpKSk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChmdWxjcnVtLmFyZ3MuZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihleCk7XG4gICAgICB9XG4gICAgICAvLyBzb21ldGltZXMgaXQgZG9lc24ndCBleGlzdFxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlYnVpbGRGb3JtKGZvcm0sIGFjY291bnQsIHByb2dyZXNzKSB7XG4gICAgYXdhaXQgdGhpcy5yZWNyZWF0ZUZvcm1UYWJsZXMoZm9ybSwgYWNjb3VudCk7XG4gICAgYXdhaXQgdGhpcy5yZWxvYWRUYWJsZUxpc3QoKTtcblxuICAgIGxldCBpbmRleCA9IDA7XG5cbiAgICBhd2FpdCBmb3JtLmZpbmRFYWNoUmVjb3JkKHt9LCBhc3luYyAocmVjb3JkKSA9PiB7XG4gICAgICByZWNvcmQuZm9ybSA9IGZvcm07XG5cbiAgICAgIGlmICgrK2luZGV4ICUgMTAgPT09IDApIHtcbiAgICAgICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZVJlY29yZChyZWNvcmQsIGFjY291bnQsIHRydWUpO1xuICAgIH0pO1xuXG4gICAgcHJvZ3Jlc3MoaW5kZXgpO1xuICB9XG5cbiAgZm9ybVZlcnNpb24gPSAoZm9ybSkgPT4ge1xuICAgIGlmIChmb3JtID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZm9ybS5faWQsXG4gICAgICByb3dfaWQ6IGZvcm0ucm93SUQsXG4gICAgICBuYW1lOiBmb3JtLl9uYW1lLFxuICAgICAgZWxlbWVudHM6IGZvcm0uX2VsZW1lbnRzSlNPTlxuICAgIH07XG4gIH1cbn1cbiJdfQ==