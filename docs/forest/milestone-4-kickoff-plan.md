# Milestone 4 kickoff: a place to revisit writing

Prepared and accepted November 1, 2026. Status: implementation in progress; the first navigation
increment is implemented, with human acceptance still open. This responds to the request to plan from the
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
