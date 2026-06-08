# Publish Use Case

A draft use case is promoted to an immutable `use_cases` record and linked to a point version via `point_version_use_cases`. If the draft had no lineage, a new `use_case_lineages` row is created first. The draft row is deleted on publish.
