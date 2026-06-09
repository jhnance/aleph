All four subagent reviews are in, and I've independently verified every major claim against the primary sources (
`data-model.md`, the decision logs, and the use-case files). The reviews converged strongly — the four agents independently found the same top problems, which raises confidence considerably. Here's the cross-checked analysis.

# Overall assessment

The design corpus is in genuinely good shape for pre-code: the auth reasoning, the compound-FK denormalization pattern for RLS, the immutability/lineage model, and the versioning classification machinery are all sound and well-argued (all four agents and I agree — none of that needs rework). The real problems cluster in three areas:

1. **Two decided mechanisms collide
   ** — forward-propagation and the export-presence trigger cannot coexist as written.
2. **The CLI publish contract and the server publish endpoint don't meet
   ** — the payload can't carry what the CLI flows require.
3. **Doc hygiene broke down in the last ~48 hours
   ** — the 06-08 and 06-09 decisions were only partially propagated, and yesterday's use-case sweep actually
   *reintroduced* a rule that 06-08 explicitly removed.

Nothing requires a redesign. But findings 1–4 below must be resolved before any schema or publish-flow code is written.

---

# Critical

### 1. Forward-propagation is guaranteed to abort any publish that drops or renames an export carrying use cases

*Found by all three engineering agents; verified directly.*

`publish-point-version.md:19` says propagation "copies **all**
`point_version_use_cases` rows from that predecessor." But `data-model.md:581-608` defines
`trg_check_version_use_case_export_presence` (BEFORE INSERT on
`point_version_use_cases`), which raises if a copied use case's lineage references an export absent from the new version's manifest. Publish v2 without an export that had use cases in v1 → the propagation INSERT trips the trigger → the entire publish transaction rolls back. Since lineages are immutable, a renamed export's old lineage
*permanently* points at the predecessor export, so this isn't an edge case — it fires on every rename forever after.

Related gap: `data-model.md:339-343` anticipates cross-lineage
`parent_id` records for rename succession, but **no flow anywhere creates them**.
`export-rename-succession.md` promises old lineages "remain accessible" without saying who mints the successor lineages.

**Recommendation:
** decide propagation semantics explicitly — skip lineages whose export is absent from the new manifest (report them as dropped in the publish response), and for confirmed renames, have the publish handler create successor lineages + content records with cross-lineage
`parent_id`. This belongs in the forward-propagation session already on your checklist; it also resolves half of the open
`removeUseCaseFromVersion` question's surface area.

### 2. The publish payload can't carry what the CLI flows require — three concrete breaks

*Backend + frontend + principal converged; verified directly.*

`POST /api/points/:id/versions` (
`publish-point-version.md:11`) accepts version info, exports, connections, props — **no use case
IDs, no titles, no artifact URLs**. Consequences:

- **New use cases never reach a version.
  ** The lock file is "the authoritative registry" of declared use case IDs, but the server only forward-propagates from the predecessor. A use case added since the last version has no path into the new version's manifest.
- **Demo artifact association violates the schema's own trigger.**
  `publish-workflow.md:25` uploads artifacts *after* the POST succeeds and "associates each with its
  `point_version_use_cases` row" — an UPDATE that
  `trg_point_version_use_cases_immutable` forbids. Also, `demo_artifact_url` (decided 06-09) *
  *doesn't exist in the DDL** at all (`data-model.md:376-387`), even though
  `publish-point-version.md:19` already references it. And a crash between version-commit and upload leaves a published version with no demos and no specified retry path.
- **Titles have no push path** (see finding 4).

**Recommendation:** add a
`useCases` section to the publish payload (IDs + titles + artifact references). For artifacts, upload
*before* the POST (pre-signed URLs) so
`point_version_use_cases` rows are written once, complete — this keeps the immutability trigger intact. Add the column to the DDL. Also note: artifact upload implies an object-storage backend that appears nowhere in the architectural constraints — name it.

### 3. The decided RLS policy on nullable-org tables lets any tenant hijack or delete platform rows

*Backend agent; verified directly against `data-model.md:954-958`.*

The policy for `frontend_frameworks`/`custom_point_types` is a single (implicitly `FOR ALL`) policy:
`USING (org IS NULL OR org = current)`, `WITH CHECK (org = current)`. Two holes: **DELETE
** is governed by `USING` alone, so any tenant can delete the seeded "React" row; **UPDATE
** can target a platform row via `USING` and rewrite
`organization_id` to the attacker's own org (passing
`WITH CHECK`), stealing it from every other tenant. The app-layer queries mask this, but RLS exists precisely as the backstop for app-layer bugs — and this design leans on that argument explicitly.

**Recommendation:** split into per-command policies — `FOR SELECT` allows platform + own rows;
`FOR UPDATE`/`DELETE` restrict both `USING` and `WITH CHECK` to own-org rows only.

### 4. Stale artifacts now encode superseded decisions — and the sweep made it worse

*All four agents; verified directly.*

- **`publish-use-case.md:13`** requires
  `exportId` when a point has exports, "because the export-scoping trigger on
  `use_case_lineages` would reject a null `export_id`." That trigger was **removed
  by `decisions/2026-06-08.md`
  **, which decided the opposite: point-level lineages are always valid. This file was rewritten in yesterday's sweep — the sweep re-encoded the abolished rule into fresh acceptance criteria.
- **`data-model-decisions.md`
  ** is stale in four load-bearing places: it still says tenant isolation "is scoped to the **domain
  **" with `domain_memberships` and
  `SET LOCAL app.current_user_id` (lines 116–128 — superseded by org-level RLS); still documents
  `UNIQUE (point_id, export_id)` on lineages and the point-level export-scoping trigger (both removed 06-08); still describes
  `--is-prerelease`/`--is-hotfix` (replaced by
  `--release-type` 06-09). It presents itself as the rationale companion — right now it's the most dangerous file in the repo for an implementer.
- **`decisions/2026-06-09.md` contradicts itself**: the
  `aleph sync` section says bidirectional ("pushes them up"), the preflight section says publish runs "scan
  **and** sync," and the open-question section says "sync is now pull-only — moot."
  `aleph-sync.md` says pull-only but defers title-push to publish;
  `publish-workflow.md` has no sync preflight and no title step. Net: **editing `title:` in
  a `.aleph.ts` file has no path to Aleph at all.**

**Recommendation:** one reconciliation pass: fix
`publish-use-case.md` to the 06-08 rule; amend the 06-09 sync section in place; decide title flow (pull-only + Aleph-authoritative titles is simplest — then publish should
*warn* on local title drift, and
`detecting-use-cases.md`'s "preflight sync check" reference goes away); either update
`data-model-decisions.md` or banner it as superseded-by-decision-logs.

---

# Significant

**5. `draft_use_cases` breaks the design's own RLS rule.** `draft-use-case.md:20` explicitly states
`organization_id` is *not* on the table;
`data-model.md`'s RLS prerequisite #3 declares it denormalized "onto all downstream tables ✅ Done." The most user-mutable table in the system either gets a join-based policy (the pattern the design forbids) or sits outside RLS. Add the column + compound FK like the other ten tables.

**6. Edit-then-publish puts two content records of one lineage on the same version, and head
resolution is racy.** The PK on `point_version_use_cases` is
`(point_version_id, use_case_id)`; publishing a revision inserts the new record's association but nothing removes the old head's association with that version —
`view-version-history.md` groups by lineage and will render duplicates. Separately,
`parent_id` = "most recently created row for the lineage" with no locking, while
`draft-use-case.md:19` explicitly allows concurrent drafts — two publishes can both claim the same parent. Fix: denormalize
`lineage_id` onto `point_version_use_cases` +
`UNIQUE (point_version_id, lineage_id)` (drift-safe given immutability), replace-don't-add in the publish transaction, and lock the lineage row (
`SELECT … FOR UPDATE`) during publish.

**7. Auth gaps — one decision, three loose ends.
** (a) A user removed from an org keeps full access to it for up to 30 days: membership is only checked at sign-in/org-switch, and
`app.current_org_id` comes straight from the JWT. Session *revocation* is a logged deferral; *
*authorization
** revocation (routine offboarding) is nowhere acknowledged — log it as an accepted risk or add a cheap membership check on mutating requests. (b) RLS is unspecified for
`users`, `organizations`, `organization_memberships`, `auth_codes` — the org-switcher must read orgs
*other
than* the active one, which an org-keyed policy forbids; decide exempt-with-documented-app-guards or user-keyed policies. (c) No
`SameSite`/CSRF decision anywhere despite cookie-borne sessions — likely one line (`SameSite=Lax` +
`Secure`), but decide it.

**8. Roles exist; nothing uses them.
** Four roles decided (06-06, "application-layer authorization"), yet every mutating use case says only "an org member" — as specced, a
`viewer` can create, publish, and delete everything. A blanket one-liner (viewer read-only; member+ writes; admin+ manages org resources) added to the use-case files now avoids an API-behavior change post-launch.

**9. MVP sequencing: multi-user orgs are unreachable.** The only path into an org is creating one;
`invite-flow.md` is a deferred stub. Everything the MVP is
*for* — shared catalog, search, collaboration — is single-player until this is designed, and the minimal variant (admin adds email; user signs in via the existing magic-link path) reuses everything already built. Promote it from open question to designed use case.

**10. The read path — the actual product — has no spec.** (PM agent's top finding; verified:
`GET /api/points` exists only as a parenthetical in
`evaluate-point-health.md:17`.) There is no use case for browsing domains, listing points, a point detail page, viewing a use case's content, playing a
`demo_artifact_url`, or any map/graph view — while month-three machinery (metadata releases, export succession) is specced in depth. Related: no story for onboarding an
*existing* ecosystem (bulk import / repo scan vs. one-point-at-a-time), which is the entire target customer. Spec 3–4 read use cases and decide the onboarding direction before more write-path depth; that's also where the claimed PM/designer personas would actually live.

**11. Connections have storage but no authoring path.**
`dependency` edges arrive only via the publish payload as
`toVersionId`s, and the CLI summary lists "new connections" — but nothing anywhere describes how the CLI or a user determines them (exports got a full detection spec; dependencies got nothing). Plus the target point must already be published, which compounds the onboarding gap. Spec it with the same care exports got.

**12. Props manifests will be empty and the diff UI will lie.
** Props arrive only in the publish payload and are deliberately not forward-propagated — but
`publish-workflow.md` (the only producer of that payload) never mentions props, and no use case covers extraction. Net: every CLI-published
`frontend_component` version has an empty props manifest, and v1→v2 diffs show "all props removed." Decide the ingestion mechanism (react-docgen/TS compiler API at publish) or make props carry forward until redeclared.

**13. Search model doesn't fit immutable use cases, and sync is a bare dual-write.**
`search-and-discover.md` indexes "rows in `use_cases`" with upserts on "created or updated" — but
`use_cases` rows are never updated and every edit is a new row, so search indexes every superseded record (duplicate, stale hits) and the update event never fires. Index per-lineage heads, re-index on publish. And the Postgres→Meilisearch dual-write has no failure story — for the stated quality bar, decide outbox or a periodic reconciliation re-index now.

**14. Health contract drift.** 06-09 says a null `demo_artifact_url` "affects the point's **health
score**";
`evaluate-point-health.md` (rewritten the same day) is boolean with "the invariants above are the complete set for now." Also, violations are prose-only — the UI can't badge a specific version or export from
`{ rule, detail }`. Decide score-vs-boolean; add `versionId?`/`exportId?` to violations.

**15. The `.aleph.ts` `id` has no home in the data model.
** 06-09 calls it "the lineage key" with slug examples (`'login-flow'`), but
`use_case_lineages.id` is a generated UUID and the CLI-first flow generates "a UUID-based id." Either ids are UUIDs only (fix every slug example + the lock-file example) or add an external slug column with per-point uniqueness. This also gates the open pre-publish-record-shape question.

**16. Schema file has never met a real Postgres.** Verified: `frontend_frameworks.id` is
`INT GENERATED ALWAYS AS IDENTITY` (`data-model.md:129`) while `frontend_components.framework` is
`UUID REFERENCES frontend_frameworks (id)` (line 180) — an FK type mismatch that won't execute; the worked example inserts
`'fw-react'` into a
`GENERATED ALWAYS` identity column (doubly invalid). There's also formatter damage (stray parens in CHECK clauses, e.g. lines 15–17, 88–89, 406–407). Make the id a UUID, and smoke-test the whole DDL against Postgres before it seeds migrations.

**17. Multi-tab org switching has no client contract.
** Active org lives only in the shared cookie; a switch in tab A silently re-scopes tab B's requests while its rendered state belongs to the old org — cross-tenant data
*mixing* in the UI. Cheapest durable fix is org slug in the URL path (also fixes deep links); minimum is echoing
`organizationId` in every response and hard-invalidating on mismatch. Decide before route shapes freeze — it changes every endpoint path or every response envelope.

---

# Minor (quick log of verified items)

- `SET LOCAL app.current_org_id = $1` can't take a bind parameter — use
  `SELECT set_config('app.current_org_id', $1, true)`.
- No index on
  `auth_codes.code_hash` (redemption is a seq scan on a never-pruned table); no rate limit on magic-link requests.
- No index on `point_versions.predecessor_version_id`; note the predecessor graph is a
  *tree* (hotfix + next release can share a predecessor) — propagation-over-branches should be stated in the propagation session.
- Tenant-hiding is 403 in some files (`update-custom-point-type.md`, and `data-model.md`'s own
  `ForbiddenError` examples) and 404 in others — pick one (404 is conventional).
- The publish-time recursive-CTE cycle walk is dead code: every publish-created edge originates at the brand-new version, so the graph is a DAG by construction. Keep it as a cheap assertion at most; the real undecided case is runtime-created
  `other` connections.
- The request-spanning
  `sql.reserve()` transaction will hold connections across external IO (email send, Meilisearch, uploads) — scope the transaction to DB work and set statement timeouts.
- `data-model.md:502` points at `design/open-questions.md`, which is empty;
  `index.md` still lists the title-push question 06-09 declared moot; CLI output prints
  `version_monotonic`, an internal tiebreaker; domains have no rename/re-parent/archive story (fine, but record it as a decision); multi-org CLI users are told to "set an active org" but no CLI org-switch command exists, and
  `cli-auth.md`'s Bearer-token + polling flow implies backend surface (device-code endpoint) no decision provides.

# Verified solid — don't churn these

SHA-256 over bcrypt for 256-bit tokens; the atomic
`UPDATE … RETURNING` redemption; the dual partial indexes for sibling-scoped domain slugs; the compound-FK
`(id, organization_id)` pattern (looks like over-engineering, is the legitimate price of join-free RLS, applied uniformly);
`FOR UPDATE` on the point row for monotonic assignment; multiple-valid-magic-links as a documented tradeoff; the hotfix/prerelease/metadata classification machinery (convoluted but internally consistent and honestly motivated).

# Suggested order of attack

1. One **doc-reconciliation pass
   ** (finding 4 + minors) — cheap, and it stops the corpus from actively misleading the next session.
2. The **forward-propagation decision session
   ** already on your checklist, expanded to cover findings 1, 2, and 6 together — they're one knot: what propagates, what the payload carries, who mints successor lineages, and per-version lineage uniqueness.
3. **RLS hardening** (3, 5, 7b) as a single security pass on the schema doc.
4. **Product-shape decisions** (9, 10, 11, 17) before any route or payload shapes freeze.

Want me to start with the doc-reconciliation pass, or run the forward-propagation alignment session first?