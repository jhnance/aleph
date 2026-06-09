---
status: To Do
---

# Create Domain

An org member creates a new domain (or sub-domain) within their organization. A sub-domain is created by specifying a parent domain. Slug uniqueness is sibling-scoped. Domain identity is intentionally divorced from team structure.

## Acceptance Criteria

- `POST /api/domains` accepts `name`, `slug`, and an optional `parentId`; requires an authenticated session with an active org
- `slug` must be 1–50 characters and match `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`; returns 400 if invalid
- `organization_id` comes from the session JWT, never the request body
- For root domains (`parentId` absent): `slug` must be unique among all root domains in the org (enforced by `idx_domain_slug_root`); returns 409 if duplicate
- For sub-domains (`parentId` present): `slug` must be unique among siblings — other domains sharing the same `parent_id` within the org (enforced by `idx_domain_slug_child`); returns 409 if duplicate; `slug` uniqueness is sibling-scoped so `Online/Pro` and `Offline/Pro` can coexist, but two `Pro` children under the same parent cannot
- If `parentId` is supplied, the parent domain must exist and belong to the current org; the compound FK `FOREIGN KEY (parent_id, organization_id) REFERENCES domains (id, organization_id)` enforces this at the DB layer; returns 404 if the parent is not found in the current org
- A domain cannot be its own parent (`CHECK (parent_id != id)` on `domains`)
- Returns 201 with domain data: `id`, `name`, `slug`, `parentId` (null if root), `organizationId`, `createdAt`
- Requests with no active org (`org` claim null in JWT) return 400; unauthenticated requests return 401
