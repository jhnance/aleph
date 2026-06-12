---
status: To Do
related:
  - sdk-cli/publish-workflow.md
  - sdk-cli/export-detection.md
  - sdk-cli/detecting-use-cases.md
  - connections/declare-dependencies.md
---

# `aleph.config.ts`

The required root-level configuration file for any codebase published as a point.

Scope rule (decided 2026-06-10): **config is for discovery; use cases are files-only.** Use cases are declared exclusively in co-located `.aleph.ts` files — the config never declares them inline. One authoring surface per concept: `aleph scan`, the lock file, and title sync all have exactly one place to look.

## Example

```typescript
import { defineConfig } from '@aleph/cli'

export default defineConfig({
  // The Point this codebase publishes versions of (UUID, from the point's Aleph page)
  pointId: 'b4d1f3a8-2c6e-4f0b-9a3d-8e7c5b2a1d90',

  // Aleph instance + org context for API calls
  apiBaseUrl: 'https://aleph.example.com/api',
  org: 'acme', // org slug — routes are /api/orgs/:orgSlug/...

  // Entry file(s) for export detection (static analysis of named exports)
  entries: ['src/index.ts'],

  // Use case discovery settings — settings only, never use case declarations
  useCases: {
    include: ['src/**/*.aleph.ts'], // default: ['**/*.aleph.ts']
    exclude: ['**/__tests__/**'],
  },

  // Dependency declarations (shape under design — see declare-dependencies.md)
  // dependencies: [...],
})
```

## Acceptance Criteria

- `aleph.config.ts` (or `.js`) must exist at the project root; every CLI command that touches the API or the codebase loads it first and exits non-zero with a clear message if it is missing or fails to parse
- `pointId` (UUID) and `apiBaseUrl` are required; `org` is required for API routing (`/api/orgs/:orgSlug/...`)
- `entries` is required for export detection; paths are relative to the config file
- `useCases.include` / `useCases.exclude` are optional glob settings consumed by use case detection and `aleph scan`; defaults: include `**/*.aleph.ts`, exclude `node_modules`
- The config carries **no use case declarations** — a use case found only in config is not a representable state; `defineConfig`'s type signature offers no field for it
- `dependencies` is reserved; its shape lands with `declare-dependencies.md`

## Open questions

- Monorepo: one config = one point = one project root is the current assumption (stress-tested by `bulk-onboarding.md`)
- **Pinned (2026-06-12): where machine identity lives — config vs. lockfile.** One half is settled: `org` cannot come from the token (tokens are identity-only under the URL-org-authoritative model, 2026-06-11), so it must be declared locally somewhere. The open half is *where*: "we're putting too many IDs in the config and should instead put them in the lockfile and have them populated via the CLI so it's never user-managed" (Joshua). Direction to explore: `aleph.config.ts` keeps user-managed settings (`entries`, `useCases` globs, `apiBaseUrl`); CLI-populated identity (`pointId`, possibly `org`) moves to `aleph.lock`, written by an init/link step. The example above shows the pre-pin shape and follows the resolution.
