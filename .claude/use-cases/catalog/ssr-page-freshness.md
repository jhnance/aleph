---
status: Stub
related:
  - catalog/view-use-case.md
  - catalog/point-detail.md
  - use-case-management/publish-use-case.md
---

# SSR Page Freshness

**Stub — created 2026-06-14.** When a use case's title or content is updated (via Publish Use Case), users who load the affected catalog page should receive the new HTML — not a version their browser cached from a prior visit. This is a serving-layer concern: the API and data model are covered by `publish-use-case.md`; this stub covers what happens at the HTTP boundary.

## Scope sketch

- Catalog pages that render use case content (point detail, view-use-case) are SSR — the server renders HTML per request. The browser will cache that HTML if the response permits it.
- The right default for these pages is `Cache-Control: no-cache` (always revalidate) + an `ETag` derived from the content: the browser caches the response locally but sends a conditional request (`If-None-Match`) on every revisit. The server returns `304 Not Modified` when nothing changed (cheap — no body), or `200` with fresh HTML when the content record changed.
- If a CDN sits in front of the SSR server, a programmatic cache purge for the affected URL(s) must be triggered on publish — browser revalidation reaches the CDN, not the origin, and the CDN has its own cached copy.

## Open questions

- **ETag source:** hash of the head `use_cases.id` (stable per content record, cheap to compute without rendering) vs. hash of the rendered HTML (accurate but expensive)?
- **CDN purge scope:** which URLs need purging when a use case is published? At minimum: the lineage-addressed use-case page and any point-version pages that carry that lineage. Purging by cache tag (e.g., `lineage:<id>`) is cleaner than enumerating URLs — does the chosen CDN support surrogate key / cache tag purges?
- **CDN vs. no CDN at launch:** if the SSR server is exposed directly (no CDN), `no-cache` + ETag is sufficient and no purge infrastructure is needed.
