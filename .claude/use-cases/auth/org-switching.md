---
status: To Do
---

# Org Switching

An authenticated user views their org memberships, selects a target org, and switches their active organization. The server re-issues the JWT with the updated `active_organization_id` and replaces the cookie. No re-authentication required.

## Acceptance Criteria

- **Step 1 — List orgs:** `GET /api/auth/orgs` returns the list of organizations the authenticated user belongs to, each with `id`, `name`, `slug`, and the user's `role` in that org; this endpoint powers the org-switcher UI
- **Step 2 — Switch:** `POST /api/auth/switch-org` accepts an `organizationId` in the request body
- Server queries `organization_memberships` for a row where `user_id = current user` and `organization_id = requested org`; returns 403 if no such row exists
- Server re-issues a new HS256 JWT with `org` = target org id; all other claims are freshly generated (`sub` unchanged, new `iat`, new `exp` = now() + 30 days, new `jti`)
- The new JWT replaces the existing `HttpOnly` cookie
- Returns 200 with the user's membership record for the target org (`userId`, `organizationId`, `role`)
- Both endpoints require an authenticated session (valid JWT cookie); unauthenticated requests return 401
