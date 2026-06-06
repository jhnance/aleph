# Data Model — Key Decisions and Rationale

This document captures the significant design decisions made during the initial data model review, and the reasoning behind each. It is a companion to `data-model.md`.

---

## Discriminator column: enum over lookup table

`point_types` was originally a lookup table with an integer FK on `points.type`. It was replaced with a Postgres enum (`point_type`).

**Why:** Point types are developer-managed — they only change via migrations, never at runtime. A lookup table buys runtime flexibility that isn't needed, and its integer IDs make the compound FK enforcement approach (see below) fragile. A Postgres enum is constrained by the type system, requires no separate table, and makes CHECK constraints in extension tables clean string comparisons.

**Tradeoff:** Adding a new type requires `ALTER TYPE point_type ADD VALUE '...'`, a DDL migration. This is the right cost for a developer-managed concern.

---

## Discriminator enforcement: compound FK over trigger

Extension tables (e.g. `frontend_components`) enforce that their parent point has the correct type via a compound FK rather than a trigger.

**Pattern:** `frontend_components` carries a `type point_type NOT NULL CHECK (type = 'frontend_component')` column. The FK is `FOREIGN KEY (point_id, type) REFERENCES points (id, type)`. This requires `UNIQUE (id, type)` on `points`.

**Why:** The compound FK is purely declarative — no procedural code, harder to accidentally disable than a trigger. Since the `type` value is fixed by the CHECK constraint and the parent's `type` is immutable in practice, the denormalized column carries no drift risk.

---

## Cross-point scope enforcement: compound FK over application layer

`point_version_component_props` and `point_version_use_cases` both enforce that their referenced records belong to the same point as the version, using compound FKs rather than application-layer guards or triggers.

**Pattern:** `point_id` is carried as a denormalized column on each associative table. Compound FKs to both the version and the content record enforce scope at the DB level. Safe because both `use_cases` and `component_props` records are immutable after creation — the `point_id` value cannot drift.

For `use_cases`, `point_id` is denormalized from `use_case_lineages` (which is immutable). For `component_props`, `point_id` already existed on the table.

**Why:** Eliminates the application-layer `assertUseCaseBelongsToSamePoint` guard as the sole enforcement mechanism. Any write path — including future ones — is automatically covered.

---

## predecessor_export_id: same-point enforcement via compound FK

`point_exports.predecessor_export_id` uses a compound FK `FOREIGN KEY (predecessor_export_id, point_id) REFERENCES point_exports (id, point_id)` to enforce that a successor export's predecessor belongs to the same point.

**Why:** The simple FK only validated existence. A cross-point or cross-org predecessor reference would have been silently accepted. `UNIQUE (id, point_id)` was already present on `point_exports` as the target for the `use_case_lineages` compound FK, so no schema addition was needed.

---

## use_case_lineages: UNIQUE (point_id, export_id)

A unique constraint was added to prevent two lineages from being created for the same `(point_id, export_id)` pair.

**Why:** Without it, a race condition or application bug could silently split a use case's history across two lineage records with no recovery path.

**Note:** Postgres treats rows where `export_id IS NULL` as distinct under this constraint (NULL != NULL), so multiple point-level lineages per point are technically permitted. The export-scoping rule enforces that point-level lineages are only valid for points with no exports.

---

## Immutability enforcement: BEFORE UPDATE triggers

`use_cases`, `point_exports`, and `point_version_exports` are immutable after creation. Each has a BEFORE UPDATE trigger that raises an exception unconditionally.

**Why:** The immutability invariant was application-enforced only. Any future write path that skips the application layer (direct DB access, a new endpoint, a migration) could silently mutate records. The trigger fires only on UPDATE, so the cost in normal operation is zero.

**Consequence for use case editing:** Edits to a use case produce a new row with `parent_id` pointing to the previous record. The trigger does not affect INSERTs or the CASCADE DELETEs from version removal.

---

## Export-scoping rule: trigger on use_case_lineages

The rule "if a point has any version with exports, all its use case lineages must have a non-null export_id" is enforced by a BEFORE INSERT trigger rather than the SDK/CLI alone.

**Simplification:** The original rule was version-specific ("if this version has exports"). Since `use_case_lineages` belongs to a point rather than a version, the enforceable equivalent is "if this point has any version with exports" — a slight overapproximation. In practice there is no valid scenario where a point has exports in some versions and needs a point-level (null export_id) lineage, so the overapproximation is correct.

---

## version_monotonic concurrency: lock parent point row

Concurrent publishes for the same point are serialized by taking `SELECT ... FOR UPDATE` on the parent `points` row at the start of each publish transaction.

**Why:** `version_monotonic` is application-managed. Without serialization, two concurrent publishes can read the same `MAX(version_monotonic)` and collide on the UNIQUE constraint. The parent point row is a natural serialization target — all versions for a point share the same parent, and locking it does not affect unrelated points.

---

## Draft use cases: separate table

Draft authoring is handled by a `draft_use_cases` table rather than a `status` column on `use_cases`.

**Why:** Adding a status column that transitions (draft → active) would require UPDATEs to `use_cases`, directly conflicting with the immutability trigger. A separate mutable table keeps the two concerns cleanly separated: `draft_use_cases` is freely editable, `use_cases` is the immutable record of what was published.

**Publish flow:** On publish, a new `use_case_lineages` row is created if needed, a `use_cases` row is inserted, the draft is linked to a version via `point_version_use_cases`, and the draft row is deleted.

**lineage_id is nullable:** A draft can exist before a lineage is created (new use case) or reference an existing lineage (new version of an existing use case). When non-null, a compound FK enforces that the lineage belongs to the same point.

---

## Domains: first-class table and isolation boundary

A `domains` table was added as a first-class entity. Tenant isolation is scoped to the domain rather than the organization.

**Why:** The product model specifies that users are associated with domains (product areas), not just organizations. Domain-level isolation is more granular than org-level and is the correct boundary for access control.

**Org consistency:** `points.organization_id` is enforced consistent with `domains.organization_id` via the compound FK `FOREIGN KEY (domain_id, organization_id) REFERENCES domains (id, organization_id)`. This prevents a point from claiming an org that differs from its domain's org, without a trigger.

---

## RLS: deferred pending user/membership model

Row-level security is acknowledged as the target for DB-layer tenant isolation but is not yet implemented. The isolation boundary is the domain.

**Prerequisites:** user table, `domain_memberships` join table, connection-level context (`SET LOCAL app.current_user_id`), and `domain_id` denormalized onto hub tables (`point_versions`, `use_case_lineages`) so policies can be written as direct column checks rather than multi-hop joins.

---

## Point and version lifecycle: status enums

`points` and `point_versions` each have a `status` column (`active`, `deprecated`, `archived`) backed by separate Postgres enums (`point_status`, `point_version_status`).

**Why separate enums:** The two types may diverge over time. Separate enums make future additions independent.

**Archival semantics:** Archived records are not deleted — the RESTRICT FK chains make hard deletion operationally complex and destructive. Archival via status is the supported decommission path.

---

## updated_at: shared trigger function

Mutable tables (`organizations`, `domains`, `points`, `frontend_frameworks`, `frontend_components`, `component_props`) carry an `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` column managed by a shared trigger function `set_updated_at()`.

**Why trigger over application management:** The application can forget to set `updated_at`. Migrations and direct DB writes bypass application code entirely. A trigger guarantees accuracy regardless of write path. One function is defined and referenced by one trigger per table.
