---
status: To Do
---

# Component Props Manifest

A published version of a `frontend_component` point carries a props manifest — the set of props active in that version, each with type, required flag, default value, and description. The manifest is immutable once the version is published.

## Acceptance Criteria

- Props are submitted as part of the `POST /api/points/:id/versions` payload for `frontend_component` versions (see Publish Point Version); each prop entry has `name`, and optional `propType`, `required` (boolean, default false), `defaultValue`, and `description`
- Each prop `name` is resolved to an existing `component_props` row scoped to the point (`UNIQUE (point_id, name)`) or a new one is inserted; this gives each prop a stable identity across versions
- Version-specific metadata (`propType`, `required`, `defaultValue`, `description`) is inserted into `point_version_component_props`; these rows are immutable after insertion (enforced by `trg_point_version_component_props_immutable`)
- Props are not automatically forward-propagated to new versions — they must be explicitly included in each publish payload; props omitted from a version's payload are absent from that version's manifest
- `GET /api/points/:id/versions/:versionId/props` returns the full props manifest for that version: each prop's stable `id`, `name`, `propType`, `required`, `defaultValue`, `description`
- Requesting props for a non-`frontend_component` version returns 404
- A `component_props` record cannot be deleted while any `point_version_component_props` row references it (`ON DELETE RESTRICT`)
- The point must belong to the current org; returns 404 if not found
- Requests with no active org return 400; unauthenticated requests return 401
