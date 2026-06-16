import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    /**
     * *************************************************************************
     * ********************************* ENUMS *********************************
     * *************************************************************************
     */
    await db.schema
        .createType('org_role')
        .asEnum(['owner', 'admin', 'member', 'viewer'])
        .execute()

    await db.schema
        .createType('point_type')
        .asEnum(['frontend_component', 'custom'])
        .execute()

    await db.schema
        .createType('point_status')
        .asEnum(['active', 'deprecated', 'archived'])
        .execute()

    await db.schema
        .createType('point_version_status')
        .asEnum(['active', 'deprecated', 'archived'])
        .execute()

    await db.schema
        .createType('version_classification')
        .asEnum(['prerelease', 'hotfix', 'release', 'metadata'])
        .execute()

    await db.schema
        .createType('connection_type')
        .asEnum(['dependency', 'other'])
        .execute()

    /**
     * *************************************************************************
     * ***************************** CORE ENTITIES *****************************
     * *************************************************************************
     */

    await db.schema
        .createTable('organizations')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('name', 'varchar(100)', (col) => col.notNull())
        .addColumn('slug', 'varchar(25)', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addUniqueConstraint('slug_unique', ['slug'])
        .addCheckConstraint(
            'slug_alphanumeric_constraint',
            sql`slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'`,
        )
        .execute()

    await db.schema
        .createTable('users')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('email', 'text', (col) => col.notNull().unique())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .execute()

    await db.schema
        .createTable('auth_codes')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('email', 'text', (col) => col.notNull())
        .addColumn('code_hash', 'text', (col) => col.notNull())
        .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
        .addColumn('used_at', 'timestamptz')
        .addColumn('device_code_hash', 'text')
        .addColumn('device_consumed_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .execute()

    await db.schema
        .createIndex('idx_auth_code_email')
        .on('auth_codes')
        .column('email')
        .execute()

    await db.schema
        .createIndex('idx_auth_code_hash')
        .unique()
        .on('auth_codes')
        .column('code_hash')
        .execute()

    await db.schema
        .createIndex('idx_auth_code_device_hash')
        .unique()
        .on('auth_codes')
        .column('device_code_hash')
        .where(sql<boolean>`device_code_hash IS NOT NULL`)
        .execute()

    await db.schema
        .createTable('organization_memberships')
        .addColumn('user_id', 'uuid', (col) =>
            col.notNull().references('users.id').onDelete('restrict'),
        )
        .addColumn('organization_id', 'uuid', (col) =>
            col.notNull().references('organizations.id').onDelete('restrict'),
        )
        .addColumn('role', sql`org_role`, (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addPrimaryKeyConstraint('organization_memberships_pk', [
            'user_id',
            'organization_id',
        ])
        .execute()

    await db.schema
        .createIndex('idx_org_membership_organization_id')
        .on('organization_memberships')
        .column('organization_id')
        .execute()

    await db.schema
        .createTable('org_invitations')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('organization_id', 'uuid', (col) =>
            col.notNull().references('organizations.id').onDelete('restrict'),
        )
        .addColumn('email', 'text', (col) => col.notNull())
        .addColumn('role', sql`org_role`, (col) => col.notNull())
        .addColumn('invited_by', 'uuid', (col) =>
            col.notNull().references('users.id').onDelete('restrict'),
        )
        .addColumn('code_hash', 'text', (col) => col.notNull())
        .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
        .addColumn('accepted_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addCheckConstraint(
            'org_invitations_role_not_owner',
            sql`role <> 'owner'`,
        )
        .execute()

    await db.schema
        .createIndex('idx_org_invitation_code_hash')
        .unique()
        .on('org_invitations')
        .column('code_hash')
        .execute()

    await db.schema
        .createIndex('idx_org_invitation_email')
        .on('org_invitations')
        .column('email')
        .execute()

    await db.schema
        .createIndex('idx_org_invitation_organization_id')
        .on('org_invitations')
        .column('organization_id')
        .execute()

    await db.schema
        .createIndex('idx_org_invitation_live')
        .unique()
        .on('org_invitations')
        .columns(['organization_id', 'email'])
        .where(sql<boolean>`accepted_at IS NULL`)
        .execute()

    /**
     * *************************************************************************
     * ************************* DOMAIN / POINT HIERARCHY **********************
     * *************************************************************************
     */

    await db.schema
        .createTable('domains')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('organization_id', 'uuid', (col) =>
            col.notNull().references('organizations.id').onDelete('restrict'),
        )
        .addColumn('parent_id', 'uuid')
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('slug', 'text', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('domains_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .addCheckConstraint(
            'domains_slug_length_check',
            sql`char_length(slug) BETWEEN 1 AND 50`,
        )
        .addCheckConstraint(
            'domains_slug_format_check',
            sql`slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'`,
        )
        .addCheckConstraint('domains_no_self_parent', sql`parent_id != id`)
        .addForeignKeyConstraint(
            'domains_parent_org_fk',
            ['parent_id', 'organization_id'],
            'domains',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createIndex('idx_domain_slug_root')
        .unique()
        .on('domains')
        .columns(['organization_id', 'slug'])
        .where(sql<boolean>`parent_id IS NULL`)
        .execute()

    await db.schema
        .createIndex('idx_domain_slug_child')
        .unique()
        .on('domains')
        .columns(['organization_id', 'parent_id', 'slug'])
        .where(sql<boolean>`parent_id IS NOT NULL`)
        .execute()

    await db.schema
        .createIndex('idx_domain_organization_id')
        .on('domains')
        .column('organization_id')
        .execute()

    await db.schema
        .createTable('domain_contacts')
        .addColumn('user_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) =>
            col.notNull().references('organizations.id').onDelete('restrict'),
        )
        .addColumn('domain_id', 'uuid', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addPrimaryKeyConstraint('domain_contacts_pk', ['user_id', 'domain_id'])
        .addForeignKeyConstraint(
            'domain_contacts_user_org_fk',
            ['user_id', 'organization_id'],
            'organization_memberships',
            ['user_id', 'organization_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .addForeignKeyConstraint(
            'domain_contacts_domain_org_fk',
            ['domain_id', 'organization_id'],
            'domains',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .execute()

    await db.schema
        .createIndex('idx_domain_contact_domain_id')
        .on('domain_contacts')
        .column('domain_id')
        .execute()

    await db.schema
        .createTable('points')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('organization_id', 'uuid', (col) =>
            col.notNull().references('organizations.id').onDelete('restrict'),
        )
        .addColumn('domain_id', 'uuid', (col) => col.notNull())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('type', sql`point_type`, (col) => col.notNull())
        .addColumn('status', sql`point_status`, (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('points_id_type_unique', ['id', 'type'])
        .addUniqueConstraint('points_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .addForeignKeyConstraint(
            'points_domain_org_fk',
            ['domain_id', 'organization_id'],
            'domains',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createIndex('idx_point_organization_id')
        .on('points')
        .column('organization_id')
        .execute()

    await db.schema
        .createIndex('idx_point_domain_id')
        .on('points')
        .column('domain_id')
        .execute()

    await db.schema
        .createTable('point_roles')
        .addColumn('user_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) =>
            col.notNull().references('organizations.id').onDelete('restrict'),
        )
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('role', sql`org_role`, (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addPrimaryKeyConstraint('point_roles_pk', ['user_id', 'point_id'])
        .addForeignKeyConstraint(
            'point_roles_user_org_fk',
            ['user_id', 'organization_id'],
            'organization_memberships',
            ['user_id', 'organization_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .addForeignKeyConstraint(
            'point_roles_point_org_fk',
            ['point_id', 'organization_id'],
            'points',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .execute()

    await db.schema
        .createIndex('idx_point_role_point_id')
        .on('point_roles')
        .column('point_id')
        .execute()

    /**
     * *************************************************************************
     * ************************** TYPE EXTENSION TABLES ************************
     * *************************************************************************
     */

    await db.schema
        .createTable('frontend_frameworks')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('organization_id', 'uuid', (col) =>
            col.references('organizations.id').onDelete('restrict'),
        )
        .addColumn('name', 'varchar(50)', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('frontend_frameworks_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .execute()

    await db.schema
        .createIndex('idx_framework_name_global')
        .unique()
        .on('frontend_frameworks')
        .column('name')
        .where(sql<boolean>`organization_id IS NULL`)
        .execute()

    await db.schema
        .createIndex('idx_framework_name_org')
        .unique()
        .on('frontend_frameworks')
        .columns(['organization_id', 'name'])
        .where(sql<boolean>`organization_id IS NOT NULL`)
        .execute()

    await db.schema
        .createIndex('idx_framework_organization_id')
        .on('frontend_frameworks')
        .column('organization_id')
        .execute()

    await db.schema
        .createTable('custom_point_types')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('organization_id', 'uuid', (col) =>
            col.references('organizations.id').onDelete('restrict'),
        )
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('custom_point_types_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .execute()

    await db.schema
        .createIndex('idx_custom_point_type_name_global')
        .unique()
        .on('custom_point_types')
        .column('name')
        .where(sql<boolean>`organization_id IS NULL`)
        .execute()

    await db.schema
        .createIndex('idx_custom_point_type_name_org')
        .unique()
        .on('custom_point_types')
        .columns(['organization_id', 'name'])
        .where(sql<boolean>`organization_id IS NOT NULL`)
        .execute()

    await db.schema
        .createIndex('idx_custom_point_type_organization_id')
        .on('custom_point_types')
        .column('organization_id')
        .execute()

    await db.schema
        .createTable('custom_points')
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('type', sql`point_type`, (col) => col.notNull())
        .addColumn('custom_type_id', 'uuid', (col) =>
            col.notNull().references('custom_point_types.id'),
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addPrimaryKeyConstraint('custom_points_pk', ['point_id'])
        .addCheckConstraint(
            'custom_points_type_check',
            sql`type = 'custom'`,
        )
        .addForeignKeyConstraint(
            'custom_points_id_type_fk',
            ['point_id', 'type'],
            'points',
            ['id', 'type'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'custom_points_id_org_fk',
            ['point_id', 'organization_id'],
            'points',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createTable('frontend_components')
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('type', sql`point_type`, (col) => col.notNull())
        .addColumn('framework', 'uuid', (col) =>
            col.references('frontend_frameworks.id'),
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addPrimaryKeyConstraint('frontend_components_pk', ['point_id'])
        .addUniqueConstraint('frontend_components_id_organization_id_unique', [
            'point_id',
            'organization_id',
        ])
        .addCheckConstraint(
            'frontend_components_type_check',
            sql`type = 'frontend_component'`,
        )
        .addForeignKeyConstraint(
            'frontend_components_id_type_fk',
            ['point_id', 'type'],
            'points',
            ['id', 'type'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'frontend_components_id_org_fk',
            ['point_id', 'organization_id'],
            'points',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createTable('component_props')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('component_props_point_id_name_unique', [
            'point_id',
            'name',
        ])
        .addUniqueConstraint('component_props_id_point_id_unique', [
            'id',
            'point_id',
        ])
        .addUniqueConstraint('component_props_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .addForeignKeyConstraint(
            'component_props_point_org_fk',
            ['point_id', 'organization_id'],
            'frontend_components',
            ['point_id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    /**
     * *************************************************************************
     * ******************************* VERSIONING ******************************
     * *************************************************************************
     */

    await db.schema
        .createTable('point_versions')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('version_semantic', 'text', (col) => col.notNull())
        .addColumn('version_monotonic', 'integer', (col) => col.notNull())
        .addColumn('version_major', 'integer', (col) => col.notNull())
        .addColumn('version_minor', 'integer', (col) => col.notNull())
        .addColumn('version_patch', 'integer', (col) => col.notNull())
        .addColumn('version_classification', sql`version_classification`, (col) =>
            col.notNull(),
        )
        .addColumn('predecessor_version_id', 'uuid')
        .addColumn('status', sql`point_version_status`, (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('point_versions_point_semantic_unique', [
            'point_id',
            'version_semantic',
        ])
        .addUniqueConstraint('point_versions_point_monotonic_unique', [
            'point_id',
            'version_monotonic',
        ])
        .addUniqueConstraint('point_versions_id_point_id_unique', [
            'id',
            'point_id',
        ])
        .addUniqueConstraint('point_versions_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .addCheckConstraint(
            'point_versions_monotonic_positive',
            sql`version_monotonic > 0`,
        )
        .addForeignKeyConstraint(
            'point_versions_predecessor_point_fk',
            ['predecessor_version_id', 'point_id'],
            'point_versions',
            ['id', 'point_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'point_versions_point_org_fk',
            ['point_id', 'organization_id'],
            'points',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createIndex('idx_point_version_point_id')
        .on('point_versions')
        .column('point_id')
        .execute()

    await db.schema
        .createIndex('idx_point_version_point_id_monotonic')
        .on('point_versions')
        .columns(['point_id', 'version_monotonic'])
        .execute()

    await db.schema
        .createIndex('idx_point_version_semantic_order')
        .on('point_versions')
        .columns([
            'point_id',
            'version_major desc',
            'version_minor desc',
            'version_patch desc',
            'version_monotonic desc',
        ])
        .execute()

    await db.schema
        .createIndex('idx_point_version_predecessor')
        .on('point_versions')
        .column('predecessor_version_id')
        .where(sql<boolean>`predecessor_version_id IS NOT NULL`)
        .execute()

    await db.schema
        .createTable('point_version_component_props')
        .addColumn('point_version_id', 'uuid', (col) => col.notNull())
        .addColumn('component_prop_id', 'uuid', (col) => col.notNull())
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('prop_type', 'text')
        .addColumn('required', 'boolean', (col) => col.notNull())
        .addColumn('default_value', 'text')
        .addColumn('description', 'text')
        .addPrimaryKeyConstraint('point_version_component_props_pk', [
            'point_version_id',
            'component_prop_id',
        ])
        .addForeignKeyConstraint(
            'pvcp_version_point_fk',
            ['point_version_id', 'point_id'],
            'point_versions',
            ['id', 'point_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .addForeignKeyConstraint(
            'pvcp_prop_point_fk',
            ['component_prop_id', 'point_id'],
            'component_props',
            ['id', 'point_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'pvcp_version_org_fk',
            ['point_version_id', 'organization_id'],
            'point_versions',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .execute()

    /**
     * *************************************************************************
     * ********************************* EXPORTS *******************************
     * *************************************************************************
     */

    await db.schema
        .createTable('point_exports')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('predecessor_export_id', 'uuid')
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('point_exports_point_id_name_unique', [
            'point_id',
            'name',
        ])
        .addUniqueConstraint('point_exports_id_point_id_unique', [
            'id',
            'point_id',
        ])
        .addUniqueConstraint('point_exports_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .addForeignKeyConstraint(
            'point_exports_point_org_fk',
            ['point_id', 'organization_id'],
            'points',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'point_exports_predecessor_point_fk',
            ['predecessor_export_id', 'point_id'],
            'point_exports',
            ['id', 'point_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createIndex('idx_point_export_point_id')
        .on('point_exports')
        .column('point_id')
        .execute()

    await db.schema
        .createIndex('idx_point_export_predecessor')
        .on('point_exports')
        .column('predecessor_export_id')
        .execute()

    await db.schema
        .createTable('point_version_exports')
        .addColumn('point_version_id', 'uuid', (col) => col.notNull())
        .addColumn('export_id', 'uuid', (col) => col.notNull())
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addPrimaryKeyConstraint('point_version_exports_pk', [
            'point_version_id',
            'export_id',
        ])
        .addForeignKeyConstraint(
            'pve_version_point_fk',
            ['point_version_id', 'point_id'],
            'point_versions',
            ['id', 'point_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .addForeignKeyConstraint(
            'pve_export_point_fk',
            ['export_id', 'point_id'],
            'point_exports',
            ['id', 'point_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'pve_version_org_fk',
            ['point_version_id', 'organization_id'],
            'point_versions',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .execute()

    await db.schema
        .createIndex('idx_pve_export_id')
        .on('point_version_exports')
        .column('export_id')
        .execute()

    /**
     * *************************************************************************
     * ****************************** USE CASES ********************************
     * *************************************************************************
     */

    await db.schema
        .createTable('use_case_lineages')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('use_case_lineages_id_point_id_unique', [
            'id',
            'point_id',
        ])
        .addUniqueConstraint('use_case_lineages_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .addForeignKeyConstraint(
            'use_case_lineages_point_org_fk',
            ['point_id', 'organization_id'],
            'points',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createIndex('idx_use_case_lineage_point_id')
        .on('use_case_lineages')
        .column('point_id')
        .execute()

    await db.schema
        .createTable('use_cases')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('lineage_id', 'uuid', (col) => col.notNull())
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('parent_id', 'uuid')
        .addColumn('title', 'text', (col) => col.notNull())
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('use_cases_id_point_id_unique', ['id', 'point_id'])
        .addUniqueConstraint('use_cases_id_organization_id_unique', [
            'id',
            'organization_id',
        ])
        .addUniqueConstraint('use_cases_id_lineage_id_unique', [
            'id',
            'lineage_id',
        ])
        .addForeignKeyConstraint(
            'use_cases_parent_org_fk',
            ['parent_id', 'organization_id'],
            'use_cases',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'use_cases_lineage_point_fk',
            ['lineage_id', 'point_id'],
            'use_case_lineages',
            ['id', 'point_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'use_cases_lineage_org_fk',
            ['lineage_id', 'organization_id'],
            'use_case_lineages',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createIndex('idx_use_case_lineage_id')
        .on('use_cases')
        .column('lineage_id')
        .execute()

    await db.schema
        .createIndex('idx_use_case_parent_id')
        .on('use_cases')
        .column('parent_id')
        .execute()

    await db.schema
        .createTable('point_version_use_cases')
        .addColumn('point_version_id', 'uuid', (col) => col.notNull())
        .addColumn('use_case_id', 'uuid', (col) => col.notNull())
        .addColumn('lineage_id', 'uuid', (col) => col.notNull())
        .addColumn('export_id', 'uuid')
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('demo_artifact_url', 'text', (col) => col.notNull())
        .addColumn('unpublished_at', 'timestamptz')
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addPrimaryKeyConstraint('point_version_use_cases_pk', [
            'point_version_id',
            'use_case_id',
        ])
        .addUniqueConstraint('pvuc_version_lineage_unique', [
            'point_version_id',
            'lineage_id',
        ])
        .addForeignKeyConstraint(
            'pvuc_version_point_fk',
            ['point_version_id', 'point_id'],
            'point_versions',
            ['id', 'point_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .addForeignKeyConstraint(
            'pvuc_use_case_lineage_fk',
            ['use_case_id', 'lineage_id'],
            'use_cases',
            ['id', 'lineage_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'pvuc_use_case_point_fk',
            ['use_case_id', 'point_id'],
            'use_cases',
            ['id', 'point_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'pvuc_lineage_point_fk',
            ['lineage_id', 'point_id'],
            'use_case_lineages',
            ['id', 'point_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'pvuc_version_export_fk',
            ['point_version_id', 'export_id'],
            'point_version_exports',
            ['point_version_id', 'export_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .addForeignKeyConstraint(
            'pvuc_version_org_fk',
            ['point_version_id', 'organization_id'],
            'point_versions',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('cascade'),
        )
        .execute()

    await db.schema
        .createIndex('idx_pvuc_use_case_id')
        .on('point_version_use_cases')
        .column('use_case_id')
        .execute()

    await db.schema
        .createIndex('idx_pvuc_lineage_id')
        .on('point_version_use_cases')
        .column('lineage_id')
        .execute()

    /**
     * *************************************************************************
     * ****************************** CONNECTIONS ******************************
     * *************************************************************************
     */

    await db.schema
        .createTable('connections')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('from_version_id', 'uuid', (col) => col.notNull())
        .addColumn('to_version_id', 'uuid', (col) => col.notNull())
        .addColumn('type', sql`connection_type`, (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint('connections_from_to_unique', [
            'from_version_id',
            'to_version_id',
        ])
        .addCheckConstraint(
            'connections_no_self_loop',
            sql`from_version_id != to_version_id`,
        )
        .addForeignKeyConstraint(
            'connections_from_org_fk',
            ['from_version_id', 'organization_id'],
            'point_versions',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'connections_to_org_fk',
            ['to_version_id', 'organization_id'],
            'point_versions',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .execute()

    await db.schema
        .createIndex('idx_connection_from_version')
        .on('connections')
        .column('from_version_id')
        .execute()

    await db.schema
        .createIndex('idx_connection_to_version')
        .on('connections')
        .column('to_version_id')
        .execute()

    await db.schema
        .createIndex('idx_connection_organization_id')
        .on('connections')
        .column('organization_id')
        .execute()

    /**
     * *************************************************************************
     * **************************** USE CASE DRAFTS ****************************
     * *************************************************************************
     */

    await db.schema
        .createTable('draft_use_cases')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('point_id', 'uuid', (col) => col.notNull())
        .addColumn('organization_id', 'uuid', (col) => col.notNull())
        .addColumn('lineage_id', 'uuid', (col) => col.notNull())
        .addColumn('title', 'text', (col) => col.notNull())
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addForeignKeyConstraint(
            'draft_use_cases_point_org_fk',
            ['point_id', 'organization_id'],
            'points',
            ['id', 'organization_id'],
            (cb) => cb.onDelete('restrict'),
        )
        .addForeignKeyConstraint(
            'draft_use_cases_lineage_point_fk',
            ['lineage_id', 'point_id'],
            'use_case_lineages',
            ['id', 'point_id'],
        )
        .execute()

    await db.schema
        .createIndex('idx_draft_use_case_organization_id')
        .on('draft_use_cases')
        .column('organization_id')
        .execute()

    await db.schema
        .createIndex('idx_draft_use_case_point_id')
        .on('draft_use_cases')
        .column('point_id')
        .execute()

    /**
     * *************************************************************************
     * ******************************** TRIGGERS *******************************
     * *************************************************************************
     */

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
    const tables = [
        'draft_use_cases',
        'connections',
        'point_version_use_cases',
        'use_cases',
        'use_case_lineages',
        'point_version_exports',
        'point_exports',
        'point_version_component_props',
        'point_versions',
        'component_props',
        'frontend_components',
        'custom_points',
        'custom_point_types',
        'frontend_frameworks',
        'point_roles',
        'domain_contacts',
        'points',
        'domains',
        'org_invitations',
        'organization_memberships',
        'auth_codes',
        'users',
        'organizations',
    ]

    for (const table of tables) {
        await db.schema.dropTable(table).ifExists().cascade().execute()
    }

    const types = [
        'connection_type',
        'version_classification',
        'point_version_status',
        'point_status',
        'point_type',
        'org_role',
    ]

    for (const type of types) {
        await db.schema.dropType(type).ifExists().execute()
    }

    const functions = [
        'set_updated_at',
        'enforce_use_cases_immutable',
        'enforce_point_exports_immutable',
        'enforce_point_version_exports_immutable',
        'enforce_use_case_lineages_immutable',
        'enforce_point_version_use_cases_immutable',
        'enforce_point_version_component_props_immutable',
        'enforce_connections_immutable',
    ]

    for (const fn of functions) {
        await sql`DROP FUNCTION IF EXISTS ${sql.raw(fn)} CASCADE`.execute(db)
    }
}
