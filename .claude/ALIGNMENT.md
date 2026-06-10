# Alignment

## What we're building

Aleph is a cataloguing and discovery tool for organizational ecosystems. The core problem: large organizations have fragmented ecosystems with no single platform that cleanly organizes each part of the system, surfaces relationships between parts, and serves all stakeholder disciplines.

A user opens Aleph and gets a navigable map of their organization's ecosystem — every frontend component, backend service, library, pipeline, and test suite — with the relationships between them, the use cases each part supports, and the version history of every piece.

## Why

No existing tool owns this space cleanly. Internal wikis go stale. Component libraries document UI but not behavior or relationships. Dependency graphs exist in package managers but not in any human-readable, stakeholder-accessible form. Aleph is the single source of truth that serves engineers, PMs, and designers from the same data.

## What we're NOT building (this phase)

- Admin reporting/insights dashboard (post-MVP)
- Additional point types beyond `frontend_component` and the `custom` stub (post-MVP)
- Domain-level access control — RLS is org-scoped; domain-level memberships are a future concern
- Role-differentiated UI — all roles see the same interface
- SDKs beyond TypeScript (Python, Ruby, Java, Rust, C++, etc. are post-MVP)
- Build system plugins (Vite, webpack, etc.) — deferred; no concrete use case yet

## Architectural constraints

- TypeScript throughout (ESM modules); package manager: pnpm
- Frontend: React, Vite, Tailwind CSS — tests: Vitest + React Testing Library
- Backend: Fastify, postgres.js (Postgres) — tests: Vitest
- Infra: Docker, Kubernetes
- Search: self-hosted Meilisearch
- Auth: custom magic link / OTP — no third-party auth provider
- Sessions: JWT (HS256, 30-day expiry); payload carries `user_id`, `active_organization_id`,
  `jti`; stored in `HttpOnly` cookie; no DB lookup per request
- Multi-org: users belong to multiple organizations; active org lives in the JWT, switchable per-session (Slack model)
- Multi-tenancy: org-level isolation via PostgreSQL RLS (`set_config('app.current_org_id', $1, true)` +
  `sql.reserve()`); two Postgres roles — `aleph_app` (RLS enforced) and
  `aleph_service` (BYPASSRLS, migrations/seeding only)
- API routing: org-scoped resources are addressed under `/api/orgs/:orgSlug/...`; the SPA mirrors this (org slug in the URL path); `/api/auth/*` and `POST /api/orgs` are global
- Object storage: AWS S3 (demo artifacts; uploaded pre-publish via pre-signed URLs)
- Token hashing: SHA-256 for magic link tokens (32 random bytes; bcrypt overhead unnecessary); HS256 for JWT signing
- SDK/CLI: TypeScript-first; CLI published to npm; GitHub Actions marketplace workflows for golden-path publish flows; other-language SDKs post-MVP
- Quality bar: production-ready patterns throughout — portfolio project, reviewed by prospective employers

## Open questions

**`removeUseCaseFromVersion` forward-propagation semantics**
If a use case is removed from version 1.2, should it propagate forward (removing it from all later versions that inherited it), or only affect 1.2? Must be resolved before implementing — reversing this after launch is a breaking change.

**Invite / org join flow**
How does a user join an org? Options: admin sends an invite link, admin adds email directly, or user creates an org on first sign-in. Not yet designed.

**Build system plugins**
Whether to eventually build Vite/webpack/other plugins for deeper SDK integration. Deferred — no concrete use case yet.
