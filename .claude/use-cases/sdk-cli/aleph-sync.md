---
status: To Do
---

# `aleph sync`

Pulls title changes made in Aleph's UI down to local `.aleph.ts` files. One-way: Aleph → local. Titles pushed to Aleph happen at `aleph publish` time; this command only brings remote changes home.

## Acceptance Criteria

- Requires an authenticated session and an active org; see CLI Auth use case
- Reads `aleph.lock` to determine which use case IDs are declared for this point; if the lock file is missing or out of sync with the codebase, exits with instructions to run `aleph scan` first
- For each ID in the lock file, fetches the current title from the Aleph API and compares it against the `title` field in the corresponding `.aleph.ts` file
- If all titles match, exits 0 with a brief confirmation message and makes no changes
- For each title that differs, updates the `title` field in the local `.aleph.ts` file to match Aleph
- All local file writes are performed atomically per file; a failure mid-sync does not leave files partially updated
- After sync completes, prints a summary of which files were updated
- Does not touch `id` fields, `export` fields, `demo` fields, or `handlers` — title only
