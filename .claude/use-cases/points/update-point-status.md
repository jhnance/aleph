---
status: To Do
---

# Update Point Status

An org member transitions a point through its lifecycle: `active` → `deprecated` → `archived`. Status changes are reflected in the catalog UI and health checks.

## Acceptance Criteria

- `PATCH /api/orgs/:orgSlug/points/:id/status` accepts a `status` value; requires an authenticated session with an active org
- Valid target statuses: `deprecated` (from `active` only) and `archived` (from `active` or `deprecated`)
- Backwards transitions are rejected with 400: `deprecated → active` and any transition toward `active` or `deprecated` from `archived` are not permitted
- The point must belong to the current org; `UPDATE points SET status = $status WHERE id = $id AND organization_id = $orgId RETURNING id` — if 0 rows returned, responds 404
- `updated_at` is automatically updated by `trg_set_updated_at_points` on any successful update
- Returns 200 with updated point data (`id`, `status`, `updatedAt`)
- Archived points remain in the database — hard deletion is not supported; the FK chain (`point_versions`, `point_exports`, `use_case_lineages`) makes hard deletion destructive; archival via status is the supported decommission path
- Requires org role `member` or higher — `viewer` is read-only; insufficient role returns 403. The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
