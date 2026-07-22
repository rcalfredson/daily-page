# Activity Forest Environment Region Contract

## Milestone 8 scope

Milestone 8A added one development-only `first-regions` profile. It proved that the finite
3,000 × 1,800 world can contain a familiar calm grove and an adjacent rocky rise, joined by a broad
irregular intergrade. It is deliberately not a generalized biome generator. The representative,
`botanical-range`, and `post-tree-meaning` profiles retain their earlier layouts and ground
presentation. Milestone 8B extends only that profile with one semi-winding shallow stream, bounded
in-stream and bank boulders, and two generated arched footbridges. It does not add a
generalized hydrology, elevation, or crossing framework.

The shared pure implementation is `public/js/forest-environment.js`. Both server placement and the
browser ground painter import this module; there is no second browser approximation or transported
per-pixel biome raster.

## Versions and bounded vocabulary

The initial contract uses:

- environment schema version **2**;
- world/environment generation version **2**;
- ground-presentation version **11** (lusher ground and water plus shared bridge arch rendering);
- generated terrain-feature schema version **2** and generation version **5**;
- crossing schema version **2** and generation version **5**;
- grammar id `grove-rocky-rise-and-stream`;
- code-owned regions `calm-grove` and `rocky-rise`;
- surfaces `grove-moss`, `weathered-rock-grass`, `stream-bank`, and `shallow-stream`;
- captured habitats `neutral-grove` and `rocky-edge`.

The manifest contains only these versions and ids, a bounded seed and world, seven integer
parameters describing the rocky rise, and ten bounded stream parameters. The query accepts an exact `{ worldX, worldY }` object of
safe integers on the inclusive world boundary. Unknown ids or versions, strings longer than 80
characters, malformed or out-of-world coordinates, non-finite numbers, unsafe integers, and extra
fields reject. Both manifest and query results survive an exact JSON stringify/parse round trip.

| Dominant region | Ground surface | Habitat passed to tree projection | Placement texture |
| --- | --- | --- | --- |
| `calm-grove` | `grove-moss` | `neutral-grove` | Full candidate acceptance outside ordinary corridor/spacing rejection |
| `rocky-rise` | `weathered-rock-grass` | `rocky-edge` | Acceptance eases continuously to 67% in the rocky core, leaving more negative space |
| Intergrade | Blended presentation; dominant surface remains bounded | Habitat follows the dominant side at the 50% boundary | Density interpolates independently from phenotype weights |
| Stream bank | Restrained earth/stone margin over either region | The underlying region retains its habitat | Tree acceptance is 35% of local land density; authored clearing objects stay on dry land |
| Shallow stream | Animated blue-green water over either region | Habitat remains underlying context but no writing-tree candidate is accepted | Trees and discoveries are forbidden; player traversal requires the generated bridge |

`habitat` is intentionally narrower than the region result. The environment query also returns a
0–1,000 rocky blend, one of `grove-core`, `intergrade`, or `rocky-core`, and bounded suitability
tokens. It returns no callbacks, post inputs, personal-overlay state, camera state, renderer data,
or unbounded noise.

Hydrology is orthogonal to biome. The same stream may cross calm grove, intergrade, and rocky rise;
it changes surface and suitability without manufacturing a prestigious aquatic habitat or changing
the captured habitat of nearby land trees.

## Spatial grammar and painting

The rise is a seed-derived ellipse whose center and radii stay within narrow fractions of the
finite world. Three low-frequency sine terms perturb its normalized signed distance. A seed-derived
190–245-pixel transition width passes that distance through smoothstep and quantizes the result to
per-mille blend. This makes the boundary irregular and soft while keeping every query independent
of camera, viewport, request order, iteration order, time, and mutable state.

The unchanged profiles retain the original grove base and horizontal bands. `first-regions` instead
samples 48-pixel world-space presentation cells. Their restrained grass-to-weathered-grass base
color follows the continuous rocky blend, with only a two-value local color variation. A second
deterministic query may place one of four small pixel motifs in a cell: grass tuft, bare-soil mark,
gravel patch, or small stone. Grass remains common on both sides; gravel and stone frequency rises
materially with rocky blend. Results are cached by cell for the page lifetime and only visible cells
are painted. The 48-pixel presentation cells are explicitly unrelated to the established 480-pixel
regional tree-asset loading cells.

Ground-presentation version 11 moves both regions toward a moderately lusher palette without copying
the reference's highest saturation. Calm-grove cells use a fresher mid-green, rocky-rise grass keeps
more yellow warmth but less grey, and their tufts receive clearer dark/light separation. The stream
shifts from muted slate teal toward blue-teal, with greener banks and brighter cyan-green surface
details. These are presentation-only color changes: region, habitat, hydrology, placement, and
post-tree identity remain unchanged.

Small stones, gravel, and boulders choose one stable code-owned rock palette: `mossed-green`,
`granite-grey`, `warm-stone`, or `blue-slate`. Mossed green remains the most heavily weighted
signature treatment; the other families prevent the terrain vocabulary from collapsing into one
hue. Palette selection is independent of biome prestige, writing evidence, and mutable activity.

Larger rocks are generated-base objects rather than marks baked into the surface. One candidate per
160-pixel cell receives a blend-weighted acceptance decision. Accepted boulders use the bounded
`low`, `shouldered`, or `mossy-outcrop` form, stable world anchor, dimensions, collision radius, and
originating-region evidence. They reserve tree, entrance, one-another, and corridor clearance, enter
the normal viewport culling and ground-Y depth order, and block player and authored-object placement.
They are not inspectable rewards, inventory, or personal-overlay objects. Generation version 2
added rock palettes, version 3 added in-stream obstacles, version 4 added sparse bank-edge rocks,
and version 5 reserves all bridge approaches and decks from land boulders.
The placement decision version remains 1, so established land-boulder anchors do not move merely
because their presentation vocabulary expands.

The corridor remains continuous through both land regions. The stream is painted over it and the
primary bridge restores that route; a second harness bridge proves another angle and crossing. There
is no general elevation physics, navigation mesh, or
pathfinder.

### Stream, flow, and bridge

The stream center is a seed-derived base Y plus two bounded sine waves with different wavelengths.
It crosses the full finite world from west to east and is queryable analytically without a raster.
Distance to that center classifies water, bank, or land. The gameplay profile retains its 44-pixel
water half-width and 22-pixel bank classification so traversal and placement remain planar.

Presentation uses the registered `varied-incised-creek-bank` definition. Smooth deterministic
anchors vary water depth from 5–14 pixels, each side's slope run from 20–42 pixels, and broad plus
fine edge displacement independently along the creek. The generator samples those profiles into
three-dimensional bank-face quads: the outer edge remains on the world ground at `z = 0`, while the
irregular inner edge meets a recessed water surface at negative `z`. The shared forest projection
maps those points to canvas space. The far bank is painted first, then the recessed water, then the
near bank, giving the channel coherent occlusion without adding general terrain-elevation physics.

Seeded 210-pixel composition anchors choose grassy, rocky, bare-dirt, or fallen-log-jam influence,
then smoothstep-blend continuously toward the next anchor instead of changing material at a section
line. Each bank face is divided into four irregular 3D strata with progressively darker values from
the ground cap to the waterline, but broken cap shadows and material clusters keep those strata from
reading as regular masonry courses. A highlighted grass overhang, dark waterline undercut, roots,
clustered soil pixels, top-lit embedded rocks, dirt striations, and occasional multi-member fallen
logs provide scale and slope cues. A translucent shallow shelf carries muted soil color and pebbles
past the waterline so the bank appears to continue below the surface. Both geometry and material
remain continuous at sample boundaries, and visible geometry is generated and cached in bounded
world-X chunks rather than across the whole world every frame.

Movement remains planar, but traversal tests the player's full collision circle against the same
irregular water edge used by presentation. The original analytic half-width remains a conservative
minimum. Only the rotated, radius-inset bridge deck may admit a player whose circle intersects water;
this prevents visual edge displacement from making the character appear to wade beside a bridge.

Three broad, independently meandering tonal bands break the recessed water into deep teal, middle blue-green,
and lighter shallow regions without creating hard tile boundaries. Stable world-anchored clusters
of two-tone pixels dapple those large shapes, while separate moss, soil, shallow-water, and shadow
notches articulate both banks. Above them, four sparse flow lanes contain short two- or three-step
pixel clusters moving east at a deliberate six frames per second. Deterministic gaps, starting
jitter, length, stairstep direction, broken tails, undersides, and occasional one-pixel glints make
the animation feel authored without changing its shape between reloads. Motion shares the
established ambient render loop and freezes to a stable phase under reduced motion. Each cluster
receives a bounded local offset near stream boulders, splitting around the obstacle before the
boulder is drawn over it.
This is a legible flow treatment, not fluid simulation; it has no volume, current force, erosion,
particles, or gameplay state.

The primary `arched-footbridge` is found deterministically at the minimum-distance intersection of
the stream center and established corridor. A second bridge is placed clear of trees elsewhere on
the stream with a substantially different seed-derived angle, span, and crown. Bridge geometry is
evaluated in local longitudinal/lateral coordinates,
so its containment and traversal contract supports arbitrary world angles. Player collision remains
two-dimensional: water rejects movement unless the player's collision circle is inside the rotated
deck rectangle, and each visible side rail rejects circle overlap over both water and dry approaches.
The open ends remain unobstructed.

Presentation is generated from the registered `rustic-timber-arch` bridge definition. That
definition groups the circular-segment profile, deck and plank dimensions, fascia depth, rail and
post spacing, abutments, and palette in one parameter object so another bridge form can be added by
registering a different definition rather than retuning screen-space drawing commands. Each instance
supplies only its world position, angle, footprint, span, and crown.

The generator constructs plank surfaces, plank ends, curved fascia segments, posts, and handrail
members as three-dimensional points in the bridge's rotated local coordinate system. A single
orthographic world projection maps `(x, y, z)` to canvas `(x, y - z)`, matching the forest's planar
ground and sprite convention. Depth values order surfaces and members before painting. The deck uses
a true circular-segment arch from zero at either approach to its configured crown; vertical thickness,
post height, and rail height are offsets on that same profile instead of canvas-Y approximations.
Both differently angled instances therefore retain the same proportions. Crown-lit uneven planks,
transverse seams, iron nails, two-tone curved fascia, bridge-aligned stone abutments, and log rails
retain the rustic pixel-art treatment. The player uses the same profile height while world position,
collision, focus, and camera remain planar.
This is not general elevation physics, jumping, slopes, or a bridge-construction system.

## Position-first writing identity

The `first-regions` profile uses 60 unique bounded writing fixtures and the following dependency:

```text
scene seed + environment/world versions
        ↓
candidate world position
        ↓
environment query and density acceptance
        ↓
ordinary corridor and anchor-spacing reservation
        ↓
bounded land, bank, and stream boulder dressing outside reserved navigation/tree/crossing space
        ↓
captured habitat at the accepted position
        ↓
post-to-tree mapping v1 (phenotype, seed, permanent palette)
        ↓
renderer-v3 runtime asset schema 2
```

The composer deliberately re-queries every accepted position and rejects a mismatch with the
layout's captured habitat. It then projects that fixture exactly once. Room, word count, mutable
activity, phenotype, asset-cache state, request order, regional loading, and camera position never
choose the location or habitat. Fixture ids, captured region/habitat/surface, transition evidence,
normal spatial identity, and the complete asset key are bounded scene evidence; raw projection
inputs remain server-side. Accessible inspection exposes only the established bounded meaning
explanation plus region-origin tokens.

Anchor spacing remains 76 pixels. At the existing maximum 2× scale, registered collision radii do
not exhaust that reservation, so projection requires no second retry in this slice. Candidate
generation is capped at 100 attempts per requested placement and fails rather than widening world,
corridor, or collision limits. Density, corridor, and spacing rejections are counted separately.

Botanical selection consumes the canonical registry's established habitat weights. It does not
contain renderer branches such as “rocky means conifer.” Density acceptance is a separate spatial
decision. Both habitats keep positive weights for all three registered phenotypes.

## Identity, mutation, and persistence

The complete environment manifest participates in `layoutKey`, alongside all earlier
placement-affecting scene inputs. A changed environment seed, grammar parameter, schema, or
world-generation version therefore creates a different generated-base identity and cannot attach
to an old development overlay silently.

- Grammar or placement changes increment the world/environment generation version.
- Ground-only pixel/palette changes increment the ground-presentation version when they do not
  alter classification or placement.
- Generated boulder frequency, form, placement, or collision changes increment the terrain-feature
  generation version included in generated-base identity.
- Stream shape or suitability changes increment environment/world-generation version; water or
  bridge presentation changes increment ground-presentation version; crossing geometry or
  traversability changes increment crossing generation version.
- Meaning changes increment the post-to-tree mapping version.
- Renderer or phenotype pixel changes retain their existing renderer/asset invalidators.
- Runtime tree-asset schema remains version 2; renderer cache version remains 4.
- Explanation-only wording does not change layout or tree pixels.

A future persistent writing tree captures its habitat and semantic projection at creation.
Regenerating a boundary does not silently move or reproject it. Ecological change requires an
explicit auditable migration or reprojection. Personal relocation remains a personal-overlay edit:
it preserves habitat, phenotype, seed, permanent traits, post association, and asset key. A tree
may become an intentional out-of-habitat exception without decay, penalty, disappearance, or
automatic reroll. Personal-overlay identity is never an environment-query or tree-cache input.

## Discoveries and authored-object suitability

| Element | Milestone 8 suitability |
| --- | --- |
| Fallen-twig, smooth-stone, and seed-pod discoveries | Valid on land and banks; forbidden in water; generated offerings also avoid solid boulders |
| Stepping stones and the simple marker | Valid on dry land; placement rejects stream banks, water, and generated boulders |
| Trail signs, stone benches, and seed-pod lanterns | Valid on dry land; preview, move, refund, and recovery expose the bounded water/bank or boulder reason |
| Writing trees | Generated density and phenotype are environment-aware only in `first-regions` |
| Generated arched footbridges | Two walkable harness crossings using one generalized renderer and traversal contract; neither is an inventory or overlay object |
| Boats, swimming, fishing, user-built bridges, wet-margin discoveries | Deferred beyond this focused milestone |

Environment regeneration never rewrites overlay objects. Both initial surfaces remain valid; the
bounded `terrain-feature-collision` and `water-or-bank-surface` reasons describe physical placement
limits rather than biome prestige. A changed environment or terrain version creates a different base identity,
so incompatible development overlays recover visibly instead of being silently moved or deleted.
Keyboard, touch, preview, removal, and full-refund paths use the same validation result.

## Fixed-seed evidence and local measurements

On Node 24.15.0, one local run of `first-environmental-regions` produced:

- 60 placements after 91 candidates: 15 density/water, 5 corridor, and 11 spacing rejections;
- 51 calm-grove/neutral-grove and 9 rocky-rise/rocky-edge placements;
- 36 grove-core, 20 intergrade, and 4 rocky-core placement anchors;
- 28 deciduous, 19 lanternwood, and 13 highland conifer trees;
- all three phenotypes in both regions; conifers were 8/51 in the grove and 5/9 on the rise;
- 1,507 bounded ground motifs across the finite world: 811 grass tufts, 299 gravel patches,
  156 small stones, and 241 bare-soil marks, queried only for visible cells;
- 27 generated boulders: 15 land, 6 stream, and 6 bank boulders, with the water set reserved at
  least 135 pixels and bank set at least 150 pixels horizontally from both crossings;
- a primary 62 × 200 bridge centered at world position 1,425 × 972, oriented 66.4° from the positive
  X axis with a 24-pixel crown, plus a 58 × 226 bridge at 2,220 × 1,000 oriented 116.8° with a
  20-pixel crown;
- a 482-byte environment manifest and 41,040-byte projected layout before runtime assets;
- about 17.8 ms for layout, environment classification, crossing search, and terrain features;
- about 4.62 seconds of cold generation within 4.73 seconds total preparation for 60 assets;
- about 114 ms warm preparation with all 60 assets reused and no generation;
- 7,922,089 bytes for the complete color-run asset array and 548,916 bytes for lossless raster.

These are architecture observations from one local run, not browser or baseline-device promises.
The route continues to load only the spawn region initially and reports actual browser-visible cell
and detail counts, ground-paint time, visible boulders, regional loading, decoding, culling, and
movement-frame observations. Walking review is still required to judge whether the texture density
stays calm, whether the three boulder forms are legible beside trees, whether the transition changes
character without exposing its cell grid, and whether light and dark page themes preserve the
intended mood.

## Deferred boundary

Milestone 8 now contains the requested two places, soft transition, water feature, and crossing.
Further hydrology—ponds, branching rivers, wetland habitats, swimming, boats, fishing, currents,
erosion, user-built bridges, and general elevation—requires a later evidence-gated milestone rather
than expansion of this proof. Milestone 9 owns wildlife or other nonessential transient life; the
stream does not introduce fish, insects, birds, or task sources ahead of that experiment.
