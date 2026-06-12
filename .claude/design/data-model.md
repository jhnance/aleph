## Tables

```sql
-- The root of the tenant hierarchy. Every `point` belongs to an organization.
-- All tenant isolation flows from this table.
CREATE TABLE organizations
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    slug       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slug),
    CHECK (char_length(slug) BETWEEN 1 AND 50),
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
);

-- Local identity record. The source of truth for authentication is the magic
-- link / session flow; this table stores only what is needed to identify a user
-- within the application.
CREATE TABLE users
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    email      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (email)
);

-- One-time auth tokens. A row is inserted when the magic link email is sent;
-- the code_hash is SHA-256 of the plaintext token embedded in the link.
-- The row is consumed (used_at stamped) on first successful redemption and
-- never checked again — session continuity is handled by the JWT.
CREATE TABLE auth_codes
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    email      TEXT        NOT NULL,
    code_hash  TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_code_email ON auth_codes (email);
-- Redemption queries by hash (UPDATE ... WHERE code_hash = $1); unique by construction
-- (SHA-256 of 32 random bytes), so a unique index doubles as a collision guard.
CREATE UNIQUE INDEX idx_auth_code_hash ON auth_codes (code_hash);

-- No sessions table. Sessions are JWT-based: a signed HS256 JWT stored in an
-- HttpOnly cookie. The payload carries user_id, active_organization_id, and exp.
-- No DB lookup is required per request — the server verifies the signature only.
-- Org switching re-issues the JWT with the updated active_organization_id.
-- Logout deletes the cookie client-side; tokens are valid until exp (30 days).
-- A revoked_tokens table can be added later as an escape hatch for forced
-- revocation in exceptional cases (security incidents, admin-forced logout).

CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE organization_memberships
(
    user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    organization_id UUID        NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    role            org_role    NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX idx_org_membership_organization_id ON organization_memberships (organization_id);

CREATE TYPE point_type AS ENUM ('frontend_component', 'custom');
CREATE TYPE point_status AS ENUM ('active', 'deprecated', 'archived');
CREATE TYPE point_version_status AS ENUM ('active', 'deprecated', 'archived');
CREATE TYPE version_classification AS ENUM ('release', 'prerelease', 'hotfix', 'metadata');

-- A product area with a distinct identity and focus, scoped to an organization.
-- Domains contain Points. `UNIQUE (id, organization_id)` is required as the
-- target of the compound FK on `points` that enforces domain/org consistency.
CREATE TABLE domains
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    parent_id       UUID,
    name            TEXT        NOT NULL,
    slug            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, organization_id),
    CHECK (char_length(slug) BETWEEN 1 AND 50),
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
    CHECK (parent_id != id),
    FOREIGN KEY (parent_id, organization_id) REFERENCES domains (id, organization_id) ON DELETE RESTRICT
);

-- Slug uniqueness is sibling-scoped: unique among root domains within an org,
-- and unique among children of the same parent within an org.
-- Two partial indexes because UNIQUE treats NULLs as distinct — a single constraint
-- cannot express both cases when parent_id is nullable.
CREATE UNIQUE INDEX idx_domain_slug_root ON domains (organization_id, slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_domain_slug_child ON domains (organization_id, parent_id, slug) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_domain_organization_id ON domains (organization_id);

-- The base entity for all documented assets. The `type` column is a discriminator
-- identifying which extension table holds type-specific data.
-- `organization_id` is enforced consistent with `domain.organization_id` via the
-- compound FK — a point cannot claim an org that differs from its domain's org.
-- `UNIQUE (id, type)` and `UNIQUE (id, organization_id)` support compound FKs from
-- extension and downstream tables, enabling direct-column RLS policy enforcement
-- without multi-hop joins.
CREATE TABLE points
(
    id              UUID PRIMARY KEY      DEFAULT gen_random_uuid(),
    organization_id UUID         NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    domain_id       UUID         NOT NULL,
    name            TEXT         NOT NULL,
    type            point_type   NOT NULL,
    status          point_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (id, type),
    UNIQUE (id, organization_id),
    FOREIGN KEY (domain_id, organization_id) REFERENCES domains (id, organization_id) ON DELETE RESTRICT
);

CREATE INDEX idx_point_organization_id ON points (organization_id);
CREATE INDEX idx_point_domain_id ON points (domain_id);

CREATE TABLE frontend_frameworks
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations (id) ON DELETE RESTRICT,
    name            VARCHAR(50) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, organization_id)
);

-- NULL organization_id = platform-provided (globally unique by name)
-- Non-null organization_id = org-defined (unique per org)
CREATE UNIQUE INDEX idx_framework_name_global ON frontend_frameworks (name) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX idx_framework_name_org ON frontend_frameworks (organization_id, name) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_framework_organization_id ON frontend_frameworks (organization_id);

-- NULL organization_id = platform-provided; non-null = org-defined.
-- Mirrors the nullable org pattern used by frontend_frameworks.
CREATE TABLE custom_point_types
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations (id) ON DELETE RESTRICT,
    name            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX idx_custom_point_type_name_global ON custom_point_types (name) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX idx_custom_point_type_name_org ON custom_point_types (organization_id, name) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_custom_point_type_organization_id ON custom_point_types (organization_id);

-- Extension table for points of type 'custom'. custom_type_id is the label;
-- no further type-specific metadata columns exist here by design.
CREATE TABLE custom_points
(
    point_id        UUID        NOT NULL,
    organization_id UUID        NOT NULL,
    type            point_type  NOT NULL CHECK (type = 'custom'),
    custom_type_id  UUID        NOT NULL REFERENCES custom_point_types (id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_id),
    FOREIGN KEY (point_id, type) REFERENCES points (id, type) ON DELETE RESTRICT,
    FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT
);

-- Example: (frontend) component point type
CREATE TABLE frontend_components
(
    point_id        UUID        NOT NULL,
    organization_id UUID        NOT NULL,
    type            point_type  NOT NULL CHECK (type = 'frontend_component'),
    framework       UUID REFERENCES frontend_frameworks (id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_id),
    UNIQUE (point_id, organization_id),
    FOREIGN KEY (point_id, type) REFERENCES points (id, type) ON DELETE RESTRICT,
    FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT
);

-- Stable identity, scoped to a component
CREATE TABLE component_props
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    point_id        UUID        NOT NULL,
    organization_id UUID        NOT NULL,
    name            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (point_id, name),
    UNIQUE (id, point_id),
    UNIQUE (id, organization_id),
    FOREIGN KEY (point_id, organization_id) REFERENCES frontend_components (point_id, organization_id) ON DELETE RESTRICT
);

-- A specific release of a point. Semantic ordering uses the composite key
-- (version_major, version_minor, version_patch, suffix_rank, version_monotonic),
-- where suffix_rank is derived from version_classification at query time:
-- 'metadata' = 0, 'prerelease' = 0, 'release' = 1, 'hotfix' = 2. version_monotonic is the
-- final tiebreaker — insertion order within the same (major, minor, patch,
-- classification) bucket.
CREATE TABLE point_versions
(
    id                     UUID PRIMARY KEY              DEFAULT gen_random_uuid(),
    point_id               UUID                 NOT NULL,
    organization_id        UUID                 NOT NULL,
    version_semantic       TEXT                 NOT NULL,
    version_monotonic      INTEGER              NOT NULL CHECK (version_monotonic > 0),
    version_major          INTEGER              NOT NULL,
    version_minor          INTEGER              NOT NULL,
    version_patch          INTEGER              NOT NULL,
    version_classification version_classification NOT NULL DEFAULT 'release',
    predecessor_version_id UUID REFERENCES point_versions (id) ON DELETE RESTRICT,
    status                 point_version_status NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ          NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ          NOT NULL DEFAULT now(),
    UNIQUE (point_id, version_semantic),
    UNIQUE (point_id, version_monotonic),
    UNIQUE (id, point_id),
    UNIQUE (id, organization_id),
    FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT
);

CREATE INDEX idx_point_version_point_id ON point_versions (point_id);
CREATE INDEX idx_point_version_point_id_monotonic ON point_versions (point_id, version_monotonic);
CREATE INDEX idx_point_version_semantic_order ON point_versions (point_id, version_major DESC, version_minor DESC, version_patch DESC, version_monotonic DESC);

-- Version-level metadata — this is where details live.
-- `point_id` is carried here to enable compound FKs that enforce both
-- `component_prop` and `point_version` belong to the same point.
CREATE TABLE point_version_component_props
(
    point_version_id  UUID    NOT NULL,
    component_prop_id UUID    NOT NULL,
    point_id          UUID    NOT NULL,
    organization_id   UUID    NOT NULL,
    prop_type         TEXT,
    required          BOOLEAN NOT NULL DEFAULT false,
    default_value     TEXT,
    description       TEXT,
    PRIMARY KEY (point_version_id, component_prop_id),
    FOREIGN KEY (point_version_id, point_id) REFERENCES point_versions (id, point_id) ON DELETE CASCADE,
    FOREIGN KEY (component_prop_id, point_id) REFERENCES component_props (id, point_id) ON DELETE RESTRICT,
    FOREIGN KEY (point_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE CASCADE
);

-- The stable logical identity of a named export within a point. Created once when
-- an export first appears; its `name` never changes. A rename is treated as ending
-- this export's presence in the new version and creating a new `point_export` record
-- for the new name — enforced by the SDK/CLI at publish time.

-- `predecessor_export_id` optionally records export succession: when the SDK detects
-- a likely rename at publish time and the user confirms continuity, the new export
-- record carries a reference back to the one it succeeded. This enables the UI to
-- display "formerly known as X" without contaminating lineage or use case history.

-- `UNIQUE (id, point_id)` is redundant for uniqueness but required as the target of
-- the compound foreign key on `use_case_lineage`.
CREATE TABLE point_exports
(
    id                    UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    point_id              UUID        NOT NULL,
    organization_id       UUID        NOT NULL,
    name                  TEXT        NOT NULL,
    predecessor_export_id UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (point_id, name),
    UNIQUE (id, point_id),
    UNIQUE (id, organization_id),
    FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT,
    FOREIGN KEY (predecessor_export_id, point_id) REFERENCES point_exports (id, point_id) ON DELETE RESTRICT
);

CREATE INDEX idx_point_export_point_id ON point_exports (point_id);
CREATE INDEX idx_point_export_predecessor ON point_exports (predecessor_export_id);

-- Records which exports are present in a given version. This is the per-release
-- export manifest. It is immutable once a version is published. A pure associative
-- table — it carries no attributes of its own.

-- `ON DELETE CASCADE` on `point_version`: removing a version clears its manifest.
-- `ON DELETE RESTRICT` on `point_export`: a named export cannot be deleted while
-- any version still references it.
CREATE TABLE point_version_exports
(
    point_version_id UUID        NOT NULL,
    export_id        UUID        NOT NULL REFERENCES point_exports (id) ON DELETE RESTRICT,
    organization_id  UUID        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_version_id, export_id),
    FOREIGN KEY (point_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX idx_pve_export_id ON point_version_exports (export_id);

-- The stable logical identity of a use case within a point. Created once when a
-- use case is first introduced; never modified after creation. All content records
-- across the lifetime of a use case share the same `lineage_id`. The lineage id IS
-- the `id` in the use case's `.aleph.ts` file (UUIDs only, 2026-06-10).

-- Lineages carry NO export scoping (moved to `point_version_use_cases`, 2026-06-10).
-- Export scoping is a fact about a (version, use case) pair, not about the use
-- case's identity: the same lineage attaches to export `CarouselItem` in v1.0.0 and
-- to its confirmed successor `CarouselSlide` in v2.0.0 — the `.aleph.ts` file keeps
-- its `id` through the rename, so the lineage must survive it too.
CREATE TABLE use_case_lineages
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    point_id        UUID        NOT NULL,
    organization_id UUID        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT,
    UNIQUE (id, point_id),
    UNIQUE (id, organization_id)
);

CREATE INDEX idx_use_case_lineage_point_id ON use_case_lineages (point_id);

-- An immutable content record. Records are never updated in place; each edit
-- creates a new row. Two columns drive history and diffing:

-- - `lineage_id` — groups all content versions of the same logical use case.
--   Serves as the join key for cross-version diff queries.
-- - `parent_id` — the derivation pointer. Tracks which specific record an edit
--   was derived from, enabling ancestry walks and edit history display.

-- `parent_id` never crosses a lineage boundary. (An earlier design had export
-- rename succession minting successor lineages with cross-lineage parents; with
-- export scoping moved to `point_version_use_cases`, lineages survive renames and
-- that case no longer exists — 2026-06-10.)

-- `point_id` and `organization_id` are both denormalized from `use_case_lineages`
-- and are safe because both tables are immutable after creation. They are carried
-- here to enable compound FKs on `point_version_use_cases` that enforce scope at
-- the database level without triggers.
CREATE TABLE use_cases
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    lineage_id      UUID        NOT NULL,
    point_id        UUID        NOT NULL,
    organization_id UUID        NOT NULL,
    parent_id       UUID REFERENCES use_cases (id) ON DELETE RESTRICT,
    title           TEXT        NOT NULL,
    content         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, point_id),
    UNIQUE (id, organization_id),
    UNIQUE (id, lineage_id), -- FK target for point_version_use_cases (re-points stay in-lineage)
    FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id) ON DELETE RESTRICT,
    FOREIGN KEY (lineage_id, organization_id) REFERENCES use_case_lineages (id, organization_id) ON DELETE RESTRICT
);

CREATE INDEX idx_use_case_lineage_id ON use_cases (lineage_id);
CREATE INDEX idx_use_case_parent_id ON use_cases (parent_id);

-- One row = "this point version supports this use case" — the attachment the
-- catalog displays. Rows are created exclusively by the version-publish payload
-- (2026-06-10): there is no server-side forward propagation and no UI attachment
-- path. A use case appears on a version because the CLI published it there, with a
-- demo, at publish time.

-- `lineage_id` is denormalized from `use_cases` (safe: both columns immutable
-- there). It buys two guarantees: `UNIQUE (point_version_id, lineage_id)` makes
-- "two content records of one lineage on the same version" impossible, and content
-- edits re-point an attachment to the new lineage head without joins
-- (replace-don't-add). The FK on (use_case_id, lineage_id) pins the content record
-- to the claimed lineage, so a re-point can never jump lineages.

-- `export_id` records the export this use case is scoped to IN THIS VERSION
-- (NULL = point-level). Scoping moved here from `use_case_lineages` (2026-06-10):
-- it is a fact about the (version, use case) pair — lineage L attaches to
-- `CarouselItem` in v1.0.0 and to `CarouselSlide` in v2.0.0 with one identity.
-- The compound FK to `point_version_exports` enforces manifest presence
-- declaratively (the export must be in this version's manifest), replacing the
-- old trg_check_version_use_case_export_presence trigger. Postgres skips compound
-- FK enforcement when export_id IS NULL, exempting point-level rows.

-- `demo_artifact_url` is NOT NULL (2026-06-10): every attachment is born in a CLI
-- publish that built the demo and uploaded it to S3 before the version POST. There
-- is no demo-less attachment state — a UI-authored use case exists as lineage +
-- content records only, until an engineer ships its `.aleph.ts` in a subsequent
-- (possibly `metadata`-classified) version.

-- `unpublished_at` is the soft-retraction mechanism (2026-06-10). NULL = visible.
-- A claim that turns out false on a shipped version is unpublished — hidden from
-- the version's visible use case list but retained, viewable by org admins in a
-- dedicated view, and republishable by resetting to NULL. Attachment rows are
-- never deleted by user action: you can't go back in time and change what was
-- published, but you can retract the claim.

-- Mutability is narrow (see amended immutability trigger below): only
-- `use_case_id` (re-pointed forward on a lineage content edit) and
-- `unpublished_at` may change.
CREATE TABLE point_version_use_cases
(
    point_version_id  UUID        NOT NULL,
    use_case_id       UUID        NOT NULL,
    lineage_id        UUID        NOT NULL,
    export_id         UUID,                -- NULL = point-level in this version
    point_id          UUID        NOT NULL,
    organization_id   UUID        NOT NULL,
    demo_artifact_url TEXT        NOT NULL,
    unpublished_at    TIMESTAMPTZ,         -- NULL = published/visible
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_version_id, use_case_id),
    UNIQUE (point_version_id, lineage_id),
    FOREIGN KEY (point_version_id, point_id) REFERENCES point_versions (id, point_id) ON DELETE CASCADE,
    FOREIGN KEY (use_case_id, lineage_id) REFERENCES use_cases (id, lineage_id) ON DELETE RESTRICT,
    FOREIGN KEY (use_case_id, point_id) REFERENCES use_cases (id, point_id) ON DELETE RESTRICT,
    FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id) ON DELETE RESTRICT,
    FOREIGN KEY (point_version_id, export_id) REFERENCES point_version_exports (point_version_id, export_id) ON DELETE CASCADE,
    FOREIGN KEY (point_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX idx_pvuc_use_case_id ON point_version_use_cases (use_case_id);
CREATE INDEX idx_pvuc_lineage_id ON point_version_use_cases (lineage_id);

CREATE TYPE connection_type AS ENUM ('dependency', 'other');

-- A directed dependency edge between two point versions within the same org.
-- from_version_id depends on to_version_id.
-- Immutable once created — connections are established at publish time and never modified.
-- Cycles are not prevented at the DB layer; the publish workflow enforces acyclicity.
CREATE TABLE connections
(
    id              UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    organization_id UUID            NOT NULL,
    from_version_id UUID            NOT NULL,
    to_version_id   UUID            NOT NULL,
    type            connection_type NOT NULL DEFAULT 'dependency',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (from_version_id, to_version_id),
    CHECK (from_version_id != to_version_id),
    FOREIGN KEY (from_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE RESTRICT,
    FOREIGN KEY (to_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE RESTRICT
);

CREATE INDEX idx_connection_from_version ON connections (from_version_id);
CREATE INDEX idx_connection_to_version ON connections (to_version_id);
CREATE INDEX idx_connection_organization_id ON connections (organization_id);

-- Shared function for auto-updating updated_at on mutable tables
CREATE
OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at
= now();
RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_set_updated_at_users
    BEFORE UPDATE
    ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_organization_memberships
    BEFORE UPDATE
    ON organization_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_organizations
    BEFORE UPDATE
    ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_domains
    BEFORE UPDATE
    ON domains
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_points
    BEFORE UPDATE
    ON points
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_frontend_frameworks
    BEFORE UPDATE
    ON frontend_frameworks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_custom_point_types
    BEFORE UPDATE
    ON custom_point_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_custom_points
    BEFORE UPDATE
    ON custom_points
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_point_versions
    BEFORE UPDATE
    ON point_versions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_frontend_components
    BEFORE UPDATE
    ON frontend_components
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_component_props
    BEFORE UPDATE
    ON component_props
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

## Application-enforced constraints

The following invariants are not expressible as simple foreign keys and are enforced at the application layer. Each is a known risk surface for production and should be protected by thorough test coverage and, where possible, database triggers.

**Framework and custom type organization scoping**

When `frontend_components.framework` or
`custom_points.custom_type_id` is set, the application must verify that the referenced row has
`organization_id IS NULL` (platform-provided) or `organization_id` matching the point's
`organization_id`. The nullable org pattern makes this inexpressible as a single FK constraint.

**version_monotonic concurrency**

All publish transactions must begin with
`SELECT id FROM points WHERE id = $1 FOR UPDATE` to lock the parent point row. This serializes concurrent publishes for the same point, preventing two transactions from reading the same
`MAX(version_monotonic)` and producing a conflict on the
`UNIQUE (point_id, version_monotonic)` constraint.

See the open question in `./open-questions.md`.

**use_cases immutability**

Records in
`use_cases` are never updated in place; each edit creates a new row. This invariant is enforced by a trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_use_cases_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE
EXCEPTION 'use_cases records are immutable and cannot be updated';
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_use_cases_immutable
    BEFORE UPDATE
    ON use_cases
    FOR EACH ROW EXECUTE FUNCTION enforce_use_cases_immutable();
```

**point_exports immutability**

`point_exports` records are immutable after creation — the export name never changes and
`predecessor_export_id` is set at publish time. This invariant is enforced by a trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_point_exports_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE
EXCEPTION 'point_exports records are immutable and cannot be updated';
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_point_exports_immutable
    BEFORE UPDATE
    ON point_exports
    FOR EACH ROW EXECUTE FUNCTION enforce_point_exports_immutable();
```

**point_version_exports immutability**

Export manifest rows are written once at publish time and never modified. Deletions via
`ON DELETE CASCADE` when a version is removed are intentional. This invariant is enforced by a trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_point_version_exports_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE
EXCEPTION 'point_version_exports records are immutable and cannot be updated';
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_point_version_exports_immutable
    BEFORE UPDATE
    ON point_version_exports
    FOR EACH ROW EXECUTE FUNCTION enforce_point_version_exports_immutable();
```

**Export-scoping rule**

`point_version_use_cases.export_id` is nullable. `NULL` means the use case is point-level *in that
version*; non-null scopes it to a specific export *in that version*. Both are valid at any time, for
any point, regardless of whether the point has declared exports. (Scoping moved off
`use_case_lineages` on 2026-06-10 so a lineage survives export renames with one identity.)

The version-level invariant — a scoped attachment's export must be present in that version's
manifest — is enforced declaratively by the compound FK
`FOREIGN KEY (point_version_id, export_id) REFERENCES point_version_exports (point_version_id, export_id)`.
No trigger is needed (the former `trg_check_version_use_case_export_presence` is superseded);
Postgres skips compound FK enforcement when `export_id IS NULL`, exempting point-level rows.

**`use_case_lineages` immutability**

`use_case_lineages` records are never modified after creation. Enforced by trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_use_case_lineages_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE
EXCEPTION 'use_case_lineages records are immutable and cannot be updated';
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_use_case_lineages_immutable
    BEFORE UPDATE
    ON use_case_lineages
    FOR EACH ROW EXECUTE FUNCTION enforce_use_case_lineages_immutable();
```

**`point_version_use_cases` near-immutability**

Attachment rows are written once at version publish and never deleted by user action. Exactly two
columns may change after insert (2026-06-10):

- `use_case_id` — re-pointed to the new lineage head when a content edit is published
  (replace-don't-add; the FK on `(use_case_id, lineage_id)` guarantees the re-point stays in-lineage)
- `unpublished_at` — toggled by the unpublish/republish flow (soft retraction; see
  `use-cases/use-case-management/remove-use-case-from-version.md`)

Everything else is frozen by trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_point_version_use_cases_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.point_version_id IS DISTINCT FROM OLD.point_version_id
        OR NEW.lineage_id IS DISTINCT FROM OLD.lineage_id
        OR NEW.export_id IS DISTINCT FROM OLD.export_id
        OR NEW.point_id IS DISTINCT FROM OLD.point_id
        OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.demo_artifact_url IS DISTINCT FROM OLD.demo_artifact_url
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE
EXCEPTION 'point_version_use_cases rows are immutable except use_case_id (content re-point) and unpublished_at';
END IF;
RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_point_version_use_cases_immutable
    BEFORE UPDATE
    ON point_version_use_cases
    FOR EACH ROW EXECUTE FUNCTION enforce_point_version_use_cases_immutable();
```

**`point_version_component_props` immutability**

Same as `point_version_use_cases`. Enforced by trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_point_version_component_props_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE
EXCEPTION 'point_version_component_props records are immutable and cannot be updated';
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_point_version_component_props_immutable
    BEFORE UPDATE
    ON point_version_component_props
    FOR EACH ROW EXECUTE FUNCTION enforce_point_version_component_props_immutable();
```

**`connections` immutability**

Connections are written at publish time and never modified. Enforced by trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_connections_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE
EXCEPTION 'connections records are immutable and cannot be updated';
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_connections_immutable
    BEFORE UPDATE
    ON connections
    FOR EACH ROW EXECUTE FUNCTION enforce_connections_immutable();
```

**Connection acyclicity**

Cycles are not possible in the current design (2026-06-10). Connections are created only at version publish, and every edge originates at the brand-new version — which nothing can point to yet — so the version graph is a DAG by construction. (Mutual dependency between *points* is fine and is not a cycle: the version-level edges still only point backward in time.)

Be mindful when introducing later features that could create edges between two *existing* versions (e.g. a manual UI connection editor, a backfill tool): any such path makes cycles constructible and must add a cycle check (recursive CTE walk) before insert.

**Rename = new export lineage**

When an export name changes between versions, the SDK/CLI treats this as the end of the old export's lineage and the creation of a new one. The schema does not prevent a client from reusing an existing point_export record with a different name — this invariant is a publishing protocol enforced by tooling, not the DB.

## Authentication

### Magic link flow

1. User submits their email. Server generates a cryptographically random 32-byte token (
   `crypto.randomBytes(32)`), computes its SHA-256 hash, inserts a row into
   `auth_codes` with the hash and a short expiry (15 minutes), and emails the plaintext token as a magic link.
2. User clicks the link. Server hashes the token from the URL, then within a single transaction runs
   `UPDATE auth_codes SET used_at = now() WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING id`. If the update returns a row the code is valid and is now dead; if it returns nothing the code was already used or expired. The atomicity is critical — checking and stamping in separate statements opens a race condition where two requests 200ms apart can both pass the check before either stamps
   `used_at`.
3. Server upserts the
   `users` row for that email (creates it on first sign-in, finds it on return). Issues a signed JWT (HS256) containing
   `user_id`, `active_organization_id` (null if the user has no org yet), and
   `exp` (30 days). Writes the JWT as a cookie: `HttpOnly; Secure; SameSite=Lax; Path=/` (see *Session cookie attributes and CSRF*).
4. Every subsequent request: server verifies the JWT signature. No DB lookup required. The
   `active_organization_id` from the payload is set as `app.current_org_id` for RLS.
5. Org switching: server verifies the user is a member of the target org, re-issues the JWT with the updated
   `active_organization_id`, replaces the cookie.
6. Logout: delete the cookie client-side. The token remains technically valid until
   `exp` but the client no longer has it.

### JWT payload

```json
{
  "sub": "<user_id>",
  "org": "<active_organization_id | null>",
  "exp": "<unix timestamp, 30 days>",
  "iat": "<unix timestamp>",
  "jti": "<random id, for future revocation support>"
}
```

`sub` (subject), `exp` (expiration), `iat` (issued at), and
`jti` (JWT ID) are all standard registered claim names per [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519). Using standard names means JWT libraries parse them automatically and they carry unambiguous meaning to any developer reading the token.
`org` is a custom claim. `jti` is included now so that a
`revoked_tokens` table can be added later without requiring a new token format.

### Session cookie attributes and CSRF (2026-06-11)

The session JWT cookie is issued with `HttpOnly; Secure; SameSite=Lax; Path=/`.

CSRF — a hostile site causing the victim's browser to fire a cookie-bearing request at our API — is
mitigated by `SameSite=Lax`, which controls when the browser attaches the cookie to cross-site
requests:

| Cross-site request type                  | `Lax` sends the cookie? |
|------------------------------------------|-------------------------|
| Top-level GET navigation (clicked link)  | yes                     |
| POST (form submit)                       | no                      |
| fetch/XHR/img/iframe                     | no                      |

The bottom two rows are the CSRF attack surface; `Lax` closes both. The top row is what keeps deep
links shared in Slack or email working for signed-in users — `Strict` would greet them with a login
page, and for a discovery tool, shared deep links are the product.

`Lax` leans on one assumption, which is therefore load-bearing and recorded as a criterion: **no GET
endpoint mutates state under the session cookie's authority.** All mutations are
POST/PUT/PATCH/DELETE. The one state-changing GET, `/api/auth/verify`, derives no authority from the
cookie (the emailed token is the credential), so a forged navigation to it gains nothing the
attacker doesn't already hold.

Defense-in-depth on mutating routes (per the [OWASP CSRF cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)):
verify the `Origin` header against the app origin when present, and accept only
`Content-Type: application/json` — cross-site forms cannot produce that content type, and cross-site
`fetch` carrying it triggers a CORS preflight that fails.

Accepted residual risk — **login CSRF**: an attacker can top-level-navigate a victim's browser
through the attacker's *own* magic link, silently signing the victim into the attacker's account.
The payoff against a catalog tool is negligible, and the standard mitigation (CSRF-protecting the
login itself) fights the magic-link UX. Documented, not mitigated. Logged in `SECURITY.md`, which
also details the alternative password-auth design under which this risk would be cheaply mitigable.

CLI authentication is unaffected: Bearer tokens are not attached by browsers, so no CSRF surface
exists there.

### Hashing: why SHA-256 for auth codes

bcrypt is intentionally slow to resist brute force against low-entropy inputs like passwords. Magic link tokens are 32 random bytes — 2²⁵⁶ possible values. An attacker with the hash and full knowledge of the algorithm still cannot reverse it or brute force it in any practical timeframe. The slowness of bcrypt buys nothing here; SHA-256 via Node's
`crypto.createHash('sha256')` is correct.

This follows Kerckhoffs's principle: a system should be secure even if everything except the secret itself is public knowledge. The algorithm being known is irrelevant — the security comes entirely from the entropy of the token.

What would break this:

- A short or guessable token (e.g. a 6-digit numeric OTP has only 1,000,000 possible values — brute forceable without rate limiting)
- A token derived from predictable inputs (e.g. `hash(userId + timestamp)`)

`crypto.randomBytes(32)` avoids both.

### JWT signing: HS256

JWTs are signed with HMAC-SHA256 using a server-side secret stored as an environment variable. The secret should be at least 32 random bytes. Verification is pure CPU — no IO, no DB.

## Worked examples

### Scenario A — Aleph-defined type: `frontend_component`

React is platform-provided (`organization_id IS NULL`). Any org can use it; no org can modify it.

```sql
-- Seeded by Aleph
INSERT INTO frontend_frameworks (id, organization_id, name)
VALUES ('fw-react', NULL, 'React');

-- Org creates a frontend_component point
INSERT INTO points (id, organization_id, domain_id, name, type)
VALUES ('point-abc', 'org-123', 'domain-456', 'ProductCarousel', 'frontend_component');

INSERT INTO frontend_components (point_id, type, framework)
VALUES ('point-abc', 'frontend_component', 'fw-react');
```

### Scenario B — org-defined custom type

Org 123 defines a `data-pipeline` type. Org 456 cannot see, use, or modify it.

```sql
-- Created by org-123
INSERT INTO custom_point_types (id, organization_id, name)
VALUES ('cpt-pipeline', 'org-123', 'data-pipeline');

-- org-123 creates a point of that type
INSERT INTO points (id, organization_id, domain_id, name, type)
VALUES ('point-xyz', 'org-123', 'domain-456', 'OrderIngestionPipeline', 'custom');

INSERT INTO custom_points (point_id, type, custom_type_id)
VALUES ('point-xyz', 'custom', 'cpt-pipeline');

-- org-456 attempting the same assignment would fail the application-layer
-- org-scoping check — 'cpt-pipeline' is owned by org-123, not org-456.
```

### Tenant security for custom types

The invariant: an org can read platform-provided types and its own types, and can only create, update, or delete types it owns. Platform types (
`organization_id IS NULL`) are read-only for all tenants — only Aleph can seed them.

```typescript
// organizationId always comes from the authenticated session, never from the request body.

async function listCustomPointTypes(sql: Sql, organizationId: string) {
    return sql`
    SELECT * FROM custom_point_types
    WHERE organization_id IS NULL
       OR organization_id = ${organizationId}
    ORDER BY organization_id NULLS FIRST, name
  `;
}

async function createCustomPointType(sql: Sql, organizationId: string, name: string) {
    const [row] = await sql`
    INSERT INTO custom_point_types (organization_id, name)
    VALUES (${organizationId}, ${name})
    RETURNING id
  `;
    return row;
}

async function updateCustomPointType(
    sql: Sql,
    id: string,
    organizationId: string,
    name: string,
) {
    const [row] = await sql`
    UPDATE custom_point_types
    SET name = ${name}
    WHERE id = ${id} AND organization_id = ${organizationId}
    RETURNING id
  `;
    // Returns nothing if the type doesn't exist OR belongs to another org.
    // Intentionally indistinct — avoids leaking whether the id exists at all.
    // 404, not 403: tenant-hiding convention (2026-06-10) — 403 is reserved for
    // authorization denials on resources the caller can legitimately see.
    if (!row) throw new NotFoundError('Custom type not found');
}

async function deleteCustomPointType(sql: Sql, id: string, organizationId: string) {
    const [row] = await sql`
    DELETE FROM custom_point_types
    WHERE id = ${id} AND organization_id = ${organizationId}
    RETURNING id
  `;
    if (!row) throw new NotFoundError('Custom type not found');
}

// Called before INSERT INTO custom_points to enforce org-scoping.
async function assertCustomTypeInScope(sql: Sql, customTypeId: string, organizationId: string) {
    const [row] = await sql`
    SELECT organization_id FROM custom_point_types WHERE id = ${customTypeId}
  `;
    if (!row) throw new NotFoundError('Custom type not found');
    if (row.organization_id !== null && row.organization_id !== organizationId) {
        throw new ForbiddenError('Custom type does not belong to this organization');
    }
}
```

The
`WHERE id = $id AND organization_id = $orgId` pattern on update and delete is the key: it collapses existence and ownership into one query. If either condition fails the row is not returned, and a single generic error is raised — no information leakage about whether the id exists under a different tenant.

## Known gaps and upgrade paths

**Use case drafts and approval workflow**

Use cases are immutable once published. Draft authoring and approval are handled by a separate
`draft_use_cases` table, keeping the immutability invariant on
`use_cases` intact. A draft is promoted to
`use_cases` at publish time; the draft row is then deleted or archived.

`lineage_id` is `NOT NULL` (2026-06-10): every draft references a lineage from birth. For a brand-new use case the server registers the `use_case_lineages` row at draft creation — the lineage UUID is the use case's ID, shown in the UI for pasting into the codebase's `.aleph.ts`. For a revision the draft references the existing lineage. The compound FK
`FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id)` enforces scope.

Sketch:

```sql
CREATE TYPE draft_use_case_status AS ENUM ('draft', 'in_review');

CREATE TABLE draft_use_cases
(
    id              UUID PRIMARY KEY               DEFAULT gen_random_uuid(),
    point_id        UUID                  NOT NULL,
    organization_id UUID                  NOT NULL,
    lineage_id      UUID                  NOT NULL,
    title           TEXT                  NOT NULL,
    content         TEXT                  NOT NULL,
    status          draft_use_case_status NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ           NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ           NOT NULL DEFAULT now(),
    FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT,
    FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id)
);

-- organization_id is denormalized here like every other downstream table (added
-- 2026-06-10) — drafts are tenant-scoped AND mutable, so they need a direct-column
-- RLS policy more than any immutable table does.
CREATE INDEX idx_draft_use_case_organization_id ON draft_use_cases (organization_id);
CREATE INDEX idx_draft_use_case_point_id ON draft_use_cases (point_id);

CREATE TRIGGER trg_set_updated_at_draft_use_cases
    BEFORE UPDATE
    ON draft_use_cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Publish semantics (2026-06-10 — the UI is a drafting surface; it never creates version
attachments): UI draft-publish applies to **revisions only** (the lineage already has attachments) —
lock the lineage (`SELECT ... FOR UPDATE` on the `use_case_lineages` row, serializing concurrent
edit-publishes), insert into `use_cases` with `parent_id` set to the head at publish time, re-point
the lineage's attachments on the edited version and its predecessor-tree descendants to the new
record (`UPDATE point_version_use_cases SET use_case_id = ...`), and delete the draft. A
**brand-new** use case's draft has no UI publish: it is promoted to the first content record by the
CLI version publish that attaches it (version + demo at the moment it leaves draft state).

**Unpublish / republish (formerly removeUseCaseFromVersion)**

Resolved 2026-06-10. There is no hard removal and no cascade question — server-side forward
propagation no longer exists, so every attachment row is independent. Retracting a claim from a
published version sets `unpublished_at` on that one row (hidden from the version's visible list;
retained; org admins see it in a dedicated view and may republish by resetting to NULL). See
`use-cases/use-case-management/remove-use-case-from-version.md`.

**Row-level security**

The isolation boundary is the organization. RLS enforces that a request can only read and write data belonging to the org identified by
`app.current_org_id` in the session context. Four prerequisites must be in place before RLS can be enabled:

1. **User and membership model** — `users`, `organization_memberships`. ✅ Done.

2. **Connection-level context** — At the start of each request, the Fastify `preHandler` calls
   `sql.reserve()`, begins a transaction, and runs
   `SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`
   using the `org` and `sub` claims from the verified JWT (`app.current_user_id` added 2026-06-11
   for the user-keyed identity-plane policies). (`set_config(..., true)` is transaction-local —
   identical semantics to `SET LOCAL` — and accepts a bind parameter, which `SET` does not.) ✅ Done.

3. **`organization_id` denormalized onto all downstream tables
   ** — so RLS policies are direct column checks with no multi-hop joins. ✅ Done.

4. **Service role** — a
   `BYPASSRLS` role for migrations and seeding, separate from the application role. See below.

Once all four are in place, enable RLS on each tenant-scoped table:

```sql
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points FORCE ROW LEVEL SECURITY;
-- owner also subject to policies
-- repeat for all tenant-scoped tables
```

The policy shape for tables with non-nullable `organization_id`:

```sql
CREATE
POLICY tenant_isolation ON points
    USING (organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
```

The `true` argument to
`current_setting` returns NULL instead of raising an error when the variable is not set — which causes the policy to deny all access, a safe default.

Tables with nullable `organization_id` (platform-provided data) need **per-command policies**
(2026-06-11). A single `FOR ALL` policy is wrong here: `USING` governs which existing rows a
command may *target* — including UPDATE and DELETE — and DELETE never consults `WITH CHECK` at all.
A broad `USING` (platform + own rows) would let any tenant DELETE a platform row outright, or
UPDATE one and set `organization_id` to its own org (which passes `WITH CHECK`), hijacking the row
out from under every other tenant. Platform rows should be visible to reads and targetable by
nothing else:

```sql
CREATE POLICY frameworks_select ON frontend_frameworks FOR SELECT
    USING (organization_id IS NULL
        OR organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY frameworks_insert ON frontend_frameworks FOR INSERT
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY frameworks_update ON frontend_frameworks FOR UPDATE
    USING (organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY frameworks_delete ON frontend_frameworks FOR DELETE
    USING (organization_id = current_setting('app.current_org_id', true)::uuid);
```

The same four-policy shape applies to `custom_point_types`. The access matrix (per the ALIGNMENT.md
convention — every cell derived from documented `CREATE POLICY` semantics, not from intent):

| Command | Own-org row | Platform row (`org IS NULL`)  | Other-org row           |
|---------|-------------|-------------------------------|-------------------------|
| SELECT  | visible     | visible                       | filtered out            |
| INSERT  | allowed     | denied (`WITH CHECK` fails)   | denied (`WITH CHECK`)   |
| UPDATE  | allowed     | denied (not a visible target) | denied (not a target)   |
| DELETE  | allowed     | denied (not a visible target) | denied (not a target)   |

Platform rows are seeded and maintained exclusively through `aleph_service` (`BYPASSRLS`); the
application role has no path to them beyond SELECT.

**Identity-plane (pre-org) tables**

`auth_codes`, `users`, `organizations`, and `organization_memberships` exist before or outside any
single org context, so the org-keyed policy cannot cover them. The posture is hybrid (2026-06-11),
decided per table by what session context exists at the moment the table is touched:

- **`auth_codes`, `users` — RLS-exempt, with documented app guards.** Both are touched by
  unauthenticated flows (magic-link request and redemption), where no session variable exists to
  key a policy on. The guards, all confined to the auth module: `auth_codes` is written only by the
  link-request INSERT and consumed only by the atomic hash-keyed `UPDATE ... RETURNING`; `users` is
  written only by the email upsert at redemption and read by `id = <JWT sub>` (self) or via an
  active-org membership join (member lists). Neither table is ever queried with caller-supplied
  identifiers beyond the code hash and the session's own ids.

- **`organizations`, `organization_memberships` — user-keyed policies.** Every query against them is
  authenticated, and their rows are the cross-tenant facts (who belongs to which org). Keyed on
  `app.current_user_id`, set by the preHandler alongside `app.current_org_id`:

```sql
-- Symmetric USING/WITH CHECK: the nullable-org hole above came from *asymmetric*
-- clauses on a FOR ALL policy; with both clauses identical there is no
-- broader-than-intended target surface.
CREATE POLICY memberships_self_or_active_org ON organization_memberships
    USING (user_id = current_setting('app.current_user_id', true)::uuid
        OR organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid
        OR organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY orgs_select ON organizations FOR SELECT
    USING (EXISTS (SELECT 1
                   FROM organization_memberships m
                   WHERE m.organization_id = organizations.id
                     AND m.user_id = current_setting('app.current_user_id', true)::uuid));

-- INSERT requires only an authenticated user: a membership-keyed WITH CHECK is
-- impossible here, because the owner membership row FK-references the org row and
-- therefore cannot exist when this policy evaluates. Any signed-in user may create
-- an org; the same transaction inserts their owner membership immediately after.
CREATE POLICY orgs_insert ON organizations FOR INSERT
    WITH CHECK (current_setting('app.current_user_id', true) IS NOT NULL);

CREATE POLICY orgs_update ON organizations FOR UPDATE
    USING (EXISTS (SELECT 1
                   FROM organization_memberships m
                   WHERE m.organization_id = organizations.id
                     AND m.user_id = current_setting('app.current_user_id', true)::uuid))
    WITH CHECK (EXISTS (SELECT 1
                        FROM organization_memberships m
                        WHERE m.organization_id = organizations.id
                          AND m.user_id = current_setting('app.current_user_id', true)::uuid));

CREATE POLICY orgs_delete ON organizations FOR DELETE
    USING (EXISTS (SELECT 1
                   FROM organization_memberships m
                   WHERE m.organization_id = organizations.id
                     AND m.user_id = current_setting('app.current_user_id', true)::uuid));
```

The `EXISTS` subquery is itself subject to the memberships policy (RLS applies recursively; no
recursion hazard — that policy doesn't reference `organizations`), and its user-id branch grants
exactly the rows the subquery needs. Unset variables make `current_setting(..., true)` return NULL,
which fails every comparison — default deny.

Access matrices (every cell from documented `CREATE POLICY` semantics; actor is a session with
`app.current_user_id = U`, `app.current_org_id = A`):

| `organizations` | Org U belongs to | Org U doesn't belong to | No session vars set |
|-----------------|------------------|-------------------------|---------------------|
| SELECT          | visible          | filtered out            | denied              |
| INSERT          | n/a (new row)    | allowed for any authenticated user | denied   |
| UPDATE          | allowed (role checks stay app-layer) | not a visible target | denied |
| DELETE          | allowed (role checks stay app-layer) | not a visible target | denied |

| `organization_memberships` | Own row (`user_id = U`) | Row in active org A | Any other row | No session vars |
|----------------------------|--------------------------|---------------------|---------------|-----------------|
| all commands               | allowed                  | allowed (role checks stay app-layer) | denied / invisible | denied |

Two flow-level consequences, both documented as acceptance criteria: the **login transaction** reads
`organization_memberships` (to pick the JWT's default org) before any preHandler ran, so it must
call `set_config('app.current_user_id', ...)` manually right after the user upsert (see
`use-cases/auth/magic-link-sign-in.md`); and the **invite flow** (review checklist 4.1, not yet
designed) must re-check the memberships INSERT branches when it lands — inserting a row for
*another* user relies on the active-org branch.

**Service role**

Migrations, seeding, and admin operations must bypass RLS. This is handled by two Postgres roles:

- `aleph_app` — used by the Fastify process; RLS enforced via policies
- `aleph_service` — used by migrations and seeding only; granted
  `BYPASSRLS`; never used by the web application process

```sql
CREATE ROLE aleph_app NOLOGIN;
CREATE ROLE aleph_service BYPASSRLS NOLOGIN;

-- Grant schema access
GRANT
USAGE
ON
SCHEMA
public TO aleph_app;
GRANT USAGE ON SCHEMA
public TO aleph_service;

-- Application role: DML only
GRANT
SELECT,
INSERT
,
UPDATE,
DELETE
ON ALL TABLES IN SCHEMA public TO aleph_app;

-- Service role: full access for migrations and seeding
GRANT
ALL
ON ALL TABLES IN SCHEMA public TO aleph_service;
GRANT ALL
ON ALL SEQUENCES IN SCHEMA public TO aleph_service;

-- Database users with login credentials (passwords via env vars)
CREATE
USER aleph_app_user WITH PASSWORD '...' IN ROLE aleph_app;
CREATE
USER aleph_service_user WITH PASSWORD '...' IN ROLE aleph_service;
```

The application's postgres.js instance connects as
`aleph_app_user`. The migration runner connects as
`aleph_service_user` via a separate connection string. These must never be swapped.

**`organization_id` propagation to downstream tables**

`organization_id` currently lives on `organizations`, `domains`, and
`points`. Writing RLS policies on downstream tables without it would require multi-hop joins back to
`points` on every row evaluation — expensive and error-prone.

The pattern is uniform across all ten affected tables: add `organization_id UUID NOT NULL`, add
`UNIQUE (id, organization_id)` where the table is itself a compound FK target, and replace (or supplement) the nearest upstream FK with a compound FK that includes
`organization_id`. `points` now has `UNIQUE (id, organization_id)` as the anchor.

Tables and their compound FK source:

| Table                           | Compound FK target                                |
|---------------------------------|---------------------------------------------------|
| `point_versions`                | `points (id, organization_id)`                    |
| `point_exports`                 | `points (id, organization_id)`                    |
| `use_case_lineages`             | `points (id, organization_id)`                    |
| `use_cases`                     | `use_case_lineages (id, organization_id)`         |
| `frontend_components`           | `points (id, organization_id)`                    |
| `custom_points`                 | `points (id, organization_id)`                    |
| `component_props`               | `frontend_components (point_id, organization_id)` |
| `point_version_exports`         | `point_versions (id, organization_id)`            |
| `point_version_use_cases`       | `point_versions (id, organization_id)`            |
| `point_version_component_props` | `point_versions (id, organization_id)`            |

Tables that are compound FK targets themselves also need `UNIQUE (id, organization_id)`:
`point_versions`, `point_exports`, `use_case_lineages`, `use_cases`, `frontend_components`.

## References

**Authentication and session management**

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — canonical reference for authentication implementation, including passwordless / token-based methods
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — session token generation,
  `HttpOnly` cookie requirements, token entropy (minimum 128 bits), and session hijacking mitigations
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) — covers URL token patterns that are structurally identical to magic links
- [NIST SP 800-63B-4](https://csrc.nist.gov/pubs/sp/800/63/b/4/final) — US federal standard on authenticator assurance levels, token entropy requirements, and credential lifecycle management (July 2025, supersedes 800-63B)
- [FusionAuth: Magic Links — A Guide to Passwordless Authentication](https://fusionauth.io/articles/identity-basics/magic-links) — practical implementation guide from a reputable auth vendor; covers token expiry, single-use enforcement, and security tradeoffs
- [Security Boulevard: Are Magic Links Secure? A Technical Deep Dive](https://securityboulevard.com/2026/05/are-magic-links-secure-a-technical-deep-dive-into-email-based-authentication/) — covers the race condition attack on
  `used_at` checks and the 2024 incident where concurrent clicks bypassed single-use enforcement

**RLS and multitenancy with postgres.js**

- [AWS: Multi-tenant data isolation with PostgreSQL Row Level Security](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) — authoritative walkthrough of the
  `SET LOCAL` + transaction pattern for tenant context; confirms why `SET LOCAL` (not
  `SET`) is required with connection pools
- [postgres.js (porsager/postgres)](https://github.com/porsager/postgres) — official postgres.js repo; README documents
  `sql.reserve()` for holding a dedicated connection across a request lifecycle, and
  `sql.begin()` for transaction-scoped context
- [Prisma issue #5128: Supporting session-dependent queries across requests](https://github.com/prisma/prisma/issues/5128) — cross-library confirmation that spanning
  `SET LOCAL` across a request requires a reserved connection; the problem and solution are not postgres.js-specific

