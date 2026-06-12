---
status: To Do
related:
  - point-types/create-custom-point-type.md
  - point-types/update-custom-point-type.md
---

# Delete Custom Point Type

An org member deletes an org-defined custom point type. Ownership is enforced. Deletion is blocked if any point still references the type.

## Acceptance Criteria

- `DELETE /api/orgs/:orgSlug/custom-point-types/:id` requires an authenticated session
- `organization_id` is the org resolved from `:orgSlug` (2026-06-11, URL-org-authoritative)
- The delete executes: `DELETE FROM custom_point_types WHERE id = $id AND organization_id = $orgId RETURNING id`
- If the delete returns 0 rows — whether because the type does not exist or belongs to another org — the server returns 404; no distinction is made to avoid leaking tenant information (404 is the tenant-hiding convention, decided 2026-06-10; 403 is reserved for authorization denials)
- Platform-provided types (`organization_id IS NULL`) are excluded by the `AND organization_id = $orgId` condition and cannot be deleted via this endpoint
- If any `custom_points.custom_type_id` references this type, the FK constraint (`REFERENCES custom_point_types (id)`, which defaults to `RESTRICT`) prevents deletion; the server catches the DB constraint violation and returns 409 indicating the type is still in use
- Returns 200 on successful deletion
- Requires org role `admin` or higher — custom point types are org-level resources; insufficient role returns 403. The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401
