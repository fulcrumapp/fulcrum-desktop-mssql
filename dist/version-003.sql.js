"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = `
BEGIN TRANSACTION;

IF OBJECT_ID('__VIEW_SCHEMA__.records_view', 'V') IS NOT NULL DROP VIEW __VIEW_SCHEMA__.records_view;

CREATE VIEW __VIEW_SCHEMA__.records_view AS
SELECT
  records.row_resource_id AS record_id,
  records.form_resource_id AS form_id,
  forms.name AS form_name,
  records.project_resource_id AS project_id,
  projects.name AS project_name,
  records.assigned_to_resource_id AS assigned_to_id,
  assignment.name AS assigned_to_name,
  records.status AS status,
  records.latitude AS latitude,
  records.longitude AS longitude,
  records.created_at AS created_at,
  records.updated_at AS updated_at,
  records.version AS version,
  records.created_by_resource_id AS created_by_id,
  created_by.name AS created_by_name,
  records.updated_by_resource_id AS updated_by_id,
  updated_by.name AS updated_by_name,
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
FROM __SCHEMA__.system_records records
LEFT OUTER JOIN __SCHEMA__.system_forms forms ON records.form_id = forms.row_id
LEFT OUTER JOIN __SCHEMA__.system_projects projects ON records.project_id = projects.row_id
LEFT OUTER JOIN __SCHEMA__.system_memberships assignment ON records.assigned_to_id = assignment.row_id
LEFT OUTER JOIN __SCHEMA__.system_memberships created_by ON records.created_by_id = created_by.row_id
LEFT OUTER JOIN __SCHEMA__.system_memberships updated_by ON records.updated_by_id = updated_by.row_id;

INSERT INTO __SCHEMA__.migrations (name) VALUES ('003');

COMMIT TRANSACTION;
`;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3ZlcnNpb24tMDAzLnNxbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztrQkFBZ0IiLCJmaWxlIjoidmVyc2lvbi0wMDMuc3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgYFxuQkVHSU4gVFJBTlNBQ1RJT047XG5cbklGIE9CSkVDVF9JRCgnX19WSUVXX1NDSEVNQV9fLnJlY29yZHNfdmlldycsICdWJykgSVMgTk9UIE5VTEwgRFJPUCBWSUVXIF9fVklFV19TQ0hFTUFfXy5yZWNvcmRzX3ZpZXc7XG5cbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5yZWNvcmRzX3ZpZXcgQVNcblNFTEVDVFxuICByZWNvcmRzLnJvd19yZXNvdXJjZV9pZCBBUyByZWNvcmRfaWQsXG4gIHJlY29yZHMuZm9ybV9yZXNvdXJjZV9pZCBBUyBmb3JtX2lkLFxuICBmb3Jtcy5uYW1lIEFTIGZvcm1fbmFtZSxcbiAgcmVjb3Jkcy5wcm9qZWN0X3Jlc291cmNlX2lkIEFTIHByb2plY3RfaWQsXG4gIHByb2plY3RzLm5hbWUgQVMgcHJvamVjdF9uYW1lLFxuICByZWNvcmRzLmFzc2lnbmVkX3RvX3Jlc291cmNlX2lkIEFTIGFzc2lnbmVkX3RvX2lkLFxuICBhc3NpZ25tZW50Lm5hbWUgQVMgYXNzaWduZWRfdG9fbmFtZSxcbiAgcmVjb3Jkcy5zdGF0dXMgQVMgc3RhdHVzLFxuICByZWNvcmRzLmxhdGl0dWRlIEFTIGxhdGl0dWRlLFxuICByZWNvcmRzLmxvbmdpdHVkZSBBUyBsb25naXR1ZGUsXG4gIHJlY29yZHMuY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICByZWNvcmRzLnVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcbiAgcmVjb3Jkcy52ZXJzaW9uIEFTIHZlcnNpb24sXG4gIHJlY29yZHMuY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICBjcmVhdGVkX2J5Lm5hbWUgQVMgY3JlYXRlZF9ieV9uYW1lLFxuICByZWNvcmRzLnVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgdXBkYXRlZF9ieS5uYW1lIEFTIHVwZGF0ZWRfYnlfbmFtZSxcbiAgcmVjb3Jkcy5zZXJ2ZXJfY3JlYXRlZF9hdCBBUyBzZXJ2ZXJfY3JlYXRlZF9hdCxcbiAgcmVjb3Jkcy5zZXJ2ZXJfdXBkYXRlZF9hdCBBUyBzZXJ2ZXJfdXBkYXRlZF9hdCxcbiAgcmVjb3Jkcy5nZW9tZXRyeSBBUyBnZW9tZXRyeSxcbiAgcmVjb3Jkcy5hbHRpdHVkZSBBUyBhbHRpdHVkZSxcbiAgcmVjb3Jkcy5zcGVlZCBBUyBzcGVlZCxcbiAgcmVjb3Jkcy5jb3Vyc2UgQVMgY291cnNlLFxuICByZWNvcmRzLmhvcml6b250YWxfYWNjdXJhY3kgQVMgaG9yaXpvbnRhbF9hY2N1cmFjeSxcbiAgcmVjb3Jkcy52ZXJ0aWNhbF9hY2N1cmFjeSBBUyB2ZXJ0aWNhbF9hY2N1cmFjeSxcbiAgcmVjb3Jkcy5jaGFuZ2VzZXRfcmVzb3VyY2VfaWQgQVMgY2hhbmdlc2V0X2lkLFxuICByZWNvcmRzLnRpdGxlIEFTIHRpdGxlLFxuICByZWNvcmRzLmNyZWF0ZWRfbGF0aXR1ZGUgQVMgY3JlYXRlZF9sYXRpdHVkZSxcbiAgcmVjb3Jkcy5jcmVhdGVkX2xvbmdpdHVkZSBBUyBjcmVhdGVkX2xvbmdpdHVkZSxcbiAgcmVjb3Jkcy5jcmVhdGVkX2dlb21ldHJ5IEFTIGNyZWF0ZWRfZ2VvbWV0cnksXG4gIHJlY29yZHMuY3JlYXRlZF9hbHRpdHVkZSBBUyBjcmVhdGVkX2FsdGl0dWRlLFxuICByZWNvcmRzLmNyZWF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeSBBUyBjcmVhdGVkX2hvcml6b250YWxfYWNjdXJhY3ksXG4gIHJlY29yZHMudXBkYXRlZF9sYXRpdHVkZSBBUyB1cGRhdGVkX2xhdGl0dWRlLFxuICByZWNvcmRzLnVwZGF0ZWRfbG9uZ2l0dWRlIEFTIHVwZGF0ZWRfbG9uZ2l0dWRlLFxuICByZWNvcmRzLnVwZGF0ZWRfZ2VvbWV0cnkgQVMgdXBkYXRlZF9nZW9tZXRyeSxcbiAgcmVjb3Jkcy51cGRhdGVkX2FsdGl0dWRlIEFTIHVwZGF0ZWRfYWx0aXR1ZGUsXG4gIHJlY29yZHMudXBkYXRlZF9ob3Jpem9udGFsX2FjY3VyYWN5IEFTIHVwZGF0ZWRfaG9yaXpvbnRhbF9hY2N1cmFjeSxcbiAgcmVjb3Jkcy5jcmVhdGVkX2R1cmF0aW9uIEFTIGNyZWF0ZWRfZHVyYXRpb24sXG4gIHJlY29yZHMudXBkYXRlZF9kdXJhdGlvbiBBUyB1cGRhdGVkX2R1cmF0aW9uLFxuICByZWNvcmRzLmVkaXRlZF9kdXJhdGlvbiBBUyBlZGl0ZWRfZHVyYXRpb25cbkZST00gX19TQ0hFTUFfXy5zeXN0ZW1fcmVjb3JkcyByZWNvcmRzXG5MRUZUIE9VVEVSIEpPSU4gX19TQ0hFTUFfXy5zeXN0ZW1fZm9ybXMgZm9ybXMgT04gcmVjb3Jkcy5mb3JtX2lkID0gZm9ybXMucm93X2lkXG5MRUZUIE9VVEVSIEpPSU4gX19TQ0hFTUFfXy5zeXN0ZW1fcHJvamVjdHMgcHJvamVjdHMgT04gcmVjb3Jkcy5wcm9qZWN0X2lkID0gcHJvamVjdHMucm93X2lkXG5MRUZUIE9VVEVSIEpPSU4gX19TQ0hFTUFfXy5zeXN0ZW1fbWVtYmVyc2hpcHMgYXNzaWdubWVudCBPTiByZWNvcmRzLmFzc2lnbmVkX3RvX2lkID0gYXNzaWdubWVudC5yb3dfaWRcbkxFRlQgT1VURVIgSk9JTiBfX1NDSEVNQV9fLnN5c3RlbV9tZW1iZXJzaGlwcyBjcmVhdGVkX2J5IE9OIHJlY29yZHMuY3JlYXRlZF9ieV9pZCA9IGNyZWF0ZWRfYnkucm93X2lkXG5MRUZUIE9VVEVSIEpPSU4gX19TQ0hFTUFfXy5zeXN0ZW1fbWVtYmVyc2hpcHMgdXBkYXRlZF9ieSBPTiByZWNvcmRzLnVwZGF0ZWRfYnlfaWQgPSB1cGRhdGVkX2J5LnJvd19pZDtcblxuSU5TRVJUIElOVE8gX19TQ0hFTUFfXy5taWdyYXRpb25zIChuYW1lKSBWQUxVRVMgKCcwMDMnKTtcblxuQ09NTUlUIFRSQU5TQUNUSU9OO1xuYDtcbiJdfQ==