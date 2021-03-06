"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = `
BEGIN TRANSACTION;

DROP INDEX idx_audio_row_id ON __SCHEMA__.system_audio;
DROP INDEX idx_changesets_row_id ON __SCHEMA__.system_changesets;
DROP INDEX idx_choice_lists_row_id ON __SCHEMA__.system_choice_lists;
DROP INDEX idx_classification_sets_row_id ON __SCHEMA__.system_classification_sets;
DROP INDEX idx_forms_row_id ON __SCHEMA__.system_forms;
DROP INDEX idx_memberships_row_id ON __SCHEMA__.system_memberships;
DROP INDEX idx_photos_row_id ON __SCHEMA__.system_photos;
DROP INDEX idx_projects_row_id ON __SCHEMA__.system_projects;
DROP INDEX idx_roles_row_id ON __SCHEMA__.system_roles;
DROP INDEX idx_signatures_row_id ON __SCHEMA__.system_signatures;
DROP INDEX idx_videos_row_id ON __SCHEMA__.system_videos;
DROP INDEX idx_records_row_id ON __SCHEMA__.system_records;

CREATE INDEX idx_audio_row_id ON __SCHEMA__.system_audio (row_id);
CREATE INDEX idx_changesets_row_id ON __SCHEMA__.system_changesets (row_id);
CREATE INDEX idx_choice_lists_row_id ON __SCHEMA__.system_choice_lists (row_id);
CREATE INDEX idx_classification_sets_row_id ON __SCHEMA__.system_classification_sets (row_id);
CREATE INDEX idx_forms_row_id ON __SCHEMA__.system_forms (row_id);
CREATE INDEX idx_memberships_row_id ON __SCHEMA__.system_memberships (row_id);
CREATE INDEX idx_photos_row_id ON __SCHEMA__.system_photos (row_id);
CREATE INDEX idx_projects_row_id ON __SCHEMA__.system_projects (row_id);
CREATE INDEX idx_roles_row_id ON __SCHEMA__.system_roles (row_id);
CREATE INDEX idx_signatures_row_id ON __SCHEMA__.system_signatures (row_id);
CREATE INDEX idx_videos_row_id ON __SCHEMA__.system_videos (row_id);
CREATE INDEX idx_records_row_id ON __SCHEMA__.system_records (row_id);

INSERT INTO __SCHEMA__.migrations (name) VALUES ('006');

COMMIT TRANSACTION;
`;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3ZlcnNpb24tMDA2LnNxbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztrQkFBZ0IiLCJmaWxlIjoidmVyc2lvbi0wMDYuc3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgYFxuQkVHSU4gVFJBTlNBQ1RJT047XG5cbkRST1AgSU5ERVggaWR4X2F1ZGlvX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnN5c3RlbV9hdWRpbztcbkRST1AgSU5ERVggaWR4X2NoYW5nZXNldHNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX2NoYW5nZXNldHM7XG5EUk9QIElOREVYIGlkeF9jaG9pY2VfbGlzdHNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX2Nob2ljZV9saXN0cztcbkRST1AgSU5ERVggaWR4X2NsYXNzaWZpY2F0aW9uX3NldHNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX2NsYXNzaWZpY2F0aW9uX3NldHM7XG5EUk9QIElOREVYIGlkeF9mb3Jtc19yb3dfaWQgT04gX19TQ0hFTUFfXy5zeXN0ZW1fZm9ybXM7XG5EUk9QIElOREVYIGlkeF9tZW1iZXJzaGlwc19yb3dfaWQgT04gX19TQ0hFTUFfXy5zeXN0ZW1fbWVtYmVyc2hpcHM7XG5EUk9QIElOREVYIGlkeF9waG90b3Nfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX3Bob3RvcztcbkRST1AgSU5ERVggaWR4X3Byb2plY3RzX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnN5c3RlbV9wcm9qZWN0cztcbkRST1AgSU5ERVggaWR4X3JvbGVzX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnN5c3RlbV9yb2xlcztcbkRST1AgSU5ERVggaWR4X3NpZ25hdHVyZXNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX3NpZ25hdHVyZXM7XG5EUk9QIElOREVYIGlkeF92aWRlb3Nfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX3ZpZGVvcztcbkRST1AgSU5ERVggaWR4X3JlY29yZHNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX3JlY29yZHM7XG5cbkNSRUFURSBJTkRFWCBpZHhfYXVkaW9fcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX2F1ZGlvIChyb3dfaWQpO1xuQ1JFQVRFIElOREVYIGlkeF9jaGFuZ2VzZXRzX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnN5c3RlbV9jaGFuZ2VzZXRzIChyb3dfaWQpO1xuQ1JFQVRFIElOREVYIGlkeF9jaG9pY2VfbGlzdHNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX2Nob2ljZV9saXN0cyAocm93X2lkKTtcbkNSRUFURSBJTkRFWCBpZHhfY2xhc3NpZmljYXRpb25fc2V0c19yb3dfaWQgT04gX19TQ0hFTUFfXy5zeXN0ZW1fY2xhc3NpZmljYXRpb25fc2V0cyAocm93X2lkKTtcbkNSRUFURSBJTkRFWCBpZHhfZm9ybXNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX2Zvcm1zIChyb3dfaWQpO1xuQ1JFQVRFIElOREVYIGlkeF9tZW1iZXJzaGlwc19yb3dfaWQgT04gX19TQ0hFTUFfXy5zeXN0ZW1fbWVtYmVyc2hpcHMgKHJvd19pZCk7XG5DUkVBVEUgSU5ERVggaWR4X3Bob3Rvc19yb3dfaWQgT04gX19TQ0hFTUFfXy5zeXN0ZW1fcGhvdG9zIChyb3dfaWQpO1xuQ1JFQVRFIElOREVYIGlkeF9wcm9qZWN0c19yb3dfaWQgT04gX19TQ0hFTUFfXy5zeXN0ZW1fcHJvamVjdHMgKHJvd19pZCk7XG5DUkVBVEUgSU5ERVggaWR4X3JvbGVzX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnN5c3RlbV9yb2xlcyAocm93X2lkKTtcbkNSRUFURSBJTkRFWCBpZHhfc2lnbmF0dXJlc19yb3dfaWQgT04gX19TQ0hFTUFfXy5zeXN0ZW1fc2lnbmF0dXJlcyAocm93X2lkKTtcbkNSRUFURSBJTkRFWCBpZHhfdmlkZW9zX3Jvd19pZCBPTiBfX1NDSEVNQV9fLnN5c3RlbV92aWRlb3MgKHJvd19pZCk7XG5DUkVBVEUgSU5ERVggaWR4X3JlY29yZHNfcm93X2lkIE9OIF9fU0NIRU1BX18uc3lzdGVtX3JlY29yZHMgKHJvd19pZCk7XG5cbklOU0VSVCBJTlRPIF9fU0NIRU1BX18ubWlncmF0aW9ucyAobmFtZSkgVkFMVUVTICgnMDA2Jyk7XG5cbkNPTU1JVCBUUkFOU0FDVElPTjtcbmA7XG4iXX0=