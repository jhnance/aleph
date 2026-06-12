---
status: To Do
related:
  - versioning/view-version-history.md
  - versioning/component-props-manifest.md
  - use-case-management/publish-use-case.md
  - connections/create-connection.md
  - sdk-cli/publish-workflow.md
---

# Publish Point Version

The SDK/CLI calls this endpoint to commit a new version of a point. The server serializes concurrent publishes via a row lock, assigns a semantic and monotonic version, resolves and stores the semantic predecessor, records the export manifest, records the version's use case attachments from the payload, inserts connections, and (for `frontend_component` points) records the props manifest.

There is **no server-side forward propagation** (removed 2026-06-10 — an anachronism from before `.aleph.ts`/`aleph.lock` existed): the new version's use case set is exactly what the payload declares. Each attachment is born complete, with a demo artifact already uploaded to S3. A lineage attached to the predecessor but absent from the payload simply does not appear on the new version — that is the removal path going forward, and `aleph scan`'s lock-file confirmation is what makes such removals deliberate rather than accidental.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/points/:id/versions` accepts `versionSemantic` (semver string), `versionClassification` (`'release' | 'prerelease' | 'hotfix' | 'metadata'`), `exports` (array of `{ name, predecessorExportId? }`), `useCases` (array of `{ lineageId, title, exportName?, demoArtifactUrl }`), optional `connections` (array of `{ toVersionId, type? }`), and for `frontend_component` points an optional `props` array of `{ name, propType?, required?, defaultValue?, description? }`; requires an authenticated session
- The point must belong to the current org; returns 404 if not found or inaccessible
- The endpoint opens a transaction and immediately executes `SELECT id FROM points WHERE id = $1 FOR UPDATE` to serialize concurrent publishes for the same point — prevents two simultaneous transactions from computing the same `version_monotonic`. The transaction's first statement is `SET LOCAL statement_timeout = '15s'` — publish gets a larger budget than the 5s role default, scoped to this transaction only (2026-06-11). No external IO runs inside the transaction, by construction: demo artifacts were uploaded to S3 before this call, and search indexing happens post-commit
- `versionSemantic` must be unique within the point (`UNIQUE (point_id, version_semantic)` on `point_versions`); returns 409 if already published
- `versionClassification` must be consistent with `versionSemantic`: versions with no suffix must be `'release'`; versions with a `-` suffix must be `'prerelease'` or `'hotfix'`; versions with a `+` suffix must be `'metadata'`; returns 400 otherwise; the CLI derives `versionClassification` from `--version` and `--release-type` before calling the API (see Publish Workflow use case)
- `version_major`, `version_minor`, `version_patch` are parsed from `versionSemantic`; parsing may be done by the CLI before sending or by the server on receipt — implementation detail
- `version_monotonic` is assigned as `COALESCE(MAX(version_monotonic), 0) + 1` over existing versions for this point; the first version of a point gets `version_monotonic = 1`
- A `point_versions` row is inserted with `status = 'active'`
- **Predecessor resolution:** the publish handler resolves `predecessor_version_id` and stores it on the new `point_versions` row (first version: null). The predecessor is version-tree metadata — it drives no use case copying. Resolution logic:

```typescript
let predecessorVersionId: string | null = null;

// Edge case: prerelease/metadata published after its release already exists for
// the same patch — the composite key query would incorrectly skip over that
// release (suffix_rank 0 < 1), so we short-circuit to it directly.
if (classification === 'prerelease' || classification === 'metadata') {
  const existingRelease = await db.queryOne(`
    SELECT id FROM point_versions
    WHERE point_id = $1
      AND version_major = $2 AND version_minor = $3 AND version_patch = $4
      AND version_classification = 'release'
  `, [pointId, major, minor, patch]);

  if (existingRelease) {
    predecessorVersionId = existingRelease.id;
  }
}

// Normal path: highest composite key (major, minor, patch, suffix_rank, monotonic)
// strictly less than the new version's key.
// suffix_rank: metadata = 0, prerelease = 0, release = 1, hotfix = 2
if (predecessorVersionId === null) {
  const predecessor = await db.queryOne(`
    SELECT id FROM point_versions
    WHERE point_id = $1 AND (... composite key < current ...)
    ORDER BY version_major DESC, version_minor DESC, version_patch DESC,
             suffix_rank DESC, version_monotonic DESC
    LIMIT 1
  `, [...]);

  predecessorVersionId = predecessor?.id ?? null;
}
```
- **Export manifest:** for each entry in `exports`, resolve `name` to an existing `point_exports` row (`UNIQUE (point_id, name)`) or insert a new one; if `predecessorExportId` is supplied, insert the new `point_exports` row with `predecessor_export_id` set — the compound FK `FOREIGN KEY (predecessor_export_id, point_id)` enforces the predecessor belongs to the same point; insert all resolved export ids into `point_version_exports` for this version; these rows are immutable after insertion
- **Use case attachments:** processed after the export manifest (the manifest-presence FK depends on it). For each entry in `useCases`:
  - `lineageId` must reference an existing `use_case_lineages` row belonging to this point — lineages are pre-registered by `aleph new use-case` (CLI-first) or UI draft-publish (Aleph-UI-first); an unknown `lineageId` fails the publish with 400 (the ID was never registered — run `aleph new use-case` / check `aleph.lock`)
  - the attached content record is the lineage's head (most recent `use_cases` row) at publish time; if the lineage has **no content record yet** (brand-new use case), this publish is its promotion out of draft (2026-06-10 — leaving draft state requires a version + demo, and this is that moment): the lineage's `draft_use_cases` row is promoted to the first content record (`parent_id = NULL`, title/content from the draft) and the draft is deleted; if multiple drafts reference the lineage, the most recently updated wins (the rest become ordinary revision drafts); if no draft exists, one is minted from the payload's `title` with empty content
  - `exportName`, if present, must match an entry in this payload's `exports` array; it is resolved to its `point_exports` id and stored as `export_id` on the attachment row — scoping is per-version (2026-06-10), and the compound FK to `point_version_exports` enforces manifest presence; absent `exportName` = point-level in this version
  - `demoArtifactUrl` is **required** (`demo_artifact_url` is NOT NULL — every attachment is born with a demo, uploaded to S3 before this call); a missing URL fails the publish with 400
  - the row is inserted with `lineage_id` denormalized; `UNIQUE (point_version_id, lineage_id)` guarantees at most one entry per lineage per version — a duplicate `lineageId` in the payload is a 400
  - the lineage rows referenced by the payload are locked (`SELECT ... FOR UPDATE`, ordered by id) before head resolution, so a concurrent UI edit-publish cannot interleave between head resolution and insert
- **Props manifest (`frontend_component` only):** for each entry in `props`, resolve `name` to an existing `component_props` row (`UNIQUE (point_id, name)`) or insert a new one; insert version-specific metadata (`propType`, `required`, `defaultValue`, `description`) into `point_version_component_props`; these rows are immutable after insertion; props are not automatically forward-propagated — they must be re-declared in each publish payload. Two tables mirror the `point_exports` / `point_version_exports` pattern: `component_props` is the point-level catalog of prop identities (name is stable), and `point_version_component_props` holds the version-specific metadata so that changes to a prop's type, required flag, or description are tracked per version without duplicating the name
- **Connections:** insert each connection as `(from_version_id = new version id, to_version_id = entry.toVersionId, type = entry.type ?? 'dependency', organization_id = current org)`; both versions must belong to the current org (enforced by compound FKs); `connections` rows are immutable after insertion. No cycle check is needed: every publish-created edge originates at the brand-new version, so the version graph is a DAG by construction (2026-06-10 — see `data-model.md`, Connection acyclicity)
- Returns 201 with: `id`, `versionSemantic`, `versionMonotonic`, `status`, `exports` (with ids and predecessorExportId), `useCases` (with `lineageId`, `useCaseId`, `exportId`, `demoArtifactUrl`), `connections`, `createdAt`
- Requires org role `member` or higher — `viewer` is read-only; insufficient role returns 403. The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401

## TODO (2026-06-10)

- **`aleph reset` (CLI, future):** a recovery command to "reset" the codebase's use cases / lockfile to the last published version. At its simplest, it takes a git commit ID for the last published version and restores the Aleph files (`aleph.lock`, `.aleph.ts` files) to that commit's version of those files — a safety net for the omission-is-removal model, where mangled local Aleph state would otherwise silently drop use cases at the next publish.
