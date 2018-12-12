"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = `
BEGIN TRANSACTION;

CREATE TABLE __SCHEMA__.records (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  form_id bigint NOT NULL,
  form_resource_id varchar(100) NOT NULL,
  project_id bigint,
  project_resource_id varchar(100),
  assigned_to_id bigint,
  assigned_to_resource_id varchar(100),
  status varchar(1000),
  latitude float,
  longitude float,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  version bigint NOT NULL,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  server_created_at datetime NOT NULL,
  server_updated_at datetime NOT NULL,
  record_index_text varchar(max),
  record_index varchar(max),
  geometry geography,
  altitude float,
  speed float,
  course float,
  horizontal_accuracy float,
  vertical_accuracy float,
  form_values varchar(max),
  changeset_id bigint,
  changeset_resource_id varchar(100),
  title varchar(max),
  created_latitude float,
  created_longitude float,
  created_geometry geography,
  created_altitude float,
  created_horizontal_accuracy float,
  updated_latitude float,
  updated_longitude float,
  updated_geometry geography,
  updated_altitude float,
  updated_horizontal_accuracy float,
  created_duration bigint,
  updated_duration bigint,
  edited_duration bigint
);

IF OBJECT_ID('__VIEW_SCHEMA__.records_view', 'V') IS NOT NULL DROP VIEW __VIEW_SCHEMA__.records_view;

CREATE VIEW __VIEW_SCHEMA__.records_view AS
SELECT
  records.row_resource_id AS record_id,
  records.form_resource_id AS form_id,
  records.project_resource_id AS project_id,
  records.assigned_to_resource_id AS assigned_to_id,
  records.status AS status,
  records.latitude AS latitude,
  records.longitude AS longitude,
  records.created_at AS created_at,
  records.updated_at AS updated_at,
  records.version AS version,
  records.created_by_resource_id AS created_by_id,
  records.updated_by_resource_id AS updated_by_id,
  records.server_created_at AS server_created_at,
  records.server_updated_at AS server_updated_at,
  records.geometry AS geometry,
  records.altitude AS altitude,
  records.speed AS speed,
  records.course AS course,
  records.horizontal_accuracy AS horizontal_accuracy,
  records.vertical_accuracy AS vertical_accuracy,
  records.changeset_resource_id AS changeset_id,
  records.title AS title,
  records.created_latitude AS created_latitude,
  records.created_longitude AS created_longitude,
  records.created_geometry AS created_geometry,
  records.created_altitude AS created_altitude,
  records.created_horizontal_accuracy AS created_horizontal_accuracy,
  records.updated_latitude AS updated_latitude,
  records.updated_longitude AS updated_longitude,
  records.updated_geometry AS updated_geometry,
  records.updated_altitude AS updated_altitude,
  records.updated_horizontal_accuracy AS updated_horizontal_accuracy,
  records.created_duration AS created_duration,
  records.updated_duration AS updated_duration,
  records.edited_duration AS edited_duration
FROM __SCHEMA__.records;


CREATE UNIQUE INDEX idx_records_row_resource_id ON __SCHEMA__.records (row_resource_id);

CREATE UNIQUE INDEX idx_records_row_id ON __SCHEMA__.records (row_id);

CREATE INDEX idx_records_form_resource_id ON __SCHEMA__.records (form_resource_id);

CREATE INDEX idx_records_assigned_to_resource_id ON __SCHEMA__.records (assigned_to_resource_id);

CREATE INDEX idx_records_changeset_resource_id ON __SCHEMA__.records (changeset_resource_id);

CREATE SPATIAL INDEX idx_records_geometry ON __SCHEMA__.records (geometry);

CREATE INDEX idx_records_project_resource_id ON __SCHEMA__.records (project_resource_id);

-- CREATE INDEX idx_records_record_index ON __SCHEMA__.records USING gin (record_index);

CREATE INDEX idx_records_server_updated_at ON __SCHEMA__.records (server_updated_at);

CREATE INDEX idx_records_server_created_at ON __SCHEMA__.records (server_created_at);

CREATE INDEX idx_records_status ON __SCHEMA__.records (status);

INSERT INTO __SCHEMA__.migrations (name) VALUES ('002');

EXEC sp_rename '__SCHEMA__.audio', 'system_audio';
EXEC sp_rename '__SCHEMA__.changesets', 'system_changesets';
EXEC sp_rename '__SCHEMA__.choice_lists', 'system_choice_lists';
EXEC sp_rename '__SCHEMA__.classification_sets', 'system_classification_sets';
EXEC sp_rename '__SCHEMA__.forms', 'system_forms';
EXEC sp_rename '__SCHEMA__.memberships', 'system_memberships';
EXEC sp_rename '__SCHEMA__.photos', 'system_photos';
EXEC sp_rename '__SCHEMA__.projects', 'system_projects';
EXEC sp_rename '__SCHEMA__.roles', 'system_roles';
EXEC sp_rename '__SCHEMA__.signatures', 'system_signatures';
EXEC sp_rename '__SCHEMA__.videos', 'system_videos';
EXEC sp_rename '__SCHEMA__.records', 'system_records';

COMMIT TRANSACTION;
`;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3ZlcnNpb24tMDAyLnNxbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztrQkFBZ0IiLCJmaWxlIjoidmVyc2lvbi0wMDIuc3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgYFxuQkVHSU4gVFJBTlNBQ1RJT047XG5cbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLnJlY29yZHMgKFxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcbiAgcm93X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcbiAgZm9ybV9pZCBiaWdpbnQgTk9UIE5VTEwsXG4gIGZvcm1fcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxuICBwcm9qZWN0X2lkIGJpZ2ludCxcbiAgcHJvamVjdF9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIGFzc2lnbmVkX3RvX2lkIGJpZ2ludCxcbiAgYXNzaWduZWRfdG9fcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBzdGF0dXMgdmFyY2hhcigxMDAwKSxcbiAgbGF0aXR1ZGUgZmxvYXQsXG4gIGxvbmdpdHVkZSBmbG9hdCxcbiAgY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgdmVyc2lvbiBiaWdpbnQgTk9UIE5VTEwsXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgdXBkYXRlZF9ieV9pZCBiaWdpbnQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBzZXJ2ZXJfY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgc2VydmVyX3VwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIHJlY29yZF9pbmRleF90ZXh0IHZhcmNoYXIobWF4KSxcbiAgcmVjb3JkX2luZGV4IHZhcmNoYXIobWF4KSxcbiAgZ2VvbWV0cnkgZ2VvZ3JhcGh5LFxuICBhbHRpdHVkZSBmbG9hdCxcbiAgc3BlZWQgZmxvYXQsXG4gIGNvdXJzZSBmbG9hdCxcbiAgaG9yaXpvbnRhbF9hY2N1cmFjeSBmbG9hdCxcbiAgdmVydGljYWxfYWNjdXJhY3kgZmxvYXQsXG4gIGZvcm1fdmFsdWVzIHZhcmNoYXIobWF4KSxcbiAgY2hhbmdlc2V0X2lkIGJpZ2ludCxcbiAgY2hhbmdlc2V0X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgdGl0bGUgdmFyY2hhcihtYXgpLFxuICBjcmVhdGVkX2xhdGl0dWRlIGZsb2F0LFxuICBjcmVhdGVkX2xvbmdpdHVkZSBmbG9hdCxcbiAgY3JlYXRlZF9nZW9tZXRyeSBnZW9ncmFwaHksXG4gIGNyZWF0ZWRfYWx0aXR1ZGUgZmxvYXQsXG4gIGNyZWF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeSBmbG9hdCxcbiAgdXBkYXRlZF9sYXRpdHVkZSBmbG9hdCxcbiAgdXBkYXRlZF9sb25naXR1ZGUgZmxvYXQsXG4gIHVwZGF0ZWRfZ2VvbWV0cnkgZ2VvZ3JhcGh5LFxuICB1cGRhdGVkX2FsdGl0dWRlIGZsb2F0LFxuICB1cGRhdGVkX2hvcml6b250YWxfYWNjdXJhY3kgZmxvYXQsXG4gIGNyZWF0ZWRfZHVyYXRpb24gYmlnaW50LFxuICB1cGRhdGVkX2R1cmF0aW9uIGJpZ2ludCxcbiAgZWRpdGVkX2R1cmF0aW9uIGJpZ2ludFxuKTtcblxuSUYgT0JKRUNUX0lEKCdfX1ZJRVdfU0NIRU1BX18ucmVjb3Jkc192aWV3JywgJ1YnKSBJUyBOT1QgTlVMTCBEUk9QIFZJRVcgX19WSUVXX1NDSEVNQV9fLnJlY29yZHNfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnJlY29yZHNfdmlldyBBU1xuU0VMRUNUXG4gIHJlY29yZHMucm93X3Jlc291cmNlX2lkIEFTIHJlY29yZF9pZCxcbiAgcmVjb3Jkcy5mb3JtX3Jlc291cmNlX2lkIEFTIGZvcm1faWQsXG4gIHJlY29yZHMucHJvamVjdF9yZXNvdXJjZV9pZCBBUyBwcm9qZWN0X2lkLFxuICByZWNvcmRzLmFzc2lnbmVkX3RvX3Jlc291cmNlX2lkIEFTIGFzc2lnbmVkX3RvX2lkLFxuICByZWNvcmRzLnN0YXR1cyBBUyBzdGF0dXMsXG4gIHJlY29yZHMubGF0aXR1ZGUgQVMgbGF0aXR1ZGUsXG4gIHJlY29yZHMubG9uZ2l0dWRlIEFTIGxvbmdpdHVkZSxcbiAgcmVjb3Jkcy5jcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXG4gIHJlY29yZHMudXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICByZWNvcmRzLnZlcnNpb24gQVMgdmVyc2lvbixcbiAgcmVjb3Jkcy5jcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHJlY29yZHMudXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxuICByZWNvcmRzLnNlcnZlcl9jcmVhdGVkX2F0IEFTIHNlcnZlcl9jcmVhdGVkX2F0LFxuICByZWNvcmRzLnNlcnZlcl91cGRhdGVkX2F0IEFTIHNlcnZlcl91cGRhdGVkX2F0LFxuICByZWNvcmRzLmdlb21ldHJ5IEFTIGdlb21ldHJ5LFxuICByZWNvcmRzLmFsdGl0dWRlIEFTIGFsdGl0dWRlLFxuICByZWNvcmRzLnNwZWVkIEFTIHNwZWVkLFxuICByZWNvcmRzLmNvdXJzZSBBUyBjb3Vyc2UsXG4gIHJlY29yZHMuaG9yaXpvbnRhbF9hY2N1cmFjeSBBUyBob3Jpem9udGFsX2FjY3VyYWN5LFxuICByZWNvcmRzLnZlcnRpY2FsX2FjY3VyYWN5IEFTIHZlcnRpY2FsX2FjY3VyYWN5LFxuICByZWNvcmRzLmNoYW5nZXNldF9yZXNvdXJjZV9pZCBBUyBjaGFuZ2VzZXRfaWQsXG4gIHJlY29yZHMudGl0bGUgQVMgdGl0bGUsXG4gIHJlY29yZHMuY3JlYXRlZF9sYXRpdHVkZSBBUyBjcmVhdGVkX2xhdGl0dWRlLFxuICByZWNvcmRzLmNyZWF0ZWRfbG9uZ2l0dWRlIEFTIGNyZWF0ZWRfbG9uZ2l0dWRlLFxuICByZWNvcmRzLmNyZWF0ZWRfZ2VvbWV0cnkgQVMgY3JlYXRlZF9nZW9tZXRyeSxcbiAgcmVjb3Jkcy5jcmVhdGVkX2FsdGl0dWRlIEFTIGNyZWF0ZWRfYWx0aXR1ZGUsXG4gIHJlY29yZHMuY3JlYXRlZF9ob3Jpem9udGFsX2FjY3VyYWN5IEFTIGNyZWF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeSxcbiAgcmVjb3Jkcy51cGRhdGVkX2xhdGl0dWRlIEFTIHVwZGF0ZWRfbGF0aXR1ZGUsXG4gIHJlY29yZHMudXBkYXRlZF9sb25naXR1ZGUgQVMgdXBkYXRlZF9sb25naXR1ZGUsXG4gIHJlY29yZHMudXBkYXRlZF9nZW9tZXRyeSBBUyB1cGRhdGVkX2dlb21ldHJ5LFxuICByZWNvcmRzLnVwZGF0ZWRfYWx0aXR1ZGUgQVMgdXBkYXRlZF9hbHRpdHVkZSxcbiAgcmVjb3Jkcy51cGRhdGVkX2hvcml6b250YWxfYWNjdXJhY3kgQVMgdXBkYXRlZF9ob3Jpem9udGFsX2FjY3VyYWN5LFxuICByZWNvcmRzLmNyZWF0ZWRfZHVyYXRpb24gQVMgY3JlYXRlZF9kdXJhdGlvbixcbiAgcmVjb3Jkcy51cGRhdGVkX2R1cmF0aW9uIEFTIHVwZGF0ZWRfZHVyYXRpb24sXG4gIHJlY29yZHMuZWRpdGVkX2R1cmF0aW9uIEFTIGVkaXRlZF9kdXJhdGlvblxuRlJPTSBfX1NDSEVNQV9fLnJlY29yZHM7XG5cblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcmVjb3Jkc19yb3dfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5yZWNvcmRzIChyb3dfcmVzb3VyY2VfaWQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9yZWNvcmRzX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnJlY29yZHMgKHJvd19pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcmVjb3Jkc19mb3JtX3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18ucmVjb3JkcyAoZm9ybV9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcmVjb3Jkc19hc3NpZ25lZF90b19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnJlY29yZHMgKGFzc2lnbmVkX3RvX3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIElOREVYIGlkeF9yZWNvcmRzX2NoYW5nZXNldF9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnJlY29yZHMgKGNoYW5nZXNldF9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBTUEFUSUFMIElOREVYIGlkeF9yZWNvcmRzX2dlb21ldHJ5IE9OIF9fU0NIRU1BX18ucmVjb3JkcyAoZ2VvbWV0cnkpO1xuXG5DUkVBVEUgSU5ERVggaWR4X3JlY29yZHNfcHJvamVjdF9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnJlY29yZHMgKHByb2plY3RfcmVzb3VyY2VfaWQpO1xuXG4tLSBDUkVBVEUgSU5ERVggaWR4X3JlY29yZHNfcmVjb3JkX2luZGV4IE9OIF9fU0NIRU1BX18ucmVjb3JkcyBVU0lORyBnaW4gKHJlY29yZF9pbmRleCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcmVjb3Jkc19zZXJ2ZXJfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLnJlY29yZHMgKHNlcnZlcl91cGRhdGVkX2F0KTtcblxuQ1JFQVRFIElOREVYIGlkeF9yZWNvcmRzX3NlcnZlcl9jcmVhdGVkX2F0IE9OIF9fU0NIRU1BX18ucmVjb3JkcyAoc2VydmVyX2NyZWF0ZWRfYXQpO1xuXG5DUkVBVEUgSU5ERVggaWR4X3JlY29yZHNfc3RhdHVzIE9OIF9fU0NIRU1BX18ucmVjb3JkcyAoc3RhdHVzKTtcblxuSU5TRVJUIElOVE8gX19TQ0hFTUFfXy5taWdyYXRpb25zIChuYW1lKSBWQUxVRVMgKCcwMDInKTtcblxuRVhFQyBzcF9yZW5hbWUgJ19fU0NIRU1BX18uYXVkaW8nLCAnc3lzdGVtX2F1ZGlvJztcbkVYRUMgc3BfcmVuYW1lICdfX1NDSEVNQV9fLmNoYW5nZXNldHMnLCAnc3lzdGVtX2NoYW5nZXNldHMnO1xuRVhFQyBzcF9yZW5hbWUgJ19fU0NIRU1BX18uY2hvaWNlX2xpc3RzJywgJ3N5c3RlbV9jaG9pY2VfbGlzdHMnO1xuRVhFQyBzcF9yZW5hbWUgJ19fU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0cycsICdzeXN0ZW1fY2xhc3NpZmljYXRpb25fc2V0cyc7XG5FWEVDIHNwX3JlbmFtZSAnX19TQ0hFTUFfXy5mb3JtcycsICdzeXN0ZW1fZm9ybXMnO1xuRVhFQyBzcF9yZW5hbWUgJ19fU0NIRU1BX18ubWVtYmVyc2hpcHMnLCAnc3lzdGVtX21lbWJlcnNoaXBzJztcbkVYRUMgc3BfcmVuYW1lICdfX1NDSEVNQV9fLnBob3RvcycsICdzeXN0ZW1fcGhvdG9zJztcbkVYRUMgc3BfcmVuYW1lICdfX1NDSEVNQV9fLnByb2plY3RzJywgJ3N5c3RlbV9wcm9qZWN0cyc7XG5FWEVDIHNwX3JlbmFtZSAnX19TQ0hFTUFfXy5yb2xlcycsICdzeXN0ZW1fcm9sZXMnO1xuRVhFQyBzcF9yZW5hbWUgJ19fU0NIRU1BX18uc2lnbmF0dXJlcycsICdzeXN0ZW1fc2lnbmF0dXJlcyc7XG5FWEVDIHNwX3JlbmFtZSAnX19TQ0hFTUFfXy52aWRlb3MnLCAnc3lzdGVtX3ZpZGVvcyc7XG5FWEVDIHNwX3JlbmFtZSAnX19TQ0hFTUFfXy5yZWNvcmRzJywgJ3N5c3RlbV9yZWNvcmRzJztcblxuQ09NTUlUIFRSQU5TQUNUSU9OO1xuYDtcbiJdfQ==