---
status: To Do
---

# Publish Use Case

A draft use case is promoted to an immutable `use_cases` record and linked to a point version via `point_version_use_cases`. If the draft had no lineage, a new `use_case_lineages` row is created first. The draft is deleted on successful publish.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/drafts/:draftId/publish` accepts a `pointVersionId` and, if the draft has `lineageId = null`, an optional `exportId`; requires an authenticated session with an active org
- The `pointVersionId` must belong to the same point as the draft; returns 400 if mismatched or not found in the current org
- **New use case (`lineageId IS NULL`):** `exportId` is always optional — `export_id = null` creates a point-level use case, valid for any point regardless of whether it has exports (per `decisions/2026-06-08.md`; the old point-level export-scoping trigger no longer exists); if `exportId` is provided, the export must belong to the same point (compound FK) and be present in `pointVersionId`'s export manifest — the version-level trigger `trg_check_version_use_case_export_presence` rejects the association otherwise, surfaced as a 400; a new `use_case_lineages` row is then inserted
- **Revision (`lineageId IS NOT NULL`):** the existing `use_case_lineages` row is used; no new lineage is created; `exportId` is ignored
- `parent_id` for the new `use_cases` row is the most recently created `use_cases` row for the same lineage (the current head); if no prior content record exists for this lineage, `parent_id = null`
- A `use_cases` row is inserted with `lineage_id`, `point_id` (from lineage), `organization_id` (from lineage), `parent_id` (resolved above), `title` and `content` from the draft; `use_cases` records are immutable after insertion (enforced by `trg_use_cases_immutable`)
- A `point_version_use_cases` row is inserted linking the new `use_cases` record to `pointVersionId`; both must belong to the same point (enforced by compound FKs)
- The `draft_use_cases` row is deleted
- The entire operation is atomic — if any step fails, the transaction rolls back and the draft is preserved
- Returns 201 with the new use case: `id`, `lineageId`, `title`, `content`, `parentId`, `createdAt`
- Requires org role `member` or higher — `viewer` is read-only; insufficient role returns 403. The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401

## Notes / open (2026-06-10)

- **Adding use cases after the fact must be supported.** A version will sometimes ship without its use cases (it shouldn't, but it will happen) — this flow already targets any existing `pointVersionId`, which covers the text-only association. What has no path yet: attaching a *demo artifact* to an already-published version (`point_version_use_cases` rows are immutable and written at version publish). To be designed alongside the publish payload work — and reconciled with the working position that publishing out of draft should *require* a version + demo association.
