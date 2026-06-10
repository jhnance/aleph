---
status: To Do
---

# Search and Discover

A user performs a typo-tolerant full-text search across their organization's ecosystem — points, domains, and use cases — via self-hosted Meilisearch.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/search?q=<query>` returns results across points, domains, and use cases within the current org; requires an authenticated session with an active org
- Search is powered by self-hosted Meilisearch; the backend proxies the query to Meilisearch with an org-scoping filter applied
- **Org isolation:** Meilisearch documents include `organization_id` as a filterable attribute; every query is issued with `filter: "organization_id = <current_org_id>"`, ensuring documents from other orgs are never returned
- Results are typo-tolerant and relevance-ranked using Meilisearch defaults
- Each result includes: `entityType` (`point` | `domain` | `use_case`), `id`, a display name (point `name`, domain `name`, or use case `title`), and a short content excerpt with matched terms highlighted
- **Index synchronization:** Meilisearch documents are kept in sync via event-driven upserts — when a point, domain, or use case is created or updated, the document is upserted; when a point is archived or a use case is removed from all versions, its document is removed
- Only published use cases (rows in `use_cases`) are indexed; `draft_use_cases` are not searchable
- The specific faceting options, additional filter parameters (by entity type, by domain, by point status), and UX affordances (autocomplete, result grouping, pagination) are to be designed when this use case is implemented
- Returns 200 with `{ results: [...], query: string, totalHits: number }`
- The `:orgSlug` must match the session's active org; mismatch returns 403 (`org_context_mismatch`). Requests with no active org return 400; unauthenticated requests return 401
