---
status: To Do
related:
  - orgs/invite-flow.md
  - auth/org-switching.md
  - domains/create-domain.md
---

# Create Organization

An authenticated user creates a new organization. The creating user is automatically assigned the `owner` role and can navigate into the new org immediately.

## Acceptance Criteria

- `POST /api/orgs` accepts `name` and `slug`; requires an authenticated session (no org context needed — this is the one org-related route outside the `/api/orgs/:orgSlug/` scope, alongside `/api/auth/*`)
- `slug` must be 1–50 characters and match `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`; returns 400 with a validation error if invalid
- `slug` must be unique across all organizations (`UNIQUE (slug)` on `organizations`); returns 409 if already taken
- Within a single transaction: inserts into `organizations`, then inserts into `organization_memberships` with `role = 'owner'` for the creating user
- Returns 201 with the new org's data (`id`, `name`, `slug`, `createdAt`) and the user's membership record (`userId`, `organizationId`, `role`)
- Entering the new org is pure client navigation to `/orgs/:slug/...` (2026-06-11, URL-org-authoritative); there is no JWT re-issue and no switch-org call — the `owner` membership just created is what the per-request slug⋈membership check reads. The 201 `slug` is the redirect target
- Unauthenticated requests return 401

## Open — first-domain bootstrap (raised 2026-06-12 review)

A freshly created org has zero domains, but a Point can't exist without a domain to live in (`points.domain_id` is required) — so an empty org is a dead end until the owner creates a domain. Decide whether `POST /api/orgs` seeds a default domain (e.g. a `"General"` / `"Uncategorized"` root) in the same transaction, or whether the post-create flow simply routes the owner into "create your first domain." Leaning toward not auto-seeding (domains are meant to be deliberate product areas, not org-structure boilerplate), but it needs deciding alongside `create-domain.md`.
