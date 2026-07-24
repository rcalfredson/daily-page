# Activity Forest Transient-Life Contract

## Milestone 9 Pass 3 checkpoint

This contract owns disposable, page-lifetime actors that make the forest feel inhabited without
adding rewards, tasks, persistence, or a generalized agent system. Pass 1 proves the boundary with
one small bird family. Pass 2 adds genuine branch hops, one ground-foraging pair, player startle,
and a bounded return lifecycle. Pass 3 adds one original older visiting hiker and a compact,
non-consequential conversation.

The pure browser boundary is `public/js/forest-transient-life.js`. Version **3** supports the bird
states `perched`, `branch-hop`, `ground-forage`, `ground-wander`, and `flight`, actor schema version
**2**, three
code-owned palette variants, and a maximum cast of four birds. Two begin in trees and two form the
only ground group. At most one autonomous bird movement may begin at once; the paired player-startle
response may put both ground birds in flight as one bounded flock. Each bird has a stable id, visual
variant, anchor selector, optional group id, and route of no more than three distinct tree placement
ids. Its behavior record separately owns current state, route and anchor indices, bounded timers,
hop count, transition count, optional ground contact, and optional motion points.
Ground actors additionally retain a capped retreat-attempt count used only while resolving a
temporarily unavailable perch asset.

The same boundary owns one visitor record with visitor schema version **1**. The visitor is not part
of the bird actor array: her stable identity, two-point local route, disposable position, rest/walk
state, humanoid motion, and page-lifetime conversation completion remain a separate discriminated
record. `public/js/forest-humanoid.js` presentation version **3** is shared by the player and visitor.
It projects a continuously eased world-facing angle into a pixel silhouette and derives planted-foot
walking and capped running cadence from actual travel rather than key-down time.

The scene seed reproduces the initial cast, variants, tree routes, and anchor choices. The page owns
the clock: reload restarts the transient scene and its quiet intervals. No actor record is written
to local storage, a production database, the personal overlay, generated-base identity,
discoveries, inventory, materials, construction state, writing fixtures, tree semantic projection,
or tree cache identity beyond the separately versioned perch geometry described below. Camera,
viewport, asset request order, frame rate, post metrics, room identity, and mutable activity do not
select actor identity or ecological suitability. A changed personal overlay may veto a ground
candidate as an authored obstacle, but it does not alter bird identity or candidate order.

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

Branch hops use two distinct anchors from that same validated list. They last 420 ms, rise only six
pixels, and remain inside the tree's rear/wood/front hooks rather than becoming free canvas motion.
A bird makes no more than two hops before its next tree-to-tree flight. Roughly one-third of stable
bird identities initially favor the anchor farthest from the trunk, providing occasional readable
silhouettes without outlines or painting birds above foliage. Other perches retain the naturally
heavy canopy occlusion accepted at the Pass 1 checkpoint.

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

One deterministic ground-group candidate is selected from at most 48 attempts, 170–420 pixels from
the entrance. Its complete footprint must be in world bounds, on dry land beyond the stream bank,
outside every bridge deck and approach, clear of tree collision, terrain features, and authored
objects. Ground birds remain non-solid. Their feet use ordinary ground-Y depth order. Each receives
a stable identity-derived forage period, phase, and optional second peck, avoiding synchronized
head movement without introducing randomness from frame timing; they never enter focus selection.

While calm, each bird independently alternates foraging with an 8–30-pixel walk while its flock mate
continues pecking. The browser injects one random 32-bit page-session seed, and a bounded transient
PRNG is consumed only when a wander decision is due. The path therefore differs between page
sessions without depending on frame rate, camera position, asset requests, or post identity. A walk
may vary the pair's separation from 14 to 64 pixels, must pass the complete ground-suitability query,
and begins from that bird's current position. There is no home-point tether: over successive valid
steps the loose flock can gradually traverse connected dry ground. Only one bird walks at a time,
and at most eight candidates are tried; exhaustion leaves it safely in place. The group's live center
follows both birds. A player startle interrupts a walk from its current projected point rather than
waiting for a deterministic route to finish.

The group initially stays calm if a player is already near it. It arms only after the player is
more than 142 pixels away, then reacts at 88 pixels. Its two stable delays differ by 180 ms, producing
a legible stagger instead of one rigid sprite. At the startle, each bird selects the nearest suitable
tree from its current position, preferring distinct destinations for the pair; this uses placement
data rather than asset-load or camera order. The birds create no reward, loss, achievement, prompt,
damage, or inventory change. After both have rested for 26
seconds and the player has moved beyond the reset radius, they return to the same valid ground point
one at a time. This makes repeated startling deliberately inefficient while avoiding permanent
ecosystem loss.

If a selected retreat perch is temporarily unavailable, a ground bird tries the next member of its
three-tree route up to four times, with bounded 0.5, 1, and 2-second backoff between retries. Four
failures exhaust the retreat. If
its flock mate already reached a tree, that bird returns to the ground; if neither departed, the
group simply becomes calm again. Thus missing regional assets cannot create per-step retry churn or
strand a split flock indefinitely.

Actors outside the 160-pixel simulation margin do not advance. Flight rendering joins ordinary
ground-depth ordering; perched rendering uses the narrower tree-layer hooks. Bridge rails normally
occlude a low bird, while a flight whose altitude clears a bridge crown and rail allowance is drawn
after those rails. Ground selection forbids banks and bridges, and ordinary elevated flights remain
above the ground-painted stream and projected bank surfaces. Birds are non-solid, never enter focus
selection, and cannot open a prompt or dialog.

When the page is hidden, transient updates stop and no hidden elapsed time is reconciled on resume.
With `prefers-reduced-motion`, state transitions and wing animation stop. The still presentation is
limited to the first two tree-perched cast members; ground foraging, branch hops, flock launch, and
wing animation are suppressed. An already airborne bird freezes at its current point rather than
repeatedly teleporting. Interaction with trees, discoveries, objects, editors, dialogs,
keyboard movement, and touch movement remains unchanged.

## One quiet wayfarer

Tansy Rook is an original fictional older traveler rather than a depiction of any historical hiker.
She wears patched moss and bark colors, gray hair, a pointed weathered hood, and carries a walking
staff. A bounded selector first tries dry ground near a bridge approach and otherwise tries points
210–440 pixels from the entrance. Both endpoints of her 34-pixel local route must pass the same dry,
bounded, bridge-, tree-, terrain-, and authored-object-clear suitability query used by ground life.
She is also kept clear of the initial ground flock.

Tansy rests for 12–22 seconds and occasionally walks her route at 32 pixels per second. She is
non-solid and joins ordinary ground-Y depth ordering. Simulation stops outside the existing margin,
while dialogs, the forest menu, and clearing or trail editors pause her locally. Reduced motion
preserves her current position as a stable resting presentation. Her restrained idle lift is purely
visual and stops with ambient motion.

At 58 pixels she enters the existing nearest-focus competition and uses the same E/Enter and touch
prompt as other interactions. Her dialog has five bounded nodes and two reply moments. Each offers
two short responses, then immediately reconverges on the same next topic; this small braided shape
is code-owned conversation copy, not a generalized choice graph. It has no quest, schedule, gift,
reward, inventory effect, relationship state, or database write. Conversation completion is a
page-lifetime boolean used only to replace repeats with one farewell observation. Both endings lead
into her eccentric hymn to “Good Gourd, the Pumpkin Lord”; neither produces a lore ledger or
gameplay effect.
She remains quietly present after the conversation.

## Diagnostics and measured boundary

Development diagnostics report total birds, counts for all five bird states, branch hops,
autonomous and player-startled transitions, visitor state and transitions, ground-group lifecycle,
destination-selection exhaustion, reduced-motion suppression, and transient update duration
separately from total rendering.

On Node 24.15.0, the final Pass 3 `first-regions` harness ran five all-actors-active samples of
100,000 update calls against the production 60-placement scene. The sorted samples were 1,249.62,
1,276.15, 1,308.82, 1,603.93, and 2,285.63 ms. The median was **1,308.82 ms**, or **0.013088 ms per
call**, with four birds, one visitor, and no viewport culling. This is a deliberately stricter bounded
implementation measurement, not a browser frame-time claim. The ground point resolved on the first
bounded attempt at `(1699, 1698)`; focused evidence covers staggered retreat, bounded unavailable
perches, return recovery, free wandering, visitor selection, walk/rest transitions, dialog pausing,
focus, conversation completion, reduced-motion suppression, and bridge/stream depth classification.
Human review accepted the bird presentation and the shared continuously oriented humanoid scale,
gait, palette, and silhouette before the visitor reused that boundary.

This boundary is intentionally not an NPC framework, behavior tree, ecology simulation, navmesh,
or persistence model. The visitor reuses the ownership/update/render separation without introducing
an extensible agent framework, real-user presence, schedules, needs, or persistence.
