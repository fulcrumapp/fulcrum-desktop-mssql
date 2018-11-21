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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NjaGVtYS5qcyJdLCJuYW1lcyI6WyJTY2hlbWFEaWZmZXIiLCJNU1NRTCIsIk1TU1FMU2NoZW1hIiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiYWNjb3VudCIsIm9sZEZvcm0iLCJuZXdGb3JtIiwiZGlzYWJsZUFycmF5cyIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJ1c2VyTW9kdWxlIiwidGFibGVTY2hlbWEiLCJvbGRTY2hlbWEiLCJuZXdTY2hlbWEiLCJ1cGRhdGVTY2hlbWEiLCJfbW9kaWZpZWQiLCJzY2hlbWFPcHRpb25zIiwiZGlmZmVyIiwiZ2VuZXJhdG9yIiwiYWZ0ZXJUcmFuc2Zvcm0iLCJ0YWJsZVByZWZpeCIsInJvd0lEIiwic3RhdGVtZW50cyIsImdlbmVyYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUEsTUFBTSxFQUFDQSxZQUFELEVBQWVDLEtBQWYsc0JBQU47O0FBRWUsTUFBTUMsV0FBTixDQUFrQjtBQUMvQixXQUFhQyx3QkFBYixDQUFzQ0MsT0FBdEMsRUFBK0NDLE9BQS9DLEVBQXdEQyxPQUF4RCxFQUFpRUMsYUFBakUsRUFBZ0ZDLG1CQUFoRixFQUFxR0MsVUFBckcsRUFBaUhDLFdBQWpILEVBQThIO0FBQUE7QUFDNUgsZ0JBQUlDLFlBQVksSUFBaEI7QUFDQSxnQkFBSUMsWUFBWSxJQUFoQjs7QUFFQSxrQ0FBU0wsYUFBVCxHQUF5QkEsYUFBekI7QUFDQSxrQ0FBU0MsbUJBQVQsR0FBK0JBLG1CQUEvQjs7QUFFQSxnQkFBSUMsY0FBY0EsV0FBV0ksWUFBekIsSUFBeUMsQ0FBQyxzQkFBU0MsU0FBdkQsRUFBa0U7QUFDaEVMLDJCQUFXSSxZQUFYOztBQUVBLHNDQUFTQyxTQUFULEdBQXFCLElBQXJCO0FBQ0Q7O0FBRUQsZ0JBQUlULE9BQUosRUFBYTtBQUNYTSw0QkFBWSxxQkFBV04sT0FBWCx5QkFBOEJJLGNBQWNBLFdBQVdNLGFBQXZELENBQVo7QUFDRDs7QUFFRCxnQkFBSVQsT0FBSixFQUFhO0FBQ1hNLDRCQUFZLHFCQUFXTixPQUFYLHlCQUE4QkcsY0FBY0EsV0FBV00sYUFBdkQsQ0FBWjtBQUNEOztBQUVELGtCQUFNQyxTQUFTLElBQUloQixZQUFKLENBQWlCVyxTQUFqQixFQUE0QkMsU0FBNUIsQ0FBZjtBQUNBLGtCQUFNSyxZQUFZLElBQUloQixLQUFKLENBQVVlLE1BQVYsRUFBa0IsRUFBQ0UsZ0JBQWdCLElBQWpCLEVBQWxCLENBQWxCOztBQUVBRCxzQkFBVUUsV0FBVixHQUF3QixhQUFhZixRQUFRZ0IsS0FBckIsR0FBNkIsR0FBckQ7O0FBRUEsZ0JBQUlWLFdBQUosRUFBaUI7QUFDZk8sMEJBQVVQLFdBQVYsR0FBd0JBLFdBQXhCO0FBQ0Q7O0FBRUQsa0JBQU1XLGFBQWFKLFVBQVVLLFFBQVYsRUFBbkI7O0FBRUEsbUJBQU8sRUFBQ0QsVUFBRCxFQUFhVixTQUFiLEVBQXdCQyxTQUF4QixFQUFQO0FBaEM0SDtBQWlDN0g7QUFsQzhCO2tCQUFaVixXIiwiZmlsZSI6InNjaGVtYS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBTY2hlbWEgZnJvbSAnZnVsY3J1bS1zY2hlbWEvZGlzdC9zY2hlbWEnO1xyXG5pbXBvcnQgc3FsZGlmZiBmcm9tICdzcWxkaWZmJztcclxuaW1wb3J0IE1TU2NoZW1hIGZyb20gJy4vbXNzcWwtc2NoZW1hJztcclxuXHJcbmNvbnN0IHtTY2hlbWFEaWZmZXIsIE1TU1FMfSA9IHNxbGRpZmY7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNU1NRTFNjaGVtYSB7XHJcbiAgc3RhdGljIGFzeW5jIGdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtLCBkaXNhYmxlQXJyYXlzLCBkaXNhYmxlQ29tcGxleFR5cGVzLCB1c2VyTW9kdWxlLCB0YWJsZVNjaGVtYSkge1xyXG4gICAgbGV0IG9sZFNjaGVtYSA9IG51bGw7XHJcbiAgICBsZXQgbmV3U2NoZW1hID0gbnVsbDtcclxuXHJcbiAgICBNU1NjaGVtYS5kaXNhYmxlQXJyYXlzID0gZGlzYWJsZUFycmF5cztcclxuICAgIE1TU2NoZW1hLmRpc2FibGVDb21wbGV4VHlwZXMgPSBkaXNhYmxlQ29tcGxleFR5cGVzO1xyXG5cclxuICAgIGlmICh1c2VyTW9kdWxlICYmIHVzZXJNb2R1bGUudXBkYXRlU2NoZW1hICYmICFNU1NjaGVtYS5fbW9kaWZpZWQpIHtcclxuICAgICAgdXNlck1vZHVsZS51cGRhdGVTY2hlbWEoTVNTY2hlbWEpO1xyXG5cclxuICAgICAgTVNTY2hlbWEuX21vZGlmaWVkID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAob2xkRm9ybSkge1xyXG4gICAgICBvbGRTY2hlbWEgPSBuZXcgU2NoZW1hKG9sZEZvcm0sIE1TU2NoZW1hLCB1c2VyTW9kdWxlICYmIHVzZXJNb2R1bGUuc2NoZW1hT3B0aW9ucyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5ld0Zvcm0pIHtcclxuICAgICAgbmV3U2NoZW1hID0gbmV3IFNjaGVtYShuZXdGb3JtLCBNU1NjaGVtYSwgdXNlck1vZHVsZSAmJiB1c2VyTW9kdWxlLnNjaGVtYU9wdGlvbnMpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGRpZmZlciA9IG5ldyBTY2hlbWFEaWZmZXIob2xkU2NoZW1hLCBuZXdTY2hlbWEpO1xyXG4gICAgY29uc3QgZ2VuZXJhdG9yID0gbmV3IE1TU1FMKGRpZmZlciwge2FmdGVyVHJhbnNmb3JtOiBudWxsfSk7XHJcblxyXG4gICAgZ2VuZXJhdG9yLnRhYmxlUHJlZml4ID0gJ2FjY291bnRfJyArIGFjY291bnQucm93SUQgKyAnXyc7XHJcblxyXG4gICAgaWYgKHRhYmxlU2NoZW1hKSB7XHJcbiAgICAgIGdlbmVyYXRvci50YWJsZVNjaGVtYSA9IHRhYmxlU2NoZW1hO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBnZW5lcmF0b3IuZ2VuZXJhdGUoKTtcclxuXHJcbiAgICByZXR1cm4ge3N0YXRlbWVudHMsIG9sZFNjaGVtYSwgbmV3U2NoZW1hfTtcclxuICB9XHJcbn1cclxuIl19