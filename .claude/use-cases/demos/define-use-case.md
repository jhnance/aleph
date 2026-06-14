---
status: Stub
related:
  - sdk-cli/detecting-use-cases.md
  - demos/render-function.md
  - sdk-cli/aleph-new-use-case.md
---

# `defineUseCase()`

**Stub — carved out of `detecting-use-cases.md` (2026-06-14).** `defineUseCase()` from `@aleph/demo-sdk` is the authoring API for declaring a use case demo in code. Full spec deferred; CLI discovery and lock-file matching live in `detecting-use-cases.md`.

## `.aleph.ts` file format

```typescript
import { defineUseCase, http, HttpResponse } from '@aleph/demo-sdk'

export default defineUseCase({
  id: '0d4f9c2e-7b1a-4e2c-9c61-2f8e5a7d3b10', // stable UUID identifier — treat as immutable
  title: 'Login Flow',         // display name — edited in the Aleph UI; pulled down via `aleph sync`
  export: 'LoginButton',       // optional — scopes use case to a named export
  demo: './LoginFlowDemo.tsx', // path to demo entry point (relative to this file); see render-function.md
  handlers: [                  // MSW mock handlers baked into the demo artifact at build time
    http.post('/api/auth/login', () =>
      HttpResponse.json({ token: 'mock-token-123' })
    )
  ]
})
```

## Field notes

- **`id`** — stable UUID lineage key; must be present and a valid UUID. Missing, empty, or non-UUID `id` is a fatal error at publish time. UUIDs only — the title carries the human-readable meaning (decided 2026-06-10).
- **`title`** — display name; used at publish time only to detect title drift. Aleph is title-authoritative; `aleph sync` pulls Aleph titles down.
- **`export`** — optional; scopes the use case to a named export in the version being published. The lineage itself is scope-free, so a file surviving an export rename keeps its `id` and updates its `export` field (2026-06-10).
- **`demo`** — path to the demo entry point (relative to this file); see `render-function.md` for entry file format.
- **`handlers`** — MSW mock handlers baked into the demo artifact at build time; may be empty.
