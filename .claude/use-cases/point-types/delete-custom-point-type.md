---
status: To Do
---

# Delete Custom Point Type

An org member deletes an org-defined custom point type. Ownership is enforced. Deletion is blocked if any point still references the type.

## Acceptance Criteria

- `DELETE /api/custom-point-types/:id` requires an authenticated session with an active org
- `organization_id` is taken from the session JWT
- The delete executes: `DELETE FROM custom_point_types WHERE id = $id AND organization_id = $orgId RETURNING id`
- If the delete returns 0 rows — whether because the type does not exist or belongs to another org — the server returns 403; no distinction is made to avoid leaking tenant information
- Platform-provided types (`organization_id IS NULL`) are excluded by the `AND organization_id = $orgId` condition and cannot be deleted via this endpoint
- If any `custom_points.custom_type_id` references this type, the FK constraint (`REFERENCES custom_point_types (id)`, which defaults to `RESTRICT`) prevents deletion; the server catches the DB constraint violation and returns 409 indicating the type is still in use
- Returns 200 on successful deletion
- Requests with no active org return 400; unauthenticated requests return 401
