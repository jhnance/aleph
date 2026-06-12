---
status: To Do
related:
  - catalog/point-detail.md
  - catalog/ecosystem-map.md
  - points/update-point-status.md
  - health-checks/evaluate-point-health.md
  - search/search-and-discover.md
---

# Browse Catalog

A user browses their organization's catalog through a persistent **domain-tree sidebar** (with per-domain point counts) and a **main pane** listing the selected domain's points with at-a-glance type, status, and health (2026-06-12 — the file-browser pattern: structure stays visible, points stay scannable, every domain is deep-linkable). This surface serves every discipline — health in particular is an interdisciplinary, ecosystem-wide concern, not a per-persona one. The criteria are written from catalog-*consumer* tasks ("what lives in Checkout?", "which of our components are unhealthy?") rather than publisher tasks, which live in the SDK/CLI flows.

## Acceptance Criteria

### Domain tree

- `GET /api/orgs/:orgSlug/domains` returns all of the org's domains as a flat list — `id`, `name`, `slug`, `parentId`, `activePointCount` — for client-side tree assembly. The whole tree ships in one response: domains are organizational metadata (tens per org, not thousands); revisit only if real data disagrees
- `activePointCount` counts active points directly in the domain; rolled-up subtree counts are computed client-side from the flat list
- Implementation note (2026-06-12): the tree response — counts today, inline health rollups tomorrow — is a good candidate for a **materialized view** (precomputed domain tree + per-domain aggregates, refreshed on point/domain writes or a short schedule), so the sidebar stays one cheap query as aggregates accumulate. Not required at current scale; keep the query behind a single view so the optimization is a swap, not a rewrite
- The SPA deep-links a domain by its **slug path** (e.g. `/orgs/acme/catalog/online/checkout`) — domain slugs are sibling-scoped, so the path from root is the unambiguous human-readable address; the API itself filters by `domainId`
- A fresh org (no domains) shows the onboarding empty state: create a domain, create a point, or run CLI bulk onboarding

### Point list

- `GET /api/orgs/:orgSlug/points` returns points with `id`, `name`, `type`, `status`, `domainId`, `healthy`, `latestVersionSemantic`, `updatedAt`
- Filters: `domainId` (with `includeDescendants=true` to cover the domain's subtree), `type`, `status`; **default `status=active`** — deprecated and archived points are reachable through the same list via the status filter (one list, one filter — no separate listing view) and render with status badges when included
- `q` is a simple name-contains convenience filter; typo-tolerant cross-entity search is Search and Discover (Meilisearch) — this endpoint stays plain SQL
- Sort: `name` ascending by default; `updatedAt` available
- Keyset pagination (`cursor` + `limit`, default 50): stable under concurrent inserts, no drifting offsets
- `healthy` is the bulk boolean from Evaluate Point Health, computed inline on the read
- A domain with no points shows a create-a-point nudge scoped to that domain
- Requires org role `viewer` or higher (the whole read path is all-roles); the `:orgSlug` must be one of the session user's orgs — non-membership returns 404 (tenant-hiding, per-request membership check); unauthenticated requests return 401

## Pinned for discussion (2026-06-12)

How never-published points (zero versions) appear in this view. Joshua: "We probably shouldn't list no-version points in this view. Or they should go in a separate section for Unreleased (maybe that's a special, separate domain in its own right)." This tensions with the one-list-one-filter decision above ("no separate listing view"). Candidate shapes: (a) excluded by default behind an `unreleased` filter — consistent with the status-filter approach; (b) an Unreleased section or pseudo-domain in the sidebar; (c) hidden entirely until first publish. Also decide whether "unreleased" is derived state (version count = 0) or a point status. Independent of the outcome, the Point Detail page renders a no-version point when navigated to directly — a point you just created must not 404.
