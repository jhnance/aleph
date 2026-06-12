---
status: To Do
related:
  - sdk-cli/export-rename-succession.md
  - sdk-cli/publish-workflow.md
  - versioning/publish-point-version.md
---

# Export Detection

The CLI statically analyzes the point's codebase to enumerate named exports, then reconciles them against the previous version's export manifest to identify new, removed, and unchanged exports.

## Acceptance Criteria

- Static analysis is performed on the entry file(s) specified in `aleph.config.ts`; the specific analysis approach (TypeScript compiler API, AST parser such as `@babel/parser`, or `tree-sitter`) is to be decided during implementation
- The analysis identifies for each detected export: (a) export name, (b) exported entity kind (function, class, const, type, interface), and (c) any JSDoc annotations present on the export
- The previous version's export manifest is fetched from the Aleph API using the most recent version for this point; if this is the first version, the previous manifest is treated as empty
- Each detected export is classified:
  - `unchanged` — name present in both the current analysis and the previous manifest
  - `new` — name present in the current analysis but not in the previous manifest
  - `removed` — name present in the previous manifest but not detected in the current analysis
- For the first version of a point (no previous manifest), all detected exports are `new`
- The classified export lists are included in the publish summary shown before the user confirms
- Detection failures (parse errors, export ambiguities) surface as warnings in the publish summary, not fatal errors; the user may proceed with a partial export list
- The export payload sent to `POST /points/:id/versions` contains only the exports present in the current analysis — the full set for this version's manifest
