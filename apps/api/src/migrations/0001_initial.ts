import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // --- ENUMs ---

  await sql`CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'viewer')`.execute(db)
  await sql`CREATE TYPE point_type AS ENUM ('frontend_component', 'custom')`.execute(db)
  await sql`CREATE TYPE point_status AS ENUM ('active', 'deprecated', 'archived')`.execute(db)
  await sql`CREATE TYPE point_version_status AS ENUM ('active', 'deprecated', 'archived')`.execute(db)
  await sql`CREATE TYPE version_classification AS ENUM ('release', 'prerelease', 'hotfix', 'metadata')`.execute(db)
  await sql`CREATE TYPE connection_type AS ENUM ('dependency', 'other')`.execute(db)

  // --- Core identity tables ---

  await sql`
    CREATE TABLE organizations (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT        NOT NULL,
      slug       TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (slug),
      CHECK (char_length(slug) BETWEEN 1 AND 50),
      CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
    )
  `.execute(db)

  await sql`
    CREATE TABLE users (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (email)
    )
  `.execute(db)

  await sql`
    CREATE TABLE auth_codes (
      id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email              TEXT        NOT NULL,
      code_hash          TEXT        NOT NULL,
      expires_at         TIMESTAMPTZ NOT NULL,
      used_at            TIMESTAMPTZ,
      device_code_hash   TEXT,
      device_consumed_at TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.execute(db)

  await sql`CREATE INDEX idx_auth_code_email ON auth_codes (email)`.execute(db)
  await sql`CREATE UNIQUE INDEX idx_auth_code_hash ON auth_codes (code_hash)`.execute(db)
  await sql`CREATE UNIQUE INDEX idx_auth_code_device_hash ON auth_codes (device_code_hash) WHERE device_code_hash IS NOT NULL`.execute(db)

  await sql`
    CREATE TABLE organization_memberships (
      user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
      organization_id UUID        NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
      role            org_role    NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, organization_id)
    )
  `.execute(db)

  await sql`CREATE INDEX idx_org_membership_organization_id ON organization_memberships (organization_id)`.execute(db)

  await sql`
    CREATE TABLE org_invitations (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID        NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
      email           TEXT        NOT NULL,
      role            org_role    NOT NULL CHECK (role <> 'owner'),
      invited_by      UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
      code_hash       TEXT        NOT NULL,
      expires_at      TIMESTAMPTZ NOT NULL,
      accepted_at     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.execute(db)

  await sql`CREATE UNIQUE INDEX idx_org_invitation_code_hash ON org_invitations (code_hash)`.execute(db)
  await sql`CREATE INDEX idx_org_invitation_email ON org_invitations (email)`.execute(db)
  await sql`CREATE INDEX idx_org_invitation_organization_id ON org_invitations (organization_id)`.execute(db)
  await sql`
    CREATE UNIQUE INDEX idx_org_invitation_live ON org_invitations (organization_id, email)
      WHERE accepted_at IS NULL
  `.execute(db)

  // --- Domain / point hierarchy ---

  await sql`
    CREATE TABLE domains (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
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
    )
  `.execute(db)

  await sql`CREATE UNIQUE INDEX idx_domain_slug_root ON domains (organization_id, slug) WHERE parent_id IS NULL`.execute(db)
  await sql`CREATE UNIQUE INDEX idx_domain_slug_child ON domains (organization_id, parent_id, slug) WHERE parent_id IS NOT NULL`.execute(db)
  await sql`CREATE INDEX idx_domain_organization_id ON domains (organization_id)`.execute(db)

  await sql`
    CREATE TABLE domain_contacts (
      user_id         UUID        NOT NULL,
      organization_id UUID        NOT NULL,
      domain_id       UUID        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, domain_id),
      FOREIGN KEY (user_id, organization_id) REFERENCES organization_memberships (user_id, organization_id) ON DELETE CASCADE,
      FOREIGN KEY (domain_id, organization_id) REFERENCES domains (id, organization_id) ON DELETE CASCADE
    )
  `.execute(db)

  await sql`CREATE INDEX idx_domain_contact_domain_id ON domain_contacts (domain_id)`.execute(db)

  await sql`
    CREATE TABLE points (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID         NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
      domain_id       UUID         NOT NULL,
      name            TEXT         NOT NULL,
      type            point_type   NOT NULL,
      status          point_status NOT NULL,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      UNIQUE (id, type),
      UNIQUE (id, organization_id),
      FOREIGN KEY (domain_id, organization_id) REFERENCES domains (id, organization_id) ON DELETE RESTRICT
    )
  `.execute(db)

  await sql`CREATE INDEX idx_point_organization_id ON points (organization_id)`.execute(db)
  await sql`CREATE INDEX idx_point_domain_id ON points (domain_id)`.execute(db)

  await sql`
    CREATE TABLE point_roles (
      user_id         UUID        NOT NULL,
      organization_id UUID        NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
      point_id        UUID        NOT NULL,
      role            org_role    NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, point_id),
      FOREIGN KEY (user_id, organization_id) REFERENCES organization_memberships (user_id, organization_id) ON DELETE CASCADE,
      FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE CASCADE
    )
  `.execute(db)

  await sql`CREATE INDEX idx_point_role_point_id ON point_roles (point_id)`.execute(db)

  // --- Type extension tables ---

  await sql`
    CREATE TABLE frontend_frameworks (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID        REFERENCES organizations (id) ON DELETE RESTRICT,
      name            VARCHAR(50) NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (id, organization_id)
    )
  `.execute(db)

  await sql`CREATE UNIQUE INDEX idx_framework_name_global ON frontend_frameworks (name) WHERE organization_id IS NULL`.execute(db)
  await sql`CREATE UNIQUE INDEX idx_framework_name_org ON frontend_frameworks (organization_id, name) WHERE organization_id IS NOT NULL`.execute(db)
  await sql`CREATE INDEX idx_framework_organization_id ON frontend_frameworks (organization_id)`.execute(db)

  await sql`
    CREATE TABLE custom_point_types (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID        REFERENCES organizations (id) ON DELETE RESTRICT,
      name            TEXT        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (id, organization_id)
    )
  `.execute(db)

  await sql`CREATE UNIQUE INDEX idx_custom_point_type_name_global ON custom_point_types (name) WHERE organization_id IS NULL`.execute(db)
  await sql`CREATE UNIQUE INDEX idx_custom_point_type_name_org ON custom_point_types (organization_id, name) WHERE organization_id IS NOT NULL`.execute(db)
  await sql`CREATE INDEX idx_custom_point_type_organization_id ON custom_point_types (organization_id)`.execute(db)

  await sql`
    CREATE TABLE custom_points (
      point_id        UUID        NOT NULL,
      organization_id UUID        NOT NULL,
      type            point_type  NOT NULL CHECK (type = 'custom'),
      custom_type_id  UUID        NOT NULL REFERENCES custom_point_types (id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (point_id),
      FOREIGN KEY (point_id, type) REFERENCES points (id, type) ON DELETE RESTRICT,
      FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT
    )
  `.execute(db)

  await sql`
    CREATE TABLE frontend_components (
      point_id        UUID        NOT NULL,
      organization_id UUID        NOT NULL,
      type            point_type  NOT NULL CHECK (type = 'frontend_component'),
      framework       UUID        REFERENCES frontend_frameworks (id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (point_id),
      UNIQUE (point_id, organization_id),
      FOREIGN KEY (point_id, type) REFERENCES points (id, type) ON DELETE RESTRICT,
      FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT
    )
  `.execute(db)

  await sql`
    CREATE TABLE component_props (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      point_id        UUID        NOT NULL,
      organization_id UUID        NOT NULL,
      name            TEXT        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (point_id, name),
      UNIQUE (id, point_id),
      UNIQUE (id, organization_id),
      FOREIGN KEY (point_id, organization_id) REFERENCES frontend_components (point_id, organization_id) ON DELETE RESTRICT
    )
  `.execute(db)

  // --- Versioning ---

  await sql`
    CREATE TABLE point_versions (
      id                     UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
      point_id               UUID                   NOT NULL,
      organization_id        UUID                   NOT NULL,
      version_semantic       TEXT                   NOT NULL,
      version_monotonic      INTEGER                NOT NULL CHECK (version_monotonic > 0),
      version_major          INTEGER                NOT NULL,
      version_minor          INTEGER                NOT NULL,
      version_patch          INTEGER                NOT NULL,
      version_classification version_classification NOT NULL,
      predecessor_version_id UUID                   REFERENCES point_versions (id) ON DELETE RESTRICT,
      status                 point_version_status   NOT NULL,
      created_at             TIMESTAMPTZ            NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ            NOT NULL DEFAULT now(),
      UNIQUE (point_id, version_semantic),
      UNIQUE (point_id, version_monotonic),
      UNIQUE (id, point_id),
      UNIQUE (id, organization_id),
      FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT
    )
  `.execute(db)

  await sql`CREATE INDEX idx_point_version_point_id ON point_versions (point_id)`.execute(db)
  await sql`CREATE INDEX idx_point_version_point_id_monotonic ON point_versions (point_id, version_monotonic)`.execute(db)
  await sql`CREATE INDEX idx_point_version_semantic_order ON point_versions (point_id, version_major DESC, version_minor DESC, version_patch DESC, version_monotonic DESC)`.execute(db)
  await sql`CREATE INDEX idx_point_version_predecessor ON point_versions (predecessor_version_id) WHERE predecessor_version_id IS NOT NULL`.execute(db)

  await sql`
    CREATE TABLE point_version_component_props (
      point_version_id  UUID    NOT NULL,
      component_prop_id UUID    NOT NULL,
      point_id          UUID    NOT NULL,
      organization_id   UUID    NOT NULL,
      prop_type         TEXT,
      required          BOOLEAN NOT NULL,
      default_value     TEXT,
      description       TEXT,
      PRIMARY KEY (point_version_id, component_prop_id),
      FOREIGN KEY (point_version_id, point_id) REFERENCES point_versions (id, point_id) ON DELETE CASCADE,
      FOREIGN KEY (component_prop_id, point_id) REFERENCES component_props (id, point_id) ON DELETE RESTRICT,
      FOREIGN KEY (point_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE CASCADE
    )
  `.execute(db)

  // --- Exports ---

  await sql`
    CREATE TABLE point_exports (
      id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
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
    )
  `.execute(db)

  await sql`CREATE INDEX idx_point_export_point_id ON point_exports (point_id)`.execute(db)
  await sql`CREATE INDEX idx_point_export_predecessor ON point_exports (predecessor_export_id)`.execute(db)

  await sql`
    CREATE TABLE point_version_exports (
      point_version_id UUID        NOT NULL,
      export_id        UUID        NOT NULL REFERENCES point_exports (id) ON DELETE RESTRICT,
      organization_id  UUID        NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (point_version_id, export_id),
      FOREIGN KEY (point_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE CASCADE
    )
  `.execute(db)

  await sql`CREATE INDEX idx_pve_export_id ON point_version_exports (export_id)`.execute(db)

  // --- Use cases ---

  await sql`
    CREATE TABLE use_case_lineages (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      point_id        UUID        NOT NULL,
      organization_id UUID        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT,
      UNIQUE (id, point_id),
      UNIQUE (id, organization_id)
    )
  `.execute(db)

  await sql`CREATE INDEX idx_use_case_lineage_point_id ON use_case_lineages (point_id)`.execute(db)

  await sql`
    CREATE TABLE use_cases (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      lineage_id      UUID        NOT NULL,
      point_id        UUID        NOT NULL,
      organization_id UUID        NOT NULL,
      parent_id       UUID        REFERENCES use_cases (id) ON DELETE RESTRICT,
      title           TEXT        NOT NULL,
      content         TEXT        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (id, point_id),
      UNIQUE (id, organization_id),
      UNIQUE (id, lineage_id),
      FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id) ON DELETE RESTRICT,
      FOREIGN KEY (lineage_id, organization_id) REFERENCES use_case_lineages (id, organization_id) ON DELETE RESTRICT
    )
  `.execute(db)

  await sql`CREATE INDEX idx_use_case_lineage_id ON use_cases (lineage_id)`.execute(db)
  await sql`CREATE INDEX idx_use_case_parent_id ON use_cases (parent_id)`.execute(db)

  await sql`
    CREATE TABLE point_version_use_cases (
      point_version_id  UUID        NOT NULL,
      use_case_id       UUID        NOT NULL,
      lineage_id        UUID        NOT NULL,
      export_id         UUID,
      point_id          UUID        NOT NULL,
      organization_id   UUID        NOT NULL,
      demo_artifact_url TEXT        NOT NULL,
      unpublished_at    TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (point_version_id, use_case_id),
      UNIQUE (point_version_id, lineage_id),
      FOREIGN KEY (point_version_id, point_id) REFERENCES point_versions (id, point_id) ON DELETE CASCADE,
      FOREIGN KEY (use_case_id, lineage_id) REFERENCES use_cases (id, lineage_id) ON DELETE RESTRICT,
      FOREIGN KEY (use_case_id, point_id) REFERENCES use_cases (id, point_id) ON DELETE RESTRICT,
      FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id) ON DELETE RESTRICT,
      FOREIGN KEY (point_version_id, export_id) REFERENCES point_version_exports (point_version_id, export_id) ON DELETE CASCADE,
      FOREIGN KEY (point_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE CASCADE
    )
  `.execute(db)

  await sql`CREATE INDEX idx_pvuc_use_case_id ON point_version_use_cases (use_case_id)`.execute(db)
  await sql`CREATE INDEX idx_pvuc_lineage_id ON point_version_use_cases (lineage_id)`.execute(db)

  // --- Connections ---

  await sql`
    CREATE TABLE connections (
      id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID            NOT NULL,
      from_version_id UUID            NOT NULL,
      to_version_id   UUID            NOT NULL,
      type            connection_type NOT NULL,
      created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
      UNIQUE (from_version_id, to_version_id),
      CHECK (from_version_id != to_version_id),
      FOREIGN KEY (from_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE RESTRICT,
      FOREIGN KEY (to_version_id, organization_id) REFERENCES point_versions (id, organization_id) ON DELETE RESTRICT
    )
  `.execute(db)

  await sql`CREATE INDEX idx_connection_from_version ON connections (from_version_id)`.execute(db)
  await sql`CREATE INDEX idx_connection_to_version ON connections (to_version_id)`.execute(db)
  await sql`CREATE INDEX idx_connection_organization_id ON connections (organization_id)`.execute(db)

  // --- Use case drafts ---

  await sql`
    CREATE TABLE draft_use_cases (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      point_id        UUID        NOT NULL,
      organization_id UUID        NOT NULL,
      lineage_id      UUID        NOT NULL,
      title           TEXT        NOT NULL,
      content         TEXT        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      FOREIGN KEY (point_id, organization_id) REFERENCES points (id, organization_id) ON DELETE RESTRICT,
      FOREIGN KEY (lineage_id, point_id) REFERENCES use_case_lineages (id, point_id)
    )
  `.execute(db)

  await sql`CREATE INDEX idx_draft_use_case_organization_id ON draft_use_cases (organization_id)`.execute(db)
  await sql`CREATE INDEX idx_draft_use_case_point_id ON draft_use_cases (point_id)`.execute(db)

  // --- updated_at trigger ---

  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  const updatedAtTables = [
    'users',
    'organizations',
    'organization_memberships',
    'point_roles',
    'domains',
    'points',
    'frontend_frameworks',
    'custom_point_types',
    'custom_points',
    'frontend_components',
    'component_props',
    'point_versions',
    'draft_use_cases',
  ]

  for (const table of updatedAtTables) {
    await sql`
      CREATE TRIGGER ${sql.raw(`trg_set_updated_at_${table}`)}
        BEFORE UPDATE ON ${sql.table(table)}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `.execute(db)
  }

  // --- Immutability triggers ---

  await sql`
    CREATE OR REPLACE FUNCTION enforce_use_cases_immutable()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'use_cases records are immutable and cannot be updated';
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER trg_use_cases_immutable
      BEFORE UPDATE ON use_cases
      FOR EACH ROW EXECUTE FUNCTION enforce_use_cases_immutable()
  `.execute(db)

  await sql`
    CREATE OR REPLACE FUNCTION enforce_point_exports_immutable()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'point_exports records are immutable and cannot be updated';
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER trg_point_exports_immutable
      BEFORE UPDATE ON point_exports
      FOR EACH ROW EXECUTE FUNCTION enforce_point_exports_immutable()
  `.execute(db)

  await sql`
    CREATE OR REPLACE FUNCTION enforce_point_version_exports_immutable()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'point_version_exports records are immutable and cannot be updated';
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER trg_point_version_exports_immutable
      BEFORE UPDATE ON point_version_exports
      FOR EACH ROW EXECUTE FUNCTION enforce_point_version_exports_immutable()
  `.execute(db)

  await sql`
    CREATE OR REPLACE FUNCTION enforce_use_case_lineages_immutable()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'use_case_lineages records are immutable and cannot be updated';
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER trg_use_case_lineages_immutable
      BEFORE UPDATE ON use_case_lineages
      FOR EACH ROW EXECUTE FUNCTION enforce_use_case_lineages_immutable()
  `.execute(db)

  await sql`
    CREATE OR REPLACE FUNCTION enforce_point_version_use_cases_immutable()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.point_version_id    IS DISTINCT FROM OLD.point_version_id
      OR NEW.lineage_id          IS DISTINCT FROM OLD.lineage_id
      OR NEW.export_id           IS DISTINCT FROM OLD.export_id
      OR NEW.point_id            IS DISTINCT FROM OLD.point_id
      OR NEW.organization_id     IS DISTINCT FROM OLD.organization_id
      OR NEW.demo_artifact_url   IS DISTINCT FROM OLD.demo_artifact_url
      OR NEW.created_at          IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'point_version_use_cases rows are immutable except use_case_id (content re-point) and unpublished_at';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER trg_point_version_use_cases_immutable
      BEFORE UPDATE ON point_version_use_cases
      FOR EACH ROW EXECUTE FUNCTION enforce_point_version_use_cases_immutable()
  `.execute(db)

  await sql`
    CREATE OR REPLACE FUNCTION enforce_point_version_component_props_immutable()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'point_version_component_props records are immutable and cannot be updated';
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER trg_point_version_component_props_immutable
      BEFORE UPDATE ON point_version_component_props
      FOR EACH ROW EXECUTE FUNCTION enforce_point_version_component_props_immutable()
  `.execute(db)

  await sql`
    CREATE OR REPLACE FUNCTION enforce_connections_immutable()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'connections records are immutable and cannot be updated';
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  await sql`
    CREATE TRIGGER trg_connections_immutable
      BEFORE UPDATE ON connections
      FOR EACH ROW EXECUTE FUNCTION enforce_connections_immutable()
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS
      draft_use_cases,
      connections,
      point_version_use_cases,
      use_cases,
      use_case_lineages,
      point_version_exports,
      point_exports,
      point_version_component_props,
      point_versions,
      component_props,
      frontend_components,
      custom_points,
      custom_point_types,
      frontend_frameworks,
      point_roles,
      domain_contacts,
      points,
      domains,
      org_invitations,
      organization_memberships,
      auth_codes,
      users,
      organizations
    CASCADE
  `.execute(db)

  await sql`DROP TYPE IF EXISTS connection_type`.execute(db)
  await sql`DROP TYPE IF EXISTS version_classification`.execute(db)
  await sql`DROP TYPE IF EXISTS point_version_status`.execute(db)
  await sql`DROP TYPE IF EXISTS point_status`.execute(db)
  await sql`DROP TYPE IF EXISTS point_type`.execute(db)
  await sql`DROP TYPE IF EXISTS org_role`.execute(db)

  await sql`DROP FUNCTION IF EXISTS set_updated_at CASCADE`.execute(db)
  await sql`DROP FUNCTION IF EXISTS enforce_use_cases_immutable CASCADE`.execute(db)
  await sql`DROP FUNCTION IF EXISTS enforce_point_exports_immutable CASCADE`.execute(db)
  await sql`DROP FUNCTION IF EXISTS enforce_point_version_exports_immutable CASCADE`.execute(db)
  await sql`DROP FUNCTION IF EXISTS enforce_use_case_lineages_immutable CASCADE`.execute(db)
  await sql`DROP FUNCTION IF EXISTS enforce_point_version_use_cases_immutable CASCADE`.execute(db)
  await sql`DROP FUNCTION IF EXISTS enforce_point_version_component_props_immutable CASCADE`.execute(db)
  await sql`DROP FUNCTION IF EXISTS enforce_connections_immutable CASCADE`.execute(db)
}
