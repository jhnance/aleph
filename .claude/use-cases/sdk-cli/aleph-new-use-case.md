---
status: To Do
---

# `aleph new use-case`

Scaffolds a new `.aleph.ts` file for a use case. Handles two creation flows: CLI-first (generates an ID and creates a draft record in Aleph) and Aleph-UI-first (scaffolds against an existing use case ID copied from the Aleph UI).

**Open question:** how the CLI-first flow represents the pre-publish state in Aleph needs to be resolved alongside the `draft_use_cases` schema — specifically, what ID the user copies from the Aleph UI in the Aleph-UI-first flow (the lineage doesn't exist until first publish, so a pre-generated UUID or draft ID is needed). See `decisions/2026-06-09.md`.

## Acceptance Criteria

### CLI-first flow (`aleph new use-case`)

- Invoked without `--id`; accepts optional `--title="..."`, `--export="<exportName>"`, and `--path="<relative/path>"` flags
- Generates a UUID-based `id` for the new use case
- Creates a draft record in Aleph via the API so the use case is visible and editable in the UI before first publish; the exact shape of this record (draft_use_cases row, pending lineage ID, etc.) is to be resolved with the draft_use_cases schema design
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
