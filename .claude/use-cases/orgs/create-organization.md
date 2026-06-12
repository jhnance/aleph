---
status: To Do
---

# Create Organization

An authenticated user creates a new organization. The creating user is automatically assigned the `owner` role. The new org is immediately available for switching to. An opt-in flag auto-switches the session to the new org.

## Acceptance Criteria

- `POST /api/orgs` accepts `name`, `slug`, and an optional boolean `switchToOrg` (default: false); requires an authenticated session (no org context needed — this is the one org-related route outside the `/api/orgs/:orgSlug/` scope, alongside `/api/auth/*`)
- `slug` must be 1–50 characters and match `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`; returns 400 with a validation error if invalid
- `slug` must be unique across all organizations (`UNIQUE (slug)` on `organizations`); returns 409 if already taken
- Within a single transaction: inserts into `organizations`, then inserts into `organization_memberships` with `role = 'owner'` for the creating user
- Returns 201 with the new org's data (`id`, `name`, `slug`, `createdAt`) and the user's membership record (`userId`, `organizationId`, `role`)
- If `switchToOrg: true`, the server additionally re-issues the JWT with `org` = new org id and replaces the `HttpOnly` cookie in the response — no separate `POST /auth/switch-org` call is needed
- If `switchToOrg` is false or absent, the JWT is unchanged; the user remains on their current active org (or `org = null` if they had none)
- Unauthenticated requests return 401
