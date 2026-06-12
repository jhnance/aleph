---
status: To Do
related:
  - points/create-point.md
  - catalog/browse-catalog.md
---

# Create Domain

An org member creates a new domain (or sub-domain) within their organization. A sub-domain is created by specifying a parent domain. Slug uniqueness is sibling-scoped. Domain identity is intentionally divorced from team structure.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/domains` accepts `name`, `slug`, and an optional `parentId`; requires an authenticated session
- `slug` must be 1–50 characters and match `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`; returns 400 if invalid
- `organization_id` is the org resolved from `:orgSlug` (2026-06-11, URL-org-authoritative), never the request body
- For root domains (`parentId` absent): `slug` must be unique among all root domains in the org (enforced by `idx_domain_slug_root`); returns 409 if duplicate
- For sub-domains (`parentId` present): `slug` must be unique among siblings — other domains sharing the same `parent_id` within the org (enforced by `idx_domain_slug_child`); returns 409 if duplicate; `slug` uniqueness is sibling-scoped so `Online/Pro` and `Offline/Pro` can coexist, but two `Pro` children under the same parent cannot
- If `parentId` is supplied, the parent domain must exist and belong to the current org; the compound FK `FOREIGN KEY (parent_id, organization_id) REFERENCES domains (id, organization_id)` enforces this at the DB layer; returns 404 if the parent is not found in the current org
- A domain cannot be its own parent (`CHECK (parent_id != id)` on `domains`)
- Returns 201 with domain data: `id`, `name`, `slug`, `parentId` (null if root), `organizationId`, `createdAt`
- Requires org role `member` or higher — `viewer` is read-only; insufficient role returns 403. The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401

## Out of scope (deferred 2026-06-12, checklist 6.4)

Domains are **create-only** for MVP — there is deliberately no rename, re-parent, or archive flow yet. Each carries a real design cost worth handling as its own use case when needed: **re-parent** moves a domain across slug-uniqueness scopes (`idx_domain_slug_root` ↔ `idx_domain_slug_child`) and can collide with an existing sibling slug; **archive** needs cascade semantics for the points the domain contains (mirror the point `active → deprecated → archived` lifecycle, or block on non-empty?); **rename** is the cheapest but still needs to decide whether the slug (which deep links address) is mutable. Recorded as a decision rather than left implicit. See `decisions/2026-06-12.md`.
