import { Generated } from 'kysely'

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'
// we will eventually have many more of these
export type PointType = 'frontend_component' | 'custom'
export type PointStatus = 'active' | 'deprecated' | 'archived'
export type PointVersionStatus = 'active' | 'deprecated' | 'archived'
export type VersionClassification = 'release' | 'prerelease' | 'hotfix' | 'metadata'
// 'other' connections represent non-dependency relationships (e.g. "is related to", "supersedes")
// and can be created at runtime without publishing a new version
export type ConnectionType = 'dependency' | 'other'

interface OrganizationsTable {
  id:         Generated<string>
  name:       string
  slug:       string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

interface UsersTable {
  id:         Generated<string>
  email:      string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

interface AuthCodesTable {
  id:                  Generated<string>
  email:               string
  // hashed OTP sent via email to verify the user's identity
  code_hash:           string
  expires_at:          Date
  // set when the OTP code is consumed during initial email verification
  used_at:             Date | null
  // hashed device-specific token for "remember this device" flows
  device_code_hash:    string | null
  // set when the device token is consumed on a subsequent login
  device_consumed_at:  Date | null
  created_at:          Generated<Date>
}

// org-level role applies to all Points in the org; point_roles stores per-point elevations
interface OrganizationMembershipsTable {
  user_id:         string  // FK → users.id
  organization_id: string  // FK → organizations.id
  role:            OrgRole
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

// sparse ACL: only stores elevated roles (above viewer); no entry = viewer access
interface PointRolesTable {
  user_id:         string  // FK → organization_memberships.(user_id, organization_id)
  organization_id: string  // FK → organizations.id
  point_id:        string  // FK → points.id
  role:            OrgRole
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface OrgInvitationsTable {
  id:              Generated<string>
  organization_id: string  // FK → organizations.id
  email:           string
  role:            OrgRole
  invited_by:      string  // FK → users.id
  code_hash:       string
  expires_at:      Date
  accepted_at:     Date | null
  created_at:      Generated<Date>
}

interface DomainsTable {
  id:              Generated<string>
  organization_id: string       // FK → organizations.id
  // non-null for subdomains (e.g. "Online" → "Checkout" → "Cart"); null for top-level domains
  parent_id:       string | null  // FK → domains.id
  // human-readable display name (e.g. "Major Appliances")
  name:            string
  // URL-safe identifier derived from name (e.g. "major-appliances")
  slug:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

// explicit per-domain assignment; does not cascade to subdomains
interface DomainContactsTable {
  user_id:         string  // FK → organization_memberships.(user_id, organization_id)
  organization_id: string  // FK → organizations.id
  domain_id:       string  // FK → domains.id
  created_at:      Generated<Date>
}

interface PointsTable {
  id:              Generated<string>
  organization_id: string  // FK → organizations.id
  domain_id:       string  // FK → domains.id
  name:            string
  type:            PointType
  status:          PointStatus
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

// null organization_id = org-agnostic global framework (e.g. React, Vue);
// non-null = custom in-house framework scoped to that org
interface FrontendFrameworksTable {
  id:              Generated<string>
  organization_id: string | null  // FK → organizations.id
  name:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface CustomPointTypesTable {
  id:              Generated<string>
  organization_id: string | null  // FK → organizations.id
  name:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface CustomPointsTable {
  point_id:        string  // FK → points.id
  organization_id: string  // FK → organizations.id
  type:            PointType
  custom_type_id:  string  // FK → custom_point_types.id
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface FrontendComponentsTable {
  point_id:        string       // FK → points.id
  organization_id: string       // FK → organizations.id
  type:            PointType
  framework:       string | null  // FK → frontend_frameworks.id
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface ComponentPropsTable {
  id:              Generated<string>
  point_id:        string  // FK → points.id
  organization_id: string  // FK → organizations.id
  name:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface PointVersionsTable {
  id:                     Generated<string>
  point_id:               string       // FK → points.id
  organization_id:        string       // FK → organizations.id
  version_semantic:       string
  version_monotonic:      number
  version_major:          number
  version_minor:          number
  version_patch:          number
  version_classification: VersionClassification
  predecessor_version_id: string | null  // FK → point_versions.id
  status:                 PointVersionStatus
  created_at:             Generated<Date>
  updated_at:             Generated<Date>
}

interface PointVersionComponentPropsTable {
  point_version_id:  string  // FK → point_versions.id
  component_prop_id: string  // FK → component_props.id
  point_id:          string  // FK → points.id
  organization_id:   string  // FK → organizations.id
  prop_type:         string | null
  required:          boolean
  default_value:     string | null
  description:       string | null
}

interface PointExportsTable {
  id:                    Generated<string>
  point_id:              string       // FK → points.id
  organization_id:       string       // FK → organizations.id
  name:                  string
  predecessor_export_id: string | null  // FK → point_exports.id
  created_at:            Generated<Date>
}

interface PointVersionExportsTable {
  point_version_id: string  // FK → point_versions.id
  export_id:        string  // FK → point_exports.id
  organization_id:  string  // FK → organizations.id
  created_at:       Generated<Date>
}

interface UseCaseLineagesTable {
  id:              Generated<string>
  point_id:        string  // FK → points.id
  organization_id: string  // FK → organizations.id
  created_at:      Generated<Date>
}

interface UseCasesTable {
  id:              Generated<string>
  lineage_id:      string       // FK → use_case_lineages.id
  point_id:        string       // FK → points.id
  organization_id: string       // FK → organizations.id
  parent_id:       string | null  // FK → use_cases.id
  title:           string
  content:         string
  created_at:      Generated<Date>
}

interface PointVersionUseCasesTable {
  point_version_id:  string       // FK → point_versions.id
  use_case_id:       string       // FK → use_cases.id
  lineage_id:        string       // FK → use_case_lineages.id
  export_id:         string | null  // FK → point_exports.id
  point_id:          string       // FK → points.id
  organization_id:   string       // FK → organizations.id
  demo_artifact_url: string
  unpublished_at:    Date | null
  created_at:        Generated<Date>
}

interface ConnectionsTable {
  id:              Generated<string>
  organization_id: string  // FK → organizations.id
  from_version_id: string  // FK → point_versions.id
  to_version_id:   string  // FK → point_versions.id
  type:            ConnectionType
  created_at:      Generated<Date>
}

interface DraftUseCasesTable {
  id:              Generated<string>
  point_id:        string  // FK → points.id
  organization_id: string  // FK → organizations.id
  lineage_id:      string  // FK → use_case_lineages.id
  title:           string
  content:         string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

export interface Database {
  organizations:                 OrganizationsTable
  users:                         UsersTable
  auth_codes:                    AuthCodesTable
  organization_memberships:      OrganizationMembershipsTable
  point_roles:                   PointRolesTable
  org_invitations:               OrgInvitationsTable
  domains:                       DomainsTable
  domain_contacts:               DomainContactsTable
  points:                        PointsTable
  frontend_frameworks:           FrontendFrameworksTable
  custom_point_types:            CustomPointTypesTable
  custom_points:                 CustomPointsTable
  frontend_components:           FrontendComponentsTable
  component_props:               ComponentPropsTable
  point_versions:                PointVersionsTable
  point_version_component_props: PointVersionComponentPropsTable
  point_exports:                 PointExportsTable
  point_version_exports:         PointVersionExportsTable
  use_case_lineages:             UseCaseLineagesTable
  use_cases:                     UseCasesTable
  point_version_use_cases:       PointVersionUseCasesTable
  connections:                   ConnectionsTable
  draft_use_cases:               DraftUseCasesTable
}
