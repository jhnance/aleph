---
status: To Do
related:
  - ssr/loader-data-fetching.md
  - ssr/unauthenticated-redirect.md
  - ssr/org-membership-guard.md
  - ssr/server-rendered-html.md
---

# Loader Error Handling

When the Fastify API returns a non-2xx response or the request fails entirely, the SSR loader surfaces a meaningful error page rather than crashing the server or returning a blank response. Auth-specific status codes (401, 403) are handled by redirecting, not by the generic error boundary.

## Acceptance Criteria

- Fastify returns **401** → treated as session expired; SSR redirects to `/login?redirect=<original-url>` (same as `unauthenticated-redirect.md` — the loader delegates to the same redirect path)
- Fastify returns **403** → SSR renders a 403 error page (org membership or permission denied); no org content in the response (see `org-membership-guard.md`)
- Fastify returns **404** → SSR renders a 404 error page
- Fastify returns **5xx** → SSR renders a 500 error page; the Fastify error body is logged server-side but not exposed to the client
- Fetch times out (beyond `API_TIMEOUT_MS`) → SSR renders a 503 error page; logged server-side
- Network error (Fastify unreachable) → SSR renders a 503 error page; logged server-side
- In all error cases, the HTTP status code of the SSR response matches the semantic of the error (401 → 302, 403 → 403, 404 → 404, 5xx/timeout/network → 500 or 503)
- No unhandled promise rejection or uncaught exception escapes the loader — the server process does not crash on a Fastify API failure
- Error page HTML is server-rendered (the error boundary is rendered on the server, not triggered only after hydration)

## Explicitly out of scope

Retry logic. A failed loader request is not retried — it surfaces the error immediately. Retry policy, if ever needed, belongs in the Fastify API layer or a separate resilience layer, not in the SSR loader.
