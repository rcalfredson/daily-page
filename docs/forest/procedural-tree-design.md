# Activity Forest: Product Vision and Procedural Tree Design

## Purpose

Activity Forest is a long-term direction for making Daily Page feel like a small virtual home rather than only a collection of documents. A user's writing activity becomes a persistent, explorable forest:

- Each post is represented by a tree.
- A tree's stable appearance is derived deterministically from the post and its activity.
- Hovering or focusing a tree identifies its post.
- Selecting a tree opens a closer view with a route back to the post.
- Other contribution types may eventually create flowers, animals, paths, structures, and other features of the surrounding landscape.
- The forest may reflect the current real-world season, while a tree retains visual evidence of the season in which its post was created.

The emotional goal is not an activity dashboard wearing a game skin. It is a calm, persistent place that makes accumulated writing feel alive. The system should celebrate contribution without punishing absence; inactivity must not damage a user's forest.

The product north star is:

> **The Activity Forest is a living memory garden for a person's writing—not a game that happens to reward writing.**

This distinction leaves room for exploration, resources, construction, discovery, and social interaction while keeping writing at the center of Daily Page. The forest should make a person's accumulated work feel inhabitable: somewhere they can recognize, revisit, tend, and gradually make their own.

This is a living design document. It records the current Forest Lab architecture, the procedural tree work, and the larger product direction that the renderer is intended to serve.

## Participation model

The forest should support three depths of participation without dividing users into superior and inferior experiences.

### 1. Ambient

Writing naturally grows a beautiful place. A user may never manage or customize anything and should still receive a complete, emotionally satisfying forest. This is the default promise of the feature, not a tutorial stage that must be outgrown.

### 2. Curatorial

Users may organize and interpret the place that has grown around their writing. They might:

- Lay paths between related posts.
- Create clearings for themes, projects, rooms, or periods of life.
- Mark favorite trees or meaningful milestones.
- Add benches, lanterns, signs, gates, bridges, and reading nooks.
- Attach a quotation, note, or later reflection to a tree.

At this depth, the forest becomes a personal map of the user's writing rather than merely a gallery of generated objects.

### 3. Playful

Users who want a more game-like relationship may gather renewable materials, discover visitors or artifacts, construct small features, exchange gifts, and participate in seasonal or communal activities. These interactions should enrich the forest and lead back toward writing, memory, expression, or connection. They must never become chores required to preserve what the user has already grown.

A person should be able to remain entirely at the ambient depth without possessing a neglected, incomplete, or mechanically disadvantaged forest.

## Core experience loop

The intended loop is richer than exchanging activity for rewards:

```text
write → the forest changes
      → explore and rediscover writing
      → tend or personalize the place
      → encounter reasons to write again
```

The return path to writing is essential. The forest should not merely represent posts; it should help people re-encounter them. Selecting an older tree might reveal an excerpt, its conversation and collaborations, the room in which it grew, or a small record of what was happening around it. A path through the forest can therefore become a path through a person's intellectual and creative life.

## Activities within the forest

Promising interactions include:

- Wander or follow paths through a spatial history of one's writing.
- Select a tree to identify its post, read an excerpt, or return to the full page.
- Connect related trees with paths or collect them into named clearings.
- Place small structures such as benches, lanterns, bridges, signposts, gates, and birdhouses.
- Pin a quotation, memory, or retrospective note to a tree.
- Gather fruit, seeds, petals, stones, feathers, or fallen branches produced by the forest.
- Plant or designate commemorative trees for personal and community milestones.
- Attract birds, insects, and other wildlife through the character and habitats of the landscape.
- Invite another user into a clearing, exchange seeds or cuttings, or leave a restrained gift.
- Form shared spaces around collaborations, quests, rooms, or community events.
- Take a wandering route that deliberately resurfaces older or forgotten writing.

These ideas should be tested first as small, legible interactions. The Activity Forest does not need free-form world simulation, character survival, farming schedules, or a large tool inventory to feel alive.

## Resources and economy

A forest economy should primarily be an **economy of expression**, not an economy of access or power.

Suitable uses for resources include:

- Landscape customization and small structures.
- Wildlife habitats and seasonal ornaments.
- Gifts and seed or cutting exchanges.
- Collaborative clearings and community projects.
- New ways to arrange or present collections of writing.
- Rare but non-exclusive aesthetic discoveries.

Renewable or naturally fallen materials fit the emotional character of the forest better than destructive extraction. Fruit, seeds, flowers, fallen leaves, stones, feathers, and shed branches imply that the place has offered something. A user's writing should not feel like timber to be consumed.

Forest resources should not be required for publishing, commenting, visibility, moderation authority, or essential writing tools. Word count and repetitive activity should not convert directly into power. Otherwise the feature would encourage performative activity and distort the behavior it is meant to celebrate.

A useful design test is:

> **Would this interaction still feel worthwhile if there were no currency counter?**

If so, resources may deepen it. If not, it is likely a reward treadmill rather than part of the forest's emotional life.

## Sustainability boundary

The forest's future revenue model should preserve the same moral shape as its resource economy: payment may expand private space, continuity, and hosted convenience, but should not buy public status, creative dignity, or mechanical power.

A promising boundary is:

```text
Free:
public writing grows a meaningful public Activity Forest

Paid:
private writing grows private Activity Forest spaces
```

This makes the paid value a natural inward extension of the same product idea rather than a superior version of the public experience. Public writing remains complete, beautiful, and worth tending. Paid private forests support more personal writing, private organization, hosted infrastructure, backups, long-term continuity, and privacy expectations.

The guiding principle is:

> **Paid privacy, not paid dignity.**

Everyone should receive the core magic of seeing writing become a place. Payment should buy private terrain on the hosted service, not better trees, stronger resources, higher visibility, moderation influence, or a privileged public identity.

The broader product and open-source implications of this model are tracked in `docs/product/sustainability-and-open-source.md`.

## Product guardrails

- No punishment, damage, or irreversible loss caused by absence.
- No decay that requires recurring chores.
- No streak pressure or daily maintenance obligation.
- No single optimal forest layout or growth strategy.
- No direct conversion of raw word count into status or power.
- No competition over forest size as the dominant social signal.
- No gating of core writing and community functions behind forest resources.
- No requirement to customize or play in order to receive a complete forest.
- Every active mechanic should strengthen writing, memory, expression, discovery, or human connection.
- The forest should remain calm, legible, and satisfying when entirely untouched.

## Product development stages

The forest can grow in layers while preserving the value of every earlier layer.

These stages describe layers of player experience, not release phases or calendar commitments. The
evidence-gated path from development experiments through a production owner loop, constructive
sandbox proof, connected public alpha, and private-world pilot is defined in
`docs/forest/activity-forest-long-term-gameplay-vision.md`.

### Stage A: A living record

- Generate one stable tree for each post.
- Compose trees into a deterministic, explorable landscape.
- Support hover, focus, selection, excerpts, and navigation back to writing.
- Establish a forest that is beautiful and meaningful without interaction beyond exploration.

### Stage B: A place made one's own

- Add paths, clearings, favorites, signs, and small structures.
- Let users create spatial relationships among pieces of writing.
- Add restrained annotations and retrospective reflections.
- Test how manual arrangement coexists with deterministic generation.

### Stage C: A gently playful habitat

- Introduce renewable materials, wildlife, gifts, seasonal discoveries, and small construction choices.
- Explore shared or collaborative clearings.
- Favor asynchronous, non-competitive social presence.
- Evaluate every mechanic against the product guardrails before expanding it.

This staging lets Daily Page first learn whether the forest succeeds as memory and place. A larger economy or game system should emerge only from interactions users already find meaningful.

## Implementation history and current status

The work remains a development feature in Forest Lab rather than a production Activity Forest.

Renderer v2 established the original deterministic visual grammar and is preserved in Git history as a retired prototype. Renderer v3 is now the sole active renderer and has a convincing pilot deciduous phenotype with:

- Deterministic three-dimensional, space-colonization-inspired branch growth projected into two dimensions.
- Persistent trunk and branch hierarchy with bounded growth and explicit termination.
- Seed-derived specimen architecture with bounded branch-start height, trunk-base thickness, trunk-taper, trunk-lean, major-fork, and competing-leader balance variation.
- Split specimens retain two persistent leaders while a seed-derived balance trait modestly biases leader vigor, scaffold support, attraction-point competition, crown occupancy, and resulting pipe-model weight.
- Back-propagated branch thickness, trunk taper, root flare, and leafless wood rasterization.
- Depth-aware individual foliage attached to eligible branch growth.
- Coverage repair that preserves negative space without producing detached canopy masses.
- Deterministic weighted foliage palettes, with a common signature colorway and rarer whole-tree
  variants registered independently by each phenotype.
- Debug views for the branch graph and leafless wood alongside the final grown tree.
- Automated coverage for determinism, graph validity, bounds, termination, hierarchy, rasterization, and foliage behavior.

The initial graph, wood, and foliage milestones should therefore be treated as the established renderer foundation, not as unstarted work. The remaining sections retain the original design rationale because it explains the architecture and its invariants.

The recommended near-term technical sequence is:

1. Establish the versioned runtime tree-asset boundary described below.
2. Build a genuinely distinct second phenotype against the shared asset contract. (Complete:
   the broad, warm-colored sunset lanternwood now contrasts with the pilot open-crown deciduous.)
3. Begin deterministic forest composition and basic exploration.
4. Add shared ambient motion once a representative multi-tree scene exists.

### Generation results and runtime tree assets

The procedural generation result is an authoring and diagnostic object. It retains the mutable inputs and derived architecture, three-dimensional branch graph, attraction points, termination diagnostics, foliage shoots and leaves, logical masks, shaded pixel grids, and compact color runs. Forest Lab needs this complete result to explain why a specimen has its shape, but a game-facing renderer does not.

The runtime tree asset is a phenotype-independent, JSON-serializable projection built after generation. Schema version 2 contains:

- asset schema version; renderer id and version; phenotype id and asset version
- deterministic seed and the derived visual cache key
- logical width and height, ground anchor, and occupied visual bounds
- ordered `rear-foliage`, `wood`, and `front-foliage` layers; each foliage layer contains up to
  three branch-associated motion groups with horizontal color runs, an attachment point, and a
  bounded wind-response description
- limited architectural identity and maximum branch order for inspection and later composition

It deliberately excludes masks, full pixel grids, nodes, segments, attraction points, diagnostics,
leaves, shoots, and coverage cells. JSON stringify/parse is the serialization boundary: consumers
render the parsed asset without procedural growth. The groups preserve only the minimal runtime
information needed to move related foliage together; procedural branch and leaf data do not cross
the asset boundary. Their attachment points leave room for a later model to test rotation or
deformation without committing this experiment to those techniques.

### Identity, caching, and invalidation

The visual cache key is composed from the tree-asset schema version, stable renderer id/version, stable phenotype id/asset version, and unsigned deterministic seed. Post identity is used only to derive the default seed and is not retained as a separate cache dimension. Explicit seeds therefore behave identically regardless of post id.

Any output-affecting renderer change must increment the renderer version. Any output-affecting phenotype change must increment that phenotype's asset version. Contract changes increment the asset schema version. Changing any component produces a different key. Custom phenotype overrides are not cacheable merely because they were spread from a named phenotype: callers must provide a deliberate stable id/version.

Forest Lab owns a narrow process-local in-memory cache of complete generation results plus their projected assets. Its lifetime is the development server process/module lifetime, and it is invalidated by restart or the versioned key. This lets the Lab preserve graph diagnostics while proving that finished and leafless canvases consume only reusable assets. It is not production persistence or a proposed game cache.

### Files

- `server/services/forestTreeGeneratorV3.js`: experimental v3 orchestration.
- `server/services/forest/v3/architecture.js`: deterministic per-tree architectural traits.
- `server/services/forest/v3/phenotype.js`: registered deciduous and lanternwood phenotypes and
  their distinct growth, architecture, foliage, and palette tendencies.
- `server/services/forest/v3/growth.js`: deterministic three-dimensional branch growth.
- `server/services/forest/v3/rasterizeWood.js`: tapered wood, root flare, and bark rendering.
- `server/services/forest/v3/rasterizeFoliage.js`: leaf-bearing shoots, foliage coverage, depth, and rasterization.
- `server/services/forest/v3/graphDiagnostics.js`: graph analysis and structural diagnostics.
- `spec/forestTreeGeneratorV3Spec.js`: v3 graph, wood, foliage, and determinism tests.
- `server/routes/devViews.js`: 24 fixture posts and the development-only Forest Lab route.
- `views/dev/forest-lab.pug`: gallery and accessible tree-detail dialog.
- `public/js/forest-lab.js`: dialog behavior.
- `public/css/forest-lab.css`: responsive gallery and scene presentation.

The lab is available in development at `/__dev/views/forest-lab`.

## First static multi-tree composition

The first composed development scene is available at `/__dev/views/activity-forest`. It turns
the isolated runtime assets into a deterministic 3000 × 1800 world containing 180 placements.
The scene now includes the first fixture-only exploration loop: a deterministic player can walk
the corridor, approach a tree, inspect fixture writing, close it, and continue from the same place.
It also includes the first shared ambient wind slice and a development-only personal-overlay proof.
It remains a development preview without production persistence or real post queries.

`forestSceneLayout.js` owns scene layout version 1. A placement contains only a stable placement
id, world-space ground anchor, integer scale, phenotype id, specimen seed, and versioned asset
key. Layout randomness is derived independently for X, Y, phenotype, specimen, and scale from
the scene seed and candidate index. Rejection sampling enforces trunk spacing and reserves a
winding central corridor; camera position is never an input to layout or tree identity.

The representative scene uses a bounded pool of eight specimens for each registered phenotype;
pressure profiles can deliberately select broader pools. Its process-local cache is separate from
Forest Lab's diagnostic cache and retains runtime assets only. The asset's schema, renderer,
phenotype, and seed identities form the invalidation key. The browser receives the complete compact
placement manifest, but only nearby JSON-round-tripped runtime assets. Many placements can point to
each asset; generation results and branch diagnostics never cross the scene boundary. The cache
lives only for the server module/process lifetime and is not production persistence.

The browser draws the prepared scene into one visible Canvas. As each runtime asset arrives, wood
and each foliage motion group are prepared once as small offscreen surfaces. Placements reuse those
surfaces, reducing ordinary scene draws from thousands of color-run operations per tree to at most
seven `drawImage` calls per visible tree: three rear groups, static wood, and three front groups.
These surfaces are per asset, never per placement, and are discarded with the page.
Browser-independent math derives each scaled visual rectangle from the asset bounds and ground
anchor, culls it against the camera, and orders visible placements by ground Y with stable id
tie-breaking. Integer scaling and disabled image smoothing preserve crisp pixels. Keyboard,
resize, and reset events request coalesced frames. The exploration version replaces direct camera
navigation with a clamped camera
following a player whose small explicit state has a deterministic, collision-free corridor spawn.
Arrow-key and WASD movement is normalized and elapsed-time based. Touch and stylus input uses a
floating analog joystick whose origin is the initial contact point. A small dead zone prevents
drift; displacement beyond it scales continuously from slow movement to full walking speed at a
fixed outer distance. Direction remains normalized independently of intensity. Release,
cancellation, blur, or inspection stops movement.

During clearing-object or trail placement, maximum gesture displacement classifies the gesture at
release: a deliberate tap may commit, while any drag beyond the same dead zone remains movement and
never commits an edit. On touch, both new and existing clearing objects use a carrying treatment:
the preview follows ahead of the player, and a later tap or the explicit action confirms that
current preview rather than teleporting it to the tap. An existing object's saved rendering is
temporarily suppressed until commit or cancellation; canceling restores the unchanged saved object.
Mouse input retains direct cursor preview and click placement. This prevents the first joystick
touch after choosing **Move** from relocating an object and keeps the visual coupling between avatar
and object semantically consistent. Both input paths resolve movement independently on X and Y
against scaled circular trunk obstacles, allowing sliding while leaving canopies non-solid.

The player participates in stable ground-Y ordering. A pure proximity query selects the nearest
in-range placement with stable id tie-breaking. Deterministic placement-to-fixture assignment is
independent of tree asset identity, and only bounded title, room, date, and excerpt metadata crosses
the runtime boundary. A native modal inspection dialog stops movement and returns focus without
changing the player or camera location.

Active movement frames perform movement math, region-set comparison, culling, ordering, and bitmap
draws, then cease when input stops. Procedural generation, response decoding, and color-run replay
remain outside the animation frame. The render-duration diagnostic remains the local measurement
point, with no universal benchmark claim for this interaction slice.

### Inhabitable-world contract: generated base and personal overlay

The inhabitable-world work began with a small clearing marker. Milestone 2 adds one deliberately
narrow editable-trail item, a stepping stone. Together they prove that the state boundary supports a
reversible spatial edit without beginning general construction, inventory, crafting, or an entity
system.

Every generated layout now includes a `baseIdentity` with exactly four fields:
`schemaVersion`, `sceneVersion`, `seed`, and `layoutKey`. The bounded `layoutKey` fingerprints the
world dimensions and other placement-affecting configuration, so development pressure profiles do
not accidentally share overlays. Regenerating with the same explicit versions, seed, and
configuration reproduces that identity and the existing tree placement ids, coordinates, specimen
seeds, and asset keys. The base identity is not an asset identity and does not incorporate camera state,
personal choices, or transient animation state.

The separately serialized personal overlay has exactly these top-level fields:

```text
schemaVersion, id, baseIdentity, revision, objects
```

An overlay is accepted only for the base identity it names. Its object collection is capped at 32
records. A marker record has exactly:

```text
schemaVersion, id, type="marker", worldX, worldY
```

Ids follow bounded, versioned string patterns; coordinates are bounded safe integers; unknown
fields and unknown object types are rejected. Moving the representative marker replaces its record
at the same stable id and increments the overlay revision. The record deliberately has no arbitrary
metadata, behavior, asset payload, post data, or serialized generated-world fields.

### Milestone 2 persistent editable-trail contract

A stepping-stone record uses the same placed-object schema version and has exactly:

```text
schemaVersion, id, type="stepping-stone", worldX, worldY
```

Stone ids match the bounded `forest-stone-v1-*` pattern. The editor allocates the lowest unused
two-digit ordinal from `forest-stone-v1-01` through `forest-stone-v1-12`, giving the trail a hard
limit of 12 stones and deterministic identity allocation. A move replaces coordinates under the
same id; it never removes and recreates the object. Accepted objects are stored in id order, making
JSON output and equal-ground ordering stable. Unknown fields, non-integer or out-of-range
coordinates, duplicate ids, mismatched id/type pairs, and unsupported object or overlay schema
versions reject the complete overlay.

The development page exposes one `Edit trail` mode and four small controls: place, move nearest,
remove, and done. `T` toggles editing; `P`, `M`, Delete/Backspace, Enter, and Escape provide the
corresponding keyboard path while ordinary movement remains available. Pointer and touch positions
map directly to world coordinates during editing instead of starting the movement joystick. The
canvas shows a pale valid or red invalid preview, the compact live status announces a specific
validation reason, and diagnostics name the active tool and validity. Leaving the mode clears only
transient preview and selection state and returns focus to the viewport. Editing adds no motion, so
reduced-motion behavior remains the existing ambient-motion contract.

Placement validation is pure and deterministic. The fixed stone radius is 11 world pixels. A stone
must remain inside the world; avoid generated trunk collision circles; remain outside the entrance's
52-pixel protected radius; keep 14 pixels of fixed clearance beyond each tree and stone collision
footprint; and avoid marker or other overlay-object footprints. The tree clearance protects visual
legibility immediately around a trunk without reserving the tree's full 70-pixel interaction reach.
Because stones are non-solid, visually open passages between trees remain usable while every nearby
position from which writing can be inspected stays walkable. Distinct stones must be at
least 26 pixels apart. After the first stone, a new or moved stone must be within 96 pixels of
another stone. The complete set must remain connected under that same 96-pixel neighbor rule.
Moving or removing a bridge stone is rejected instead of partially splitting the trail. These rules
protect the spawn and the space needed to approach nearby writing.

Stones are non-solid ground decoration. They cannot block player movement, close a corridor, or
strand the player; validation protects legibility and interaction space without turning the trail
into navigation geometry. Adjacent visuals use one narrow rule: in stable id order, each stone after
the first draws one subdued ground join to its nearest earlier stone within 96 pixels, with id
tie-breaking. This is a visual hint only, not path topology, collision, or pathfinding.

Place, move, and remove operations construct and validate a complete candidate overlay before
storage or live state changes. A rejected edit returns the original overlay object, so there is no
partial revision or stranded state. A successful edit increments the overlay revision exactly once,
saves through the existing development-only adapter, then invalidates the visible-object cache.
Reset removes the base-specific local value and reapplies an empty overlay. Regenerating the same
base reproduces the same tree placement and asset identities before independently reapplying saved
stones. Invalid JSON, incompatible bases, invalid placements, or unsupported versions recover to an
empty applied overlay while leaving offending saved bytes available for development diagnosis.

Stepping stones use fixed canvas primitives and bounded culling footprints. They enter the existing
viewport cache and stable ground-Y depth ordering with id tie-breaking. Joins and visible stones are
drawn from already validated in-memory objects. Storage access, JSON decoding, schema and placement
validation, base generation, asset preparation, and overlay mutation stay in initialization or
explicit editing handlers, never animation frames. The 12-stone bound makes the join pass deliberate
without introducing a spatial index or regional overlay loader.

Applying an overlay is a pure step after base generation. It verifies schema and base compatibility,
then validates the marker footprint against world edges, generated tree trunk collision circles,
the protected player entrance, and any other accepted overlay footprints. Any invalid object rejects
the applied object set rather than partially applying ambiguous personal state. Base regeneration
does not mutate, merge into, or derive randomness from the overlay, so applying or resetting a
marker cannot change a tree's placement or asset identity.

The marker is deliberately non-solid to the player: its footprint prevents invalid placement but
does not turn this proof into a navigation or construction system. The current corridor is valid,
flat terrain for a marker and remains walkable. Interaction reach is a fixed contract constant, not
saved user data, so every accepted marker remains usable without trusting an arbitrary stored radius.

The development page exposes `Place marker here` and `Reset personal overlay`. Its adapter stores
only the overlay JSON in browser `localStorage`, under a base-specific development key. Loading
happens once during scene initialization; saving and resetting happen only in those explicit action
handlers. Invalid JSON, an unsupported schema version, an incompatible base identity, a storage
exception, or a newly invalid placement produces a visible diagnostic and an empty applied overlay.
Invalid stored bytes are not silently overwritten, so a developer can inspect them and recover by
resetting or placing a valid marker. This adapter is evidence for independent round trips, not a
production storage policy.

Markers use a fixed prepared canvas drawing path: no object asset or procedural work is needed.
They participate in the same cached viewport culling and stable ground-Y depth order as trees and
the player. Marker changes explicitly invalidate that cache. The shared proximity query can focus
either a loaded tree or a marker with deterministic distance, kind, and id tie-breaking, and the
existing keyboard, touch, prompt, modal, and focus-return behavior is reused. Animation frames do
not access storage, parse overlay JSON, validate placement, regenerate the base, or prepare assets.

The explicit future boundary for the overlay remains narrow: production account or database
storage, migrations between generated base versions, conflict resolution, multiple devices,
authorization, object asset loading, free-form labels, path topology, automatic pathfinding,
terrain painting, bridges, elevation, excavation, currencies, resource costs, crafting, generalized
construction tools, multiplayer, and a general component framework all remain undesigned. The
stepping-stone contract does not authorize trail networks, navigation graphs, terrain mutation, or a
complete customization system. Supporting those requires a new versioned contract decision;
neither placed-object type is an invitation to smuggle new systems into an unversioned payload.

### Milestone 3 discovery and satchel contract

The first discovery vocabulary is exactly **fallen twigs**, **smooth stones**, and **seed pods**.
They are small things that have fallen naturally or been offered by the forest. Nothing in the
interaction presents a writing tree as something to cut, mine, or consume. There is no rarity,
quality, price, weight, durability, tool, spending rule, or arbitrary item metadata.

The state boundary is explicit:

- Generated discovery placement is reconstructed from the forest base identity, discovery
  generation version 1, offering-cycle integer, fixed vocabulary, and the current bounded overlay
  footprints. A complete discovery manifest is never saved.
- Persistent personal state is a separate exact schema containing schema version 1, one fixed
  state identity, the compatible forest base identity, a non-negative revision, a bounded offering
  cycle, exactly three bounded inventory counts, and up to nine collected discovery identities.
- Focus highlighting, prompt text, pickup feedback, and its dismissal timer are transient browser
  presentation state. Losing them cannot remove inventory or alter collection progress.

Each generated discovery has exactly seven fields: schema version, stable id, fixed `discovery`
type, material id, cycle, and integer world coordinates. Its id includes the discovery schema
version, a key of the complete base identity, cycle, and two-digit offering ordinal. A cycle offers nine discoveries,
exactly three of each material. Representative and large-world profiles use the same nine-item
bound. The candidate sequence is deterministic, so identical base, cycle, and overlay inputs
reproduce identical ids, types, and coordinates without changing tree, asset, marker, or stone
identity.

Placement stays in a legible corridor band between 150 and at most 1,180 pixels ahead of the
entrance. This encourages a short exploration beyond the nearest tree without distributing
required items across the whole large-world profile. Fixed validation protects world edges, tree
trunks and writing-interaction space, the entrance, marker and stepping-stone footprints, and
discovery-to-discovery spacing. The current world is flat and its generated corridor is walkable,
so this deliberately does not add pathfinding, navigation graphs, terrain analysis, or a spawn
scheduler. Overlay edits can deterministically move a conflicting discovery candidate while
preserving its identity; the generated manifest still remains independent of saved personal data.

Pickup is an explicit nearby action shared with the existing interaction prompt. Keyboard users
press E or Enter, pointer users activate the prompt, and touch users tap it. Trees, markers, and
discoveries enter one deterministic proximity query ordered by distance, then kind and stable id;
discovery pickup reach is a fixed 34 pixels. Trail editing retains its existing input precedence.
Native dialog and Forest-menu focus suspend movement, and closing either returns predictable focus
to the forest viewport so movement and inspection continue immediately.

The earlier absolutely positioned Satchel scaffold has been replaced by the first unified in-game
menu shell. **Edit trail**, **Place marker here**, inventory, clearing-object construction, offering
renewal, and discovery reset live together in that player-facing surface. Development-only
**Reset personal overlay** and **Return to entrance** controls remain outside it above the scene.
The menu is a native modal dialog outside the Canvas viewport's input-suppression boundary, so it
traps focus, closes with Escape, scrolls independently, blocks Canvas interaction behind it, and
restores exploration focus on close. Desktop uses a bounded centered panel. At mobile widths it
becomes a bottom sheet capped against the dynamic viewport, scrolls internally,
keeps a sticky close control, preserves 44-pixel actions, and pads for device safe areas. Its
contents therefore remain reachable even when the gameplay viewport is shorter than the complete
menu, including on mobile Safari. A restrained code-owned visual vocabulary now gives the menu a
warm paper interior, timber frame and header, and wood-toned controls so it belongs to the rendered
forest without depending on new raster assets or sacrificing contrast and focus treatment.
The mobile sheet is slightly inset with the complete timber border retained on every side, avoiding
the tapered top corners produced by the earlier top-border-only rule.

The player-facing menu markup lives in the reusable `_activity_forest_menu.pug` partial rather than
the development route template. The development view composes that production-facing surface with
fixture payloads, pressure controls, diagnostics, and recovery actions; a future owner route can
compose the same menu without copying those development concerns. Actions remain explicit because
trail editing, marker placement, inventory, construction, focus, validation, and persistence do not
yet share one honest generic contract. This seam avoids both duplicating the test harness and
prematurely introducing a data-driven menu registry, generalized command bus, or arbitrary action
framework.

Trail and clearing-object mode controls are HUD overlays inside the gameplay viewport rather than
flow content above it. Entering or leaving placement therefore does not resize or vertically shift
the Canvas. The overlays remain bounded and scrollable at small viewport heights. The gameplay
surface and its descendants also disable text selection and the iOS touch callout; touch gestures
remain movement or explicit controls instead of selecting the application element.

A pickup first builds and validates a complete candidate discovery state. The development adapter
serializes and stores that candidate before live state, culling, inventory text, or feedback
changes. A storage exception therefore leaves the offered discovery and live inventory untouched.
Already-collected ids and inventory counts at the 9,999 bound are rejected, so repeated input cannot
credit an item twice. On success exactly one discovery id is recorded, exactly one material count is
incremented, the visible-object cache is invalidated, and a polite non-modal status identifies the
material and new count.

Renewal is deterministic and has no wall-clock input. Only after all nine identities in the current
offering have been collected can the user explicitly welcome another offering. Renewal increments
the bounded cycle and clears only that cycle's collected-id list; it never subtracts or resets
inventory and never touches marker or trail edits. Reloading, absence, or waiting does not advance,
expire, or destroy an opportunity. This completion-gated development proof is intentionally not a
generalized ecology, event calendar, loot table, or recurring reward schedule.

The in-frame **Satchel** is one compact surface with the three material labels and counts, a concise
renewal explanation, completion-gated renewal, and an explicit development reset. It has a labeled
44-pixel target, visible native focus, Escape-to-close behavior, polite live feedback, and focus
return. Reduced-motion users receive the same static feedback with a shorter dwell; discovery
visuals have no continuous animation. The reset clears this base-specific inventory and discovery
progress and regenerates cycle zero. It does not reset the separately stored personal overlay.

The discovery adapter uses its own base-specific development `localStorage` key. Marker-only and
marker-and-trail overlay v1 records therefore load unchanged. Invalid JSON, unsupported versions,
incompatible bases, malformed or unknown inventory fields, unsafe or negative counts, duplicate
collected ids, wrong-cycle ids, and storage exceptions recover to an empty in-memory discovery
state with a visible diagnostic. Offending stored bytes are not overwritten during load. This is a
development persistence proof, not database policy.

Discoveries use three fixed Canvas primitive treatments and are non-solid. The Satchel renders its
material icons through that same drawing function, rather than maintaining approximate text symbols
or a second visual vocabulary. Available discoveries join the existing bounded visible-object
cache, viewport culling, and stable ground-Y/id depth ordering. Diagnostics report total and
remaining discoveries, the cycle, offered counts by type,
inventory, and the last pickup or persistence failure. Generation, schema validation, JSON work,
storage access, renewal, and inventory mutation occur only at setup or explicit action boundaries.
Movement frames perform only the already bounded visibility and pure proximity math over at most
nine discoveries. Regional tree-asset loading remains unchanged because discoveries need no asset
requests or preparation.

The Activity Forest stylesheet also contains legacy global `button` and `label` layout properties at
the page boundary. Forest controls therefore do not inherit the site's generic floats, margins,
font size, or fixed line-height. Satchel controls explicitly own their dimensions, spacing, colors,
disabled treatment, and focus rings in both site themes.

The discovery contract itself still contains no spending or crafting semantics. Milestone 4 adds a
separate, fixed clearing-object vocabulary and derives commitments from that overlay.

### Milestone 4 clearing-object contract

The initial vocabulary is exactly **trail sign**, **stone bench**, and **seed-pod lantern**. They
exercise the future `sign`, `seat`, and `light` affordances without introducing a general building
or crafting system. Their code-owned costs are fixed at two fallen twigs; two smooth stones; and one
fallen twig plus two seed pods, respectively. Costs, collision footprints, interaction reach,
visual dimensions and colors are never loaded from personal state. One nine-discovery offering can
therefore fund one of each object, with one smooth stone and one seed pod left available. The overlay allows at most nine
clearing objects and at most three of any type.

All three use placed-object schema version 1, stable ids of the form
`forest-clearing-v1-{type}-{01..03}`, and integer world coordinates. Bench and lantern records have
exactly five fields:

```text
schemaVersion, id, type, worldX, worldY
```

A sign alone adds an exact `text` field. Text is normalized to Unicode NFC, CR/LF sequences become
one space, surrounding and repeated horizontal whitespace is removed, control characters are
rejected, and the result is capped at 60 Unicode code points. Empty text is allowed and renders as
an unnamed sign. It is assigned only through `textContent` or an input value; it is never treated as
HTML. Unknown types, fields, mismatched identities, malformed text, duplicate ids, unsupported
versions and per-type or total overflows reject the complete overlay. Visual version 1 remains a
code boundary independent of mutable placement records.

Material accounting uses a derived commitment ledger. Discovery inventory remains the total ever
gathered; available inventory is that total minus the fixed costs of every valid clearing object in
the overlay. Placement validates a complete candidate, checks this derived availability, saves the
single candidate overlay record, and only then replaces live objects. Removal saves the candidate
without one identity before live removal, which makes its complete fixed cost available again.
Moves and sign edits replace a record under the same id and cannot charge or refund. A storage
exception leaves both the live overlay and derived availability unchanged; repeated placement or
removal input cannot debit or refund twice because there is no independently mutable debit record.
The discovery and overlay storage keys remain independently versioned and marker/trail and
Milestone 3 records load unchanged, but no operation that changes commitment requires two writes.

If loaded collected totals are inconsistent with valid authored objects, diagnostics report
`impossible-material-commitment`, all new construction is disabled, and the authored overlay remains
visible and removable so the developer can recover without duplicating material. The discovery
reset is disabled while clearing objects exist; its label explains that objects must first be
removed and refunded. `Reset personal overlay` removes the marker, trail, and all clearing objects,
thereby making every committed material available while leaving gathered inventory and discovery
progress intact. Renewal changes only the discovery cycle and never consumes objects, trails, or
committed material.

Placement is one focused mode entered from three 44-pixel Satchel actions. Keyboard placement
starts at the deterministic point 56 world pixels above the player; movement updates that preview,
Enter commits, and Escape cancels. Pointer and touch coordinates map through the viewport to bounded
integer world coordinates and commit once on pointer-down instead of starting the joystick. A
valid preview has a pale outline; an invalid preview has a red outline plus a drawn cross, so color
is not the only cue. A polite status names success, rejection, refund, cancellation, or save
failure. Selecting an object opens a native modal with text-safe, read-only inspection plus move,
removal, and close actions. A sign exposes a separate `Edit message` action; only that action reveals
and focuses the input, while cancel restores the read-only view. The development route assumes the
personal-overlay owner permission that a production surface will eventually need to gate. Closing
returns focus to exploration.

Validation protects world bounds, exact tree and clearing-object collision footprints plus an
8-pixel composition gap, the 52-pixel entrance region, the current player, marker and stone
footprints, and active discoveries. The earlier 28-pixel tree buffer and 34-pixel clearing-object
buffer proved the validation path but made authored arrangements unnaturally sparse. The smaller
code-owned gap permits compositions such as a bench beneath a tree or a lantern beside a bench
without allowing their collision circles to overlap. These bounded rules preserve the flat
generated corridor assumptions without pathfinding or terrain analysis. The stone bench is solid
and joins deterministic axis-separated player collision; signs and lanterns are non-solid. Only
three benches can exist, the entrance remains protected, close arrangements remain reversible, and
no navigation mesh or generalized physics is added.

The objects use fixed Canvas primitives. The lantern has one bounded translucent glow with a small,
deterministic two-frequency pulse in the existing ambient render loop. Reduced-motion mode holds it
at a fixed midpoint. There is no darkness, power, time-of-day, or lighting engine. Objects enter the existing visibility
cache, bounded culling rectangles, stable ground-Y/kind/id depth ordering, and deterministic
distance/kind/id focus query. No visual preparation or regional asset request is needed. Diagnostics
report total and visible objects, counts by type, placement mode, available and committed counts,
and the last edit or persistence failure. Candidate generation, normalization, schema validation,
ledger calculation, JSON and storage remain in initialization or explicit handlers rather than
animation-frame callbacks; frames perform only preview math, collision, culling, focus and draws.

### Milestone 5 bench reflection

A placed stone bench now provides one calm, resource-free route back to fixture writing. Its
read-only object dialog retains the fixed quiet-place description and offers **Reflect on nearby
writing**. Activating that action reveals an accessible HTML list outside the Canvas. Each result
shows the bounded fixture title, room, and date context; opening one reuses the native writing
inspection dialog and its read-only excerpt treatment. Native buttons provide keyboard, pointer,
and touch activation with 44-pixel minimum targets and visible focus. Escape closes either native
dialog, movement remains stopped while a dialog is open, and closing writing returns focus to the
forest viewport. The empty result is the fixed message that no fixture writing grows within the
bench's quiet reach.

The pure nearby-writing contract scans tree placements within **360 world pixels** of the bench and
returns at most **three** fixture writings. It orders qualifying placements by Euclidean distance,
then stable tree placement id, then fixture id. Repeated fixture identities are deduplicated after
that ordering, so the nearest qualifying tree wins with stable identity tie-breaking. Placements
with missing or unknown fixture projections are omitted. Camera position, focus, regional asset
load state, animation time, dialog state, and input iteration order are not inputs. The scan runs
only at explicit bench inspection, not in animation frames, and remains bounded by the existing
180-placement representative or 600-placement large-world manifest; it does not add a spatial
index or alter regional asset loading.

Candidates are transient derivations. The bench's exact five-field overlay schema remains
unchanged: it stores no fixture ids, titles, excerpts, dates, URLs, tree ids, or inferred
relationships. Moving a bench preserves its id and fixed two-stone commitment while recomputing a
different spatial result. Reflection performs no persistence operation, inventory debit, discovery
mutation, refund, history write, or other personal-state change. Diagnostics expose the selected
bench, qualifying placement count, ordered deduplicated fixture identities, and last fixture
resurfaced through a bench.

This development slice deliberately uses the existing bounded fixture-writing projection. It leaves
a seam for a later production writing projection but does not define production post queries,
authentication, post-to-tree creation, publishing events, or the edit, archive, deletion, privacy,
and restoration lifecycle. Signs retain explicit text editing, lanterns retain their deterministic
flicker, and neither gains nearby-writing behavior. There are still no semantic recommendations,
sitting or avatar state, reading history, favorites, authored bench-to-post links, general writing
browser, generalized object scripting, or entity-component framework.

### Development pressure profiles

The development route accepts four labeled profiles through its on-page profile links:

| Profile | Placements | Unique runtime assets | Purpose |
| --- | ---: | ---: | --- |
| Representative grove | 180 | up to 16 | The unchanged calm default and normal comparison point. |
| Asset variety | 180 | 60 | Isolates the cost of a moderately broader asset set. |
| Unique assets | 180 | 180 | Exercises the current eager asset boundary at maximum variety. |
| Large world | 600 | 60 | Separates placement, culling, and movement cost from asset variety. |

Only this development route can select the pressure profiles. An explicit cold-cache link clears
the scene asset pool before preparation so a cold generation run can be compared with ordinary
warm-cache reloads. The initial route reports the UTF-8 serialized scene payload size, preparation
time, and generated-versus-reused server asset counts for its initial region. Preparation timing
includes asset lookup or generation plus creation of JSON-safe assets; it does not claim to measure
network transfer or template rendering.

The measured eager results justified a narrow regional-loading experiment. The world is divided
into deterministic 480-pixel square cells. The initial response includes assets whose placement
anchors occupy the spawn cell and its one-cell neighbors. In the browser, the current camera extent
plus a one-cell preload ring determines subsequent cell requests. The development-only asset route
regenerates the same deterministic layout, validates and caps requested cells, prepares only their
unique asset keys, and returns those assets. Loaded and in-flight cell sets prevent duplicate
requests. Before requesting a cell set, the browser subtracts asset keys for canvases it already
owns; cells whose assets are all prepared require no response, and the server validates requested
keys against the requested cells. Returned assets are prepared asynchronously and retained for the
page lifetime; there is
an approximately six-millisecond active-work budget before preparation yields to an idle callback.
There is no eviction, persistence, generalized loading framework, or change to placement and asset
identity.

The browser reports initial and last-regional sprite-preparation time, prepared canvas count,
regional request/server timing, time from navigation start to the first completed scene render,
visible placement count, last render duration, and rolling last/average/maximum movement-render
duration. It also remembers which placements and asset keys have appeared in prior views. When
movement reveals placements outside the previously seen set, the diagnostic records the new
placement and asset counts, render duration, and animation-frame gap.

These values are local instrumentation, not a committed cross-device benchmark. Compare cold
runs on the intended baseline browser and device, repeat each profile enough to distinguish a
consistent regression from generator and browser noise, and use the representative grove as the
control. Compare the regional results with the recorded eager baseline to determine how much asset
staging alone improves startup and whether the preload ring prevents region-entry stalls. A compact
raster transport may be evaluated separately if JSON color-run payloads remain material. Asset
eviction, WebGL, atlases, and generalized loading remain out of scope until further evidence and
explicit approval.

### Development lossless-raster transport experiment

The Activity Forest route offers a development-only transport selector alongside every pressure
profile. `color-runs` remains the calm representative scene's default. The experimental
`lossless-raster` option leaves the placement manifest and versioned runtime identity unchanged but
replaces each static layer or foliage-group run array with a transparent, lossless PNG payload
carried as base64 in the existing initial and regional JSON responses. Raster assets retain the schema, renderer,
phenotype, seed, cache key, dimensions, bounds, anchor, architectural identity, and ordered
`rear-foliage`, `wood`, and `front-foliage` layer ids. They deliberately do not combine those layers
into a single image.

The scene asset pool still caches run-based runtime assets by the tree asset's existing versioned
cache key. A separate process-local raster cache stores the encoded projection under that exact same
key, so renderer, phenotype, schema, or seed changes naturally invalidate both representations.
The explicit cold-cache link clears both caches. There is no eviction or persistence.

For each initial response and regional request, diagnostics separate procedural generation time
from transport encoding time and report the exact UTF-8 byte size of the encoded asset array. The
browser separately reports JSON response decoding, PNG image decoding, layer preparation, fetch
time, first completed scene render, regional entry behavior, and the existing last/average/maximum
movement-render measurements. Color runs follow the same ordered layer/group preparation and draw path, so
the selector compares transport and browser preparation costs without changing layout, culling,
depth ordering, exploration, or the default scene. These measurements remain local observations;
compare repeated cold and warm runs for each pressure profile on the intended baseline device.

The experiment intentionally does not add WebGL, atlases, eviction, persistent storage, a production
route, or flattened animation layers. Its purpose is to determine whether lossless raster transport
materially improves encoded bytes and browser preparation enough to justify a later production
design decision.

### First shared ambient wind

The initial ambient experiment applied one restrained shared wind function to each whole foliage
layer. It performed well, but observation in the composed scene found that a crown changing position
as one rigid mass read more like a sprite glitch than wind. The first refinement therefore retains
the top-level layers while dividing each foliage layer into at most three branch-associated motion
groups. Each placement deterministically derives a phase, speed in the bounded 0.72–1.08 range,
and amplitude in the bounded 0.45–1 range from its stable placement id and world coordinates. Asset
identity is deliberately absent from this derivation, so placements that reuse the same runtime
asset do not move in lockstep. The calmer shared two-frequency signal is sampled with those placement
parameters plus each group's small phase lag and response amplitude, then converted to an integer
horizontal displacement of at most two screen pixels. The stagger lets wind appear to pass across
the crown instead of translating every leaf on the same frame. `wood` remains at the original
pixel-snapped origin. There is no vertical motion, branch deformation, rotation, or change to
top-level layer order.

Wind parameters live only in browser scene state and are calculated once when the placement
manifest is read. During authoring, every shoot already identifies its primary branch lineage. The
generator orders those lineages by crown position, assigns each complete lineage to one of three
bounded groups, and distributes each final visible foliage pixel according to its owning leaf.
Consequently, no leaf or pixel belongs to more than one group, and compositing all groups at zero
offset exactly reproduces the static foliage layer. Each runtime group retains only its id, index,
average branch attachment point, wind-response parameters, and pixels. Schema version 2 and its
cache key explicitly invalidate schema version 1 assets; dimensions, occupied bounds, tree anchor,
and placement identity remain unchanged.

Both JSON color runs and lossless rasters use the same draw path. Color runs prepare one surface per
group; raster transport encodes the same group and metadata as one transparent PNG. Preparation
occurs outside render frames. The renderer supplies placement time parameters at paint time, so the
raster pixels do not bake a motion sequence and the same asset can still move differently at each
placement.

Ambient motion requests continuous frames only while the document is visible and the user has not
requested reduced motion. A hidden document cancels the pending frame and clears movement input.
Returning to a visible document reevaluates the preference and requests a fresh frame. With reduced
motion, foliage displacement is zero and rendering returns to the existing event-driven behavior;
exploration remains available. Regional network requests are scheduled after the active animation
callback, and response decoding, raster decoding, color-run replay, and sprite preparation remain
in the asynchronous regional-preparation path rather than the render path.

The browser maintains one narrow visible/depth-order cache. It recomputes after camera or viewport
changes, player ground-Y changes, or regional asset arrival, and otherwise returns the same visible
and player/tree depth-ordered arrays. Ambient-only frames consequently do not rescan the complete
placement manifest, sort it, or rebuild unseen-region sets. Camera movement, resize, and genuine
asset arrival remain accepted invalidation points; this is intentionally not a generalized spatial
index.

Diagnostics preserve first-render, movement, and unseen-region measurements. They add a separate
ambient-only render count and rolling last, average, and maximum render duration. Movement frames
continue to update only the movement series, allowing the two workloads to be compared without
combining their samples.

On Node 24.15.0 in a local development run after motion grouping, the representative profile's initial six-cell region
contained 35 placements, 12 assets, and 12 visible placements in a 1000 × 700 test viewport. The
large-world profile contained 20 initial placements, 18 assets, and 10 visible placements. Their
prepared surface counts were 82 and 125 respectively. One hundred thousand unchanged
visibility-cache reads took 6.9 ms and 6.8 ms; 200 reads that alternated camera X and therefore
forced recomputation took 10.1 ms and 11.3 ms. Cold generation for those initial regions took
1155.8 ms and 1361.7 ms outside render frames. Their color-run asset arrays were 1,723,394 and
2,495,857 UTF-8 bytes, while lossless-raster arrays were 115,270 and 168,874 bytes. These are local
architecture checks, not browser frame-time claims. The on-page
ambient, movement, first-render, decoding, preparation, and unseen-region diagnostics remain the
source for baseline-device evaluation. The regional loader's bounded preparation yields and the
cached ambient path ensure regional arrival can cause a genuine one-time visibility recomputation,
not sustained per-frame placement scans or synchronous decoding stalls inside animation callbacks.

This refinement deliberately stops at three translated lineage groups per foliage depth layer.
Individual leaf motion, additional cluster hierarchy, branch deformation, rotation, storms, user
wind controls, WebGL, atlases, cache eviction, persistent storage, production routes, and a general
animation framework remain future boundaries. Group attachment metadata permits a future experiment
to interpret the same grouping more richly, but does not authorize or implement such a model.
Further detail should be considered only if representative-scene observation shows this staggered
motion is still visibly insufficient and the measured Canvas budget supports more work.

The restrained world-space ground treatment and corridor exist only to make depth and negative
space legible. This first camera is deliberately orthographic: terrain and trees share the same
translation, with no viewport-fixed horizon or implied perspective projection. The next step is to
judge the grouped ambient motion perceptually against the representative workload before expanding
the model. Real post integration,
persistence, complex physics, animation systems, tap-to-pathfind movement, zoom, terrain systems,
perspective projection, asset eviction, and game-engine abstractions remain non-goals for this slice.

### Historical renderer v2

Renderer v2 produced a `40 × 48` logical-pixel image and compacted adjacent same-color pixels into horizontal SVG rectangle runs. It was deterministic for the same renderer version and post projection. The implementation and tests were committed before retirement so its decisions remain available through Git history without burdening the active codebase.

Its projection was:

```js
{
  id,
  roomId,
  createdAt,
  wordCount,
  collaboratorCount,
  translationCount,
  commentCount,
  reactionCount,
  questApproved
}
```

Current semantic mappings are:

| Post property | Tree expression |
| --- | --- |
| Post ID | Primary deterministic seed |
| Room ID | Species family |
| Creation month | Permanent seasonal palette |
| Word count | Modest height increase |
| Collaborators | Split trunk |
| Translations | Blossoms |
| Approved quest association | Fruit |
| Comments | Ground flowers |
| Reactions | Fireflies |

The v2 tree has a shared trunk, branch-tip, and crown-center anatomy, correcting the visibly unsupported crowns in v1. Blossoms, fruit, flowers, and fireflies are multi-pixel motifs placed in semantic zones rather than as unrelated random pixels.

### What v2 proves

- Deterministic post-to-tree generation works with the existing Node/Pug/SVG stack.
- SVG rectangle runs preserve crisp pixel art without requiring stored image files.
- Contribution metadata can become visual language without showing numerical statistics.
- A fixture-driven lab supports rapid visual comparison before any production integration.
- Tree cards and their detail interaction can be responsive and keyboard-accessible.

### What v2 does not solve

V2 still combines a small number of authored geometric forms. Trees vary, but they do not convincingly appear to have grown. Its `40 × 48` grid also leaves too little room for fine taper, branch generations, bark texture, terminal twigs, or coherent leaf clusters.

## V3 renderer objective

The v3 experiment should generate one convincing deciduous species through simulated growth. It should not initially support all v2 species or contribution ornaments.

The intended pipeline is:

```text
post projection + renderer version
                ↓
       deterministic seed
                ↓
       species phenotype
                ↓
        growth simulation
                ↓
          branch graph
                ↓
 wood and foliage occupancy grids
                ↓
 pixel-art cleanup and palette pass
                ↓
        compact SVG runs
```

The distinction is important:

```text
V2: choose and deform compatible parts
V3: simulate an organism, then rasterize its final state
```

## Recommended growth model

Use a constrained, space-colonization-inspired model rather than a pure recursive fractal or an unrestricted biological simulation.

### 1. Phenotype

A phenotype defines the stable ranges and tendencies of one species. Initial parameters should include:

- Mature height and crown width.
- Crown-envelope shape.
- Trunk base radius and taper.
- Root-flare strength.
- Apical dominance.
- Phototropism and gravity response.
- Branch starting height.
- Branch frequency and preferred angle.
- Curvature and droop.
- Forking probability.
- Internode length.
- Available growth energy or vigor.
- Twig cutoff diameter.
- Leaf-cluster radius and density.
- Tendency toward gaps in the crown.
- Bark and foliage palette parameters.

Post data may eventually influence selected phenotype values, but the first v3 experiment should expose explicit lab controls. That will make visual tuning much faster than repeatedly changing fixture metadata.

### 2. Crown attraction field

Scatter deterministic attraction points inside a species-specific crown envelope. These represent access to light and available growth space.

At each growth step:

1. Assign nearby attraction points to existing terminal nodes.
2. Average the directions from each terminal node toward its assigned points.
3. Blend that direction with apical dominance, phototropism, gravity, and inherited parent direction.
4. Extend the branch by one internode.
5. Split growth when attraction demand separates sufficiently.
6. Consume points reached by new growth.
7. Stop when vigor, diameter, iteration count, or attraction points are exhausted.

This gives the crown a designed outer envelope without prescribing its internal branch arrangement.

### 3. Branch graph

The simulation output should be a graph independent of pixels:

```js
{
  nodes: [{ id, x, y, parentId, generation, vigor }],
  segments: [{ fromId, toId, radius, generation }],
  terminalNodeIds: []
}
```

Every child inherits constrained properties from its parent:

- Direction and curvature.
- Remaining vigor.
- Diameter.
- Generation depth.
- Age or growth step.

Branch radii should be calculated after growth, working from terminal branches back toward the roots. A simplified pipe-model relationship is suitable: a parent must be thick enough to support the accumulated cross-sectional area of its children.

### 4. Wood rasterization

Rasterization should consume the graph rather than influence growth.

- Render tapered segments into a wood occupancy grid.
- Join parent and child segments without pinholes.
- Add an analytic root flare near ground level.
- Resolve overlap by depth or generation where helpful.
- Derive bark shadows and highlights from a consistent light direction.
- Add deterministic bark clusters only inside the final wood mask.

Avoid drawing a thick square brush along a line; it produces blocky, constant-width branches. A distance-to-tapered-segment test or scanline polygon rasterizer will give substantially better anatomy.

### 5. Foliage rasterization

Foliage must originate from terminal twigs, not independently sampled canopy coordinates.

- Create one or more irregular leaf clusters around eligible terminal nodes.
- Allow nearby clusters to merge into masses.
- Preserve some negative space so the branch structure remains legible.
- Use cluster-scale shadow and highlight regions rather than random per-pixel noise.
- Clip the combined foliage to a softly enforced crown envelope if necessary.

Individual leaves are optional. At the proposed resolution, coherent clusters and a few edge pixels may read better than attempting literal leaves everywhere.

### 6. Pixel-art cleanup

The simulation need not operate directly in integer pixels. It may grow in normalized floating-point coordinates and be rasterized afterward.

The cleanup pass should:

- Remove isolated one-pixel noise.
- Fill accidental one-pixel holes.
- Preserve intentional crown gaps above a configurable size.
- Break excessively smooth diagonals selectively.
- Limit the palette.
- Apply one consistent light direction.
- Compact equal horizontal pixels into the SVG-run format already used by v2.

## Resolution

Begin v3 at `96 × 128` logical pixels. This should provide enough room for:

- Visible taper and root flare.
- Three or more branch generations.
- Terminal twigs.
- Clustered foliage with negative space.
- Bark texture that is not merely color noise.

The Forest Lab may display the result at a larger CSS size with `image-rendering: pixelated` and SVG `shape-rendering="crispEdges"`.

Do not increase resolution indefinitely to compensate for weak structure. A coherent silhouette at thumbnail scale remains the primary test.

## Determinism and versioning

These are product invariants, not implementation details:

- The same post projection and renderer version must generate the same output.
- No unseeded randomness may enter growth, rasterization, cleanup, or ornament placement.
- Iteration order must be explicit; relying on database or object-key ordering can change output.
- A renderer-version change may alter a tree. Before production trees exist, retired experimental versions may live only in Git history; production adoption will require an explicit migration policy.
- Historical prototypes should be retired once their lessons and reproducible checkpoints are preserved.

Recommended module boundary:

```text
forestTreeGeneratorV3.js     # experimental public orchestration
forest/v3/phenotype.js
forest/v3/growth.js
forest/v3/rasterizeWood.js
forest/v3/rasterizeFoliage.js
forest/v3/pixelCleanup.js
```

If v3 succeeds, a small dispatcher can select a renderer version without making the algorithms depend on one another.

## Forest Lab changes for v3

The lab should expose the same generated tree at three diagnostic layers:

```text
grown tree | leafless wood | branch-graph debug view
```

Add controls for phenotype parameters before reconnecting those parameters to post attributes. Useful controls include:

- Seed.
- Height.
- Crown width.
- Apical dominance.
- Branch frequency.
- Branch angle.
- Fork probability.
- Crown attraction-point count.
- Leaf density.
- Crown-gap tendency.
- Bark texture density.

Useful debug overlays include:

- Crown envelope.
- Attraction points.
- Branch nodes and parent links.
- Terminal-node markers.
- Segment radius.
- Foliage-cluster centers.

Controls and overlays are development tools, not proposed production UI.

## Reference-art request

A manually edited reference tree would materially improve algorithm design. It need not be a polished asset. The most useful specimen would be drawn on a `96 × 128` grid and establish:

- Desired trunk width at base, midpoint, and crown.
- Root-flare shape.
- Two or three convincing branch junctions.
- The smallest acceptable terminal twig.
- A representative foliage cluster.
- Typical negative space between clusters.
- Bark-mark scale.
- Highlight direction and palette size.

The generated artist's impression is a north star, not evidence of an implemented algorithm. Its useful properties are the supported foliage, readable hierarchy, taper, root flare, coherent light, clustered leaves, and meaningful variation in height, crown width, and branch density.

## Initial v3 milestones

Milestones 1–3 below describe the completed foundation of the pilot deciduous phenotype. Milestones 4–5 remain future work and should be guided by the product vision above.

### Milestone 1: graph only

- Define the deciduous phenotype.
- Generate deterministic attraction points.
- Grow a trunk and branches into a graph.
- Render a debug SVG of lines, nodes, attraction points, and crown envelope.
- Test determinism, parent relationships, bounds, generation limits, and termination.

Success means different seeds yield recognizably different but structurally plausible graphs. Pixel art is explicitly out of scope.

### Milestone 2: wood

- Compute branch thickness backward from terminal growth.
- Rasterize tapered branches.
- Add root flare.
- Add a restrained bark-lighting pass.

Success means the tree reads as a leafless tree at thumbnail size.

### Milestone 3: foliage

- Attach leaf clusters to terminal twigs.
- Merge neighboring clusters.
- Preserve controlled negative space.
- Add coherent shadow and highlight masses.

Success means foliage appears supported by the branch network and produces a convincing silhouette.

### Milestone 4: semantics

- Decide which post attributes influence phenotype without destabilizing identity.
- Reintroduce blossoms, fruit, flowers, and fireflies using the retired renderer's documented semantic placement lessons.
- Compare semantic variations across the fixed fixture set.

### Milestone 5: forest composition

- Place multiple trees in a deterministic landscape.
- Add selection, hover/focus identification, and post navigation.
- Explore terrain, paths, animals, and structures only after individual trees are artistically credible.

## Acceptance criteria for the v3 tree experiment

- Repeated generation is byte-for-byte or structurally deterministic.
- Every non-root graph node has exactly one valid parent.
- Growth terminates under fixed bounds.
- Branches taper from trunk to terminal twigs.
- Foliage clusters are traceable to terminal growth.
- Crown mass is visually supported by the trunk and branch graph.
- Several seeds produce substantially different silhouettes without obvious anatomical failures.
- The result remains readable at its intended Forest Lab thumbnail size.
- Debug views make failures diagnosable rather than requiring guesses from the final sprite.
- Renderer history and migration decisions remain explicit as the experiment evolves.

## Deferred decisions

- Exact mapping from rooms to botanical species.
- Whether renderer upgrades automatically restyle existing trees.
- Whether activity changes mutate a tree or add surrounding forest features.
- Whether trees visually age over time.
- How real-world seasonal presentation interacts with a tree's permanent birth season.
- Storage versus regeneration and caching policy.
- Production profile route, pagination, and very large forests.
- How much deterministic placement users may override through curation.
- Whether paths and clearings organize writing semantically, chronologically, manually, or through a mixture of those approaches.
- Which renewable materials, if any, form the first expressive resource system.
- The boundaries between private forests, invited visitors, and public presentation.
- How gifts and shared spaces remain generous without becoming popularity metrics.
- Which landscape interaction beyond tree selection best demonstrates the core loop with the least mechanical overhead.
