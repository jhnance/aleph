---
status: To Do
related:
  - catalog/browse-catalog.md
  - catalog/view-use-case.md
  - versioning/view-version-history.md
  - versioning/component-props-manifest.md
  - connections/view-connections.md
  - health-checks/evaluate-point-health.md
---

# Point Detail

A user views a single point: its identity (name, type, domain, status, health), the version that represents it, and that version's use cases, exports, props (for `frontend_component`), and connections. The page is anchored on a **representative version** — the latest `release`-classification version (decided 2026-06-10) — whose manifests stand in for the point; every other version is reachable through version history.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/points/:pointId` is one aggregate endpoint (the page makes one call, not N — sub-resources keep their own endpoints for the deep views). It returns:
  - **identity**: `name`, `type`, `status`, `domain` (`id`, `name`, `slugPath`), `healthy`
  - **representativeVersion**: `id`, `versionSemantic`, `versionClassification`, `createdAt`
  - **versions summary**: total count + the most recent few (full list lives in View Version History)
  - for the representative version: **useCases** (published attachments: `lineageId`, `useCaseId`, `title`, `exportId`, `demoArtifactUrl`), **exports** (the manifest, with "formerly known as" derived from `predecessor_export_id`), **props** (`frontend_component` only), **connections** (outgoing dependencies and incoming dependents, point-level rollup)
- **Representative version resolution** (2026-06-12): latest `release` by the composite semantic key; if no release exists yet, fall back to the latest version of *any* classification by the same key, and badge it ("showing v2.0.0-beta.1 — prerelease; no release published yet"); a point with no versions renders the identity plus an unpublished empty state nudging `aleph publish`
- The use case list excludes unpublished attachments (`unpublished_at` set) by default; org admins reach them via the dedicated unpublished view (see Unpublish Use Case from Version)
- Connection rollup follows **the latest version represents the point** (2026-06-10): "this point's dependencies" are the representative version's outgoing connections; dependents are incoming connections targeting any of the point's versions, deduplicated to source points
- User-facing vocabulary: "edit history", never "lineage" — internal machinery doesn't leak into the UI
- Requires org role `viewer` or higher; non-membership and nonexistent point are indistinguishable (404, tenant-hiding); unauthenticated requests return 401

## TODO (2026-06-10)

- **Owner-authored, public-facing version notes.** Free-text notes for a point version, authored by its owners, displayed on the version page. Motivating example (from the unpublish decision): "Heads up, you might remember a use case that no longer appears in this version's list. You're not going crazy! We unpublished it because our documentation for it was incorrect. You can see the updated behavior and use case language in <other version>. Thank you for your understanding!" Needs: storage (mutable, version-scoped), authoring permissions, and whether notes can link versions/use cases as first-class references. See `use-case-management/remove-use-case-from-version.md`.
