---
status: To Do
---

# `aleph sync`

Pulls title changes made in Aleph down to local `.aleph.ts` files. One-way: Aleph → local. Titles are Aleph-authoritative — local title edits are never pushed (not by this command, not by `aleph publish`); `aleph publish` emits a non-fatal warning when local titles drift from Aleph and suggests running this command. (Decided 2026-06-10; supersedes the earlier bidirectional design.)

## Acceptance Criteria

- Requires an authenticated session and an active org; see CLI Auth use case
- Reads `aleph.lock` to determine which use case IDs are declared for this point; if the lock file is missing or out of sync with the codebase, exits with instructions to run `aleph scan` first
- For each ID in the lock file, fetches the current title from the Aleph API and compares it against the `title` field in the corresponding `.aleph.ts` file
- If all titles match, exits 0 with a brief confirmation message and makes no changes
- For each title that differs, updates the `title` field in the local `.aleph.ts` file to match Aleph — Aleph is the source of truth, so local edits are overwritten; the old → new diff is shown in the summary so an overwritten local edit is visible rather than silent
- All local file writes are performed atomically per file; a failure mid-sync does not leave files partially updated
- After sync completes, prints a summary of which files were updated (old title → new title)
- Does not touch `id` fields, `export` fields, `demo` fields, or `handlers` — title only

## Notes (2026-06-10)

- **UX to revisit before implementation:** it's odd that local title drift is possible at all yet has no bearing on the published demo/use case — the local `title` is effectively a cached display string. Revisit whether `title` should live in `.aleph.ts` at all, or how this command and the publish drift warning should present that relationship.
