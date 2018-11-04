'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _schema = require('fulcrum-schema/dist/schema');

var _schema2 = _interopRequireDefault(_schema);

var _sqldiff = require('sqldiff');

var _sqldiff2 = _interopRequireDefault(_sqldiff);

var _mssqlSchema = require('./mssql-schema');

var _mssqlSchema2 = _interopRequireDefault(_mssqlSchema);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const { SchemaDiffer, MSSQL } = _sqldiff2.default;

class MSSQLSchema {
  static generateSchemaStatements(account, oldForm, newForm, disableArrays, disableComplexTypes, userModule, tableSchema) {
    return _asyncToGenerator(function* () {
      let oldSchema = null;
      let newSchema = null;

      _mssqlSchema2.default.disableArrays = disableArrays;
      _mssqlSchema2.default.disableComplexTypes = disableComplexTypes;

      if (userModule && userModule.updateSchema && !_mssqlSchema2.default._modified) {
        userModule.updateSchema(_mssqlSchema2.default);

        _mssqlSchema2.default._modified = true;
      }

      if (oldForm) {
        oldSchema = new _schema2.default(oldForm, _mssqlSchema2.default, userModule && userModule.schemaOptions);
      }

      if (newForm) {
        newSchema = new _schema2.default(newForm, _mssqlSchema2.default, userModule && userModule.schemaOptions);
      }

      const differ = new SchemaDiffer(oldSchema, newSchema);
      const generator = new MSSQL(differ, { afterTransform: null });

      generator.tablePrefix = 'account_' + account.rowID + '_';

      if (tableSchema) {
        generator.tableSchema = tableSchema;
      }

      const statements = generator.generate();

      return { statements, oldSchema, newSchema };
    })();
  }
}
exports.default = MSSQLSchema;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NjaGVtYS5qcyJdLCJuYW1lcyI6WyJTY2hlbWFEaWZmZXIiLCJNU1NRTCIsIk1TU1FMU2NoZW1hIiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiYWNjb3VudCIsIm9sZEZvcm0iLCJuZXdGb3JtIiwiZGlzYWJsZUFycmF5cyIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJ1c2VyTW9kdWxlIiwidGFibGVTY2hlbWEiLCJvbGRTY2hlbWEiLCJuZXdTY2hlbWEiLCJ1cGRhdGVTY2hlbWEiLCJfbW9kaWZpZWQiLCJzY2hlbWFPcHRpb25zIiwiZGlmZmVyIiwiZ2VuZXJhdG9yIiwiYWZ0ZXJUcmFuc2Zvcm0iLCJ0YWJsZVByZWZpeCIsInJvd0lEIiwic3RhdGVtZW50cyIsImdlbmVyYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUEsTUFBTSxFQUFDQSxZQUFELEVBQWVDLEtBQWYsc0JBQU47O0FBRWUsTUFBTUMsV0FBTixDQUFrQjtBQUMvQixTQUFhQyx3QkFBYixDQUFzQ0MsT0FBdEMsRUFBK0NDLE9BQS9DLEVBQXdEQyxPQUF4RCxFQUFpRUMsYUFBakUsRUFBZ0ZDLG1CQUFoRixFQUFxR0MsVUFBckcsRUFBaUhDLFdBQWpILEVBQThIO0FBQUE7QUFDNUgsVUFBSUMsWUFBWSxJQUFoQjtBQUNBLFVBQUlDLFlBQVksSUFBaEI7O0FBRUEsNEJBQVNMLGFBQVQsR0FBeUJBLGFBQXpCO0FBQ0EsNEJBQVNDLG1CQUFULEdBQStCQSxtQkFBL0I7O0FBRUEsVUFBSUMsY0FBY0EsV0FBV0ksWUFBekIsSUFBeUMsQ0FBQyxzQkFBU0MsU0FBdkQsRUFBa0U7QUFDaEVMLG1CQUFXSSxZQUFYOztBQUVBLDhCQUFTQyxTQUFULEdBQXFCLElBQXJCO0FBQ0Q7O0FBRUQsVUFBSVQsT0FBSixFQUFhO0FBQ1hNLG9CQUFZLHFCQUFXTixPQUFYLHlCQUE4QkksY0FBY0EsV0FBV00sYUFBdkQsQ0FBWjtBQUNEOztBQUVELFVBQUlULE9BQUosRUFBYTtBQUNYTSxvQkFBWSxxQkFBV04sT0FBWCx5QkFBOEJHLGNBQWNBLFdBQVdNLGFBQXZELENBQVo7QUFDRDs7QUFFRCxZQUFNQyxTQUFTLElBQUloQixZQUFKLENBQWlCVyxTQUFqQixFQUE0QkMsU0FBNUIsQ0FBZjtBQUNBLFlBQU1LLFlBQVksSUFBSWhCLEtBQUosQ0FBVWUsTUFBVixFQUFrQixFQUFDRSxnQkFBZ0IsSUFBakIsRUFBbEIsQ0FBbEI7O0FBRUFELGdCQUFVRSxXQUFWLEdBQXdCLGFBQWFmLFFBQVFnQixLQUFyQixHQUE2QixHQUFyRDs7QUFFQSxVQUFJVixXQUFKLEVBQWlCO0FBQ2ZPLGtCQUFVUCxXQUFWLEdBQXdCQSxXQUF4QjtBQUNEOztBQUVELFlBQU1XLGFBQWFKLFVBQVVLLFFBQVYsRUFBbkI7O0FBRUEsYUFBTyxFQUFDRCxVQUFELEVBQWFWLFNBQWIsRUFBd0JDLFNBQXhCLEVBQVA7QUFoQzRIO0FBaUM3SDtBQWxDOEI7a0JBQVpWLFciLCJmaWxlIjoic2NoZW1hLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFNjaGVtYSBmcm9tICdmdWxjcnVtLXNjaGVtYS9kaXN0L3NjaGVtYSc7XG5pbXBvcnQgc3FsZGlmZiBmcm9tICdzcWxkaWZmJztcbmltcG9ydCBNU1NjaGVtYSBmcm9tICcuL21zc3FsLXNjaGVtYSc7XG5cbmNvbnN0IHtTY2hlbWFEaWZmZXIsIE1TU1FMfSA9IHNxbGRpZmY7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1TU1FMU2NoZW1hIHtcbiAgc3RhdGljIGFzeW5jIGdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtLCBkaXNhYmxlQXJyYXlzLCBkaXNhYmxlQ29tcGxleFR5cGVzLCB1c2VyTW9kdWxlLCB0YWJsZVNjaGVtYSkge1xuICAgIGxldCBvbGRTY2hlbWEgPSBudWxsO1xuICAgIGxldCBuZXdTY2hlbWEgPSBudWxsO1xuXG4gICAgTVNTY2hlbWEuZGlzYWJsZUFycmF5cyA9IGRpc2FibGVBcnJheXM7XG4gICAgTVNTY2hlbWEuZGlzYWJsZUNvbXBsZXhUeXBlcyA9IGRpc2FibGVDb21wbGV4VHlwZXM7XG5cbiAgICBpZiAodXNlck1vZHVsZSAmJiB1c2VyTW9kdWxlLnVwZGF0ZVNjaGVtYSAmJiAhTVNTY2hlbWEuX21vZGlmaWVkKSB7XG4gICAgICB1c2VyTW9kdWxlLnVwZGF0ZVNjaGVtYShNU1NjaGVtYSk7XG5cbiAgICAgIE1TU2NoZW1hLl9tb2RpZmllZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG9sZEZvcm0pIHtcbiAgICAgIG9sZFNjaGVtYSA9IG5ldyBTY2hlbWEob2xkRm9ybSwgTVNTY2hlbWEsIHVzZXJNb2R1bGUgJiYgdXNlck1vZHVsZS5zY2hlbWFPcHRpb25zKTtcbiAgICB9XG5cbiAgICBpZiAobmV3Rm9ybSkge1xuICAgICAgbmV3U2NoZW1hID0gbmV3IFNjaGVtYShuZXdGb3JtLCBNU1NjaGVtYSwgdXNlck1vZHVsZSAmJiB1c2VyTW9kdWxlLnNjaGVtYU9wdGlvbnMpO1xuICAgIH1cblxuICAgIGNvbnN0IGRpZmZlciA9IG5ldyBTY2hlbWFEaWZmZXIob2xkU2NoZW1hLCBuZXdTY2hlbWEpO1xuICAgIGNvbnN0IGdlbmVyYXRvciA9IG5ldyBNU1NRTChkaWZmZXIsIHthZnRlclRyYW5zZm9ybTogbnVsbH0pO1xuXG4gICAgZ2VuZXJhdG9yLnRhYmxlUHJlZml4ID0gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXyc7XG5cbiAgICBpZiAodGFibGVTY2hlbWEpIHtcbiAgICAgIGdlbmVyYXRvci50YWJsZVNjaGVtYSA9IHRhYmxlU2NoZW1hO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBnZW5lcmF0b3IuZ2VuZXJhdGUoKTtcblxuICAgIHJldHVybiB7c3RhdGVtZW50cywgb2xkU2NoZW1hLCBuZXdTY2hlbWF9O1xuICB9XG59XG4iXX0=