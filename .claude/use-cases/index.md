# Use Cases

Navigation index — one entry per use case file. Status lives in each file's frontmatter; this index is a read-only orientation layer. Regenerate at the start of any `/use-cases` session.

## auth
- [Magic Link Sign-In](auth/magic-link-sign-in.md) — user submits email, clicks magic link, receives JWT session cookie
- [Org Switching](auth/org-switching.md) — authenticated user switches active org; JWT re-issued with updated org
- [Logout](auth/logout.md) — deletes JWT cookie client-side; no server-side revocation

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
- [Publish Workflow](sdk-cli/publish-workflow.md) — end-to-end CLI publish flow: auth, detection, version assignment, commit
- [Export Detection](sdk-cli/export-detection.md) — static analysis of named exports; reconciled against previous version's manifest
- [Export Rename Succession](sdk-cli/export-rename-succession.md) — CLI prompts to confirm rename continuity; sets `predecessor_export_id`
- [Detecting Use Cases](sdk-cli/detecting-use-cases.md) — mechanism for co-locating use case definitions with code (annotations, config, etc.)
