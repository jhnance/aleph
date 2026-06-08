# Update Custom Point Type

An org member renames an org-defined custom point type. The update is scoped to the owning org — the `WHERE id = $id AND organization_id = $orgId` pattern collapses existence and ownership into one query, returning nothing (not an error) if the type belongs to another org.
