---
status: To Do
related:
  - point-types/create-custom-point-type.md
  - points/create-point.md
---

# List Point Types

An org member views the available point types and frontend frameworks when creating or editing a point. Returns platform-provided entries (`organization_id IS NULL`) and org-defined entries (`organization_id = current org`), ordered platform-first.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/point-types` returns a combined response containing:
  - The fixed base type discriminators available for creating a point: `frontend_component` and `custom` (from the `point_type` enum)
  - All `custom_point_types` rows where `organization_id IS NULL` OR `organization_id = current org`, ordered platform-provided first, then org-defined, each group sorted alphabetically by `name`
  - All `frontend_frameworks` rows with the same scoping and ordering
- `organization_id` for filtering org-defined entries is the org resolved from `:orgSlug` (2026-06-11, URL-org-authoritative)
- Platform-provided entries (`organization_id IS NULL`) are always included regardless of the requesting org
- The response is shaped so the client can render the create-point flow: pick a base type → if `frontend_component`, pick a framework (optional); if `custom`, pick a custom type (required)
- The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401
