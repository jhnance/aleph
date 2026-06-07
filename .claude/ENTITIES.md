# Entities

Key domain entities in Aleph. This is a sketch, not a schema — it will grow as alignment progresses.

## Organization

The root tenant. Every piece of data in Aleph belongs to an organization. Users are members of one or more organizations with a role (`owner`, `admin`, `member`, `viewer`). All tenant isolation flows from this entity.

## Domain

A product area with a distinct identity and focus, scoped to an organization. Domains contain Points. Domains can be nested — a domain can have a parent domain, enabling sub-domain hierarchies (e.g. "Online" → "Checkout"). Users will eventually be assigned to domains, but domain identity is intentionally divorced from team structure: a domain is longer-lived than any team. If the Checkout domain had two teams in 2025 and consolidated to one in 2026, the domain itself didn't change — only the people working within it did.

## Point

The fundamental unit of the catalog. A Point is a distinct piece of the system: a frontend component, backend service, framework, SDK, library, pipeline, test, test suite, etc. Every Point belongs to a Domain. Points have a `type` discriminator that determines which extension table holds type-specific metadata. Points are versioned. A healthy Point always has at least one use case across its versions — enforced via Health Checks.

## Connection

A directed relationship between two Points. Example: Component A depending on Component B creates a one-way dependency connection A→B (and a corresponding dependent/consumer connection B→A). Connections can be version-specific.

## Point Version

A specific published release of a Point. Versions have a semantic version string and an application-managed monotonic integer for reliable total ordering. A version carries an export manifest, a use case manifest, and type-specific metadata.

## Point Export

A named export within a Point — a stable logical identity for something the Point exposes. Exports are immutable once created; a rename is treated as the end of one export's lineage and the start of a new one.

## Use Case

A distinct, demonstrable behavior supported by a Point, with clearly defined inputs and outputs. Use cases are tied to specific versions of a Point and, where applicable, to a specific export within that version — a single use case may appear across multiple versions of the same Point. Use cases are immutable content records — edits create new records rather than updating existing ones. Draft use cases exist for ideation and team alignment before publication.

## Use Case Lineage

The stable logical identity of a use case across its lifetime. All content records for a given use case share the same lineage. The lineage is the join key for cross-version diff queries and edit history display.

## Test

A verifiable artifact tied to a specific version of a Point, a specific use case, and — where applicable — a specific export within that version. Tests provide evidence that a use case's defined behavior actually holds. Test presence and coverage are candidates for Health Check evaluation. The data model for Tests is not yet designed.

## User

A person with access to Aleph. Users authenticate via magic link. A user can be a member of multiple organizations. The `users` table is a local identity record — the auth source of truth is the magic link / session flow.

## Session

An active authenticated session represented as a signed JWT (HS256) stored in an `HttpOnly` cookie. The payload carries `user_id`, `active_organization_id`, and a 30-day expiry. No session record is stored in the database — the server verifies the JWT signature on each request. Logout deletes the cookie client-side. A `revoked_tokens` table can be added later for forced revocation in exceptional cases.

## Auth Code

A one-time token issued when a magic link email is sent. Consumed atomically on first use; never checked again after redemption. Session continuity is handled by the JWT, not `Auth Code`.
