---
status: To Do
related:
  - sdk-cli/export-detection.md
  - sdk-cli/publish-workflow.md
  - versioning/publish-point-version.md
---

# Export Rename Succession

Runs before `aleph publish` as a pre-publish interactive step (`aleph reconcile-exports`). The CLI detects removed exports, asks the user to map each to a new export or confirm deletion, and saves the resulting rename mapping to `aleph.lock`. `aleph publish` reads the mapping from the lock file without prompting, making publish safe to run in CI.

## Acceptance Criteria

- Requires an authenticated session; the org comes from the locally declared `org` slug (no "active org" state — see CLI Auth use case)
- Requires `aleph.config.ts` at the project root; fetches the previous version's export manifest from the API and runs export detection against the entry file(s) to compute the current export set
- A removed export is one present in the previous version's manifest but absent from the current export set
- If there are no removed exports, the command exits 0 with a confirmation message and no changes to `aleph.lock`
- **No new exports:** if the current export set has no new exports, the CLI treats each removal as a strict deletion and prompts the user to confirm: `"'<oldName>' no longer exists. Confirm deletion? [y/n]"`; the user must explicitly acknowledge each removal
- **New exports present:** if the current export set has new exports, the CLI prompts the user for each removed export: `"'<oldName>' was removed. Is it a rename of one of these new exports: [list]? Enter a number or leave blank to treat as deleted."`; the user may map each removal to a new export or leave it blank
- On completion, writes the resolved mapping to `aleph.lock` under an `exportRenames` key: confirmed renames as `{ from: "<oldName>", to: "<newName>" }` pairs; explicit deletions recorded so `aleph publish` knows they were acknowledged and does not re-prompt
- `aleph publish` reads `exportRenames` from the lock file and uses it to set `predecessorExportId` on new export entries in the publish payload; if removed exports are present at publish time with no entry in the lock file, publish exits non-zero with instructions to run `aleph reconcile-exports` first
- Confirmed succession preserves lineage continuity: use case lineages scoped to the predecessor export remain accessible via the lineage graph; the UI can display "formerly known as `<oldName>`" by following the `predecessor_export_id` chain on `point_exports`

