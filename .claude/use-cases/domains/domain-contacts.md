---
status: To Do
related:
  - domains/create-domain.md
  - orgs/invite-flow.md
---

# Domain Contacts

Org admins designate org members as points of contact for a domain — the people others should go to with questions about that product space. Contacts are a directory/people concept, not a permissions concept: they carry no additional access beyond their org role. Assignment is explicit per domain and does not cascade to subdomains.

## Acceptance Criteria

### Add a contact

- `POST /api/orgs/:orgSlug/domains/:domainId/contacts` accepts `userId`; requires an authenticated session
- The target user must be a member of the current org; returns 404 if not found in the org
- The domain must belong to the current org; returns 404 if not found
- A user may not be added twice to the same domain (`PRIMARY KEY (user_id, domain_id)` enforces this); returns 409 if already a contact
- Returns 201 with `{ userId, domainId, createdAt }`
- Requires org role `admin` or `owner`; insufficient role returns 403. Unauthenticated requests return 401

### Remove a contact

- `DELETE /api/orgs/:orgSlug/domains/:domainId/contacts/:userId`; requires an authenticated session
- Returns 404 if the user is not currently a contact of that domain
- Returns 204 on success
- Requires org role `admin` or `owner`, or the user removing themselves; insufficient role returns 403. Unauthenticated requests return 401

### List contacts

- `GET /api/orgs/:orgSlug/domains/:domainId/contacts`; requires an authenticated session
- Returns 200 with an array of `{ userId, email, createdAt }` for all contacts of the domain, ordered by `created_at ASC`
- An empty array is a valid response (no contacts assigned)
- Requires org role `viewer` or higher (any org member). Unauthenticated requests return 401
