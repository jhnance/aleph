---
status: To Do
related:
  - sdk-cli/detecting-use-cases.md
  - sdk-cli/aleph-config.md
  - sdk-cli/publish-workflow.md
---

# `aleph scan`

Updates the `aleph.lock` file based on the current state of
`.aleph.ts` files in the codebase. Analogous to `npm install` updating a lock file after
`package.json` changes — the user runs this after adding or removing
`.aleph.ts` files, then commits the result.
`aleph publish` reads the committed lock file and does not prompt.

## Acceptance Criteria

- `aleph scan` recursively discovers all `.aleph.ts` files under the project root and extracts the
  `id` and `export` field from each `defineUseCase()` call
- Extracted IDs are grouped into the lock file shape: export-scoped IDs under
  `exports.<exportName>`, point-level IDs (no `export` field) under `point`
- The command diffs the computed ID set against the current
  `aleph.lock` file (if one exists) and classifies each ID as `added`, `removed`, or `unchanged`
- If no diffs are found, the command exits 0 with a brief confirmation message and does not rewrite the lock file
- If diffs are found, the command displays them clearly — added IDs, removed IDs — and prompts the user to confirm before writing; the user can abort with no changes made
- A removed ID (present in the lock file but not found in any
  `.aleph.ts` file) is highlighted as a potentially destructive change; the user must explicitly confirm removals
- On confirmation, `aleph.lock` is written (or created if absent) with the updated ID set
- If any `.aleph.ts` file is missing an `id` field or has a duplicate
  `id` (same ID in two different files), `aleph scan` exits with a clear error before prompting
- `aleph scan` does not require authentication — it operates entirely on local files
- `aleph scan` does not validate IDs against Aleph's API; that cross-check happens at publish time

## Notes and open questions

- Treat this like a git flow? `aleph add`, `aleph commit`, etc.? (Or would this belong in
  `aleph sync`?)