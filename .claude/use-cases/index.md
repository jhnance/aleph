# Use Cases

Navigation index — one entry per use case file. Status lives in each file's frontmatter; this index is a read-only orientation layer. Regenerate at the start of any `/use-cases` session.

## Planned sessions

### Use case identification and creation ✓ (2026-06-09)
Resolved: `.aleph.ts` file format, explicit `id` field (Option C), `aleph new use-case` / `aleph scan` / `aleph sync` command design, lock file format, `aleph publish` preflight checks, `demo_artifact_url` on `point_version_use_cases`.

**One open question remaining:** `aleph sync` title push — which `pointVersionId` to publish against. See `decisions/2026-06-09.md`.

### Use case forward propagation
Covers removal semantics, publish-time suppression, stale detection UX, and schema decisions. Checklist:

**Core design questions**
- [ ] Decide cascade semantics for `removeUseCaseFromVersion`
- [ ] Decide whether removal can be triggered at publish time (suppress propagation in the payload), or is always a separate post-publish action
- [ ] Decide how the publish workflow surfaces stale use cases and whether that surface triggers removal

**Schema**
- [ ] Decide whether `point_version_use_cases` needs a `propagated BOOLEAN` column

**Use case documents**
- [ ] `remove-use-case-from-version.md` — design and document once cascade semantics are decided
- [ ] `publish-point-version.md` — update if publish-time suppression is added
- [ ] `publish-workflow.md` (SDK-CLI) — UX for stale use case detection → removal prompt

**Supporting docs**
- [ ] `data-model.md` / `data-model-decisions.md` — schema + cascade decision
- [ ] `ALIGNMENT.md` — remove the open question once resolved

## auth
- [Magic Link Sign-In](auth/magic-link-sign-in.md) — user submits email, clicks magic link, receives JWT session cookie
- [Org Switching](auth/org-switching.md) — authenticated user switches active org; JWT re-issued with updated org
- [Logout](auth/logout.md) — deletes JWT cookie client-side; no server-side revocation
- [CLI Authentication](auth/cli-auth.md) — token via `ALEPH_TOKEN` or `~/.aleph/credentials`; magic link flow in TTY; non-TTY exits with instructions

## orgs
- [Create Organization](orgs/create-organization.md) — user creates a new org; assigned `owner` role automatically
- [Invite Flow](orgs/invite-flow.md) — how a user joins an existing org *(deferred — open question)*

## domains
- [Create Domain](domains/create-domain.md) — org member creates a domain or sub-domain; sibling-scoped slug uniqueness

## points
- [Create Point](points/create-point.md) — org member creates a new point within a domain, specifying type and metadata
- [Update Point Status](points/update-point-status.md) — transitions a point through `active → deprecated → archived`

## versioning
- [Publish Point Version](versioning/publish-point-version.md) — SDK/CLI publishes a new version; assigns semantic + monotonic version, forward-propagates use cases
- [View Version History](versioning/view-version-history.md) — user views all published versions of a point in monotonic order
- [Component Props Manifest](versioning/component-props-manifest.md) — immutable per-version prop manifest for `frontend_component` points (type, required, default, description)

## use-case-management
- [Draft Use Case](use-case-management/draft-use-case.md) — org member authors a draft use case (new or revision of existing)
- [Publish Use Case](use-case-management/publish-use-case.md) — draft promoted to immutable `use_cases` record, linked to a version
- [Edit Use Case](use-case-management/edit-use-case.md) — edit creates a new draft with lineage + parent pointers; publish flow applies
- [Remove Use Case from Version](use-case-management/remove-use-case-from-version.md) — removes use case from a version *(deferred — forward-propagation semantics unresolved)*

## connections
- [Create Connection](connections/create-connection.md) — directed dependency edge between two point versions; acyclicity enforced at publish
- [View Connections](connections/view-connections.md) — user views outgoing (dependencies) and incoming (dependents) connections for a version

## point-types
- [List Point Types](point-types/list-point-types.md) — view available types and frameworks (platform-provided + org-defined) when creating a point
- [Create Custom Point Type](point-types/create-custom-point-type.md) — org member creates an org-scoped custom point type
- [Update Custom Point Type](point-types/update-custom-point-type.md) — rename an org-defined custom point type; ownership enforced in the query
- [Delete Custom Point Type](point-types/delete-custom-point-type.md) — delete an org-defined custom point type; blocked by FK if any point still references it

## health-checks
- [Evaluate Point Health](health-checks/evaluate-point-health.md) — system evaluates completeness criteria and flags incomplete points in the UI

## search
- [Search and Discover](search/search-and-discover.md) — typo-tolerant full-text search across points, domains, and use cases via Meilisearch

## sdk-cli
- [Publish Workflow](sdk-cli/publish-workflow.md) — end-to-end CLI publish flow: auth, preflight checks, detection, version assignment, demo artifact upload, commit
- [Export Detection](sdk-cli/export-detection.md) — static analysis of named exports; reconciled against previous version's manifest
- [`aleph reconcile-exports`](sdk-cli/export-rename-succession.md) — pre-publish interactive step; maps removed exports to renames or confirms deletions; writes mapping to `aleph.lock`
- [Detecting Use Cases](sdk-cli/detecting-use-cases.md) — `.aleph.ts` file format; CLI discovery and lock file matching at publish time
- [`aleph new use-case`](sdk-cli/aleph-new-use-case.md) — scaffold a `.aleph.ts` file; CLI-first (generates ID + pending Aleph record) or Aleph-UI-first (scaffolds against existing ID)
- [`aleph scan`](sdk-cli/aleph-scan.md) — update `aleph.lock` from codebase; confirms additions and removals interactively
- [`aleph sync`](sdk-cli/aleph-sync.md) — bidirectional title reconciliation between local `.aleph.ts` files and Aleph; interactive conflict resolution
