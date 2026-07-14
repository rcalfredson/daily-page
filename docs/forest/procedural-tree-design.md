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

The runtime tree asset is a phenotype-independent, JSON-serializable projection built after generation. Schema version 1 contains:

- asset schema version; renderer id and version; phenotype id and asset version
- deterministic seed and the derived visual cache key
- logical width and height, ground anchor, and occupied visual bounds
- ordered `rear-foliage`, `wood`, and `front-foliage` horizontal color-run layers
- limited architectural identity and maximum branch order for inspection and later composition

It deliberately excludes masks, full pixel grids, nodes, segments, attraction points, diagnostics, leaves, shoots, and coverage cells. JSON stringify/parse is the serialization boundary: consumers render the parsed asset without procedural growth. Separate foliage and wood layers preserve depth order now and provide stable layer-level attachment points for future shared ambient motion or foliage-cluster metadata; no animation data is defined yet.

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
It remains a development preview without persistence, real post queries, or ambient animation.

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

The browser draws the prepared scene into one visible Canvas. As each runtime asset arrives, it is
rasterized once into a small offscreen Canvas in its declared layer order. Placements reuse prepared
bitmaps, reducing ordinary scene draws
from thousands of color-run operations per tree to one `drawImage` call per visible tree. These
offscreen surfaces are per asset, never per placement, and are discarded with the page.
Browser-independent math derives each scaled visual rectangle from the asset bounds and ground
anchor, culls it against the camera, and orders visible placements by ground Y with stable id
tie-breaking. Integer scaling and disabled image smoothing preserve crisp pixels. Keyboard,
resize, and reset events request coalesced frames. The exploration version replaces direct camera
navigation with a clamped camera
following a player whose small explicit state has a deterministic, collision-free corridor spawn.
Arrow-key and WASD movement is normalized and elapsed-time based. Touch and stylus input uses a
floating direction-only joystick whose origin is the initial contact point; dragging beyond a small
dead zone selects a normalized direction, while release, cancellation, blur, or inspection stops
movement. Both input paths resolve movement independently on X and Y against scaled circular trunk
obstacles, allowing sliding while leaving canopies non-solid.

The player participates in stable ground-Y ordering. A pure proximity query selects the nearest
in-range placement with stable id tie-breaking. Deterministic placement-to-fixture assignment is
independent of tree asset identity, and only bounded title, room, date, and excerpt metadata crosses
the runtime boundary. A native modal inspection dialog stops movement and returns focus without
changing the player or camera location.

Active movement frames perform movement math, region-set comparison, culling, ordering, and bitmap
draws, then cease when input stops. Procedural generation, response decoding, and color-run replay
remain outside the animation frame. The render-duration diagnostic remains the local measurement
point, with no universal benchmark claim for this interaction slice.

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

The restrained world-space ground treatment and corridor exist only to make depth and negative
space legible. This first camera is deliberately orthographic: terrain and trees share the same
translation, with no viewport-fixed horizon or implied perspective projection. The next likely
step is to test shared ambient wind against this representative workload. Real post integration,
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
