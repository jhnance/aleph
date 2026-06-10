---
status: Stub
related:
  - catalog/browse-catalog.md
  - catalog/point-detail.md
  - connections/view-connections.md
---

# Ecosystem Map

**Stub — created 2026-06-10 from the design review.** ALIGNMENT.md's opening promise ("a navigable map of their organization's ecosystem") had no corresponding use case. To be designed in an upcoming session.

A user views a graph visualization of their org's ecosystem: points as nodes, connections as edges, navigable by domain.

## Scope sketch

- Data source: `connections` (version→version) aggregated to point level for the default view — the **latest version represents the point** (decided 2026-06-10, same rollup as `point-detail.md`)
- Likely needs a dedicated graph endpoint (`GET /api/orgs/:orgSlug/map?domain=...`) returning nodes + edges in one response rather than N calls to `view-connections`
- Scope control: org-wide graphs get unreadable fast — domain-scoped views and depth limits from a focal point are probably the MVP shape
- This is a headline feature; even a modest first version (domain-scoped, direct edges only) beats none

## Open questions

- Rendering approach (force-directed vs. layered/dagre) — defer to implementation, but the response shape should not preclude either
- Do `other`-type connections render differently from `dependency` edges?
