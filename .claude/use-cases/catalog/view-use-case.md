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
- Every version attachment has a demo (`demo_artifact_url` NOT NULL, decided 2026-06-10) — the "no demo" state exists only for use cases not yet attached to any version (drafts, and lineages awaiting their first CLI publish). That pre-attachment view is where the "no demo yet" affordance and the `aleph new use-case --id=<id>` scaffold instruction live
- "Which versions it appears in" excludes unpublished attachments (`unpublished_at` set) in default views — see `use-case-management/remove-use-case-from-version.md`

## Open questions

- Cross-version diff view of a use case's content (the lineage join was designed for this) — in scope for the first pass?
