---
status: To Do
---

# Magic Link Sign-In

A user submits their email and receives a magic link. Clicking the link authenticates them with a session JWT set in an HttpOnly cookie. There is intentionally no separate sign-up flow — first-time sign-in creates the user record automatically. If the user belongs to exactly one org, the JWT is issued with that org active; otherwise the org claim is null and the user selects an org after sign-in.

## Acceptance Criteria

- `POST /api/auth/magic-link` accepts an email address; returns 200 regardless of whether the email is registered
  - Returning the same response for known and unknown emails prevents **email enumeration**: if the server returned a different error for unregistered emails, an attacker could probe the endpoint to discover which email addresses have accounts
- Server generates a cryptographically random 32-byte token (`crypto.randomBytes(32)`), SHA-256 hashes it (`crypto.createHash('sha256')`), and inserts a row into `auth_codes` with `email`, `code_hash`, and `expires_at = now() + 15 minutes`; `used_at` is null
- Server sends a magic link email to the submitted address containing the plaintext token as a URL query parameter (e.g. `/api/auth/verify?token=<hex>`)
- `GET /api/auth/verify?token=<token>` hashes the received token and within a single transaction executes:
  ```sql
  UPDATE auth_codes
  SET used_at = now()
  WHERE code_hash = $hash AND used_at IS NULL AND expires_at > now()
  RETURNING id
  ```
  This is **atomic single-use enforcement**: the check ("is this code valid and unused?") and the consumption ("mark it used") happen in one statement. If they were split into a SELECT then a separate UPDATE, two concurrent requests could both read `used_at IS NULL` before either writes, allowing the same link to be redeemed twice.
- If the UPDATE returns 0 rows, the server returns 400; no distinction is made between an expired code and an already-used one
  - This prevents **timing leakage**: if the server returned different errors for expired vs. used codes, an attacker who obtained a link could determine whether it had already been clicked by someone else, leaking authentication timing information
- If the UPDATE succeeds, the server runs `INSERT INTO users (email) VALUES ($email) ON CONFLICT (email) DO NOTHING` and fetches the `users.id` for that email
  - This intentional upsert means first-time and returning sign-in are the same code path. There is no separate sign-up endpoint — submitting an email for the first time is the act of registration. A separate registration flow would require returning different errors for known vs. unknown emails, re-introducing the enumeration risk above. Any user who can receive email to that address is implicitly authorized to create an account.
- Server queries `SELECT organization_id FROM organization_memberships WHERE user_id = $userId`; if exactly one row is returned, that org's id is used as the `org` claim in the JWT; if zero or multiple rows are returned, `org` = null
- Server issues a signed HS256 JWT with claims: `sub` = user_id, `org` = (resolved above), `exp` = now() + 30 days, `iat` = now(), `jti` = random UUID; written as an `HttpOnly` cookie
- Post-authentication redirect behavior:
  - `org` non-null (exactly one membership): redirect directly to that org's landing page
  - `org` null with multiple memberships: redirect to the org-selection screen; user picks via the org-switching flow
  - `org` null with no memberships: redirect to the create-organization screen
- `auth_codes` rows are never deleted; `used_at` is the tombstone
  - Immediate deletion on redemption would erase the authentication audit trail. Garbage collection of expired rows (rows where `expires_at` is in the past) can be handled by a periodic background job without affecting correctness.
- `POST /api/auth/magic-link` is rate-limited at the API layer — per email (e.g. max 3 link requests per 15-minute window) and per IP; throttled requests still return 200 with no email sent, preserving the anti-enumeration property above (added 2026-06-10 — without this, the endpoint is an unthrottled email-bombing vector)
- Each call to `POST /api/auth/magic-link` creates an independent `auth_codes` row; outstanding rows for the same email are not invalidated when a new one is requested. Each row is independently valid until its own `expires_at` elapses or it is stamped with `used_at`. If a user requests multiple links and clicks more than one, each click creates a new session (overwriting the cookie); in practice only one is used since the cookie is replaced each time.
