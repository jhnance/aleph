---
status: To Do
---

# Create Point

An org member creates a new Point within a domain, specifying its type (`frontend_component` or `custom`) and type-specific metadata. The point is initially versionless — a version is published separately via the SDK/CLI.

## Acceptance Criteria

- `POST /api/points` accepts `name`, `domainId`, `type` (`frontend_component` | `custom`), and type-specific metadata; requires an authenticated session with an active org
- `organization_id` is taken from the session JWT, never the request body
- `domainId` must belong to the current org; enforced at the DB layer by the compound FK `FOREIGN KEY (domain_id, organization_id) REFERENCES domains (id, organization_id)` — a domain from another org cannot be referenced; returns 404 if the domain is not found in the current org
- For `type = 'frontend_component'`: accepts an optional `frameworkId`; if provided, the referenced `frontend_frameworks` row must have `organization_id IS NULL` (platform-provided) or `organization_id = current org` — enforced at the application layer before insert, since the nullable org pattern is inexpressible as a single FK constraint; returns 400 if out-of-scope or not found
- For `type = 'custom'`: accepts a required `customTypeId`; the `custom_point_types` row must have `organization_id IS NULL` or `organization_id = current org` — same application-layer enforcement; returns 400 if out-of-scope or not found
- Within a single transaction: inserts into `points`, then inserts into the type-specific extension table (`frontend_components` or `custom_points`)
- Newly created point has `status = 'active'` (the schema default); no `point_versions` row is created — the point is versionless until published via the SDK/CLI
- Returns 201 with `id`, `name`, `domainId`, `organizationId`, `type`, `status`, `createdAt`, and type-specific fields (`frameworkId` for `frontend_component`; `customTypeId` for `custom`)
- Requests with no active org return 400; unauthenticated requests return 401
