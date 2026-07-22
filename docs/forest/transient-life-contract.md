# Activity Forest Transient-Life Contract

## Milestone 9 Pass 1 scope

This contract owns disposable, page-lifetime actors that make the forest feel inhabited without
adding rewards, tasks, persistence, or a generalized agent system. Pass 1 proves the boundary with
one small bird family. It deliberately does not yet include branch hops, ground foraging, player
startle, flock staggering, or the visiting hiker; those remain the next staged slices.

The pure browser boundary is `public/js/forest-transient-life.js`. Version **1** supports only the
actor states `perched` and `flight`, actor schema version **1**, three code-owned palette variants,
and a maximum cast of four birds. At most one bird may be in autonomous flight at once. Each bird
has a stable id, visual variant, anchor selector, and route of no more than three distinct tree
placement ids. Its behavior record separately owns the current state, route index, bounded timer,
transition count, and optional flight points.

The scene seed reproduces the initial cast, variants, tree routes, and anchor choices. The page owns
the clock: reload restarts the transient scene and its quiet intervals. No actor record is written
to local storage, a production database, the personal overlay, generated-base identity,
discoveries, inventory, materials, construction state, writing fixtures, tree semantic projection,
or tree cache identity beyond the separately versioned perch geometry described below. Camera,
viewport, asset request order, frame rate, post metrics, room identity, and mutable activity do not
select actor identity or ecological suitability.

## Honest perch geometry

Runtime tree assets previously exposed no usable branch geometry. Tree-asset schema version **3**
therefore adds `perchAnchors`, while renderer version **4** remains unchanged because tree pixels did
not change. The schema bump also changes every asset cache key. Both color-run and lossless-raster
transports retain the same anchor metadata.

The generator derives at most five anchors from real lateral branch segments. A candidate must be
above the lower trunk, have a minimum branch radius and horizontal run, and meet a bounded slope.
Anchors too close to an earlier candidate are removed. Each transported anchor contains exactly:

```text
id, x, y, depth, layer
```

Coordinates are asset-relative integer pixels at the branch contact point. Depth is bounded
generation evidence used only to choose `behind-wood` or `front-of-wood`. The browser validates this
narrow shape and never receives nodes, segments, attraction points, foliage internals, masks, or
generation diagnostics. Tests additionally verify every derived anchor meets a painted wood pixel.

Perched birds are drawn through two explicit tree-rendering hooks: after rear foliage but before
wood for `behind-wood`, or after wood but before front foliage for `front-of-wood`. Front foliage may
therefore occlude either bird. A bird with an unloaded or invalid asset is not drawn in empty space;
it remains at its stable route index and records bounded destination exhaustion rather than choosing
a request-order-dependent replacement.

## Simulation, projection, and lifecycle

The ambient render loop advances all actors together. It uses a 50 ms fixed step and performs no
more than four catch-up steps per rendered frame, so a slow frame cannot create an unbounded update
loop. A flight lasts 1.6–3.2 seconds according to bounded source-to-destination distance and
interpolates explicit perch points in world/3D coordinates with a 34-pixel sinusoidal altitude arc.
Routes choose the two nearest stable suitable placements rather than crossing the forest according
to asset or request order. Perched intervals begin at 6.5–12
seconds and later remain within 9–17.5 seconds. A route has at most three trees, so destination
selection always terminates and does not immediately reverse between only two trees in the normal
proof cast.

Actors outside the 160-pixel simulation margin do not advance. Flight rendering joins ordinary
ground-depth ordering; perched rendering uses the narrower tree-layer hooks. Birds are non-solid,
never enter focus selection, and cannot open a prompt or dialog. Pass 2 still needs visual review
and refinement around bank, bridge-deck, and rail occlusion before that integration is accepted as
final.

When the page is hidden, transient updates stop and no hidden elapsed time is reconciled on resume.
With `prefers-reduced-motion`, state transitions and wing animation stop. The still presentation is
limited to the first two cast members; an already airborne bird freezes at its current point rather
than repeatedly teleporting. Interaction with trees, discoveries, objects, editors, dialogs,
keyboard movement, and touch movement remains unchanged.

## Diagnostics and measured boundary

Development diagnostics report total birds, perched and flying counts, autonomous and
player-startled transition counts, destination-selection exhaustion, reduced-motion suppression,
and transient update duration separately from total rendering. The player-startled count remains
zero until the Pass 2 ground-flock slice.

On Node 24, the representative `first-regions` pure-update harness completed 100,000 calls in
696.35 ms, or **0.006963 ms per call**, with four actors and the production 60-placement scene. This
is a bounded implementation measurement, not a browser frame-time claim. The first cast resolved
all twelve route assets to five genuine anchors each when those assets were prepared. Browser
render duration, pixel scale, silhouettes, motion cadence, themes, and bridge/stream occlusion still
require the Pass 1 human visual checkpoint.

This boundary is intentionally not an NPC framework, behavior tree, ecology simulation, navmesh,
or persistence model. Adding the visiting hiker must reuse the ownership/update/render separation
without generalizing it prematurely.
