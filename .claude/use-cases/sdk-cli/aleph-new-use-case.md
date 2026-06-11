---
status: To Do
---

# `aleph new use-case`

Scaffolds a new `.aleph.ts` file for a use case. Handles two creation flows: CLI-first (generates an ID and registers the lineage in Aleph) and Aleph-UI-first (scaffolds against an existing use case ID copied from the Aleph UI).

**Resolved (2026-06-10):** the pre-publish state is a `use_case_lineages` row plus a mutable `draft_use_cases` row referencing it. Lineages carry no export scoping and no content, so registering one early is cheap and safe — it happens at *draft creation* (UI-first) or via this command (CLI-first); the generated/displayed UUID *is* the lineage id, and that is what goes in the `.aleph.ts` file. The draft stays freely editable in the UI (title, content) right up until a CLI version publish attaches the use case to a version — at which point the draft is promoted to the first immutable content record, demo included. There is no UI publish step for a brand-new use case: leaving draft state *is* the version+demo association, and that is the CLI's job.

## Acceptance Criteria

### CLI-first flow (`aleph new use-case`)

- Invoked without `--id`; accepts optional `--title="..."`, `--export="<exportName>"`, and `--path="<relative/path>"` flags
- Generates a UUID-based `id` for the new use case
- Registers the lineage in Aleph via the API (`use_case_lineages` row with the generated UUID) and creates a `draft_use_cases` row referencing it (title from `--title`, empty content), so the use case is visible and editable in the UI before first publish (2026-06-10)
- Writes a `.aleph.ts` file at the specified path (or a sensible default derived from the title) pre-populated with the generated `id`, the provided `title`, the `export` field if given, and placeholder `demo` and `handlers` values
- Prints the generated `id` and the path of the created file
- Does NOT update `aleph.lock` — the user runs `aleph scan` after staging the new file

### Aleph-UI-first flow (`aleph new use-case --id=<id>`)

- Invoked with `--id=<uuid>`; the ID was copied from the Aleph UI (e.g. from a "Copy use case ID" button on a draft or pending use case)
- Calls the Aleph API to verify the ID exists and belongs to the current point; returns a clear error if not found or inaccessible
- Writes the `.aleph.ts` file at the specified path (or default) pre-populated with the provided `id` and any title fetched from Aleph; does NOT create a new Aleph record
- Prints the path of the created file
- Does NOT update `aleph.lock`

### Shared

- Requires an authenticated session and an active org; see CLI Auth use case
- Requires `aleph.config.ts` at the project root (for `pointId` and API base URL); returns a clear error if absent
- The generated file is a valid TypeScript file that passes the `defineUseCase()` shape check
