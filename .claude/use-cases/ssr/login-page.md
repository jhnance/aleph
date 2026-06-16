---
status: To Do
related:
  - ssr/unauthenticated-redirect.md
  - auth/magic-link-sign-in.md
  - orgs/create-organization.md
---

# Login Page

`/login` is accessible without a session cookie and renders the magic link sign-in form. An already-authenticated user who visits `/login` is redirected away — they have nothing to do here.

The redirect destination for an authenticated user mirrors the post-sign-in redirect logic defined in `auth/magic-link-sign-in.md`: one org → org landing page; multiple orgs → org picker; no orgs → create-org screen.

## Acceptance Criteria

- GET `/login` without a session cookie → 200, renders the magic link form
- GET `/login` with a valid session cookie → redirect (302) to the appropriate destination:
  - Exactly one org membership → that org's landing page
  - Multiple org memberships → org picker screen
  - No org memberships → create-organization screen
- GET `/login?redirect=<url>` with a valid session → redirect to the `redirect` param value after resolving the org destination (the `redirect` param takes precedence over the default org-based redirect when present and safe)
- The `redirect` param is validated before use: it must be a relative path on this origin — absolute URLs and other-origin URLs are ignored and the default org destination is used instead (open-redirect mitigation)
- The page is rendered server-side — the form HTML is present in the initial response, not injected client-side
