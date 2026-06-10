---
status: Stub
related:
  - connections/create-connection.md
  - sdk-cli/publish-workflow.md
  - sdk-cli/bulk-onboarding.md
  - health-checks/health-score.md
---

# Declare Dependencies

**Stub — created 2026-06-10 from the design review.** `dependency` connections had a decided storage shape and validation, but no authoring path — nothing described how the CLI or a user determines the `toVersionId`s in the publish payload. To be specced with the same care export detection got.

Joshua's direction: "We can consider adding to the CLI a way to check package manager metadata locally and cross-reference known packages in Aleph with the ones being brought in locally as dependencies. Overall, this might also go in the same aleph config file we define our exports and use cases in, at least the dependencies. Dependents would be filled in at run time."

## Scope sketch

- **Detection — declared ranges, not lockfiles:** the CLI reads the dependency ranges stated in `package.json` and cross-references package names against points known to Aleph in the current org. Lockfiles are deliberately ignored: the stated range is how authors/owners communicate *intent*, while the lockfile records what happened to get pulled in. (Example: a dependency pinned at `^1.0.0` in `package.json` may be lockfile-resolved to `1.0.0` long after `1.1.0` shipped — the stale *intent* is the signal, and updating it to `^1.1.0` is the author's move. This feeds the future outdated-dependencies health score — see `health-score.md`.)
- **Declaration:** confirmed dependencies live in `aleph.config.ts` alongside the point's other declarations (exports, use case discovery config) — committed, reviewable, and read by `aleph publish` to assemble the `connections` array
- **Dependents are derived, not declared:** the reverse direction (who depends on me) is computed at runtime from incoming `connections` rows — never authored
- **Range → version mapping:** a declared range must resolve to a specific published `point_versions` row to form a connection (e.g. the highest published version satisfying the range) — exact matching semantics to be designed

## Open questions

- **Package-name → point mapping:** cross-referencing needs a registry hint (e.g. a `packageName` on the point or in its config) — where this lives in the data model is to be thought through
- **Target-not-in-catalog:** a local dependency that matches no Aleph point — warn and skip? queue as a suggestion? (Left open for now; interacts with onboarding ordering — the depended-on point must already exist and be published)
- Manual UI fallback for non-package dependencies (service→service, pipeline→service)?
- Does a `reconcile-deps`-style interactive confirmation step apply (mirroring `aleph reconcile-exports`), keeping publish non-interactive?
