# Design Review Checklist

Source: the 2026-06-09 multi-agent design review and Joshua's 32 annotations (2026-06-10).
Rule: every change we make from this list quotes the annotated review text it came from.
Work top-to-bottom by phase. `[x]` = done, `[s]` = session scheduled, `[ ]` = pending.

---

## Phase 1 — Pre-authorized fixes (applied 2026-06-10)

- [x] **1.1 Doc reconciliation sweep** *(annotation #9)*
  > Quoted text: "one reconciliation pass: fix publish-use-case.md to the 06-08 rule; amend the 06-09 sync section in place; decide title flow (pull-only + Aleph-authoritative titles is simplest — then publish should warn on local title drift, and detecting-use-cases.md's 'preflight sync check' reference goes away); either update data-model-decisions.md or banner it as superseded-by-decision-logs."
  > Joshua: "Go ahead and fix the inconsistencies."
  Done: `publish-use-case.md` reconciled to the 06-08 export-scoping rule; `decisions/2026-06-09.md` amended in place (sync pull-only, preflight scan-only); `aleph-sync.md`, `detecting-use-cases.md`, `publish-workflow.md` aligned to Aleph-authoritative titles + drift warning; `data-model-decisions.md` bannered and its four stale sections corrected; `demo_artifact_url` landed in the DDL.

- [x] **1.2 `draft_use_cases.organization_id`** *(annotation #10)*
  > Quoted text: "Add the column + compound FK like the other ten tables."
  > Joshua: "Yes, an obvious miss. Add this."
  Done in `data-model.md` (sketch) and `draft-use-case.md` (criterion).

- [x] **1.3 UUID-only use case ids** *(annotation #21)*
  > Quoted text: "Either ids are UUIDs only (fix every slug example + the lock-file example) or add an external slug column with per-point uniqueness."
  > Joshua: "Swap out the slugs and just use UUIDs. The title will be the thing we use to make it human readable."
  Done: examples updated in `detecting-use-cases.md`; amendment note added to `decisions/2026-06-09.md`; decision logged.

- [x] **1.4 DDL fixes** *(annotation #23; #22 answered in chat)*
  > Quoted text: "Make the id a UUID, and smoke-test the whole DDL against Postgres before it seeds migrations."
  > Joshua: "We'll definitely do final passes on it before we ever actually use it against Postgres... For now, fix the issues you saw."
  Done: `frontend_frameworks.id` → UUID; mangled paren formatting in CHECK clauses repaired; smoke-test deferred to pre-migration pass.

- [x] **1.5 `set_config` instead of `SET LOCAL ... = $1`** *(annotation #25)*
  > Quoted text: "SET LOCAL app.current_org_id = $1 can't take a bind parameter — use SELECT set_config('app.current_org_id', $1, true)."
  > Joshua: "Sounds good."

- [x] **1.6 Index on `auth_codes.code_hash`** *(annotation #26)*
  > Quoted text: "No index on auth_codes.code_hash"
  > Joshua: "We can add that"

- [x] **1.7 Magic-link rate limiting criterion** *(annotation #27)*
  > Quoted text: "no rate limit on magic-link requests"
  > Joshua: "This wouldn't be specified in the DB schema, right? Where were you expecting to see this—in the use case write-up? If so, that's a fine thing to add."
  Done: acceptance criterion added to `magic-link-sign-in.md` (yes — it's an API-layer behavior, so the use case file is its home).

- [x] **1.8 Tenant-hiding 403 → 404** *(annotation #29)*
  > Quoted text: "pick one (404 is conventional)"
  > Joshua: "Move the 403s to 404s then"
  Done in `update-custom-point-type.md`, `delete-custom-point-type.md`, and the `data-model.md` example code. 403 is now reserved for authorization denials (insufficient role, org-context mismatch, non-membership on org switch).

- [x] **1.9 Role enforcement baseline** *(annotation #13)*
  > Quoted text: "A blanket one-liner (viewer read-only; member+ writes; admin+ manages org resources) added to the use-case files now avoids an API-behavior change post-launch."
  > Joshua: "feel free to add it"
  Done: role criterion added to every mutating use case; decision logged.

- [x] **1.10 Org slug in URL path** *(annotation #24)*
  > Quoted text: "Cheapest durable fix is org slug in the URL path (also fixes deep links)"
  > Joshua: "this seems reasonable to me; update this in the relevant places, please"
  Done: org-scoped routes moved under `/api/orgs/:orgSlug/...`; mismatch-with-active-org behavior defined; decision logged. NOTE: interaction with the no-DB-lookup JWT model is flagged for the Phase 3 security session.

- [x] **1.11 S3 named as the object-storage backend** *(annotation #7)*
  > Quoted text: "artifact upload implies an object-storage backend that appears nowhere in the architectural constraints — name it."
  > Joshua: "S3"
  Done: added to ALIGNMENT.md architectural constraints.

- [x] **1.12 Stub files created for missing surfaces** *(annotations #15, #16, #17, #18, #20)* — see Phase 4 for filling them out.

---

## Phase 2 — Interactive session: the publish knot ✓ (2026-06-10)

Session outcome: the knot dissolved when Joshua identified server-side forward propagation as an anachronism ("I believe we designed around the need for that kind of forward propagation when we committed ourselves to the .aleph.config... file"). Decisions in `decisions/2026-06-10.md`.

- [x] **2.1 Show the propagation + succession design** *(annotation #2)*
  > Quoted text: "skip lineages whose export is absent from the new manifest (report them as dropped in the publish response), and for confirmed renames, have the publish handler create successor lineages + content records with cross-lineage parent_id"
  > Joshua: "Show me what this would look like, please."
  Walked through (ProductCarousel example), then superseded: propagation removed entirely; export scoping moved to `point_version_use_cases` so lineages survive renames — no skipping, no successor minting, no cross-lineage parent_id.

- [x] **2.2 Elaborate: how this relates to `removeUseCaseFromVersion`** *(annotation #3)*
  > Quoted text: "it also resolves half of the open removeUseCaseFromVersion question's surface area"
  > Joshua: "Please also elaborate on this point."
  Resolved as **unpublish/republish** (soft retraction, `unpublished_at`, admin view, never delete); cascade question mooted — no propagation means independent rows. `remove-use-case-from-version.md` rewritten.

- [x] **2.3 Publish payload gaps, one at a time** *(annotations #4, #5, #6)*
  > Quoted text: "New use cases never reach a version... Demo artifact association violates the schema's own trigger... Titles have no push path"
  > Joshua: "let's address these each in turn in an interactive session." Also (#4): "What do you mean by 'can't carry.' It seems like it *doesn't* contain what it needs, but your claim is that it *cannot*?" — conceded: "doesn't", not "can't"; it's a spec gap, not an impossibility. Upload-before-POST endorsed (#6: "good").
  Payload designed: `useCases: [{ lineageId, title, exportName?, demoArtifactUrl }]`; trigger replaced by compound FK to `point_version_exports`; titles were already pull-only (06-10). `publish-point-version.md` + `publish-workflow.md` updated; `aleph-config.md` created (files-only, config-for-discovery).

- [x] **2.4 Worked example: duplicate lineage on one version + racy head** *(annotation #11)*
  > Quoted text: "Edit-then-publish puts two content records of one lineage on the same version, and head resolution is racy... Fix: denormalize lineage_id onto point_version_use_cases + UNIQUE (point_version_id, lineage_id)... replace-don't-add... lock the lineage row"
  > Joshua: "Give me a specific example of this happening."
  Alice/Bob example shown; all three fix parts adopted in the DDL (`lineage_id` + UNIQUE, lineage `FOR UPDATE` lock, replace-don't-add via narrow `use_case_id` mutability).

- [x] **2.5 Explain propagation-over-branches** *(annotation #28)*
  > Quoted text: "propagation-over-branches should be stated in the propagation session"
  > Joshua: "What does this mean?"
  Explained (predecessor tree; hotfix + next release share a predecessor). Now only relevant to language-edit re-pointing: "forward" = predecessor-tree descendants of the edited version (spans branches), specced in `publish-use-case.md`.

- [x] **2.6 Explain the cycle-walk dead-code claim** *(annotation #30)*
  > Quoted text: "The publish-time recursive-CTE cycle walk is dead code: every publish-created edge originates at the brand-new version, so the graph is a DAG by construction..."
  > Joshua: "Need more context. Not following."
  Explained (in-degree-zero argument + point-vs-version mutual dependency example); Joshua: rewrite the section — "cycles aren't possible in the current design, but we'll want to be mindful of introducing later features that could introduce cycles." `data-model.md` + `publish-point-version.md` updated; walk removed.

- [x] **2.7 The pre-existing forward-propagation session checklist** (from `use-cases/index.md`): `removeUseCaseFromVersion` cascade semantics, publish-time suppression, stale-use-case UX, `propagated BOOLEAN` column.
  All four mooted or resolved by removing propagation; index.md session marked ✓.

- [x] **2.8 `demo_artifact_url` NULL semantics** *(code-review annotations, 2026-06-10)*
  > Joshua: "We need to carefully think through when—if ever—it is okay to have NULL here. I think... this is only applicable to draft use cases authored in Aleph's UI." / "You should be forced to associate a use case with a version+demo if moving it out of draft."
  Resolved stronger than the working position: **NOT NULL** — "demos should never propagate. Demos are immutable and attached to a certain point version at release time" (Joshua). The UI is a drafting surface and never attaches; every attachment is born in a CLI publish with its demo.

- [x] **2.9 Adding use cases (and demos) to an already-published version** *(code-review annotation, 2026-06-10)*
  > Joshua: "The only problem with this is when you publish a new version of the codebase without a corresponding use case. In general, you shouldn't do this, but it will happen. We need to make sure people have the ability to add use cases after the fact... We need to address this flow in our use cases design documents."
  Resolved as **author any time, appears on the next published version** — no retro-attachment; `metadata` releases (`+` suffix, same code) are the cheap vehicle for doc-only additions. Accepted tradeoff (Joshua): "no retroactive association of use case language to old versions of the code. Fine for now." New TODO recorded in `point-detail.md`: owner-authored public-facing version notes (explain unpublishes to users).

---

## Phase 3 — Interactive session: security deep dive ✓ (2026-06-11)

Session outcome: per-command RLS policies on nullable-org tables; hybrid identity-plane posture (exempt + user-keyed); `SameSite=Lax` CSRF posture with documented login-CSRF acceptance; transactions scoped to DB work with role-level timeouts; URL-org authority closing the 30-day revocation gap. Decisions in `decisions/2026-06-11.md`; SECURITY.md now indexes postures and accepted risks. Process outcome: access-matrix convention (ALIGNMENT.md) + adversarial beats encoded in the SDLC skills.

- [x] **3.1 RLS policy hole on nullable-org tables** *(annotation #8)*
  > Quoted text: "The decided RLS policy on nullable-org tables lets any tenant hijack or delete platform rows... Recommendation: split into per-command policies — FOR SELECT allows platform + own rows; FOR UPDATE/DELETE restrict both USING and WITH CHECK to own-org rows only."
  > Joshua: "I'm gonna need a dedicated deep dive interactive session with you on this one. Add it to our checklist."
  Done (2026-06-11): per-command policies adopted as recommended (`data-model.md`, RLS section, with access matrix). Considered and rejected: separate platform/tenant tables (dual-FK tax on `frontend_components.framework` / `custom_points.custom_type_id`). Process outcome: access-matrix convention for security mechanisms added to ALIGNMENT.md. Decisions logged in `decisions/2026-06-11.md`.

- [x] **3.2 RLS for pre-org tables + SameSite/CSRF walkthrough** *(annotation #12)*
  > Quoted text: "decide exempt-with-documented-app-guards or user-keyed policies. (c) No SameSite/CSRF decision anywhere despite cookie-borne sessions — likely one line (SameSite=Lax + Secure), but decide it."
  > Joshua: "Walk me through these two more thoroughly?"
  Done (2026-06-11): hybrid — `auth_codes`+`users` exempt with documented app guards (their flows run unauthenticated; nothing to key a policy on), `organizations`+`organization_memberships` user-keyed via new `app.current_user_id` session var (org INSERT requires only an authenticated user — the owner membership row can't precede the org row). Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/` + no state-changing GETs under cookie authority + `Origin`/JSON content-type checks; login CSRF accepted and documented. Access matrices per the new convention. Updated: `data-model.md` (RLS + new cookie/CSRF section), `magic-link-sign-in.md`, ALIGNMENT.md; decisions logged in `decisions/2026-06-11.md`.

- [x] **3.3 Transaction scoping how-to** *(annotation #31)*
  > Quoted text: "scope the transaction to DB work and set statement timeouts"
  > Joshua: "how?"
  Done (2026-06-11): transaction = one unit of DB work, nothing else (general rule, encoded in ALIGNMENT.md). RLS context moves from the request-spanning preHandler transaction (rewritten in place) into a `withRequestContext` helper; `sql.reserve()` per request eliminated; external IO ordered around the transaction (inputs before, email/search after commit). Role-level timeouts: statement 5s / lock 2s / idle-in-transaction 10s / transaction 30s (Postgres pinned ≥ 17), `aleph_service` exempt, `SET LOCAL` overrides for heavy ops (publish 15s). Updated: `data-model.md` (prereq #2 + new *Transaction scoping and statement timeouts* section), `magic-link-sign-in.md` (email after commit), `publish-point-version.md` (`SET LOCAL` + no-IO-by-construction), ALIGNMENT.md; decision logged.

- [x] **3.4 Carried in from 1.10:** org-slug routing vs. the no-DB-lookup JWT model (does the URL org become authoritative? membership check per request?). Also the 30-day membership-revocation gap and JWT mitigation choice.
  Done (2026-06-11): URL org is authoritative; JWT slimmed to identity (`sub`/`exp`/`iat`/`jti` — `org` claim deleted); one indexed slug⋈membership query per org-scoped request (riding the 3.3 transaction) returns org id + role — revocation gap closed to zero, roles per-request fresh, multi-tab/deep links fixed, switch-org endpoint and `org_context_mismatch` deleted, never cache the check. Residual user-level revocation: `jti` denylist escape hatch + secret rotation. Updated: `data-model.md`, `magic-link-sign-in.md`, `org-switching.md` (rewritten), `cli-auth.md`, `aleph-config.md` (org-from-token question resolved: explicit), ALIGNMENT.md, SECURITY.md; decision logged.

---

## Phase 4 — Product surface: design sessions + filling the stubs

- [x] **4.1 Invite flow — promote to designed use case** *(annotation #14)*
  > Quoted text: "Promote it from open question to designed use case."
  > Joshua: "Agreed; add it to a checklist."
  Done (2026-06-12): consent-gated invitations reusing the magic-link machinery (Joshua's forks: invitation-only; explicit accept surfaced at sign-in; admin+ invites; inviter picks role, owner excluded; domain auto-join deferred post-MVP). `org_invitations` DDL + three-plane RLS policy (capability-keyed redemption branch) + access matrix in `data-model.md`; `invite-flow.md` fully specced; magic-link redirects surface pending invites; ALIGNMENT.md open question closed; decision logged in `decisions/2026-06-12.md`. Resolves the 3.2 memberships-INSERT follow-up (insert happens as the invitee — user-id branch).

- [ ] **4.2 Read-path use cases** *(annotation #15)* — stubs created: `catalog/browse-catalog.md`, `catalog/point-detail.md`, `catalog/view-use-case.md`, `catalog/ecosystem-map.md`.
  > Quoted text: "There is no use case for browsing domains, listing points, a point detail page, viewing a use case's content, playing a demo_artifact_url, or any map/graph view"
  > Joshua: "Notable gaps; we should definitely stub these out and work on filling them out."

- [ ] **4.3 AI-driven bulk onboarding (CLI)** *(annotation #16)* — stub created: `sdk-cli/bulk-onboarding.md`.
  > Quoted text: "no story for onboarding an existing ecosystem (bulk import / repo scan vs. one-point-at-a-time)"
  > Joshua: "We can add this as a feature to the CLI. It would be AI-driven."

- [ ] **4.4 Connection/dependency authoring** *(annotation #17)* — stub created: `connections/declare-dependencies.md`.
  > Quoted text: "Spec it with the same care exports got."
  > Joshua: "Agreed. We can consider adding to the CLI a way to check package manager metadata locally and cross-reference known packages in Aleph with the ones being brought in locally as dependencies. Overall, this might also go in the same aleph config file we define our exports and use cases in, at least the dependencies. Dependents would be filled in at run time."

- [ ] **4.5 Props ingestion** *(annotation #18)* — stub created: `sdk-cli/props-extraction.md`.
  > Quoted text: "Decide the ingestion mechanism (react-docgen/TS compiler API at publish) or make props carry forward until redeclared."
  > Joshua: "If we don't have a stub use case for this, add it and add this line as a starting point."

- [ ] **4.6 Health scores** *(annotation #20)* — stub created: `health-checks/health-score.md`.
  > Quoted text: "Decide score-vs-boolean; add versionId?/exportId? to violations."
  > Joshua: "We definitely need to spec out health scores more. This was left intentionally vague and incomplete. In reality, health scores will be either pipeline actions or CLI steps we run against the codebase. If it lives in the CLI, that helps us to centralize everything, but it does make the CLI codebase pretty unwieldy. If we have dedicated pipeline actions, we can publish one per supported language/framework and people can just import the ones they want. Either way, stub this out if it doesn't exist already, or add some notes related to the above comments."

---

## Phase 5 — Search design

- [s] **5.1 Per-lineage search indexing, with example** *(annotation #19)*
  > Quoted text: "Index per-lineage heads, re-index on publish."
  > Joshua: "I'd like to see this spelled out a little more with an example, but we want to make sure that search is actually usable, so this seems like a good callout if I'm understanding correctly."
  Also covers the dual-write consistency decision (outbox vs. periodic reconciliation re-index).

---

## Phase 6 — Final minors walkthrough *(annotation #32)*

> Joshua: "We can walk through all of these in order at the end."

- [ ] 6.1 `data-model.md` points at `design/open-questions.md`, which is empty (open questions live in ALIGNMENT.md)
- [ ] 6.2 `use-cases/index.md` still lists the title-push open question that 06-09 declared moot
- [ ] 6.3 CLI output prints `version_monotonic`, an internal tiebreaker
- [ ] 6.4 Domains have no rename / re-parent / archive story — record as a decision either way
- [ ] 6.5 Multi-org CLI users are told to "set an active org" but no CLI org-switch command exists
- [ ] 6.6 `cli-auth.md`'s Bearer-token + polling flow implies backend surface (device-code endpoint) no decision provides
- [ ] 6.7 (carried from review) no index on `point_versions.predecessor_version_id`
- [ ] 6.8 Backfill `related:` frontmatter across the older use case files *(code-review annotation: "For use cases like this that connect to other use cases, we should add to the frontmatter of each use case .md file those relationships" — convention established 2026-06-10; new/edited files have it, older files pending)*
