---
status: To Do
related:
  - catalog/view-use-case.md
  - catalog/point-detail.md
  - use-case-management/publish-use-case.md
  - ssr/loader-data-fetching.md
---

# SSR Page Freshness

Catalog pages that render use case content (`point-detail`, `view-use-case`) send HTTP cache headers that allow browsers and CDNs to cache the response locally while guaranteeing the cached copy is revalidated on every revisit. When content changes (a use case is published), the next request returns fresh HTML rather than a stale cached version.

The strategy: `Cache-Control: no-cache` + an `ETag` derived from the page's primary content IDs. The browser caches the response but sends a conditional request (`If-None-Match`) on every revisit. The server returns `304 Not Modified` when nothing changed (no body, cheap), or `200` with fresh HTML when the content has changed.

No CDN sits in front of the SSR server at launch, so no CDN purge infrastructure is needed at this stage.

## Acceptance Criteria

- Responses for `point-detail` and `view-use-case` routes include `Cache-Control: no-cache`
- Responses include an `ETag` header computed as follows:
  - **`view-use-case`:** SHA-256 of the head `use_cases.id` for the requested lineage (the current published content record). Stable across re-renders of the same content, cheap to compute without rendering.
  - **`point-detail`:** SHA-256 of the representative version ID concatenated with the sorted list of its use case attachment IDs. Changes whenever the representative version changes or its use case set changes.
- A conditional GET with `If-None-Match: <etag>` where the ETag matches the current computed value → 304 with no body
- A conditional GET with `If-None-Match: <etag>` where the ETag does not match (content changed since the cached copy) → 200 with freshly rendered HTML and an updated `ETag`
- A GET with no `If-None-Match` header → 200 with HTML and `ETag` (normal first-visit flow)
- The ETag is computed from content IDs before rendering — the full React render is not triggered for a 304 response
- No CDN purge logic at launch; if a CDN is introduced later, cache-tag–based purge (keyed on lineage ID) is the preferred extension point

## Scaling note

`Cache-Control: no-cache` means the browser sends a revalidation request on every revisit — the server still receives every HTTP request. What this strategy buys: no response body on a 304 (bandwidth), and no full React render when the ETag matches (render cost, since the ETag is computed from content IDs before rendering begins). It does not reduce request volume.

Request-volume reduction requires a CDN with a TTL and a publish-triggered purge: the CDN serves cached HTML until a publish event fires a surrogate-key purge for the affected lineage, then the next request reaches the origin and repopulates the cache. That is the extension point noted above — not a concern at launch.

## References

- [Nuxt SEO — Rendering Modes: Hybrid, SSR, SSG](https://nuxtseo.com/learn-seo/vue/routes-and-rendering/rendering) — documents the stale content tradeoff in hybrid rendering; basis for preferring `no-cache` + ETag over a TTL that risks serving stale catalog pages after publish

## Rationale for content-ID ETag (over rendered-HTML hash)

Hashing the rendered HTML would be accurate but requires a full render before knowing whether to 304 — defeating most of the efficiency gain. Content IDs are stable per published record and available from a single lightweight query, making them cheap to compute and sufficient to detect any content change that would affect the rendered output.
