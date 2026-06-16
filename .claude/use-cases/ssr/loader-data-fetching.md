---
status: To Do
related:
  - ssr/server-rendered-html.md
  - ssr/loader-error-handling.md
  - ssr/unauthenticated-redirect.md
---

# Loader Data Fetching

A route loader calls the Fastify API over HTTP to fetch the data it needs, then passes that data to the route component. The component renders with the data present in the initial HTML response — no client-side fetch is required for the initial paint.

The session cookie is forwarded to Fastify on every loader request so Fastify can authenticate and tenant-scope the query.

## Acceptance Criteria

- The loader issues an HTTP request to the Fastify API at the address configured in `API_URL` (environment variable); the server does not start if `API_URL` is absent or malformed
- The `Cookie` header from the incoming browser request is forwarded verbatim to Fastify — the session JWT travels server-to-server without being read or rewritten by the SSR layer
- The loader awaits the Fastify response before rendering; the component receives the deserialized JSON as typed loader data
- The rendered HTML includes the fetched data — a browser with JS disabled still sees the content (progressive enhancement baseline)
- Loader fetch requests carry a reasonable timeout (configurable via `API_TIMEOUT_MS`, default 10 s); a timed-out request is treated as a 503 by the error handler (see `loader-error-handling.md`)
- The Fastify API URL is never exposed in client-side HTML or JS bundles — it is a server-only environment variable

## Pattern lineage

This is the Backend for Frontend (BFF) pattern: the SSR server is a trusted rendering intermediary that delegates all auth and business logic to the Fastify API. The SSR server never reads or transforms the session credential — it forwards the cookie verbatim. Fastify is the auth authority; the SSR layer trusts Fastify's response codes (401/403) to gate what gets rendered. Both services run in the same backend network, so the forwarding trust assumption is bounded. See [Sam Newman's BFF pattern](https://samnewman.io/patterns/architectural/bff/).

## Note on client-side navigation

React Router v7's `clientLoader` allows subsequent in-app navigations to fetch data client-side (or from a client cache) rather than re-running the server loader. This is a per-route optimization to add when implementing individual routes — it does not change the SSR contract for initial page loads or direct URL visits, which always run the server loader.

## References

- [Sam Newman — Backends for Frontends](https://samnewman.io/patterns/architectural/bff/) — origin of the BFF pattern; basis for the SSR-as-rendering-intermediary architecture
- [Auth0 — The Backend for Frontend Pattern](https://auth0.com/blog/the-backend-for-frontend-pattern-bff/) — BFF proxies requests to the API, embedding credentials before forwarding; the SSR layer never exposes auth material to the client
- [React Router docs — Client Data (`clientLoader`)](https://reactrouter.com/how-to/client-data) — `clientLoader` runs on client-side navigations; server `loader` runs on initial/direct loads
- [React Router docs — Data Loading](https://reactrouter.com/start/framework/data-loading) — `loader` / `clientLoader` split; SSR data contract
- [Ryan Florence — clientLoader + React Query pairing](https://x.com/ryanflorence/status/1860845297590776278) — recommended pattern for client-side caching on top of SSR loaders
- [LocalStorage vs Cookies — DEV Community](https://dev.to/cotter/localstorage-vs-cookies-all-you-need-to-know-about-storing-jwt-tokens-securely-in-the-front-end-15id) — OWASP guidance against long-lived tokens in localStorage; basis for HttpOnly cookie forwarding over token-in-header
