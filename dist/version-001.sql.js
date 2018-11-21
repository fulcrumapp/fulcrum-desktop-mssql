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

IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.audio_view\')) DROP VIEW __VIEW_SCHEMA__.audio_view;

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


IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.changesets_view\')) DROP VIEW __VIEW_SCHEMA__.changesets_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.choice_lists_view\')) DROP VIEW __VIEW_SCHEMA__.choice_lists_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.classification_sets_view\')) DROP VIEW __VIEW_SCHEMA__.classification_sets_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.forms_view\')) DROP VIEW __VIEW_SCHEMA__.forms_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.memberships_view\')) DROP VIEW __VIEW_SCHEMA__.memberships_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.photos_view\')) DROP VIEW __VIEW_SCHEMA__.photos_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.projects_view\')) DROP VIEW __VIEW_SCHEMA__.projects_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.roles_view\')) DROP VIEW __VIEW_SCHEMA__.roles_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.signatures_view\')) DROP VIEW __VIEW_SCHEMA__.signatures_view;

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

IF  EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N\'__VIEW_SCHEMA__.videos_view\')) DROP VIEW __VIEW_SCHEMA__.videos_view;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3ZlcnNpb24tMDAxLnNxbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztrQkFBZ0IiLCJmaWxlIjoidmVyc2lvbi0wMDEuc3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgYFxyXG5CRUdJTiBUUkFOU0FDVElPTjtcclxuXHJcbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLm1pZ3JhdGlvbnMgKFxyXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxyXG4gIG5hbWUgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwgREVGQVVMVCBHRVREQVRFKClcclxuKTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X21pZ3JhdGlvbnNfbmFtZSBPTiBfX1NDSEVNQV9fLm1pZ3JhdGlvbnMgKG5hbWUpO1xyXG5cclxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18uYXVkaW8gKFxyXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxyXG4gIHJvd19pZCBiaWdpbnQgTk9UIE5VTEwsXHJcbiAgcm93X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcclxuICBhY2Nlc3Nfa2V5IHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcclxuICByZWNvcmRfaWQgYmlnaW50LFxyXG4gIHJlY29yZF9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXHJcbiAgZm9ybV9pZCBiaWdpbnQsXHJcbiAgZm9ybV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXHJcbiAgbWV0YWRhdGEgdmFyY2hhcihtYXgpLFxyXG4gIGZpbGVfc2l6ZSBiaWdpbnQsXHJcbiAgY3JlYXRlZF9ieV9pZCBiaWdpbnQsXHJcbiAgY3JlYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXHJcbiAgdXBkYXRlZF9ieV9pZCBiaWdpbnQsXHJcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXHJcbiAgY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICB1cGRhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxyXG4gIFtmaWxlXSB2YXJjaGFyKG1heCksXHJcbiAgY29udGVudF90eXBlIHZhcmNoYXIobWF4KSxcclxuICBpc191cGxvYWRlZCBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxyXG4gIGlzX3N0b3JlZCBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxyXG4gIGlzX3Byb2Nlc3NlZCBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxyXG4gIGhhc190cmFjayBiaXQsXHJcbiAgdHJhY2sgdmFyY2hhcihtYXgpLFxyXG4gIGdlb21ldHJ5IGdlb2dyYXBoeSxcclxuICBkdXJhdGlvbiBmbG9hdCxcclxuICBiaXRfcmF0ZSBmbG9hdFxyXG4pO1xyXG5cclxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18uY2hhbmdlc2V0cyAoXHJcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXHJcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcclxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIGZvcm1faWQgYmlnaW50IE5VTEwsXHJcbiAgZm9ybV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXHJcbiAgbWV0YWRhdGEgdmFyY2hhcihtYXgpLFxyXG4gIGNsb3NlZF9hdCBkYXRldGltZSxcclxuICBjcmVhdGVkX2J5X2lkIGJpZ2ludCxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICB1cGRhdGVkX2J5X2lkIGJpZ2ludCxcclxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICBjbG9zZWRfYnlfaWQgYmlnaW50LFxyXG4gIGNsb3NlZF9ieV9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXHJcbiAgY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICB1cGRhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxyXG4gIG1pbl9sYXQgZmxvYXQsXHJcbiAgbWF4X2xhdCBmbG9hdCxcclxuICBtaW5fbG9uIGZsb2F0LFxyXG4gIG1heF9sb24gZmxvYXQsXHJcbiAgbnVtYmVyX29mX2NoYW5nZXMgYmlnaW50LFxyXG4gIG51bWJlcl9vZl9jcmVhdGVzIGJpZ2ludCxcclxuICBudW1iZXJfb2ZfdXBkYXRlcyBiaWdpbnQsXHJcbiAgbnVtYmVyX29mX2RlbGV0ZXMgYmlnaW50LFxyXG4gIG1ldGFkYXRhX2luZGV4X3RleHQgdmFyY2hhcihtYXgpLFxyXG4gIG1ldGFkYXRhX2luZGV4IHZhcmNoYXIobWF4KSxcclxuICBib3VuZGluZ19ib3ggZ2VvZ3JhcGh5XHJcbik7XHJcblxyXG5DUkVBVEUgVEFCTEUgX19TQ0hFTUFfXy5jaG9pY2VfbGlzdHMgKFxyXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxyXG4gIHJvd19pZCBiaWdpbnQgTk9UIE5VTEwsXHJcbiAgcm93X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcclxuICBuYW1lIHZhcmNoYXIoMTAwMCkgTk9UIE5VTEwsXHJcbiAgZGVzY3JpcHRpb24gdmFyY2hhcihtYXgpLFxyXG4gIHZlcnNpb24gYmlnaW50IE5PVCBOVUxMLFxyXG4gIGl0ZW1zIHZhcmNoYXIobWF4KSBOT1QgTlVMTCxcclxuICBjcmVhdGVkX2J5X2lkIGJpZ2ludCxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICB1cGRhdGVkX2J5X2lkIGJpZ2ludCxcclxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICBjcmVhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxyXG4gIHVwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgZGVsZXRlZF9hdCBkYXRldGltZVxyXG4pO1xyXG5cclxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0cyAoXHJcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXHJcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcclxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIG5hbWUgdmFyY2hhcigxMDAwKSBOT1QgTlVMTCxcclxuICBkZXNjcmlwdGlvbiB2YXJjaGFyKG1heCksXHJcbiAgdmVyc2lvbiBiaWdpbnQgTk9UIE5VTEwsXHJcbiAgaXRlbXMgdmFyY2hhcihtYXgpIE5PVCBOVUxMLFxyXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICBkZWxldGVkX2F0IGRhdGV0aW1lXHJcbik7XHJcblxyXG5DUkVBVEUgVEFCTEUgX19TQ0hFTUFfXy5mb3JtcyAoXHJcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXHJcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcclxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIG5hbWUgdmFyY2hhcigxMDAwKSBOT1QgTlVMTCxcclxuICBkZXNjcmlwdGlvbiB2YXJjaGFyKG1heCksXHJcbiAgdmVyc2lvbiBiaWdpbnQgTk9UIE5VTEwsXHJcbiAgZWxlbWVudHMgdmFyY2hhcihtYXgpLFxyXG4gIGJvdW5kaW5nX2JveCBnZW9ncmFwaHksXHJcbiAgcmVjb3JkX2NvdW50IGJpZ2ludCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgcmVjb3JkX2NoYW5nZWRfYXQgZGF0ZXRpbWUsXHJcbiAgcmVjZW50X2xhdF9sb25ncyB2YXJjaGFyKG1heCksXHJcbiAgc3RhdHVzIHZhcmNoYXIobWF4KSxcclxuICBzdGF0dXNfZmllbGQgdmFyY2hhcihtYXgpLFxyXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICBwaG90b191c2FnZSBiaWdpbnQsXHJcbiAgcGhvdG9fY291bnQgYmlnaW50LFxyXG4gIHZpZGVvX3VzYWdlIGJpZ2ludCxcclxuICB2aWRlb19jb3VudCBiaWdpbnQsXHJcbiAgYXVkaW9fdXNhZ2UgYmlnaW50LFxyXG4gIGF1ZGlvX2NvdW50IGJpZ2ludCxcclxuICBzaWduYXR1cmVfdXNhZ2UgYmlnaW50LFxyXG4gIHNpZ25hdHVyZV9jb3VudCBiaWdpbnQsXHJcbiAgbWVkaWFfdXNhZ2UgYmlnaW50LFxyXG4gIG1lZGlhX2NvdW50IGJpZ2ludCxcclxuICBhdXRvX2Fzc2lnbiBiaXQgTk9UIE5VTEwsXHJcbiAgdGl0bGVfZmllbGRfa2V5cyB2YXJjaGFyKG1heCksXHJcbiAgaGlkZGVuX29uX2Rhc2hib2FyZCBiaXQgTk9UIE5VTEwsXHJcbiAgZ2VvbWV0cnlfdHlwZXMgdmFyY2hhcihtYXgpLFxyXG4gIGdlb21ldHJ5X3JlcXVpcmVkIGJpdCBOT1QgTlVMTCxcclxuICBzY3JpcHQgdmFyY2hhcihtYXgpLFxyXG4gIGltYWdlIHZhcmNoYXIobWF4KSxcclxuICBwcm9qZWN0c19lbmFibGVkIGJpdCBOT1QgTlVMTCxcclxuICBhc3NpZ25tZW50X2VuYWJsZWQgYml0IE5PVCBOVUxMLFxyXG4gIGRlbGV0ZWRfYXQgZGF0ZXRpbWVcclxuKTtcclxuXHJcbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLm1lbWJlcnNoaXBzIChcclxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcclxuICByb3dfaWQgYmlnaW50IE5PVCBOVUxMLFxyXG4gIHJvd19yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXHJcbiAgdXNlcl9yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCksXHJcbiAgZmlyc3RfbmFtZSB2YXJjaGFyKG1heCksXHJcbiAgbGFzdF9uYW1lIHZhcmNoYXIobWF4KSxcclxuICBuYW1lIHZhcmNoYXIoMTAwMCksXHJcbiAgZW1haWwgdmFyY2hhcihtYXgpLFxyXG4gIHJvbGVfaWQgYmlnaW50IE5PVCBOVUxMLFxyXG4gIHJvbGVfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIHN0YXR1cyB2YXJjaGFyKG1heCksXHJcbiAgY3JlYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICB1cGRhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxyXG4gIGRlbGV0ZWRfYXQgZGF0ZXRpbWVcclxuKTtcclxuXHJcbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLnBob3RvcyAoXHJcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXHJcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcclxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIGFjY2Vzc19rZXkgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIHJlY29yZF9pZCBiaWdpbnQsXHJcbiAgcmVjb3JkX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICBmb3JtX2lkIGJpZ2ludCxcclxuICBmb3JtX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICBleGlmIHZhcmNoYXIobWF4KSxcclxuICBmaWxlX3NpemUgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICBbZmlsZV0gdmFyY2hhcihtYXgpLFxyXG4gIGNvbnRlbnRfdHlwZSB2YXJjaGFyKG1heCksXHJcbiAgaXNfdXBsb2FkZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBpc19zdG9yZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBpc19wcm9jZXNzZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBnZW9tZXRyeSBnZW9ncmFwaHksXHJcbiAgbGF0aXR1ZGUgZmxvYXQsXHJcbiAgbG9uZ2l0dWRlIGZsb2F0LFxyXG4gIGFsdGl0dWRlIGZsb2F0LFxyXG4gIGFjY3VyYWN5IGZsb2F0LFxyXG4gIGRpcmVjdGlvbiBmbG9hdCxcclxuICB3aWR0aCBiaWdpbnQsXHJcbiAgaGVpZ2h0IGJpZ2ludCxcclxuICBtYWtlIHZhcmNoYXIobWF4KSxcclxuICBtb2RlbCB2YXJjaGFyKG1heCksXHJcbiAgc29mdHdhcmUgdmFyY2hhcihtYXgpLFxyXG4gIGRhdGVfdGltZSB2YXJjaGFyKG1heClcclxuKTtcclxuXHJcbkNSRUFURSBUQUJMRSBfX1NDSEVNQV9fLnByb2plY3RzIChcclxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcclxuICByb3dfaWQgYmlnaW50IE5PVCBOVUxMLFxyXG4gIHJvd19yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXHJcbiAgbmFtZSB2YXJjaGFyKDEwMDApIE5PVCBOVUxMLFxyXG4gIGRlc2NyaXB0aW9uIHZhcmNoYXIobWF4KSxcclxuICBjcmVhdGVkX2J5X2lkIGJpZ2ludCxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICBjcmVhdGVkX2F0IGRhdGV0aW1lIE5PVCBOVUxMLFxyXG4gIHVwZGF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgZGVsZXRlZF9hdCBkYXRldGltZVxyXG4pO1xyXG5cclxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18ucm9sZXMgKFxyXG4gIGlkIGJpZ2ludCBOT1QgTlVMTCBJREVOVElUWSgxLDEpIFBSSU1BUlkgS0VZLFxyXG4gIHJvd19pZCBiaWdpbnQgTk9UIE5VTEwsXHJcbiAgcm93X3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSBOT1QgTlVMTCxcclxuICBuYW1lIHZhcmNoYXIoMTAwMCkgTk9UIE5VTEwsXHJcbiAgZGVzY3JpcHRpb24gdmFyY2hhcihtYXgpLFxyXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICBpc19zeXN0ZW0gYml0IE5PVCBOVUxMLFxyXG4gIGlzX2RlZmF1bHQgYml0IE5PVCBOVUxMLFxyXG4gIGNhbl9tYW5hZ2Vfc3Vic2NyaXB0aW9uIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX3VwZGF0ZV9vcmdhbml6YXRpb24gYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5fbWFuYWdlX21lbWJlcnMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5fbWFuYWdlX3JvbGVzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX21hbmFnZV9hcHBzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX21hbmFnZV9wcm9qZWN0cyBiaXQgTk9UIE5VTEwgREVGQVVMVCAwLFxyXG4gIGNhbl9tYW5hZ2VfY2hvaWNlX2xpc3RzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX21hbmFnZV9jbGFzc2lmaWNhdGlvbl9zZXRzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX2NyZWF0ZV9yZWNvcmRzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX3VwZGF0ZV9yZWNvcmRzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX2RlbGV0ZV9yZWNvcmRzIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgY2FuX2NoYW5nZV9zdGF0dXMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5fY2hhbmdlX3Byb2plY3QgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5fYXNzaWduX3JlY29yZHMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5faW1wb3J0X3JlY29yZHMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5fZXhwb3J0X3JlY29yZHMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5fcnVuX3JlcG9ydHMgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBjYW5fbWFuYWdlX2F1dGhvcml6YXRpb25zIGJpdCBOT1QgTlVMTCBERUZBVUxUIDAsXHJcbiAgZGVsZXRlZF9hdCBkYXRldGltZVxyXG4pO1xyXG5cclxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18uc2lnbmF0dXJlcyAoXHJcbiAgaWQgYmlnaW50IE5PVCBOVUxMIElERU5USVRZKDEsMSkgUFJJTUFSWSBLRVksXHJcbiAgcm93X2lkIGJpZ2ludCBOT1QgTlVMTCxcclxuICByb3dfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIGFjY2Vzc19rZXkgdmFyY2hhcigxMDApIE5PVCBOVUxMLFxyXG4gIHJlY29yZF9pZCBiaWdpbnQsXHJcbiAgcmVjb3JkX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICBmb3JtX2lkIGJpZ2ludCxcclxuICBmb3JtX3Jlc291cmNlX2lkIHZhcmNoYXIoMTAwKSxcclxuICBleGlmIHZhcmNoYXIobWF4KSxcclxuICBmaWxlX3NpemUgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICBbZmlsZV0gdmFyY2hhcihtYXgpLFxyXG4gIGNvbnRlbnRfdHlwZSB2YXJjaGFyKG1heCksXHJcbiAgaXNfdXBsb2FkZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBpc19zdG9yZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBpc19wcm9jZXNzZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMFxyXG4pO1xyXG5cclxuQ1JFQVRFIFRBQkxFIF9fU0NIRU1BX18udmlkZW9zIChcclxuICBpZCBiaWdpbnQgTk9UIE5VTEwgSURFTlRJVFkoMSwxKSBQUklNQVJZIEtFWSxcclxuICByb3dfaWQgYmlnaW50IE5PVCBOVUxMLFxyXG4gIHJvd19yZXNvdXJjZV9pZCB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXHJcbiAgYWNjZXNzX2tleSB2YXJjaGFyKDEwMCkgTk9UIE5VTEwsXHJcbiAgcmVjb3JkX2lkIGJpZ2ludCxcclxuICByZWNvcmRfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIGZvcm1faWQgYmlnaW50LFxyXG4gIGZvcm1fcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIG1ldGFkYXRhIHZhcmNoYXIobWF4KSxcclxuICBmaWxlX3NpemUgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIHVwZGF0ZWRfYnlfaWQgYmlnaW50LFxyXG4gIHVwZGF0ZWRfYnlfcmVzb3VyY2VfaWQgdmFyY2hhcigxMDApLFxyXG4gIGNyZWF0ZWRfYXQgZGF0ZXRpbWUgTk9UIE5VTEwsXHJcbiAgdXBkYXRlZF9hdCBkYXRldGltZSBOT1QgTlVMTCxcclxuICBbZmlsZV0gdmFyY2hhcihtYXgpLFxyXG4gIGNvbnRlbnRfdHlwZSB2YXJjaGFyKG1heCksXHJcbiAgaXNfdXBsb2FkZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBpc19zdG9yZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBpc19wcm9jZXNzZWQgYml0IE5PVCBOVUxMIERFRkFVTFQgMCxcclxuICBoYXNfdHJhY2sgYml0LFxyXG4gIHRyYWNrIHZhcmNoYXIobWF4KSxcclxuICBnZW9tZXRyeSBnZW9ncmFwaHksXHJcbiAgd2lkdGggYmlnaW50LFxyXG4gIGhlaWdodCBiaWdpbnQsXHJcbiAgZHVyYXRpb24gZmxvYXQsXHJcbiAgYml0X3JhdGUgZmxvYXRcclxuKTtcclxuXHJcbklGIEVYSVNUUyAoU0VMRUNUICogRlJPTSBzeXMudmlld3MgV0hFUkUgb2JqZWN0X2lkID0gT0JKRUNUX0lEKE5cXCdfX1ZJRVdfU0NIRU1BX18uYXVkaW9fdmlld1xcJykpIERST1AgVklFVyBfX1ZJRVdfU0NIRU1BX18uYXVkaW9fdmlldztcclxuXHJcbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5hdWRpb192aWV3IEFTXHJcblNFTEVDVFxyXG4gIGFjY2Vzc19rZXkgQVMgYXVkaW9faWQsXHJcbiAgcmVjb3JkX3Jlc291cmNlX2lkIEFTIHJlY29yZF9pZCxcclxuICBmb3JtX3Jlc291cmNlX2lkIEFTIGZvcm1faWQsXHJcbiAgbWV0YWRhdGEgQVMgbWV0YWRhdGEsXHJcbiAgZmlsZV9zaXplIEFTIGZpbGVfc2l6ZSxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXHJcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxyXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcclxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXHJcbiAgW2ZpbGVdIEFTIFtmaWxlXSxcclxuICBjb250ZW50X3R5cGUgQVMgY29udGVudF90eXBlLFxyXG4gIGlzX3VwbG9hZGVkIEFTIGlzX3VwbG9hZGVkLFxyXG4gIGlzX3N0b3JlZCBBUyBpc19zdG9yZWQsXHJcbiAgaXNfcHJvY2Vzc2VkIEFTIGlzX3Byb2Nlc3NlZCxcclxuICBoYXNfdHJhY2sgQVMgaGFzX3RyYWNrLFxyXG4gIHRyYWNrIEFTIHRyYWNrLFxyXG4gIGdlb21ldHJ5IEFTIGdlb21ldHJ5LFxyXG4gIGR1cmF0aW9uIEFTIGR1cmF0aW9uLFxyXG4gIGJpdF9yYXRlIEFTIGJpdF9yYXRlXHJcbkZST00gX19TQ0hFTUFfXy5hdWRpbztcclxuXHJcblxyXG5JRiAgRVhJU1RTIChTRUxFQ1QgKiBGUk9NIHN5cy52aWV3cyBXSEVSRSBvYmplY3RfaWQgPSBPQkpFQ1RfSUQoTlxcJ19fVklFV19TQ0hFTUFfXy5jaGFuZ2VzZXRzX3ZpZXdcXCcpKSBEUk9QIFZJRVcgX19WSUVXX1NDSEVNQV9fLmNoYW5nZXNldHNfdmlldztcclxuXHJcbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5jaGFuZ2VzZXRzX3ZpZXcgQVNcclxuU0VMRUNUXHJcbiAgcm93X3Jlc291cmNlX2lkIEFTIGNoYW5nZXNldF9pZCxcclxuICBmb3JtX3Jlc291cmNlX2lkIEFTIGZvcm1faWQsXHJcbiAgbWV0YWRhdGEgQVMgbWV0YWRhdGEsXHJcbiAgY2xvc2VkX2F0IEFTIGNsb3NlZF9hdCxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXHJcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxyXG4gIGNsb3NlZF9ieV9yZXNvdXJjZV9pZCBBUyBjbG9zZWRfYnlfaWQsXHJcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxyXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcclxuICBtaW5fbGF0IEFTIG1pbl9sYXQsXHJcbiAgbWF4X2xhdCBBUyBtYXhfbGF0LFxyXG4gIG1pbl9sb24gQVMgbWluX2xvbixcclxuICBtYXhfbG9uIEFTIG1heF9sb24sXHJcbiAgbnVtYmVyX29mX2NoYW5nZXMgQVMgbnVtYmVyX29mX2NoYW5nZXMsXHJcbiAgbnVtYmVyX29mX2NyZWF0ZXMgQVMgbnVtYmVyX29mX2NyZWF0ZXMsXHJcbiAgbnVtYmVyX29mX3VwZGF0ZXMgQVMgbnVtYmVyX29mX3VwZGF0ZXMsXHJcbiAgbnVtYmVyX29mX2RlbGV0ZXMgQVMgbnVtYmVyX29mX2RlbGV0ZXMsXHJcbiAgbWV0YWRhdGFfaW5kZXggQVMgbWV0YWRhdGFfaW5kZXgsXHJcbiAgYm91bmRpbmdfYm94IEFTIGJvdW5kaW5nX2JveFxyXG5GUk9NIF9fU0NIRU1BX18uY2hhbmdlc2V0cztcclxuXHJcbklGICBFWElTVFMgKFNFTEVDVCAqIEZST00gc3lzLnZpZXdzIFdIRVJFIG9iamVjdF9pZCA9IE9CSkVDVF9JRChOXFwnX19WSUVXX1NDSEVNQV9fLmNob2ljZV9saXN0c192aWV3XFwnKSkgRFJPUCBWSUVXIF9fVklFV19TQ0hFTUFfXy5jaG9pY2VfbGlzdHNfdmlldztcclxuXHJcbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5jaG9pY2VfbGlzdHNfdmlldyBBU1xyXG5TRUxFQ1RcclxuICByb3dfcmVzb3VyY2VfaWQgQVMgY2hvaWNlX2xpc3RfaWQsXHJcbiAgbmFtZSBBUyBuYW1lLFxyXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxyXG4gIHZlcnNpb24gQVMgdmVyc2lvbixcclxuICBpdGVtcyBBUyBpdGVtcyxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXHJcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxyXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcclxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXHJcbiAgZGVsZXRlZF9hdCBBUyBkZWxldGVkX2F0XHJcbkZST00gX19TQ0hFTUFfXy5jaG9pY2VfbGlzdHM7XHJcblxyXG5JRiAgRVhJU1RTIChTRUxFQ1QgKiBGUk9NIHN5cy52aWV3cyBXSEVSRSBvYmplY3RfaWQgPSBPQkpFQ1RfSUQoTlxcJ19fVklFV19TQ0hFTUFfXy5jbGFzc2lmaWNhdGlvbl9zZXRzX3ZpZXdcXCcpKSBEUk9QIFZJRVcgX19WSUVXX1NDSEVNQV9fLmNsYXNzaWZpY2F0aW9uX3NldHNfdmlldztcclxuXHJcbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5jbGFzc2lmaWNhdGlvbl9zZXRzX3ZpZXcgQVNcclxuU0VMRUNUXHJcbiAgcm93X3Jlc291cmNlX2lkIEFTIGNsYXNzaWZpY2F0aW9uX3NldF9pZCxcclxuICBuYW1lIEFTIG5hbWUsXHJcbiAgZGVzY3JpcHRpb24gQVMgZGVzY3JpcHRpb24sXHJcbiAgdmVyc2lvbiBBUyB2ZXJzaW9uLFxyXG4gIGl0ZW1zIEFTIGl0ZW1zLFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcclxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXHJcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxyXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcclxuICBkZWxldGVkX2F0IEFTIGRlbGV0ZWRfYXRcclxuRlJPTSBfX1NDSEVNQV9fLmNsYXNzaWZpY2F0aW9uX3NldHM7XHJcblxyXG5JRiAgRVhJU1RTIChTRUxFQ1QgKiBGUk9NIHN5cy52aWV3cyBXSEVSRSBvYmplY3RfaWQgPSBPQkpFQ1RfSUQoTlxcJ19fVklFV19TQ0hFTUFfXy5mb3Jtc192aWV3XFwnKSkgRFJPUCBWSUVXIF9fVklFV19TQ0hFTUFfXy5mb3Jtc192aWV3O1xyXG5cclxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLmZvcm1zX3ZpZXcgQVNcclxuU0VMRUNUXHJcbiAgcm93X3Jlc291cmNlX2lkIEFTIGZvcm1faWQsXHJcbiAgbmFtZSBBUyBuYW1lLFxyXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxyXG4gIHZlcnNpb24gQVMgdmVyc2lvbixcclxuICBlbGVtZW50cyBBUyBlbGVtZW50cyxcclxuICBib3VuZGluZ19ib3ggQVMgYm91bmRpbmdfYm94LFxyXG4gIHN0YXR1cyBBUyBzdGF0dXMsXHJcbiAgc3RhdHVzX2ZpZWxkIEFTIHN0YXR1c19maWVsZCxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXHJcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxyXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcclxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXHJcbiAgZGVsZXRlZF9hdCBBUyBkZWxldGVkX2F0LFxyXG4gIGF1dG9fYXNzaWduIEFTIGF1dG9fYXNzaWduLFxyXG4gIHRpdGxlX2ZpZWxkX2tleXMgQVMgdGl0bGVfZmllbGRfa2V5cyxcclxuICBoaWRkZW5fb25fZGFzaGJvYXJkIEFTIGhpZGRlbl9vbl9kYXNoYm9hcmQsXHJcbiAgZ2VvbWV0cnlfdHlwZXMgQVMgZ2VvbWV0cnlfdHlwZXMsXHJcbiAgZ2VvbWV0cnlfcmVxdWlyZWQgQVMgZ2VvbWV0cnlfcmVxdWlyZWQsXHJcbiAgc2NyaXB0IEFTIHNjcmlwdCxcclxuICBpbWFnZSBBUyBpbWFnZSxcclxuICBwcm9qZWN0c19lbmFibGVkIEFTIHByb2plY3RzX2VuYWJsZWQsXHJcbiAgYXNzaWdubWVudF9lbmFibGVkIEFTIGFzc2lnbm1lbnRfZW5hYmxlZFxyXG5GUk9NIF9fU0NIRU1BX18uZm9ybXM7XHJcblxyXG5JRiAgRVhJU1RTIChTRUxFQ1QgKiBGUk9NIHN5cy52aWV3cyBXSEVSRSBvYmplY3RfaWQgPSBPQkpFQ1RfSUQoTlxcJ19fVklFV19TQ0hFTUFfXy5tZW1iZXJzaGlwc192aWV3XFwnKSkgRFJPUCBWSUVXIF9fVklFV19TQ0hFTUFfXy5tZW1iZXJzaGlwc192aWV3O1xyXG5cclxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLm1lbWJlcnNoaXBzX3ZpZXcgQVNcclxuU0VMRUNUXHJcbiAgbWVtYmVyc2hpcHMucm93X3Jlc291cmNlX2lkIEFTIG1lbWJlcnNoaXBfaWQsXHJcbiAgbWVtYmVyc2hpcHMudXNlcl9yZXNvdXJjZV9pZCBBUyB1c2VyX2lkLFxyXG4gIG1lbWJlcnNoaXBzLmZpcnN0X25hbWUgQVMgZmlyc3RfbmFtZSxcclxuICBtZW1iZXJzaGlwcy5sYXN0X25hbWUgQVMgbGFzdF9uYW1lLFxyXG4gIG1lbWJlcnNoaXBzLm5hbWUgQVMgbmFtZSxcclxuICBtZW1iZXJzaGlwcy5lbWFpbCBBUyBlbWFpbCxcclxuICBtZW1iZXJzaGlwcy5yb2xlX3Jlc291cmNlX2lkIEFTIHJvbGVfaWQsXHJcbiAgcm9sZXMubmFtZSBBUyByb2xlX25hbWUsXHJcbiAgbWVtYmVyc2hpcHMuc3RhdHVzIEFTIHN0YXR1cyxcclxuICBtZW1iZXJzaGlwcy5jcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXHJcbiAgbWVtYmVyc2hpcHMudXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxyXG4gIG1lbWJlcnNoaXBzLmRlbGV0ZWRfYXQgQVMgZGVsZXRlZF9hdFxyXG5GUk9NIF9fU0NIRU1BX18ubWVtYmVyc2hpcHMgbWVtYmVyc2hpcHNcclxuTEVGVCBPVVRFUiBKT0lOIF9fU0NIRU1BX18ucm9sZXMgcm9sZXMgT04gbWVtYmVyc2hpcHMucm9sZV9yZXNvdXJjZV9pZCA9IHJvbGVzLnJvd19yZXNvdXJjZV9pZDtcclxuXHJcbklGICBFWElTVFMgKFNFTEVDVCAqIEZST00gc3lzLnZpZXdzIFdIRVJFIG9iamVjdF9pZCA9IE9CSkVDVF9JRChOXFwnX19WSUVXX1NDSEVNQV9fLnBob3Rvc192aWV3XFwnKSkgRFJPUCBWSUVXIF9fVklFV19TQ0hFTUFfXy5waG90b3NfdmlldztcclxuXHJcbkNSRUFURSBWSUVXIF9fVklFV19TQ0hFTUFfXy5waG90b3NfdmlldyBBU1xyXG5TRUxFQ1RcclxuICBhY2Nlc3Nfa2V5IEFTIHBob3RvX2lkLFxyXG4gIHJlY29yZF9yZXNvdXJjZV9pZCBBUyByZWNvcmRfaWQsXHJcbiAgZm9ybV9yZXNvdXJjZV9pZCBBUyBmb3JtX2lkLFxyXG4gIGV4aWYgQVMgZXhpZixcclxuICBmaWxlX3NpemUgQVMgZmlsZV9zaXplLFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcclxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXHJcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxyXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcclxuICBbZmlsZV0gQVMgW2ZpbGVdLFxyXG4gIGNvbnRlbnRfdHlwZSBBUyBjb250ZW50X3R5cGUsXHJcbiAgaXNfdXBsb2FkZWQgQVMgaXNfdXBsb2FkZWQsXHJcbiAgaXNfc3RvcmVkIEFTIGlzX3N0b3JlZCxcclxuICBpc19wcm9jZXNzZWQgQVMgaXNfcHJvY2Vzc2VkLFxyXG4gIGdlb21ldHJ5IEFTIGdlb21ldHJ5LFxyXG4gIGxhdGl0dWRlIEFTIGxhdGl0dWRlLFxyXG4gIGxvbmdpdHVkZSBBUyBsb25naXR1ZGUsXHJcbiAgYWx0aXR1ZGUgQVMgYWx0aXR1ZGUsXHJcbiAgYWNjdXJhY3kgQVMgYWNjdXJhY3ksXHJcbiAgZGlyZWN0aW9uIEFTIGRpcmVjdGlvbixcclxuICB3aWR0aCBBUyB3aWR0aCxcclxuICBoZWlnaHQgQVMgaGVpZ2h0LFxyXG4gIG1ha2UgQVMgbWFrZSxcclxuICBtb2RlbCBBUyBtb2RlbCxcclxuICBzb2Z0d2FyZSBBUyBzb2Z0d2FyZSxcclxuICBkYXRlX3RpbWUgQVMgZGF0ZV90aW1lXHJcbkZST00gX19TQ0hFTUFfXy5waG90b3M7XHJcblxyXG5JRiAgRVhJU1RTIChTRUxFQ1QgKiBGUk9NIHN5cy52aWV3cyBXSEVSRSBvYmplY3RfaWQgPSBPQkpFQ1RfSUQoTlxcJ19fVklFV19TQ0hFTUFfXy5wcm9qZWN0c192aWV3XFwnKSkgRFJPUCBWSUVXIF9fVklFV19TQ0hFTUFfXy5wcm9qZWN0c192aWV3O1xyXG5cclxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnByb2plY3RzX3ZpZXcgQVNcclxuU0VMRUNUXHJcbiAgcm93X3Jlc291cmNlX2lkIEFTIHByb2plY3RfaWQsXHJcbiAgbmFtZSBBUyBuYW1lLFxyXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcclxuICBjcmVhdGVkX2F0IEFTIGNyZWF0ZWRfYXQsXHJcbiAgdXBkYXRlZF9hdCBBUyB1cGRhdGVkX2F0LFxyXG4gIGRlbGV0ZWRfYXQgQVMgZGVsZXRlZF9hdFxyXG5GUk9NIF9fU0NIRU1BX18ucHJvamVjdHM7XHJcblxyXG5JRiAgRVhJU1RTIChTRUxFQ1QgKiBGUk9NIHN5cy52aWV3cyBXSEVSRSBvYmplY3RfaWQgPSBPQkpFQ1RfSUQoTlxcJ19fVklFV19TQ0hFTUFfXy5yb2xlc192aWV3XFwnKSkgRFJPUCBWSUVXIF9fVklFV19TQ0hFTUFfXy5yb2xlc192aWV3O1xyXG5cclxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnJvbGVzX3ZpZXcgQVNcclxuU0VMRUNUXHJcbiAgcm93X3Jlc291cmNlX2lkIEFTIHJvbGVfaWQsXHJcbiAgbmFtZSBBUyBuYW1lLFxyXG4gIGRlc2NyaXB0aW9uIEFTIGRlc2NyaXB0aW9uLFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcclxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXHJcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxyXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcclxuICBkZWxldGVkX2F0IEFTIGRlbGV0ZWRfYXQsXHJcbiAgaXNfc3lzdGVtIEFTIGlzX3N5c3RlbSxcclxuICBpc19kZWZhdWx0IEFTIGlzX2RlZmF1bHQsXHJcbiAgY2FuX21hbmFnZV9zdWJzY3JpcHRpb24gQVMgY2FuX21hbmFnZV9zdWJzY3JpcHRpb24sXHJcbiAgY2FuX3VwZGF0ZV9vcmdhbml6YXRpb24gQVMgY2FuX3VwZGF0ZV9vcmdhbml6YXRpb24sXHJcbiAgY2FuX21hbmFnZV9tZW1iZXJzIEFTIGNhbl9tYW5hZ2VfbWVtYmVycyxcclxuICBjYW5fbWFuYWdlX3JvbGVzIEFTIGNhbl9tYW5hZ2Vfcm9sZXMsXHJcbiAgY2FuX21hbmFnZV9hcHBzIEFTIGNhbl9tYW5hZ2VfYXBwcyxcclxuICBjYW5fbWFuYWdlX3Byb2plY3RzIEFTIGNhbl9tYW5hZ2VfcHJvamVjdHMsXHJcbiAgY2FuX21hbmFnZV9jaG9pY2VfbGlzdHMgQVMgY2FuX21hbmFnZV9jaG9pY2VfbGlzdHMsXHJcbiAgY2FuX21hbmFnZV9jbGFzc2lmaWNhdGlvbl9zZXRzIEFTIGNhbl9tYW5hZ2VfY2xhc3NpZmljYXRpb25fc2V0cyxcclxuICBjYW5fY3JlYXRlX3JlY29yZHMgQVMgY2FuX2NyZWF0ZV9yZWNvcmRzLFxyXG4gIGNhbl91cGRhdGVfcmVjb3JkcyBBUyBjYW5fdXBkYXRlX3JlY29yZHMsXHJcbiAgY2FuX2RlbGV0ZV9yZWNvcmRzIEFTIGNhbl9kZWxldGVfcmVjb3JkcyxcclxuICBjYW5fY2hhbmdlX3N0YXR1cyBBUyBjYW5fY2hhbmdlX3N0YXR1cyxcclxuICBjYW5fY2hhbmdlX3Byb2plY3QgQVMgY2FuX2NoYW5nZV9wcm9qZWN0LFxyXG4gIGNhbl9hc3NpZ25fcmVjb3JkcyBBUyBjYW5fYXNzaWduX3JlY29yZHMsXHJcbiAgY2FuX2ltcG9ydF9yZWNvcmRzIEFTIGNhbl9pbXBvcnRfcmVjb3JkcyxcclxuICBjYW5fZXhwb3J0X3JlY29yZHMgQVMgY2FuX2V4cG9ydF9yZWNvcmRzLFxyXG4gIGNhbl9ydW5fcmVwb3J0cyBBUyBjYW5fcnVuX3JlcG9ydHMsXHJcbiAgY2FuX21hbmFnZV9hdXRob3JpemF0aW9ucyBBUyBjYW5fbWFuYWdlX2F1dGhvcml6YXRpb25zXHJcbkZST00gX19TQ0hFTUFfXy5yb2xlcztcclxuXHJcbklGICBFWElTVFMgKFNFTEVDVCAqIEZST00gc3lzLnZpZXdzIFdIRVJFIG9iamVjdF9pZCA9IE9CSkVDVF9JRChOXFwnX19WSUVXX1NDSEVNQV9fLnNpZ25hdHVyZXNfdmlld1xcJykpIERST1AgVklFVyBfX1ZJRVdfU0NIRU1BX18uc2lnbmF0dXJlc192aWV3O1xyXG5cclxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnNpZ25hdHVyZXNfdmlldyBBU1xyXG5TRUxFQ1RcclxuICBhY2Nlc3Nfa2V5IEFTIHNpZ25hdHVyZV9pZCxcclxuICByZWNvcmRfcmVzb3VyY2VfaWQgQVMgcmVjb3JkX2lkLFxyXG4gIGZvcm1fcmVzb3VyY2VfaWQgQVMgZm9ybV9pZCxcclxuICBmaWxlX3NpemUgQVMgZmlsZV9zaXplLFxyXG4gIGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgQVMgY3JlYXRlZF9ieV9pZCxcclxuICB1cGRhdGVkX2J5X3Jlc291cmNlX2lkIEFTIHVwZGF0ZWRfYnlfaWQsXHJcbiAgY3JlYXRlZF9hdCBBUyBjcmVhdGVkX2F0LFxyXG4gIHVwZGF0ZWRfYXQgQVMgdXBkYXRlZF9hdCxcclxuICBbZmlsZV0gQVMgW2ZpbGVdLFxyXG4gIGNvbnRlbnRfdHlwZSBBUyBjb250ZW50X3R5cGUsXHJcbiAgaXNfdXBsb2FkZWQgQVMgaXNfdXBsb2FkZWQsXHJcbiAgaXNfc3RvcmVkIEFTIGlzX3N0b3JlZCxcclxuICBpc19wcm9jZXNzZWQgQVMgaXNfcHJvY2Vzc2VkXHJcbkZST00gX19TQ0hFTUFfXy5zaWduYXR1cmVzO1xyXG5cclxuSUYgIEVYSVNUUyAoU0VMRUNUICogRlJPTSBzeXMudmlld3MgV0hFUkUgb2JqZWN0X2lkID0gT0JKRUNUX0lEKE5cXCdfX1ZJRVdfU0NIRU1BX18udmlkZW9zX3ZpZXdcXCcpKSBEUk9QIFZJRVcgX19WSUVXX1NDSEVNQV9fLnZpZGVvc192aWV3O1xyXG5cclxuQ1JFQVRFIFZJRVcgX19WSUVXX1NDSEVNQV9fLnZpZGVvc192aWV3IEFTXHJcblNFTEVDVFxyXG4gIGFjY2Vzc19rZXkgQVMgdmlkZW9faWQsXHJcbiAgcmVjb3JkX3Jlc291cmNlX2lkIEFTIHJlY29yZF9pZCxcclxuICBmb3JtX3Jlc291cmNlX2lkIEFTIGZvcm1faWQsXHJcbiAgbWV0YWRhdGEgQVMgbWV0YWRhdGEsXHJcbiAgZmlsZV9zaXplIEFTIGZpbGVfc2l6ZSxcclxuICBjcmVhdGVkX2J5X3Jlc291cmNlX2lkIEFTIGNyZWF0ZWRfYnlfaWQsXHJcbiAgdXBkYXRlZF9ieV9yZXNvdXJjZV9pZCBBUyB1cGRhdGVkX2J5X2lkLFxyXG4gIGNyZWF0ZWRfYXQgQVMgY3JlYXRlZF9hdCxcclxuICB1cGRhdGVkX2F0IEFTIHVwZGF0ZWRfYXQsXHJcbiAgW2ZpbGVdIEFTIFtmaWxlXSxcclxuICBjb250ZW50X3R5cGUgQVMgY29udGVudF90eXBlLFxyXG4gIGlzX3VwbG9hZGVkIEFTIGlzX3VwbG9hZGVkLFxyXG4gIGlzX3N0b3JlZCBBUyBpc19zdG9yZWQsXHJcbiAgaXNfcHJvY2Vzc2VkIEFTIGlzX3Byb2Nlc3NlZCxcclxuICBoYXNfdHJhY2sgQVMgaGFzX3RyYWNrLFxyXG4gIHRyYWNrIEFTIHRyYWNrLFxyXG4gIGdlb21ldHJ5IEFTIGdlb21ldHJ5LFxyXG4gIHdpZHRoIEFTIHdpZHRoLFxyXG4gIGhlaWdodCBBUyBoZWlnaHQsXHJcbiAgZHVyYXRpb24gQVMgZHVyYXRpb24sXHJcbiAgYml0X3JhdGUgQVMgYml0X3JhdGVcclxuRlJPTSBfX1NDSEVNQV9fLnZpZGVvcztcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2F1ZGlvX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLmF1ZGlvIChyb3dfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfYXVkaW9fcm93X2lkIE9OIF9fU0NIRU1BX18uYXVkaW8gKHJvd19pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X2F1ZGlvX2FjY2Vzc19rZXkgT04gX19TQ0hFTUFfXy5hdWRpbyAoYWNjZXNzX2tleSk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X2F1ZGlvX3JlY29yZF9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLmF1ZGlvIChyZWNvcmRfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9hdWRpb19mb3JtX3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uYXVkaW8gKGZvcm1fcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9hdWRpb19jcmVhdGVkX2J5X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uYXVkaW8gKGNyZWF0ZWRfYnlfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIFNQQVRJQUwgSU5ERVggaWR4X2F1ZGlvX2dlb21ldHJ5IE9OIF9fU0NIRU1BX18uYXVkaW8gKGdlb21ldHJ5KTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfYXVkaW9fdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmF1ZGlvICh1cGRhdGVkX2F0KTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2NoYW5nZXNldHNfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uY2hhbmdlc2V0cyAocm93X3Jlc291cmNlX2lkKTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2NoYW5nZXNldHNfcm93X2lkIE9OIF9fU0NIRU1BX18uY2hhbmdlc2V0cyAocm93X2lkKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfY2hhbmdlc2V0c19mb3JtX2lkIE9OIF9fU0NIRU1BX18uY2hhbmdlc2V0cyAoZm9ybV9pZCk7XHJcblxyXG4tLSBDUkVBVEUgSU5ERVggaWR4X2NoYW5nZXNldHNfbWV0YWRhdGFfaW5kZXggT04gX19TQ0hFTUFfXy5jaGFuZ2VzZXRzIFVTSU5HIGdpbiAobWV0YWRhdGFfaW5kZXgpIFdJVEggKGZhc3R1cGRhdGUgPSBvZmYpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9jaGFuZ2VzZXRzX2Zvcm1faWRfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmNoYW5nZXNldHMgKGZvcm1faWQsIHVwZGF0ZWRfYXQpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9jaGFuZ2VzZXRzX3VwZGF0ZWRfYXQgT04gX19TQ0hFTUFfXy5jaGFuZ2VzZXRzICh1cGRhdGVkX2F0KTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2Nob2ljZV9saXN0c19yb3dfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5jaG9pY2VfbGlzdHMgKHJvd19yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9jaG9pY2VfbGlzdHNfcm93X2lkIE9OIF9fU0NIRU1BX18uY2hvaWNlX2xpc3RzIChyb3dfaWQpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9jaG9pY2VfbGlzdHNfbmFtZSBPTiBfX1NDSEVNQV9fLmNob2ljZV9saXN0cyAobmFtZSk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X2Nob2ljZV9saXN0c191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18uY2hvaWNlX2xpc3RzICh1cGRhdGVkX2F0KTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2NsYXNzaWZpY2F0aW9uX3NldHNfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0cyAocm93X3Jlc291cmNlX2lkKTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X2NsYXNzaWZpY2F0aW9uX3NldHNfcm93X2lkIE9OIF9fU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0cyAocm93X2lkKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfY2xhc3NpZmljYXRpb25fc2V0c19uYW1lIE9OIF9fU0NIRU1BX18uY2xhc3NpZmljYXRpb25fc2V0cyAobmFtZSk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X2NsYXNzaWZpY2F0aW9uX3NldHNfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmNsYXNzaWZpY2F0aW9uX3NldHMgKHVwZGF0ZWRfYXQpO1xyXG5cclxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfZm9ybXNfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18uZm9ybXMgKHJvd19yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9mb3Jtc19yb3dfaWQgT04gX19TQ0hFTUFfXy5mb3JtcyAocm93X2lkKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfZm9ybXNfbmFtZSBPTiBfX1NDSEVNQV9fLmZvcm1zIChuYW1lKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfZm9ybXNfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLmZvcm1zICh1cGRhdGVkX2F0KTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X21lbWJlcnNoaXBzX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLm1lbWJlcnNoaXBzIChyb3dfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfbWVtYmVyc2hpcHNfcm93X2lkIE9OIF9fU0NIRU1BX18ubWVtYmVyc2hpcHMgKHJvd19pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X21lbWJlcnNoaXBzX3VzZXJfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyAodXNlcl9yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X21lbWJlcnNoaXBzX3JvbGVfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyAocm9sZV9yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X21lbWJlcnNoaXBzX25hbWUgT04gX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyAobmFtZSk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X21lbWJlcnNoaXBzX3VwZGF0ZWRfYXQgT04gX19TQ0hFTUFfXy5tZW1iZXJzaGlwcyAodXBkYXRlZF9hdCk7XHJcblxyXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9waG90b3Nfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18ucGhvdG9zIChyb3dfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcGhvdG9zX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnBob3RvcyAocm93X2lkKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfcGhvdG9zX2FjY2Vzc19rZXkgT04gX19TQ0hFTUFfXy5waG90b3MgKGFjY2Vzc19rZXkpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9waG90b3NfcmVjb3JkX3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18ucGhvdG9zIChyZWNvcmRfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9waG90b3NfZm9ybV9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnBob3RvcyAoZm9ybV9yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X3Bob3Rvc19jcmVhdGVkX2J5X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18ucGhvdG9zIChjcmVhdGVkX2J5X3Jlc291cmNlX2lkKTtcclxuXHJcbkNSRUFURSBTUEFUSUFMIElOREVYIGlkeF9waG90b3NfZ2VvbWV0cnkgT04gX19TQ0hFTUFfXy5waG90b3MgKGdlb21ldHJ5KTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfcGhvdG9zX3VwZGF0ZWRfYXQgT04gX19TQ0hFTUFfXy5waG90b3MgKHVwZGF0ZWRfYXQpO1xyXG5cclxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcHJvamVjdHNfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18ucHJvamVjdHMgKHJvd19yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9wcm9qZWN0c19yb3dfaWQgT04gX19TQ0hFTUFfXy5wcm9qZWN0cyAocm93X2lkKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfcHJvamVjdHNfbmFtZSBPTiBfX1NDSEVNQV9fLnByb2plY3RzIChuYW1lKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfcHJvamVjdHNfdXBkYXRlZF9hdCBPTiBfX1NDSEVNQV9fLnByb2plY3RzICh1cGRhdGVkX2F0KTtcclxuXHJcbkNSRUFURSBVTklRVUUgSU5ERVggaWR4X3JvbGVzX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnJvbGVzIChyb3dfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfcm9sZXNfcm93X2lkIE9OIF9fU0NIRU1BX18ucm9sZXMgKHJvd19pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X3JvbGVzX25hbWUgT04gX19TQ0hFTUFfXy5yb2xlcyAobmFtZSk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X3JvbGVzX3VwZGF0ZWRfYXQgT04gX19TQ0hFTUFfXy5yb2xlcyAodXBkYXRlZF9hdCk7XHJcblxyXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9zaWduYXR1cmVzX3Jvd19yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnNpZ25hdHVyZXMgKHJvd19yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF9zaWduYXR1cmVzX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnNpZ25hdHVyZXMgKHJvd19pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X3NpZ25hdHVyZXNfYWNjZXNzX2tleSBPTiBfX1NDSEVNQV9fLnNpZ25hdHVyZXMgKGFjY2Vzc19rZXkpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9zaWduYXR1cmVzX3JlY29yZF9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnNpZ25hdHVyZXMgKHJlY29yZF9yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X3NpZ25hdHVyZXNfZm9ybV9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnNpZ25hdHVyZXMgKGZvcm1fcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF9zaWduYXR1cmVzX2NyZWF0ZWRfYnlfcmVzb3VyY2VfaWQgT04gX19TQ0hFTUFfXy5zaWduYXR1cmVzIChjcmVhdGVkX2J5X3Jlc291cmNlX2lkKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfc2lnbmF0dXJlc191cGRhdGVkX2F0IE9OIF9fU0NIRU1BX18uc2lnbmF0dXJlcyAodXBkYXRlZF9hdCk7XHJcblxyXG5DUkVBVEUgVU5JUVVFIElOREVYIGlkeF92aWRlb3Nfcm93X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18udmlkZW9zIChyb3dfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIFVOSVFVRSBJTkRFWCBpZHhfdmlkZW9zX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnZpZGVvcyAocm93X2lkKTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfdmlkZW9zX2FjY2Vzc19rZXkgT04gX19TQ0hFTUFfXy52aWRlb3MgKGFjY2Vzc19rZXkpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF92aWRlb3NfcmVjb3JkX3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18udmlkZW9zIChyZWNvcmRfcmVzb3VyY2VfaWQpO1xyXG5cclxuQ1JFQVRFIElOREVYIGlkeF92aWRlb3NfZm9ybV9yZXNvdXJjZV9pZCBPTiBfX1NDSEVNQV9fLnZpZGVvcyAoZm9ybV9yZXNvdXJjZV9pZCk7XHJcblxyXG5DUkVBVEUgSU5ERVggaWR4X3ZpZGVvc19jcmVhdGVkX2J5X3Jlc291cmNlX2lkIE9OIF9fU0NIRU1BX18udmlkZW9zIChjcmVhdGVkX2J5X3Jlc291cmNlX2lkKTtcclxuXHJcbkNSRUFURSBTUEFUSUFMIElOREVYIGlkeF92aWRlb3NfZ2VvbWV0cnkgT04gX19TQ0hFTUFfXy52aWRlb3MgKGdlb21ldHJ5KTtcclxuXHJcbkNSRUFURSBJTkRFWCBpZHhfdmlkZW9zX3VwZGF0ZWRfYXQgT04gX19TQ0hFTUFfXy52aWRlb3MgKHVwZGF0ZWRfYXQpO1xyXG5cclxuQ09NTUlUIFRSQU5TQUNUSU9OO1xyXG5gO1xyXG4iXX0=