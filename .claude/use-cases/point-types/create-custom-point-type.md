---
status: To Do
related:
  - point-types/update-custom-point-type.md
  - point-types/delete-custom-point-type.md
  - point-types/list-point-types.md
---

# Create Custom Point Type

An org member creates an org-defined custom point type. The new type is visible only to the owning org. Platform-provided types (`organization_id IS NULL`) are seeded by Aleph and cannot be created via this endpoint.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/custom-point-types` accepts `name`; requires an authenticated session
- `organization_id` is the org resolved from `:orgSlug` (2026-06-11, URL-org-authoritative), never the request body
- `name` must be unique within the org (`idx_custom_point_type_name_org`); returns 409 if a type with the same name already exists for this org
- Inserts into `custom_point_types` with `organization_id = current org id`
- Returns 201 with `id`, `name`, `organizationId`, `createdAt`
- Requires org role `admin` or higher — custom point types are org-level resources; insufficient role returns 403. The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401
