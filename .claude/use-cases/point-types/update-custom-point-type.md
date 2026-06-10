---
status: To Do
---

# Update Custom Point Type

An org member renames an org-defined custom point type. Ownership and existence are collapsed into a single query — no information about whether the id exists under another tenant is leaked.

## Acceptance Criteria

- `PATCH /api/orgs/:orgSlug/custom-point-types/:id` accepts `name`; requires an authenticated session with an active org
- `organization_id` is taken from the session JWT
- The update executes: `UPDATE custom_point_types SET name = $name WHERE id = $id AND organization_id = $orgId RETURNING id`
- If the update returns 0 rows — whether because the type does not exist or belongs to another org — the server returns 404; no distinction is made between the two cases to avoid leaking tenant information (404 is the tenant-hiding convention, decided 2026-06-10; 403 is reserved for authorization denials)
- Platform-provided types (`organization_id IS NULL`) are excluded by the `AND organization_id = $orgId` condition and cannot be updated via this endpoint
- `name` must be unique within the org (`idx_custom_point_type_name_org`); returns 409 if a type with the same name already exists for this org
- `updated_at` is automatically updated by `trg_set_updated_at_custom_point_types`
- Returns 200 with `id`, `name`, `organizationId`, `updatedAt`
- Requires org role `admin` or higher — custom point types are org-level resources; insufficient role returns 403. The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
