'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _schema = require('fulcrum-schema/dist/schema');

var _schema2 = _interopRequireDefault(_schema);

var _metadata = require('fulcrum-schema/dist/metadata');

var _metadata2 = _interopRequireDefault(_metadata);

var _sqldiff = require('sqldiff');

var _sqldiff2 = _interopRequireDefault(_sqldiff);

var _mssqlSchema = require('./mssql-schema');

var _mssqlSchema2 = _interopRequireDefault(_mssqlSchema);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const { SchemaDiffer, MSSQL } = _sqldiff2.default;

class MSSQLSchema {
  static generateSchemaStatements(account, oldForm, newForm, { disableArrays, disableComplexTypes, userModule, tableSchema, calculatedFieldDateFormat, metadata, useResourceID, accountPrefix }) {
    return _asyncToGenerator(function* () {
      let oldSchema = null;
      let newSchema = null;

      _mssqlSchema2.default.disableArrays = disableArrays;
      _mssqlSchema2.default.disableComplexTypes = disableComplexTypes;
      _mssqlSchema2.default.calculatedFieldDateFormat = calculatedFieldDateFormat;

      if (userModule && userModule.updateSchema && !_mssqlSchema2.default._modified) {
        userModule.updateSchema(_mssqlSchema2.default);

        _mssqlSchema2.default._modified = true;
      }

      if (useResourceID) {
        if (oldForm) {
          oldForm = _extends({}, oldForm, { row_id: oldForm.id });
        }
        if (newForm) {
          newForm = _extends({}, newForm, { row_id: newForm.id });
        }
      }

      if (oldForm) {
        oldSchema = new _schema2.default(oldForm, _mssqlSchema2.default, userModule && userModule.schemaOptions);
      }

      if (newForm) {
        newSchema = new _schema2.default(newForm, _mssqlSchema2.default, userModule && userModule.schemaOptions);
      }

      const differ = new SchemaDiffer(oldSchema, newSchema);

      const meta = new _metadata2.default(differ, { quote: '"', schema: tableSchema, prefix: 'system_', useAliases: false });
      const generator = new MSSQL(differ, { afterTransform: metadata && meta.build.bind(meta) });

      generator.tablePrefix = accountPrefix != null ? accountPrefix + '_' : '';

      if (tableSchema) {
        generator.tableSchema = tableSchema;
      }

      const statements = generator.generate();

      return { statements, oldSchema, newSchema };
    })();
  }
}
exports.default = MSSQLSchema;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NjaGVtYS5qcyJdLCJuYW1lcyI6WyJTY2hlbWFEaWZmZXIiLCJNU1NRTCIsIk1TU1FMU2NoZW1hIiwiZ2VuZXJhdGVTY2hlbWFTdGF0ZW1lbnRzIiwiYWNjb3VudCIsIm9sZEZvcm0iLCJuZXdGb3JtIiwiZGlzYWJsZUFycmF5cyIsImRpc2FibGVDb21wbGV4VHlwZXMiLCJ1c2VyTW9kdWxlIiwidGFibGVTY2hlbWEiLCJjYWxjdWxhdGVkRmllbGREYXRlRm9ybWF0IiwibWV0YWRhdGEiLCJ1c2VSZXNvdXJjZUlEIiwiYWNjb3VudFByZWZpeCIsIm9sZFNjaGVtYSIsIm5ld1NjaGVtYSIsInVwZGF0ZVNjaGVtYSIsIl9tb2RpZmllZCIsInJvd19pZCIsImlkIiwic2NoZW1hT3B0aW9ucyIsImRpZmZlciIsIm1ldGEiLCJxdW90ZSIsInNjaGVtYSIsInByZWZpeCIsInVzZUFsaWFzZXMiLCJnZW5lcmF0b3IiLCJhZnRlclRyYW5zZm9ybSIsImJ1aWxkIiwiYmluZCIsInRhYmxlUHJlZml4Iiwic3RhdGVtZW50cyIsImdlbmVyYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7OztBQUVBLE1BQU0sRUFBQ0EsWUFBRCxFQUFlQyxLQUFmLHNCQUFOOztBQUVlLE1BQU1DLFdBQU4sQ0FBa0I7QUFDL0IsU0FBYUMsd0JBQWIsQ0FBc0NDLE9BQXRDLEVBQStDQyxPQUEvQyxFQUF3REMsT0FBeEQsRUFBaUUsRUFBQ0MsYUFBRCxFQUFnQkMsbUJBQWhCLEVBQXFDQyxVQUFyQyxFQUFpREMsV0FBakQsRUFBOERDLHlCQUE5RCxFQUF5RkMsUUFBekYsRUFBbUdDLGFBQW5HLEVBQWtIQyxhQUFsSCxFQUFqRSxFQUFtTTtBQUFBO0FBQ2pNLFVBQUlDLFlBQVksSUFBaEI7QUFDQSxVQUFJQyxZQUFZLElBQWhCOztBQUVBLDRCQUFTVCxhQUFULEdBQXlCQSxhQUF6QjtBQUNBLDRCQUFTQyxtQkFBVCxHQUErQkEsbUJBQS9CO0FBQ0EsNEJBQVNHLHlCQUFULEdBQXFDQSx5QkFBckM7O0FBRUEsVUFBSUYsY0FBY0EsV0FBV1EsWUFBekIsSUFBeUMsQ0FBQyxzQkFBU0MsU0FBdkQsRUFBa0U7QUFDaEVULG1CQUFXUSxZQUFYOztBQUVBLDhCQUFTQyxTQUFULEdBQXFCLElBQXJCO0FBQ0Q7O0FBRUQsVUFBSUwsYUFBSixFQUFtQjtBQUNqQixZQUFJUixPQUFKLEVBQWE7QUFDWEEsaUNBQWNBLE9BQWQsSUFBdUJjLFFBQVFkLFFBQVFlLEVBQXZDO0FBQ0Q7QUFDRCxZQUFJZCxPQUFKLEVBQWE7QUFDWEEsaUNBQWNBLE9BQWQsSUFBdUJhLFFBQVFiLFFBQVFjLEVBQXZDO0FBQ0Q7QUFDRjs7QUFFRCxVQUFJZixPQUFKLEVBQWE7QUFDWFUsb0JBQVkscUJBQVdWLE9BQVgseUJBQThCSSxjQUFjQSxXQUFXWSxhQUF2RCxDQUFaO0FBQ0Q7O0FBRUQsVUFBSWYsT0FBSixFQUFhO0FBQ1hVLG9CQUFZLHFCQUFXVixPQUFYLHlCQUE4QkcsY0FBY0EsV0FBV1ksYUFBdkQsQ0FBWjtBQUNEOztBQUVELFlBQU1DLFNBQVMsSUFBSXRCLFlBQUosQ0FBaUJlLFNBQWpCLEVBQTRCQyxTQUE1QixDQUFmOztBQUVBLFlBQU1PLE9BQU8sdUJBQWFELE1BQWIsRUFBcUIsRUFBQ0UsT0FBTyxHQUFSLEVBQWFDLFFBQVFmLFdBQXJCLEVBQWtDZ0IsUUFBUSxTQUExQyxFQUFxREMsWUFBWSxLQUFqRSxFQUFyQixDQUFiO0FBQ0EsWUFBTUMsWUFBWSxJQUFJM0IsS0FBSixDQUFVcUIsTUFBVixFQUFrQixFQUFDTyxnQkFBZ0JqQixZQUFZVyxLQUFLTyxLQUFMLENBQVdDLElBQVgsQ0FBZ0JSLElBQWhCLENBQTdCLEVBQWxCLENBQWxCOztBQUVBSyxnQkFBVUksV0FBVixHQUF3QmxCLGlCQUFpQixJQUFqQixHQUF3QkEsZ0JBQWdCLEdBQXhDLEdBQThDLEVBQXRFOztBQUVBLFVBQUlKLFdBQUosRUFBaUI7QUFDZmtCLGtCQUFVbEIsV0FBVixHQUF3QkEsV0FBeEI7QUFDRDs7QUFFRCxZQUFNdUIsYUFBYUwsVUFBVU0sUUFBVixFQUFuQjs7QUFFQSxhQUFPLEVBQUNELFVBQUQsRUFBYWxCLFNBQWIsRUFBd0JDLFNBQXhCLEVBQVA7QUE1Q2lNO0FBNkNsTTtBQTlDOEI7a0JBQVpkLFciLCJmaWxlIjoic2NoZW1hLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFNjaGVtYSBmcm9tICdmdWxjcnVtLXNjaGVtYS9kaXN0L3NjaGVtYSc7XG5pbXBvcnQgTWV0YWRhdGEgZnJvbSAnZnVsY3J1bS1zY2hlbWEvZGlzdC9tZXRhZGF0YSc7XG5pbXBvcnQgc3FsZGlmZiBmcm9tICdzcWxkaWZmJztcbmltcG9ydCBNU1NjaGVtYSBmcm9tICcuL21zc3FsLXNjaGVtYSc7XG5cbmNvbnN0IHtTY2hlbWFEaWZmZXIsIE1TU1FMfSA9IHNxbGRpZmY7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1TU1FMU2NoZW1hIHtcbiAgc3RhdGljIGFzeW5jIGdlbmVyYXRlU2NoZW1hU3RhdGVtZW50cyhhY2NvdW50LCBvbGRGb3JtLCBuZXdGb3JtLCB7ZGlzYWJsZUFycmF5cywgZGlzYWJsZUNvbXBsZXhUeXBlcywgdXNlck1vZHVsZSwgdGFibGVTY2hlbWEsIGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQsIG1ldGFkYXRhLCB1c2VSZXNvdXJjZUlELCBhY2NvdW50UHJlZml4fSkge1xuICAgIGxldCBvbGRTY2hlbWEgPSBudWxsO1xuICAgIGxldCBuZXdTY2hlbWEgPSBudWxsO1xuXG4gICAgTVNTY2hlbWEuZGlzYWJsZUFycmF5cyA9IGRpc2FibGVBcnJheXM7XG4gICAgTVNTY2hlbWEuZGlzYWJsZUNvbXBsZXhUeXBlcyA9IGRpc2FibGVDb21wbGV4VHlwZXM7XG4gICAgTVNTY2hlbWEuY2FsY3VsYXRlZEZpZWxkRGF0ZUZvcm1hdCA9IGNhbGN1bGF0ZWRGaWVsZERhdGVGb3JtYXQ7XG5cbiAgICBpZiAodXNlck1vZHVsZSAmJiB1c2VyTW9kdWxlLnVwZGF0ZVNjaGVtYSAmJiAhTVNTY2hlbWEuX21vZGlmaWVkKSB7XG4gICAgICB1c2VyTW9kdWxlLnVwZGF0ZVNjaGVtYShNU1NjaGVtYSk7XG5cbiAgICAgIE1TU2NoZW1hLl9tb2RpZmllZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHVzZVJlc291cmNlSUQpIHtcbiAgICAgIGlmIChvbGRGb3JtKSB7XG4gICAgICAgIG9sZEZvcm0gPSB7Li4ub2xkRm9ybSwgcm93X2lkOiBvbGRGb3JtLmlkfTtcbiAgICAgIH1cbiAgICAgIGlmIChuZXdGb3JtKSB7XG4gICAgICAgIG5ld0Zvcm0gPSB7Li4ubmV3Rm9ybSwgcm93X2lkOiBuZXdGb3JtLmlkfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob2xkRm9ybSkge1xuICAgICAgb2xkU2NoZW1hID0gbmV3IFNjaGVtYShvbGRGb3JtLCBNU1NjaGVtYSwgdXNlck1vZHVsZSAmJiB1c2VyTW9kdWxlLnNjaGVtYU9wdGlvbnMpO1xuICAgIH1cblxuICAgIGlmIChuZXdGb3JtKSB7XG4gICAgICBuZXdTY2hlbWEgPSBuZXcgU2NoZW1hKG5ld0Zvcm0sIE1TU2NoZW1hLCB1c2VyTW9kdWxlICYmIHVzZXJNb2R1bGUuc2NoZW1hT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgY29uc3QgZGlmZmVyID0gbmV3IFNjaGVtYURpZmZlcihvbGRTY2hlbWEsIG5ld1NjaGVtYSk7XG5cbiAgICBjb25zdCBtZXRhID0gbmV3IE1ldGFkYXRhKGRpZmZlciwge3F1b3RlOiAnXCInLCBzY2hlbWE6IHRhYmxlU2NoZW1hLCBwcmVmaXg6ICdzeXN0ZW1fJywgdXNlQWxpYXNlczogZmFsc2V9KTtcbiAgICBjb25zdCBnZW5lcmF0b3IgPSBuZXcgTVNTUUwoZGlmZmVyLCB7YWZ0ZXJUcmFuc2Zvcm06IG1ldGFkYXRhICYmIG1ldGEuYnVpbGQuYmluZChtZXRhKX0pO1xuXG4gICAgZ2VuZXJhdG9yLnRhYmxlUHJlZml4ID0gYWNjb3VudFByZWZpeCAhPSBudWxsID8gYWNjb3VudFByZWZpeCArICdfJyA6ICcnO1xuXG4gICAgaWYgKHRhYmxlU2NoZW1hKSB7XG4gICAgICBnZW5lcmF0b3IudGFibGVTY2hlbWEgPSB0YWJsZVNjaGVtYTtcbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gZ2VuZXJhdG9yLmdlbmVyYXRlKCk7XG5cbiAgICByZXR1cm4ge3N0YXRlbWVudHMsIG9sZFNjaGVtYSwgbmV3U2NoZW1hfTtcbiAgfVxufVxuIl19