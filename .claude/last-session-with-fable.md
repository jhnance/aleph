claude --resume fe525db6-c171-4646-9769-60635197a9c4

Phase 2, the publish knot. One running example carries the whole session: ProductCarousel, a frontend_component point.

- v1.0.0 (monotonic 1, release) exports Carousel and CarouselItem, with three use cases:
    - L1 (scoped to Carousel): "Clicking Next advances to the next item" — content record U1
    - L2 (scoped to CarouselItem): "Item lazy-loads its image" — content record U2
    - L3 (point-level, export_id NULL): "Module initializes without side effects" — U3
- v2.0.0 renames CarouselItem → CarouselSlide, confirmed via aleph reconcile-exports, so aleph.lock carries { from: "CarouselItem", to: "CarouselSlide" }
  and the publish payload sets predecessorExportId on the new export.

2.1 — What propagation + succession would look like

As specced today, this publish cannot succeed. Propagation copies all three associations from v1.0.0. The trigger checks each: U1 → Carousel is in v2's
manifest ✓; U3 is point-level ✓; U2 → lineage L2 points at the CarouselItem export row, which is not in v2's manifest (CarouselSlide is a brand-new
point_exports row) → trigger raises → entire publish rolls back. Since L2 is immutable, it points at the dead export forever — every future publish of this
point fails.

Proposed algorithm (inside the publish transaction, after the export manifest is written) — partition the predecessor's use cases four ways:

1. Point-level (export_id NULL) → copy. (v2, U3) inserted.
2. Export still present → copy. (v2, U1) inserted.
3. Export absent, confirmed succession — v2's manifest contains an export whose predecessor_export_id chain reaches the lineage's export (CarouselSlide →
   CarouselItem):
    - mint successor lineage L2′ scoped to CarouselSlide;
    - insert content record U2′ (title/content copied from U2) with parent_id = U2 — the one sanctioned cross-lineage parent_id the schema comment already
      anticipates;
    - insert (v2, U2′) — trigger passes, since L2′ points at an export v2 actually has.
4. Export absent, confirmed deletion → skip, and report it: the publish response gets a droppedUseCases: [{ lineageId, title, reason: 'export_removed' }]
   section, alongside successions: [{ fromLineage, toLineage }].

History is preserved twice over: the UI walks U2′.parent_id → U2 for edit ancestry across the rename, and CarouselSlide.predecessor_export_id →
CarouselItem for "formerly known as." Multi-hop renames work because succession matching walks the predecessor chain, not just one hop. An export with five
lineages gets five successor lineages — same rule per lineage.

2.5 — "Propagation over branches" explained

The predecessor graph is a tree, not a chain. After v2.0.0 ships, a critical 1.x bug forces 1.0.1-hotfix.1. Its predecessor resolves to v1.0.0 — the same
predecessor v2.0.0 has. Two children, one parent: a branch. Three consequences:

- Each publish propagates from its own predecessor, so the hotfix correctly inherits v1.0.0's use cases — including ones v2.0.0 dropped. That's intended
  and well-defined.
- "Remove from this version and all later versions" becomes ill-defined under branching: later along which branch? (This is an argument in Q4 below.)
- "Find a version's successors" queries WHERE predecessor_version_id = $id and can return multiple rows — which is why the missing index (checklist 6.7)
  will matter.

2.2 — Why this resolves half of removeUseCaseFromVersion

That open question actually bundles two different operations:

1. Stop inheritance going forward. With the skip mechanism in place, this is just "don't copy at the next publish" — add an optional suppress: [lineageId]
   list to the publish payload and it falls out of the same partition logic. No published manifest is ever mutated; v1.2's record stays true, v1.3 simply
   never includes the use case. This half is solved structurally by 2.1.
2. Retroactively remove from an already-published version (delete (v1.2, U) itself). This is the genuinely open half — it edits declared history, and it's
   where cascade semantics live (Q4).

2.4 — The duplicate-lineage race, concretely

U1 ("Clicking Next advances…") is associated with v2.0.0. Now:

1. Alice spots stale wording → Edit Use Case creates draft DA (lineage L1). Bob does the same → draft DB. Concurrent drafts are explicitly permitted
   (edit-use-case.md).
2. Both publish against pointVersionId = v2.0.0 at ~the same moment. Each transaction resolves parent_id = "most recently created use_cases row for L1."
   Neither sees the other's uncommitted insert — both read U1 as head.
3. Both commit: U1a (parent U1) and U1b (parent U1). The lineage's history is now a fork nobody asked for, and "most recently created" can tie on
   created_at — the head is ambiguous.
4. Worse, nothing removed the old associations: v2.0.0's manifest now holds U1, U1a, and U1b — three content records of one lineage.
   view-version-history.md groups by lineageId, so "Clicking Next advances…" renders three times, and a cross-version diff has no canonical v2 text.

Even with zero concurrency, steps 3–4's duplication happens on every edit-then-publish — the race just makes it worse. The fix is three small pieces:
SELECT … FOR UPDATE on the lineage row in the publish transaction (Bob waits, sees U1a, parents U1b correctly — linear history); replace-don't-add (delete
the lineage's existing association on the target version before inserting — legal, since the immutability pattern for this table is explicitly "remove and
re-insert"); and the schema guard UNIQUE (point_version_id, lineage_id) via a denormalized lineage_id column (drift-safe, same argument as point_id).

2.6 — The cycle-walk, explained

Every connection created at publish time has from_version_id = the version being created in that same transaction. A cycle through the new version would
need an edge pointing into it — but no edge can point at a version that didn't exist until now. So every publish-created edge runs newer→older, the
dependency graph is a DAG by construction, and the recursive-CTE walk can never find a cycle: dead code. Keep it as a cheap assertion if you like, but it's
not load-bearing.

Where cycles are possible: runtime other connections (POST .../connections) — arbitrary endpoints, any time. My take: don't enforce acyclicity there at
all. "Supersedes" / "related to" aren't dependency edges; a cycle isn't necessarily wrong. Just make any graph traversal (the ecosystem map) cycle-safe
with a visited set. That closes the "to be decided during implementation" note in create-connection.md.

2.3 — The payload, given all the above

POST /api/orgs/acme/points/:id/versions
{
"versionSemantic": "2.0.0",
"versionClassification": "release",
"exports": [{ "name": "Carousel" }, { "name": "CarouselSlide", "predecessorExportId": "<CarouselItem id>" }],
"useCases": [   // assembled by the CLI from aleph.lock + built artifacts
{ "lineageId": "<L1 uuid>", "demoArtifactUrl": "https://s3…/L1-2.0.0.html" }
],
"suppress": ["<lineage uuid>"], // optional — inherited lineages to drop (2.2)
"connections": [], "props": []
}

Server semantics: compute the propagation set (2.1); entries in useCases override their lineage's demo URL (artifacts uploaded pre-POST, decided); suppress
removes from the set; lineages in the set but not in useCases (UI-authored, no .aleph.ts) propagate per Q2/Q3 below. One known dependency: a useCases
entry whose lineage has no content record yet (CLI-first, never published) hits the open 06-09 "pre-publish record shape" question — that question now has
a forcing function and should be settled in this same design pass.

  ---
Four decisions close this out. My recommendations are marked, with the trade-offs in the descriptions:
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
← ☐ Propagation ☐ Demo copy ☐ Demo gate ☐ Removal ✔ Submit →

How should forward propagation handle export-scoped use cases whose export is absent from the new version's manifest?

❯ 1. Skip + succession (Recommended)
Confirmed deletions: skip and report as dropped. Confirmed renames: mint a successor lineage + content record with cross-lineage parent_id, association
lands on the new export. Preserves history through both the lineage graph and predecessor_export_id.

2. Skip only
   Drop on both deletion and rename; "formerly known as" survives via predecessor_export_id, but the use case's edit history restarts manually under the
   new export. Simpler server logic, lossier continuity.
3. Fail the publish
   Force the user to remove/migrate use cases explicitly before any export-removing publish. Maximally explicit, but makes every rename a multi-step chore
   and blocks CI publishes.
4. Type something.