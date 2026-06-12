---
status: Stub
related:
  - health-checks/evaluate-point-health.md
  - connections/declare-dependencies.md
  - connections/view-connections.md
---

# Health Score

**Stub — created 2026-06-10 from the design review.** `evaluate-point-health.md` models health as a boolean with three invariants and calls them "the complete set for now" — intentionally vague and incomplete. Meanwhile `decisions/2026-06-09.md` says a null `demo_artifact_url` "affects the point's health score." This stub is where the score model gets designed.

Joshua's direction: "In reality, health scores will be either pipeline actions or CLI steps we run against the codebase. If it lives in the CLI, that helps us to centralize everything, but it does make the CLI codebase pretty unwieldy. If we have dedicated pipeline actions, we can publish one per supported language/framework and people can just import the ones they want."

## Scope sketch

- **Score vs. boolean:** the current boolean + violations report likely remains as the *catalog-completeness* layer (computed server-side, on demand); the *score* is a richer measure fed by checks that run against the codebase itself
- **Execution model — the open architectural choice:**
  - *CLI steps:* `aleph health` runs checks locally/in CI — centralizes everything in one tool, but the CLI grows unwieldy as language/framework checks multiply
  - *Pipeline actions:* dedicated published actions (GitHub Actions marketplace per supported language/framework) — composable, users import what they want; matches the existing golden-path publish-flow strategy in ALIGNMENT.md
- **Deterministic vs. nondeterministic scores:** some checks are pure functions of catalog state (computable inline); others run against codebases or external state and take time — Aleph may need an **async worker system** to process nondeterministic health scores (Joshua, 2026-06-10). Defining the deterministic/nondeterministic split is part of the full health-scores session (see `index.md` planned sessions)
- **Inputs to the score (candidates):** demo artifact presence per (version, use case); description completeness; test coverage / test-to-use-case linkage (Tests entity is not yet designed); export-to-use-case ratio; **outdated dependencies** — declared `package.json` ranges vs. latest published versions (pairs with `declare-dependencies.md`; Joshua to describe in detail)
- **Dependency-graph-aware health (raised 2026-06-12 review):** health is not purely local. Two graph-directed questions fall out of the connection model: *"which of my dependencies are healthy/unhealthy?"* (incoming risk) and *"which of my dependents am I making unhealthy by failing my own scores?"* (outgoing blast radius). Open design question: does the score aggregate over the connection graph, and how far — direct edges only or transitive? This is the link between health and `connections/*`; surfacing lives with `view-connections.md` / `ecosystem-map.md`
- **Reporting:** results need structured references — `{ rule, versionId?, exportId?, detail }` — so the UI can badge the specific version or export, not just prose (review finding; applies to the existing violations shape too)
- **Where scores land:** pushed to Aleph via the API at check time (vs. computed on read like the boolean) — implies a storage decision

## Open questions

- Score semantics: 0–100? weighted rules? per-version vs. per-point aggregation?
- Do failing health checks ever *block* a publish (CI gate), or are they always advisory?
