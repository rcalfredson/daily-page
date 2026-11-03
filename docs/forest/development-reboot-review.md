# Activity Forest development reboot review

Reviewed November 1, 2026. This is a local repository review, not a live deployment audit or a new human playtest. The attached strategic reply was read as context; its external search and traffic claims were not independently verified here.

## Current checkout

- Branch: `production-owner-loop`, at `e7f2ee3` (September 27, 2026); initially clean.
- Local `master`: `40f8041`, nine commits ahead, with no commits unique to this branch. Those commits include mobile post-overflow repair, dependency updates, and centralized SEO policy. Remote freshness was not checked.
- Latest forest documentation checkpoint: `d025243` (August 23), closing Part III Milestone 3. The evaluation describes implementation evidence through `01b84fb` and an August 18 checkpoint; those dates serve different purposes.
- Fresh verification on this checkout: Node 24.15.0 through `/home/robert/.nvm/nvm.sh`; **1,240 Jasmine specs, zero failures**, and **`npm run lint` passed**. Jasmine was invoked directly to avoid the package's autofixing `pretest` hook. These results do not repeat real-database fixtures or physical-device review.

## Alignment with the plans

| Plan stage | Repository evidence | Meaning for the reboot |
| --- | --- | --- |
| Part II, First Clearing | `milestone-10-clearing-loop-evaluation.md`; development scene and browser-local overlay/discovery code | Trails, gathering, materials, benches, signs, lanterns, water, bridges, and transient life have prototype evidence. They are not all production features. |
| Part III, Milestone 1 | `production-owner-writing-lifecycle-contract.md` and pure policies | Ownership, eligible writing, identity, privacy, lifecycle, and state boundaries are established. |
| Part III, Milestone 2 | `milestone-2-owner-writing-grove-evaluation.md`; production routes and services | Authenticated real-writing grove, stable owner/group trees, regional assets, inspection, translations, hide/restore, reconciliation, and deletion integration exist. |
| Part III, Milestone 3 | `milestone-3-account-backed-authored-overlay-evaluation.md`; authored schemas, services, API, and client | Private material-free markers support placement, movement, removal, prediction, retry, conflicts, bounded reads, diagnostics, internal reset, retention, and migration readiness. Recorded desktop/iPhone review proved cross-device continuity. |
| Part III, Milestone 4 | Roadmap section “Complete the production owner loop” and Milestone 3 handoff | This is the next primary milestone. Connect one meaningful authored place to real writing, then deliberately integrate the smallest material loop. |
| Part III, Milestones 5–6 | Hardening and enduring-owner-loop evaluation | Accessibility and performance accompany implementation; broader hardening and external attachment evidence remain unfinished. |

The production surface is `/:lang/forest`, with a semantic alternative at `/:lang/forest/writing`. The richer prototype is `/__dev/views/activity-forest`. The production client currently integrates writing-tree inspection and persistent markers; the prototype's nearby-writing bench still resolves fixture metadata. Copying that implementation wholesale would carry inappropriate fixture and local-storage assumptions into production.

The four-layer architecture is coherent: generated base, writing-linked records, authored overlay, and transient presentation. It is substantial infrastructure for an unfinished product experience. Completion records support technical continuity; they do not establish customer demand, repeat use, or a commercially validated game.

## Important qualifications

- A private forest does **not** mean private source writing. The accepted writing model supports public and unlisted posts; the evaluations explicitly defer truly owner-only source writing. A “private journal garden” offer would require additional work.
- The authored protocol currently accepts only `personal-marker` / `quiet-waymarker` version 1, with no text or writing relationship. A bench, link, or named place requires deliberate contract and version decisions.
- Production materials, inventory, discovery persistence, commitments, refunds, trails, and construction remain deferred. Reset and retention services are not equivalent to a finished user-facing recovery experience or backup guarantee.
- Rate limiting is process-local. Pressure results are synthetic development observations, not final mobile budgets or production capacity promises. Migration readiness has no real predecessor-schema transform to prove yet.
- Historical wording needs care: the owner-scene contract still calls inclusion the only durable mutation and describes authored overlay as future work; the vision's delivery-status prose still points back to earlier First Clearing work. Later completion evidence and current code supersede these status statements, while accepted invariants remain relevant.

## Recommended reboot

Resume Part III Milestone 4 in visible increments. First prove that a person can recognize a real writing tree, make one reversible personal choice nearby, reopen that writing through the authored place, and return from another session to find it intact. Compare a nearby-writing bench with a small extension to the existing marker and one other restrained option; choose by user benefit and implementation cost.

Start that writing/place proof without material spending if it removes unnecessary delay. This is a proposed sequencing adjustment, **not completion of the original Milestone 4**, whose gathered-material and commitment/refund requirements remain explicit follow-on work unless deliberately revised. Avoid making inventory infrastructure the first visible result of the reboot.

Then add one bounded material and one expressive use if the interaction benefits from it, with exact retry, concurrency, removal, and refund behavior. Test with a small external cohort once the slice is usable. Observe whether people recognize their writing, understand the choice, reopen a post, and voluntarily return. Keep technical acceptance separate from attachment evidence.

This preserves the sandbox ambition while giving development a concrete reason to matter to someone before construction catalogs, markets, multiplayer, or membership expand the scope. The later content-stream following project remains separate.

The companion [starter prompt](activity-forest-reboot-starter-prompt.md) is self-contained for a new development thread.
