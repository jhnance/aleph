---
status: Stub
related:
  - sdk-cli/aleph-config.md
  - connections/declare-dependencies.md
  - domains/create-domain.md
  - points/create-point.md
---

# Bulk Onboarding (AI-driven)

**Deliberate stub (2026-06-12): direction decided, full design deferred until closer to need.**

Onboarding an existing ecosystem — the target customer has hundreds of components — without one-point-at-a-time entry.

## Decided direction (2026-06-12)

**Aleph does not run the AI.** Instead, Aleph provides **Skills documents** — instruction files users plug into their own AI workflows (Claude Code, Cursor, and similar) — that direct their tools to analyze the codebase for what Aleph is looking for: candidate points (packages, apps, component directories), type classification, framework detection from package metadata, proposed names, and domain groupings. Aleph-hosted inference is tabled until much later than MVP.

The AI's output is an **onboarding manifest** the user reviews and edits. The CLI validates and applies the confirmed manifest — confirm-before-write, the same ethos as `aleph scan`: nothing AI-generated reaches the API without passing through human confirmation. The deterministic substrate stays in the CLI regardless of which AI tool produced the manifest: workspace/package detection cross-checks, `aleph.config.ts` scaffolding per project root, bulk creation via the API.

## Sketch

- Monorepo handling: one config = one point = one project root is the standing assumption — bulk onboarding is where it gets stress-tested
- Detected package-manager dependencies between onboarded points can seed connections once versions are published (see `declare-dependencies.md`)

## Open questions

- Manifest format and `aleph onboard` apply semantics (transactional bulk create? resumable on partial failure?)
- Does the manifest propose new domains, or only assign points to existing ones?
- Skills document scope: one generic document, or per-ecosystem variants (pnpm monorepo, Nx, plain multi-repo)?
