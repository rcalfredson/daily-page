# Activity Forest Environment Region Contract

## Milestone 8A scope

Milestone 8A adds one development-only `first-regions` profile. It proves that the finite
3,000 × 1,800 world can contain a familiar calm grove and an adjacent rocky rise, joined by a broad
irregular intergrade. It is deliberately not a generalized biome generator. The representative,
`botanical-range`, and `post-tree-meaning` profiles retain their earlier layouts and ground
presentation.

The shared pure implementation is `public/js/forest-environment.js`. Both server placement and the
browser ground painter import this module; there is no second browser approximation or transported
per-pixel biome raster.

## Versions and bounded vocabulary

The initial contract uses:

- environment schema version **1**;
- world/environment generation version **1**;
- ground-presentation version **3** (recognizable terrain plus stable rock palettes);
- generated terrain-feature schema version **1** and generation version **2**;
- grammar id `grove-and-rocky-rise`;
- code-owned regions `calm-grove` and `rocky-rise`;
- surfaces `grove-moss` and `weathered-rock-grass`;
- captured habitats `neutral-grove` and `rocky-edge`.

The manifest contains only these versions and ids, a bounded seed and world, and seven integer
parameters describing the rocky rise. The query accepts an exact `{ worldX, worldY }` object of
safe integers on the inclusive world boundary. Unknown ids or versions, strings longer than 80
characters, malformed or out-of-world coordinates, non-finite numbers, unsafe integers, and extra
fields reject. Both manifest and query results survive an exact JSON stringify/parse round trip.

| Dominant region | Ground surface | Habitat passed to tree projection | Placement texture |
| --- | --- | --- | --- |
| `calm-grove` | `grove-moss` | `neutral-grove` | Full candidate acceptance outside ordinary corridor/spacing rejection |
| `rocky-rise` | `weathered-rock-grass` | `rocky-edge` | Acceptance eases continuously to 67% in the rocky core, leaving more negative space |
| Intergrade | Blended presentation; dominant surface remains bounded | Habitat follows the dominant side at the 50% boundary | Density interpolates independently from phenotype weights |

`habitat` is intentionally narrower than the region result. The environment query also returns a
0–1,000 rocky blend, one of `grove-core`, `intergrade`, or `rocky-core`, and bounded suitability
tokens. It returns no callbacks, post inputs, personal-overlay state, camera state, renderer data,
or unbounded noise.

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

Small stones, gravel, and boulders choose one stable code-owned rock palette: `mossed-green`,
`granite-grey`, `warm-stone`, or `blue-slate`. Mossed green remains the most heavily weighted
signature treatment; the other families prevent the terrain vocabulary from collapsing into one
hue. Palette selection is independent of biome prestige, writing evidence, and mutable activity.

Larger rocks are generated-base objects rather than marks baked into the surface. One candidate per
160-pixel cell receives a blend-weighted acceptance decision. Accepted boulders use the bounded
`low`, `shouldered`, or `mossy-outcrop` form, stable world anchor, dimensions, collision radius, and
originating-region evidence. They reserve tree, entrance, one-another, and corridor clearance, enter
the normal viewport culling and ground-Y depth order, and block player and authored-object placement.
They are not inspectable rewards, inventory, or personal-overlay objects. The palette addition
advanced terrain-feature generation to version 2 and generated-base identity while deliberately
retaining placement decision version 1, so existing boulder anchors do not move merely because
their color vocabulary expanded.

The corridor is painted afterward and remains continuous through both regions. There is no water,
elevation physics, navigation mesh, or pathfinder.

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
bounded generated boulder dressing outside reserved navigation/tree space
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

| Element | 8A suitability |
| --- | --- |
| Fallen-twig, smooth-stone, and seed-pod discoveries | Valid on either surface; generated offerings also avoid solid boulders |
| Stepping stones and the simple marker | Valid on either surface; placement rejects overlap with a generated boulder |
| Trail signs, stone benches, and seed-pod lanterns | Valid on either surface; preview, move, refund, and recovery retain their behavior while respecting boulder collision |
| Writing trees | Generated density and phenotype are environment-aware only in `first-regions` |
| Water-edge objects, bridges, boats, swimming, wet-margin discoveries | Deferred until a later water/crossing contract exists |

Environment regeneration never rewrites overlay objects. Both initial surfaces remain valid; the
new bounded `terrain-feature-collision` reason describes a physical boulder overlap rather than a
biome prohibition. A changed terrain-feature generation version creates a different base identity,
so incompatible development overlays recover visibly instead of being silently moved or deleted.
Keyboard, touch, preview, removal, and full-refund paths use the same validation result.

## Fixed-seed evidence and local measurements

On Node 24.15.0, one local run of `first-environmental-regions` produced:

- 60 placements after 83 candidates: 12 density, 2 corridor, and 9 spacing rejections;
- 51 calm-grove/neutral-grove and 9 rocky-rise/rocky-edge placements;
- 36 grove-core, 20 intergrade, and 4 rocky-core placement anchors;
- 28 deciduous, 19 lanternwood, and 13 highland conifer trees;
- all three phenotypes in both regions; conifers were 8/51 in the grove and 5/9 on the rise;
- 1,507 bounded ground motifs across the finite world: 811 grass tufts, 299 gravel patches,
  156 small stones, and 241 bare-soil marks, queried only for visible cells;
- 17 generated boulders: 15 rocky-rise and 2 calm-grove; 7 low, 7 shouldered, and 3 mossy-outcrop;
- boulder palettes: 6 mossed green, 6 granite grey, 3 warm stone, and 2 blue slate;
- a 306-byte environment manifest and 36,335-byte projected layout before runtime assets;
- about 7.7 ms for layout and environment classification;
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

Milestone 8B may define water surface identity, banks, collision, and one crossing while preserving
this position-to-habitat seam. It must decide whether wet margins add a habitat within a region or a
new region, and how crossings interact with authored overlays. Milestone 9 owns wildlife or other
nonessential transient life. Neither system is anticipated with ad hoc 8A renderer conditionals.
