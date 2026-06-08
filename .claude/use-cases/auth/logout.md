---
status: To Do
---

# Logout

An authenticated user logs out. The JWT cookie is deleted via a server endpoint. No server-side token revocation — the token remains technically valid until `exp` but the client no longer holds it. A future `revoked_tokens` table can add forced revocation for exceptional cases.

## Acceptance Criteria

- `POST /api/auth/logout` is a dedicated server-side endpoint because the JWT is stored in an `HttpOnly` cookie — JavaScript cannot read or delete `HttpOnly` cookies, so the client cannot clear it without a server round-trip
- The response clears the JWT cookie by setting it to an empty value with `Max-Age=0` and `Expires` in the past
- No database writes occur — there is no session record to delete and no token to revoke
- Returns 200 regardless of whether the incoming request carries a valid session cookie (idempotent — clearing a non-existent cookie is a no-op; avoids a flash of 401 when logging out from multiple tabs)
- The previously issued JWT remains cryptographically valid until its `exp` but will not be resent by the client once the cookie is cleared
