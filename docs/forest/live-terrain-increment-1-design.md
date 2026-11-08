# Live forest terrain: increment 1

Prepared November 6, 2026 on `feat/forest-live-terrain`; integration updated November 7.
The current terrain slice is connected to the private forest route behind explicit per-owner
activation. Development activation and automated checks are available; human/physical-device
acceptance and production rollout remain outstanding. Historical checkpoints below distinguish
the earlier geometry-only and preparation-only stages.

November 8: the [river/lake landscape study](river-lake-landscape-study.md) revisits this increment's
district-local water scope. It provides a playable development preview with a minute-long bank
route and larger receiving lake. It does not change live generation 3; its compatibility section
describes the decisions needed before live adoption. Earlier exclusions of lakes and longer rivers
are historical scope choices, not restrictions on this follow-up.
The subsequent [first live river/lake slice](live-river-lake-slice.md) implements generation 4,
dual-generation readers, explicit replacement activation, and lake surface motion. Its current
integration details supersede the study's earlier preparation-only compatibility proposal.

## Experience and scope

Walk from a familiar grove into visibly rockier country, encounter a stream, cross a generated
bridge, leave, and return to the same landscape. Terrain should create recognizable places and
reasons to wander, while writing and personal markers remain accessible.

Bring the established experimental stream, banks, boulders, and bridge presentation into the
authenticated owner forest. Adapt their generation to the signed, expanding owner world. Do not
copy the finite test scene or make the browser authoritative for durable placement.

This is the next delivery toward a personally satisfying playable forest. Participant recruitment
is deferred while that experience develops; local play review remains part of each increment.
This sequencing change does not declare Part III Milestone 4 complete or replace its outstanding
material/commitment/refund work. It also does not establish enduring use by other participants.

Large lakes, branching river networks, seas/coasts, snowy regions, birds, visitors, gathering, player-built
bridges, and terrain editing are outside this increment. Keep room for them without building
general hydrology, navigation meshes, or an economy now. Small receiving ponds and bounded
headwater creeks are included to give this increment's streams recognizable starts and outlets.

## Existing implementation to reuse

- [Owner environment](owner-environment-resolver-contract.md): seeded calm-grove/rocky-rise
  classification on signed coordinates. Its version-1 ecology and tree-suitability meaning stay
  unchanged.
- [Experimental environment](environment-region-contract.md): stream/bank sampling, boulder
  presentation, generated bridges, depth ordering, and repaired bridge approaches. This proves a
  finite scene, not an expanding-world generator.
- `public/js/forest-environment.js`, `forest-stream-banks.js`, and `forest-bridges.js`: reusable
  geometry/presentation where their assumptions fit. `server/services/forestTerrainFeatures.js`
  supplies generation examples; its finite-world search and fixed crossing identities need adaptation.
- [Owner scene](owner-production-scene-contract.md): private bootstrap, signed movement, bounded
  regional loading, and transient camera/player state.
- Existing writing-tree creation, authored placement, and tree/marker return services: integrate
  terrain at these boundaries as well as in the painter.

The current production environment deliberately has no stream or bridge. Terrain that merely looks
impassable, while markers and trees can still be placed through it, is not a completed delivery.

## Separate current terrain from captured ecology

Add a separately versioned generated-terrain descriptor to the owner world. Conceptually it holds
the terrain schema/generation identity, compatibility protection, and activation revision. Exact
stored fields and wire versions are to be specified alongside the first schema implementation.
An absent descriptor means the established terrain-free compatibility surface.

Keep owner-world seed, forest identity, tree coordinates, placement slots, originating-environment
snapshots, projection, and marker relationships intact. Do not bump the existing ecology version
in place or rewrite tree phenotypes to reflect new surface geometry. New tree allocation combines
the established ecology query with the current terrain exclusion query before reserving a slot.
Existing snapshots describe founding ecology; they are not a promise that every future ground
detail is frozen.

Generated bridges and boulders have stable procedural identities, not authored-marker records.
Changing their collision geometry or anchors requires a new terrain generation, not just a paint
version. Presentation-only changes can advance separately.

## Stable generation across loading boundaries

Use seed-derived terrain districts anchored to a fixed world lattice. Each feature has one home
district and an identity derived from seed, generation version, district coordinates, and ordinal.
District size, feature reach, and maximum counts become explicit constants before integration.

For this first grammar, use local spring-fed systems: a tapered main channel, two small headwater
creeks joining upstream, and an irregular receiving pond downstream. Do not claim a continent-wide
river network or physically simulated catchment. Every channel has an explicit upstream/downstream
order; the main channel visibly enters its pond, rather than ending in an isolated rounded cap.
Vary orientation, length, shore shape, and district occupancy. Adjacent districts may contain
separate systems; inter-district water connections remain future work. The initial review must
confirm that this restricted vocabulary is visually convincing.

A point/rectangle query enumerates only the fixed neighboring districts whose features can affect
it. Bound stream length, width, bank reach, rock extent, and bridge approach extent so that this
neighborhood is finite. Geometry is independent of viewport, request order, loaded trees, post count,
clock, and animation. Use floor addressing for negative coordinates and stable feature ordering.

Generate complete stream/bridge geometry from its home district even when only part is visible.
Clip painting to the viewport, not generation to the loaded region. Neighboring requests must agree
exactly on overlapping geometry and feature identities. Do not stretch the finite lab map across
the owner's current bounds or repeatedly tile its single stream.

Each obstructing stream reach needs a guaranteed usable generated crossing. Choose the crossing
with the stream, then reserve its deck and approaches before accepting boulders or new trees.
Reject an unusable reach deterministically rather than drawing water without its promised route.
The bounded water system and its crossing must preserve local passage without requiring a
whole-world pathfinder.

## Existing forests: protect first, then activate

Generate varied terrain among existing places from the first implementation. Do not introduce a
large protected dry district, even as a temporary development strategy. Preserve local footprints
and access instead of excluding the established forest from the new geography.

Before activation, capture immutable, spatially indexed protection geometry for established tree
and marker placements and the entrance. Include hidden/inactive trees because they reserve their
coordinates and may return. Include retained removed-marker placements conservatively. Protection
includes collision footprints, interaction/return space, and the clearance needed to approach on
foot; it is not just a dry pixel under each anchor. Store geometry and opaque identities only, with
no writing metadata.

Use these frozen constraints when choosing stream paths, bank extents, boulders, bridge decks, and
approaches. Prefer a deterministic alternate path or feature candidate over clipping water into
visible circular holes around objects. Keep nonblocking surface variation within protected areas
where suitable. Features should appear among nearby trees and markers, with natural shorelines.
Dense established content may locally reduce feature density; it must not force terrain away from
the entire occupied forest.

Dry footprints alone do not prove access: a stream could enclose an otherwise safe tree. Generation
must also preserve connected walking access from the entrance to established places. The geometry
proof must choose and validate a bounded district connectivity rule, including cross-district
connections and local access clearances. Candidate rejection must preserve that rule. Do not assume
that one bridge somewhere on a stream proves every protected place reachable. If constraints
cannot be satisfied within the work bound, omit the conflicting feature, retaining valid adjacent
terrain; never omit protection or silently publish an unreachable place.

The exact protection primitives, clearances, spatial index, and connectivity construction are the
first geometry design checkpoint. Compare compact, dense, widely spread, and negative-coordinate
fixtures before persistence work. In particular, inspect whether access clearances create obvious
artificial corridors or suppress too much water. A global pathfinder and whole-world reads are not
acceptable substitutes for a bounded construction.

Protection is frozen at activation rather than recomputed from currently loaded or active objects.
Moving/removing a marker or hiding/deleting/restoring a tree must not reroute a stream or expose new
water at its old location. After activation, new placements obey the established terrain; they do
not grow protection or reshape geography. New worlds generate terrain around a small entrance
reservation before accepting their first terrain-aware tree or marker placement.

A feature query reads all frozen protections intersecting its complete influence area, including
access/transition margins across district boundaries. It must not depend on which live objects the
browser happens to have loaded. Bound page size, total local constraint work, and overflow behavior;
never truncate protections and treat the missing constraints as empty space. Private regional
terrain delivery must let server and browser reconstruct the same geometry at one activation
revision without sending the owner's complete protection set.

Activation must be a resumable owner-scoped operation, not an unbounded scan during page load:

1. Capture local protection geometry and access constraints using bounded pages and durable
   progress. Keep the old surface live while preparing it; do not send partly prepared protection
   or a partly prepared descriptor to clients.
2. Detect any tree allocation, marker movement/creation, reconciliation, reset, or deletion that
   invalidates the scan. Establish a revision/fence protocol covering all these writers; current
   placement revision alone does not cover authored mutations. A short final transaction cannot
   make an earlier unfenced multi-page scan consistent.
3. Publish the complete protection-set reference and descriptor atomically only after a validated
   scan. Conflicting writes
   invalidate/restart preparation or are temporarily rejected through the shared activation
   protocol. No stale scan may activate. Interrupted preparation leaves the old world usable.
4. Never expose an unsupported or incomplete terrain version as empty, obstacle-free land.

The exact operation schema, conflict responses, retry identity, scan bounds, and fence participation
must be written and tested with the activation implementation. Reuse existing transactional owner
fencing where applicable, but do not assume every lifecycle writer already participates.

## One geometry authority for traversal and placement

Create a pure shared terrain boundary for bounded feature queries, point/body suitability, bridge
deck/approach classification, and movement-segment checks. Server and browser use identical
geometry and version dispatch. Painters consume this geometry instead of defining collision shapes.

- Water and blocking boulders prevent ordinary movement. Bridge decks and approaches provide the
  explicit crossing surface. Check swept movement or bounded substeps to prevent tunneling.
- Tree allocation excludes water, banks where required, rocks, decks, and bridge approaches.
- Marker create/move previews and authoritative writes reject those same unsuitable surfaces.
  Do not allow markers to obstruct a crossing. Existing exact retries retain their current recovery
  semantics before applying new-create validation.
- Entrance and tree/marker return spawn selection use terrain plus occupied-neighborhood clearance.
  If a targeted spawn cannot be proved safe within its existing bounds, use the safe entrance.
- Crossing elevation is presentation derived from the bridge profile; durable coordinates remain
  on the ground plane. Preserve deck/actor/rail depth order and bank occlusion.

An old open browser must not keep writing under obsolete placement rules after activation. Bind
new placement intent to terrain revision and require refresh/reconciliation on mismatch, while
preserving already-committed retry recovery. Protocol details belong with the API change.
Terrain queries add no writing metadata to manifests or assets.

## Delivery sequence and review gates

1. **Geometry proof:** implement the signed deterministic sampler and review several seeds,
   negative-coordinate boundaries, crossings, and compact/dense/widely spread protected placements.
   Prove connected access and nearby terrain together. Reuse a development preview, but treat this
   as preparation for live integration, not the final deliverable.
2. **Compatibility and authority:** implement versioned descriptor/activation, server placement,
   immutable protection delivery, stale-client behavior, and safe returns with focused
   persistence/concurrency fixtures.
3. **Live scene:** render water, banks, rocks, and bridges in `/forest`; integrate collision,
   culling, focus, input, and reduced-motion behavior. Keep animation disposable and bounded.
4. **Playable review:** exercise the full grove-to-crossing-and-return experience on a real owner
   account, then a physical mobile browser. Record commit, browser/device, seed/data shape, and
   actual observations separately from automated evidence.

Choose explicit feature-count, query-neighborhood, cache, and frame-work bounds during geometry
implementation and measure them on the live route. Reuse bounded region loading; never fetch all
of an owner's writing or regenerate the whole explored world per frame.

Acceptance includes stable overlapping queries, negative coordinates, clearance at both bridge
ends, movement along banks/rocks, new placement and retries, hidden-tree restore, moved/removed
markers, activation races/recovery, cross-session continuity, keyboard/pointer/touch, reduced
motion, and the semantic writing path when scene delivery fails. Run existing relevant suites and
lint; add tests for new geometry and durable transitions rather than duplicating painter details.

## Rollout boundary

Deploy compatible readers and terrain-aware writers before enabling per-world activation. Keep
activation opt-in during development; no production scan or enablement is authorized by this note.
The gate controls activation, not whether already activated worlds obey their terrain.

After activation, preserve the descriptor and safety rules when pausing further rollout. Do not
roll back to code that ignores terrain while continuing durable placement writes. Deletion cleans
up activation state and frozen protection records; authored reset does not regenerate base terrain. No mass tree/marker
rewrite, seed reset, or production-data fixture is part of this increment.

## Geometry proof checkpoint — November 6

Implemented a development-only pure sampler in `public/js/owner-forest-terrain.js`; it is not imported
by the production scene or any durable placement service. Run `npm run forest:terrain-preview` to
write `tmp/forest-owner-terrain-preview.svg` and a PNG counterpart. The six-panel preview compares
two seeds with compact, dense, and widely spread synthetic protected places. It reads no database.

The candidate uses 1,920-unit districts, 600–1,000-unit winding reaches, one crossing per accepted
reach, and at most 25 boulder candidates per district. Twelve alternative stream candidates may be
tried around constraints. Query bounds are 25 districts and 512 complete fixture protections;
these are proof-work limits, not production lifetime limits. Oversized input and unloaded terrain
queries reject rather than infer empty land. This proof still takes the complete fixture set;
regional protection transport remains unimplemented.

The first connectivity construction reserves narrow dry district boundaries, with a local spur
from each protected footprint to its nearest boundary. Features avoid those reservations. There
is no large dry disk. Protected footprints, spurs, stream banks, and crossing approaches participate
in candidate rejection; frozen input order does not affect the output. The preview's gold circles
and dashed lines show reservations only, not player-visible roads. Point/body and bounded small-step
movement queries distinguish dry land, bank, water, rock, and bridge; bridge approaches reject
new placement while permitting walking.

Focused tests exercise overlapping signed queries, stable identities and seed variation, JSON
round trips, footprint/spur/boundary clearance across several seeds, bridge approaches, water
crossing attempts, nearby streams, dense-conflict omission, and work-bound rejection.

This is a geometry checkpoint, not completed experiential or connectivity acceptance. The current
stream ends are simple round caps, reach frequency still reveals the district structure, and the
preview uses schematic rocks/bridges rather than the established detailed painters. Refine those
before approving the landscape for activation. Access checks currently establish clearance from
**new terrain**, not navigation around existing solid tree/marker bodies: a straight spur can pass
through another protected object's center. A subsequent walkable preview must incorporate those
bodies, find/validate usable local approaches, and record any necessary revision to the spur rule.
Do not interpret the preview's access PASS as a full live-scene reachability guarantee. Persistence,
activation, regional protection delivery, live rendering, and physical-device review remain ahead.


### Naturalistic water refinement — November 6

Following visual review, the proof now generates spring/seep sources, tapered main channels, two
headwater feeders, and small irregular receiving ponds. Flow direction is explicit in channel point
order and labeled arrows in a new close-up preview. This supplies a recognizable local water story;
it does not simulate rainfall, elevation, drainage basins, erosion, or a connected river network.
Ponds are the agreed narrow scope extension needed for convincing stream outlets, not a lake/sea
system bundled into this increment.

Water geometry proof identity is now `terrain-proof-2`. Channel ribbons and irregular source/pond
polygons are shared by painting, body collision, placement exclusion, rock clearance, and frozen
protection checks. Banks are a 24-unit margin around that union. Candidate rejection covers the
whole system, including feeders and pond shores, and preserves the connected district-boundary
reservations. No production version is advanced by this development-only identity change.

Main reaches are now 560–760 units long, taper from a 3-unit half-width near the spring to 24 units
downstream, and have a bounded pond at the outlet. Each district has an 85% seeded water-candidate
chance; protection conflicts may suppress it further. There are still at most twelve attempts and
one accepted water system per district. The same seed, complete frozen constraints, and signed
coordinate query reproduce the same geometry regardless of query overlap or record order.

`npm run forest:terrain-preview` now also writes
`tmp/forest-owner-terrain-preview-water-detail.svg` and `.png`. The overview legend distinguishes
blue water, tan bridges, gray boulders, gold protection rings, and dashed access reservations.
The close-up labels sources, feeders, flow, the crossing, and the receiving pond. These remain
schematic renderings. Focused geometry checks now also cover feeder junctions, continuous pond
entry, source/pond collision, and complete bank containment inside dry district boundaries.
The earlier access caveat remains: new-terrain clearance is proven for fixtures, but collision-aware
approaches around established tree/marker bodies and live scene walking remain outstanding.


### Water scale variation — November 6

Visual feedback asked for less uniform water formations. Proof identity `terrain-proof-3` selects
channel length and pond size independently, with channel longitudinal extent ranging from 440 to
1,380 units before winding, and pond scale varying from 0.35 to 1.95 times its seed-derived axes.
Actual centerline distance is longer where the channel meanders. The extrema are generation bounds,
not a promise that every protected district can accommodate every combination.

The complete water outline is fitted within its home district before protection checks. This
avoids rejecting a long reach or large pond merely because an arbitrary initial center is near a
district edge. Geometry that cannot fit or conflicts with protections is still rejected; it is
never clipped, silently shrunk, or allowed to cross reserved access lanes. Size selection remains
fixed across candidate placement attempts. Pond inlet offset scales with its long axis so even
small ponds retain continuous channel entry. Crossing selection additionally rejects water systems
that flood its walking approaches, including interference from a large nearby receiving pond.

The preview command also produces `tmp/forest-owner-terrain-preview-water-variation.svg` and `.png`:
four examples at the same scale highlighting short/long streams and small/large ponds. Focused
checks verify substantial length and pond-area variation among accepted protected fixtures, plus
continued water connectivity and crossing clearance. This changes only the development prototype;
production activation and the previously recorded live-walking work remain outstanding.

### Live integration foundation — November 7

Added an optional terrain preparation descriptor to owner worlds and a dedicated frozen-protection
collection. Existing worlds acquire no descriptor by default; tree ecology, placement identities,
and existing marker formats are unchanged. Protection records contain only owner/world/operation
scope, opaque source identity, position, clearance radius, and derived district coordinates.
Unique owner/world/activation/source and owner-first district indexes support resumable preparation
and bounded local reads. Account-deletion cleanup drains these records before completing cleanup.

`forestOwnerTerrainActivation.js` currently implements **preparation only**. Its internal operation
supports `start`, bounded `step` (at most 100 source records per transaction), and bounded `cancel`.
New preparation requires the literal `FOREST_LIVE_TERRAIN_ENABLED=true`; no public endpoint, automatic
page-load invocation, or production activation command has been added. The phases capture all tree
placements, including hidden/inactive trees, and retained ordinary/linked marker placements,
including tombstones. Entrance protection is captured once. Each page, its protections, and its
cursor commit together under the existing owner ledger fence. A repeated start resumes the same
operation. Cancelling can drain a partial set with the gate off and restores the descriptor-free
surface only after that set is removed.

New writing-tree allocation and marker create/move placement inspection reject preparing/cancelling
terrain under their existing transactional authority. This fences coordinate-changing writes while
the multi-page capture runs. Read-only use remains on the old surface; existing-object recovery
paths precede placement inspection. Removal and other changes that only reduce occupied content do
not require moving captured geometry. Source-format/coordinate errors, deletion, and unsupported
terrain versions fail closed rather than dropping protections. Activated-terrain placement queries
are also connected to these server placement paths, but there is no supported publication path yet.

`forestOwnerTerrain.js` reconstructs terrain from frozen constraints using a bounded, owner/world/
activation-scoped district query, including neighboring districts whose footprints can intersect.
It rejects overflow, invalid district evidence, unsupported descriptors, and unavailable worlds.
This internal read is not yet exposed as a regional API. Its current 512-record query bound remains
a local-density constraint to measure before live activation, not a lifetime forest limit.

Publication is deliberately blocked at the collected `ready` phase. The remaining integration must
validate collected geometry/access, deliver versioned terrain regions to the browser, render and
collide against that terrain, reject stale placement intents appropriately, and use terrain-aware
entrance/return spawns. Only then may a final owner-fenced publication make the descriptor active.
Do not enable preparation for ordinary accounts while this integration is unfinished: it pauses
new spatial placement until cancellation. No database fixture or preparation operation was run as
part of this code increment; current persistence evidence is dependency-injected service tests,
not a real MongoDB transaction/index certification.


### Live scene connection — November 7

The current implementation now completes the previously blocked publication path. Preparation
advances through trees, markers, and a verification phase before an explicit `publish` operation.
Each verification transaction certifies one protected place using a bounded 8-unit clearance grid
(at most 20,000 positions) near its reserved access spur. It includes existing tree bodies, checks
movement segments, and requires a usable approach to the connected dry boundary. Markers remain
non-solid, matching the established player movement policy. The entrance itself must also be clear.
This is activation-time validation, not a runtime pathfinding system. Failure leaves preparation
unpublished and cancellable. Final publication uses the same transactional owner fence.

Activated worlds use bootstrap version 4 with a private terrain token and regional API path;
terrain-free worlds retain version 3. `GET /api/v1/forest/terrain-regions` accepts one through nine
exact signed district ids and the current token. It rechecks the authenticated owner world and
returns bounded generated districts only: no frozen source keys, writing metadata, or world seed.
Responses are private/no-store with Cookie variance. Invalid requests, changed terrain, oversized
local data, or unsupported versions never become empty terrain. JSON transport is bounded at
256,000 bytes. The browser validates geometry and retains at most 25 terrain districts.

The owner scene now paints water/banks and boulders, reuses the registered rustic timber bridge
model, raises the player along its bridge profile, and interleaves rocks/rails with actor depth.
Water glints respect reduced motion. Walking and marker previews use the delivered geometry;
unknown/unloaded terrain blocks movement and placement until it loads. Server placement uses the
same generator and frozen constraints. Tree allocation reuses district reads within its transaction.
Tree and marker return destinations include terrain clearance, and the browser's final tree-arrival
check applies that same surface rule. The semantic writing path remains available independently.

New marker create/move requests in activated worlds use mutation protocol 3 with `terrainToken`;
optional writing links retain schema/fingerprint 2, and ordinary markers retain schema/fingerprint 1.
Protocols 1 and 2 keep their exact request shapes and recover equal committed requests before terrain
context checks. Fresh placement under an old/mismatched token requires reload. Terrain tokens are
context, not creation identity, so activation cannot turn a lost-response retry into a new object.
Removal remains possible through its existing protocol. No marker or tree is rewritten at activation.

The [development walkthrough](../testing/forest-live-terrain-walkthrough.md) documents activation by
username, resumable progress/cancellation, the acceptance loop, and the guarded database/browser
fixtures. No ordinary development account or production world was activated during implementation.
The actual MongoDB fixture exercised only its reserved test owner and cleaned up afterward. Firefox
coverage exercised the real route/template and browser modules at 1280px and 390px, alongside prior
marker/read/return regressions. Physical-touch review and real-account visual acceptance remain open.

### Shared terrain presentation — November 7

Presentation version 2 replaces the initial simple live painter with the experimental map's
established pixel treatments. `forest-terrain-paint.js` now supplies bank details, bank marks,
stepped current marks, and boulders to both renderers. The live presentation adapter uses the
original bank model along arbitrary channel directions and closed pond/source shorelines, retaining
its soil strata, grass, roots, stones, and logs within the existing reserved dry-bank margin.
Original rock variants and weighted palettes supply boulder appearance without moving their anchors
or changing collision radii.

Water retains the authoritative footprint. Shallow-edge effects follow only the exterior of the
combined water polygons, avoiding seams at channel/pond joins. Six-frame-per-second pixel currents
follow downstream tangents and taper into ponds; reduced motion freezes their frame while retaining
static texture. Presentation models are cached with their terrain entries, and small bank details
are culled to the viewport. Both paths share painters, rather than maintaining separate copies of
the experimental style.

This pass changes no terrain generation, protections, activation descriptors, placement rules, or
return destinations. Existing activated worlds need only a reload. Further water-shape variation
and automatic activation rollout remain separate work. The browser fixture includes an optional
side-by-side material comparison, alongside the live-route acceptance loop. Validation completed
with 1,442 Jasmine specs passing, lint passing, and Firefox walkthroughs at 1280px and 390px.
