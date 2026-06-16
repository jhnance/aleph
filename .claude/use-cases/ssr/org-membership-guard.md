---
status: To Do
related:
  - ssr/unauthenticated-redirect.md
  - ssr/loader-error-handling.md
  - auth/org-switching.md
  - orgs/invite-flow.md
---

# Org Membership Guard

A request to an org-scoped route (`/orgs/:orgSlug/...`) where the authenticated user is not a member of that org is rejected before any org data is rendered. Authentication is a precondition (covered by `unauthenticated-redirect.md`); this use case covers the next gate: authorization to the specific org.

The membership check is delegated to Fastify — the SSR loader calls the API, and a 403 response from Fastify causes the SSR layer to render a 403 error page, not the requested route.

## Acceptance Criteria

- GET to `/orgs/:orgSlug/...` where the user is authenticated and a member → loader proceeds to render
- GET to `/orgs/:orgSlug/...` where the user is authenticated but not a member of that org → Fastify returns 403; SSR renders a 403 error page (not a redirect to login — the user is authenticated, just unauthorized for this org)
- GET to `/orgs/:orgSlug/...` where the org slug does not exist → Fastify returns 404; SSR renders a 404 error page
- In the 403 and 404 cases, no org content is included in the response HTML
- The 403 page does not expose whether the org exists — a non-member cannot distinguish "org exists, you're not a member" from "org does not exist" via the UI (though HTTP status codes differ, the rendered page copy is neutral)

## Access Matrix

| Actor | Org exists | User is member | Result |
|---|---|---|---|
| Authenticated user | Yes | Yes | 200 — loader renders route |
| Authenticated user | Yes | No | 403 — error page, no org content |
| Authenticated user | No | N/A | 404 — error page |
| Unauthenticated | Any | N/A | 302 → `/login` (unauthenticated-redirect.md) |

**Invariant:** Org-scoped HTML is only rendered for users whose membership is confirmed by Fastify on this request. A stale session from a previous org visit does not grant access — membership is checked on every loader invocation.

**Attacker angle:** An attacker who guesses an org slug and holds a valid session for a different org receives a 403 (if the org exists) or 404. The rendered page copy is identical in both cases, preventing org enumeration via the web layer. The HTTP status codes are distinct — if org-existence confidentiality becomes a requirement, both cases should return 404.

## References

- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — "you become the isolation layer, and every bug that drops tenant_id becomes a data leak"; basis for enforcing membership server-side before every render rather than relying on client-side checks
