---
status: To Do
---

# View Version History

A user views the full version history of a point — all published versions in monotonic order, with their status, use case manifest, and export manifest. Supports cross-version diffing of use cases via lineage.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/points/:id/versions` returns all `point_versions` rows for the point, ordered by `version_monotonic ASC`
- Each version in the response includes: `id`, `versionSemantic`, `versionMonotonic`, `status`, `createdAt`
- Each version includes its **export manifest**: the list of exports active in that version (from `point_version_exports` → `point_exports`), each with `id`, `name`, and `predecessorExportId` (if applicable)
- Each version includes its **use case manifest**: the list of use cases linked to that version (from `point_version_use_cases` → `use_cases` → `use_case_lineages`), each with `id`, `title`, `lineageId`, and `exportId` (the export the lineage is scoped to, or null for point-level use cases)
- The `lineageId` on each use case enables cross-version diffing in the client: the client can group use case records by lineage to identify which ones persisted across versions, which were added, and which were removed
- The point must belong to the current org; returns 404 if not found
- Returns an empty `versions` array if the point has no published versions yet
- The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
