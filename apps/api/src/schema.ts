import { Generated } from 'kysely'

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'
// we will eventually have many more of these
export type PointType = 'frontend_component' | 'custom'
export type PointStatus = 'active' | 'deprecated' | 'archived'
export type PointVersionStatus = 'active' | 'deprecated' | 'archived'
export type VersionClassification = 'release' | 'prerelease' | 'hotfix' | 'metadata'
export type ConnectionType = 'dependency' | 'other'
export type DraftUseCaseStatus = 'draft' | 'in_review'

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
  code_hash:           string
  expires_at:          Date
  used_at:             Date | null
  device_code_hash:    string | null
  device_consumed_at:  Date | null
  created_at:          Generated<Date>
}

interface OrganizationMembershipsTable {
  user_id:         string
  organization_id: string
  role:            Generated<OrgRole>
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface OrgInvitationsTable {
  id:              Generated<string>
  organization_id: string
  email:           string
  role:            Generated<OrgRole>
  invited_by:      string
  code_hash:       string
  expires_at:      Date
  accepted_at:     Date | null
  revoked_at:      Date | null
  created_at:      Generated<Date>
}

interface DomainsTable {
  id:              Generated<string>
  organization_id: string
  parent_id:       string | null
  name:            string
  slug:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface PointsTable {
  id:              Generated<string>
  organization_id: string
  domain_id:       string
  name:            string
  type:            PointType
  status:          Generated<PointStatus>
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface FrontendFrameworksTable {
  id:              Generated<string>
  organization_id: string | null
  name:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface CustomPointTypesTable {
  id:              Generated<string>
  organization_id: string | null
  name:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface CustomPointsTable {
  point_id:        string
  organization_id: string
  type:            PointType
  custom_type_id:  string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface FrontendComponentsTable {
  point_id:        string
  organization_id: string
  type:            PointType
  framework:       string | null
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface ComponentPropsTable {
  id:              Generated<string>
  point_id:        string
  organization_id: string
  name:            string
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

interface PointVersionsTable {
  id:                     Generated<string>
  point_id:               string
  organization_id:        string
  version_semantic:       string
  version_monotonic:      number
  version_major:          number
  version_minor:          number
  version_patch:          number
  version_classification: Generated<VersionClassification>
  predecessor_version_id: string | null
  status:                 Generated<PointVersionStatus>
  created_at:             Generated<Date>
  updated_at:             Generated<Date>
}

interface PointVersionComponentPropsTable {
  point_version_id:  string
  component_prop_id: string
  point_id:          string
  organization_id:   string
  prop_type:         string | null
  required:          Generated<boolean>
  default_value:     string | null
  description:       string | null
}

interface PointExportsTable {
  id:                    Generated<string>
  point_id:              string
  organization_id:       string
  name:                  string
  predecessor_export_id: string | null
  created_at:            Generated<Date>
}

interface PointVersionExportsTable {
  point_version_id: string
  export_id:        string
  organization_id:  string
  created_at:       Generated<Date>
}

interface UseCaseLineagesTable {
  id:              Generated<string>
  point_id:        string
  organization_id: string
  created_at:      Generated<Date>
}

interface UseCasesTable {
  id:              Generated<string>
  lineage_id:      string
  point_id:        string
  organization_id: string
  parent_id:       string | null
  title:           string
  content:         string
  created_at:      Generated<Date>
}

interface PointVersionUseCasesTable {
  point_version_id:  string
  use_case_id:       string
  lineage_id:        string
  export_id:         string | null
  point_id:          string
  organization_id:   string
  demo_artifact_url: string
  unpublished_at:    Date | null
  created_at:        Generated<Date>
}

interface ConnectionsTable {
  id:              Generated<string>
  organization_id: string
  from_version_id: string
  to_version_id:   string
  type:            Generated<ConnectionType>
  created_at:      Generated<Date>
}

interface DraftUseCasesTable {
  id:              Generated<string>
  point_id:        string
  organization_id: string
  lineage_id:      string
  title:           string
  content:         string
  status:          Generated<DraftUseCaseStatus>
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

export interface Database {
  organizations:                OrganizationsTable
  users:                        UsersTable
  auth_codes:                   AuthCodesTable
  organization_memberships:     OrganizationMembershipsTable
  org_invitations:              OrgInvitationsTable
  domains:                      DomainsTable
  points:                       PointsTable
  frontend_frameworks:          FrontendFrameworksTable
  custom_point_types:           CustomPointTypesTable
  custom_points:                CustomPointsTable
  frontend_components:          FrontendComponentsTable
  component_props:              ComponentPropsTable
  point_versions:               PointVersionsTable
  point_version_component_props: PointVersionComponentPropsTable
  point_exports:                PointExportsTable
  point_version_exports:        PointVersionExportsTable
  use_case_lineages:            UseCaseLineagesTable
  use_cases:                    UseCasesTable
  point_version_use_cases:      PointVersionUseCasesTable
  connections:                  ConnectionsTable
  draft_use_cases:              DraftUseCasesTable
}
