# Use Cases

Navigation index — one entry per use case file. Status lives in each file's frontmatter; this index is a read-only orientation layer. Regenerate at the start of any `/use-cases` session.

Convention (2026-06-10): use case files that connect to other use cases declare those relationships in frontmatter via a `related:` list (paths relative to `use-cases/`). Backfill across older files is pending.

## Planned sessions

### Use case identification and creation ✓ (2026-06-09)
Resolved: `.aleph.ts` file format, explicit `id` field (Option C), `aleph new use-case` / `aleph scan` / `aleph sync` command design, lock file format, `aleph publish` preflight checks, `demo_artifact_url` on `point_version_use_cases`.

**One open question remaining:** `aleph sync` title push — which `pointVersionId` to publish against. See `decisions/2026-06-09.md`.

### Use case forward propagation ✓ (2026-06-10)
Resolved by dissolving it: server-side forward propagation was removed (anachronism predating `.aleph.ts`/`aleph.lock`) — a version's use case set is exactly the publish payload, every attachment is born with a demo (`demo_artifact_url NOT NULL`), export scoping moved to `point_version_use_cases`, and removal became per-row **unpublish/republish** (no cascade exists to decide). "Propagation" now means language edits re-pointing a lineage's attachments forward. No `propagated BOOLEAN` needed. See `decisions/2026-06-10.md`; docs updated: `publish-point-version.md`, `publish-use-case.md`, `remove-use-case-from-version.md`, `publish-workflow.md`, `aleph-config.md` (new), `data-model.md`, ALIGNMENT.md.

### Health scores system
Fully spec out the health scores system. Checklist:
- [ ] Define **deterministic** (pure functions of catalog state, computed inline) vs. **nondeterministic** (run against codebases/external state) health scores
- [ ] Design the async worker system Aleph likely needs to process nondeterministic scores
- [ ] Decide the execution model: CLI steps vs. dedicated pipeline actions (one published action per supported language/framework)
- [ ] Score semantics: scale, weighting, per-version vs. per-point aggregation; relationship to the boolean completeness report
- [ ] Structured violation references (`versionId?`/`exportId?`) so the UI can badge specific versions/exports
- [ ] Spec the **outdated dependencies** score (declared `package.json` ranges vs. latest published — Joshua to describe)
- [ ] `health-score.md` / `evaluate-point-health.md` — reconcile and document

## auth
- [Magic Link Sign-In](auth/magic-link-sign-in.md) — user submits email, clicks magic link, receives JWT session cookie
- [Org Switching](auth/org-switching.md) — org switching is pure navigation (URL org is authoritative, 2026-06-11); `GET /api/auth/orgs` powers the picker
- [Logout](auth/logout.md) — deletes JWT cookie client-side; no server-side revocation
- [CLI Authentication](auth/cli-auth.md) — token via `ALEPH_TOKEN` or `~/.aleph/credentials`; magic link flow in TTY; non-TTY exits with instructions

## orgs
- [Create Organization](orgs/create-organization.md) — user creates a new org; assigned `owner` role automatically
- [Invite Flow](orgs/invite-flow.md) — admin invites an email with a role; consent-gated acceptance via invite link (signs in) or org-selection screen (2026-06-12)

## domains
- [Create Domain](domains/create-domain.md) — org member creates a domain or sub-domain; sibling-scoped slug uniqueness

## points
- [Create Point](points/create-point.md) — org member creates a new point within a domain, specifying type and metadata
- [Update Point Status](points/update-point-status.md) — transitions a point through `active → deprecated → archived`

## catalog
- [Browse Catalog](catalog/browse-catalog.md) — domain-tree sidebar + point list with status/health/type filters (designed 2026-06-12)
- [Point Detail](catalog/point-detail.md) — aggregate single-point page anchored on the representative (latest-release) version
- [View Use Case](catalog/view-use-case.md) — lineage-addressed page: content, edit history, per-version appearances, sandboxed live demos
- [Ecosystem Map](catalog/ecosystem-map.md) — domain-scoped graph with boundary nodes; org-wide and neighborhood views deferred

## versioning
- [Publish Point Version](versioning/publish-point-version.md) — SDK/CLI publishes a new version; assigns semantic + monotonic version, records use case attachments from the payload
- [View Version History](versioning/view-version-history.md) — user views all published versions of a point in monotonic order
- [Component Props Manifest](versioning/component-props-manifest.md) — immutable per-version prop manifest for `frontend_component` points (type, required, default, description)

## use-case-management
- [Draft Use Case](use-case-management/draft-use-case.md) — org member authors a draft use case (new or revision of existing)
- [Publish Use Case](use-case-management/publish-use-case.md) — revision draft promoted to immutable `use_cases` record; language-only, re-points attachments forward (brand-new drafts are promoted by the CLI version publish instead)
- [Edit Use Case](use-case-management/edit-use-case.md) — edit creates a new draft with lineage + parent pointers; publish flow applies
- [Unpublish Use Case from Version](use-case-management/remove-use-case-from-version.md) — soft retraction of a use case claim from a published version; admin-visible, republishable

## connections
- [Create Connection](connections/create-connection.md) — directed dependency edge between two point versions; acyclicity enforced at publish
- [View Connections](connections/view-connections.md) — user views outgoing (dependencies) and incoming (dependents) connections for a version
- [Declare Dependencies](connections/declare-dependencies.md) — authoring path: package-manager metadata cross-referenced against Aleph points; deps in `aleph.config.ts`, dependents derived *(stub)*

## point-types
- [List Point Types](point-types/list-point-types.md) — view available types and frameworks (platform-provided + org-defined) when creating a point
- [Create Custom Point Type](point-types/create-custom-point-type.md) — org member creates an org-scoped custom point type
- [Update Custom Point Type](point-types/update-custom-point-type.md) — rename an org-defined custom point type; ownership enforced in the query
- [Delete Custom Point Type](point-types/delete-custom-point-type.md) — delete an org-defined custom point type; blocked by FK if any point still references it

## health-checks
- [Evaluate Point Health](health-checks/evaluate-point-health.md) — system evaluates completeness criteria and flags incomplete points in the UI
- [Health Score](health-checks/health-score.md) — score model beyond the boolean; pipeline actions vs. CLI steps *(stub)*

## search
- [Search and Discover](search/search-and-discover.md) — typo-tolerant full-text search across points, domains, and use cases via Meilisearch

## sdk-cli
- [`aleph.config.ts`](sdk-cli/aleph-config.md) — required root config: pointId, API/org, export entries, use case discovery globs; discovery only, use cases are files-only
- [Publish Workflow](sdk-cli/publish-workflow.md) — end-to-end CLI publish flow: auth, preflight checks, detection, version assignment, demo artifact upload, commit
- [Export Detection](sdk-cli/export-detection.md) — static analysis of named exports; reconciled against previous version's manifest
- [`aleph reconcile-exports`](sdk-cli/export-rename-succession.md) — pre-publish interactive step; maps removed exports to renames or confirms deletions; writes mapping to `aleph.lock`
- [Detecting Use Cases](sdk-cli/detecting-use-cases.md) — `.aleph.ts` file format; CLI discovery and lock file matching at publish time
- [`aleph new use-case`](sdk-cli/aleph-new-use-case.md) — scaffold a `.aleph.ts` file; CLI-first (generates ID + pending Aleph record) or Aleph-UI-first (scaffolds against existing ID)
- [`aleph scan`](sdk-cli/aleph-scan.md) — update `aleph.lock` from codebase; confirms additions and removals interactively
- [`aleph sync`](sdk-cli/aleph-sync.md) — pulls Aleph titles down to local `.aleph.ts` files; pull-only, titles are Aleph-authoritative (2026-06-10)
- [Bulk Onboarding](sdk-cli/bulk-onboarding.md) — AI-driven repo scan proposing points for an existing ecosystem *(stub)*
- [Props Extraction](sdk-cli/props-extraction.md) — extract component props at publish (react-docgen / TS compiler API) *(stub)*
