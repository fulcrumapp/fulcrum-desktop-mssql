'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const Schema = {};

Schema.includeMediaCaptions = true;
Schema.includeMediaURLs = true;
Schema.includeMediaViewURLs = true;

Schema.systemFormTableColumns = [{
  name: 'id',
  type: 'pk'
}, {
  name: 'record_id',
  type: 'integer',
  allowNull: false
}, {
  name: 'record_resource_id',
  type: 'string',
  allowNull: false
}, {
  name: 'project_id',
  type: 'integer'
}, {
  name: 'project_resource_id',
  type: 'string'
}, {
  name: 'assigned_to_id',
  type: 'integer'
}, {
  name: 'assigned_to_resource_id',
  type: 'string'
}, {
  name: 'status',
  type: 'string',
  length: 100
}, {
  name: 'latitude',
  type: 'double'
}, {
  name: 'longitude',
  type: 'double'
}, {
  name: 'created_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'updated_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'version',
  type: 'integer',
  allowNull: false
}, {
  name: 'created_by_id',
  type: 'integer',
  allowNull: false
}, {
  name: 'created_by_resource_id',
  type: 'string'
}, {
  name: 'updated_by_id',
  type: 'integer',
  allowNull: false
}, {
  name: 'updated_by_resource_id',
  type: 'string'
}, {
  name: 'server_created_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'server_updated_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'record_index_text',
  type: 'string'
}, {
  name: 'record_index',
  type: 'fts'
}, {
  name: 'geometry',
  type: 'geometry'
}, {
  name: 'altitude',
  type: 'double'
}, {
  name: 'speed',
  type: 'double'
}, {
  name: 'course',
  type: 'double'
}, {
  name: 'horizontal_accuracy',
  type: 'double'
}, {
  name: 'vertical_accuracy',
  type: 'double'
}, {
  name: 'form_values',
  type: 'text'
}, {
  name: 'changeset_id',
  type: 'integer'
}, {
  name: 'changeset_resource_id',
  type: 'string'
}, {
  name: 'title',
  type: 'string'
}, {
  name: 'created_latitude',
  type: 'double'
}, {
  name: 'created_longitude',
  type: 'double'
}, {
  name: 'created_geometry',
  type: 'geometry'
}, {
  name: 'created_altitude',
  type: 'double'
}, {
  name: 'created_horizontal_accuracy',
  type: 'double'
}, {
  name: 'updated_latitude',
  type: 'double'
}, {
  name: 'updated_longitude',
  type: 'double'
}, {
  name: 'updated_geometry',
  type: 'geometry'
}, {
  name: 'updated_altitude',
  type: 'double'
}, {
  name: 'updated_horizontal_accuracy',
  type: 'double'
}, {
  name: 'created_duration',
  type: 'integer'
}, {
  name: 'updated_duration',
  type: 'integer'
}, {
  name: 'edited_duration',
  type: 'integer'
}, {
  name: 'report_url',
  type: 'string'
}];

Schema.systemValuesTableColumns = [{
  name: 'id',
  type: 'pk'
}, {
  name: 'record_id',
  type: 'integer',
  allowNull: false
}, {
  name: 'record_resource_id',
  type: 'string'
}, {
  name: 'parent_resource_id',
  type: 'string'
}, {
  name: 'key',
  type: 'string',
  allowNull: false,
  length: 4000
}, {
  name: 'text_value',
  type: 'string',
  length: 4000
}, {
  name: 'number_value',
  type: 'double'
}];

Schema.systemRepeatableTableColumns = [{
  name: 'id',
  type: 'pk'
}, {
  name: 'resource_id',
  type: 'string',
  allowNull: false
}, {
  name: 'record_id',
  type: 'integer',
  allowNull: false
}, {
  name: 'record_resource_id',
  type: 'string',
  allowNull: false
}, {
  name: 'parent_resource_id',
  type: 'string'
}, {
  name: 'record_project_id',
  type: 'integer'
}, {
  name: 'record_project_resource_id',
  type: 'string'
}, {
  name: 'record_assigned_to_id',
  type: 'integer'
}, {
  name: 'record_assigned_to_resource_id',
  type: 'string'
}, {
  name: 'record_status',
  type: 'string',
  length: 100
}, {
  name: 'index', // TODO(zhm) make this work in the app
  type: 'integer'
}, {
  name: 'latitude',
  type: 'double'
}, {
  name: 'longitude',
  type: 'double'
}, {
  name: 'created_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'updated_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'version',
  type: 'integer',
  allowNull: false
}, {
  name: 'created_by_id',
  type: 'integer',
  allowNull: false
}, {
  name: 'created_by_resource_id',
  type: 'string'
}, {
  name: 'updated_by_id',
  type: 'integer',
  allowNull: false
}, {
  name: 'updated_by_resource_id',
  type: 'string'
}, {
  name: 'server_created_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'server_updated_at',
  type: 'timestamp',
  allowNull: false
}, {
  name: 'record_index_text',
  type: 'string'
}, {
  name: 'record_index',
  type: 'fts'
}, {
  name: 'geometry',
  type: 'geometry'
}, {
  name: 'altitude',
  type: 'double'
}, {
  name: 'speed',
  type: 'double'
}, {
  name: 'course',
  type: 'double'
}, {
  name: 'horizontal_accuracy',
  type: 'double'
}, {
  name: 'vertical_accuracy',
  type: 'double'
}, {
  name: 'form_values',
  type: 'text'
}, {
  name: 'changeset_id',
  type: 'integer'
}, {
  name: 'changeset_resource_id',
  type: 'string'
}, {
  name: 'title',
  type: 'string'
}, {
  name: 'created_latitude',
  type: 'double'
}, {
  name: 'created_longitude',
  type: 'double'
}, {
  name: 'created_geometry',
  type: 'geometry'
}, {
  name: 'created_altitude',
  type: 'double'
}, {
  name: 'created_horizontal_accuracy',
  type: 'double'
}, {
  name: 'updated_latitude',
  type: 'double'
}, {
  name: 'updated_longitude',
  type: 'double'
}, {
  name: 'updated_geometry',
  type: 'geometry'
}, {
  name: 'updated_altitude',
  type: 'double'
}, {
  name: 'updated_horizontal_accuracy',
  type: 'double'
}, {
  name: 'created_duration',
  type: 'integer'
}, {
  name: 'updated_duration',
  type: 'integer'
}, {
  name: 'edited_duration',
  type: 'integer'
}, {
  name: 'report_url',
  type: 'string'
}];

Schema.systemFormViewColumns = {
  record_resource_id: 'record_id',
  project_resource_id: 'project_id',
  assigned_to_resource_id: 'assigned_to_id',
  status: 'status',
  latitude: 'latitude',
  longitude: 'longitude',
  created_at: 'created_at',
  updated_at: 'updated_at',
  version: 'version',
  created_by_resource_id: 'created_by_id',
  updated_by_resource_id: 'updated_by_id',
  server_created_at: 'server_created_at',
  server_updated_at: 'server_updated_at',
  geometry: 'geometry',
  altitude: 'altitude',
  speed: 'speed',
  course: 'course',
  horizontal_accuracy: 'horizontal_accuracy',
  vertical_accuracy: 'vertical_accuracy',
  changeset_resource_id: 'changeset_id',
  title: 'title',
  created_latitude: 'created_latitude',
  created_longitude: 'created_longitude',
  created_altitude: 'created_altitude',
  created_horizontal_accuracy: 'created_horizontal_accuracy',
  updated_latitude: 'updated_latitude',
  updated_longitude: 'updated_longitude',
  updated_altitude: 'updated_altitude',
  updated_horizontal_accuracy: 'updated_horizontal_accuracy',
  created_duration: 'created_duration',
  updated_duration: 'updated_duration',
  edited_duration: 'edited_duration',
  report_url: 'report_url'
};

Schema.systemFormFullViewColumns = _underscore2.default.clone(Schema.systemFormViewColumns);
Schema.systemFormFullViewColumns.form_values = 'form_values';
Schema.systemFormFullViewColumns.record_index = 'record_index';
Schema.systemFormFullViewColumns.record_index_text = 'record_index_text';

Schema.systemRepeatableViewColumns = {
  resource_id: 'child_record_id',
  record_resource_id: 'record_id',
  parent_resource_id: 'parent_id',
  record_project_resource_id: 'record_project_id',
  record_assigned_to_resource_id: 'record_assigned_to_id',
  record_status: 'record_status',
  index: 'index',
  latitude: 'latitude',
  longitude: 'longitude',
  created_at: 'created_at',
  updated_at: 'updated_at',
  version: 'version',
  created_by_resource_id: 'created_by_id',
  updated_by_resource_id: 'updated_by_id',
  server_created_at: 'server_created_at',
  server_updated_at: 'server_updated_at',
  geometry: 'geometry',
  changeset_resource_id: 'changeset_id',
  title: 'title',
  created_latitude: 'created_latitude',
  created_longitude: 'created_longitude',
  created_altitude: 'created_altitude',
  created_horizontal_accuracy: 'created_horizontal_accuracy',
  updated_latitude: 'updated_latitude',
  updated_longitude: 'updated_longitude',
  updated_altitude: 'updated_altitude',
  updated_horizontal_accuracy: 'updated_horizontal_accuracy',
  created_duration: 'created_duration',
  updated_duration: 'updated_duration',
  edited_duration: 'edited_duration',
  report_url: 'report_url'
};

Schema.systemRepeatableFullViewColumns = _underscore2.default.clone(Schema.systemRepeatableViewColumns);
Schema.systemRepeatableFullViewColumns.form_values = 'form_values';
Schema.systemRepeatableFullViewColumns.record_index = 'record_index';
Schema.systemRepeatableFullViewColumns.record_index_text = 'record_index_text';

Schema.systemValuesViewColumns = {
  record_resource_id: 'record_id',
  parent_resource_id: 'child_record_id',
  key: 'key',
  text_value: 'text_value'
};

Schema.systemFormTableIndexes = [{ columns: ['record_resource_id'], method: 'btree', unique: true }, { columns: ['geometry'], method: 'spatial' },
// { columns: [ 'record_index' ], method: 'gin' },
{ columns: ['status'], method: 'btree' }, { columns: ['server_updated_at'], method: 'btree' }, { columns: ['project_resource_id'], method: 'btree' }, { columns: ['assigned_to_resource_id'], method: 'btree' }, { columns: ['changeset_resource_id'], method: 'btree' }];

Schema.systemRepeatableTableIndexes = [{ columns: ['resource_id'], method: 'btree', unique: true }, { columns: ['record_resource_id'], method: 'btree' }, { columns: ['parent_resource_id'], method: 'btree' }, { columns: ['geometry'], method: 'spatial' },
// { columns: [ 'record_index' ], method: 'gin' },
{ columns: ['record_status'], method: 'btree' }, { columns: ['updated_at'], method: 'btree' }, { columns: ['record_project_resource_id'], method: 'btree' }, { columns: ['record_assigned_to_resource_id'], method: 'btree' }, { columns: ['changeset_resource_id'], method: 'btree' }];

Schema.systemValuesTableIndexes = [{ columns: ['record_resource_id'], method: 'btree' }, { columns: ['parent_resource_id'], method: 'btree' }, { columns: ['text_value'], method: 'btree' }, { columns: ['key'], method: 'btree' }];

exports.default = Schema;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL21zc3FsLXNjaGVtYS5qcyJdLCJuYW1lcyI6WyJTY2hlbWEiLCJpbmNsdWRlTWVkaWFDYXB0aW9ucyIsImluY2x1ZGVNZWRpYVVSTHMiLCJpbmNsdWRlTWVkaWFWaWV3VVJMcyIsInN5c3RlbUZvcm1UYWJsZUNvbHVtbnMiLCJuYW1lIiwidHlwZSIsImFsbG93TnVsbCIsImxlbmd0aCIsInN5c3RlbVZhbHVlc1RhYmxlQ29sdW1ucyIsInN5c3RlbVJlcGVhdGFibGVUYWJsZUNvbHVtbnMiLCJzeXN0ZW1Gb3JtVmlld0NvbHVtbnMiLCJyZWNvcmRfcmVzb3VyY2VfaWQiLCJwcm9qZWN0X3Jlc291cmNlX2lkIiwiYXNzaWduZWRfdG9fcmVzb3VyY2VfaWQiLCJzdGF0dXMiLCJsYXRpdHVkZSIsImxvbmdpdHVkZSIsImNyZWF0ZWRfYXQiLCJ1cGRhdGVkX2F0IiwidmVyc2lvbiIsImNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQiLCJ1cGRhdGVkX2J5X3Jlc291cmNlX2lkIiwic2VydmVyX2NyZWF0ZWRfYXQiLCJzZXJ2ZXJfdXBkYXRlZF9hdCIsImdlb21ldHJ5IiwiYWx0aXR1ZGUiLCJzcGVlZCIsImNvdXJzZSIsImhvcml6b250YWxfYWNjdXJhY3kiLCJ2ZXJ0aWNhbF9hY2N1cmFjeSIsImNoYW5nZXNldF9yZXNvdXJjZV9pZCIsInRpdGxlIiwiY3JlYXRlZF9sYXRpdHVkZSIsImNyZWF0ZWRfbG9uZ2l0dWRlIiwiY3JlYXRlZF9hbHRpdHVkZSIsImNyZWF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeSIsInVwZGF0ZWRfbGF0aXR1ZGUiLCJ1cGRhdGVkX2xvbmdpdHVkZSIsInVwZGF0ZWRfYWx0aXR1ZGUiLCJ1cGRhdGVkX2hvcml6b250YWxfYWNjdXJhY3kiLCJjcmVhdGVkX2R1cmF0aW9uIiwidXBkYXRlZF9kdXJhdGlvbiIsImVkaXRlZF9kdXJhdGlvbiIsInJlcG9ydF91cmwiLCJzeXN0ZW1Gb3JtRnVsbFZpZXdDb2x1bW5zIiwiY2xvbmUiLCJmb3JtX3ZhbHVlcyIsInJlY29yZF9pbmRleCIsInJlY29yZF9pbmRleF90ZXh0Iiwic3lzdGVtUmVwZWF0YWJsZVZpZXdDb2x1bW5zIiwicmVzb3VyY2VfaWQiLCJwYXJlbnRfcmVzb3VyY2VfaWQiLCJyZWNvcmRfcHJvamVjdF9yZXNvdXJjZV9pZCIsInJlY29yZF9hc3NpZ25lZF90b19yZXNvdXJjZV9pZCIsInJlY29yZF9zdGF0dXMiLCJpbmRleCIsInN5c3RlbVJlcGVhdGFibGVGdWxsVmlld0NvbHVtbnMiLCJzeXN0ZW1WYWx1ZXNWaWV3Q29sdW1ucyIsImtleSIsInRleHRfdmFsdWUiLCJzeXN0ZW1Gb3JtVGFibGVJbmRleGVzIiwiY29sdW1ucyIsIm1ldGhvZCIsInVuaXF1ZSIsInN5c3RlbVJlcGVhdGFibGVUYWJsZUluZGV4ZXMiLCJzeXN0ZW1WYWx1ZXNUYWJsZUluZGV4ZXMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7Ozs7QUFFQSxNQUFNQSxTQUFTLEVBQWY7O0FBRUFBLE9BQU9DLG9CQUFQLEdBQThCLElBQTlCO0FBQ0FELE9BQU9FLGdCQUFQLEdBQTBCLElBQTFCO0FBQ0FGLE9BQU9HLG9CQUFQLEdBQThCLElBQTlCOztBQUVBSCxPQUFPSSxzQkFBUCxHQUFnQyxDQUM5QjtBQUNFQyxRQUFNLElBRFI7QUFFRUMsUUFBTTtBQUZSLENBRDhCLEVBSTNCO0FBQ0RELFFBQU0sV0FETDtBQUVEQyxRQUFNLFNBRkw7QUFHREMsYUFBVztBQUhWLENBSjJCLEVBUTNCO0FBQ0RGLFFBQU0sb0JBREw7QUFFREMsUUFBTSxRQUZMO0FBR0RDLGFBQVc7QUFIVixDQVIyQixFQVkzQjtBQUNERixRQUFNLFlBREw7QUFFREMsUUFBTTtBQUZMLENBWjJCLEVBZTNCO0FBQ0RELFFBQU0scUJBREw7QUFFREMsUUFBTTtBQUZMLENBZjJCLEVBa0IzQjtBQUNERCxRQUFNLGdCQURMO0FBRURDLFFBQU07QUFGTCxDQWxCMkIsRUFxQjNCO0FBQ0RELFFBQU0seUJBREw7QUFFREMsUUFBTTtBQUZMLENBckIyQixFQXdC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RixTQUFTLENBQUUsb0JBQUYsQ0FBWCxFQUFxQ0MsUUFBUSxPQUE3QyxFQUZvQyxFQUdwQyxFQUFFRCxTQUFTLENBQUUsb0JBQUYsQ0FBWCxFQUFxQ0MsUUFBUSxPQUE3QyxFQUhvQyxFQUlwQyxFQUFFRCxTQUFTLENBQUUsVUFBRixDQUFYLEVBQTJCQyxRQUFRLFNBQW5DLEVBSm9DO0FBS3BDO0FBQ0EsRUFBRUQsU0FBUyxDQUFFLGVBQUYsQ0FBWCxFQUFnQ0MsUUFBUSxPQUF4QyxFQU5vQyxFQU9wQyxFQUFFRCxTQUFTLENBQUUsWUFBRixDQUFYLEVBQTZCQyxRQUFRLE9BQXJDLEVBUG9DLEVBUXBDLEVBQUVELFNBQVMsQ0FBRSw0QkFBRixDQUFYLEVBQTZDQyxRQUFRLE9BQXJELEVBUm9DLEVBU3BDLEVBQUVELFNBQVMsQ0FBRSxnQ0FBRixDQUFYLEVBQWlEQyxRQUFRLE9BQXpELEVBVG9DLEVBVXBDLEVBQUVELFNBQVMsQ0FBRSx1QkFBRixDQUFYLEVBQXdDQyxRQUFRLE9BQWhELEVBVm9DLENBQXRDOztBQWFBL0QsT0FBT2tFLHdCQUFQLEdBQWtDLENBQ2hDLEVBQUVKLFNBQVMsQ0FBRSxvQkFBRixDQUFYLEVBQXFDQyxRQUFRLE9BQTdDLEVBRGdDLEVBRWhDLEVBQUVELFNBQVMsQ0FBRSxvQkFBRixDQUFYLEVBQXFDQyxRQUFRLE9BQTdDLEVBRmdDLEVBR2hDLEVBQUVELFNBQVMsQ0FBRSxZQUFGLENBQVgsRUFBNkJDLFFBQVEsT0FBckMsRUFIZ0MsRUFJaEMsRUFBRUQsU0FBUyxDQUFFLEtBQUYsQ0FBWCxFQUFzQkMsUUFBUSxPQUE5QixFQUpnQyxDQUFsQzs7a0JBT2UvRCxNIiwiZmlsZSI6Im1zc3FsLXNjaGVtYS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jb25zdCBTY2hlbWEgPSB7fTtcblxuU2NoZW1hLmluY2x1ZGVNZWRpYUNhcHRpb25zID0gdHJ1ZTtcblNjaGVtYS5pbmNsdWRlTWVkaWFVUkxzID0gdHJ1ZTtcblNjaGVtYS5pbmNsdWRlTWVkaWFWaWV3VVJMcyA9IHRydWU7XG5cblNjaGVtYS5zeXN0ZW1Gb3JtVGFibGVDb2x1bW5zID0gW1xuICB7XG4gICAgbmFtZTogJ2lkJyxcbiAgICB0eXBlOiAncGsnXG4gIH0sIHtcbiAgICBuYW1lOiAncmVjb3JkX2lkJyxcbiAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ3JlY29yZF9yZXNvdXJjZV9pZCcsXG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ3Byb2plY3RfaWQnLFxuICAgIHR5cGU6ICdpbnRlZ2VyJ1xuICB9LCB7XG4gICAgbmFtZTogJ3Byb2plY3RfcmVzb3VyY2VfaWQnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH0sIHtcbiAgICBuYW1lOiAnYXNzaWduZWRfdG9faWQnLFxuICAgIHR5cGU6ICdpbnRlZ2VyJ1xuICB9LCB7XG4gICAgbmFtZTogJ2Fzc2lnbmVkX3RvX3Jlc291cmNlX2lkJyxcbiAgICB0eXBlOiAnc3RyaW5nJ1xuICB9LCB7XG4gICAgbmFtZTogJ3N0YXR1cycsXG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgbGVuZ3RoOiAxMDBcbiAgfSwge1xuICAgIG5hbWU6ICdsYXRpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdsb25naXR1ZGUnLFxuICAgIHR5cGU6ICdkb3VibGUnXG4gIH0sIHtcbiAgICBuYW1lOiAnY3JlYXRlZF9hdCcsXG4gICAgdHlwZTogJ3RpbWVzdGFtcCcsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ3VwZGF0ZWRfYXQnLFxuICAgIHR5cGU6ICd0aW1lc3RhbXAnLFxuICAgIGFsbG93TnVsbDogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICd2ZXJzaW9uJyxcbiAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ2NyZWF0ZWRfYnlfaWQnLFxuICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICBhbGxvd051bGw6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAnY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCcsXG4gICAgdHlwZTogJ3N0cmluZydcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2J5X2lkJyxcbiAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ3VwZGF0ZWRfYnlfcmVzb3VyY2VfaWQnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH0sIHtcbiAgICBuYW1lOiAnc2VydmVyX2NyZWF0ZWRfYXQnLFxuICAgIHR5cGU6ICd0aW1lc3RhbXAnLFxuICAgIGFsbG93TnVsbDogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICdzZXJ2ZXJfdXBkYXRlZF9hdCcsXG4gICAgdHlwZTogJ3RpbWVzdGFtcCcsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ3JlY29yZF9pbmRleF90ZXh0JyxcbiAgICB0eXBlOiAnc3RyaW5nJ1xuICB9LCB7XG4gICAgbmFtZTogJ3JlY29yZF9pbmRleCcsXG4gICAgdHlwZTogJ2Z0cydcbiAgfSwge1xuICAgIG5hbWU6ICdnZW9tZXRyeScsXG4gICAgdHlwZTogJ2dlb21ldHJ5J1xuICB9LCB7XG4gICAgbmFtZTogJ2FsdGl0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ3NwZWVkJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ2NvdXJzZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdob3Jpem9udGFsX2FjY3VyYWN5JyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ3ZlcnRpY2FsX2FjY3VyYWN5JyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ2Zvcm1fdmFsdWVzJyxcbiAgICB0eXBlOiAndGV4dCdcbiAgfSwge1xuICAgIG5hbWU6ICdjaGFuZ2VzZXRfaWQnLFxuICAgIHR5cGU6ICdpbnRlZ2VyJ1xuICB9LCB7XG4gICAgbmFtZTogJ2NoYW5nZXNldF9yZXNvdXJjZV9pZCcsXG4gICAgdHlwZTogJ3N0cmluZydcbiAgfSwge1xuICAgIG5hbWU6ICd0aXRsZScsXG4gICAgdHlwZTogJ3N0cmluZydcbiAgfSwge1xuICAgIG5hbWU6ICdjcmVhdGVkX2xhdGl0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ2NyZWF0ZWRfbG9uZ2l0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ2NyZWF0ZWRfZ2VvbWV0cnknLFxuICAgIHR5cGU6ICdnZW9tZXRyeSdcbiAgfSwge1xuICAgIG5hbWU6ICdjcmVhdGVkX2FsdGl0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ2NyZWF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2xhdGl0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ3VwZGF0ZWRfbG9uZ2l0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ3VwZGF0ZWRfZ2VvbWV0cnknLFxuICAgIHR5cGU6ICdnZW9tZXRyeSdcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2FsdGl0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ3VwZGF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdjcmVhdGVkX2R1cmF0aW9uJyxcbiAgICB0eXBlOiAnaW50ZWdlcidcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2R1cmF0aW9uJyxcbiAgICB0eXBlOiAnaW50ZWdlcidcbiAgfSwge1xuICAgIG5hbWU6ICdlZGl0ZWRfZHVyYXRpb24nLFxuICAgIHR5cGU6ICdpbnRlZ2VyJ1xuICB9LCB7XG4gICAgbmFtZTogJ3JlcG9ydF91cmwnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH1cbl07XG5cblNjaGVtYS5zeXN0ZW1WYWx1ZXNUYWJsZUNvbHVtbnMgPSBbXG4gIHtcbiAgICBuYW1lOiAnaWQnLFxuICAgIHR5cGU6ICdwaydcbiAgfSwge1xuICAgIG5hbWU6ICdyZWNvcmRfaWQnLFxuICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICBhbGxvd051bGw6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAncmVjb3JkX3Jlc291cmNlX2lkJyxcbiAgICB0eXBlOiAnc3RyaW5nJ1xuICB9LCB7XG4gICAgbmFtZTogJ3BhcmVudF9yZXNvdXJjZV9pZCcsXG4gICAgdHlwZTogJ3N0cmluZydcbiAgfSwge1xuICAgIG5hbWU6ICdrZXknLFxuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGFsbG93TnVsbDogZmFsc2UsXG4gICAgbGVuZ3RoOiA0MDAwXG4gIH0sIHtcbiAgICBuYW1lOiAndGV4dF92YWx1ZScsXG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgbGVuZ3RoOiA0MDAwXG4gIH0sIHtcbiAgICBuYW1lOiAnbnVtYmVyX3ZhbHVlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9XG5dO1xuXG5TY2hlbWEuc3lzdGVtUmVwZWF0YWJsZVRhYmxlQ29sdW1ucyA9IFtcbiAge1xuICAgIG5hbWU6ICdpZCcsXG4gICAgdHlwZTogJ3BrJ1xuICB9LCB7XG4gICAgbmFtZTogJ3Jlc291cmNlX2lkJyxcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBhbGxvd051bGw6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAncmVjb3JkX2lkJyxcbiAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ3JlY29yZF9yZXNvdXJjZV9pZCcsXG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ3BhcmVudF9yZXNvdXJjZV9pZCcsXG4gICAgdHlwZTogJ3N0cmluZydcbiAgfSwge1xuICAgIG5hbWU6ICdyZWNvcmRfcHJvamVjdF9pZCcsXG4gICAgdHlwZTogJ2ludGVnZXInXG4gIH0sIHtcbiAgICBuYW1lOiAncmVjb3JkX3Byb2plY3RfcmVzb3VyY2VfaWQnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH0sIHtcbiAgICBuYW1lOiAncmVjb3JkX2Fzc2lnbmVkX3RvX2lkJyxcbiAgICB0eXBlOiAnaW50ZWdlcidcbiAgfSwge1xuICAgIG5hbWU6ICdyZWNvcmRfYXNzaWduZWRfdG9fcmVzb3VyY2VfaWQnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH0sIHtcbiAgICBuYW1lOiAncmVjb3JkX3N0YXR1cycsXG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgbGVuZ3RoOiAxMDBcbiAgfSwge1xuICAgIG5hbWU6ICdpbmRleCcsIC8vIFRPRE8oemhtKSBtYWtlIHRoaXMgd29yayBpbiB0aGUgYXBwXG4gICAgdHlwZTogJ2ludGVnZXInXG4gIH0sIHtcbiAgICBuYW1lOiAnbGF0aXR1ZGUnLFxuICAgIHR5cGU6ICdkb3VibGUnXG4gIH0sIHtcbiAgICBuYW1lOiAnbG9uZ2l0dWRlJyxcbiAgICB0eXBlOiAnZG91YmxlJ1xuICB9LCB7XG4gICAgbmFtZTogJ2NyZWF0ZWRfYXQnLFxuICAgIHR5cGU6ICd0aW1lc3RhbXAnLFxuICAgIGFsbG93TnVsbDogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2F0JyxcbiAgICB0eXBlOiAndGltZXN0YW1wJyxcbiAgICBhbGxvd051bGw6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAndmVyc2lvbicsXG4gICAgdHlwZTogJ2ludGVnZXInLFxuICAgIGFsbG93TnVsbDogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICdjcmVhdGVkX2J5X2lkJyxcbiAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgYWxsb3dOdWxsOiBmYWxzZVxuICB9LCB7XG4gICAgbmFtZTogJ2NyZWF0ZWRfYnlfcmVzb3VyY2VfaWQnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH0sIHtcbiAgICBuYW1lOiAndXBkYXRlZF9ieV9pZCcsXG4gICAgdHlwZTogJ2ludGVnZXInLFxuICAgIGFsbG93TnVsbDogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2J5X3Jlc291cmNlX2lkJyxcbiAgICB0eXBlOiAnc3RyaW5nJ1xuICB9LCB7XG4gICAgbmFtZTogJ3NlcnZlcl9jcmVhdGVkX2F0JyxcbiAgICB0eXBlOiAndGltZXN0YW1wJyxcbiAgICBhbGxvd051bGw6IGZhbHNlXG4gIH0sIHtcbiAgICBuYW1lOiAnc2VydmVyX3VwZGF0ZWRfYXQnLFxuICAgIHR5cGU6ICd0aW1lc3RhbXAnLFxuICAgIGFsbG93TnVsbDogZmFsc2VcbiAgfSwge1xuICAgIG5hbWU6ICdyZWNvcmRfaW5kZXhfdGV4dCcsXG4gICAgdHlwZTogJ3N0cmluZydcbiAgfSwge1xuICAgIG5hbWU6ICdyZWNvcmRfaW5kZXgnLFxuICAgIHR5cGU6ICdmdHMnXG4gIH0sIHtcbiAgICBuYW1lOiAnZ2VvbWV0cnknLFxuICAgIHR5cGU6ICdnZW9tZXRyeSdcbiAgfSwge1xuICAgIG5hbWU6ICdhbHRpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdzcGVlZCcsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdjb3Vyc2UnLFxuICAgIHR5cGU6ICdkb3VibGUnXG4gIH0sIHtcbiAgICBuYW1lOiAnaG9yaXpvbnRhbF9hY2N1cmFjeScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICd2ZXJ0aWNhbF9hY2N1cmFjeScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdmb3JtX3ZhbHVlcycsXG4gICAgdHlwZTogJ3RleHQnXG4gIH0sIHtcbiAgICBuYW1lOiAnY2hhbmdlc2V0X2lkJyxcbiAgICB0eXBlOiAnaW50ZWdlcidcbiAgfSwge1xuICAgIG5hbWU6ICdjaGFuZ2VzZXRfcmVzb3VyY2VfaWQnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH0sIHtcbiAgICBuYW1lOiAndGl0bGUnLFxuICAgIHR5cGU6ICdzdHJpbmcnXG4gIH0sIHtcbiAgICBuYW1lOiAnY3JlYXRlZF9sYXRpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdjcmVhdGVkX2xvbmdpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdjcmVhdGVkX2dlb21ldHJ5JyxcbiAgICB0eXBlOiAnZ2VvbWV0cnknXG4gIH0sIHtcbiAgICBuYW1lOiAnY3JlYXRlZF9hbHRpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICdjcmVhdGVkX2hvcml6b250YWxfYWNjdXJhY3knLFxuICAgIHR5cGU6ICdkb3VibGUnXG4gIH0sIHtcbiAgICBuYW1lOiAndXBkYXRlZF9sYXRpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2xvbmdpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2dlb21ldHJ5JyxcbiAgICB0eXBlOiAnZ2VvbWV0cnknXG4gIH0sIHtcbiAgICBuYW1lOiAndXBkYXRlZF9hbHRpdHVkZScsXG4gICAgdHlwZTogJ2RvdWJsZSdcbiAgfSwge1xuICAgIG5hbWU6ICd1cGRhdGVkX2hvcml6b250YWxfYWNjdXJhY3knLFxuICAgIHR5cGU6ICdkb3VibGUnXG4gIH0sIHtcbiAgICBuYW1lOiAnY3JlYXRlZF9kdXJhdGlvbicsXG4gICAgdHlwZTogJ2ludGVnZXInXG4gIH0sIHtcbiAgICBuYW1lOiAndXBkYXRlZF9kdXJhdGlvbicsXG4gICAgdHlwZTogJ2ludGVnZXInXG4gIH0sIHtcbiAgICBuYW1lOiAnZWRpdGVkX2R1cmF0aW9uJyxcbiAgICB0eXBlOiAnaW50ZWdlcidcbiAgfSwge1xuICAgIG5hbWU6ICdyZXBvcnRfdXJsJyxcbiAgICB0eXBlOiAnc3RyaW5nJ1xuICB9XG5dO1xuXG5TY2hlbWEuc3lzdGVtRm9ybVZpZXdDb2x1bW5zID0ge1xuICByZWNvcmRfcmVzb3VyY2VfaWQ6ICdyZWNvcmRfaWQnLFxuICBwcm9qZWN0X3Jlc291cmNlX2lkOiAncHJvamVjdF9pZCcsXG4gIGFzc2lnbmVkX3RvX3Jlc291cmNlX2lkOiAnYXNzaWduZWRfdG9faWQnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBsYXRpdHVkZTogJ2xhdGl0dWRlJyxcbiAgbG9uZ2l0dWRlOiAnbG9uZ2l0dWRlJyxcbiAgY3JlYXRlZF9hdDogJ2NyZWF0ZWRfYXQnLFxuICB1cGRhdGVkX2F0OiAndXBkYXRlZF9hdCcsXG4gIHZlcnNpb246ICd2ZXJzaW9uJyxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZDogJ2NyZWF0ZWRfYnlfaWQnLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkOiAndXBkYXRlZF9ieV9pZCcsXG4gIHNlcnZlcl9jcmVhdGVkX2F0OiAnc2VydmVyX2NyZWF0ZWRfYXQnLFxuICBzZXJ2ZXJfdXBkYXRlZF9hdDogJ3NlcnZlcl91cGRhdGVkX2F0JyxcbiAgZ2VvbWV0cnk6ICdnZW9tZXRyeScsXG4gIGFsdGl0dWRlOiAnYWx0aXR1ZGUnLFxuICBzcGVlZDogJ3NwZWVkJyxcbiAgY291cnNlOiAnY291cnNlJyxcbiAgaG9yaXpvbnRhbF9hY2N1cmFjeTogJ2hvcml6b250YWxfYWNjdXJhY3knLFxuICB2ZXJ0aWNhbF9hY2N1cmFjeTogJ3ZlcnRpY2FsX2FjY3VyYWN5JyxcbiAgY2hhbmdlc2V0X3Jlc291cmNlX2lkOiAnY2hhbmdlc2V0X2lkJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIGNyZWF0ZWRfbGF0aXR1ZGU6ICdjcmVhdGVkX2xhdGl0dWRlJyxcbiAgY3JlYXRlZF9sb25naXR1ZGU6ICdjcmVhdGVkX2xvbmdpdHVkZScsXG4gIGNyZWF0ZWRfYWx0aXR1ZGU6ICdjcmVhdGVkX2FsdGl0dWRlJyxcbiAgY3JlYXRlZF9ob3Jpem9udGFsX2FjY3VyYWN5OiAnY3JlYXRlZF9ob3Jpem9udGFsX2FjY3VyYWN5JyxcbiAgdXBkYXRlZF9sYXRpdHVkZTogJ3VwZGF0ZWRfbGF0aXR1ZGUnLFxuICB1cGRhdGVkX2xvbmdpdHVkZTogJ3VwZGF0ZWRfbG9uZ2l0dWRlJyxcbiAgdXBkYXRlZF9hbHRpdHVkZTogJ3VwZGF0ZWRfYWx0aXR1ZGUnLFxuICB1cGRhdGVkX2hvcml6b250YWxfYWNjdXJhY3k6ICd1cGRhdGVkX2hvcml6b250YWxfYWNjdXJhY3knLFxuICBjcmVhdGVkX2R1cmF0aW9uOiAnY3JlYXRlZF9kdXJhdGlvbicsXG4gIHVwZGF0ZWRfZHVyYXRpb246ICd1cGRhdGVkX2R1cmF0aW9uJyxcbiAgZWRpdGVkX2R1cmF0aW9uOiAnZWRpdGVkX2R1cmF0aW9uJyxcbiAgcmVwb3J0X3VybDogJ3JlcG9ydF91cmwnXG59O1xuXG5TY2hlbWEuc3lzdGVtRm9ybUZ1bGxWaWV3Q29sdW1ucyA9IF8uY2xvbmUoU2NoZW1hLnN5c3RlbUZvcm1WaWV3Q29sdW1ucyk7XG5TY2hlbWEuc3lzdGVtRm9ybUZ1bGxWaWV3Q29sdW1ucy5mb3JtX3ZhbHVlcyA9ICdmb3JtX3ZhbHVlcyc7XG5TY2hlbWEuc3lzdGVtRm9ybUZ1bGxWaWV3Q29sdW1ucy5yZWNvcmRfaW5kZXggPSAncmVjb3JkX2luZGV4JztcblNjaGVtYS5zeXN0ZW1Gb3JtRnVsbFZpZXdDb2x1bW5zLnJlY29yZF9pbmRleF90ZXh0ID0gJ3JlY29yZF9pbmRleF90ZXh0JztcblxuU2NoZW1hLnN5c3RlbVJlcGVhdGFibGVWaWV3Q29sdW1ucyA9IHtcbiAgcmVzb3VyY2VfaWQ6ICdjaGlsZF9yZWNvcmRfaWQnLFxuICByZWNvcmRfcmVzb3VyY2VfaWQ6ICdyZWNvcmRfaWQnLFxuICBwYXJlbnRfcmVzb3VyY2VfaWQ6ICdwYXJlbnRfaWQnLFxuICByZWNvcmRfcHJvamVjdF9yZXNvdXJjZV9pZDogJ3JlY29yZF9wcm9qZWN0X2lkJyxcbiAgcmVjb3JkX2Fzc2lnbmVkX3RvX3Jlc291cmNlX2lkOiAncmVjb3JkX2Fzc2lnbmVkX3RvX2lkJyxcbiAgcmVjb3JkX3N0YXR1czogJ3JlY29yZF9zdGF0dXMnLFxuICBpbmRleDogJ2luZGV4JyxcbiAgbGF0aXR1ZGU6ICdsYXRpdHVkZScsXG4gIGxvbmdpdHVkZTogJ2xvbmdpdHVkZScsXG4gIGNyZWF0ZWRfYXQ6ICdjcmVhdGVkX2F0JyxcbiAgdXBkYXRlZF9hdDogJ3VwZGF0ZWRfYXQnLFxuICB2ZXJzaW9uOiAndmVyc2lvbicsXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQ6ICdjcmVhdGVkX2J5X2lkJyxcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZDogJ3VwZGF0ZWRfYnlfaWQnLFxuICBzZXJ2ZXJfY3JlYXRlZF9hdDogJ3NlcnZlcl9jcmVhdGVkX2F0JyxcbiAgc2VydmVyX3VwZGF0ZWRfYXQ6ICdzZXJ2ZXJfdXBkYXRlZF9hdCcsXG4gIGdlb21ldHJ5OiAnZ2VvbWV0cnknLFxuICBjaGFuZ2VzZXRfcmVzb3VyY2VfaWQ6ICdjaGFuZ2VzZXRfaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgY3JlYXRlZF9sYXRpdHVkZTogJ2NyZWF0ZWRfbGF0aXR1ZGUnLFxuICBjcmVhdGVkX2xvbmdpdHVkZTogJ2NyZWF0ZWRfbG9uZ2l0dWRlJyxcbiAgY3JlYXRlZF9hbHRpdHVkZTogJ2NyZWF0ZWRfYWx0aXR1ZGUnLFxuICBjcmVhdGVkX2hvcml6b250YWxfYWNjdXJhY3k6ICdjcmVhdGVkX2hvcml6b250YWxfYWNjdXJhY3knLFxuICB1cGRhdGVkX2xhdGl0dWRlOiAndXBkYXRlZF9sYXRpdHVkZScsXG4gIHVwZGF0ZWRfbG9uZ2l0dWRlOiAndXBkYXRlZF9sb25naXR1ZGUnLFxuICB1cGRhdGVkX2FsdGl0dWRlOiAndXBkYXRlZF9hbHRpdHVkZScsXG4gIHVwZGF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeTogJ3VwZGF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeScsXG4gIGNyZWF0ZWRfZHVyYXRpb246ICdjcmVhdGVkX2R1cmF0aW9uJyxcbiAgdXBkYXRlZF9kdXJhdGlvbjogJ3VwZGF0ZWRfZHVyYXRpb24nLFxuICBlZGl0ZWRfZHVyYXRpb246ICdlZGl0ZWRfZHVyYXRpb24nLFxuICByZXBvcnRfdXJsOiAncmVwb3J0X3VybCdcbn07XG5cblNjaGVtYS5zeXN0ZW1SZXBlYXRhYmxlRnVsbFZpZXdDb2x1bW5zID0gXy5jbG9uZShTY2hlbWEuc3lzdGVtUmVwZWF0YWJsZVZpZXdDb2x1bW5zKTtcblNjaGVtYS5zeXN0ZW1SZXBlYXRhYmxlRnVsbFZpZXdDb2x1bW5zLmZvcm1fdmFsdWVzID0gJ2Zvcm1fdmFsdWVzJztcblNjaGVtYS5zeXN0ZW1SZXBlYXRhYmxlRnVsbFZpZXdDb2x1bW5zLnJlY29yZF9pbmRleCA9ICdyZWNvcmRfaW5kZXgnO1xuU2NoZW1hLnN5c3RlbVJlcGVhdGFibGVGdWxsVmlld0NvbHVtbnMucmVjb3JkX2luZGV4X3RleHQgPSAncmVjb3JkX2luZGV4X3RleHQnO1xuXG5TY2hlbWEuc3lzdGVtVmFsdWVzVmlld0NvbHVtbnMgPSB7XG4gIHJlY29yZF9yZXNvdXJjZV9pZDogJ3JlY29yZF9pZCcsXG4gIHBhcmVudF9yZXNvdXJjZV9pZDogJ2NoaWxkX3JlY29yZF9pZCcsXG4gIGtleTogJ2tleScsXG4gIHRleHRfdmFsdWU6ICd0ZXh0X3ZhbHVlJ1xufTtcblxuU2NoZW1hLnN5c3RlbUZvcm1UYWJsZUluZGV4ZXMgPSBbXG4gIHsgY29sdW1uczogWyAncmVjb3JkX3Jlc291cmNlX2lkJyBdLCBtZXRob2Q6ICdidHJlZScsIHVuaXF1ZTogdHJ1ZSB9LFxuICB7IGNvbHVtbnM6IFsgJ2dlb21ldHJ5JyBdLCBtZXRob2Q6ICdzcGF0aWFsJyB9LFxuICAvLyB7IGNvbHVtbnM6IFsgJ3JlY29yZF9pbmRleCcgXSwgbWV0aG9kOiAnZ2luJyB9LFxuICB7IGNvbHVtbnM6IFsgJ3N0YXR1cycgXSwgbWV0aG9kOiAnYnRyZWUnIH0sXG4gIHsgY29sdW1uczogWyAnc2VydmVyX3VwZGF0ZWRfYXQnIF0sIG1ldGhvZDogJ2J0cmVlJyB9LFxuICB7IGNvbHVtbnM6IFsgJ3Byb2plY3RfcmVzb3VyY2VfaWQnIF0sIG1ldGhvZDogJ2J0cmVlJyB9LFxuICB7IGNvbHVtbnM6IFsgJ2Fzc2lnbmVkX3RvX3Jlc291cmNlX2lkJyBdLCBtZXRob2Q6ICdidHJlZScgfSxcbiAgeyBjb2x1bW5zOiBbICdjaGFuZ2VzZXRfcmVzb3VyY2VfaWQnIF0sIG1ldGhvZDogJ2J0cmVlJyB9XG5dO1xuXG5TY2hlbWEuc3lzdGVtUmVwZWF0YWJsZVRhYmxlSW5kZXhlcyA9IFtcbiAgeyBjb2x1bW5zOiBbICdyZXNvdXJjZV9pZCcgXSwgbWV0aG9kOiAnYnRyZWUnLCB1bmlxdWU6IHRydWUgfSxcbiAgeyBjb2x1bW5zOiBbICdyZWNvcmRfcmVzb3VyY2VfaWQnIF0sIG1ldGhvZDogJ2J0cmVlJyB9LFxuICB7IGNvbHVtbnM6IFsgJ3BhcmVudF9yZXNvdXJjZV9pZCcgXSwgbWV0aG9kOiAnYnRyZWUnIH0sXG4gIHsgY29sdW1uczogWyAnZ2VvbWV0cnknIF0sIG1ldGhvZDogJ3NwYXRpYWwnIH0sXG4gIC8vIHsgY29sdW1uczogWyAncmVjb3JkX2luZGV4JyBdLCBtZXRob2Q6ICdnaW4nIH0sXG4gIHsgY29sdW1uczogWyAncmVjb3JkX3N0YXR1cycgXSwgbWV0aG9kOiAnYnRyZWUnIH0sXG4gIHsgY29sdW1uczogWyAndXBkYXRlZF9hdCcgXSwgbWV0aG9kOiAnYnRyZWUnIH0sXG4gIHsgY29sdW1uczogWyAncmVjb3JkX3Byb2plY3RfcmVzb3VyY2VfaWQnIF0sIG1ldGhvZDogJ2J0cmVlJyB9LFxuICB7IGNvbHVtbnM6IFsgJ3JlY29yZF9hc3NpZ25lZF90b19yZXNvdXJjZV9pZCcgXSwgbWV0aG9kOiAnYnRyZWUnIH0sXG4gIHsgY29sdW1uczogWyAnY2hhbmdlc2V0X3Jlc291cmNlX2lkJyBdLCBtZXRob2Q6ICdidHJlZScgfVxuXTtcblxuU2NoZW1hLnN5c3RlbVZhbHVlc1RhYmxlSW5kZXhlcyA9IFtcbiAgeyBjb2x1bW5zOiBbICdyZWNvcmRfcmVzb3VyY2VfaWQnIF0sIG1ldGhvZDogJ2J0cmVlJyB9LFxuICB7IGNvbHVtbnM6IFsgJ3BhcmVudF9yZXNvdXJjZV9pZCcgXSwgbWV0aG9kOiAnYnRyZWUnIH0sXG4gIHsgY29sdW1uczogWyAndGV4dF92YWx1ZScgXSwgbWV0aG9kOiAnYnRyZWUnIH0sXG4gIHsgY29sdW1uczogWyAna2V5JyBdLCBtZXRob2Q6ICdidHJlZScgfVxuXTtcblxuZXhwb3J0IGRlZmF1bHQgU2NoZW1hO1xuIl19