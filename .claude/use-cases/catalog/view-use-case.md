---
status: To Do
related:
  - catalog/point-detail.md
  - use-case-management/publish-use-case.md
  - use-case-management/draft-use-case.md
  - use-case-management/remove-use-case-from-version.md
  - sdk-cli/aleph-new-use-case.md
  - versioning/view-version-history.md
---

# View Use Case

A user views a use case: its title and content, the export it's scoped to (if any), which versions it appears in, its edit history, and — for any version it's published on — **the live demo**: a running, interactive rendering of the behavior itself (mock-backed via MSW) that the user operates directly on the page. A demo is the thing working, not a recording or static documentation. The page is **lineage-addressed** (2026-06-12): the lineage UUID is the use case's stable identity (it is the `id` in the `.aleph.ts` file), and individual content records are presentation detail beneath it.

## Acceptance Criteria

- `GET /api/orgs/:orgSlug/use-cases/:lineageId` returns:
  - the lineage `id` and its point (`id`, `name`)
  - the **head content record**: `title`, `content`, `createdAt`
  - **appearsIn**: the versions this use case is published on (internally: its `point_version_use_cases` rows — "attachments" in the design docs; see TERMINOLOGY.md) — version `id` + `versionSemantic` + `versionClassification`, `exportName` (null = point-level in that version), `demoArtifactUrl`, and *the content record published there* (older versions may carry older language — historical pages stay historically accurate)
  - **editHistory**: the lineage's content records newest-first (`id`, `title`, `createdAt`); full content of a historical record fetched on demand
- `appearsIn` excludes appearances retracted from their version (`unpublished_at` set) by default; org admins see them in the dedicated view, badged (see Unpublish Use Case from Version)
- **Draft state**: a lineage with no content record yet (registered at draft creation) renders the draft's title/content, a "no demo yet" affordance, a copy-the-id affordance, and the `aleph new use-case --id=<uuid>` scaffold instruction — the only state in which "no demo" exists, since a use case is always published onto a version together with its demo (`demo_artifact_url NOT NULL`)
- Members and above see an Edit affordance entering the draft flow (see Draft Use Case); viewers are read-only
- User-facing vocabulary: "edit history", never "lineage"
- Requires org role `viewer` or higher; 404 tenant-hiding; unauthenticated requests return 401
- Cross-version content **diff is deferred** (2026-06-12): the `lineage_id`/`parent_id` model already supports it, so it lands later as additive UI

### Demo embedding and sandboxing

`demo_artifact_url` points to an org-authored HTML/JS/CSS bundle (MSW handlers baked in) on S3. Org-authored code is untrusted from the platform's perspective: rendered carelessly, any org member could ship stored XSS to every colleague who opens a demo. Two load-bearing criteria:

- Demo bundles are served from a **separate registrable domain** (the `*.githubusercontent.com` pattern — e.g. `aleph-usercontent.com`), never from the app's domain or a subdomain of it: the app's site must be cross-site from the bundle's, so the session cookie (`SameSite=Lax`) is never attached to anything the bundle does
- The bundle renders inside `<iframe sandbox="allow-scripts">` — deliberately **without** `allow-same-origin`, giving it a unique opaque origin

Access matrix for the embedded bundle (cells from documented [iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox) and SameSite semantics):

| Capability | Allowed? | Why |
|---|---|---|
| Execute JS, run MSW, render the demo | yes | `allow-scripts` — the entire point |
| Call the Aleph API with the user's session | no | cross-site iframe → `Lax` withholds the cookie; opaque origin fails the `Origin` check on mutating routes |
| Read or script the embedding page | no | no `allow-same-origin` → unique opaque origin |
| Navigate the top-level page | no | no `allow-top-navigation` |
| Open popups / new windows | no | no `allow-popups` |
