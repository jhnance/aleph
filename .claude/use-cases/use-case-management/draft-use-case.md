---
status: To Do
---

# Draft Use Case

An org member authors a draft use case for a point — either a brand-new use case (no lineage yet) or a new content draft for an existing one (lineage already exists). Drafts are freely editable until published.

## Acceptance Criteria

- `POST /api/points/:pointId/drafts` creates a new draft; accepts `title`, `content`, and an optional `lineageId`; requires an authenticated session with an active org
- `lineageId = null` (or absent) means a brand-new use case; no `use_case_lineages` row needs to exist yet — the lineage is created at publish time
- `lineageId = <uuid>` means a new content draft for an existing use case; the lineage must exist and belong to the same point, enforced by the compound FK `FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id)` on `draft_use_cases`; returns 400 if the lineage belongs to a different point or does not exist in the current org
- Draft is inserted into `draft_use_cases` with `status = 'draft'`
- `PATCH /api/drafts/:draftId` accepts updated `title` and/or `content`; the draft must belong to the current org (via `point_id → points.organization_id`); returns 404 if not found or not accessible
- `GET /api/points/:pointId/drafts` returns all drafts for the point in the current org
- `GET /api/drafts/:draftId` returns a single draft
- `DELETE /api/drafts/:draftId` deletes the draft; the associated point and lineage (if any) are unaffected
- Multiple drafts with the same `lineageId` may coexist — whichever is published first becomes the next head of the lineage
- Org scope for all draft operations is derived from `point_id → points.organization_id`; `organization_id` does not appear as a column on `draft_use_cases`
- Requests with no active org return 400; unauthenticated requests return 401
