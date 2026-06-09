---
status: To Do
---

# Publish Point Version

The SDK/CLI calls this endpoint to commit a new version of a point. The server serializes concurrent publishes via a row lock, assigns a semantic and monotonic version, resolves and stores the semantic predecessor, forward-propagates use cases from that predecessor, records the export manifest, inserts connections after an acyclicity check, and (for `frontend_component` points) records the props manifest.

## Acceptance Criteria

- `POST /api/points/:id/versions` accepts `versionSemantic` (semver string), `versionClassification` (`'release' | 'prerelease' | 'hotfix' | 'metadata'`), `exports` (array of `{ name, predecessorExportId? }`), optional `connections` (array of `{ toVersionId, type? }`), and for `frontend_component` points an optional `props` array of `{ name, propType?, required?, defaultValue?, description? }`; requires an authenticated session with an active org
- The point must belong to the current org; returns 404 if not found or inaccessible
- The endpoint opens a transaction and immediately executes `SELECT id FROM points WHERE id = $1 FOR UPDATE` to serialize concurrent publishes for the same point — prevents two simultaneous transactions from computing the same `version_monotonic`
- `versionSemantic` must be unique within the point (`UNIQUE (point_id, version_semantic)` on `point_versions`); returns 409 if already published
- `versionClassification` must be consistent with `versionSemantic`: versions with no suffix must be `'release'`; versions with a `-` suffix must be `'prerelease'` or `'hotfix'`; versions with a `+` suffix must be `'metadata'`; returns 400 otherwise; the CLI derives `versionClassification` from `--version` and `--release-type` before calling the API (see Publish Workflow use case)
- `version_major`, `version_minor`, `version_patch` are parsed from `versionSemantic`; parsing may be done by the CLI before sending or by the server on receipt — implementation detail
- `version_monotonic` is assigned as `COALESCE(MAX(version_monotonic), 0) + 1` over existing versions for this point; the first version of a point gets `version_monotonic = 1`
- A `point_versions` row is inserted with `status = 'active'`
- **Use case forward-propagation:** the publish handler resolves `predecessor_version_id` and stores it on the new `point_versions` row; forward propagation then copies all `point_version_use_cases` rows from that predecessor with `demo_artifact_url = NULL` — demo artifacts are not forward-propagated, as each version's demo must be explicitly published by the CLI; if this is the first version, `predecessor_version_id` is null and no rows are forward-propagated. Resolution logic:

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
- **Props manifest (`frontend_component` only):** for each entry in `props`, resolve `name` to an existing `component_props` row (`UNIQUE (point_id, name)`) or insert a new one; insert version-specific metadata (`propType`, `required`, `defaultValue`, `description`) into `point_version_component_props`; these rows are immutable after insertion; props are not automatically forward-propagated — they must be re-declared in each publish payload. Two tables mirror the `point_exports` / `point_version_exports` pattern: `component_props` is the point-level catalog of prop identities (name is stable), and `point_version_component_props` holds the version-specific metadata so that changes to a prop's type, required flag, or description are tracked per version without duplicating the name
- **Connections:** before inserting any row into `connections`, run a recursive CTE graph walk to verify the new edge does not close a cycle (A → B → ... → A); if a cycle is detected, roll back the transaction and return 409 describing the cycle; insert each valid connection as `(from_version_id = new version id, to_version_id = entry.toVersionId, type = entry.type ?? 'dependency', organization_id = current org)`; both versions must belong to the current org (enforced by compound FKs); `connections` rows are immutable after insertion
- Returns 201 with: `id`, `versionSemantic`, `versionMonotonic`, `status`, `exports` (with ids and predecessorExportId), `forwardPropagatedUseCaseIds`, `connections`, `createdAt`
- Requests with no active org return 400; unauthenticated requests return 401
