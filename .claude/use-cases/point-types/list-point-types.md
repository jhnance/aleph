---
status: To Do
---

# List Point Types

An org member views the available point types and frontend frameworks when creating or editing a point. Returns platform-provided entries (`organization_id IS NULL`) and org-defined entries (`organization_id = current org`), ordered platform-first.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/point-types` returns a combined response containing:
  - The fixed base type discriminators available for creating a point: `frontend_component` and `custom` (from the `point_type` enum)
  - All `custom_point_types` rows where `organization_id IS NULL` OR `organization_id = current org`, ordered platform-provided first, then org-defined, each group sorted alphabetically by `name`
  - All `frontend_frameworks` rows with the same scoping and ordering
- `organization_id` for filtering org-defined entries is taken from the session JWT
- Platform-provided entries (`organization_id IS NULL`) are always included regardless of the requesting org
- The response is shaped so the client can render the create-point flow: pick a base type → if `frontend_component`, pick a framework (optional); if `custom`, pick a custom type (required)
- The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
