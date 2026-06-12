---
status: To Do
related:
  - versioning/publish-point-version.md
  - catalog/point-detail.md
  - catalog/view-use-case.md
---

# Unpublish Use Case from Version

Retracts a use case claim from a specific published point version, without deleting anything. Decided 2026-06-10, resolving the long-open `removeUseCaseFromVersion` question.

The rationale: pre-publish rigor is what makes the catalog trustworthy, but people make mistakes even with preparation and the best intentions. The compromise is an **unpublish** step — never a hard deletion. You can't go back in time and change what a version's code does, so the attachment row (the historical fact that this was published) is permanent; what's revocable is its *visibility* as a current claim. Unpublished attachments remain visible to org admins in a dedicated view and can be republished at any time.

The cascade question that blocked this flow is gone: server-side forward propagation no longer exists (2026-06-10), every attachment row is created deliberately by a publish payload, and unpublishing affects exactly one (version, use case) row. Keeping the use case off *future* versions is the codebase's job — remove the `.aleph.ts` and confirm via `aleph scan`.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/versions/:versionId/use-cases/:lineageId/unpublish` sets `unpublished_at = now()` on the matching `point_version_use_cases` row; 404 if the version or attachment is not found in the current org; 409 if already unpublished
- `POST /api/orgs/:orgSlug/versions/:versionId/use-cases/:lineageId/republish` resets `unpublished_at` to NULL; 409 if not currently unpublished
- The attachment row is never deleted; only `unpublished_at` changes (enforced by the `point_version_use_cases` near-immutability trigger)
- Unpublished attachments are excluded from the version's use case list in all default read paths (point detail, view use case, search indexing)
- Org `admin`+ can list a version's unpublished attachments in a dedicated view (`GET .../versions/:versionId/use-cases?include=unpublished`) and can republish; the dedicated view is not visible to `member`/`viewer`
- Unpublish requires org role `member` or higher (catalog write); republish requires `admin`+ (it acts on a surface only admins can see). `viewer` is read-only; insufficient role returns 403. The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401

## Open

- UI presentation of an unpublished attachment to admins: a "deprecated/unpublished" badge inline on the version page vs. fully hidden behind the dedicated view (Joshua left both acceptable, 2026-06-10)
- "Owners of the Point" as a republish audience — Point-level ownership doesn't exist in the data model (roles are org-scoped); specced as org `admin`+ for now, point ownership is a future concept
- Pairing feature (TODO recorded in `catalog/point-detail.md`): owner-authored, public-facing version notes, so an unpublish can be explained to users who remember the old list ("we unpublished it because our documentation was incorrect — see <other version>")
