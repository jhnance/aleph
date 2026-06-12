---
status: To Do
related:
  - sdk-cli/aleph-new-use-case.md
  - sdk-cli/aleph-scan.md
  - sdk-cli/aleph-config.md
  - sdk-cli/publish-workflow.md
---

# Detecting Use Cases

The CLI discovers `.aleph.ts` files co-located with source code and processes them during the publish workflow. Each `.aleph.ts` file defines one use case demo and its MSW mocks; the written description (title, content) lives in Aleph. The CLI matches discovered files against the committed `aleph.lock` file to determine what to publish.

## `.aleph.ts` file format

```typescript
import { defineUseCase, http, HttpResponse } from '@aleph/demo-sdk'

export default defineUseCase({
  id: '0d4f9c2e-7b1a-4e2c-9c61-2f8e5a7d3b10', // stable UUID identifier — treat as immutable
  title: 'Login Flow',         // display name — edited in the Aleph UI; pulled down via `aleph sync`
  export: 'LoginButton',       // optional — scopes use case to a named export
  demo: './LoginFlowDemo.tsx', // path to demo entry point (relative to this file)
  handlers: [                  // MSW mock handlers for this demo
    http.post('/api/auth/login', () =>
      HttpResponse.json({ token: 'mock-token-123' })
    )
  ]
})
```

For a frontend React component, the demo entry file (`LoginFlowDemo.tsx`) uses `@aleph/react` to mount the component:

```typescript
// LoginFlowDemo.tsx
import { render } from '@aleph/react'
import { LoginButton } from './LoginButton'

export default render(() => (
  <LoginButton onLogin={(email) => console.log('Login with', email)} />
))
```

## Acceptance Criteria

- The CLI recursively discovers all `.aleph.ts` files under the project root at publish time
- Each file must export a default `defineUseCase()` call; files that do not match this shape are skipped with a warning
- The `id` field is the stable lineage key used to match the file against a `use_case_lineages` record in Aleph; it must be present and a valid UUID — missing, empty, or non-UUID `id` is a fatal error (ids are UUIDs only; the title carries the human-readable meaning — decided 2026-06-10)
- The `title` field is the display name; it is used only to detect title drift at publish time — `aleph publish` emits a non-fatal warning when a local title differs from Aleph, suggesting `aleph sync` (titles are Aleph-authoritative)
- The `export` field is optional; if present, it must match a named export in **the version being published** (the publish payload's own `exports` array); if absent, the use case is point-level. Scoping is recorded per-version on the attachment row (2026-06-10) — the lineage itself is scope-free, so a file surviving an export rename keeps its `id` and simply updates its `export` field
- The `handlers` array defines MSW mock handlers bundled into the demo artifact at build time; it may be empty
- At publish time, the CLI builds a demo artifact (HTML/JS/CSS bundle) for each discovered `.aleph.ts` file by bundling the `demo` entry point with the `handlers` injected; build errors are fatal and abort the publish
- Discovered IDs are matched against the `aleph.lock` file; any ID present in a `.aleph.ts` file but not in the lock file causes the preflight to fail with instructions to run `aleph scan`
- The `aleph.lock` file (see `aleph scan` use case) is the authoritative registry of which use case IDs are declared for this point; detection alone does not register a use case — `aleph scan` must be run first
