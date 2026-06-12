---
status: To Do
related:
  - connections/view-connections.md
  - connections/declare-dependencies.md
  - versioning/publish-point-version.md
  - sdk-cli/publish-workflow.md
---

# Create Connection

A directed connection is created between two point versions within the same org. Connection behavior differs by type: `dependency` connections are immutable and created at publish time via the SDK/CLI; `other` connections can be created and deleted at runtime without publishing a new version.

## Acceptance Criteria

### `dependency` connections (publish-time, immutable)

- `dependency` connections are created as part of the Publish Point Version flow — they are declared in the `connections` array of `POST /api/orgs/:orgSlug/points/:id/versions` and committed atomically with the new version; the SDK/CLI is the entry point for this flow (see Publish Workflow use case; the authoring path — how the CLI determines `toVersionId`s — is being designed in `declare-dependencies.md`)
- `fromVersionId` is always the newly published version; `toVersionId` is the version being depended on
- Both versions must belong to the current org; the compound FKs on `connections.organization_id` enforce this at the DB layer
- A self-connection is rejected by the `CHECK (from_version_id != to_version_id)` constraint
- A duplicate connection is rejected by the `UNIQUE (from_version_id, to_version_id)` constraint
- Before inserting any `dependency` connection, the server runs a recursive CTE graph walk to verify the new edge does not close a cycle; if a cycle is detected, the entire publish transaction is rolled back and a 409 is returned describing the cycle
- Once inserted, a `dependency` connection row is immutable (`trg_connections_immutable` prevents UPDATE); adding a missed dependency to an already-published version requires publishing a new version

### `other` connections (runtime, deletable)

- `other` connections represent non-dependency relationships (e.g. "is related to", "supersedes") and can be created at runtime without publishing a new version
- `POST /api/orgs/:orgSlug/connections` accepts `fromVersionId`, `toVersionId`, and `type = 'other'`; both versions must belong to the current org
- `DELETE /api/orgs/:orgSlug/connections/:id` removes an `other` connection; only `other` type connections may be deleted via this endpoint — attempting to delete a `dependency` connection returns 400
- Duplicate and self-connection constraints still apply; whether the acyclicity check applies to `other` connections is to be decided during implementation
- Requires org role `member` or higher — `viewer` is read-only; insufficient role returns 403. The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401
