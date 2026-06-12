# Open security questions and design decisions

Dated decision detail lives in `.claude/decisions/`; this file is the standing index of
security-relevant postures, accepted risks, and open questions.

## Key decisions

**Login CSRF: accepted residual risk (2026-06-11)** — An attacker can top-level-navigate a victim's
browser through the attacker's *own* magic link, silently signing the victim into the attacker's
account. Classic CSRF is closed (`SameSite=Lax` + no state-changing GETs under cookie authority +
`Origin`/JSON content-type checks on mutating routes — see `design/data-model.md`, *Session cookie
attributes and CSRF*), but login CSRF rides a top-level GET navigation, which `Lax` permits by
design. Accepted because the payoff against a catalog tool is negligible and the standard mitigation
(CSRF-protecting the login itself) fights the magic-link UX. Under the alternative password design
below, this risk would be cheaply mitigable — the acceptance is specific to magic links.

**URL org authoritative; per-request membership check; identity-only JWT (2026-06-11)** — The JWT
slimmed to `sub`/`exp`/`iat`/`jti`; the former `org` claim is gone. `/api/orgs/:orgSlug/...`
resolves the slug and verifies membership in one indexed query riding the request's transaction
(returning org id + role; no row → 404, tenant-hiding). This closes the **30-day
membership-revocation gap** entirely — removal, and role demotion, bind on the next request — and
fixes multi-tab org use and deep links structurally. The membership check is **never cached**;
caching reopens the gap. Residual: *user-level* revocation (compromised or banned account) still
rides the 30-day token — escape hatches are the `jti`-keyed `revoked_tokens` table (designed, not
built) and JWT-secret rotation (global logout).

## Alternative auth design: password-based ("normal") auth

Reference point for what the system would look like without magic links, and therefore what the
magic-link choice costs and buys. Kept current as the auth design evolves.

**Unchanged — the session layer.** Auth method and session transport are independent layers, and the
entire session design carries over untouched: HS256 JWT (30-day expiry, `sub`/`org`/`jti` claims),
`HttpOnly; Secure; SameSite=Lax; Path=/` cookie, signature-only verification with no per-request DB
lookup, org switching via JWT re-issue, and the whole CSRF posture above.

**Changed:**

- **Password storage.** `users` gains `password_hash`, hashed with **argon2id** (per the
  [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html);
  bcrypt is the acceptable fallback). The "SHA-256 is fine" argument used for magic-link tokens does
  *not* carry over: it rests entirely on the token's 256 bits of entropy, and passwords are
  low-entropy by nature — they need a deliberately slow, salted hash.
- **Endpoints.** `POST /api/auth/signup` and `POST /api/auth/login` (verify hash, issue the same JWT
  cookie) replace the magic-link pair. A separate signup re-introduces **email enumeration** ("this
  email is already registered"), which the magic-link design eliminates structurally; getting it
  back requires uniform responses plus a confirmation-email step — more machinery to recover a
  property magic links give for free.
- **Brute force and credential stuffing.** Login needs per-account and per-IP rate limiting, and
  password policy per [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html): length over
  composition rules, and screening candidate passwords against known-breached lists.
- **Forgot-password flow — still required, and it *is* a magic link.** An emailed single-use token,
  an `auth_codes`-shaped table, the same atomic hash-keyed redemption, the same expiry and
  rate-limiting concerns. Password auth adds password machinery on top of the token flow; it does
  not remove the token flow.
- **Login CSRF — cheaply mitigable here.** Login becomes a first-party POST form, so a standard
  pre-session CSRF token (server-issued or double-submit cookie, per the
  [OWASP CSRF cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html))
  fits naturally and fights no UX. This is the one place the alternative design is strictly
  stronger.

**Net:** password auth mitigates one negligible risk (login CSRF) and charges for it with password
storage liability, two additional flows (signup, reset), enumeration mitigations, and
stuffing/brute-force defenses — while still needing the emailed-token machinery for reset. That
asymmetry is why magic links are the chosen design.

## Open questions

None currently (2026-06-11 — the URL-org-authority / revocation-gap question above was the last; resolved in the Phase 3 security session).
