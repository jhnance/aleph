---
status: To Do
---

# Publish Workflow

The CLI (`npx aleph publish --version <semver>`) publishes a new point version. Designed to run non-interactively in CI: all interactive decisions (use case ID reconciliation, export rename succession) happen before publish via `aleph scan` and `aleph reconcile-exports` (to be designed). The publish step itself has no interactive prompts when `--yes` is set or the process is running in a non-TTY environment.

## Acceptance Criteria

- The CLI is invoked via `npx aleph publish --version <semver>` from within the point's codebase directory; `--version` is required
- A required `aleph.config.ts` (or `.js`) file at the project root specifies at minimum: `pointId` (the Point to publish a version of) and the API base URL
- The CLI authenticates; see CLI Auth use case
- The CLI validates `--version` is a valid semver string and checks the API to confirm it has not already been published for this point; returns a clear error if already taken
- `--release-type` accepts one of `release`, `prerelease`, `hotfix`, `metadata`; if omitted, the CLI infers it from the version string where unambiguous (`+` suffix → `metadata`, no suffix → `release`); for `-` suffix versions (ambiguous between `prerelease` and `hotfix`) `--release-type` is required — the CLI exits non-zero if absent; the derived `versionClassification` is validated against the version string before the API call
- The CLI runs export detection (see Export Detection use case) against the entry file(s) specified in config
- The CLI runs use case detection (see Detecting Use Cases use case) against the codebase
- **Preflight — scan check (blocking):** the CLI compares detected use case IDs against `aleph.lock`; if any ID is present in a `.aleph.ts` file but not in the lock file, or vice versa, the CLI exits non-zero with instructions to run `aleph scan` first; no prompt, no interactive resolution
- **Title drift check (non-blocking):** the CLI compares each local `title` against the use case's current title in Aleph; differences are reported as warnings suggesting `aleph sync` — titles are Aleph-authoritative and are never pushed at publish (decided 2026-06-10)
- If the blocking preflight check passes, the CLI proceeds; it makes no file changes
- The CLI fetches the previous version's export manifest from the API and performs reconciliation: classifies exports as `unchanged`, `new`, or `removed`; export rename mappings are read from `aleph.lock` (committed by `aleph reconcile-exports`); if removed exports are present but no rename mapping exists in the lock file for them, the CLI exits non-zero with instructions to run `aleph reconcile-exports` first
- The CLI builds a demo artifact for each `.aleph.ts` file discovered in the codebase; build errors are fatal and abort the publish
- The CLI displays a publish summary: version string, new exports, removed exports, renamed exports, unchanged export count, use case count (with demo artifact count), new connections, and any warnings
- If `--yes` is provided or the process is running in a non-TTY environment, the CLI proceeds without a confirmation prompt; otherwise it prompts the user to confirm or abort
- On abort, the CLI exits 0 with no changes made to the API or local files
- On confirmation, the CLI uploads demo artifacts to S3 via pre-signed URLs **before** the version commit, then calls `POST /api/orgs/:orgSlug/points/:id/versions` with the assembled payload including each artifact's URL — `point_version_use_cases` rows are written once, complete, keeping the table's immutability trigger intact (ordering decided 2026-06-10; the payload's use case section is still being designed)
- On success, the CLI prints: published version string, monotonic version, export count, use case count (with demo artifact count)
- On API errors, the CLI prints a clear message and exits non-zero: version conflict → 409, cycle detected → 409, auth failure → 401
