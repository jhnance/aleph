---
status: To Do
related:
  - ssr/unauthenticated-redirect.md
  - ssr/loader-data-fetching.md
---

# Server-Rendered HTML

A GET request to any route returns fully server-rendered HTML — not a bare `<div id="root">`. React renders the component tree on the server before the response is sent; the client receives meaningful markup and hydrates it without a full re-render.

## Acceptance Criteria

- GET to any route returns HTTP 200 with `Content-Type: text/html`
- The response HTML contains rendered React component output — `<div id="root">` is never empty in the initial response
- The response includes `<script>` tags pointing to the hydration bundle so the client can take over after load
- The client hydrates without React hydration mismatch errors (server and client render the same tree on initial load)
- If a route component throws during SSR, the error is caught and the route-level error boundary is rendered server-side — the server does not crash and does not return a 500 with an empty body
- Static assets (JS bundles, CSS) are served from the SSR server under a stable path (e.g. `/assets/...`)
