---
status: To Do
related:
  - auth/magic-link-sign-in.md
  - orgs/create-organization.md
---

# Org Switching

An authenticated user views their org memberships and switches org by navigating to the target org's URL. There is no server-side switch step (2026-06-11): the JWT carries identity only, the URL names the org, and every org-scoped request verifies membership — so "switching" is client-side navigation, multiple tabs can sit on different orgs simultaneously, and a revoked membership stops working on the next request.

## Acceptance Criteria

- `GET /api/auth/orgs` returns the list of organizations the authenticated user belongs to, each with `id`, `name`, `slug`, and the user's `role` in that org; this endpoint powers the org-switcher UI (scoped by the user-keyed RLS policies on `organizations` / `organization_memberships`)
- Selecting an org in the switcher navigates to that org's landing page (`/orgs/:orgSlug`); no auth endpoint is called and no cookie changes
- Org-scoped API requests resolve the URL slug and verify membership in a single indexed query (slug → org id + the user's role), inside the request's transaction; no membership row → 404 (tenant-hiding: non-member and nonexistent are indistinguishable)
- The membership check is never cached — caching would reopen the revocation gap the per-request check closes
- Requires an authenticated session (valid JWT cookie); unauthenticated requests return 401
