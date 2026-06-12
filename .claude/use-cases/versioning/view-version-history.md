---
status: To Do
related:
  - versioning/publish-point-version.md
  - catalog/point-detail.md
  - catalog/view-use-case.md
---

# View Version History

A user views the full version history of a point — all published versions in monotonic order, with their status, use case manifest, and export manifest. Supports cross-version diffing of use cases via lineage.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/points/:id/versions` returns all `point_versions` rows for the point, ordered by `version_monotonic ASC` (server-side ordering; the array order *is* the chronological order the client renders)
- Each version in the response includes: `id`, `versionSemantic`, `status`, `createdAt`. `version_monotonic` is the internal ordering tiebreaker and is **not** surfaced in the payload (2026-06-12) — the client relies on array order, not the integer; cross-version diffing keys on `lineageId`, not monotonic
- Each version includes its **export manifest**: the list of exports active in that version (from `point_version_exports` → `point_exports`), each with `id`, `name`, and `predecessorExportId` (if applicable)
- Each version includes its **use case manifest**: the list of use cases linked to that version (from `point_version_use_cases` → `use_cases` → `use_case_lineages`), each with `id`, `title`, `lineageId`, and `exportId` (the export the lineage is scoped to, or null for point-level use cases)
- The `lineageId` on each use case enables cross-version diffing in the client: the client can group use case records by lineage to identify which ones persisted across versions, which were added, and which were removed
- The point must belong to the current org; returns 404 if not found
- Returns an empty `versions` array if the point has no published versions yet
- The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401
