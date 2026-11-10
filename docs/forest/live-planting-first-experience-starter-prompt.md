# Live forest: first planting experience — starter prompt

Prepared November 8, 2026. Use this as the opening brief for a new implementation thread.

## What I want to achieve

Build the first live planting experience in Daily Page's Activity Forest. We have chosen this
direction after reviewing gathering, the Satchel, clearing objects, and transient life in the
development fixture. The immediate question is whether this addition makes the forest more
interesting to inhabit and gives someone a satisfying activity without needing other players.

The intended loop is:

> Explore → find a seed or cutting → choose its home → plant it → return to visible growth →
> collect something renewable → use that yield to extend or personalize the planting.

This is an end-to-end live experience, not just a new fixture, inventory counter, or planting
animation. Reuse the fixture where useful, and improve the design where the larger live world
calls for a different approach. I am open to a novel or more entertaining variation of the idea.

We do not need another broad brainstorming exercise before starting. Briefly compare plausible
first plants and recommend one coherent experience, then work toward something I can play.

## Decisions already made

- Start with one deliberately designed plant and its complete acquisition, planting, growth,
  harvest, and reuse loop. A small flowering plant or shrub is a reasonable candidate, not a
  mandated species. A broad crop catalog is unnecessary.
- The first renewable reward must have an actual use in this slice. A cutting that can be planted
  to extend a personally arranged garden is sufficient; a balance that only promises future
  crafting is not. Show why a second planting can be an expressive choice rather than merely a
  higher count.
- Growth should offer anticipation without obligation. Plants do not die, wither, lose value,
  or demand daily watering because someone stayed away. Harvesting does not destroy the parent.
- Someone should find a first opportunity within a reasonable walk from the entrance. Do not
  make the first loop depend on locating the potentially distant lake or receiving a rare drop.
  Later discoveries may give water and other habitats distinctive practical value.
- Allow choosing the plant's location, with a legible preview and useful placement feedback.
  Explain how to relocate or remove it without creating an accidental loss trap.
- Writing trees remain stable records of writing, separate from planted vegetation. They are not
  timber, cannot be harvested, and do not need to be consumed or modified to participate.
- The activity is optional. Existing writing, reading, navigation, and marker interactions remain
  useful without gardening. Every gardening action need not open a post.
- Single-owner play comes first. An NPC trader, currency, shops, other-user markets, and a broad
  crafting system are possible successors, not prerequisites for this experience.

## Current repository and live state

At handoff, the working tree was clean on `master`, at `18530aa`:
`feat(forest): add single-account production terrain activation`.
Its predecessor `68cb9fc` integrates regional river/lake terrain. Verify branch, status, local
instructions, and actual implementation before editing; these notes are a checkpoint, not a
Git guarantee. Use Node through Robert's nvm, for example:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
```

The owner reported successful generation-4 activation for `bookworm308` in development and
`roberto.c.alfredo` in production. The terrain has a convincing large lake and a welcome sense of
exploration. Not finding water immediately is not itself a bug or a reason to reveal the whole
map. No further production access or mutation is authorized by this brief.

The live forest has real writing trees, inspection/read/return paths, durable personal markers
including writing links, and explicit terrain activation. Unactivated worlds retain their old
surface, and generation-3 worlds retain their geometry. Terrain generation 4 supplies regional
river/lake systems and animated lake surfaces. Do not assume every account has been migrated.

The fixture's gathering, Satchel, trails, benches, signs, lanterns, birds, and traveler are not all
account-backed live features. In particular, fixture seed pods are currently a crafting material,
not a functioning plant-growth system. Its nine-find offering and explicit renewal after complete
collection need not become the rules for the live experience.

The previous helper checkpoint passed 1,483 Jasmine specs and lint; the 19 focused activation specs
were rechecked before its commit. This is historical evidence, not validation of new planting work.

## Read and trace these sources

Start with:

1. `docs/forest/activity-forest-long-term-gameplay-vision.md` — the larger game, planting, creative
   ownership, economy, and provisional membership principles.
2. `docs/forest/milestone-10-clearing-loop-evaluation.md` — what the fixture actually demonstrated.
3. `docs/forest/live-river-lake-slice.md` — current terrain, access, versioning, and rollout limits.
4. `docs/forest/owner-production-scene-contract.md` and
   `docs/forest/milestone-4-kickoff-plan.md` — real writing, navigation, and current authored work.
5. `docs/forest/account-backed-authored-overlay-contract.md` and the linked mutation, region,
   lifecycle, reset, and retention contracts as affected by the selected design.

Read current constants and code before treating historical document exclusions as present-day
instructions. This brief authorizes the bounded planting extension; it does not authorize porting
every prototype system. The participant pilot remains deferred while we build a more compelling
game. Do not redirect the work toward recruitment or claim that added features validate a business.

Useful fixture entry points:

- `public/js/forest-discoveries.js` and `forest-discovery-persistence.js`
- `public/js/forest-clearing-objects.js` and `forest-world-overlay.js`
- `public/js/forest-nearby-writing.js` and `activity-forest.js`

Useful live entry points:

- `public/js/owner-forest.js`, `owner-forest-scene.js`, and `owner-forest-authored-sync.js`
- `server/services/forestAuthoredObjectMutation.js`, `forestAuthoredPlacement.js`,
  `forestAuthoredObjectFormat.js`, and `forestAuthoredRegionManifest.js`
- `server/services/forestLedgerFence.js` and the owner-scoped deletion/reset/retention paths
- `server/services/forestOwnerTerrain.js`, `forestOwnerTerrainActivation.js`, and
  `public/js/owner-forest-terrain-authority.js`

The fixture uses browser-local persistence, finite unsigned coordinates, a small corridor, and
client-side material commitments. These are references for interaction, not production authority.
The live authored schema currently supports personal markers; it is not already a generic plant
container. Inspect tree allocation and terrain protections as well as authored placement.

## Shape the experience before expanding the machinery

Propose a compact first-loop design covering:

- **What I find:** the plant's identity, how it looks, how a collectible is recognized and reached,
  and how a new/empty forest gets a first opportunity. Prefer a recognizable find over an arbitrary
  floating token or a resource checklist.
- **What I choose:** where to plant, how much arrangement is possible, and what makes the result
  feel authored. Ground planting versus a planter is open; do not introduce a workshop or crafting
  prerequisite solely to support planting.
- **What changes:** a few clearly distinct growth appearances at normal camera/avatar scale.
  Choose and explain production growth timing. Include a development-only way to review stages
  quickly without changing the production rules or waiting hours for every check.
- **What I receive:** the renewable yield, its reuse, and a simple repeat-harvest policy. Explain
  what happens during a long absence; avoid unlimited unattended accumulation and arbitrary expiry.
- **How I return:** make it practical to find a saved planting again in the larger world without
  disclosing the entire map or introducing a full fast-travel network.
- **How I change my mind:** moving/removing, capacity, full inventory, and interruption behavior.
  Choose modest explicit bounds without presenting them as permanent paid/free product limits.

Start with a normal-scale visual/interaction sketch if it helps settle the plant's character.
One attractive, distinctive plant with a satisfying loop is preferable to a catalog of generic
objects. Use the established pixel-art language, readable scale, and restrained animation.

## Durable behavior and compatibility

Write the minimum design note needed to make persistent choices reviewable, then implement the
complete slice. Resolve routine choices autonomously; ask only about material product choices or
durable compatibility decisions that need my input.

- Keep acquisition, holdings, planting, and harvesting owner-scoped and server-authoritative.
  Retries, lost responses, two tabs, and concurrent requests must not duplicate rewards, consume
  an item twice, or leave a deducted item without its planting. Choose the smallest useful holdings
  model rather than building a general economy framework.
- Use authoritative time for growth and harvest eligibility. Refreshing, changing the client clock,
  and being offline must not change the rules. Prefer deriving stages from durable timestamps if
  that suffices; do not introduce per-plant jobs without a demonstrated need.
- Growth must not unexpectedly block a route or engulf writing. Plan for the mature footprint
  when placing, including the plant's relation to water, rocks, bridges, trees, and markers. Decide
  whether the plant is walk-through or collidable and keep painting and authority consistent.
- Account for both directions of placement: future writing-tree allocation and marker placement
  must respect any space the plant reserves. Check activation/upgrade protection capture too;
  adding a plant must not make a future terrain operation silently omit it or reject an otherwise
  supported world as an unknown marker type.
- Preserve existing seeds, generation-3/4 geography, writing identities, coordinates, authored
  relationships, and retry semantics. Do not change authoritative terrain under an existing
  generation identity. State how this feature behaves for terrain-free and older-generation
  worlds without automatically activating or migrating them.
- Keep reads and rendering regional and bounded across signed coordinates. Do not materialize
  the whole world, serialize it to the client, or make stable discovery positions depend on the
  viewport. Define a bounded acquisition/renewal policy suitable for the larger world.
- Extend account deletion, diagnostics, reset, and retention intentionally for any new durable
  state. Do not promise that an existing marker-only reset includes plants unless it does.
- Preserve keyboard, pointer, touch, focus, semantic access, reduced motion, and narrow-screen
  usability. Saving, waiting, harvest-ready, and failed actions should be understandable without
  developer explanation.

## Larger direction and business purpose

The forest should become a place where someone can enjoy themselves alone, shape something
personal, and eventually trade resources, plants, plans, or creations. Animal Crossing and
Stardew Valley are useful references for possibility, not instructions to reproduce their systems.

This slice should establish a useful foundation for later planting variety, material uses,
NPC exchange, and player enterprise. Do not implement those all now. Keep the existing vision's
membership direction in view: more privacy, space, hosted continuity, and authorship, with a
complete enjoyable core experience. Do not add paid currency, pay-to-advance rules, or monetization
plumbing here. A successful gardening loop would be progress toward a product worth returning to,
not proof of demand or willingness to pay.

## Review and handoff

Deliver exact instructions for experiencing the loop in the live owner template with isolated
development data. A fixture or accelerated-time preview must be clearly labeled. Do not activate
or modify ordinary accounts or production data as a setup shortcut. Leave changes uncommitted
unless I explicitly request a commit.

Verify the important boundaries: acquisition and harvesting retries/concurrency, growth timing,
reload and cross-session persistence, placement/access at mature size, terrain compatibility,
writing/marker regressions, deletion, and honest failure recovery. Use guarded development database
fixtures where transactions and indexes need proof. Run appropriate tests and lint, and inspect
the actual visuals at desktop and narrow sizes; report physical-touch checks separately.

The walkthrough should let me answer:

1. Can I discover and understand the activity without being sent on an empty, unbounded walk?
2. Is choosing where and how to grow something an enjoyable act of shaping my forest?
3. Does growth feel alive and worth revisiting without becoming a chore?
4. Does collecting the yield let me do something satisfying immediately?
5. Can I leave, return, and change my mind while trusting that my work is preserved?

Use what I report from that experience to recommend the next increment: richer planting and
expression, a purpose for particular habitats, a traveler exchange, or another direction the play
actually suggests. Do not assume the next step must be a larger inventory or more currencies.
