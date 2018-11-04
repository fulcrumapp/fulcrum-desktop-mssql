"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = `
BEGIN TRANSACTION;

CREATE TABLE __SCHEMA__.migrations (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  name varchar(100) NOT NULL,
  created_at datetime NOT NULL DEFAULT GETDATE()
);

CREATE UNIQUE INDEX idx_migrations_name ON __SCHEMA__.migrations (name);

CREATE TABLE __SCHEMA__.audio (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  access_key varchar(100) NOT NULL,
  record_id bigint,
  record_resource_id varchar(100),
  form_id bigint,
  form_resource_id varchar(100),
  metadata varchar(max),
  file_size bigint,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  [file] varchar(max),
  content_type varchar(max),
  is_uploaded bit NOT NULL DEFAULT 0,
  is_stored bit NOT NULL DEFAULT 0,
  is_processed bit NOT NULL DEFAULT 0,
  has_track bit,
  track varchar(max),
  geometry geography,
  duration float,
  bit_rate float
);

CREATE TABLE __SCHEMA__.changesets (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  form_id bigint NULL,
  form_resource_id varchar(100),
  metadata varchar(max),
  closed_at datetime,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  closed_by_id bigint,
  closed_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  min_lat float,
  max_lat float,
  min_lon float,
  max_lon float,
  number_of_changes bigint,
  number_of_creates bigint,
  number_of_updates bigint,
  number_of_deletes bigint,
  metadata_index_text varchar(max),
  metadata_index varchar(max),
  bounding_box geography
);

CREATE TABLE __SCHEMA__.choice_lists (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  name varchar(1000) NOT NULL,
  description varchar(max),
  version bigint NOT NULL,
  items varchar(max) NOT NULL,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  deleted_at datetime
);

CREATE TABLE __SCHEMA__.classification_sets (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  name varchar(1000) NOT NULL,
  description varchar(max),
  version bigint NOT NULL,
  items varchar(max) NOT NULL,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  deleted_at datetime
);

CREATE TABLE __SCHEMA__.forms (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  name varchar(1000) NOT NULL,
  description varchar(max),
  version bigint NOT NULL,
  elements varchar(max),
  bounding_box geography,
  record_count bigint NOT NULL DEFAULT 0,
  record_changed_at datetime,
  recent_lat_longs varchar(max),
  status varchar(max),
  status_field varchar(max),
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  photo_usage bigint,
  photo_count bigint,
  video_usage bigint,
  video_count bigint,
  audio_usage bigint,
  audio_count bigint,
  signature_usage bigint,
  signature_count bigint,
  media_usage bigint,
  media_count bigint,
  auto_assign bit NOT NULL,
  title_field_keys varchar(max),
  hidden_on_dashboard bit NOT NULL,
  geometry_types varchar(max),
  geometry_required bit NOT NULL,
  script varchar(max),
  image varchar(max),
  projects_enabled bit NOT NULL,
  assignment_enabled bit NOT NULL,
  deleted_at datetime
);

CREATE TABLE __SCHEMA__.memberships (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  user_resource_id varchar(100),
  first_name varchar(max),
  last_name varchar(max),
  name varchar(1000),
  email varchar(max),
  role_id bigint NOT NULL,
  role_resource_id varchar(100) NOT NULL,
  status varchar(max),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  deleted_at datetime
);

CREATE TABLE __SCHEMA__.photos (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  access_key varchar(100) NOT NULL,
  record_id bigint,
  record_resource_id varchar(100),
  form_id bigint,
  form_resource_id varchar(100),
  exif varchar(max),
  file_size bigint,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  [file] varchar(max),
  content_type varchar(max),
  is_uploaded bit NOT NULL DEFAULT 0,
  is_stored bit NOT NULL DEFAULT 0,
  is_processed bit NOT NULL DEFAULT 0,
  geometry geography,
  latitude float,
  longitude float,
  altitude float,
  accuracy float,
  direction float,
  width bigint,
  height bigint,
  make varchar(max),
  model varchar(max),
  software varchar(max),
  date_time varchar(max)
);

CREATE TABLE __SCHEMA__.projects (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  name varchar(1000) NOT NULL,
  description varchar(max),
  created_by_id bigint,
  created_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  deleted_at datetime
);

CREATE TABLE __SCHEMA__.roles (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  name varchar(1000) NOT NULL,
  description varchar(max),
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  is_system bit NOT NULL,
  is_default bit NOT NULL,
  can_manage_subscription bit NOT NULL DEFAULT 0,
  can_update_organization bit NOT NULL DEFAULT 0,
  can_manage_members bit NOT NULL DEFAULT 0,
  can_manage_roles bit NOT NULL DEFAULT 0,
  can_manage_apps bit NOT NULL DEFAULT 0,
  can_manage_projects bit NOT NULL DEFAULT 0,
  can_manage_choice_lists bit NOT NULL DEFAULT 0,
  can_manage_classification_sets bit NOT NULL DEFAULT 0,
  can_create_records bit NOT NULL DEFAULT 0,
  can_update_records bit NOT NULL DEFAULT 0,
  can_delete_records bit NOT NULL DEFAULT 0,
  can_change_status bit NOT NULL DEFAULT 0,
  can_change_project bit NOT NULL DEFAULT 0,
  can_assign_records bit NOT NULL DEFAULT 0,
  can_import_records bit NOT NULL DEFAULT 0,
  can_export_records bit NOT NULL DEFAULT 0,
  can_run_reports bit NOT NULL DEFAULT 0,
  can_manage_authorizations bit NOT NULL DEFAULT 0,
  deleted_at datetime
);

CREATE TABLE __SCHEMA__.signatures (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  access_key varchar(100) NOT NULL,
  record_id bigint,
  record_resource_id varchar(100),
  form_id bigint,
  form_resource_id varchar(100),
  exif varchar(max),
  file_size bigint,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  [file] varchar(max),
  content_type varchar(max),
  is_uploaded bit NOT NULL DEFAULT 0,
  is_stored bit NOT NULL DEFAULT 0,
  is_processed bit NOT NULL DEFAULT 0
);

CREATE TABLE __SCHEMA__.videos (
  id bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  row_id bigint NOT NULL,
  row_resource_id varchar(100) NOT NULL,
  access_key varchar(100) NOT NULL,
  record_id bigint,
  record_resource_id varchar(100),
  form_id bigint,
  form_resource_id varchar(100),
  metadata varchar(max),
  file_size bigint,
  created_by_id bigint,
  created_by_resource_id varchar(100),
  updated_by_id bigint,
  updated_by_resource_id varchar(100),
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  [file] varchar(max),
  content_type varchar(max),
  is_uploaded bit NOT NULL DEFAULT 0,
  is_stored bit NOT NULL DEFAULT 0,
  is_processed bit NOT NULL DEFAULT 0,
  has_track bit,
  track varchar(max),
  geometry geography,
  width bigint,
  height bigint,
  duration float,
  bit_rate float
);

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
FROM __SCHEMA__.audio;

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
FROM __SCHEMA__.changesets;

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
FROM __SCHEMA__.choice_lists;

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
FROM __SCHEMA__.classification_sets;

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
FROM __SCHEMA__.forms;

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
FROM __SCHEMA__.memberships memberships
LEFT OUTER JOIN __SCHEMA__.roles roles ON memberships.role_resource_id = roles.row_resource_id;

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
FROM __SCHEMA__.photos;

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
FROM __SCHEMA__.projects;

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
FROM __SCHEMA__.roles;

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
FROM __SCHEMA__.signatures;

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
FROM __SCHEMA__.videos;

CREATE UNIQUE INDEX idx_audio_row_resource_id ON __SCHEMA__.audio (row_resource_id);

CREATE UNIQUE INDEX idx_audio_row_id ON __SCHEMA__.audio (row_id);

CREATE INDEX idx_audio_access_key ON __SCHEMA__.audio (access_key);

CREATE INDEX idx_audio_record_resource_id ON __SCHEMA__.audio (record_resource_id);

CREATE INDEX idx_audio_form_resource_id ON __SCHEMA__.audio (form_resource_id);

CREATE INDEX idx_audio_created_by_resource_id ON __SCHEMA__.audio (created_by_resource_id);

CREATE SPATIAL INDEX idx_audio_geometry ON __SCHEMA__.audio (geometry);

CREATE INDEX idx_audio_updated_at ON __SCHEMA__.audio (updated_at);

CREATE UNIQUE INDEX idx_changesets_row_resource_id ON __SCHEMA__.changesets (row_resource_id);

CREATE UNIQUE INDEX idx_changesets_row_id ON __SCHEMA__.changesets (row_id);

CREATE INDEX idx_changesets_form_id ON __SCHEMA__.changesets (form_id);

-- CREATE INDEX idx_changesets_metadata_index ON __SCHEMA__.changesets USING gin (metadata_index) WITH (fastupdate = off);

CREATE INDEX idx_changesets_form_id_updated_at ON __SCHEMA__.changesets (form_id, updated_at);

CREATE INDEX idx_changesets_updated_at ON __SCHEMA__.changesets (updated_at);

CREATE UNIQUE INDEX idx_choice_lists_row_resource_id ON __SCHEMA__.choice_lists (row_resource_id);

CREATE UNIQUE INDEX idx_choice_lists_row_id ON __SCHEMA__.choice_lists (row_id);

CREATE INDEX idx_choice_lists_name ON __SCHEMA__.choice_lists (name);

CREATE INDEX idx_choice_lists_updated_at ON __SCHEMA__.choice_lists (updated_at);

CREATE UNIQUE INDEX idx_classification_sets_row_resource_id ON __SCHEMA__.classification_sets (row_resource_id);

CREATE UNIQUE INDEX idx_classification_sets_row_id ON __SCHEMA__.classification_sets (row_id);

CREATE INDEX idx_classification_sets_name ON __SCHEMA__.classification_sets (name);

CREATE INDEX idx_classification_sets_updated_at ON __SCHEMA__.classification_sets (updated_at);

CREATE UNIQUE INDEX idx_forms_row_resource_id ON __SCHEMA__.forms (row_resource_id);

CREATE UNIQUE INDEX idx_forms_row_id ON __SCHEMA__.forms (row_id);

CREATE INDEX idx_forms_name ON __SCHEMA__.forms (name);

CREATE INDEX idx_forms_updated_at ON __SCHEMA__.forms (updated_at);

CREATE UNIQUE INDEX idx_memberships_row_resource_id ON __SCHEMA__.memberships (row_resource_id);

CREATE UNIQUE INDEX idx_memberships_row_id ON __SCHEMA__.memberships (row_id);

CREATE INDEX idx_memberships_user_resource_id ON __SCHEMA__.memberships (user_resource_id);

CREATE INDEX idx_memberships_role_resource_id ON __SCHEMA__.memberships (role_resource_id);

CREATE INDEX idx_memberships_name ON __SCHEMA__.memberships (name);

CREATE INDEX idx_memberships_updated_at ON __SCHEMA__.memberships (updated_at);

CREATE UNIQUE INDEX idx_photos_row_resource_id ON __SCHEMA__.photos (row_resource_id);

CREATE UNIQUE INDEX idx_photos_row_id ON __SCHEMA__.photos (row_id);

CREATE INDEX idx_photos_access_key ON __SCHEMA__.photos (access_key);

CREATE INDEX idx_photos_record_resource_id ON __SCHEMA__.photos (record_resource_id);

CREATE INDEX idx_photos_form_resource_id ON __SCHEMA__.photos (form_resource_id);

CREATE INDEX idx_photos_created_by_resource_id ON __SCHEMA__.photos (created_by_resource_id);

CREATE SPATIAL INDEX idx_photos_geometry ON __SCHEMA__.photos (geometry);

CREATE INDEX idx_photos_updated_at ON __SCHEMA__.photos (updated_at);

CREATE UNIQUE INDEX idx_projects_row_resource_id ON __SCHEMA__.projects (row_resource_id);

CREATE UNIQUE INDEX idx_projects_row_id ON __SCHEMA__.projects (row_id);

CREATE INDEX idx_projects_name ON __SCHEMA__.projects (name);

CREATE INDEX idx_projects_updated_at ON __SCHEMA__.projects (updated_at);

CREATE UNIQUE INDEX idx_roles_row_resource_id ON __SCHEMA__.roles (row_resource_id);

CREATE UNIQUE INDEX idx_roles_row_id ON __SCHEMA__.roles (row_id);

CREATE INDEX idx_roles_name ON __SCHEMA__.roles (name);

CREATE INDEX idx_roles_updated_at ON __SCHEMA__.roles (updated_at);

CREATE UNIQUE INDEX idx_signatures_row_resource_id ON __SCHEMA__.signatures (row_resource_id);

CREATE UNIQUE INDEX idx_signatures_row_id ON __SCHEMA__.signatures (row_id);

CREATE INDEX idx_signatures_access_key ON __SCHEMA__.signatures (access_key);

CREATE INDEX idx_signatures_record_resource_id ON __SCHEMA__.signatures (record_resource_id);

CREATE INDEX idx_signatures_form_resource_id ON __SCHEMA__.signatures (form_resource_id);

CREATE INDEX idx_signatures_created_by_resource_id ON __SCHEMA__.signatures (created_by_resource_id);

CREATE INDEX idx_signatures_updated_at ON __SCHEMA__.signatures (updated_at);

CREATE UNIQUE INDEX idx_videos_row_resource_id ON __SCHEMA__.videos (row_resource_id);

CREATE UNIQUE INDEX idx_videos_row_id ON __SCHEMA__.videos (row_id);

CREATE INDEX idx_videos_access_key ON __SCHEMA__.videos (access_key);

CREATE INDEX idx_videos_record_resource_id ON __SCHEMA__.videos (record_resource_id);

CREATE INDEX idx_videos_form_resource_id ON __SCHEMA__.videos (form_resource_id);

CREATE INDEX idx_videos_created_by_resource_id ON __SCHEMA__.videos (created_by_resource_id);

CREATE SPATIAL INDEX idx_videos_geometry ON __SCHEMA__.videos (geometry);

CREATE INDEX idx_videos_updated_at ON __SCHEMA__.videos (updated_at);

COMMIT TRANSACTION;
`;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3ZlcnNpb24tMDAxLnNxbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztrQkFBZ0IiLCJmaWxlIjoidmVyc2lvbi0wMDEuc3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgYFxuQkVHSU4gVFJBTlNBQ1RJT047XG5cbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLm1pZ3JhdGlvbnMgKFxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcbiAgbmFtZSB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwgREVGQVVMVCBHRVREQVRFKClcbik7XG5cbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X21pZ3JhdGlvbnNfbmFtZSBPTiBfX1NDSEVNQV9fLm1pZ3JhdGlvbnMgKG5hbWUpO1xuXG5DUkVBVEUgVEFCTEUgX19TQ0hFTUFfXy5hdWRpbyAoXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxuICByb3dfaWQgYmlnaW50IE5PVCBOVUxMLFxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxuICBhY2Nlc3Nfa2V5IHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcbiAgcmVjb3JkX2lkIGJpZ2ludCxcbiAgcmVjb3JkX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgZm9ybV9pZCBiaWdpbnQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBtZXRhZGF0YSB2YXJjaGFyKG1heCksXG4gIGZpbGVfc2l6ZSBiaWdpbnQsXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgdXBkYXRlZF9ieV9pZCBiaWdpbnQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBjcmVhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxuICB1cGRhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxuICBbZmlsZV0gdmFyY2hhcihtYXgpLFxuICBjb250ZW50X3R5cGUgdmFyY2hhcihtYXgpLFxuICBpc191cGxvYWRlZCBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBpc19zdG9yZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcbiAgaXNfcHJvY2Vzc2VkIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGhhc190cmFjayBiaXQsXG4gIHRyYWNrIHZhcmNoYXIobWF4KSxcbiAgZ2VvbWV0cnkgZ2VvZ3JhcGh5LFxuICBkdXJhdGlvbiBmbG9hdCxcbiAgYml0X3JhdGUgZmxvYXRcbik7XG5cbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLmNoYW5nZXNldHMgKFxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcbiAgcm93X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcbiAgZm9ybV9pZCBiaWdpbnQgTlVMTCxcbiAgZm9ybV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIG1ldGFkYXRhIHZhcmNoYXIobWF4KSxcbiAgY2xvc2VkX2F0IGRhdGV0aW1lLFxuICBjcmVhdGVkX2J5X2lkIGJpZ2ludCxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgY2xvc2VkX2J5X2lkIGJpZ2ludCxcbiAgY2xvc2VkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgbWluX2xhdCBmbG9hdCxcbiAgbWF4X2xhdCBmbG9hdCxcbiAgbWluX2xvbiBmbG9hdCxcbiAgbWF4X2xvbiBmbG9hdCxcbiAgbnVtYmVyX29mX2NoYW5nZXMgYmlnaW50LFxuICBudW1iZXJfb2ZfY3JlYXRlcyBiaWdpbnQsXG4gIG51bWJlcl9vZl91cGRhdGVzIGJpZ2ludCxcbiAgbnVtYmVyX29mX2RlbGV0ZXMgYmlnaW50LFxuICBtZXRhZGF0YV9pbmRleF90ZXh0IHZhcmNoYXIobWF4KSxcbiAgbWV0YWRhdGFfaW5kZXggdmFyY2hhcihtYXgpLFxuICBib3VuZGluZ19ib3ggZ2VvZ3JhcGh5XG4pO1xuXG5DUkVBVEUgVEFCTEUgX19TQ0hFTUFfXy5jaG9pY2VfbGlzdHMgKFxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcbiAgcm93X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcbiAgbmFtZSB2YXJjaGFyKDEwMDApIE5PVCBOVUxMLFxuICBkZXNjcmlwdGlvbiB2YXJjaGFyKG1heCksXG4gIHZlcnNpb24gYmlnaW50IE5PVCBOVUxMLFxuICBpdGVtcyB2YXJjaGFyKG1heCkgTk9UIE5VTEwsXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgdXBkYXRlZF9ieV9pZCBiaWdpbnQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBjcmVhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxuICB1cGRhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxuICBkZWxldGVkX2F0IGRhdGV0aW1lXG4pO1xuXG5DUkVBVEUgVEFCTEUgX19TQ0hFTUFfXy5jbGFzc2lmaWNhdGlvbl9zZXRzIChcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXG4gIHJvd19pZCBiaWdpbnQgTk9UIE5VTEwsXG4gIHJvd19yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXG4gIG5hbWUgdmFyY2hhcigxMDAwKSBOT1QgTlVMTCxcbiAgZGVzY3JpcHRpb24gdmFyY2hhcihtYXgpLFxuICB2ZXJzaW9uIGJpZ2ludCBOT1QgTlVMTCxcbiAgaXRlbXMgdmFyY2hhcihtYXgpIE5PVCBOVUxMLFxuICBjcmVhdGVkX2J5X2lkIGJpZ2ludCxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgZGVsZXRlZF9hdCBkYXRldGltZVxuKTtcblxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18uZm9ybXMgKFxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcbiAgcm93X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcbiAgbmFtZSB2YXJjaGFyKDEwMDApIE5PVCBOVUxMLFxuICBkZXNjcmlwdGlvbiB2YXJjaGFyKG1heCksXG4gIHZlcnNpb24gYmlnaW50IE5PVCBOVUxMLFxuICBlbGVtZW50cyB2YXJjaGFyKG1heCksXG4gIGJvdW5kaW5nX2JveCBnZW9ncmFwaHksXG4gIHJlY29yZF9jb3VudCBiaWdpbnQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICByZWNvcmRfY2hhbmdlZF9hdCBkYXRldGltZSxcbiAgcmVjZW50X2xhdF9sb25ncyB2YXJjaGFyKG1heCksXG4gIHN0YXR1cyB2YXJjaGFyKG1heCksXG4gIHN0YXR1c19maWVsZCB2YXJjaGFyKG1heCksXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgdXBkYXRlZF9ieV9pZCBiaWdpbnQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBjcmVhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxuICB1cGRhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxuICBwaG90b191c2FnZSBiaWdpbnQsXG4gIHBob3RvX2NvdW50IGJpZ2ludCxcbiAgdmlkZW9fdXNhZ2UgYmlnaW50LFxuICB2aWRlb19jb3VudCBiaWdpbnQsXG4gIGF1ZGlvX3VzYWdlIGJpZ2ludCxcbiAgYXVkaW9fY291bnQgYmlnaW50LFxuICBzaWduYXR1cmVfdXNhZ2UgYmlnaW50LFxuICBzaWduYXR1cmVfY291bnQgYmlnaW50LFxuICBtZWRpYV91c2FnZSBiaWdpbnQsXG4gIG1lZGlhX2NvdW50IGJpZ2ludCxcbiAgYXV0b19hc3NpZ24gYml0IE5PVCBOVUxMLFxuICB0aXRsZV9maWVsZF9rZXlzIHZhcmNoYXIobWF4KSxcbiAgaGlkZGVuX29uX2Rhc2hib2FyZCBiaXQgTk9UIE5VTEwsXG4gIGdlb21ldHJ5X3R5cGVzIHZhcmNoYXIobWF4KSxcbiAgZ2VvbWV0cnlfcmVxdWlyZWQgYml0IE5PVCBOVUxMLFxuICBzY3JpcHQgdmFyY2hhcihtYXgpLFxuICBpbWFnZSB2YXJjaGFyKG1heCksXG4gIHByb2plY3RzX2VuYWJsZWQgYml0IE5PVCBOVUxMLFxuICBhc3NpZ25tZW50X2VuYWJsZWQgYml0IE5PVCBOVUxMLFxuICBkZWxldGVkX2F0IGRhdGV0aW1lXG4pO1xuXG5DUkVBVEUgVEFCTEUgX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyAoXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxuICByb3dfaWQgYmlnaW50IE5PVCBOVUxMLFxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxuICB1c2VyX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgZmlyc3RfbmFtZSB2YXJjaGFyKG1heCksXG4gIGxhc3RfbmFtZSB2YXJjaGFyKG1heCksXG4gIG5hbWUgdmFyY2hhcigxMDAwKSxcbiAgZW1haWwgdmFyY2hhcihtYXgpLFxuICByb2xlX2lkIGJpZ2ludCBOT1QgTlVMTCxcbiAgcm9sZV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXG4gIHN0YXR1cyB2YXJjaGFyKG1heCksXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIHVwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIGRlbGV0ZWRfYXQgZGF0ZXRpbWVcbik7XG5cbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLnBob3RvcyAoXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxuICByb3dfaWQgYmlnaW50IE5PVCBOVUxMLFxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxuICBhY2Nlc3Nfa2V5IHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcbiAgcmVjb3JkX2lkIGJpZ2ludCxcbiAgcmVjb3JkX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgZm9ybV9pZCBiaWdpbnQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBleGlmIHZhcmNoYXIobWF4KSxcbiAgZmlsZV9zaXplIGJpZ2ludCxcbiAgY3JlYXRlZF9ieV9pZCBiaWdpbnQsXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICB1cGRhdGVkX2J5X2lkIGJpZ2ludCxcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIHVwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIFtmaWxlXSB2YXJjaGFyKG1heCksXG4gIGNvbnRlbnRfdHlwZSB2YXJjaGFyKG1heCksXG4gIGlzX3VwbG9hZGVkIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGlzX3N0b3JlZCBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBpc19wcm9jZXNzZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcbiAgZ2VvbWV0cnkgZ2VvZ3JhcGh5LFxuICBsYXRpdHVkZSBmbG9hdCxcbiAgbG9uZ2l0dWRlIGZsb2F0LFxuICBhbHRpdHVkZSBmbG9hdCxcbiAgYWNjdXJhY3kgZmxvYXQsXG4gIGRpcmVjdGlvbiBmbG9hdCxcbiAgd2lkdGggYmlnaW50LFxuICBoZWlnaHQgYmlnaW50LFxuICBtYWtlIHZhcmNoYXIobWF4KSxcbiAgbW9kZWwgdmFyY2hhcihtYXgpLFxuICBzb2Z0d2FyZSB2YXJjaGFyKG1heCksXG4gIGRhdGVfdGltZSB2YXJjaGFyKG1heClcbik7XG5cbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLnByb2plY3RzIChcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXG4gIHJvd19pZCBiaWdpbnQgTk9UIE5VTEwsXG4gIHJvd19yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXG4gIG5hbWUgdmFyY2hhcigxMDAwKSBOT1QgTlVMTCxcbiAgZGVzY3JpcHRpb24gdmFyY2hhcihtYXgpLFxuICBjcmVhdGVkX2J5X2lkIGJpZ2ludCxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIHVwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIGRlbGV0ZWRfYXQgZGF0ZXRpbWVcbik7XG5cbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLnJvbGVzIChcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXG4gIHJvd19pZCBiaWdpbnQgTk9UIE5VTEwsXG4gIHJvd19yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXG4gIG5hbWUgdmFyY2hhcigxMDAwKSBOT1QgTlVMTCxcbiAgZGVzY3JpcHRpb24gdmFyY2hhcihtYXgpLFxuICBjcmVhdGVkX2J5X2lkIGJpZ2ludCxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcbiAgaXNfc3lzdGVtIGJpdCBOT1QgTlVMTCxcbiAgaXNfZGVmYXVsdCBiaXQgTk9UIE5VTEwsXG4gIGNhbl9tYW5hZ2Vfc3Vic2NyaXB0aW9uIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl91cGRhdGVfb3JnYW5pemF0aW9uIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl9tYW5hZ2VfbWVtYmVycyBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBjYW5fbWFuYWdlX3JvbGVzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl9tYW5hZ2VfYXBwcyBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBjYW5fbWFuYWdlX3Byb2plY3RzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl9tYW5hZ2VfY2hvaWNlX2xpc3RzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl9tYW5hZ2VfY2xhc3NpZmljYXRpb25fc2V0cyBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBjYW5fY3JlYXRlX3JlY29yZHMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcbiAgY2FuX3VwZGF0ZV9yZWNvcmRzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl9kZWxldGVfcmVjb3JkcyBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBjYW5fY2hhbmdlX3N0YXR1cyBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBjYW5fY2hhbmdlX3Byb2plY3QgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcbiAgY2FuX2Fzc2lnbl9yZWNvcmRzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl9pbXBvcnRfcmVjb3JkcyBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBjYW5fZXhwb3J0X3JlY29yZHMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcbiAgY2FuX3J1bl9yZXBvcnRzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGNhbl9tYW5hZ2VfYXV0aG9yaXphdGlvbnMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcbiAgZGVsZXRlZF9hdCBkYXRldGltZVxuKTtcblxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18uc2lnbmF0dXJlcyAoXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxuICByb3dfaWQgYmlnaW50IE5PVCBOVUxMLFxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxuICBhY2Nlc3Nfa2V5IHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcbiAgcmVjb3JkX2lkIGJpZ2ludCxcbiAgcmVjb3JkX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcbiAgZm9ybV9pZCBiaWdpbnQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBleGlmIHZhcmNoYXIobWF4KSxcbiAgZmlsZV9zaXplIGJpZ2ludCxcbiAgY3JlYXRlZF9ieV9pZCBiaWdpbnQsXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICB1cGRhdGVkX2J5X2lkIGJpZ2ludCxcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIHVwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIFtmaWxlXSB2YXJjaGFyKG1heCksXG4gIGNvbnRlbnRfdHlwZSB2YXJjaGFyKG1heCksXG4gIGlzX3VwbG9hZGVkIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGlzX3N0b3JlZCBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBpc19wcm9jZXNzZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMFxuKTtcblxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18udmlkZW9zIChcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXG4gIHJvd19pZCBiaWdpbnQgTk9UIE5VTEwsXG4gIHJvd19yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXG4gIGFjY2Vzc19rZXkgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxuICByZWNvcmRfaWQgYmlnaW50LFxuICByZWNvcmRfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICBmb3JtX2lkIGJpZ2ludCxcbiAgZm9ybV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIG1ldGFkYXRhIHZhcmNoYXIobWF4KSxcbiAgZmlsZV9zaXplIGJpZ2ludCxcbiAgY3JlYXRlZF9ieV9pZCBiaWdpbnQsXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxuICB1cGRhdGVkX2J5X2lkIGJpZ2ludCxcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIHVwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXG4gIFtmaWxlXSB2YXJjaGFyKG1heCksXG4gIGNvbnRlbnRfdHlwZSB2YXJjaGFyKG1heCksXG4gIGlzX3VwbG9hZGVkIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXG4gIGlzX3N0b3JlZCBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxuICBpc19wcm9jZXNzZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcbiAgaGFzX3RyYWNrIGJpdCxcbiAgdHJhY2sgdmFyY2hhcihtYXgpLFxuICBnZW9tZXRyeSBnZW9ncmFwaHksXG4gIHdpZHRoIGJpZ2ludCxcbiAgaGVpZ2h0IGJpZ2ludCxcbiAgZHVyYXRpb24gZmxvYXQsXG4gIGJpdF9yYXRlIGZsb2F0XG4pO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy5hdWRpb192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18uYXVkaW9fdmlldyBBU1xuU0VMRUNUXG4gIGFjY2Vzc19rZXkgQVMgYXVkaW9faWQsXG4gIHJlY29yZF9yZXNvdXJjZV9pZCBBUyByZWNvcmRfaWQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcbiAgbWV0YWRhdGEgQVMgbWV0YWRhdGEsXG4gIGZpbGVfc2l6ZSBBUyBmaWxlX3NpemUsXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxuICBjcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcbiAgW2ZpbGVdIEFTIFtmaWxlXSxcbiAgY29udGVudF90eXBlIEFTIGNvbnRlbnRfdHlwZSxcbiAgaXNfdXBsb2FkZWQgQVMgaXNfdXBsb2FkZWQsXG4gIGlzX3N0b3JlZCBBUyBpc19zdG9yZWQsXG4gIGlzX3Byb2Nlc3NlZCBBUyBpc19wcm9jZXNzZWQsXG4gIGhhc190cmFjayBBUyBoYXNfdHJhY2ssXG4gIHRyYWNrIEFTIHRyYWNrLFxuICBnZW9tZXRyeSBBUyBnZW9tZXRyeSxcbiAgZHVyYXRpb24gQVMgZHVyYXRpb24sXG4gIGJpdF9yYXRlIEFTIGJpdF9yYXRlXG5GUk9NIF9fU0NIRU1BX18uYXVkaW87XG5cbkRST1AgVklFVyBJRiBFWElTVFMgX19WSUVXX1NDSEVNQV9fLmNoYW5nZXNldHNfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLmNoYW5nZXNldHNfdmlldyBBU1xuU0VMRUNUXG4gIHJvd19yZXNvdXJjZV9pZCBBUyBjaGFuZ2VzZXRfaWQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcbiAgbWV0YWRhdGEgQVMgbWV0YWRhdGEsXG4gIGNsb3NlZF9hdCBBUyBjbG9zZWRfYXQsXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxuICBjbG9zZWRfYnlfcmVzb3VyY2VfaWQgQVMgY2xvc2VkX2J5X2lkLFxuICBjcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcbiAgbWluX2xhdCBBUyBtaW5fbGF0LFxuICBtYXhfbGF0IEFTIG1heF9sYXQsXG4gIG1pbl9sb24gQVMgbWluX2xvbixcbiAgbWF4X2xvbiBBUyBtYXhfbG9uLFxuICBudW1iZXJfb2ZfY2hhbmdlcyBBUyBudW1iZXJfb2ZfY2hhbmdlcyxcbiAgbnVtYmVyX29mX2NyZWF0ZXMgQVMgbnVtYmVyX29mX2NyZWF0ZXMsXG4gIG51bWJlcl9vZl91cGRhdGVzIEFTIG51bWJlcl9vZl91cGRhdGVzLFxuICBudW1iZXJfb2ZfZGVsZXRlcyBBUyBudW1iZXJfb2ZfZGVsZXRlcyxcbiAgbWV0YWRhdGFfaW5kZXggQVMgbWV0YWRhdGFfaW5kZXgsXG4gIGJvdW5kaW5nX2JveCBBUyBib3VuZGluZ19ib3hcbkZST00gX19TQ0hFTUFfXy5jaGFuZ2VzZXRzO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy5jaG9pY2VfbGlzdHNfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLmNob2ljZV9saXN0c192aWV3IEFTXG5TRUxFQ1RcbiAgcm93X3Jlc291cmNlX2lkIEFTIGNob2ljZV9saXN0X2lkLFxuICBuYW1lIEFTIG5hbWUsXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxuICB2ZXJzaW9uIEFTIHZlcnNpb24sXG4gIGl0ZW1zIEFTIGl0ZW1zLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIGRlbGV0ZWRfYXQgQVMgZGVsZXRlZF9hdFxuRlJPTSBfX1NDSEVNQV9fLmNob2ljZV9saXN0cztcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0c192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0c192aWV3IEFTXG5TRUxFQ1RcbiAgcm93X3Jlc291cmNlX2lkIEFTIGNsYXNzaWZpY2F0aW9uX3NldF9pZCxcbiAgbmFtZSBBUyBuYW1lLFxuICBkZXNjcmlwdGlvbiBBUyBkZXNjcmlwdGlvbixcbiAgdmVyc2lvbiBBUyB2ZXJzaW9uLFxuICBpdGVtcyBBUyBpdGVtcyxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBkZWxldGVkX2F0IEFTIGRlbGV0ZWRfYXRcbkZST00gX19TQ0hFTUFfXy5jbGFzc2lmaWNhdGlvbl9zZXRzO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy5mb3Jtc192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18uZm9ybXNfdmlldyBBU1xuU0VMRUNUXG4gIHJvd19yZXNvdXJjZV9pZCBBUyBmb3JtX2lkLFxuICBuYW1lIEFTIG5hbWUsXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxuICB2ZXJzaW9uIEFTIHZlcnNpb24sXG4gIGVsZW1lbnRzIEFTIGVsZW1lbnRzLFxuICBib3VuZGluZ19ib3ggQVMgYm91bmRpbmdfYm94LFxuICBzdGF0dXMgQVMgc3RhdHVzLFxuICBzdGF0dXNfZmllbGQgQVMgc3RhdHVzX2ZpZWxkLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIGRlbGV0ZWRfYXQgQVMgZGVsZXRlZF9hdCxcbiAgYXV0b19hc3NpZ24gQVMgYXV0b19hc3NpZ24sXG4gIHRpdGxlX2ZpZWxkX2tleXMgQVMgdGl0bGVfZmllbGRfa2V5cyxcbiAgaGlkZGVuX29uX2Rhc2hib2FyZCBBUyBoaWRkZW5fb25fZGFzaGJvYXJkLFxuICBnZW9tZXRyeV90eXBlcyBBUyBnZW9tZXRyeV90eXBlcyxcbiAgZ2VvbWV0cnlfcmVxdWlyZWQgQVMgZ2VvbWV0cnlfcmVxdWlyZWQsXG4gIHNjcmlwdCBBUyBzY3JpcHQsXG4gIGltYWdlIEFTIGltYWdlLFxuICBwcm9qZWN0c19lbmFibGVkIEFTIHByb2plY3RzX2VuYWJsZWQsXG4gIGFzc2lnbm1lbnRfZW5hYmxlZCBBUyBhc3NpZ25tZW50X2VuYWJsZWRcbkZST00gX19TQ0hFTUFfXy5mb3JtcztcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18ubWVtYmVyc2hpcHNfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLm1lbWJlcnNoaXBzX3ZpZXcgQVNcblNFTEVDVFxuICBtZW1iZXJzaGlwcy5yb3dfcmVzb3VyY2VfaWQgQVMgbWVtYmVyc2hpcF9pZCxcbiAgbWVtYmVyc2hpcHMudXNlcl9yZXNvdXJjZV9pZCBBUyB1c2VyX2lkLFxuICBtZW1iZXJzaGlwcy5maXJzdF9uYW1lIEFTIGZpcnN0X25hbWUsXG4gIG1lbWJlcnNoaXBzLmxhc3RfbmFtZSBBUyBsYXN0X25hbWUsXG4gIG1lbWJlcnNoaXBzLm5hbWUgQVMgbmFtZSxcbiAgbWVtYmVyc2hpcHMuZW1haWwgQVMgZW1haWwsXG4gIG1lbWJlcnNoaXBzLnJvbGVfcmVzb3VyY2VfaWQgQVMgcm9sZV9pZCxcbiAgcm9sZXMubmFtZSBBUyByb2xlX25hbWUsXG4gIG1lbWJlcnNoaXBzLnN0YXR1cyBBUyBzdGF0dXMsXG4gIG1lbWJlcnNoaXBzLmNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgbWVtYmVyc2hpcHMudXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBtZW1iZXJzaGlwcy5kZWxldGVkX2F0IEFTIGRlbGV0ZWRfYXRcbkZST00gX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyBtZW1iZXJzaGlwc1xuTEVGVCBPVVRFUiBKT0lOIF9fU0NIRU1BX18ucm9sZXMgcm9sZXMgT04gbWVtYmVyc2hpcHMucm9sZV9yZXNvdXJjZV9pZCA9IHJvbGVzLnJvd19yZXNvdXJjZV9pZDtcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18ucGhvdG9zX3ZpZXc7XG5cbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5waG90b3NfdmlldyBBU1xuU0VMRUNUXG4gIGFjY2Vzc19rZXkgQVMgcGhvdG9faWQsXG4gIHJlY29yZF9yZXNvdXJjZV9pZCBBUyByZWNvcmRfaWQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcbiAgZXhpZiBBUyBleGlmLFxuICBmaWxlX3NpemUgQVMgZmlsZV9zaXplLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIFtmaWxlXSBBUyBbZmlsZV0sXG4gIGNvbnRlbnRfdHlwZSBBUyBjb250ZW50X3R5cGUsXG4gIGlzX3VwbG9hZGVkIEFTIGlzX3VwbG9hZGVkLFxuICBpc19zdG9yZWQgQVMgaXNfc3RvcmVkLFxuICBpc19wcm9jZXNzZWQgQVMgaXNfcHJvY2Vzc2VkLFxuICBnZW9tZXRyeSBBUyBnZW9tZXRyeSxcbiAgbGF0aXR1ZGUgQVMgbGF0aXR1ZGUsXG4gIGxvbmdpdHVkZSBBUyBsb25naXR1ZGUsXG4gIGFsdGl0dWRlIEFTIGFsdGl0dWRlLFxuICBhY2N1cmFjeSBBUyBhY2N1cmFjeSxcbiAgZGlyZWN0aW9uIEFTIGRpcmVjdGlvbixcbiAgd2lkdGggQVMgd2lkdGgsXG4gIGhlaWdodCBBUyBoZWlnaHQsXG4gIG1ha2UgQVMgbWFrZSxcbiAgbW9kZWwgQVMgbW9kZWwsXG4gIHNvZnR3YXJlIEFTIHNvZnR3YXJlLFxuICBkYXRlX3RpbWUgQVMgZGF0ZV90aW1lXG5GUk9NIF9fU0NIRU1BX18ucGhvdG9zO1xuXG5EUk9QIFZJRVcgSUYgRVhJU1RTIF9fVklFV19TQ0hFTUFfXy5wcm9qZWN0c192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18ucHJvamVjdHNfdmlldyBBU1xuU0VMRUNUXG4gIHJvd19yZXNvdXJjZV9pZCBBUyBwcm9qZWN0X2lkLFxuICBuYW1lIEFTIG5hbWUsXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBkZWxldGVkX2F0IEFTIGRlbGV0ZWRfYXRcbkZST00gX19TQ0hFTUFfXy5wcm9qZWN0cztcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18ucm9sZXNfdmlldztcblxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnJvbGVzX3ZpZXcgQVNcblNFTEVDVFxuICByb3dfcmVzb3VyY2VfaWQgQVMgcm9sZV9pZCxcbiAgbmFtZSBBUyBuYW1lLFxuICBkZXNjcmlwdGlvbiBBUyBkZXNjcmlwdGlvbixcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBkZWxldGVkX2F0IEFTIGRlbGV0ZWRfYXQsXG4gIGlzX3N5c3RlbSBBUyBpc19zeXN0ZW0sXG4gIGlzX2RlZmF1bHQgQVMgaXNfZGVmYXVsdCxcbiAgY2FuX21hbmFnZV9zdWJzY3JpcHRpb24gQVMgY2FuX21hbmFnZV9zdWJzY3JpcHRpb24sXG4gIGNhbl91cGRhdGVfb3JnYW5pemF0aW9uIEFTIGNhbl91cGRhdGVfb3JnYW5pemF0aW9uLFxuICBjYW5fbWFuYWdlX21lbWJlcnMgQVMgY2FuX21hbmFnZV9tZW1iZXJzLFxuICBjYW5fbWFuYWdlX3JvbGVzIEFTIGNhbl9tYW5hZ2Vfcm9sZXMsXG4gIGNhbl9tYW5hZ2VfYXBwcyBBUyBjYW5fbWFuYWdlX2FwcHMsXG4gIGNhbl9tYW5hZ2VfcHJvamVjdHMgQVMgY2FuX21hbmFnZV9wcm9qZWN0cyxcbiAgY2FuX21hbmFnZV9jaG9pY2VfbGlzdHMgQVMgY2FuX21hbmFnZV9jaG9pY2VfbGlzdHMsXG4gIGNhbl9tYW5hZ2VfY2xhc3NpZmljYXRpb25fc2V0cyBBUyBjYW5fbWFuYWdlX2NsYXNzaWZpY2F0aW9uX3NldHMsXG4gIGNhbl9jcmVhdGVfcmVjb3JkcyBBUyBjYW5fY3JlYXRlX3JlY29yZHMsXG4gIGNhbl91cGRhdGVfcmVjb3JkcyBBUyBjYW5fdXBkYXRlX3JlY29yZHMsXG4gIGNhbl9kZWxldGVfcmVjb3JkcyBBUyBjYW5fZGVsZXRlX3JlY29yZHMsXG4gIGNhbl9jaGFuZ2Vfc3RhdHVzIEFTIGNhbl9jaGFuZ2Vfc3RhdHVzLFxuICBjYW5fY2hhbmdlX3Byb2plY3QgQVMgY2FuX2NoYW5nZV9wcm9qZWN0LFxuICBjYW5fYXNzaWduX3JlY29yZHMgQVMgY2FuX2Fzc2lnbl9yZWNvcmRzLFxuICBjYW5faW1wb3J0X3JlY29yZHMgQVMgY2FuX2ltcG9ydF9yZWNvcmRzLFxuICBjYW5fZXhwb3J0X3JlY29yZHMgQVMgY2FuX2V4cG9ydF9yZWNvcmRzLFxuICBjYW5fcnVuX3JlcG9ydHMgQVMgY2FuX3J1bl9yZXBvcnRzLFxuICBjYW5fbWFuYWdlX2F1dGhvcml6YXRpb25zIEFTIGNhbl9tYW5hZ2VfYXV0aG9yaXphdGlvbnNcbkZST00gX19TQ0hFTUFfXy5yb2xlcztcblxuRFJPUCBWSUVXIElGIEVYSVNUUyBfX1ZJRVdfU0NIRU1BX18uc2lnbmF0dXJlc192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18uc2lnbmF0dXJlc192aWV3IEFTXG5TRUxFQ1RcbiAgYWNjZXNzX2tleSBBUyBzaWduYXR1cmVfaWQsXG4gIHJlY29yZF9yZXNvdXJjZV9pZCBBUyByZWNvcmRfaWQsXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcbiAgZmlsZV9zaXplIEFTIGZpbGVfc2l6ZSxcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyBjcmVhdGVkX2J5X2lkLFxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxuICBbZmlsZV0gQVMgW2ZpbGVdLFxuICBjb250ZW50X3R5cGUgQVMgY29udGVudF90eXBlLFxuICBpc191cGxvYWRlZCBBUyBpc191cGxvYWRlZCxcbiAgaXNfc3RvcmVkIEFTIGlzX3N0b3JlZCxcbiAgaXNfcHJvY2Vzc2VkIEFTIGlzX3Byb2Nlc3NlZFxuRlJPTSBfX1NDSEVNQV9fLnNpZ25hdHVyZXM7XG5cbkRST1AgVklFVyBJRiBFWElTVFMgX19WSUVXX1NDSEVNQV9fLnZpZGVvc192aWV3O1xuXG5DUkVBVEUgVklFVyBfX1ZJRVdfU0NIRU1BX18udmlkZW9zX3ZpZXcgQVNcblNFTEVDVFxuICBhY2Nlc3Nfa2V5IEFTIHZpZGVvX2lkLFxuICByZWNvcmRfcmVzb3VyY2VfaWQgQVMgcmVjb3JkX2lkLFxuICBmb3JtX3Jlc291cmNlX2lkIEFTIGZvcm1faWQsXG4gIG1ldGFkYXRhIEFTIG1ldGFkYXRhLFxuICBmaWxlX3NpemUgQVMgZmlsZV9zaXplLFxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgdXBkYXRlZF9ieV9pZCxcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXG4gIFtmaWxlXSBBUyBbZmlsZV0sXG4gIGNvbnRlbnRfdHlwZSBBUyBjb250ZW50X3R5cGUsXG4gIGlzX3VwbG9hZGVkIEFTIGlzX3VwbG9hZGVkLFxuICBpc19zdG9yZWQgQVMgaXNfc3RvcmVkLFxuICBpc19wcm9jZXNzZWQgQVMgaXNfcHJvY2Vzc2VkLFxuICBoYXNfdHJhY2sgQVMgaGFzX3RyYWNrLFxuICB0cmFjayBBUyB0cmFjayxcbiAgZ2VvbWV0cnkgQVMgZ2VvbWV0cnksXG4gIHdpZHRoIEFTIHdpZHRoLFxuICBoZWlnaHQgQVMgaGVpZ2h0LFxuICBkdXJhdGlvbiBBUyBkdXJhdGlvbixcbiAgYml0X3JhdGUgQVMgYml0X3JhdGVcbkZST00gX19TQ0hFTUFfXy52aWRlb3M7XG5cbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2F1ZGlvX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLmF1ZGlvIChyb3dfcmVzb3VyY2VfaWQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9hdWRpb19yb3dfaWQgT04gX19TQ0hFTUFfXy5hdWRpbyAocm93X2lkKTtcblxuQ1JFQVRFIElOREVYIGlkeF9hdWRpb19hY2Nlc3Nfa2V5IE9OIF9fU0NIRU1BX18uYXVkaW8gKGFjY2Vzc19rZXkpO1xuXG5DUkVBVEUgSU5ERVggaWR4X2F1ZGlvX3JlY29yZF9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLmF1ZGlvIChyZWNvcmRfcmVzb3VyY2VfaWQpO1xuXG5DUkVBVEUgSU5ERVggaWR4X2F1ZGlvX2Zvcm1fcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5hdWRpbyAoZm9ybV9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfYXVkaW9fY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLmF1ZGlvIChjcmVhdGVkX2J5X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFNQQVRJQUwgSU5ERVggaWR4X2F1ZGlvX2dlb21ldHJ5IE9OIF9fU0NIRU1BX18uYXVkaW8gKGdlb21ldHJ5KTtcblxuQ1JFQVRFIElOREVYIGlkeF9hdWRpb191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18uYXVkaW8gKHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9jaGFuZ2VzZXRzX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLmNoYW5nZXNldHMgKHJvd19yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2NoYW5nZXNldHNfcm93X2lkIE9OIF9fU0NIRU1BX18uY2hhbmdlc2V0cyAocm93X2lkKTtcblxuQ1JFQVRFIElOREVYIGlkeF9jaGFuZ2VzZXRzX2Zvcm1faWQgT04gX19TQ0hFTUFfXy5jaGFuZ2VzZXRzIChmb3JtX2lkKTtcblxuLS0gQ1JFQVRFIElOREVYIGlkeF9jaGFuZ2VzZXRzX21ldGFkYXRhX2luZGV4IE9OIF9fU0NIRU1BX18uY2hhbmdlc2V0cyBVU0lORyBnaW4gKG1ldGFkYXRhX2luZGV4KSBXSVRIIChmYXN0dXBkYXRlID0gb2ZmKTtcblxuQ1JFQVRFIElOREVYIGlkeF9jaGFuZ2VzZXRzX2Zvcm1faWRfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmNoYW5nZXNldHMgKGZvcm1faWQsIHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgSU5ERVggaWR4X2NoYW5nZXNldHNfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmNoYW5nZXNldHMgKHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9jaG9pY2VfbGlzdHNfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uY2hvaWNlX2xpc3RzIChyb3dfcmVzb3VyY2VfaWQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9jaG9pY2VfbGlzdHNfcm93X2lkIE9OIF9fU0NIRU1BX18uY2hvaWNlX2xpc3RzIChyb3dfaWQpO1xuXG5DUkVBVEUgSU5ERVggaWR4X2Nob2ljZV9saXN0c19uYW1lIE9OIF9fU0NIRU1BX18uY2hvaWNlX2xpc3RzIChuYW1lKTtcblxuQ1JFQVRFIElOREVYIGlkeF9jaG9pY2VfbGlzdHNfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmNob2ljZV9saXN0cyAodXBkYXRlZF9hdCk7XG5cbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2NsYXNzaWZpY2F0aW9uX3NldHNfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0cyAocm93X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfY2xhc3NpZmljYXRpb25fc2V0c19yb3dfaWQgT04gX19TQ0hFTUFfXy5jbGFzc2lmaWNhdGlvbl9zZXRzIChyb3dfaWQpO1xuXG5DUkVBVEUgSU5ERVggaWR4X2NsYXNzaWZpY2F0aW9uX3NldHNfbmFtZSBPTiBfX1NDSEVNQV9fLmNsYXNzaWZpY2F0aW9uX3NldHMgKG5hbWUpO1xuXG5DUkVBVEUgSU5ERVggaWR4X2NsYXNzaWZpY2F0aW9uX3NldHNfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmNsYXNzaWZpY2F0aW9uX3NldHMgKHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9mb3Jtc19yb3dfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5mb3JtcyAocm93X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfZm9ybXNfcm93X2lkIE9OIF9fU0NIRU1BX18uZm9ybXMgKHJvd19pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfZm9ybXNfbmFtZSBPTiBfX1NDSEVNQV9fLmZvcm1zIChuYW1lKTtcblxuQ1JFQVRFIElOREVYIGlkeF9mb3Jtc191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18uZm9ybXMgKHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9tZW1iZXJzaGlwc19yb3dfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyAocm93X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfbWVtYmVyc2hpcHNfcm93X2lkIE9OIF9fU0NIRU1BX18ubWVtYmVyc2hpcHMgKHJvd19pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfbWVtYmVyc2hpcHNfdXNlcl9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLm1lbWJlcnNoaXBzICh1c2VyX3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIElOREVYIGlkeF9tZW1iZXJzaGlwc19yb2xlX3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18ubWVtYmVyc2hpcHMgKHJvbGVfcmVzb3VyY2VfaWQpO1xuXG5DUkVBVEUgSU5ERVggaWR4X21lbWJlcnNoaXBzX25hbWUgT04gX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyAobmFtZSk7XG5cbkNSRUFURSBJTkRFWCBpZHhfbWVtYmVyc2hpcHNfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLm1lbWJlcnNoaXBzICh1cGRhdGVkX2F0KTtcblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcGhvdG9zX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnBob3RvcyAocm93X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcGhvdG9zX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnBob3RvcyAocm93X2lkKTtcblxuQ1JFQVRFIElOREVYIGlkeF9waG90b3NfYWNjZXNzX2tleSBPTiBfX1NDSEVNQV9fLnBob3RvcyAoYWNjZXNzX2tleSk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcGhvdG9zX3JlY29yZF9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnBob3RvcyAocmVjb3JkX3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIElOREVYIGlkeF9waG90b3NfZm9ybV9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnBob3RvcyAoZm9ybV9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcGhvdG9zX2NyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5waG90b3MgKGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQpO1xuXG5DUkVBVEUgU1BBVElBTCBJTkRFWCBpZHhfcGhvdG9zX2dlb21ldHJ5IE9OIF9fU0NIRU1BX18ucGhvdG9zIChnZW9tZXRyeSk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcGhvdG9zX3VwZGF0ZWRfYXQgT04gX19TQ0hFTUFfXy5waG90b3MgKHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9wcm9qZWN0c19yb3dfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5wcm9qZWN0cyAocm93X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcHJvamVjdHNfcm93X2lkIE9OIF9fU0NIRU1BX18ucHJvamVjdHMgKHJvd19pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcHJvamVjdHNfbmFtZSBPTiBfX1NDSEVNQV9fLnByb2plY3RzIChuYW1lKTtcblxuQ1JFQVRFIElOREVYIGlkeF9wcm9qZWN0c191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18ucHJvamVjdHMgKHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9yb2xlc19yb3dfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5yb2xlcyAocm93X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcm9sZXNfcm93X2lkIE9OIF9fU0NIRU1BX18ucm9sZXMgKHJvd19pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfcm9sZXNfbmFtZSBPTiBfX1NDSEVNQV9fLnJvbGVzIChuYW1lKTtcblxuQ1JFQVRFIElOREVYIGlkeF9yb2xlc191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18ucm9sZXMgKHVwZGF0ZWRfYXQpO1xuXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9zaWduYXR1cmVzX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnNpZ25hdHVyZXMgKHJvd19yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X3NpZ25hdHVyZXNfcm93X2lkIE9OIF9fU0NIRU1BX18uc2lnbmF0dXJlcyAocm93X2lkKTtcblxuQ1JFQVRFIElOREVYIGlkeF9zaWduYXR1cmVzX2FjY2Vzc19rZXkgT04gX19TQ0hFTUFfXy5zaWduYXR1cmVzIChhY2Nlc3Nfa2V5KTtcblxuQ1JFQVRFIElOREVYIGlkeF9zaWduYXR1cmVzX3JlY29yZF9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnNpZ25hdHVyZXMgKHJlY29yZF9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfc2lnbmF0dXJlc19mb3JtX3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uc2lnbmF0dXJlcyAoZm9ybV9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfc2lnbmF0dXJlc19jcmVhdGVkX2J5X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uc2lnbmF0dXJlcyAoY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfc2lnbmF0dXJlc191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18uc2lnbmF0dXJlcyAodXBkYXRlZF9hdCk7XG5cbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X3ZpZGVvc19yb3dfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy52aWRlb3MgKHJvd19yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X3ZpZGVvc19yb3dfaWQgT04gX19TQ0hFTUFfXy52aWRlb3MgKHJvd19pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfdmlkZW9zX2FjY2Vzc19rZXkgT04gX19TQ0hFTUFfXy52aWRlb3MgKGFjY2Vzc19rZXkpO1xuXG5DUkVBVEUgSU5ERVggaWR4X3ZpZGVvc19yZWNvcmRfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy52aWRlb3MgKHJlY29yZF9yZXNvdXJjZV9pZCk7XG5cbkNSRUFURSBJTkRFWCBpZHhfdmlkZW9zX2Zvcm1fcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy52aWRlb3MgKGZvcm1fcmVzb3VyY2VfaWQpO1xuXG5DUkVBVEUgSU5ERVggaWR4X3ZpZGVvc19jcmVhdGVkX2J5X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18udmlkZW9zIChjcmVhdGVkX2J5X3Jlc291cmNlX2lkKTtcblxuQ1JFQVRFIFNQQVRJQUwgSU5ERVggaWR4X3ZpZGVvc19nZW9tZXRyeSBPTiBfX1NDSEVNQV9fLnZpZGVvcyAoZ2VvbWV0cnkpO1xuXG5DUkVBVEUgSU5ERVggaWR4X3ZpZGVvc191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18udmlkZW9zICh1cGRhdGVkX2F0KTtcblxuQ09NTUlUIFRSQU5TQUNUSU9OO1xuYDtcbiJdfQ==