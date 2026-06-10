---
status: To Do
---

# Evaluate Point Health

The system evaluates whether a point meets catalog completeness criteria and surfaces the result in the UI. A point that fails any criterion is flagged as incomplete.

## Acceptance Criteria

- A point is considered healthy if it satisfies all of the following invariants:
  1. It has at least one published version (any `point_versions` row for the point)
  2. Every published version has at least one associated use case (any `point_version_use_cases` row for that version)
  3. If the point has any exports across any version (any `point_version_exports` row for the point's versions), every distinct export has at least one `use_case_lineages` row with `export_id = export.id`
- `GET /api/orgs/:orgSlug/points/:id/health` returns a health report: `{ healthy: boolean, violations: [{ rule: string, detail: string }] }`; `violations` lists each failed criterion with a human-readable description; on a healthy point, `violations` is an empty array (NOTE: the boolean model and violation shape are being revisited in `health-score.md` — health scores, structured `versionId`/`exportId` references on violations, and the demo-artifact criterion from `decisions/2026-06-09.md`)
- The health report is computed on-demand and reflects the current state of the point at request time; it is not stored or cached
- The bulk catalog endpoint (`GET /api/orgs/:orgSlug/points`) includes a computed `healthy: boolean` field on each point summary to enable at-a-glance health status in the catalog view; this computation runs in bulk (e.g. via a single query with aggregates) to avoid N+1 queries
- Additional health criteria (description completeness, test coverage, export-to-use-case ratio) are out of scope for this phase; the invariants above are the complete set for now
- The point must belong to the current org; returns 404 if not found
- The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
