---
status: To Do
---

# Edit Use Case

An org member edits a published use case. Because `use_cases` records are immutable, an edit creates a new draft pre-populated from the existing content, with `lineage_id` pointing to the existing lineage. The standard publish flow then applies.

## Acceptance Criteria

- `POST /api/use-cases/:useCaseId/edit` creates a new `draft_use_cases` row pre-populated with the existing use case's `title` and `content`, and `lineage_id` set to the use case's `lineage_id`
- The `use_cases` record must belong to the current org; returns 404 if not found or inaccessible
- Returns 201 with the new draft's `id`, `lineageId`, `title`, `content`, `status` (`'draft'`)
- The resulting draft behaves identically to any other draft with a non-null `lineage_id`: it can be updated (`PATCH /api/drafts/:draftId`), published (`POST /api/drafts/:draftId/publish`), or deleted without affecting the published record
- At publish time, the new `use_cases` row carries `parent_id` pointing to the most recent content record in the lineage at the time of publish (the head at publish time, which may differ from the record that initiated the edit if another edit was published in the interim)
- Multiple in-flight edits to the same use case are permitted — multiple `draft_use_cases` rows may share the same `lineageId`; whichever is published first becomes the new head; subsequent ones record `parent_id` pointing to whichever head existed at their publish time
- Requests with no active org return 400; unauthenticated requests return 401
