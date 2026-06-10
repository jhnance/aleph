---
status: Stub
related:
  - catalog/point-detail.md
  - use-case-management/publish-use-case.md
  - sdk-cli/aleph-new-use-case.md
  - versioning/view-version-history.md
---

# View Use Case

**Stub — created 2026-06-10 from the design review.** Demo artifacts get a column, a build pipeline, and an upload flow — but had no viewing surface. To be designed in an upcoming session.

A user views a use case: its title, content, the export it's scoped to (if any), which versions it appears in, its edit history, and — when a demo artifact exists — plays the demo.

## Scope sketch

- `GET /api/orgs/:orgSlug/use-cases/:useCaseId` (or lineage-addressed — decide which identity this page hangs off; lineage is the stable one)
- Demo playback: `demo_artifact_url` points to an S3-hosted HTML/JS/CSS bundle with MSW handlers baked in — embedding/sandboxing model needed (iframe + CSP is the obvious starting point)
- Edit history display: walk `parent_id` ancestry / group by `lineage_id` — presented as "edit history", not "lineage"
- Demo absence is intended to be a **draft-only** state: moving a use case out of draft should force a version + demo association, so a published use case always has a playable demo. (Working position 2026-06-10 — must be reconciled with forward-propagated rows not copying demos, and with the UI draft→publish flow having no demo build path today; see the publish-knot session.) The draft view is where the "no demo yet" affordance and the `aleph new use-case --id=<id>` scaffold instruction live

## Open questions

- Cross-version diff view of a use case's content (the lineage join was designed for this) — in scope for the first pass?
