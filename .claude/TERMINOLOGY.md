# Terminology

Project-specific definitions for terms used in Aleph. Captures terms that have a precise meaning within this project or that could be ambiguous without an explicit definition.

## Point

The fundamental unit of the Aleph catalog — any distinct, documentable piece of a system. The name comes from Borges' *The Aleph*. Not to be confused with a generic "item" or "component"; a Point has a type, belongs to a Domain, and is versioned. Use cases are tied to specific versions of a Point (and to specific exports within a version, where applicable). A healthy Point always has at least one use case — this is enforced via Health Checks rather than at the DB level.

## Domain

A product area with a distinct identity, scoped to an organization. Not synonymous with "team" — domains outlive team structures. A domain is a long-lived product concept; the people working within it may change over time.

## Sub-domain

A domain nested within another domain via a parent relationship. Example: "Checkout" is a sub-domain of "Online". Sub-domains are still Domains — the distinction is purely structural.

## Use Case

A distinct, demonstrable behavior supported by a Point, which has clearly defined inputs and outputs. Use cases are tied to specific versions of a Point and, where applicable, to a specific export within that version. Draft use cases can be used during ideation and team alignment before a version is published.

## Health Check

A system-level validation that evaluates whether a Point, version, or export meets catalog quality and completeness criteria. Health checks enforce invariants that are not (or not yet) enforced at the DB level. A Point or version that fails a health check is flagged as incomplete in the UI. Example invariants: a Point always has at least one use case; a published version always has at least one use case; an export always has at least one use case if the Point has exports.

## Lineage

The stable logical identity of a use case across its entire edit history. All content versions of the same use case share a lineage ID. "Lineage" refers specifically to the `use_case_lineages` record, not to the content records themselves.

## Attachment

Design-doc shorthand for a `point_version_use_cases` row: the record that publishes one use case (a lineage, plus the content record current at publish time) onto one point version, carrying its demo artifact URL and optional export scoping. Created only by the CLI version publish; mutable only in `use_case_id` (edit re-pointing) and `unpublished_at` (soft retraction). **Not** user-uploaded files — user-facing surfaces say a use case "appears in" or "is published on" a version. If uploadable supporting documents (Figma files, PDFs) are ever introduced, they need a different name.

## Demo

A running, interactive rendering of a use case's behavior: the demo entry point from the `.aleph.ts` file, built and uploaded at publish time, mock-backed via MSW. The user operates it directly on the page (in a sandboxed iframe) — it is not a video, screenshot, or static documentation. Every attachment carries exactly one demo (`demo_artifact_url NOT NULL`), immutable and bound to its version at release time.

## Representative Version

The version whose manifests stand in for a point on point-level surfaces (point detail, map rollups): the latest `release`-classification version by the composite semantic key, falling back to the latest version of any classification (badged in the UI) when no release exists yet.

## Connection

A directed relationship between two Points. Connections are not symmetric — A depending on B is a different connection from B depending on A. A Point can have both outgoing connections (dependencies) and incoming connections (dependents/consumers).

## Contract

A behavior that emerges at the integration point between two connected Points. A Contract can be understood as a single behavior when looking at both Points together, but it is documented as individual use cases within each participating Point — each use case capturing the specific behavior that Point is responsible for in the interaction. Contracts link conceptually to use cases and to the Connection between the Points involved.

## Version-specific

Applied to use cases, connections, or tests that belong to a specific published version of a Point rather than to the Point as a whole. Tests will be tied to specific versions of a Point, specific use cases, and — where applicable — specific exports within a version.

## Point Export

A named export within a Point — something the Point explicitly exposes. In code terms, this maps to a named export in a module. Exports have stable identities; a rename creates a new export record rather than mutating the existing one.

## Export Succession

When a rename is detected at publish time and the user confirms continuity, the new export record carries a reference (`predecessor_export_id`) back to the one it succeeded. This preserves "formerly known as X" history without contaminating lineage.

## Platform-provided

A resource (framework, custom point type) with `organization_id IS NULL`, meaning it is seeded by Aleph itself and available to all organizations. Distinct from org-defined resources, which have a non-null `organization_id` and are only visible to their owning org.

## Org-defined

A resource (framework, custom point type) created by an organization, with `organization_id` set to that org's ID. Only visible to and modifiable by the owning organization.

## Magic Link

An authentication link emailed to a user containing a single-use plaintext token. Clicking the link redeems the token, creates a session, and authenticates the user. The token is never stored in plaintext — only its SHA-256 hash is persisted.

## Session

An active authenticated credential represented as a signed JWT (HS256) stored in an `HttpOnly; Secure; SameSite=Lax` cookie. The payload is identity-only — `user_id` and a 30-day expiry; no org claim (2026-06-11): org context comes from the URL and is membership-checked per request. No session record is stored in the database; signature verification needs no DB round trip.

## Monotonic Version

An application-managed integer assigned to each Point Version providing reliable total ordering within a Point's history — the insertion-order tiebreaker in the composite semantic ordering key, used wherever comparing semver strings would be fragile.
