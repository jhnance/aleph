blaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

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
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
)
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
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

-- A specific release of a point. `version_monotonic` is an application-managed
-- integer providing reliable total ordering within a point's history, used for
-- forward propagation queries where comparing semantic version strings is fragile.
CREATE TABLE point_versions
(
    id                UUID PRIMARY KEY              DEFAULT gen_random_uuid(),
    point_id          UUID                 NOT NULL,
    organization_id   UUID                 NOT NULL,
    version_semantic  TEXT                 NOT NULL,
    version_monotonic INTEGER              NOT NULL CHECK (version_monotonic > 0),
    status            point_version_status NOT NULL DEFAULT 'active',
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
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    point_id        UUID        NOT NULL,
    organization_id UUID        NOT NULL,
    export_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT,
    FOREIGN KEY (export_id, point_id) REFERENCES point_exports (id, point_id),
    UNIQUE (point_id, export_id),
    UNIQUE (id, point_id),
    UNIQUE (id, organization_id)
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
    FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id) ON DELETE RESTRICT,
    FOREIGN KEY (lineage_id, organization_id) REFERENCES use_case_lineages (id, organization_id) ON DELETE RESTRICT
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
    organization_id  UUID        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (point_version_id, use_case_id),
    FOREIGN KEY (point_version_id, point_id) REFERENCES point_versions (id, point_id) ON DELETE CASCADE,
    FOREIGN KEY (use_case_id, point_id) REFERENCES use_cases (id, point_id) ON DELETE RESTRICT,
    FOREIGN KEY (point_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX idx_pvuc_use_case_id ON point_version_use_cases (use_case_id);

CREATE TYPE connection_type AS ENUM ('dependency', 'other');

-- A directed dependency edge between two point versions within the same org.
-- from_version_id depends on to_version_id.
-- Immutable once created — connections are established at publish time and never modified.
-- Cycles are not prevented at the DB layer; the publish workflow enforces acyclicity.
CREATE TABLE connections
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL,
    from_version_id UUID        NOT NULL,
    to_version_id   UUID        NOT NULL,
    type            connection_type NOT NULL DEFAULT 'dependency',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
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

**`point_version_use_cases` immutability**

Associative rows are written once and never updated — remove and re-insert instead. Enforced by trigger:

```sql
CREATE
OR REPLACE FUNCTION enforce_point_version_use_cases_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE
EXCEPTION 'point_version_use_cases records are immutable and cannot be updated';
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
CREATE OR REPLACE FUNCTION enforce_connections_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'connections records are immutable and cannot be updated';
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER trg_connections_immutable
    BEFORE UPDATE
    ON connections
    FOR EACH ROW EXECUTE FUNCTION enforce_connections_immutable();
```

**Connection acyclicity**

The schema does not prevent cycles (A → B → A). The publish workflow must detect and reject any connection that would introduce a cycle, using a recursive CTE graph walk before inserting.

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
   `exp` (30 days). Writes the JWT as an `HttpOnly` cookie.
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
    if (!row) throw new ForbiddenError('Custom type not found or not owned by this organization');
}

async function deleteCustomPointType(sql: Sql, id: string, organizationId: string) {
    const [row] = await sql`
    DELETE FROM custom_point_types
    WHERE id = ${id} AND organization_id = ${organizationId}
    RETURNING id
  `;
    if (!row) throw new ForbiddenError('Custom type not found or not owned by this organization');
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

**removeUseCaseFromVersion**

Not yet implemented. The semantic question of whether removal should forward-propagate (removing the use case from all later versions that still reference it) must be resolved before implementation, as changing this behavior post-launch is a breaking change in user-facing semantics.

**Row-level security**

The isolation boundary is the organization. RLS enforces that a request can only read and write data belonging to the org identified by
`app.current_org_id` in the session context. Four prerequisites must be in place before RLS can be enabled:

1. **User and membership model** — `users`, `organization_memberships`. ✅ Done.

2. **Connection-level context** — At the start of each request, the Fastify `preHandler` calls
   `sql.reserve()`, begins a transaction, and runs `SET LOCAL app.current_org_id = $1` using the
   `active_organization_id` from the verified JWT. ✅ Done.

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

The policy shape for tables with nullable `organization_id` (platform-provided data):

```sql
CREATE
POLICY tenant_isolation ON frontend_frameworks
    USING (organization_id IS NULL OR organization_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
```

`USING` (read) allows both platform and org rows.
`WITH CHECK` (write) restricts writes to org-owned rows only — platform rows have
`organization_id IS NULL`, which can never match a real org UUID.

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

