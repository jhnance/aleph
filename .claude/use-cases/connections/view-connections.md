---
status: To Do
---

# View Connections

A user views the dependency graph for a specific point version — outgoing connections (what this version depends on) and incoming connections (what depends on this version).

## Acceptance Criteria

- `GET /api/versions/:versionId/connections` returns the connection graph for the specified version; requires an authenticated session with an active org
- **Outgoing (dependencies):** rows in `connections` where `from_version_id = versionId`; each entry includes `toVersionId`, the target version's `versionSemantic`, the target point's `id` and `name`, and the connection `type`
- **Incoming (dependents):** rows in `connections` where `to_version_id = versionId`; each entry includes `fromVersionId`, the source version's `versionSemantic`, the source point's `id` and `name`, and the connection `type`
- The version must belong to the current org; returns 404 if not found or inaccessible
- Returns 200 with `{ dependencies: [...], dependents: [...] }` even if both arrays are empty
- Both `dependency` and `other` type connections are included in the response; the `type` field on each entry distinguishes them
- Only direct connections are returned — transitive graph traversal is out of scope for this use case
- Requests with no active org return 400; unauthenticated requests return 401
