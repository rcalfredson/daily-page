# Activity Forest: home, companion, and first expedition

## Acceptance status and reading guide

Prepared and accepted November 10, 2026. **The owner reviewed the entire brief and accepted it
without substantive changes.** This establishes the design and scope baseline; open technical
questions below still require their planned evidence. Production access and rollout remain outside
this acceptance. This records the design conversation following the
[planting-purpose brief](planting-purpose-and-world-vision-starter-prompt.md).

The owner supports developing several connected features together: a customizable home exterior,
a configurable animal-drawn cart, an animal companion, a traveling neighbor with memory, and an
expedition that supplies something useful at home. The exact catalog, spatial solution, resource
rules, and persistence design below are accepted working proposals. Illustrative catalog details
remain adjustable, and the explicitly unresolved technical decisions are not claims of feasibility.

Read sections 1–5 for the player experience and scope, 6–10 for foundations and contingencies,
and 11–14 for delivery, evaluation, and open decisions. Review should especially address whether
the construction freedom preserves the intended creative pleasure, whether the proposed geography
feels connected to the writing forest, and whether the journey has a satisfying purpose.

## 1. Purpose and larger direction

The existing north star remains:

> A person's writing becomes a place, and that place becomes a medium they can inhabit, shape,
> and share.

This extension investigates a more specific promise:

> Make a home among your writing, form a few lasting connections, and venture out to discover
> things that change what you can make and how your place feels.

The larger aspiration combines a personal home clearing with a small inhabited settlement.
Virtual characters provide continuity; eventual paths between users' forests add human visiting
and collaboration. The single-player experience must have value before those connections exist.

The first slice establishes the home and the first social connection through a traveler. It does
not yet deliver a populated settlement. More residents, their homes and shared places remain an
explicit next horizon. House additions, interiors and editable partitions are also retained as
future ambitions, with interior circulation and visibility requiring their own design work.

The current planting loop provides reliable actions but relatively few destinations for them.
Adding isolated decorations or rewards is not assumed to produce a rich game. Here, growing,
making, giving, traveling and returning should supply purposes for one another. We will evaluate
the connected experience, not demand lasting enjoyment from every intermediate implementation.

## 2. Principles and boundaries already supported by the conversation

- **Personal intentions matter.** Players should be able to make noticeably different homes and
  carts and invent a second project after completing the first.
- **Response is observable.** A gift appears on the neighbor's cart; a companion recognizes the
  owner; an expedition material visibly changes a design. Dialogue alone does not carry every payoff.
- **Travel and construction must be enjoyable themselves.** A destination reward cannot compensate
  for unpleasant driving, and a large catalog cannot compensate for awkward editing.
- **Continuity is trustworthy.** Designs, materials and shared experiences survive a return visit.
  Missing data or an uncertain save must not masquerade as a fresh start.
- **Writing remains meaningful and independent.** Trees retain their identity and reading paths.
  No cutting down writing trees, word-count rewards, mandatory posting, or automatic use of private
  writing in character dialogue. Deliberately shared writing-linked places remain a future connection.
- **Participation is optional.** Writing, wandering and gardening remain worthwhile without a
  house project, cart or conversation. Empty-writing accounts can participate too.
- **Return is voluntary.** No hunger, animal upkeep, affection decay, daily streak, expiring project,
  missed encounter reward, or absence punishment. Plants retain their existing absence-friendly rules.
- **Expression is forgiving.** Preview and cancellation cost nothing. Ordinary redesign should not
  force repeated gathering. Technical bounds must be presented as understandable creative limits.
- **The interface stays calm.** Reuse contextual actions and the satchel rather than adding a
  persistent panel for every system. Keyboard, touch and reduced motion are first-version concerns.

## 3. A representative first visit and return

This is a playable path, not a mandatory quest chain. Players can postpone conversations, stop
between steps, garden instead, or begin with a different customization. No step requires a daily
window or a second real-world visit merely to advance a timer.

| Moment | Player choice and action | Immediate feedback and continuity |
| --- | --- | --- |
| Arrive home | Establish the proposed home area, then choose a bounded footprint, exterior material/color, roof material and chimney position | The actual house changes in preview and remains recognizable after saving |
| Meet the traveler | Approach a neighbor resting beside a distinctive cart; ask about it or continue exploring | The cart demonstrates possibilities; a conversation offers a useful special frame and a destination clue |
| Make a cart | Assemble a body, wheels, supports and optional canopy; choose proportions, finish and decorations | A visibly personal, functional vehicle emerges; the supplied frame is an option rather than the sole valid design |
| Gain a companion | Notice an animal, learn a small preference, respond and invite it along | The animal joins and recognizes the owner; this is an encounter, not repeated gifts to fill a meter |
| Set out | Enter the cart, steer along a readable route, stop at a landmark or continue | Movement is faster and pleasant; dismounting permits close exploration |
| Discover | Explore a distinct destination and gather a modest supply of a new material | Its appearance suggests at least two uses, such as a canopy treatment and a house roof treatment |
| Bring it home | Apply the material, rearrange a design, or prepare lanternbell decoration for oneself or the neighbor | The trip leaves a visible result; a given decoration remains on the neighbor's cart |
| Return later | Find the saved home and cart, greet the animal, meet the traveler again | Designs and a few remembered experiences persist; the player may start another project or simply enjoy the place |

A first-time player with no mature lanternbells must still be able to build and travel. Flower
decoration can become available as the existing garden matures. Gift-giving must not gate the cart,
the animal's continued companionship, or the expedition.

## 4. First-version scope and proposed content

Counts below bound the reviewable slice. They are content targets, not permanent account limits.
Working material names and exact catalog sizes can change after the visual study.

| Feature | First-version commitment | Initial catalog proposal |
| --- | --- | --- |
| Home | One customizable exterior with a rectangular footprint inside a reserved envelope | A few supported width/depth combinations; two initial wall treatments, three coordinated colors, two initial roof treatments, two chimney sockets; one expedition roof treatment |
| Cart | One usable cart assembled from compatible parts, with meaningful silhouette variation | Chassis/body dimensions within limits, two body styles, two wheel styles, optional canopy, special traveler frame, bounded decoration sockets; one expedition canopy treatment |
| Companion | One animal with a short introduction, recognition, resting and pulling behavior | A mule is the proposed first species; display name, art and personality remain reviewable |
| Neighbor | One traveling character with their own cart and persistent owner-specific encounters | Introduction/component offer, recognition of the player's cart, gift response, and return conversation |
| Journey | One readable route, one optional stopping place, one distinct destination | A rocky or reed-edged clearing with a visible material source; no universal river/lake requirement |
| Materials | A small, explicit inventory supporting making and remaking | Timber and cloth for basic work; one destination material such as amber reed; lanternbell blossoms if approved as a separate harvest |
| Lanternbell use | One crafted floral object usable by the owner or as a gift | A garland attached to compatible house/cart anchors; the traveler displays a received garland |
| Persistence | Account-backed home, cart, holdings, companion, discoveries and encounter facts | Exact schemas and transactions settled before durable implementation |

The traveler may reuse Tansy Rook's established character if the design fits. Her development
appearance and dialogue are references; production encounter memory and cart behavior are new work.

### Construction freedom

The owner explicitly wants the pleasure of assembling something, comparable to making a small
vehicle from Lego or clay. The first editor must therefore change form as well as surface color.
Provide compatible parts, bounded dimensions and understandable attachment points. Show the result
in the world while editing. A menu of finished cart skins would not satisfy this brief.

Use a stable chassis and compatible wheel/support rules so legal designs remain drivable. Decoration
should not accidentally change collision or speed. If size affects clearance, show that clearly in
preview and ensure every supported first-version cart can complete the first route.

For the house, preview footprint changes before saving and keep a clear doorway and approach.
Reject invalid enlargement without moving plants, markers or writing. Initially reserve enough
room for the supported sizes. House relocation, arbitrary extensions, multiple storeys, interiors
and partitions are deferred; the exterior should not imply an already accessible interior.

### Materials and lanternbells

Supply enough ordinary material to complete the first cart without a repeated gathering loop.
Basic home finishes are available immediately. Let the destination material serve at least two
visible purposes, with enough obtainable supply to try both. Sources must have a recoverable supply
policy so gifting or experimentation cannot permanently prevent completion.

Recommended accounting: construction commits material to an object; removing or replacing parts
returns their committed material. Cancelled previews never spend. Gift acceptance transfers the
crafted object out of holdings once, with a clear action and a durable visible result. No selling,
random drops, recipe tree, tool durability or weight-management system is needed in this slice.

Capacity rules must allow promised construction refunds without discarding material. Reserve refund
capacity or include committed holdings in the capacity model. Refuse a pickup or grant that cannot
fit before claiming its source; keep unique offers available until they are successfully received.
Record committed costs so a later recipe-price change cannot create material through rebuilding.

Blossoms are a **proposed addition**, separate from existing cuttings. Harvesting them should not
consume a writing tree, destroy a plant, remove its decorative bloom, or reset cutting growth or
harvest timers. Before implementation, decide blossom eligibility, yield, stored capacity, repeat
availability and move/pack/replant behavior together. These are open rules, not hidden additions to
the live planting contract. Do not silently repurpose existing cutting holdings as flower currency.

Prefer a generous, bounded supply with no unattended stockpile or timed gift pressure. The exact
rule must pass a small acquisition/spending walkthrough, including gifting and redesign, before
schema work. If blossom rules expand the scope excessively, propose an explicit alternative for
review rather than removing the lanternbell connection from the connected slice.

### Companionship and world response

The animal has a short, repeatable introduction and an explicit invitation. An interrupted encounter
can resume; a declined invitation remains available. It can rest near home, greet the player and
accompany travel. Simplified local behavior is sufficient; independent world-scale pathfinding,
animal breeding and care simulation are deferred.

The neighbor remembers a small set of true events: meeting, offering the frame, seeing the completed
cart, receiving a particular gift, and a shared expedition-related conversation. A gift on the
neighbor's cart must match saved state. Repeated greetings must not repeatedly grant parts.
Encounters remain available without real-time schedules, affection scores, or fabricated memories.

The first slice's required responses are the companion's behavior and the neighbor's visible gift
and recognition. Flower-attracted wildlife remains a promising later connection, not an extra
requirement that delays the whole slice.

## 5. Future settlement and connections between users

The traveler is the beginning of a social world, not a claim that one visitor constitutes a
settlement. A later increment can add a resident with contrasting interests, a workshop or home,
and a shared place that gives projects another destination.

Recommended first ownership model: every home, companion, cart and encounter belongs to its owner
and forest. A recurring traveler has a separate encounter history with each owner; there is no
global schedule or shared mutable character inventory. A decorative gift displayed in that
owner's encounter does not silently appear in every user's version of the traveler.

Future visitors could see the host's authored place and permitted character presentation, while
receiving no right to mutate it or inherit its private memories. Cross-forest cart travel, gifts,
resident identity and collaborative building need later explicit access and continuity policies.
Use stable owner/world/object references now; do not build multiplayer synchronization or public
endpoints in anticipation of those policies. The private owner forest must not become public as a
side effect of adding a road or traveler.

## 6. Current evidence and reuse boundaries

Read-only preparation found local `master` and the locally recorded `origin/master` at `679327c`.
Remote freshness was not checked. The starter prompt was already untracked and is preserved.
No production account was inspected. No tests were rerun for this documentation draft; the
1,516-spec result in the planting handoff is historical evidence only.

| Existing foundation | What it supports | What it does not establish |
| --- | --- | --- |
| Owner scene, signed coordinates and regional reads | Authenticated forest entry, movement, writing inspection and bounded delivery | Vehicle motion, large-building collision or high-speed loading behavior |
| Persistent markers and garden | Ownership, revisions, transactions, retry and deletion patterns | A general construction, materials or character-memory store |
| Terrain generations 3 and 4 plus terrain-free worlds | Existing supported environments and explicit activation/upgrade boundaries | Guaranteed buildable land or cart access at an arbitrary location |
| Clearing objects, inventory, traveler and transient life in the development scene | Useful interaction and rendering examples | Shipped account-backed systems that can simply be enabled |
| Fixed projection, humanoids and bridge geometry | A starting point for visual studies | A proven house/cart/animal asset pipeline or complete 3D engine |

The live marker schema's kind list is currently `personal-marker`. Its placement and terrain
protections are sized around existing objects. A house or travel corridor must not be implemented
by merely labeling a large object as a marker or enlarging a marker radius.

## 7. Spatial foundation: home area, route and destination

**Recommended direction, subject to feasibility:** allocate an additional home area in the same
owner world, connected to the existing forest through a usable approach. Save the accepted site
and its access reservations. This preserves the feeling of one place and avoids relocating
existing trees or personal work. It is not yet a proven allocator.

The first technical investigation must answer:

1. Can a bounded search find enough clear land for the largest allowed house, companion resting
   spot, cart parking/turning space and a doorway approach?
2. Can it also establish a reachable route and destination without crossing unsafe water, narrow
   passages or protected writing? Test terrain-free, generation-3 and generation-4 worlds.
3. Can those reservations participate in future writing allocation, garden/marker placement and
   terrain activation/upgrade, so later changes do not build over the home or cut off its access?
4. How does an existing owner reach the home from the normal entrance and return from writing?
   Preserve writing-return destinations and provide a deliberate, discoverable home locator.

Allocation must be bounded, server-validated and explicit. Save accepted coordinates and a layout
version rather than searching again on every entry. Establishing a home should atomically reserve
its required space, or use a resumable operation that publishes nothing until the complete area is
ready. Concurrent home requests must recover one result. Do not change a world seed, activate terrain
automatically, remove trees, or regenerate existing geography to make a candidate fit.

Reserve the doorway, approach, parking and supported house expansion envelope. Geometry must cover
actual footprints and passage widths, including corners and turns; circular protection records alone
are not evidence of sufficient access. Future terrain upgrades must preserve the new reservations
or refuse publication. Older activation helpers that do not understand them must not bypass this.

If an acceptable site and route cannot be allocated, leave the existing forest usable and spend no
materials. Measure the frequency and cause in representative development fixtures. Alternatives are
a different nearby layout, a separately entered home/expedition area, or an explicit terrain-extension
design. A separated area changes the continuous-world experience and requires a recorded design
decision; it is not a silent fallback. Do not launch an unbounded search or require the player to
clear writing to proceed.

The destination must have a distinct composition, material source and reason to dismount. One
crafted route is enough to test travel. It need not implement general biomes or enlarge the whole
world. Preserve an understandable route back and a recovery action if a cart becomes stranded.

## 8. Construction, movement and presentation foundations

### Designs that can gain options later

Represent home/cart designs as bounded, versioned combinations of stable component identifiers,
dimensions, materials and attachments. Keep placement, design, visual rendering and material costs
separable. A renderer revision must not silently reroll a design or reinterpret committed material.

Adding a compatible color or part should be ordinary catalog work. Changing a footprint, attachment
rule or structural meaning requires validation and, where necessary, explicit migration. Retain
readers/assets for existing component versions or define a deliberate conversion. Unknown versions
must preserve the original saved data and block incompatible editing, never replace it with defaults.

Share useful concepts such as material treatments and attachment anchors across home and cart.
Do not require one unrestricted construction engine to represent vehicles, rooms, terrain and every
future object. Interior wall topology, support/elevation and room visibility can be added through
separate explicit design revisions if those features are later approved.

### Driving study

Start with direct, forgiving steering and a simplified compound footprint for the animal and cart.
Prove turning, reverse or equivalent tight-space recovery, stopping, mounting, dismounting and safe
parking. A stationary NPC or companion must not permanently obstruct the route.

The existing walking behavior is not sufficient evidence for a faster, longer vehicle. Test swept
collision or bounded substeps to prevent tunneling during slow frames. Verify corners, trees,
boulders, bridge rails, water edges and entry/exit positions. A cart may be unable to use some older
footbridges, but the first expedition route must accommodate every supported cart design. Dismounting
should preserve access to narrower walking paths without trapping the cart.

Measure region-loading behavior at the chosen speed. Existing endpoints retain their request and
payload bounds. Prioritize or prefetch within an agreed bounded budget; stop safely before unknown
geometry rather than treating it as open land. Test delay, failure, region eviction and terrain-token
changes. Do not obtain perceived speed by bypassing collision or requesting the whole forest.

Proposed travel persistence: save explicit parking locations; keep steering and animation transient.
A fresh session restores the last confirmed safe parking state, not a speculative frame position.
Define player arrival, companion reunion and a user-triggered return-cart-home action before building
travel saves. Recovery must preserve holdings and encounter outcomes, and explain where the cart went.
Continuous authoritative movement and multi-user driving are deferred.

### Visual and interaction study

Render a representative house, two visibly different carts and the animal at actual forest scale.
Check roof/door readability, attachment placement, turning directions, depth ordering, tree-canopy
occlusion and mounted-player visibility. Establish an art approach compatible with the current
renderer before producing the catalog. Representative art is necessary before judging emotional
appeal; placeholder blocks can establish controls but cannot validate attachment.

The owner's November 11 study review establishes a warmer, cozier, rustic art direction, with
Stardew Valley as a reference for atmosphere and handmade detail. Favor weathered wood, uneven
shingles, patched fabric, warm windows and restrained natural colors. The two cart and house
variants were well received, but their current geometry is provisional. Establish a coherent
treatment alongside the existing forest before expanding the asset catalog; this does not yet
choose a new renderer or require a whole-world art conversion.

Keep the rider recognizably the same character at the same scale when seated: preserve head,
hat and torso proportions, allowing the seat and cart sides to occlude the lower body. Add wheel
rotation tied to actual travel and a leg cycle for the pulling animal that responds to movement
and stops when blocked or parked. Subtle body, ear and fabric motion can follow once these basics
read clearly. Validate both cart variants at actual play scale and retain reduced-motion support.
These belong to the full implementation; the first study has not implemented them.

Use the existing contextual dock for nearby actions. Editors occupy one in-viewport surface with
preview, save and cancel; the satchel remains the home for holdings. No simultaneous build, gift,
dialogue and driving overlays. Restore focus on closing. Touch controls must work without hover,
precision dragging or keyboard hints. Test at 320px and 390px as well as desktop, and separately on
physical touch hardware. Reduced motion retains a visible companion and clear recognition states.

Provide keyboard-operable forms and semantic summaries for designs, holdings, encounter state and
home/cart recovery. Preserve the existing non-canvas writing route. Record any remaining limits to
equivalent non-canvas spatial exploration explicitly rather than claiming full parity from labels.

## 9. Durable state and authority

The exact document layout is an implementation decision to settle after the spatial and editor
studies. These responsibilities must be explicit before persistent writers are added:

| Responsibility | Durable facts | Transient presentation |
| --- | --- | --- |
| Home area and expedition | Site/layout identity, coordinates, reservations, destination/source identity | Camera, navigation cues, loaded-region cache |
| Construction | Object identity, design version, supported parts/materials, placement, committed resources | Unsaved preview and editor focus |
| Holdings and discovery | Material quantities, unique parts, source claims/availability, crafted items | Pickup animation and currently carried appearance |
| Cart and companion | Design link, confirmed parking, companion identity/name, introduction completion | Steering, harness animation, idle movement |
| Neighbor continuity | Met/offer/recognition facts, received gift identity/design, explicit conversation choices | Current walk, pose and open dialogue |

Prefer bounded records and facts to an unbounded log of movement or chat. Reference stable objects
and source identities; do not store copied private writing or client-rendered assets as authority.

Server rules must derive the owner from the session and validate world identity, feature support,
terrain state, versions, costs, holdings, legal design and placement. Current proximity is largely
a browser interaction convention; claiming secure physical travel would require additional work.
Validate source eligibility and deduplicate claims server-side without pretending the client proves
the route was walked. Public competitive trading is outside this trust model.

Use atomic transactions for connected outcomes: spending and creating; changing a part and refunding;
harvesting and crediting a holding; gifting and recording the displayed gift; accepting the special
frame and recording the encounter. A mutation must not consume an item without producing its result.

Expected revisions and stable command identities must handle repeated clicks, multiple tabs and
lost responses. Equal retries recover committed outcomes; differing or stale intent conflicts.
Revalidate cross-record dependencies, not just the visible editor's revision. Share the existing
owner deletion/terrain fences where applicable. Finalize retry-retention bounds and indexes from
actual read/write shapes; do not assume the garden's exact receipt scheme fits every new operation.

On uncertain saves, show an unresolved state and read authoritative results before issuing new
dependent commands. Background reads must not disable ordinary play or overwrite a newer command.
Do not replay offline spending, gifts or placement automatically. A pending resource action must not
silently disappear when the player travels to another region.

Extend account-deletion cleanup, diagnostics and relevant exports to every new record family.
Existing marker-only reset tools retain their scope. Any new reset must state exactly what it clears;
development fixture reset remains restricted to its reserved identity. Feature disablement should
stop new creation while keeping saved possessions readable and recoverable. If unsafe movement must
be disabled, preserve the cart and provide safe recovery rather than removing its record.

## 10. Risks and planned responses

| Risk or failure | Planned response / decision boundary |
| --- | --- |
| No suitable home or route in an existing world | Bounded allocation with no partial spending; fixture coverage across terrain and occupancy; decide geography alternatives before general rollout |
| New building or future writing blocks a doorway or road | Reserve footprint plus access; apply shared placement exclusions to all relevant writers; verify terrain upgrades |
| Customization is only a cosmetic menu | Demonstrate distinct silhouettes and multiple valid arrangements in the editor study; revise component vocabulary before enlarging the catalog |
| Cart driving is awkward or loads empty space | Test movement and regional delivery first; adjust size, steering, speed or route; retain uncertainty if the intended travel pleasure remains unproven |
| The destination is just a resource dispenser | Include a readable place to explore and at least two uses for its material; observe enjoyment of the journey separately from acquiring the item |
| Materials create grind or a dead end after gifting | Trace acquisition/spending paths, refund construction, guarantee accessible supply, and keep gifts optional; tune costs before adding sources |
| Blossom rules undermine the existing garden | Specify an additive harvest contract and lifecycle tests; leave cuttings and established growth intact |
| Animal/neighbor feels repetitive or demanding | Few specific memories with visible consequences; no upkeep or guilt; test a return encounter, not only the introduction |
| Reload, two tabs or a lost response duplicates or loses an item | Atomic outcomes, revision conflicts, stable retries and explicit authoritative recovery |
| App update or disabled feature strands a saved design | Versioned readers, retained definitions, compatible rollout and safe recovery; no silent reset |
| Large sprites or regions overload mobile | Establish baseline-device budgets in the early studies; bound components, actors and caches; simplify presentation before reducing interaction clarity |
| Scope expands into a full settlement or engine rewrite | Keep this slice's counts and deferred work explicit; raise material scope changes for design review rather than quietly implementing them |

## 11. Implementation sequence and evidence gates

Implementation belongs on a new feature branch, provisionally
`feat/forest-home-cart-expedition`. Refresh repository status and applicable guidance first; preserve
unrelated work. Use Robert's Node installation when running JavaScript:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
```

This is a multi-increment effort, with estimates to follow the early studies. The milestone names
below are local to this brief and do not silently renumber the existing forest roadmap.

| Stage | Work and playable result | Exit evidence |
| --- | --- | --- |
| A. Resolve foundations | Review this brief; bounded code investigation of spatial allocation and existing service integration; specify initial catalog and resource rules | Recorded decisions for home geography, access reservations, construction bounds, source supply and save boundaries; identify migrations or additional work honestly |
| B. Prove controls and appearance | Home/cart customization and driving studies in an isolated owner-template fixture; temporary fixture state is acceptable here | Meaningfully different designs; comfortable keyboard/touch controls; working turns, obstacles, mounting and safe loading boundaries; representative visuals at real scale |
| C. Establish durable construction | Add site/reservations, home/cart designs, holdings foundation and parking recovery behind a development gate | Save/reload and another session preserve the result; writing/garden placement and terrain protections coexist; failure and concurrency checks pass |
| D. Connect the complete experience | Add actual companion and traveler encounters, special part, expedition/source, lanternbell making/gifting and remembered response | Rough full sequence is playable in the real owner template with account-backed fixture state; enough content to experience each connection; no production enablement |
| E. Qualify and evaluate | Refine integrated controls, art and pacing; complete automated, database and browser checks; conduct owner and small external playtests | Honest technical evidence and voluntary-interest findings; revise, continue or drop weak connections without declaring success from task completion alone |
| F. Prepare release | Document compatible reader/writer rollout, feature enablement, reservation/migration procedure and recovery | Reviewable release package after acceptance; deployment and production access remain separately authorized actions |

Stages B–D should keep a walkable development scene available. Use placeholders for unfinished
connections when helpful, clearly labeled as such. Reach a rough complete sequence before polishing
every component. Do not divert into a separate browser-local game that later requires a wholesale
production rewrite. The account-backed fixture remains the integration target.

### Accepted first increment: home geography and a cart round trip

This increment takes the spatial portion of Stage A and the movement portion of Stage B together.
It does not complete either stage: the full construction editor, final resource rules and other
foundation decisions remain scheduled work. The owner accepted this boundary and authorized local
implementation. The playable study and its findings are recorded in
[the increment 1 study](home-cart-increment-1-study.md); owner experience and physical-device review
remain separate from its automated verification. Permanent saves and production enablement remain
outside this increment.

Player-visible result: in an isolated development fixture using the owner template, arrive beside
a representative home shell, mount a recognizable cart/animal assembly, drive to a distinct test
destination, dismount, and return safely. Use temporary fixture state and clearly labeled recovery.

Included work:

- A bounded, non-publishing home/site and route feasibility study using existing terrain and
  representative writing, marker and garden occupancy. Exercise terrain-free, generation-3 and
  generation-4 cases, including an intentionally impossible layout.
- An explicit proposal for footprint, doorway, parking/turning and route reservations, and the
  server writers and terrain-upgrade paths that would need to honor them. Do not publish new
  reservations or claim durable compatibility from the fixture alone.
- Fixed home/cart study variants near the proposed smallest and largest supported dimensions;
  enough visual identity to judge scale, visibility and navigation. These are clearance studies,
  not the final customization editor or catalog.
- Direct cart controls, mounting/dismounting, collision, camera behavior, safe stopping before
  unavailable regions and a development recovery action. The animal follows the movement model;
  befriending and autonomous companion behavior are later work.
- Focused geometry/movement tests, owner-template desktop and narrow/touch browser checks, and a
  local walkthrough with separately recorded physical-device evidence when available.

The outer boundary excludes database schema changes, permanent homes or parking, resource spending,
blossom changes, crafting, gifts, conversations, encounter memory, interiors, general biome work and
production activation. Existing writing, marker and garden behavior must remain intact. Reusable
movement/geometry helpers should have focused regression coverage; fixture shortcuts stay confined
to development code.

Exit with a playable round trip, measurements and findings, and a concrete recommendation for the
spatial design. If connected allocation or comfortable driving fails, record the failure and a
bounded alternative before committing durable state. A canned clear route alone does not establish
compatibility with existing worlds. This increment establishes feasibility and control quality;
the later complete slice remains the test of the broader game experience.

### Accepted second increment: construction and representative presentation

On November 11 the owner authorized actual home/cart customization with a bounded visual pass,
continuing in the temporary study. Build independent part/material and width/depth choices with
live scene previews, Apply/Cancel, consistent seated-avatar proportions, wheel/leg animation and
a warmer rustic treatment. All supported carts must remain usable on the existing expedition.
The accepted boundary excludes permanent saves and spending; settle the design representation and
record the remaining save decisions before Stage C. This continues Stage B without declaring the
remaining Stage A foundations complete.

Implementation, catalog bounds, review instructions and evidence are recorded in
[the increment 2 construction study](home-cart-increment-2-construction.md). The owner's November 11
playtest positively reviewed the customization range and artwork, and identified a cart/rider
layering defect that has been corrected with focused rendering checks. Physical-device evidence
remains separate from that review and automated verification.

## 12. Verification and playtest

### Technical acceptance

Run focused tests for actual invariants and expand to the repository-required checks before release.
At minimum, cover:

- Valid/invalid design combinations; bounds; upgrade compatibility; unknown component preservation.
- Safe home allocation, access and reservations on terrain-free, generation-3 and generation-4
  fixtures; empty and occupied worlds; future writing/marker/garden placement and terrain upgrade.
- Cart corner/bridge/water collision, slow frames, safe dismount/parking, regional delay/failure,
  terrain-token changes and recovery from an interrupted trip.
- Authoritative spending/refunds, harvesting, source claims, unique component grants and gifts;
  equal/stale retries, rollback, two tabs, no duplicated rewards and inventory-capacity behavior.
- Reload and separate-session continuity, unavailable reads, incompatible versions, disabled feature,
  account deletion and the separation of existing reset scopes.
- Session-derived ownership, cross-owner request rejection, private responses and the existing
  same-origin mutation guards for every new endpoint.
- Existing writing inspection/return, markers and the full lanternbell loop remain intact.
- Desktop and narrow browser layout, keyboard/focus, touch gestures, reduced motion, semantic access
  and a physical-device walkthrough. Emulation is distinct from physical-device evidence.

Record frame time, response sizes and region/cache behavior on a named baseline device and
representative scene. Choose numeric budgets during the studies; no current measurement proves
vehicle-speed or large-building performance. Do not inflate every API limit to make one fixture pass.

### Experiential acceptance

Start with the owner, then a small group of approximately three to five willing participants when
the sequence is coherent. This is qualitative evidence, not a retention or demand estimate.

Offer a simple invitation: make a home/cart you like, meet whoever interests you, and explore. Help
with genuine usability failures but record the intervention. Do not prescribe which roof to choose,
whether to give the garland away, or what their second project should be.

Observe two different things:

| Ease and trust | Voluntary interest |
| --- | --- |
| Can they understand parts, costs, mounting, steering, gathering and return? | Do they compare designs or invent a use without prompting? |
| Can they identify what saved and recover from an interruption? | Do they stop during the journey for reasons beyond collecting the resource? |
| Do they notice the gift and remembered encounter? | Do they care about the companion or seek another conversation? |
| Does the complete path work on the target device? | Do they choose another project or return later without a reward or deadline? |

Invite an optional later visit with no completion incentive. The strongest signal is a specific
self-directed intention or enjoyment of the changed place. A participant can be satisfied and done;
longer sessions and frequent return are not goals by themselves.

- **Continue:** different designs and purposes emerge; the trip is enjoyable; remembered consequences
  matter; some people voluntarily revisit or propose another project.
- **Revise:** interest exists but controls, weak visual distinction, unclear choices or supply rules
  obstruct it. Fix the identified cause before expanding the catalog.
- **Reconsider the connection:** after usable controls and representative presentation, participants
  only follow instructions and show little interest in making, traveling or returning. Do not respond
  automatically by adding timers, currency, more characters or more chores.

## 13. Explicitly deferred

- A fully inhabited settlement, resident schedules, marriage, generalized relationships and
  open-ended generated conversation.
- House interiors, editable partitions, room/furniture systems, arbitrary additions and storeys.
- Freeform block construction, structural physics, full horse/cart simulation, a new 3D engine
  or free-look camera.
- Broad biome generation, unrestricted terrain editing, a whole-world pathfinder and long-distance
  travel networks.
- A general market, currency, large recipe tree, repetitive production chains and monetization.
- Multiplayer presence, visiting, cross-forest driving, player exchange and shared construction.
- A large animal/species catalog, breeding, and additional wildlife responses beyond what is needed
  to complete the chosen slice. Hunger and compulsory care are excluded by the design principles.

Deferral preserves the ambition without treating it as current implementation scope. New options
should be easy to add within supported rules; entirely new spatial or social capabilities may still
require deliberate architectural work.

## 14. Decision register

The owner has accepted this brief. The following working defaults guide implementation; the listed
technical evidence is still required before dependent changes. Routine choices within the accepted
scope do not require renewed permission. Material changes to the experience should be made explicit.

| Decision | Proposed default | Resolution point / contingency |
| --- | --- | --- |
| Home geography | Additional reserved area in the same owner world | Stage A investigation; if bounded connected allocation fails, bring a concrete separate-area or extension alternative for review |
| Construction freedom | Bounded proportions plus compatible parts and attachments | Stage B visual/editor study; reject a result that only offers finished skins |
| Home first-version boundary | Exterior and adjustable rectangle; no entry or partitions yet | Accepted; keep interior ambition explicit |
| Driving model | Direct steering, simplified compound footprint, safe dismount and recovery | Stage B movement study; settle speed and dimensions from actual paths and device behavior |
| Companion and traveler | One mule and one traveler, possibly Tansy; authored encounter memory | Accepted working direction; names/art/dialogue can evolve without changing stored identities |
| Materials and remaking | Small inventory, committed-material refunds, guaranteed accessible supply | Stage A acquisition/spending table before persistent writers; exact quantities remain tunable |
| Blossoms | Additive, non-destructive harvest separate from cuttings | Stage A explicit eligibility/yield/capacity/lifecycle rules; unresolved until that contract is written |
| Return continuity | Explicit parking saved; live movement transient; safe recovery action | Before Stage C schemas and return behavior; check interrupted trip and existing writing-return priority |
| Performance and compatibility | Current projection and bounded regional APIs | Stage B measurements; specify device budgets and readers/writers for larger reservations before rollout |
| Future social ownership | Per-owner encounter facts; no globally shared traveler state | Accepted for this slice; cross-user identity/visibility remains future design |

Update this document as the planned studies resolve technical questions. The implementation handoff
should include the initial content/cost table, a simple spatial layout,
state/transaction decisions and the Stage B study checklist. These are the concrete next deliverables;
another broad brainstorming phase is not required before starting the studies.

## Sources and implementation reference points

- [Long-term gameplay and world vision](activity-forest-long-term-gameplay-vision.md): aspiration,
  construction vocabulary, owner worlds and later connections; older horizons are not all shipped.
- [Planting design](live-planting-design.md) and [walkthrough](live-planting-walkthrough.md): current
  garden behavior and recorded verification.
- [Clearing evaluation](milestone-10-clearing-loop-evaluation.md): historical experience with authored
  places, traveler presence, movement and the boundary around constructive work.
- [Owner scene contract](owner-production-scene-contract.md), [environment resolver](owner-environment-resolver-contract.md)
  and [river/lake slice](live-river-lake-slice.md): signed geography, regional delivery and terrain
  compatibility. Some older scene-contract exclusions predate live gardening; use later garden docs
  and current code for that feature.
- [Post-to-tree meaning](post-to-tree-meaning-contract.md): stable writing identity and separation
  from personal construction and transient life.
- Current source seams: `public/js/owner-forest-scene.js`, `public/js/owner-forest-garden.js`,
  `public/js/forest-humanoid.js`, `public/js/forest-clearing-objects.js`,
  `public/js/forest-discoveries.js`, `server/services/forestGarden.js`,
  `server/services/forestAuthoredPlacement.js`, `server/db/schemas/ForestTerrainProtectionSchema.js`
  and `views/forest/index.pug`. These are starting points for focused implementation work, not a
  completed architecture audit.
