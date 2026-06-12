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
- Domain-based auto-join (anyone@company.com self-joins a verified-domain org) — post-MVP; joining an org is invitation-only for now (2026-06-12)
- Build system plugins (Vite, webpack, etc.) — deferred; no concrete use case yet

## Architectural constraints

- TypeScript throughout (ESM modules); package manager: pnpm
- Frontend: React, Vite, Tailwind CSS — tests: Vitest + React Testing Library
- Backend: Fastify, postgres.js (Postgres) — tests: Vitest
- Infra: Docker, Kubernetes
- Search: self-hosted Meilisearch
- Auth: custom magic link / OTP — no third-party auth provider
- Sessions: JWT (HS256, 30-day expiry); payload is identity-only — `user_id`, `jti`, no org claim (2026-06-11); stored in an `HttpOnly; Secure; SameSite=Lax` cookie; signature verification needs no DB lookup; org-scoped routes membership-check the URL org per request (never cached). CSRF posture (2026-06-11): `Lax` + no state-changing GETs under cookie authority + `Origin`/JSON content-type checks on mutating routes
- Multi-org: users belong to multiple organizations; org context comes from the URL path and is membership-checked per request (2026-06-11) — "switching" is navigation, tabs are independent, membership and role revocation bind on the next request
- Multi-tenancy: org-level isolation via PostgreSQL RLS (`set_config('app.current_org_id', $1, true)` +
  `sql.reserve()`); two Postgres roles — `aleph_app` (RLS enforced) and
  `aleph_service` (BYPASSRLS, migrations/seeding only). Identity plane (2026-06-11): `auth_codes`/`users` RLS-exempt with documented app guards (unauthenticated flows); `organizations`/`organization_memberships` user-keyed via `app.current_user_id`
- API routing: org-scoped resources are addressed under `/api/orgs/:orgSlug/...`; the SPA mirrors this (org slug in the URL path); the URL org is authoritative (2026-06-11); `/api/auth/*` and `POST /api/orgs` are global
- Transactions are scoped to single units of DB work — no external IO while a transaction is open; RLS context is set per-transaction via helper; role-level timeouts (`statement`/`lock`/`idle_in_transaction`/`transaction`) enforce it server-side; long-running work runs async (queue/outbox mechanism decided with search dual-write); Postgres pinned ≥ 17 (2026-06-11)
- Object storage: AWS S3 (demo artifacts; uploaded pre-publish via pre-signed URLs)
- Token hashing: SHA-256 for magic link tokens (32 random bytes; bcrypt overhead unnecessary); HS256 for JWT signing
- SDK/CLI: TypeScript-first; CLI published to npm; GitHub Actions marketplace workflows for golden-path publish flows; other-language SDKs post-MVP
- Quality bar: production-ready patterns throughout — portfolio project, reviewed by prospective employers
- Security mechanisms (RLS policies, role grants, auth checks) are designed with an explicit **access matrix** — command (SELECT/INSERT/UPDATE/DELETE or equivalent) × actor/row class — with every cell filled from the mechanism's documented semantics, not from intent, before the design lands in a doc (2026-06-11)

## Open questions

**Build system plugins**
Whether to eventually build Vite/webpack/other plugins for deeper SDK integration. Deferred — no concrete use case yet.
