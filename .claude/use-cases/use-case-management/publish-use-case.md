---
status: To Do
related:
  - use-case-management/draft-use-case.md
  - use-case-management/edit-use-case.md
  - versioning/publish-point-version.md
---

# Publish Use Case

A draft revision of an already-published use case is promoted to an immutable `use_cases` content record. This is a **language-only** operation (2026-06-10): the UI is a drafting surface and never creates version attachments — a use case appears on a point version only via the CLI version-publish payload, demo included.

This flow applies to **revisions only**. A brand-new use case has no UI publish step at all (2026-06-10): its draft is created (lineage registered at creation), edited freely, and promoted to the first content record by the CLI version publish that attaches it — leaving draft state *is* the version+demo association. See Draft Use Case and Publish Point Version.

The new content record propagates **forward**: the attachment rows on the version where the edit was made and on its predecessor-tree descendants are re-pointed to the new head (replace-don't-add). Earlier versions keep the content record they were published with — historical pages stay historically accurate. Demos and export scoping on re-pointed rows are untouched: propagation covers title/content language only.

Example: ProductCarousel has v1.0.0, a hotfix v1.0.1 (predecessor: v1.0.0), and v2.0.0 (predecessor: v1.0.0), all carrying lineage L1's use case "Clicking Next advances the carousel," content record U1. A PM on the v1.0.0 page edits it to clarify wrap-around behavior and publishes: new record U2 (parent U1), and the attachments on v1.0.0 *and its descendants* v1.0.1 and v2.0.0 all re-point to U2. Had the edit been made from the v2.0.0 page instead, only v2.0.0 would re-point — v1.0.1 sits on the hotfix branch, not in v2.0.0's descendant tree, and v1.0.0 is upstream.

## Acceptance Criteria

- `POST /api/orgs/:orgSlug/drafts/:draftId/publish` promotes the draft; requires an authenticated session
- The draft's lineage must have at least one existing version attachment — publishing a never-attached (brand-new) draft returns 409 with a message directing to the CLI flow (`aleph new use-case --id=<lineage uuid>` + version publish)
- **Promotion mechanics:**
  - the existing `use_case_lineages` row is locked (`SELECT ... FOR UPDATE`) for the duration of the transaction — this serializes concurrent edit-publishes for the same lineage and orders against any in-flight CLI version publish touching it
  - `parent_id` for the new `use_cases` row is the lineage head at publish time (which may differ from the record that initiated the edit if another edit landed in the interim)
  - **forward re-pointing:** with the lock held, the lineage's attachment rows on the *edited version and its predecessor-tree descendants* are updated: `UPDATE point_version_use_cases SET use_case_id = <new record> WHERE lineage_id = <lineage> AND point_version_id IN (<edited version + descendants>)`. Descendants are computed by recursive CTE over `point_versions.predecessor_version_id`, which spans branches — an edit at v1.0.0 reaches both the v1.0.1 hotfix line and v2.0.0; an edit at v2.0.0 does not touch a v1.0.1 published later on the other branch
  - the edited version is identified by a required `pointVersionId` on the request (the version page the user was editing from); it must carry an attachment for this lineage — 400 otherwise
  - `UNIQUE (point_version_id, lineage_id)` plus replace-don't-add makes "two content records of one lineage on one version" impossible by construction
- A `use_cases` row is inserted with `lineage_id`, `point_id` (from lineage), `organization_id` (from lineage), `parent_id` (resolved above), `title` and `content` from the draft; `use_cases` records are immutable after insertion (enforced by `trg_use_cases_immutable`)
- The `draft_use_cases` row is deleted
- The entire operation is atomic — if any step fails, the transaction rolls back and the draft is preserved
- Returns 201 with the new content record: `id`, `lineageId`, `title`, `content`, `parentId`, `repointedVersionIds`, `createdAt`
- Requires org role `member` or higher — `viewer` is read-only; insufficient role returns 403. The org is resolved from `:orgSlug` by the per-request slug⋈membership query (2026-06-11, URL-org-authoritative); a user with no membership in that org gets 404 (tenant-hiding). Unauthenticated requests return 401

## Notes (2026-06-10)

- Adding use cases after the fact is supported by *authoring any time* + *appearing on the next published version* — there is no retro-attachment to an already-published version. A `metadata`-classified release (`v2.0.0+docs.1`) is the cheap vehicle when the addition documents already-shipped code.
