# Milestone 4 kickoff: a place to revisit writing

Prepared and accepted November 1, 2026. Status: implementation in progress; the first navigation
increments have passed the user's reported loop and inspection review. The writing-linked marker
creation/read/return loop is implemented behind an off-by-default gate and has passed automated
browser and guarded database checks. The user reported the full local marker walkthrough and
polished UI passing on November 5; physical-device details and wider acceptance remain unrecorded. This responds to the request to plan from the
[reboot starter prompt](activity-forest-reboot-starter-prompt.md).

## Baseline and gap

- At planning time, branch `production-owner-loop` was at `e7f2ee3`. Local `master` and the locally recorded
  `origin/master` point to `40f8041`; `HEAD...master` has zero branch-only and nine master-only
  commits. Remote configuration is `origin`, using the repository's GitHub SSH URL. Remote
  freshness was not checked during planning. See increment 1 below for the refreshed state.
- Initial status contains two untracked user documents: the starter prompt and
  `development-reboot-review.md`. Preserve both. No filesystem `AGENTS.md` was found in the
  checkout; the supplied instruction to use Robert's nvm was followed.
- Fresh non-autofixing baseline on this commit: Node 24.15.0 via
  `/home/robert/.nvm/nvm.sh`, direct Jasmine: **1,240 specs, zero failures**; `npm run lint` passes.
  This does not repeat authenticated browser, database-fixture, or physical-device evidence.
- Part III Milestones 1–3 have completion evidence in their recorded scopes. Production already
  has stable real-writing trees, reauthorized inspection, semantic writing access, hide/restore,
  and account-backed marker creation/movement/removal with recovery and bounded regional reads.
- The missing product connection is a deliberate authored choice that helps someone revisit
  meaningful real writing. The prototype bench uses fixtures; its local persistence and writing
  selection cannot simply become production authority.

The immediate question is: **Does seeing writing become a place make someone want to revisit it
or write again?** Technical continuity is established groundwork, not evidence of attachment or
commercial viability.

## First slice comparison and recommendation

| Option | Player benefit | Additional scope and risk |
| --- | --- | --- |
| Nearby-writing bench | A recognizable reading place; prototype review found it redirected attention toward writing | New kind/appearance/placement; bounded nearby selection and empty results; sitting is implied but not implemented |
| Writing-linked marker — recommended | Deliberately mark one meaningful writing tree and reopen its writing through the chosen place | Explicit versioned relationship and current authorization; reuse marker placement, rendering, and save/recovery controls |
| Named clearing | Give an area a memorable identity around writing | Naming, text validation, area membership and navigation; weaker direct writing action unless another relationship is added |

Implement only the writing-linked marker. This chooses the shortest route to testing intentional
writing memory, not a broad marker system. The bench findings in the
[First Clearing evaluation](milestone-10-clearing-loop-evaluation.md) remain useful evidence, not
proof that a marker will have equivalent emotional value. The key risk is that a marker feels too
subtle or like a bookmark with extra steps. Evaluate that before adding more objects.

Player promise: **“I can mark a piece of writing here, recognize the place later, and read it
again. I can move or remove my marker without changing the writing or its tree.”**

## Intended interaction

1. Enter the forest and recognize a real tree through its current writing title/date/language.
2. Discover “Mark this writing” in tree inspection. Preview a marker near that tree using the
   existing keyboard, pointer, and touch placement controls; explain the writing connection there.
3. Save with an honest provisional/saving/confirmed state. Cancel has no durable effect.
4. Inspect the marker to see the current authorized writing and “Read writing,” plus move/remove.
   Placement chooses the remembered location; movement never silently changes the linked tree.
5. Open the canonical post with an explicit localized “Return to forest” path. Treat any return
   target as a validated internal locator, never authorization or an arbitrary redirect. No new
   persisted camera/player state; same-tab return may use transient focus context. On a fresh
   visit, semantic access must help locate the marked writing without requiring remembered walking.
6. Return in another authenticated session and find the same committed marker and relationship.
   Remove reverses the personal choice; it does not consume, edit, hide, or relocate writing.

Keep the ordinary unlinked marker and direct writing access functional. No material cost, gathering,
new appearance catalog, text entry, tree relocation, public access, or private-source-writing claim.
New/empty owners receive a useful explanation and a route into existing writing creation or
eligible-writing management, without suggesting that unsupported legacy writing already has trees.

## Durable design to settle in the first implementation increment

Use the existing authored-object family and stable writing-tree identity, not a second world root
or a snapshot. Proposed relationship: an immutable reference to one owner-scoped `writingTreeId`
captured when creating the linked marker. No copied title, body, Block list, or canonical URL.
Relinking is deferred; remove and create another marker if the owner wants a different association.

This is an explicit extension of closed Milestone 3 contracts. Before schema edits, specify:

- Exact linked/unlinked record shapes, supported schema/protocol/read-envelope versions, and how
  existing version-1 markers remain readable. Do not reinterpret old creation fingerprints.
- Creation fingerprint coverage of the relationship, equal retries, differing-intent conflicts,
  stale mutations, and retry recovery after source eligibility changes. An equal retry recovers
  the committed object even when writing has since become unavailable; it grants no writing access.
- Server validation of owner, active world, visible eligible tree and bounded nearby placement at
  creation, using existing signed 720-unit cells and placement policies. Capture no new client-
  asserted owner authority. Moving a marker retains its association; it does not imply “nearest.”
- Dynamic linked-writing resolution through the existing inspection policy. Prefer a bounded
  marker-inspection service rather than duplicating writing metadata in regional render payloads.
- A paginated semantic way to find marked writing and focus its place on a new visit, reusing the
  existing writing surface where practical. Bound queries; decide and test any relationship index
  from the actual read shape. Do not scan the whole overlay or add a new record family by default.
- Reset, retention, diagnostic export, migration-readiness, and account-deletion behavior for the
  extended shape. Keep writing references out of ordinary diagnostics/logs. Existing owner-keyed
  cleanup must drain linked markers and tombstones. Retain the deletion fence for all writes.

Prefer explicit compatible reading of existing markers if safe. If changing existing durable
records is actually necessary, design and fixture-test the real resumable transform and rollout;
do not invent a migration merely because a new feature is being added. New writers/readers must
fail closed on unsupported versions, including stale clients during rollout.

Proposed source lifecycle behavior:

| Source change | Marker and writing behavior |
| --- | --- |
| Ordinary edit or title change | Keep tree/marker identity and captured projection; resolve current authorized metadata and canonical route |
| Tree hidden | Keep marker; suppress linked metadata/open action with generic unavailable copy; hidden-writing management remains the restoration route |
| Hidden tree restored | Same relationship works again after current authorization succeeds |
| Writing removed, ineligible, or no longer authorized | Keep removable/movable marker without stale writing details; no fallback to unrelated writing or foreign-only variants |
| Eligible writing returns under the same tree identity | Relationship works again; a different tree identity does not silently inherit it |
| Account deleted | Access revoked immediately; bounded cleanup removes authored records including tombstones irrespective of ordinary retention |

## Implementation increments

1. **Refresh and pin the baseline.** Recheck status and ancestry; safely fast-forward to local
   `master` if still valid, preserving user documents. Check remote freshness when access permits,
   report limitations, and avoid force operations or production access. Repeat direct Jasmine and
   lint after branch changes. Update misleading current-status prose in the owner scene contract
   and vision, linking later completion evidence without rewriting historical evaluations.
2. **Deliver the complete linked-marker slice.** Record the above durable decisions in affected
   contracts, then implement schema/service/API/read integration and the visible inspection,
   placement, read/return, and semantic finding paths together. Reuse existing reconciliation and
   mutation behavior. End with a runnable walkthrough, not another contract-only milestone.
3. **Verify and review the experience.** Run focused service/API/browser-policy tests, full Jasmine
   and lint, affected isolated database fixtures, then authenticated desktop and physical-mobile
   walkthroughs. Record exact commit/devices/browsers and distinguish automation, direct observation,
   human report, inference, and unavailable evidence. Fix discoverability before expanding scope.
4. **Pilot the writing/place loop.** Once usable, recruit roughly ten people who already write or
   journal, including people beyond close friends. Observe recognition, deliberate choice, correct
   reopening, and voluntary return. Then decide whether to deepen this interaction or revise it.

## Acceptance and evidence

- Without developer explanation, a participant understands the tree/writing connection, discovers
  marking, places a useful marker, opens the correct current writing, returns, moves/removes the
  marker, and recognizes the committed result in another session/device.
- Keyboard, pointer, touch, focus restoration, reduced motion, localized status, narrow layouts,
  and semantic finding/access work. Writing remains usable when customization is ignored or fails.
- Equal/concurrent creates, lost responses, stale revisions, removal retries, and create retries
  after removal neither duplicate nor resurrect objects. Relationship differences conflict.
- Test hidden/restored/removed/ineligible/current-language writing, ownership changes, missing or
  foreign ids, revoked sessions, no-store responses, deletion races and complete bounded cleanup.
- Test negative cells, boundary-crossing movement, collision/density rejection, changed regional
  continuations, unsupported versions, and unchanged ordinary version-1 marker behavior.
- Use guarded isolated development fixtures for affected transaction/index/cleanup evidence.
  Automated DOM/browser-policy coverage alone does not establish physical-mobile usability. If
  authenticated access or a device is unavailable, provide exact remaining walkthrough steps and
  leave that acceptance gate open.

Pilot measurement should first reuse existing infrastructure if suitable; otherwise use consented
session observations and a short follow-up rather than introduce an analytics platform. Record
aggregate funnel counts, separate repeat reading, writing, and forest visits, and do not collect
writing content or linked post identifiers. Observe an unprompted return period before sending a
follow-up, and distinguish prompted visits from voluntary ones. A provisional learning target is
that most participants understand the connection unaided and several return voluntarily within a
week; report exact denominators and reasons rather than claim a retention benchmark. Enjoyment,
repeat use, and willingness to pay are separate findings; this pilot proves none in advance.

## Milestone boundary and progress

Material-free first delivery is the accepted sequencing adjustment. It does **not** complete Part III
Milestone 4. The original material loop, commitments, full refunds, broader integration, and owner-
loop evidence remain outstanding. After reviewing this slice, the next candidate is one material
and one expressive use. Before spending exists, specify atomic commitment, exact retry semantics,
conflicts, removal, refunds exactly once, and interrupted-operation recovery. Do not create a
general economy. Milestone 5 hardening and Milestone 6 enduring-use evaluation remain later gates,
with accessibility, authorization, and bounded performance accompanying every increment.

### Increment 1 — baseline refresh and explicit writing return

Implemented November 1, 2026 on `production-owner-loop`, based on `40f8041`:

- Safely fast-forwarded the branch by nine commits. A read-only remote check confirmed remote
  `master` is also `40f80417f54c68ea3ff874e50e384b27f4e803b2`. All three existing untracked reboot
  documents were preserved. No deployment or production-data operation was performed.
- Updated misleading current-status prose in the owner scene contract and long-term vision;
  historical evaluations remain intact.
- Completed the first independently useful part of the selected slice: tree inspection and
  translation links, plus both semantic writing-list links, now carry a fixed forest context.
  Signed-in readers see a localized “Return to forest” before and after the post's writing.
  Ordinary post views remain unchanged. Context uses fixed internal navigation, private no-store
  delivery, and no new durable state. See the
  [accepted return contract and walkthrough](forest-writing-return-contract.md).
- Focused verification: 30 specs pass across the new read/return integration tests, existing
  semantic forest reads, and reading-trail navigation. Repository lint passes. The refreshed
  pre-change suite had 1,317 specs; three startup checks initially failed because sandbox policy
  denied spawning Node, then all three passed outside that restriction. Full post-change regression:
  **1,328 specs, zero failures**, run with subprocess execution allowed. Browser-module syntax and
  diff whitespace checks also pass.
- Evidence is automated Express/full-template/DOM integration with fixture identities and writing.
  Authenticated desktop, actual pointer/touch/keyboard browser review, and physical-mobile checks
  remain open; the linked contract gives exact steps. No database fixture was needed because no
  persistence boundary changed. At this checkpoint, return used the normal forest spawn; increment 2
  below adds a request-scoped source-tree destination.

### Increment 2 — return near the source writing tree

Implemented November 1, 2026 as the first commit boundary, together with increment 1:

- Forest-generated post and translation links carry the source tree's opaque UUID; the post return
  action carries it back to the authenticated forest. The semantic writing list uses the same path.
- Reuse current inspection authorization, owner/world/revision-scoped placement, and at most four
  regional pages of 250 validated tree placements to select a clear nearby arrival. Unknown,
  hidden, removed, foreign, ineligible, crowded, over-budget, or failed destinations use the entrance.
- Bootstrap version 2 has an optional return destination without changing the ordinary spawn or
  persisting avatar/camera state. Browser load rechecks arrival, focuses/highlights the source tree,
  and preserves the entrance control. No marker schema, relationship, or mutation is introduced.
- An isolated actual Firefox walkthrough passed keyboard inspection → post → tree return → entrance
  reset at 1280px and 390px, plus disappeared-tree and failed-region fallbacks. The fixture uses
  in-memory account/writing/region responses and makes no database connection. The
  [return contract](forest-writing-return-contract.md) includes the reproduction command and human
  walkthrough. Live-account, physical-mobile, and human attachment evidence remain open.
- Full regression: **1,348 Jasmine specs, zero failures**. Repository lint, fixture-script lint,
  browser-module syntax checks, and diff whitespace checks pass.
- Testing note from user review: a newly posted dev-account writing appeared after background jobs
  were enabled. Creation/status mutations queue work; the drain runs each minute and established-
  world sweeps run on five-minute ticks. Do not disable background jobs when trying to populate a
  dev forest. Older legacy posts without stable ownership remain ineligible.

Next smallest step: settle the linked/unlinked version and fingerprint shapes, then carry the
immutable writing-tree association through creation, dynamic marker inspection, and the visible
“Mark this writing” interaction with the existing save/recovery controls. The durable marker,
semantic finding/focus path, cross-session relationship review, external pilot, material loop, and
commercial evidence remain open. This increment does not complete the writing-linked marker slice
or Milestone 4.

### November 2 follow-up — arrival focus and calmer tree inspection

- The user reported that the live-account read/return loop placed their avatar beside the correct
  tree. Browser/device details were not supplied; this is focused human-reported continuity
  evidence, not physical-mobile certification or external attachment evidence.
- The viewport now receives keyboard focus once on entry, including return through writing.
  Async regional completion does not steal focus from a control selected during loading.
- Tree inspection now fits its content on desktop, separates date/language from botanical detail,
  gives reading the primary action, and moves tree management below a divider. The current post
  no longer appears as its own translation; bounded continuation still exposes later translations.
  The narrow bottom sheet keeps its internal scroll and pinned close control.
- Firefox fixture review covers automatic entry/return focus at 1280px and 390px, keyboard
  inspection, translation filtering across pagination, close-focus restoration, and keeping focus
  on another control through a delayed load. Fixture screenshots were inspected for the panel's
  visual hierarchy. Physical-device and live-account review of these follow-up changes remain open.
- Verification: **1,348 specs, zero failures**; repository and browser-fixture lint, module syntax,
  and whitespace checks pass.

### Writing-link design checkpoint

The [concrete record/protocol design](writing-linked-marker-design.md) proposes preserving all
ordinary markers as schema 1 and creating schema-2 markers only for an immutable, versioned
writing-tree link. It fixes both fingerprint encodings, mixed-client/read behavior, source
validation and retry ordering, marked-writing finding/return, mixed reset/retention/diagnostic
handling, and a compatible-reader-first rollout. No existing-record migration or new collection
is required. Runtime/schema implementation and its evidence remain outstanding; no new automated
test result is claimed for this documentation-only checkpoint.

The user subsequently reported the complete return/focus/inspection loop working well after
review and committed `edc985d`. This closes the reported functional review for those changes;
device/browser details and physical-mobile certification remain unrecorded.

### Increment 3 — marker format and transaction core

The user approved the concrete writing-link design. The first internal code increment now contains
strict schema-2 relationship validation alongside unchanged schema-1 defaults, fixed old/new
fingerprint encodings, transaction/session-bound source eligibility and 160-unit placement checks,
and protocol-2 service creation/movement/removal with idempotency, revision and tombstone behavior.
Equal retries recover committed results before checking new-creation availability or source access.
Collision and tombstone-retention code supports both record shapes; client reconciliation checks
relationship intent as well as coordinates. The
[design checkpoint](writing-linked-marker-design.md) records exact implementation boundaries.

Public API creation and regional negotiation, bootstrap and UI remain on version 1. The internal
linked-create dependency defaults to false and is enabled only in unit harnesses. Remaining work
before enabling anything is mixed-version regional/diagnostic/reset compatibility, the marked
writing read/return UI, isolated database evidence, and end-to-end browser/device review. This is
an implementation foundation, not the completed linked-marker slice or Milestone 4. Existing
markers need no migration; no real database operations or new indexes were introduced.

Verification: **1,374 Jasmine specs, zero failures** (26 added), repository lint, browser-module
syntax and whitespace checks pass. Fixed digest vectors verify the legacy byte encoding and new
relationship encoding. Tests cover strict schemas and preserved legacy data, transaction-bound
source validation, disabled-create recovery, differing-link conflicts, movement/removal continuity,
mixed collisions and retention, and relationship-aware client reconciliation. Database transaction/
index fixtures and complete browser/device evidence remain required before feature enablement.

### Increment 4 — mixed regional reads, diagnostics and reset compatibility

Regional and diagnostic endpoints now accept explicit scalar `version=2` reads. Omission preserves
version-1 response and cursor encodings. Before returning any legacy regional page, a bounded
owner/forest/cell-scoped existence query detects active linked markers and returns HTTP 409
`FOREST_AUTHORED_UPGRADE_REQUIRED`; version 2 returns both formats with their stored schema and
relationship. Version-2 continuations bind owner/world, requested version, supported object/link
formats and the existing region/revision vector. Diagnostic exports validate mixed rows and report
stored schema/fingerprint versions while omitting relationships and writing identities/metadata;
legacy exports require an upgrade when encountering linked records, including filtered tombstones.

New internal reset requests explicitly create schema-2/operation-2 records with immutable `[1, 2]`
scope, independently of linked creation. Shared validation preserves old operation-1 scalar scope,
rejects ambiguous/unknown scopes, and recognizes either processing format in regional readers.
Mixed bounded reset batches retain relationships and fingerprints, advance regional revisions and
compare against each stored schema. Retention dispatches completed-reset deletion by stored format.
The compatible-reader-first rollout still requires pausing new resets during deployment and
finishing old processing resets before enabling linked creation.

Verification: **1,390 Jasmine specs, zero failures** (16 added in this increment), repository lint
and whitespace checks pass. The full suite required execution outside the sandbox because three
existing startup tests spawn local Node subprocesses; that rerun passed. Fixed legacy regional and
diagnostic cursor fixtures also pass. No database operations, index changes, UI enablement or commit
were performed. The public mutation parser/bootstrap/client remain version 1 with new linked
creation disabled. Inspection/list/return UI, isolated database fixtures, browser and device review
remain before completing the marker slice.

### Increment 5 — linked-marker inspection, finding and return UI

Private marker inspection now reuses complete durable-record/world validation and current tree
inspection authorization, with exact unlinked/ready/unavailable-source variants. Unsupported data
and infrastructure failures do not masquerade as source deletion. The new marked-writing view
(`/forest/writing?view=marked`) lists active schema-2 markers with UUID ordering, bounded raw pages,
owner/world/filter/format-bound cursors and deduplicated source reads. Unavailable sources retain
rows with Visit place and confirmed revision-protected removal. Available rows also offer Read post.
Removal restores keyboard focus to another row or forest entry. The approved partial list index is
declared but not yet verified against an isolated database.

Marker-origin post/translation return context now uses `returnMarker`. The owner bootstrap resolves
current marker placement without requiring the source to remain readable, completes bounded tree
collision reads, rechecks marker revision and chooses a nearby clear spawn. Conflicting locators and
unavailable/foreign/removed/unsupported or concurrently moved markers fall back to the entrance.
Bootstrap 3 negotiates regional version 2 and linked movement/removal protocol 2 while preserving
ordinary mutation protocol 1. The canvas retains validated relationship intent, prioritizes and
highlights a returned marker and asynchronously displays current writing in its inspection panel.

Verification: **1,408 Jasmine specs, zero failures** (18 added in this increment), repository lint,
browser-module syntax and whitespace checks pass. The expanded database-free Firefox fixture
passes tree and linked-marker inspection→post→return at 1280px and 390px, keyboard entry/close
focus, unavailable-writing management, translation pagination, delayed-focus and tree-load fallbacks.
Rendered-page tests cover marked rows, unavailable sources, localized links, language redirects,
pagination and revision-protected removal/focus. Narrow-viewport desktop Firefox is not physical
mobile/touch certification.

No real database operations or commit were performed. Linked creation remains disabled; the
runtime environment gate and tree-selection/create control are the next implementation step.
Isolated database transaction/index/lifecycle fixtures and the complete creation walkthrough remain
required before enabling the feature or preparing the final linked-marker commit.


### Increment 6 — selected-writing creation and full-loop verification (November 4)

The shared `FOREST_WRITING_LINKS_ENABLED` gate defaults off; only the literal value `true` enables
new linked creation and its tree-inspection action. Bootstrap and the mutation service use the same
reader. Protocol-2 creation accepts an exact version-1 writing link, preserves the session-derived
owner and rejects copied metadata or links on protocol 1. Disabled creation, unavailable writing
and excessive source distance have explicit bounded error responses. Equal committed retries still
recover before checking the gate or current source.

With creation enabled, inspect a tree and select **Mark this writing**. The existing placement
controls retain the chosen writing title and immutable tree identity, preview the initial 160-unit
range and retain the same request through a lost-response retry. Cancel clears the writing context;
ordinary placement remains protocol 1. Moving a linked marker keeps its original link and does not
apply the initial range limit. A retry that observes a tombstone now settles on removal instead of
leaving a predicted marker in the scene; conflicting removed snapshots are likewise never redrawn.

Verification: **1,411 Jasmine specs, zero failures** (three added in this increment), repository lint,
explicit lint of the browser modules and both fixture scripts, module syntax and whitespace checks
pass. Firefox passes selected-writing creation→inspection→post→marker-return at 1280px and 390px,
including a committed write with lost response followed by a gate-off retry, concurrent removal,
initial-range rejection, and ordinary creation while linked creation is off. Earlier inspection,
translation, focus and tree-return fallback scenarios still pass. This is headless desktop Firefox
at two viewport sizes, not physical-mobile certification.

The new guarded command
`npm run forest:writing-linked-marker-fixture -- run --write`
passed against `daily-page-test`, twice (the second run adds rollback/collision/unknown-format
checks). It refuses production configuration, scopes fixture records to reserved owner
`64b00000000000000000a061`, and cleans those records after each run. Evidence covers:

- linked insertion and owner-fence rollback on a regional-write failure;
- concurrent equal creation, differing-link conflict, unchanged legacy bytes and mixed collisions;
- gate-off/source-loss/moved/removed retries and marker-place access without a readable source;
- inclusive range, unavailable-source list rows, the actual named partial-index scan, mixed regional
  pagination/invalidation, and diagnostic privacy;
- mixed reset with the creation gate off, legacy reset scope and mixed tombstone/reset retention;
- preservation of unknown formats during retention and bounded account-deletion cleanup of all
  owned formats.

The test-database index was created/verified; fixture owner records were removed. No production
database operation, environment-file edit or commit was performed. No migration or backfill is
needed. The planned linked-marker implementation is now ready for the user's local walkthrough.

For that walkthrough, restart the normal development server with
`FOREST_WRITING_LINKS_ENABLED=true` (for example,
`FOREST_WRITING_LINKS_ENABLED=true npm run local`). Inspect a writing tree, choose **Mark this
writing**, place and save it, then inspect the marker and read/return from the post. Also visit
`/forest/writing?view=marked`, move a marker away from its tree, and verify that unavailable writing
leaves the marker manageable. Existing ordinary markers should remain ordinary. Review on a
physical mobile device remains open. Keep the feature uncommitted until that review; deployment
still follows the compatible-reader-first rollout and old-reset completion requirements in the
[approved design](writing-linked-marker-design.md).


### Local walkthrough correction — marked-list timestamps (November 4)

The first user marker walkthrough found that **Marked writing** returned an unavailable page with
`ForestAuthoredMutationError`. The list reused a validator that incorrectly required insertion
`createdAt` to precede mutation `changedAt`; the normal writer captures mutation time first and
Mongoose timestamps insertion later. Diagnostics had the same ordering assumption. Synthetic
regressions and the guarded real-clock database fixture reproduced the failure before the fix.

Both readers now accept these independently valid timestamps, preserving removal-lifecycle,
authorization, schema, revision and export bounds. The writer and all existing marker records are
unchanged. The database fixture now uses real time for creation and only advances time for retention,
so ordinary creation/concurrent retry and marked-list reads exercise actual insertion timing.
The corrected guarded fixture passes and its reserved records were cleaned. No production records
were read or changed. The user should restart the dev server and retry the existing page; no marker
recreation or migration is needed. User acceptance remains open.

Timestamp-fix verification: **1,413 Jasmine specs, zero failures**, repository lint, fixture lint
and whitespace checks pass. The real-clock guarded database fixture also passes.


### Local walkthrough correction — marker inspection middleware (November 4)

The next reported issue was a writing-unavailable message for every placed linked marker. Normal
inspection GETs were intercepted by the authored-prefix Origin/JSON guard, which had been written
for mutations. The request failed before source inspection, so the post body was unrelated. The
old browser fixture mounted handlers directly and did not exercise that prefix middleware.

GET/HEAD now pass through to the existing authenticated private inspection path. Write methods
retain same-origin JSON enforcement before authentication/mutation work. Three mounted-prefix
regressions reproduce the former 403 and check successful authenticated reads, anonymous 401,
private cache headers and continued rejection of untrusted/non-JSON writes. The browser fixture
now includes the real prefix guard for both reads and writes, plus an infrastructure-error scenario
that verifies marker-specific retry copy instead of claiming the tree source is unavailable.
Existing marker/post data and writing eligibility rules are unchanged. The user should restart the
dev server and retry marker inspection; no data repair is needed. User acceptance remains open.

Inspection-routing verification: **1,416 Jasmine specs, zero failures**, repository/fixture/browser
module lint and whitespace checks pass. Firefox passes the full creation/read/return fixture at
1280px and 390px with the production guard mounted, including the marker-loading error message.


### Local walkthrough polish — one marker family and consistent controls (November 5)

The user found technical marker copy ("private account state"), confusingly similar place/writing
panels and inconsistent bottom controls. The UI now presents one forest-marker family with two
uses: remembering a place or returning to writing. Plain markers retain the familiar sign; writing
markers add a small book detail, including in placement previews. No durable record, relationship,
source policy or existing-marker behavior changed.

Both panels share **Forest marker** identity and the same Move/Remove actions. A plain marker
explains the remembered place and omits the unrelated marked-writing link. A writing marker leads
with its authorized post title and the same primary Read post treatment used by tree inspection;
management and Browse marked writing sit below a divider. Loading/unavailable writing retain the
clear writing-specific heading. Player copy removes technical/prototype wording from the marker
description, confirmation and related placement messages.

The nearby label and matching View/Place buttons now share one bottom action bar, with 44px targets
and a compact two-button layout on narrow screens. Inspection and placement hide that bar, avoiding
redundant background creation actions. Close restores game focus and the relevant nearby controls.

Verification: **35 focused scene/bootstrap/wiring specs pass**; explicit browser-module/fixture lint,
syntax and whitespace checks pass. The full database-free Firefox walkthrough passes at 1280px and
390px, including both marker panels, equal-sized touch targets, toolbar containment/hiding, close
focus and the established creation/read/return/retry scenarios. Screenshots of the writing and
place panels and narrow toolbar were visually reviewed. No new database operation or commit was
performed. Physical-device review and the user's visual acceptance remain open.


### Local acceptance and commit review (November 5)

The user reported that everything passed their tests after the marker UI polish and supplied fresh
screenshots of nearby writing-marker controls, the plain place-marker panel, the linked-writing
panel with Read post, and the restored nearby action bar. Visual review confirms consistent panel
hierarchy, matching bottom controls, recognizable plain/book sign details and hidden background
actions while inspecting. This records the user's successful local functional and visual acceptance;
no new UI changes were needed during the final review. Browser/device specifics beyond the supplied
desktop screenshots were not reported, so this does not add physical-mobile certification.

The coherent linked-marker feature is ready for a commit alongside its schemas/services, protocol
compatibility, inspection/list/return UI, regression fixes, fixtures and documentation. The user will
make the commit; no commit, deployment, gate enablement or new database operation was performed in
this review. The feature remains off by default and the documented compatible-reader-first rollout
still applies when deploying/enabling it.

Final commit-review verification: **1,416 Jasmine specs, zero failures**, repository lint, explicit
browser-module/fixture lint and whitespace checks pass. No blocking issue was found in the final
review. The changes remain uncommitted for the user.
