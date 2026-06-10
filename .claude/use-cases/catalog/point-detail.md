---
status: Stub
related:
  - catalog/browse-catalog.md
  - catalog/view-use-case.md
  - versioning/view-version-history.md
  - connections/view-connections.md
  - health-checks/evaluate-point-health.md
---

# Point Detail

**Stub — created 2026-06-10 from the design review.** No use case existed for the page a user lands on after finding a point. To be designed in an upcoming session.

A user views a single point: its identity (name, type, domain, status, health), latest version summary, use cases, exports, props (for `frontend_component`), and connections.

## Scope sketch

- `GET /api/orgs/:orgSlug/points/:id` — the aggregate read endpoint; composes data already defined piecemeal in `view-version-history.md`, `component-props-manifest.md`, `view-connections.md`, `evaluate-point-health.md`
- Point-level connection rollup: **the latest version represents the point** (decided 2026-06-10) — "this point's dependencies" are the latest version's outgoing connections
- Default manifests: the page shows the **latest `release`-classification version** by default (decided 2026-06-10); other versions reachable via version history
- User-facing vocabulary: "edit history", not "lineage" — internal machinery shouldn't leak here

## Open questions

- Fallback when no `release` version exists yet (only prereleases/hotfixes): latest by semantic ordering?
