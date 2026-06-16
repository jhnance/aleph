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
- Frontend: React, Vite, Tailwind CSS, React Router v7 (framework mode) — tests: Vitest + React Testing Library
- All routes are SSR; the web app is a separate Node process (distinct from the Fastify API)
- SSR loaders call the Fastify API over HTTP — the web server has no direct DB access; Fastify remains the single location for business logic
- Auth: the JWT session cookie is forwarded to Fastify on each loader request; auth checks happen in loaders before any HTML is rendered (no flash of unauthorized content)
- Backend: Fastify, Kysely + postgres.js (Postgres) — tests: Vitest
- Infra: Docker, Kubernetes
- Search: self-hosted Meilisearch
- Auth: custom magic link / OTP — no third-party auth provider
- Sessions: JWT
- Multi-tenancy: organizations as tenants; users can belong to multiple organizations
- Object storage: AWS S3
- SDK/CLI: TypeScript first, other languages post-MVP; CLI published to npm?; GitHub Actions marketplace workflows for golden-path publish flows
- Quality bar: production-ready patterns throughout; no MVP shortcuts
- Security mechanisms (RLS policies, role grants, auth checks) are designed with an explicit
  access matrix: command (SELECT/INSERT/UPDATE/DELETE or equivalent) × actor/row class — with every cell filled from the mechanism's documented semantics, not from intent, before the design lands in a doc (2026-06-11)

## Open questions

**Build system plugins**
Whether to eventually build Vite/webpack/other plugins for deeper SDK integration. Deferred — no concrete use case yet.
