---
status: To Do
---

# Create Custom Point Type

An org member creates an org-defined custom point type. The new type is visible only to the owning org. Platform-provided types (`organization_id IS NULL`) are seeded by Aleph and cannot be created via this endpoint.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/custom-point-types` accepts `name`; requires an authenticated session with an active org
- `organization_id` is taken from the session JWT, never the request body
- `name` must be unique within the org (`idx_custom_point_type_name_org`); returns 409 if a type with the same name already exists for this org
- Inserts into `custom_point_types` with `organization_id = current org id`
- Returns 201 with `id`, `name`, `organizationId`, `createdAt`
- Requires org role `admin` or higher — custom point types are org-level resources; insufficient role returns 403. The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
