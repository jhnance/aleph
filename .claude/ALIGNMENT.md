# Alignment

## Pre-flight checklist

Things we need to align on before implementation. Check off as each is resolved.

- [x] Connections — table design, directionality, version-specific connections
- [x] Sub-domain hierarchy — `parent_id` on `domains`, depth limits if any
- [ ] SDK/CLI — publish workflow design, how exports are detected, rename succession UX
- [ ] Email service — provider decision, transactional email design
- [ ] Search and discovery — scope, full-text vs structured, UX shape
- [ ] `removeUseCaseFromVersion` — resolve forward-propagation semantics before implementing
- [ ] Forward-propagation behavior for hotfix releases — resolve before implementing publish workflow
- [x] RLS — complete prerequisites: downstream `organization_id` denormalization, platform data policies, service role bypass
- [ ] `organization_memberships` — invite flow (how does a user join an org?)

---

## What we're building

Aleph is a cataloguing and discovery tool for organizational ecosystems. The core problem: large organizations have fragmented ecosystems with no single platform that cleanly organizes each part of the system, surfaces relationships between parts, and serves all stakeholder disciplines.

A user opens Aleph and gets a navigable map of their organization's ecosystem — every frontend component, backend service, library, pipeline, and test suite — with the relationships between them, the use cases each part supports, and the version history of every piece.

## Why

No existing tool owns this space cleanly. Internal wikis go stale. Component libraries document UI but not behavior or relationships. Dependency graphs exist in package managers but not in any human-readable, stakeholder-accessible form. Aleph is the single source of truth that serves engineers, PMs, and designers from the same data.

## What we're NOT building (this phase)

- Admin reporting/insights dashboard (post-MVP)
- Additional point types beyond `frontend_component` and the `custom` stub (post-MVP)
- Domain-level access control — RLS is org-scoped for now; domain-level memberships are a future concern
- Role-differentiated UI — all roles see the same interface; the admin dashboard is explicitly deferred

## Architectural constraints

- TypeScript throughout (ESM modules)
- Package manager: pnpm
- Frontend: React, Vite, Tailwind CSS — tests: Vitest + React Testing Library
- Backend: Fastify, postgres.js (Postgres) — tests: Vitest
- Infra: Docker, Kubernetes
- Auth: custom magic link / OTP, no third-party auth provider
- Sessions: JWT-based (HS256, 30-day expiry); payload carries `user_id`, `active_organization_id`, and `jti`; stored in `HttpOnly` cookie; no DB lookup per request
- Multi-org: users can belong to multiple organizations; active org is stored in the JWT and switchable (Slack-like model — per-session, not per-user)
- Multi-tenancy: org-level isolation via PostgreSQL RLS (`SET LOCAL app.current_org_id` + `sql.reserve()` pattern); two Postgres roles — `aleph_app` (RLS enforced) and `aleph_service` (BYPASSRLS, migrations/seeding only)
- Token hashing: SHA-256 for magic link tokens (32 cryptographically random bytes; bcrypt overhead is unnecessary); HS256 for JWT signing
- Quality bar: production-ready patterns throughout — this is a portfolio project and will be reviewed by prospective employers

## Open questions

**`removeUseCaseFromVersion` forward-propagation semantics**
If a use case is removed from version 1.2, should it be removed from all later versions that inherited it, or only from 1.2? This must be resolved before implementing the operation — the behavior is a breaking change to user-facing semantics if reversed post-launch.

**Forward-propagation behavior for hotfix releases**
If a hotfix version (e.g. `1.0.1-hotfix.0`) is published after `1.1.0` has already been released, its `version_monotonic` will be higher than `1.1.0`'s. We do not want use case edits from `1.1.0` to propagate into the hotfix. Options: (a) never include hotfix versions in forward-propagation at all, or (b) detect hotfix versions and let users explicitly opt out. Must be resolved before implementing the publish workflow.

**Invite flow**
How does a user join an org? Options: admin sends invite link, admin adds email directly, user creates org on first sign-in. Not designed yet.
