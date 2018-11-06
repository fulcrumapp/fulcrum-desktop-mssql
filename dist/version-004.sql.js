"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = `
BEGIN TRANSACTION;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.audio_view;

CREATE VIEW __VIEW_SCHEMA__.audio_view AS
SELECT
  access_key AS audio_id,
  record_resource_id AS record_id,
  form_resource_id AS form_id,
  metadata AS metadata,
  file_size AS file_size,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  [file] AS [file],
  content_type AS content_type,
  is_uploaded AS is_uploaded,
  is_stored AS is_stored,
  is_processed AS is_processed,
  has_track AS has_track,
  track AS track,
  geometry AS geometry,
  duration AS duration,
  bit_rate AS bit_rate
FROM __SCHEMA__.system_audio;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.changesets_view;

CREATE VIEW __VIEW_SCHEMA__.changesets_view AS
SELECT
  row_resource_id AS changeset_id,
  form_resource_id AS form_id,
  metadata AS metadata,
  closed_at AS closed_at,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  closed_by_resource_id AS closed_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  min_lat AS min_lat,
  max_lat AS max_lat,
  min_lon AS min_lon,
  max_lon AS max_lon,
  number_of_changes AS number_of_changes,
  number_of_creates AS number_of_creates,
  number_of_updates AS number_of_updates,
  number_of_deletes AS number_of_deletes,
  metadata_index AS metadata_index,
  bounding_box AS bounding_box
FROM __SCHEMA__.system_changesets;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.choice_lists_view;

CREATE VIEW __VIEW_SCHEMA__.choice_lists_view AS
SELECT
  row_resource_id AS choice_list_id,
  name AS name,
  description AS description,
  version AS version,
  items AS items,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  deleted_at AS deleted_at
FROM __SCHEMA__.system_choice_lists;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.classification_sets_view;

CREATE VIEW __VIEW_SCHEMA__.classification_sets_view AS
SELECT
  row_resource_id AS classification_set_id,
  name AS name,
  description AS description,
  version AS version,
  items AS items,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  deleted_at AS deleted_at
FROM __SCHEMA__.system_classification_sets;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.forms_view;

CREATE VIEW __VIEW_SCHEMA__.forms_view AS
SELECT
  row_resource_id AS form_id,
  name AS name,
  description AS description,
  version AS version,
  elements AS elements,
  bounding_box AS bounding_box,
  status AS status,
  status_field AS status_field,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  deleted_at AS deleted_at,
  auto_assign AS auto_assign,
  title_field_keys AS title_field_keys,
  hidden_on_dashboard AS hidden_on_dashboard,
  geometry_types AS geometry_types,
  geometry_required AS geometry_required,
  script AS script,
  image AS image,
  projects_enabled AS projects_enabled,
  assignment_enabled AS assignment_enabled
FROM __SCHEMA__.system_forms;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.memberships_view;

CREATE VIEW __VIEW_SCHEMA__.memberships_view AS
SELECT
  memberships.row_resource_id AS membership_id,
  memberships.user_resource_id AS user_id,
  memberships.first_name AS first_name,
  memberships.last_name AS last_name,
  memberships.name AS name,
  memberships.email AS email,
  memberships.role_resource_id AS role_id,
  roles.name AS role_name,
  memberships.status AS status,
  memberships.created_at AS created_at,
  memberships.updated_at AS updated_at,
  memberships.deleted_at AS deleted_at
FROM __SCHEMA__.system_memberships memberships
LEFT OUTER JOIN __SCHEMA__.system_roles roles ON memberships.role_resource_id = roles.row_resource_id;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.photos_view;

CREATE VIEW __VIEW_SCHEMA__.photos_view AS
SELECT
  access_key AS photo_id,
  record_resource_id AS record_id,
  form_resource_id AS form_id,
  exif AS exif,
  file_size AS file_size,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  [file] AS [file],
  content_type AS content_type,
  is_uploaded AS is_uploaded,
  is_stored AS is_stored,
  is_processed AS is_processed,
  geometry AS geometry,
  latitude AS latitude,
  longitude AS longitude,
  altitude AS altitude,
  accuracy AS accuracy,
  direction AS direction,
  width AS width,
  height AS height,
  make AS make,
  model AS model,
  software AS software,
  date_time AS date_time
FROM __SCHEMA__.system_photos;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.projects_view;

CREATE VIEW __VIEW_SCHEMA__.projects_view AS
SELECT
  row_resource_id AS project_id,
  name AS name,
  description AS description,
  created_by_resource_id AS created_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  deleted_at AS deleted_at
FROM __SCHEMA__.system_projects;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.roles_view;

CREATE VIEW __VIEW_SCHEMA__.roles_view AS
SELECT
  row_resource_id AS role_id,
  name AS name,
  description AS description,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  deleted_at AS deleted_at,
  is_system AS is_system,
  is_default AS is_default,
  can_manage_subscription AS can_manage_subscription,
  can_update_organization AS can_update_organization,
  can_manage_members AS can_manage_members,
  can_manage_roles AS can_manage_roles,
  can_manage_apps AS can_manage_apps,
  can_manage_projects AS can_manage_projects,
  can_manage_choice_lists AS can_manage_choice_lists,
  can_manage_classification_sets AS can_manage_classification_sets,
  can_create_records AS can_create_records,
  can_update_records AS can_update_records,
  can_delete_records AS can_delete_records,
  can_change_status AS can_change_status,
  can_change_project AS can_change_project,
  can_assign_records AS can_assign_records,
  can_import_records AS can_import_records,
  can_export_records AS can_export_records,
  can_run_reports AS can_run_reports,
  can_manage_authorizations AS can_manage_authorizations
FROM __SCHEMA__.system_roles;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.signatures_view;

CREATE VIEW __VIEW_SCHEMA__.signatures_view AS
SELECT
  access_key AS signature_id,
  record_resource_id AS record_id,
  form_resource_id AS form_id,
  file_size AS file_size,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  [file] AS [file],
  content_type AS content_type,
  is_uploaded AS is_uploaded,
  is_stored AS is_stored,
  is_processed AS is_processed
FROM __SCHEMA__.system_signatures;

DROP VIEW IF EXISTS __VIEW_SCHEMA__.videos_view;

CREATE VIEW __VIEW_SCHEMA__.videos_view AS
SELECT
  access_key AS video_id,
  record_resource_id AS record_id,
  form_resource_id AS form_id,
  metadata AS metadata,
  file_size AS file_size,
  created_by_resource_id AS created_by_id,
  updated_by_resource_id AS updated_by_id,
  created_at AS created_at,
  updated_at AS updated_at,
  [file] AS [file],
  content_type AS content_type,
  is_uploaded AS is_uploaded,
  is_stored AS is_stored,
  is_processed AS is_processed,
  has_track AS has_track,
  track AS track,
  geometry AS geometry,
  width AS width,
  height AS height,
  duration AS duration,
  bit_rate AS bit_rate
FROM __SCHEMA__.system_videos;

INSERT INTO __SCHEMA__.migrations (name) VALUES ('004');

COMMIT TRANSACTION;
`;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3ZlcnNpb24tMDA0LnNxbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztrQkFBZ0IiLCJmaWxlIjoidmVyc2lvbi0wMDQuc3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgYFxuQkVHSU4gVFJBTlNBQ1RJT047XG5cbkRST1AgVklFVyBJRiBFWElTVFMgX19WSUVXX1NDSEVNQV9fLmF1ZGlvX3ZpZXc7XG5cbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5hdWRpb192aWV3IEFTXG5TRUxFQ1RcbiAgYWNjZXNzX2tleSBBUyBhdWRpb19pZCxcbiAgcmVjb3JkX3Jlc291cmNlX2lkIEFTIHJlY29yZF9pZCxcbiAgZm9ybV9yZXNvdXJjZV9pZCBBUyBmb3JtX2lkLFxuICBtZXRhZGF0YSBBUyBtZXRhZGF0YSxcbiAgZmlsZV9zaXplIEFTIGZpbGVfc2l6ZSxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBbZmlsZV0gQVMgW2ZpbGVdLFxuICBjb250ZW50X3R5cGUgQVMgY29udGVudF90eXBlLFxuICBpc191cGxvYWRlZCBBUyBpc191cGxvYWRlZCxcbiAgaXNfc3RvcmVkIEFTIGlzX3N0b3JlZCxcbiAgaXNfcHJvY2Vzc2VkIEFTIGlzX3Byb2Nlc3NlZCxcbiAgaGFzX3RyYWNrIEFTIGhhc190cmFjayxcbiAgdHJhY2sgQVMgdHJhY2ssXG4gIGdlb21ldHJ5IEFTIGdlb21ldHJ5LFxuICBkdXJhdGlvbiBBUyBkdXJhdGlvbixcbiAgYml0X3JhdGUgQVMgYml0X3JhdGVcbkZST00gX19TQ0hFTUFfXy5zeXN0ZW1fYXVkaW87XG5cbkRST1AgVklFVyBJRiBFWElTVFMgX19WSUVXX1NDSEVNQV9fLmNoYW5nZXNldHNfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLmNoYW5nZXNldHNfdmlldyBBU1xuU0VMRUNUXG4gIHJvd19yZXNvdXJjZV9pZCBBUyBjaGFuZ2VzZXRfaWQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcbiAgbWV0YWRhdGEgQVMgbWV0YWRhdGEsXG4gIGNsb3NlZF9hdCBBUyBjbG9zZWRfYXQsXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxuICBjbG9zZWRfYnlfcmVzb3VyY2VfaWQgQVMgY2xvc2VkX2J5X2lkLFxuICBjcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcbiAgbWluX2xhdCBBUyBtaW5fbGF0LFxuICBtYXhfbGF0IEFTIG1heF9sYXQsXG4gIG1pbl9sb24gQVMgbWluX2xvbixcbiAgbWF4X2xvbiBBUyBtYXhfbG9uLFxuICBudW1iZXJfb2ZfY2hhbmdlcyBBUyBudW1iZXJfb2ZfY2hhbmdlcyxcbiAgbnVtYmVyX29mX2NyZWF0ZXMgQVMgbnVtYmVyX29mX2NyZWF0ZXMsXG4gIG51bWJlcl9vZl91cGRhdGVzIEFTIG51bWJlcl9vZl91cGRhdGVzLFxuICBudW1iZXJfb2ZfZGVsZXRlcyBBUyBudW1iZXJfb2ZfZGVsZXRlcyxcbiAgbWV0YWRhdGFfaW5kZXggQVMgbWV0YWRhdGFfaW5kZXgsXG4gIGJvdW5kaW5nX2JveCBBUyBib3VuZGluZ19ib3hcbkZST00gX19TQ0hFTUFfXy5zeXN0ZW1fY2hhbmdlc2V0cztcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18uY2hvaWNlX2xpc3RzX3ZpZXc7XG5cbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5jaG9pY2VfbGlzdHNfdmlldyBBU1xuU0VMRUNUXG4gIHJvd19yZXNvdXJjZV9pZCBBUyBjaG9pY2VfbGlzdF9pZCxcbiAgbmFtZSBBUyBuYW1lLFxuICBkZXNjcmlwdGlvbiBBUyBkZXNjcmlwdGlvbixcbiAgdmVyc2lvbiBBUyB2ZXJzaW9uLFxuICBpdGVtcyBBUyBpdGVtcyxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBkZWxldGVkX2F0IEFTIGRlbGV0ZWRfYXRcbkZST00gX19TQ0hFTUFfXy5zeXN0ZW1fY2hvaWNlX2xpc3RzO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy5jbGFzc2lmaWNhdGlvbl9zZXRzX3ZpZXc7XG5cbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5jbGFzc2lmaWNhdGlvbl9zZXRzX3ZpZXcgQVNcblNFTEVDVFxuICByb3dfcmVzb3VyY2VfaWQgQVMgY2xhc3NpZmljYXRpb25fc2V0X2lkLFxuICBuYW1lIEFTIG5hbWUsXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxuICB2ZXJzaW9uIEFTIHZlcnNpb24sXG4gIGl0ZW1zIEFTIGl0ZW1zLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIGRlbGV0ZWRfYXQgQVMgZGVsZXRlZF9hdFxuRlJPTSBfX1NDSEVNQV9fLnN5c3RlbV9jbGFzc2lmaWNhdGlvbl9zZXRzO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy5mb3Jtc192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18uZm9ybXNfdmlldyBBU1xuU0VMRUNUXG4gIHJvd19yZXNvdXJjZV9pZCBBUyBmb3JtX2lkLFxuICBuYW1lIEFTIG5hbWUsXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxuICB2ZXJzaW9uIEFTIHZlcnNpb24sXG4gIGVsZW1lbnRzIEFTIGVsZW1lbnRzLFxuICBib3VuZGluZ19ib3ggQVMgYm91bmRpbmdfYm94LFxuICBzdGF0dXMgQVMgc3RhdHVzLFxuICBzdGF0dXNfZmllbGQgQVMgc3RhdHVzX2ZpZWxkLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIGRlbGV0ZWRfYXQgQVMgZGVsZXRlZF9hdCxcbiAgYXV0b19hc3NpZ24gQVMgYXV0b19hc3NpZ24sXG4gIHRpdGxlX2ZpZWxkX2tleXMgQVMgdGl0bGVfZmllbGRfa2V5cyxcbiAgaGlkZGVuX29uX2Rhc2hib2FyZCBBUyBoaWRkZW5fb25fZGFzaGJvYXJkLFxuICBnZW9tZXRyeV90eXBlcyBBUyBnZW9tZXRyeV90eXBlcyxcbiAgZ2VvbWV0cnlfcmVxdWlyZWQgQVMgZ2VvbWV0cnlfcmVxdWlyZWQsXG4gIHNjcmlwdCBBUyBzY3JpcHQsXG4gIGltYWdlIEFTIGltYWdlLFxuICBwcm9qZWN0c19lbmFibGVkIEFTIHByb2plY3RzX2VuYWJsZWQsXG4gIGFzc2lnbm1lbnRfZW5hYmxlZCBBUyBhc3NpZ25tZW50X2VuYWJsZWRcbkZST00gX19TQ0hFTUFfXy5zeXN0ZW1fZm9ybXM7XG5cbkRST1AgVklFVyBJRiBFWElTVFMgX19WSUVXX1NDSEVNQV9fLm1lbWJlcnNoaXBzX3ZpZXc7XG5cbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5tZW1iZXJzaGlwc192aWV3IEFTXG5TRUxFQ1RcbiAgbWVtYmVyc2hpcHMucm93X3Jlc291cmNlX2lkIEFTIG1lbWJlcnNoaXBfaWQsXG4gIG1lbWJlcnNoaXBzLnVzZXJfcmVzb3VyY2VfaWQgQVMgdXNlcl9pZCxcbiAgbWVtYmVyc2hpcHMuZmlyc3RfbmFtZSBBUyBmaXJzdF9uYW1lLFxuICBtZW1iZXJzaGlwcy5sYXN0X25hbWUgQVMgbGFzdF9uYW1lLFxuICBtZW1iZXJzaGlwcy5uYW1lIEFTIG5hbWUsXG4gIG1lbWJlcnNoaXBzLmVtYWlsIEFTIGVtYWlsLFxuICBtZW1iZXJzaGlwcy5yb2xlX3Jlc291cmNlX2lkIEFTIHJvbGVfaWQsXG4gIHJvbGVzLm5hbWUgQVMgcm9sZV9uYW1lLFxuICBtZW1iZXJzaGlwcy5zdGF0dXMgQVMgc3RhdHVzLFxuICBtZW1iZXJzaGlwcy5jcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXG4gIG1lbWJlcnNoaXBzLnVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcbiAgbWVtYmVyc2hpcHMuZGVsZXRlZF9hdCBBUyBkZWxldGVkX2F0XG5GUk9NIF9fU0NIRU1BX18uc3lzdGVtX21lbWJlcnNoaXBzIG1lbWJlcnNoaXBzXG5MRUZUIE9VVEVSIEpPSU4gX19TQ0hFTUFfXy5zeXN0ZW1fcm9sZXMgcm9sZXMgT04gbWVtYmVyc2hpcHMucm9sZV9yZXNvdXJjZV9pZCA9IHJvbGVzLnJvd19yZXNvdXJjZV9pZDtcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18ucGhvdG9zX3ZpZXc7XG5cbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5waG90b3NfdmlldyBBU1xuU0VMRUNUXG4gIGFjY2Vzc19rZXkgQVMgcGhvdG9faWQsXG4gIHJlY29yZF9yZXNvdXJjZV9pZCBBUyByZWNvcmRfaWQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcbiAgZXhpZiBBUyBleGlmLFxuICBmaWxlX3NpemUgQVMgZmlsZV9zaXplLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIFtmaWxlXSBBUyBbZmlsZV0sXG4gIGNvbnRlbnRfdHlwZSBBUyBjb250ZW50X3R5cGUsXG4gIGlzX3VwbG9hZGVkIEFTIGlzX3VwbG9hZGVkLFxuICBpc19zdG9yZWQgQVMgaXNfc3RvcmVkLFxuICBpc19wcm9jZXNzZWQgQVMgaXNfcHJvY2Vzc2VkLFxuICBnZW9tZXRyeSBBUyBnZW9tZXRyeSxcbiAgbGF0aXR1ZGUgQVMgbGF0aXR1ZGUsXG4gIGxvbmdpdHVkZSBBUyBsb25naXR1ZGUsXG4gIGFsdGl0dWRlIEFTIGFsdGl0dWRlLFxuICBhY2N1cmFjeSBBUyBhY2N1cmFjeSxcbiAgZGlyZWN0aW9uIEFTIGRpcmVjdGlvbixcbiAgd2lkdGggQVMgd2lkdGgsXG4gIGhlaWdodCBBUyBoZWlnaHQsXG4gIG1ha2UgQVMgbWFrZSxcbiAgbW9kZWwgQVMgbW9kZWwsXG4gIHNvZnR3YXJlIEFTIHNvZnR3YXJlLFxuICBkYXRlX3RpbWUgQVMgZGF0ZV90aW1lXG5GUk9NIF9fU0NIRU1BX18uc3lzdGVtX3Bob3RvcztcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18ucHJvamVjdHNfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnByb2plY3RzX3ZpZXcgQVNcblNFTEVDVFxuICByb3dfcmVzb3VyY2VfaWQgQVMgcHJvamVjdF9pZCxcbiAgbmFtZSBBUyBuYW1lLFxuICBkZXNjcmlwdGlvbiBBUyBkZXNjcmlwdGlvbixcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICBjcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcbiAgZGVsZXRlZF9hdCBBUyBkZWxldGVkX2F0XG5GUk9NIF9fU0NIRU1BX18uc3lzdGVtX3Byb2plY3RzO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy5yb2xlc192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18ucm9sZXNfdmlldyBBU1xuU0VMRUNUXG4gIHJvd19yZXNvdXJjZV9pZCBBUyByb2xlX2lkLFxuICBuYW1lIEFTIG5hbWUsXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIGRlbGV0ZWRfYXQgQVMgZGVsZXRlZF9hdCxcbiAgaXNfc3lzdGVtIEFTIGlzX3N5c3RlbSxcbiAgaXNfZGVmYXVsdCBBUyBpc19kZWZhdWx0LFxuICBjYW5fbWFuYWdlX3N1YnNjcmlwdGlvbiBBUyBjYW5fbWFuYWdlX3N1YnNjcmlwdGlvbixcbiAgY2FuX3VwZGF0ZV9vcmdhbml6YXRpb24gQVMgY2FuX3VwZGF0ZV9vcmdhbml6YXRpb24sXG4gIGNhbl9tYW5hZ2VfbWVtYmVycyBBUyBjYW5fbWFuYWdlX21lbWJlcnMsXG4gIGNhbl9tYW5hZ2Vfcm9sZXMgQVMgY2FuX21hbmFnZV9yb2xlcyxcbiAgY2FuX21hbmFnZV9hcHBzIEFTIGNhbl9tYW5hZ2VfYXBwcyxcbiAgY2FuX21hbmFnZV9wcm9qZWN0cyBBUyBjYW5fbWFuYWdlX3Byb2plY3RzLFxuICBjYW5fbWFuYWdlX2Nob2ljZV9saXN0cyBBUyBjYW5fbWFuYWdlX2Nob2ljZV9saXN0cyxcbiAgY2FuX21hbmFnZV9jbGFzc2lmaWNhdGlvbl9zZXRzIEFTIGNhbl9tYW5hZ2VfY2xhc3NpZmljYXRpb25fc2V0cyxcbiAgY2FuX2NyZWF0ZV9yZWNvcmRzIEFTIGNhbl9jcmVhdGVfcmVjb3JkcyxcbiAgY2FuX3VwZGF0ZV9yZWNvcmRzIEFTIGNhbl91cGRhdGVfcmVjb3JkcyxcbiAgY2FuX2RlbGV0ZV9yZWNvcmRzIEFTIGNhbl9kZWxldGVfcmVjb3JkcyxcbiAgY2FuX2NoYW5nZV9zdGF0dXMgQVMgY2FuX2NoYW5nZV9zdGF0dXMsXG4gIGNhbl9jaGFuZ2VfcHJvamVjdCBBUyBjYW5fY2hhbmdlX3Byb2plY3QsXG4gIGNhbl9hc3NpZ25fcmVjb3JkcyBBUyBjYW5fYXNzaWduX3JlY29yZHMsXG4gIGNhbl9pbXBvcnRfcmVjb3JkcyBBUyBjYW5faW1wb3J0X3JlY29yZHMsXG4gIGNhbl9leHBvcnRfcmVjb3JkcyBBUyBjYW5fZXhwb3J0X3JlY29yZHMsXG4gIGNhbl9ydW5fcmVwb3J0cyBBUyBjYW5fcnVuX3JlcG9ydHMsXG4gIGNhbl9tYW5hZ2VfYXV0aG9yaXphdGlvbnMgQVMgY2FuX21hbmFnZV9hdXRob3JpemF0aW9uc1xuRlJPTSBfX1NDSEVNQV9fLnN5c3RlbV9yb2xlcztcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18uc2lnbmF0dXJlc192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18uc2lnbmF0dXJlc192aWV3IEFTXG5TRUxFQ1RcbiAgYWNjZXNzX2tleSBBUyBzaWduYXR1cmVfaWQsXG4gIHJlY29yZF9yZXNvdXJjZV9pZCBBUyByZWNvcmRfaWQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcbiAgZmlsZV9zaXplIEFTIGZpbGVfc2l6ZSxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBbZmlsZV0gQVMgW2ZpbGVdLFxuICBjb250ZW50X3R5cGUgQVMgY29udGVudF90eXBlLFxuICBpc191cGxvYWRlZCBBUyBpc191cGxvYWRlZCxcbiAgaXNfc3RvcmVkIEFTIGlzX3N0b3JlZCxcbiAgaXNfcHJvY2Vzc2VkIEFTIGlzX3Byb2Nlc3NlZFxuRlJPTSBfX1NDSEVNQV9fLnN5c3RlbV9zaWduYXR1cmVzO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy52aWRlb3NfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnZpZGVvc192aWV3IEFTXG5TRUxFQ1RcbiAgYWNjZXNzX2tleSBBUyB2aWRlb19pZCxcbiAgcmVjb3JkX3Jlc291cmNlX2lkIEFTIHJlY29yZF9pZCxcbiAgZm9ybV9yZXNvdXJjZV9pZCBBUyBmb3JtX2lkLFxuICBtZXRhZGF0YSBBUyBtZXRhZGF0YSxcbiAgZmlsZV9zaXplIEFTIGZpbGVfc2l6ZSxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBbZmlsZV0gQVMgW2ZpbGVdLFxuICBjb250ZW50X3R5cGUgQVMgY29udGVudF90eXBlLFxuICBpc191cGxvYWRlZCBBUyBpc191cGxvYWRlZCxcbiAgaXNfc3RvcmVkIEFTIGlzX3N0b3JlZCxcbiAgaXNfcHJvY2Vzc2VkIEFTIGlzX3Byb2Nlc3NlZCxcbiAgaGFzX3RyYWNrIEFTIGhhc190cmFjayxcbiAgdHJhY2sgQVMgdHJhY2ssXG4gIGdlb21ldHJ5IEFTIGdlb21ldHJ5LFxuICB3aWR0aCBBUyB3aWR0aCxcbiAgaGVpZ2h0IEFTIGhlaWdodCxcbiAgZHVyYXRpb24gQVMgZHVyYXRpb24sXG4gIGJpdF9yYXRlIEFTIGJpdF9yYXRlXG5GUk9NIF9fU0NIRU1BX18uc3lzdGVtX3ZpZGVvcztcblxuSU5TRVJUIElOVE8gX19TQ0hFTUFfXy5taWdyYXRpb25zIChuYW1lKSBWQUxVRVMgKCcwMDQnKTtcblxuQ09NTUlUIFRSQU5TQUNUSU9OO1xuYDtcbiJdfQ==