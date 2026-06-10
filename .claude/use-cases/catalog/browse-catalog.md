---
status: Stub
related:
  - catalog/point-detail.md
  - points/update-point-status.md
  - health-checks/evaluate-point-health.md
---

# Browse Catalog

**Stub — created 2026-06-10 from the design review.** The read path had no spec despite being the product's core promise ("a navigable map of their organization's ecosystem"). To be designed in an upcoming session.

A user browses their organization's catalog: the domain tree (root domains and nested sub-domains) and the points within each domain, with at-a-glance status and health.

The main listing shows **active** points only — deprecated and archived points do not appear in it (they may be available in a separate listing view).

## Scope sketch

- `GET /api/orgs/:orgSlug/domains` — the domain tree (or flat list with `parentId`s for client-side assembly)
- `GET /api/orgs/:orgSlug/points` — already referenced by `evaluate-point-health.md` (bulk `healthy` flag); needs first-class definition here: filtering by domain, type, status; pagination; sort
- Empty states matter: a fresh org sees no domains/points — this screen is where the onboarding nudge (create a domain, create a point, or run bulk onboarding) lives
- This is the primary surface for the PM/designer personas — acceptance criteria should be written from their tasks, not engineer tasks

## Open questions

- Domain tree depth/size limits for one response?
- Does the catalog default to a domain-tree view or a flat point list with domain facets?
