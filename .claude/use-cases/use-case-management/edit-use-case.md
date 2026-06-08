# Edit Use Case

An org member edits a published use case. Because `use_cases` records are immutable, an edit creates a new draft with `lineage_id` pointing to the existing lineage and `parent_id` pointing to the current head content record. Publish flow then applies.
