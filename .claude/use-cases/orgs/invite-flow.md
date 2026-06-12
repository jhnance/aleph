---
status: To Do
related:
  - auth/magic-link-sign-in.md
  - auth/org-switching.md
  - orgs/create-organization.md
---

# Invite Flow

An org admin invites a person by email to join their organization with a chosen role. Membership is **consent-gated** (2026-06-12): the invitation is a pending record, and the membership row is created only when the invitee accepts — either by clicking the invite link (which also signs them in; in a magic-link system, email ownership *is* identity, so the invite email reuses the auth machinery wholesale) or by accepting from the org-selection screen while signed in. Domain auto-join (anyone@company.com self-joins) is deferred post-MVP.

## Data model

The membership row is created only at acceptance — a pending invitation grants nothing. The token is the same shape as a magic link: 32 random bytes, SHA-256 stored, single-use via atomic redemption. Rows are never deleted: `accepted_at` / `revoked_at` are tombstones (audit trail), mirroring `auth_codes`. (`data-model.md` carries the canonical DDL listing; the detail is colocated here.)

```sql
CREATE TABLE org_invitations
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    email           TEXT        NOT NULL,
    role            org_role    NOT NULL DEFAULT 'member' CHECK (role <> 'owner'),
    invited_by      UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    code_hash       TEXT        NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_org_invitation_code_hash ON org_invitations (code_hash);
CREATE INDEX idx_org_invitation_email ON org_invitations (email);
CREATE INDEX idx_org_invitation_organization_id ON org_invitations (organization_id);
-- At most one live invitation per (org, email). Resend revokes-and-recreates inside
-- one transaction, so the constraint holds at every commit point.
CREATE UNIQUE INDEX idx_org_invitation_live ON org_invitations (organization_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;
```

A near-immutability trigger mirrors `point_version_use_cases`: every column except `accepted_at` and `revoked_at` is frozen after insert (resend creates a fresh row rather than refreshing a token in place).

### RLS policies

The table straddles all three planes: admins manage invitations inside an org context; an authenticated invitee lists and accepts invitations bound to their email in orgs they are — by definition — not yet members of (no org context applies); and invite-link redemption runs unauthenticated, exactly like magic-link redemption. One `USING` branch per plane. The redemption branch is capability-keyed: the auth module sets `app.invite_code_hash` to the presented token's hash inside the redemption transaction, making exactly that row visible to it.

```sql
CREATE POLICY invitations_select ON org_invitations FOR SELECT
    USING (organization_id = current_setting('app.current_org_id', true)::uuid
        OR email = (SELECT email FROM users WHERE id = current_setting('app.current_user_id', true)::uuid)
        OR code_hash = current_setting('app.invite_code_hash', true));

CREATE POLICY invitations_insert ON org_invitations FOR INSERT
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY invitations_update ON org_invitations FOR UPDATE
    USING (organization_id = current_setting('app.current_org_id', true)::uuid
        OR email = (SELECT email FROM users WHERE id = current_setting('app.current_user_id', true)::uuid)
        OR code_hash = current_setting('app.invite_code_hash', true))
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid
        OR email = (SELECT email FROM users WHERE id = current_setting('app.current_user_id', true)::uuid)
        OR code_hash = current_setting('app.invite_code_hash', true));
-- No DELETE policy: rows are never deleted — default deny.
```

(`users` is RLS-exempt, so the email subquery cannot recurse.)

Access matrix (session vars `app.current_user_id = U` with email E, `app.current_org_id = A`, `app.invite_code_hash = H` set only inside the redemption transaction):

| Command | Row in org A | Row with email E | Row with code_hash H | Other rows |
|---------|--------------|------------------|----------------------|------------|
| SELECT  | visible (admin list) | visible (my pending invites) | visible (redemption) | filtered |
| INSERT  | allowed (admin+ enforced app-layer) | — | — | denied |
| UPDATE  | allowed (revoke/resend; admin+ app-layer) | allowed (accept) | allowed (redemption) | denied |
| DELETE  | denied (no policy) | denied | denied | denied |

Column discipline (which flow may set which tombstone) is app-layer, as role checks are — RLS bounds *which rows* each plane can touch, the trigger bounds *which columns* anyone can.

## Acceptance Criteria

### Creating and managing (admin plane)

- `POST /api/orgs/:orgSlug/invitations` accepts `{ email, role }`; requires org role `admin` or higher; `role` ∈ `viewer | member | admin` (`owner` is not invitable — ownership transfer is a separate future concern); insufficient role returns 403
- Server generates a 32-byte token (`crypto.randomBytes(32)`), stores its SHA-256 as `code_hash`, sets `expires_at = now() + 7 days`; the invite email (org name, inviter, accept link `/api/auth/invite?token=<hex>`) is sent **after the transaction commits** (transaction-scoping rule); a failed send leaves a pending row the admin can resend
- The success response is identical whether or not the email already has an Aleph account (anti-enumeration). Inviting an existing **member of this org** returns 409 `already_member` — not an enumeration leak, since admins can already list their own members
- A live invitation already pending for (org, email) returns 409 `invitation_pending` (backstopped by the partial unique index)
- Invitation creation is rate-limited per org and per target email — like magic-link requests, this is otherwise an email-bombing vector; throttled requests still return the uniform success response
- `GET /api/orgs/:orgSlug/invitations` (admin+) lists invitations with status derived, not stored: `pending` / `accepted` / `revoked` / `expired`
- `POST /api/orgs/:orgSlug/invitations/:id/resend` (admin+) revokes the pending row and creates a fresh one (new token, new expiry) in a single transaction
- `POST /api/orgs/:orgSlug/invitations/:id/revoke` (admin+) sets `revoked_at`; revoking an already-accepted invitation returns 409 (the membership exists; removing a member is a separate flow); invitation rows are never deleted

### Accepting (invitee plane)

- `GET /api/auth/invite?token=<hex>` — unauthenticated, single-use, atomic, mirroring magic-link redemption. In one transaction: set `app.invite_code_hash` to the token's SHA-256, then
  ```sql
  UPDATE org_invitations SET accepted_at = now()
  WHERE code_hash = $hash AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  RETURNING organization_id, email, role
  ```
  (0 rows → 400, with no distinction between used, expired, and revoked); upsert the `users` row for the invitation's email; `set_config('app.current_user_id', ...)`; insert the membership with the invitation's role (`ON CONFLICT DO NOTHING` — an already-member invitee just signs in); issue the standard identity-only JWT cookie; redirect to the org's landing page
- Clicking an invite link signs the browser in as the *invitation's* email, replacing any existing session cookie — the same semantics as clicking any magic link
- `GET /api/auth/invitations` — authenticated; returns pending, unexpired invitations bound to the session user's email (`org name`, `slug`, `role`, inviter); powers the org-selection and create-organization screens ("Acme invited you — join?")
- `POST /api/auth/invitations/:id/accept` — authenticated; the row's email must match the session user's email (RLS email branch + app guard) and the invitation must be pending and unexpired (409 otherwise); sets `accepted_at` and inserts the membership in one transaction. The insert passes the memberships policy's user-id branch (`user_id` = current user) — no policy change needed
- Acceptance is per-invitation and explicit; nothing auto-converts at sign-in

### Post-acceptance

- The new member's access flows entirely through the per-request membership check; the invitation row plays no further role beyond audit trail

## Notes (2026-06-12)

- Revoking before acceptance is fully effective — no membership exists yet. After acceptance, revocation of *access* is member removal (future member-management flow) and binds on the next request via the per-request membership check
- Two simultaneous clicks of the same invite link: the atomic `UPDATE ... RETURNING` admits exactly one redemption, same as magic links
- The same email may hold pending invitations from multiple orgs (the live-invitation uniqueness is per-org)
