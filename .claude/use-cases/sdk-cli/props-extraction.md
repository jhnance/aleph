---
status: Stub
related:
  - versioning/component-props-manifest.md
  - sdk-cli/publish-workflow.md
---

# Props Extraction

**Stub — created 2026-06-10 from the design review.** Props arrive only in the publish payload and are deliberately not forward-propagated — but `publish-workflow.md` (the payload's only producer) never mentioned props, and no use case covered extraction. As specced, every CLI-published `frontend_component` version would have an empty props manifest, and a v1→v2 diff would show "all props removed."

Starting point (from the review): **decide the ingestion mechanism (react-docgen / TS compiler API at publish) or make props carry forward until redeclared.**

## Scope sketch

- At publish time, the CLI extracts the component's props (name, type, required, default, description from JSDoc) from the entry file(s) — candidate tools: `react-docgen-typescript`, or the TS compiler API directly (the CLI already does TS static analysis for export detection; reuse that machinery)
- Extracted props populate the `props` array of the publish payload (`point_version_component_props` rows)
- Failure mode: extraction errors are **fatal and abort the publish** (decided 2026-06-10) — the props manifest is immutable once published, and immutably documenting an incorrect API is not an acceptable outcome; aligns with demo build errors being fatal
- Manual override/supplement: descriptions not present in code (or non-TS components) may need a declared fallback in `aleph.config.ts`

## Open questions

- Per-export props: a point with multiple exported components has props per export — the current schema scopes props to the point, not the export. Does `component_props` need an `export_id`?
- If extraction is unavailable (custom point types, non-React), is the props manifest simply absent, and does the diff UI distinguish "no manifest" from "empty manifest"?
