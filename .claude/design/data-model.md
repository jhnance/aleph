## Tables

```sql
-- The root of the tenant hierarchy. Every `point` belongs to an organization.
-- All tenant isolation flows from this table.

-- User and membership tables are a dependency for authorization (point ownership,
-- use case editing permissions) but are out of scope for this document. They attach
-- to `organization` and inform application-layer access control.
CREATE TABLE organizations
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    slug       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slug),
    CHECK (char_length(slug) BETWEEN 1 AND 50),
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
)
    );

CREATE TYPE point_type AS ENUM ('frontend_component');
CREATE TYPE point_status AS ENUM ('active', 'deprecated', 'archived');
CREATE TYPE point_version_status AS ENUM ('active', 'deprecated', 'archived');

-- A product area with a distinct identity and focus, scoped to an organization.
-- Domains contain Points. `UNIQUE (id, organization_id)` is required as the
-- target of the compound FK on `points` that enforces domain/org consistency.
CREATE TABLE domains
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    name            TEXT        NOT NULL,
    slug            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, slug),
    UNIQUE (id, organization_id),
    CHECK (char_length(slug) BETWEEN 1 AND 50),
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
)
    );

CREATE INDEX idx_domain_organization_id ON domains (organization_id);

-- The base entity for all documented assets. The `type` column is a discriminator
-- identifying which extension table holds type-specific data.
-- `organization_id` is enforced consistent with `domain.organization_id` via the
-- compound FK — a point cannot claim an org that differs from its domain's org.
-- `UNIQUE (id, type)` and `UNIQUE (id, domain_id)` support compound FKs from
-- extension and downstream tables.
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
    UNIQUE (id, domain_id),
    FOREIGN KEY (domain_id, organization_id) REFERENCES domains (id, organization_id) ON DELETE RESTRICT
);

CREATE INDEX idx_point_organization_id ON points (organization_id);
CREATE INDEX idx_point_domain_id ON points (domain_id);

CREATE TABLE frontend_frameworks
(
    id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name)
);

-- Example: (frontend) component point type
CREATE TABLE frontend_components
(
    point_id   UUID        NOT NULL,
    type       point_type  NOT NULL CHECK (type = 'frontend_component'),
    framework  UUID REFERENCES frontend_frameworks (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_id),
    FOREIGN KEY (point_id, type) REFERENCES points (id, type) ON DELETE RESTRICT
);

-- Stable identity, scoped to a component
CREATE TABLE component_props
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    point_id   UUID        NOT NULL REFERENCES frontend_components (point_id) ON DELETE RESTRICT,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (point_id, name),
    UNIQUE (id, point_id)
);

-- A specific release of a point. `version_monotonic` is an application-managed
-- integer providing reliable total ordering within a point's history, used for
-- forward propagation queries where comparing semantic version strings is fragile.
CREATE TABLE point_versions
(
    id                UUID PRIMARY KEY              DEFAULT gen_random_uuid(),
    point_id          UUID                 NOT NULL REFERENCES points (id) ON DELETE RESTRICT,
    version_semantic  TEXT                 NOT NULL,
    version_monotonic INTEGER              NOT NULL CHECK (version_monotonic > 0),
    status            point_version_status NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ          NOT NULL DEFAULT now(),
    UNIQUE (point_id, version_semantic),
    UNIQUE (point_id, version_monotonic),
    UNIQUE (id, point_id)
);

CREATE INDEX idx_point_version_point_id ON point_versions (point_id);
CREATE INDEX idx_point_version_point_id_monotonic ON point_versions (point_id, version_monotonic);

-- Version-level metadata — this is where details live.
-- `point_id` is carried here to enable compound FKs that enforce both
-- `component_prop` and `point_version` belong to the same point.
CREATE TABLE point_version_component_props
(
    point_version_id  UUID    NOT NULL,
    component_prop_id UUID    NOT NULL,
    point_id          UUID    NOT NULL,
    prop_type         TEXT,
    required          BOOLEAN NOT NULL DEFAULT false,
    default_value     TEXT,
    description       TEXT,
    PRIMARY KEY (point_version_id, component_prop_id),
    FOREIGN KEY (point_version_id, point_id) REFERENCES point_versions (id, point_id) ON DELETE CASCADE,
    FOREIGN KEY (component_prop_id, point_id) REFERENCES component_props (id, point_id) ON DELETE RESTRICT
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
    point_id              UUID        NOT NULL REFERENCES points (id) ON DELETE RESTRICT,
    name                  TEXT        NOT NULL,
    predecessor_export_id UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (point_id, name),
    UNIQUE (id, point_id),
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
    point_version_id UUID        NOT NULL REFERENCES point_versions (id) ON DELETE CASCADE,
    export_id        UUID        NOT NULL REFERENCES point_exports (id) ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_version_id, export_id)
);

CREATE INDEX idx_pve_export_id ON point_version_exports (export_id);

-- The stable logical identity of a use case within a point. Created once when a
-- use case is first introduced; never modified after creation. All content records
-- across the lifetime of a use case share the same `lineage_id`.

-- `export_id` scopes the lineage to a specific export of the point. A `NULL`
-- `export_id` means the use case belongs to the point itself (used when the point
-- defines no exports). When non-null, the compound foreign key on
-- `(export_id, point_id)` enforces at the database level that the referenced export
-- belongs to the same point as the lineage. Postgres does not enforce a composite
-- FK when any participating column is `NULL`, so point-level lineages
-- (`export_id IS NULL`) are correctly exempt from this check.
CREATE TABLE use_case_lineages
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    point_id   UUID        NOT NULL REFERENCES points (id) ON DELETE RESTRICT,
    export_id  UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (export_id, point_id) REFERENCES point_exports (id, point_id),
    UNIQUE (point_id, export_id),
    UNIQUE (id, point_id)
);

CREATE INDEX idx_use_case_lineage_point_id ON use_case_lineages (point_id);
CREATE INDEX idx_use_case_lineage_export_id ON use_case_lineages (export_id);

-- An immutable content record. Records are never updated in place; each edit
-- creates a new row. Two columns drive history and diffing:

-- - `lineage_id` — groups all content versions of the same logical use case.
--   Serves as the join key for cross-version diff queries.
-- - `parent_id` — the derivation pointer. Tracks which specific record an edit
--   was derived from, enabling ancestry walks and edit history display.

-- In the export rename succession flow (when a user confirms continuity between
-- two exports at publish time), new content records for the successor export may
-- carry a `parent_id` pointing to the last content record from the predecessor
-- export's lineage. This is the only case where `parent_id` crosses a lineage
-- boundary, and it is a deliberate outcome of an explicit user action.

-- `point_id` is denormalized from `use_case_lineages` and is safe because both
-- `use_cases` and `use_case_lineages` are immutable after creation. It is carried
-- here to enable compound FKs on `point_version_use_cases` that enforce scope at
-- the database level without triggers.
CREATE TABLE use_cases
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    lineage_id UUID        NOT NULL,
    point_id   UUID        NOT NULL,
    parent_id  UUID REFERENCES use_cases (id) ON DELETE RESTRICT,
    title      TEXT        NOT NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, point_id),
    FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id) ON DELETE RESTRICT
);

CREATE INDEX idx_use_case_lineage_id ON use_cases (lineage_id);
CREATE INDEX idx_use_case_parent_id ON use_cases (parent_id);

-- Resolves the many-to-many relationship between `point_version` and `use_case`.
-- A pure associative table with no attributes of its own.

-- `ON DELETE CASCADE` on `point_version`: removing a version removes its use case
-- associations. `ON DELETE RESTRICT` on `use_case`: a content record cannot be
-- deleted while any version still references it.
-- `point_id` is carried here to enable compound FKs that enforce both
-- `use_case` and `point_version` belong to the same point.
CREATE TABLE point_version_use_cases
(
    point_version_id UUID        NOT NULL,
    use_case_id      UUID        NOT NULL,
    point_id         UUID        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_version_id, use_case_id),
    FOREIGN KEY (point_version_id, point_id) REFERENCES point_versions (id, point_id) ON DELETE CASCADE,
    FOREIGN KEY (use_case_id, point_id) REFERENCES use_cases (id, point_id) ON DELETE RESTRICT
);

CREATE INDEX idx_pvuc_use_case_id ON point_version_use_cases (use_case_id);

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

**version_monotonic concurrency**

All publish transactions must begin with
`SELECT id FROM points WHERE id = $1 FOR UPDATE` to lock the parent point row. This serializes concurrent publishes for the same point, preventing two transactions from reading the same
`MAX(version_monotonic)` and producing a conflict on the
`UNIQUE (point_id, version_monotonic)` constraint.

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

If a point has any version with at least one export, all use case lineages for that point must have a non-null
`export_id`. This is enforced by a trigger on `use_case_lineages`:

```sql
CREATE
OR REPLACE FUNCTION check_lineage_export_scoping()
RETURNS TRIGGER AS $$
BEGIN
    IF
NEW.export_id IS NULL AND EXISTS (
        SELECT 1
        FROM point_version_exports pve
        JOIN point_versions pv ON pv.id = pve.point_version_id
        WHERE pv.point_id = NEW.point_id
    ) THEN
        RAISE EXCEPTION 'use case lineages for points with exports must have a non-null export_id';
END IF;
RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_check_lineage_export_scoping
    BEFORE INSERT
    ON use_case_lineages
    FOR EACH ROW EXECUTE FUNCTION check_lineage_export_scoping();
```

**Rename = new export lineage**

When an export name changes between versions, the SDK/CLI treats this as the end of the old export's lineage and the creation of a new one. The schema does not prevent a client from reusing an existing point_export record with a different name — this invariant is a publishing protocol enforced by tooling, not the DB.

## Known gaps and upgrade paths

**Use case drafts and approval workflow**

Use cases are immutable once published. Draft authoring and approval are handled by a separate
`draft_use_cases` table, keeping the immutability invariant on
`use_cases` intact. A draft is promoted to
`use_cases` at publish time; the draft row is then deleted or archived.

`lineage_id` is nullable:
`NULL` means the draft is for a brand-new use case (lineage is created at publish time); non-null means it is a new content draft for an existing use case. The compound FK
`FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id)` enforces scope when non-null; Postgres skips enforcement when
`lineage_id IS NULL`.

Sketch:

```sql
CREATE TYPE draft_use_case_status AS ENUM ('draft', 'in_review');

CREATE TABLE draft_use_cases
(
    id         UUID PRIMARY KEY               DEFAULT gen_random_uuid(),
    point_id   UUID                  NOT NULL REFERENCES points (id) ON DELETE RESTRICT,
    lineage_id UUID,
    title      TEXT                  NOT NULL,
    content    TEXT                  NOT NULL,
    status     draft_use_case_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ           NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ           NOT NULL DEFAULT now(),
    FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id)
);

CREATE TRIGGER trg_set_updated_at_draft_use_cases
    BEFORE UPDATE
    ON draft_use_cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Publish semantics: if `lineage_id IS NULL`, create a new
`use_case_lineages` row first, then insert into `use_cases` with `parent_id = NULL`. If
`lineage_id IS NOT NULL`, insert into `use_cases` with
`parent_id` set to the current head of the lineage. In both cases, link the new
`use_cases` row to the target version via `point_version_use_cases` and delete the draft.

**User and membership model**

Point ownership and use case editing permissions (see use case #8 in the use-cases document) require a user table and an organization membership or point ownership join table. These gate the edit and delete operations in use-cases.ts and should be designed before those operations are exposed to end users outside a team's own organization.

**removeUseCaseFromVersion**

Not yet implemented. The semantic question of whether removal should forward-propagate (removing the use case from all later versions that still reference it) must be resolved before implementation, as changing this behavior post-launch is a breaking change in user-facing semantics.

**Row-level security**

The isolation boundary is the domain: users are members of an organization and have access to specific domains within it. RLS enforces that a user can only read and write data belonging to their authorized domains. Three prerequisites must be in place before RLS can be enabled:

1. **User and membership model.** A `users` table and a
   `domain_memberships (user_id, domain_id)` join table are required. These are out of scope for this document but must be designed before RLS policies can be written.

2. **Connection-level context.
   ** At the start of each request, the application must set session-local context identifying the current user:
   `SET LOCAL app.current_user_id = $1`. RLS policies on each table will call
   `current_setting('app.current_user_id')` to look up the user's authorized domains.

3. **Policies on each table.** Every tenant-scoped table needs an RLS policy. With `domain_id` on
   `points`, the policy is a direct column check. Downstream tables (`point_versions`,
   `use_case_lineages`, etc.) require `domain_id` to be denormalized onto them — see below.

Once these are in place, enable RLS with
`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` and define policies of the form:

```sql
CREATE
POLICY tenant_isolation ON points
    USING (
        domain_id IN (
            SELECT domain_id FROM domain_memberships
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    );
```

**domain_id propagation to hub tables**

`domain_id` currently lives only on `points`. Writing RLS policies on `point_versions`,
`use_case_lineages`, and `use_cases` without it would require multi-hop joins back to
`points` on every row evaluation — expensive and easy to get wrong.

The fix is to denormalize `domain_id` onto `point_versions` and
`use_case_lineages` using the same compound FK carrier pattern used elsewhere in this schema.
`points` already has `UNIQUE (id, domain_id)` to support this. The steps:

1. Add `domain_id UUID NOT NULL` to `point_versions` and `use_case_lineages`
2. Add `UNIQUE (id, domain_id)` to both tables
3. Replace their simple `point_id` FKs with compound FKs:
   `FOREIGN KEY (point_id, domain_id) REFERENCES points (id, domain_id)`
4. Propagate `domain_id` further to `use_cases` and the association tables using the same pattern
5. Write direct-column RLS policies on each table

This work should be done alongside the user/membership model, not before it.

result of last review:

1. point_versions is missing updated_at — its status column can change (active → deprecated → archived), making it mutable. It needs updated_at TIMESTAMPTZ
   NOT NULL DEFAULT now() and a trg_set_updated_at_point_versions trigger. We missed this when adding statuses.
2. use_case_lineages has no immutability trigger — the comment says "never modified after creation" but there's no BEFORE UPDATE trigger enforcing it,
   unlike use_cases and point_exports.
3. point_version_use_cases and point_version_component_props have no immutability triggers — both are associative rows that should never be updated (you'd
   delete and re-insert), but neither has enforcement.