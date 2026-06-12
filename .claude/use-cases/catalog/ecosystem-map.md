---
status: To Do
related:
  - catalog/browse-catalog.md
  - catalog/point-detail.md
  - connections/view-connections.md
---

# Ecosystem Map

A user views a graph of a **domain's** points and the connections between them: points as nodes, point-level connection rollups as edges. MVP scope is domain-scoped only (2026-06-12); the org-wide graph and a focal-point "neighborhood" view (N hops out from one point) are deferred as additive views over the same response shape.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/map?domainId=<id>` returns the whole graph in one response (never N calls to View Connections):

```json
{
  "nodes": [
    { "pointId": "...", "name": "...", "type": "...", "status": "active",
      "healthy": true, "domainId": "...", "inDomain": true }
  ],
  "edges": [
    { "fromPointId": "...", "toPointId": "...", "type": "dependency",
      "fromVersionId": "...", "toVersionId": "..." }
  ]
}
```

- **Node set**: the domain's (and its descendant domains') active points, plus **boundary nodes** — points outside the domain that in-domain points connect to directly, marked `inDomain: false` and rendered distinctly. Cross-boundary edges are where the map earns its keep ("Checkout depends on three things owned by Platform")
- **Edge derivation**: each in-domain point is represented by its representative version (latest release, same fallback rule as Point Detail); its outgoing connections resolve `to_version` → owning point; parallel edges collapse to one per `(fromPointId, toPointId, type)`, carrying the underlying version ids for tooltips/drill-in
- `dependency` edges render directed; other connection types are visually distinct (legend); the response is plain node/edge lists so neither force-directed nor layered (dagre) rendering is precluded — rendering choice is an implementation decision
- Deprecated/archived points are excluded (they're excluded from the default browse list for the same reason); revisit with a status param if a real need appears
- The response includes `nodeCount`/`edgeCount`; an empty domain renders the map empty state with a create/onboarding nudge
- Clicking a node navigates to Point Detail; clicking a boundary node navigates to its point (which may live in another domain — that's fine, points are org-visible)
- Requires org role `viewer` or higher; 404 tenant-hiding; unauthenticated requests return 401

## Deferred (2026-06-12)

- Org-wide graph (needs clustering/zoom to stay readable) and focal-point neighborhood view — both consume the same `nodes`/`edges` shape
- In-map filtering (by type, health) — client-side over the same response when it comes
