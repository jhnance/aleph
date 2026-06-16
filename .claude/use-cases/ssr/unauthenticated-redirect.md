---
status: To Do
related:
  - ssr/org-membership-guard.md
  - ssr/login-page.md
  - auth/magic-link-sign-in.md
  - auth/logout.md
---

# Unauthenticated Redirect

A request to any protected route without a valid session cookie is redirected to `/login` before any HTML is rendered. The client never receives bytes it isn't authorized to see.

Protected routes are all routes except `/login` and the magic link callback (`/auth/verify`).

## Acceptance Criteria

- GET to a protected route with no session cookie → 302 to `/login?redirect=<encoded-original-url>`
- GET to a protected route with an expired JWT → 302 to `/login?redirect=<encoded-original-url>`
- GET to a protected route with a JWT signed by a wrong secret → 302 to `/login?redirect=<encoded-original-url>`
- GET to a protected route with a structurally malformed cookie value → 302 to `/login?redirect=<encoded-original-url>`
- In all redirect cases, the response body is empty — no HTML is rendered before the redirect
- The `redirect` query parameter is URL-encoded and round-trips cleanly through the login flow so the user lands on their original destination after signing in
- A valid, unexpired JWT with a correct signature → the redirect does not fire; the loader proceeds to render

## Access Matrix

| Session state | Route | Result |
|---|---|---|
| No cookie | Any protected route | 302 → `/login?redirect=<url>` |
| Expired JWT | Any protected route | 302 → `/login?redirect=<url>` |
| Invalid JWT signature | Any protected route | 302 → `/login?redirect=<url>` |
| Malformed cookie | Any protected route | 302 → `/login?redirect=<url>` |
| Valid JWT | Any protected route | Loader proceeds (no redirect) |
| Any state | `/login` | No redirect fired here (see login-page.md) |

**Invariant:** A valid session JWT is a necessary precondition for any org-scoped HTML reaching the client.

**Attacker angle:** An attacker who forges a JWT (wrong secret) or replays an expired one is redirected identically to an unauthenticated user — no distinguishing information is leaked in the redirect response. JWT verification happens in the SSR loader before any org data is queried; Fastify is never called for an invalid session at this layer.

## References

- [Authentication with React Router v7 — LogRocket](https://blog.logrocket.com/authentication-react-router-v7/) — confirms redirects from loaders execute before the route component renders
- [Authenticated loaders — remix-run/react-router Discussion #9327](https://github.com/remix-run/react-router/discussions/9327) — documents that a parent loader redirect does not prevent child loaders from running; auth checks must be per-route
