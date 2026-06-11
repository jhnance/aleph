# Data Model — Key Decisions and Rationale

This document captures the significant design decisions made during the initial data model review, and the reasoning behind each. It is a companion to `data-model.md`.

> **Note (2026-06-10):** Where this document conflicts with the dated logs in `.claude/decisions/`, the decision logs are authoritative. The sections below were brought current on 2026-06-10 after a review found four stale sections (isolation boundary, lineage uniqueness, export scoping, release-type flags).

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

## use_case_lineages: no per-(point, export) uniqueness

*(Superseded 2026-06-08 — see `decisions/2026-06-08.md`.)* An earlier revision added `UNIQUE (point_id, export_id)` to prevent accidentally splitting one use case's history across two lineages. It was removed: the constraint inadvertently limited each export to **one** lineage, contradicting the definition of a use case as a single distinct behavior — an export can have many. Multiple lineages per export, and multiple point-level (`export_id IS NULL`) lineages per point, are all valid.

**Residual risk:** with the constraint gone, accidental history-splitting is possible again at the DB level — a duplicate lineage is now indistinguishable from the legitimate many-lineages-per-export case, so no constraint can catch it. The guard is application-level: lineages are created only in explicit flows (UI publish with `lineageId = null`, CLI scaffold with a pre-generated UUID), and the explicit-ID model in `.aleph.ts` files means the CLI never infers identity. What remains is a *user* accidentally authoring a duplicate use case — a product/duplicate-detection concern, not a schema one.

*(2026-06-10: export scoping has since moved off lineages entirely — `use_case_lineages` has no `export_id`; scoping lives per-version on `point_version_use_cases`. The no-uniqueness conclusion above is unchanged.)*

---

## Immutability enforcement: BEFORE UPDATE triggers

`use_cases`, `point_exports`, and `point_version_exports` are immutable after creation. Each has a BEFORE UPDATE trigger that raises an exception unconditionally.

**Why:** The immutability invariant was application-enforced only. Any future write path that skips the application layer (direct DB access, a new endpoint, a migration) could silently mutate records. The trigger fires only on UPDATE, so the cost in normal operation is zero.

**Consequence for use case editing:** Edits to a use case produce a new row with `parent_id` pointing to the previous record. The trigger does not affect INSERTs or the CASCADE DELETEs from version removal.

---

## Export-scoping rule: per-version, on point_version_use_cases

*(History: the original point-level rule — "if a point has any version with exports, all its lineages must have a non-null `export_id`" — was removed 2026-06-08: it blocked legitimate point-level use cases on points that also have exports. The replacement, lineage-level `export_id` validated by a `BEFORE INSERT` trigger, was itself superseded 2026-06-10.)*

**Current rule:** export scoping is a column on `point_version_use_cases` (`export_id`, NULL = point-level in that version), not on the lineage — a lineage survives export renames with one identity. The version-level invariant (a scoped attachment's export must be in that version's manifest) is enforced declaratively by the compound FK to `point_version_exports`; no trigger (see `data-model.md`).

---

## Version classification: explicit enum over semver inference

`point_versions` carries `version_major INTEGER`, `version_minor INTEGER`, `version_patch INTEGER`, and `version_classification ENUM('release', 'prerelease', 'hotfix', 'metadata')` rather than relying on parsing `version_semantic` at query time.

**Why:** Semver's `-` suffix has a precise spec meaning (pre-release, lower precedence than the release) that conflicts with how teams actually use it — hotfixes applied on top of a released version are semantically *higher* than that release, not lower. Inferring intent from the suffix string is not possible. An explicit classification stored at publish time makes the intent unambiguous and keeps version-ordering queries simple.

**Classification rules enforced by the CLI** (flags updated 2026-06-09: a single `--release-type=release|prerelease|hotfix|metadata` replaced the `--is-prerelease` / `--is-hotfix` pair — see `decisions/2026-06-09.md`):
- No suffix → `release` (inferred, no flag required)
- `+` suffix → `metadata` (inferred, no flag required; `+` is build metadata per spec and is never intended for consumption in the same way a release is)
- `-` suffix → ambiguous between `prerelease` and `hotfix`; `--release-type` is required, error if omitted

**Semantic ordering:** Predecessor resolution uses the composite key `(version_major, version_minor, version_patch, suffix_rank, version_monotonic)`, where `suffix_rank` is derived at query time: `metadata = 0`, `prerelease = 0`, `release = 1`, `hotfix = 2`. `version_monotonic` is the final tiebreaker — insertion order within the same `(major, minor, patch, classification)` bucket. `--release-type=hotfix` is an explicit opt-in to non-spec ordering; `prerelease` follows the spec. Within a classification bucket, publication order determines precedence — a deliberate simplification communicated to users.

**predecessor_version_id:** The publish handler resolves the semantic predecessor once at publish time and stores it as `predecessor_version_id` on the new `point_versions` row — version-tree metadata, used for display, succession reasoning, and language-edit forward re-pointing (it drives no use case copying; server-side forward propagation was removed 2026-06-10). This also handles the edge case where a `prerelease` or `metadata` version is published after the release for the same patch already exists — the composite key query would incorrectly skip over that release (suffix_rank 0 < 1), so the handler short-circuits to it directly before falling through to the normal query. `ON DELETE RESTRICT` on the FK prevents removing a version that another version's tree history depends on.

**Why this over org-level configuration:** An org-level setting would create divergent versioning semantics across tenants on the same instance — two orgs interpreting the same version string differently. Per-publish intent keeps the behavior local and explicit.

---

## version_monotonic concurrency: lock parent point row

Concurrent publishes for the same point are serialized by taking `SELECT ... FOR UPDATE` on the parent `points` row at the start of each publish transaction.

**Why:** `version_monotonic` is application-managed. Without serialization, two concurrent publishes can read the same `MAX(version_monotonic)` and collide on the UNIQUE constraint. The parent point row is a natural serialization target — all versions for a point share the same parent, and locking it does not affect unrelated points.

---

## Draft use cases: separate table

Draft authoring is handled by a `draft_use_cases` table rather than a `status` column on `use_cases`.

**Why:** Adding a status column that transitions (draft → active) would require UPDATEs to `use_cases`, directly conflicting with the immutability trigger. A separate mutable table keeps the two concerns cleanly separated: `draft_use_cases` is freely editable, `use_cases` is the immutable record of what was published.

**Publish flow:** On publish, a new `use_case_lineages` row is created if needed, a `use_cases` row is inserted, and the draft row is deleted. Draft-publish is language-only (2026-06-10) — version attachments are created exclusively by the CLI version-publish payload; for existing lineages the new record is re-pointed forward onto existing attachments (see `publish-use-case.md`).

**lineage_id is nullable:** A draft can exist before a lineage is created (new use case) or reference an existing lineage (new version of an existing use case). When non-null, a compound FK enforces that the lineage belongs to the same point.

---

## Domains: first-class table

A `domains` table was added as a first-class entity. *(An early draft of this section scoped tenant isolation to the domain; superseded 2026-06-06 — the isolation boundary is the **organization**. Domains are an organizational concept *within* a tenant, not the tenant boundary; domain-level memberships are an explicit post-MVP exclusion in ALIGNMENT.md.)*

**Why:** The product model specifies domains as long-lived product areas, divorced from team structure, with optional nesting (sub-domains).

**Org consistency:** `points.organization_id` is enforced consistent with `domains.organization_id` via the compound FK `FOREIGN KEY (domain_id, organization_id) REFERENCES domains (id, organization_id)`. This prevents a point from claiming an org that differs from its domain's org, without a trigger.

---

## RLS: org-level, fully specified in data-model.md

Row-level security is the DB-layer tenant isolation mechanism. The isolation boundary is the **organization** *(superseded 2026-06-06; an early draft said domain, with `domain_memberships` and `app.current_user_id` — none of that survived)*.

**Prerequisites (all now specified in `data-model.md`):** `users` + `organization_memberships`; connection-level context — `sql.reserve()` + `SELECT set_config('app.current_org_id', $1, true)` per request; and `organization_id` denormalized onto all downstream tables so policies are direct column checks rather than multi-hop joins. Two roles: `aleph_app` (RLS enforced) and `aleph_service` (`BYPASSRLS`, migrations/seeding only).

---

## Point and version lifecycle: status enums

`points` and `point_versions` each have a `status` column (`active`, `deprecated`, `archived`) backed by separate Postgres enums (`point_status`, `point_version_status`).

**Why separate enums:** The two types may diverge over time. Separate enums make future additions independent.

**Archival semantics:** Archived records are not deleted — the RESTRICT FK chains make hard deletion operationally complex and destructive. Archival via status is the supported decommission path.

---

## updated_at: shared trigger function

Mutable tables (`organizations`, `domains`, `points`, `frontend_frameworks`, `frontend_components`, `component_props`) carry an `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` column managed by a shared trigger function `set_updated_at()`.

**Why trigger over application management:** The application can forget to set `updated_at`. Migrations and direct DB writes bypass application code entirely. A trigger guarantees accuracy regardless of write path. One function is defined and referenced by one trigger per table.
