---
status: Stub
related:
  - versioning/publish-point-version.md
  - domains/domain-contacts.md
---

# Release Tollgate

**Stub — created 2026-06-15.** Before a `prerelease` version can be promoted to `release`, one or more designated owners must explicitly approve it. This is a gating mechanism to prevent unreviewed code from reaching the release classification.

## Scope sketch

- A point version with `version_classification = 'prerelease'` may require approval before it can be re-classified as `'release'`
- Approval is granted by users with an elevated role on the point (via `point_roles`) or by org admins/owners
- The data model for approval records, the promotion endpoint, and the notification/request flow are all undesigned

## Open questions

- Does every prerelease require a tollgate, or is it opt-in per point or per org?
- How many approvals are required — one, a quorum, all owners?
- What triggers a request for approval — is it an explicit API call, or automatic on prerelease publish?
- Does this interact with domain contacts in any way (e.g., contacts are notified when a prerelease is awaiting promotion)?
- Promotion likely needs its own endpoint (`POST /versions/:id/promote`) rather than reusing the publish flow — confirm
