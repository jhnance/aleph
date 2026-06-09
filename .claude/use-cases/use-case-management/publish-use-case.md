---
status: To Do
---

# Publish Use Case

A draft use case is promoted to an immutable `use_cases` record and linked to a point version via `point_version_use_cases`. If the draft had no lineage, a new `use_case_lineages` row is created first. The draft is deleted on successful publish.

## Acceptance Criteria

- `POST /api/drafts/:draftId/publish` accepts a `pointVersionId` and, if the draft has `lineageId = null`, an optional `exportId`; requires an authenticated session with an active org
- The `pointVersionId` must belong to the same point as the draft; returns 400 if mismatched or not found in the current org
- **New use case (`lineageId IS NULL`):** if the point has any version with at least one export (any `point_version_exports` row across the point's versions), `exportId` is required in the request — returns 400 if absent, because the export-scoping trigger on `use_case_lineages` would reject a null `export_id`; if the point has no exports, `export_id = null` is correct; a new `use_case_lineages` row is then inserted
- **Revision (`lineageId IS NOT NULL`):** the existing `use_case_lineages` row is used; no new lineage is created; `exportId` is ignored
- `parent_id` for the new `use_cases` row is the most recently created `use_cases` row for the same lineage (the current head); if no prior content record exists for this lineage, `parent_id = null`
- A `use_cases` row is inserted with `lineage_id`, `point_id` (from lineage), `organization_id` (from lineage), `parent_id` (resolved above), `title` and `content` from the draft; `use_cases` records are immutable after insertion (enforced by `trg_use_cases_immutable`)
- A `point_version_use_cases` row is inserted linking the new `use_cases` record to `pointVersionId`; both must belong to the same point (enforced by compound FKs)
- The `draft_use_cases` row is deleted
- The entire operation is atomic — if any step fails, the transaction rolls back and the draft is preserved
- Returns 201 with the new use case: `id`, `lineageId`, `title`, `content`, `parentId`, `createdAt`
- Requests with no active org return 400; unauthenticated requests return 401
