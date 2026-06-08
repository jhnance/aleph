# Export Rename Succession

When the CLI detects a likely rename at publish time (an export removed and a new one added with similar shape), it prompts the user to confirm continuity. On confirmation, the new `point_exports` record carries `predecessor_export_id` pointing back to the old one. Use case history from the predecessor lineage is preserved.
