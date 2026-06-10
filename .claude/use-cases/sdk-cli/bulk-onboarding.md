---
status: Stub
---

# Bulk Onboarding (AI-driven)

**Stub — created 2026-06-10 from the design review.** There was no story for onboarding an *existing* ecosystem — the target customer has hundreds of components, and the decided flows were one-point-at-a-time. Joshua's direction: "We can add this as a feature to the CLI. It would be AI-driven."

A CLI feature that scans an existing codebase (or monorepo) and proposes a set of points — names, types, domain suggestions, detected exports — which the user reviews and confirms before bulk creation in Aleph.

## Scope sketch

- AI-driven analysis: walk the repo, identify candidate points (packages, apps, component directories), classify by type (`frontend_component` vs `custom`), detect frameworks from package metadata, propose names
- Interactive review: present the proposal as a confirmable manifest (accept/edit/reject per candidate) — same confirm-before-write ethos as `aleph scan`
- On confirmation: bulk-create points via the API; scaffold `aleph.config.ts` per project root
- Monorepo handling: one config = one point = one project root is the current assumption — bulk onboarding is where that assumption gets stress-tested
- Relationship to `declare-dependencies.md`: detected package-manager dependencies between onboarded points can seed connections once versions are published

## Open questions

- Where does the AI run — local model/API key brought by the user, or an Aleph-hosted service?
- Does bulk onboarding also propose initial domains, or require them to exist first (current create-point flow requires a domain)?
