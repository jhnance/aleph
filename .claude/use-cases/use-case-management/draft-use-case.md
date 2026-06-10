---
status: To Do
---

# Draft Use Case

An org member authors a draft use case for a point — either a brand-new use case (no lineage yet) or a new content draft for an existing one (lineage already exists). Drafts are freely editable until published.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/points/:pointId/drafts` creates a new draft; accepts `title`, `content`, and an optional `lineageId`; requires an authenticated session with an active org
- `lineageId = null` (or absent) means a brand-new use case; no `use_case_lineages` row needs to exist yet — the lineage is created at publish time
- `lineageId = <uuid>` means a new content draft for an existing use case; the lineage must exist and belong to the same point, enforced by the compound FK `FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id)` on `draft_use_cases`; returns 400 if the lineage belongs to a different point or does not exist in the current org
- Draft is inserted into `draft_use_cases` with `status = 'draft'`
- `PATCH /api/orgs/:orgSlug/drafts/:draftId` accepts updated `title` and/or `content`; the draft must belong to the current org (direct `organization_id` column check); returns 404 if not found or not accessible
- `GET /api/orgs/:orgSlug/points/:pointId/drafts` returns all drafts for the point in the current org
- `GET /api/orgs/:orgSlug/drafts/:draftId` returns a single draft
- `DELETE /api/orgs/:orgSlug/drafts/:draftId` deletes the draft; the associated point and lineage (if any) are unaffected
- Multiple drafts with the same `lineageId` may coexist — whichever is published first becomes the next head of the lineage
- `organization_id` is denormalized onto `draft_use_cases` (with the compound FK to `points (id, organization_id)`), matching the RLS pattern on every other downstream table — drafts are tenant-scoped *and* mutable, so they need a direct-column RLS policy more than any immutable table does (decided 2026-06-10)
- Requires org role `member` or higher — `viewer` is read-only; insufficient role returns 403. The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
