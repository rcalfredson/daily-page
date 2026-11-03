# Activity Forest development reboot — starter prompt

Resume development of Daily Page's Activity Forest in this repository. I want it to become a valuable, calm writing experience and an expressive sandbox with a credible path toward supporting a business. The recent traffic downturn makes developing direct user value and reasons to return more urgent. Treat business viability as something to test through use, not something more game features or a search recovery will establish automatically.

This is an implementation thread. Reconstruct the current state, make a bounded plan, and proceed with the first useful vertical slice. Do not stop after another broad audit or roadmap. Preserve the longer-term game ambition while keeping the active milestone small enough to experience and judge.

## Starting point to verify

The November 1, 2026 review found:

- `production-owner-loop` at `e7f2ee3`, initially clean. Local `master` at `40f8041` was nine commits ahead, with zero unique branch commits. Review current divergence and remote configuration; bring this working branch up to date by a safe fast-forward if the relationship still permits it. Preserve unrelated work and report any real blocker. Do not discard changes, force-push, deploy, or operate on production data as part of this setup.
- Latest forest closeout: `d025243`, Part III Milestone 3. Milestones 1–3 are complete in their recorded scope. Do not rebuild persistence or repeat the earlier contract-only milestone.
- Production `/:lang/forest` has stable real-writing trees and durable private markers. `/:lang/forest/writing` supplies semantic writing access and hide/restore management.
- `/__dev/views/activity-forest` has the richer First Clearing prototype, including local trails, discoveries, materials, clearing objects, and nearby fixture writing. These are reference implementations, not account-backed production mechanics.
- Fresh baseline: Node 24.15.0 via Robert's nvm, 1,240 Jasmine specs with zero failures, and passing lint. Reverify after branch changes; historical counts are not acceptance targets.

Read `AGENTS.md` and use Node through `/home/robert/.nvm/nvm.sh` as appropriate. Inspect status before editing. `npm test` has an autofixing pretest; direct Jasmine is available for a non-mutating baseline.

## Read in this order

1. `docs/forest/development-reboot-review.md`.
2. `docs/forest/milestone-3-account-backed-authored-overlay-evaluation.md`, especially its handoff and limitations.
3. `docs/forest/milestone-2-owner-writing-grove-evaluation.md` and the judgment/evidence in `docs/forest/milestone-10-clearing-loop-evaluation.md`.
4. `tmp/activity-forest-roadmap-part-iii.txt`, especially Milestones 4–6 and the guardrails. Earlier roadmap files and starter prompts are historical context.
5. `docs/forest/activity-forest-long-term-gameplay-vision.md`, especially participation depths, state layers, and delivery horizons. Its earlier status prose is not current completion evidence.
6. The relevant owner-writing, scene, inspection, inclusion, non-canvas, authored-overlay, mutation, regional-read, and account-deletion contracts under `docs/forest/` and `docs/account-deletion-lifecycle-contract.md`. Read other contracts as needed for the selected slice.

Trace the promises into `server/routes/forest.js`, `server/routes/forestWriting.js`, `server/api/v1/forest.js`, the forest schemas and services, `public/js/owner-forest*.js`, `views/forest/`, and their specs. Compare prototype interactions in `public/js/activity-forest.js`, `forest-nearby-writing.js`, `forest-discoveries.js`, `forest-clearing-objects.js`, and overlay/persistence modules. Prefer current code plus later accepted evidence when historical status prose conflicts. Correct misleading status statements as part of the handoff without rewriting historical evidence.

## Active milestone and player promise

Continue **Part III, Milestone 4: Complete the production owner loop**.

The immediate product question is: **Does seeing their writing become a place make someone want to revisit it or write again?**

Deliver a coherent path:

write or select eligible real writing → encounter and recognize its stable tree → make one meaningful, reversible personal choice nearby → reopen the writing through that place → leave → return in another session or device and recognize the committed result.

The first increment should visibly strengthen that connection. Briefly compare a nearby-writing bench, a restrained writing-related extension to the existing marker, and one other small curation option. Recommend and implement one, explaining the player benefit, scope, and durable changes. A bench is a promising reference, not a predetermined answer. Do not implement several competing systems. A generic decorative object without a useful writing connection is insufficient.

Favor a material-free first writing/place slice if it gets this question in front of people sooner. Record that as a sequencing adjustment: the original Milestone 4 also requires a bounded material loop, commitments, and full refunds. Do not claim the whole milestone complete after the first slice. Follow with one material and one expressive use when justified; defer broader integration explicitly. Before spending exists, design atomic commitment, equal retries, conflicts, removal, refunds exactly once, and recovery. Do not build a generalized economy.

## Constraints that must survive

- Preserve generated base, writing-linked state, personal authored overlay, and transient presentation as separate layers. Extend existing records and protocols deliberately; avoid whole-world snapshots and competing world roots.
- Writing is never a consumable resource. Edits do not silently reproject, relocate, or replace a tree. Preserve captured habitat, projection, seed, phenotype, asset identity, and source link if a later overlay moves or relates it.
- Session identity is the authority. Reauthorize current writing on access. Keep private no-store delivery, non-enumerating errors, deletion fences, and complete bounded account cleanup.
- Private forest access does not make public/unlisted source writing private. Do not promise a private journal, public visiting, or a paid capability the source-writing model cannot support.
- The current authored kind and payload are closed. New kinds, relationships, versions, indexes, reset, retention, migration, diagnostics, and deletion effects need explicit decisions. Store references only when needed; do not duplicate current writing bodies or metadata into overlay records.
- Preserve idempotent creation, revision-protected mutation, lost-response recovery, visible conflicts, provisional previews, and honest save status. Production must not import or trust Forest Lab `localStorage`.
- Keep regional reads and placement work bounded across negative coordinates and cell boundaries. Reuse the established spatial conventions; avoid unbounded scans or animation-frame database work.
- Provide keyboard, pointer, touch, reduced-motion, focus, and semantic access appropriate to the new behavior. Writing remains accessible without gathering or customization. Use existing localization patterns and player-facing language.
- No decay, absence penalties, streak pressure, mandatory gathering, word-count rewards, optimal build order, or resource gate on writing/privacy. Keep the world satisfying for someone who only writes and walks.

## Work and evidence

First give a short baseline and gap assessment, choose the first slice, and document its promise, non-goals, affected contracts, and acceptance checks. Then implement it in coherent increments. Resolve routine choices autonomously; ask only when a material product decision cannot be inferred or safely kept reversible.

Acceptance must cover recognizing eligible writing, discovering the new interaction without developer explanation, making and reversing the choice, opening the correct current post, a coherent return path to the forest, and surviving a cross-session return. Define behavior when the writing is edited, hidden, removed, restored, or ceases to be authorized. Preserve the no-customization path and make empty/new-owner states useful.

Run checks proportionate to the change: relevant policy, service, API, authorization, persistence/recovery, and browser interaction tests, then repository lint and the appropriate regression suite. Cover retries, stale changes, region boundaries, unsupported versions, and account deletion where affected. Use guarded isolated development fixtures when real-database evidence is needed; avoid production reads or writes without explicit authorization. Do not manufacture migrations or inventory systems for a slice that does not need them.

Arrange a reproducible human walkthrough on desktop and physical mobile when available. Report what was tested automatically, observed directly, reported by a person, inferred, or still untested. If authenticated access or physical-device review is unavailable, finish all independent work and provide exact remaining steps without claiming the gate passed.

Once usable, prepare a small external pilot: roughly ten people who already write or journal, including people beyond my close friends. Measure whether they understand the tree/writing connection, make a meaningful choice, reopen writing, and return voluntarily. Suggest minimal privacy-conscious measurement using existing infrastructure where possible; do not collect writing content or build an analytics platform. Distinguish repeat reading, writing, and forest visits. Any retention thresholds are provisional experiment criteria, not business forecasts or industry benchmarks. A pilot plan is not evidence of actual returns.

Close each increment with what changed, how to try it, verification, remaining risks, and the next smallest step. Record accepted decisions in durable contracts and keep a compact Milestone 4 progress record. Keep technical correctness, usability, attachment, and commercial evidence separate. If people enjoy the visuals but do not return, investigate the writing loop before expanding the catalog.

## Deferred scope

Leave broad construction, buildings/interiors, terrain sculpting, markets, multiplayer, public visiting, portals, large cosmetic catalogs, new biome breadth, and membership/billing for later evidence gates. Preserve architectural room for them without implementing them now. Do not turn this thread into an SEO investigation, publication redesign, or content-stream subscription project; those are separate workstreams.

Begin by checking the actual branch and completed Milestone 3 foundation, then carry the selected first writing-and-place slice through implementation and verification.
