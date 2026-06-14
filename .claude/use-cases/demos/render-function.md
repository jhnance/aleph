---
status: Stub
related:
  - sdk-cli/detecting-use-cases.md
  - demos/define-use-case.md
---

# `render()` (demo entry point)

Note that this only has one example so far; Aleph will support more than just a React renderer.

**Stub — carved out of `detecting-use-cases.md` (2026-06-14).** `render()` from
`@aleph/react` is the expected default export of a demo entry file. Full spec deferred; how the CLI bundles and uploads the artifact lives in
`detecting-use-cases.md` and `publish-workflow.md`.

## Demo entry file format

The `demo` field in `.aleph.ts` points to a file whose default export is the output of
`render()`. For a React component:

```typescript
// LoginFlowDemo.tsx
import {render} from '@aleph/react'
import {LoginButton} from './LoginButton'

export default render(() => (
    <LoginButton onLogin = {(email)
=>
console.log('Login with', email)
}
/>
))
```

`render()` returns the module default expected by the CLI bundler; the component tree is mounted into the sandboxed demo iframe at runtime (see
`catalog/view-use-case.md` for iframe sandbox details).
