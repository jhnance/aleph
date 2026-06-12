---
status: To Do
related:
  - auth/magic-link-sign-in.md
  - sdk-cli/aleph-config.md
---

# CLI Authentication

The CLI authenticates against the Aleph API before any operation that requires it. Supports token-based auth via environment variable or a user-level credentials file, and runs a browser-based device-authorization flow in the terminal when no token is present.

## Acceptance Criteria

- The CLI checks for a token in the following order: `ALEPH_TOKEN` environment variable, then a user-level credentials file at `~/.aleph/credentials`
- If a token is found, it is used as a Bearer token on all API requests; a 401 response causes the CLI to exit non-zero with a message instructing the user to re-authenticate. The CLI token is an HS256 identity JWT (`sub`/`exp`/`iat`/`jti`, 2026-06-11) with a longer lifetime than the web cookie (90 days); the API auth layer accepts it via `Authorization: Bearer` exactly as it accepts the cookie JWT
- If no token is found and the process is attached to a TTY, the CLI runs the **device-authorization flow** (a magic link cannot return a token to the CLI — `GET /api/auth/verify` mints an `HttpOnly` cookie the CLI can't read — so the CLI needs its own grant):
  - `POST /api/auth/cli/start` with the user's email returns `{ deviceCode, interval, expiresIn }` (`interval` = poll seconds, default 5; `expiresIn` = 900). Like `POST /api/auth/magic-link` it is rate-limited and always returns 200 (anti-enumeration), and it emails the user a normal magic link. Server-side: one `auth_codes` row carries both `code_hash` (the emailed token) and `device_code_hash` (SHA-256 of the 32-byte `deviceCode` handed to the CLI)
  - The user clicks the emailed link in a browser; `GET /api/auth/verify` redeems the row as today (stamps `used_at`, upserts the user, sets the web cookie). No change to verify — stamping `used_at` *is* the device approval signal
  - The CLI polls `POST /api/auth/cli/token` with `{ deviceCode }` every `interval` seconds. While the row's `used_at` is null → 400 `{ error: 'authorization_pending' }`; if the row is gone/expired → 400 `{ error: 'expired_token' }`; polling faster than `interval` → 400 `{ error: 'slow_down' }`. Once `used_at` is set and `device_consumed_at` is null, the server mints a CLI identity JWT for the row's user, stamps `device_consumed_at` (single-use — the `deviceCode` can't re-mint), and returns 200 `{ token }`
  - On success the CLI writes the token to `~/.aleph/credentials` and proceeds
- If no token is found and the process is NOT attached to a TTY (CI environment), the CLI exits non-zero with a clear message instructing the user to set `ALEPH_TOKEN`
- The credentials file is created with `chmod 600` permissions (owner read/write only)
- The org context comes from the locally declared `org` slug — API requests target `/api/orgs/:orgSlug/...` and the server resolves it to an org + role via the per-request slug⋈membership query (2026-06-11, URL-org-authoritative; tokens carry no org claim). There is **no CLI org-switch command and no "active org" state** — a user in multiple orgs publishes against whichever org their `aleph.config.ts` declares; to act in a different org, change `org` in the config (or switch project directories). Whether `org` lives in `aleph.config.ts` or is CLI-populated into `aleph.lock` is pinned (see `aleph-config.md` open questions); if it is missing, the CLI exits non-zero pointing at where to declare it

## Open — device-flow approval intent (security, raised 2026-06-12)

The flow above stamps device approval **silently** on magic-link click, which opens an **account-takeover** vector: an attacker calls `cli/start` with the *victim's* email, phishes the victim into clicking the link they receive, and the attacker's polling CLI mints a token for the victim's account. This is strictly worse than the accepted magic-link login-CSRF risk (which only signs a victim into the *attacker's* account). Before this use case leaves To Do, decide the mitigation — the RFC 8628 answer is a short `user_code` returned by `cli/start`, displayed by the CLI, and confirmed by the human on the verification page so approval binds to *this* device with explicit intent (the emailed link lands on an "approve CLI access? [code]" screen rather than auto-approving). Needs a dedicated beat with the access-matrix treatment (ALIGNMENT.md convention); not resolved in the 6.6 walkthrough.
