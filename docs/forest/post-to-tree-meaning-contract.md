# Activity Forest post-to-tree meaning contract

## Status and purpose

Milestone 7A introduces a development-only, fixture-backed boundary between writing data and the
renderer-v3 procedural-tree generator. It is deliberately small: stable writing identity chooses a
specimen, a broad habitat hint softly biases phenotype eligibility, and creation season leaves one
bounded permanent foliage tint. It is not a production post query, migration system, biome model,
or final semantic mapping.

The contract lives in `server/services/forestPostTreeProjection.js`. Projection schema version 1
and mapping version 1 are separate from runtime tree-asset schema version 2, renderer cache version
4, and each phenotype's asset version.

## Input and decision policy

The projection rejects unknown fields. Strings and counts are bounded, timestamps must be exact
ISO-8601 UTC strings, and the context must contain exactly one known habitat. Titles, descriptions,
body content, excerpts, tags, personal-overlay state, and transient presentation do not cross the
boundary.

| Source | Accepted | Stability | Milestone 7A expression | Existing tree changes automatically? | Identity/invalidation | Forest Lab explanation |
| --- | --- | --- | --- | --- | --- | --- |
| Stable post `id` | Yes, required and bounded | Stable | Specimen seed and deterministic phenotype draw | A different id is a different specimen | Mapping version, derived seed, phenotype identity | Stable writing identity selected the seed |
| Explicit `habitat` context | Yes: `neutral-grove` or `rocky-edge` | Generated-base context | Soft phenotype-selection bias; no hard one-species habitat | No. A deliberate base reprojection may change it | Selected phenotype affects pixels; an explanation-only habitat difference does not | Habitat favored forms without requiring one species |
| `createdAt` | Yes, optional exact UTC timestamp | Permanent evidence at projection time | UTC creation season selects one phenotype-owned palette | No polling. A correction requires deliberate reprojection | Palette decision and mapping version affect the visual key | Creation season left a restrained permanent tint |
| `roomId` | Yes, optional and bounded | Mutable categorization | None in this slice | No | None | None |
| `wordCount` | Yes, optional and bounded | Mutable with edits | None; never size, rarity, brightness, or complexity | No | None | None |
| Collaborator and translation counts | Yes, optional and bounded | Mutable activity | Deferred; possible surrounding evidence, not a core-tree reward | No | None | None |
| Comment and reaction counts | Yes, optional and bounded | Mutable activity | Deferred; possible surrounding/transient evidence, not a core-tree reward | No | None | None |
| Quest approval | Yes, optional boolean | Mutable workflow state | Deferred; no tree or surroundings output yet | No | None | None |
| Title, body, excerpt, tags | No | Mutable/private content | Outside the projection | No | None | None |
| Placement, paths, markers, benches, reflections, relationships | No | Personal overlay | Overlay only | No effect on projection or asset identity | Overlay/base identity rules only | None |
| Current season, time, weather, wind | No | Transient presentation | Outside permanent tree identity | No | None | None |

Missing `createdAt` deterministically produces `creationSeason: "unknown"` and no palette override;
the ordinary phenotype-weighted, seed-selected palette remains in use. Optional ignored fields may
be absent without changing the result.

## Projection schema

The pure projection returns exactly JSON-serializable bounded decisions:

```text
schemaVersion, mappingVersion
specimen: derived unsigned seed and stable-identity source token
phenotype: canonical id and asset version
habitat: bounded id and soft-bias classification
permanentTraits: creation-season token and phenotype-owned foliage palette id or null
surroundings: empty bounded object in this slice
explanations: three code-owned reason tokens and short botanical statements
identity: complete projection fingerprint and output-only visual fingerprint
```

It does not return the post id, room, counts, content, or a serialized metadata snapshot. The full
projection remains a server-side development diagnostic. Only its output-only visual fingerprint
participates in the runtime asset cache key.

## Deterministic phenotype selection

Selection enumerates the canonical phenotype registry, sorts by stable phenotype id, and performs a
mapping-versioned deterministic weighted draw. Sorting makes a registry reorder harmless. Adding or
removing a registered phenotype or changing its meaning weights is a mapping change and requires a
mapping-version increment.

The phenotype-owned development weights are:

| Phenotype | Neutral grove | Rocky edge |
| --- | ---: | ---: |
| Open-crown deciduous | 5 | 3 |
| Sunset lanternwood | 3 | 2 |
| Wind-shaped highland conifer | 2 | 5 |

Both habitats retain all three phenotypes. Across the fixed 1,200-id distribution test, neutral
grove selected deciduous/lanternwood/conifer 602/345/253 times; rocky edge selected them
375/240/585 times. These numbers are diagnostics, not user-facing scores or a room taxonomy.

## Permanent creation-season evidence

UTC creation season selects exactly one existing foliage palette declared by the selected
phenotype. It does not spread or mutate phenotype objects, change the branch graph, alter
architecture, enlarge the canvas, increase leaves or nodes, or expand generator limits. Spring,
summer, autumn, and winter therefore leave a restrained color trace while every architectural
decision remains controlled by the stable specimen seed and phenotype ranges.

Changing only creation season preserves seed, phenotype, branch graph, architecture, bounds, and
complexity but changes the chosen palette and visual cache identity. The mapping is code-owned and
versioned; it is intentionally not a user-authored rule language.

## Future biome-to-habitat integration seam

The explicit habitat input in Milestone 7 is the narrow seam through which Milestone 8's generated
environment should eventually influence a newly placed writing tree. The expected dependency is:

```text
world seed + biome/world-generation version
                    ↓
        terrain and spatial biome regions
                    ↓
stable post-placement rule selects a world position
                    ↓
the biome at that position resolves to a bounded habitat classification
                    ↓
post identity + permanent writing evidence + captured habitat
                    ↓
             post-to-tree projection
```

The biome owns spatial terrain, surfaces, water, transitions, wildlife suitability, and broad
vegetation tendencies. Habitat remains a smaller ecological classification passed to the tree
projection; the projection should not consume the complete biome or terrain object. One biome may
resolve to more than one habitat at different positions—for example, an interior grove, rocky edge,
or wet margin—so habitat is not required to be synonymous with a biome name.

Initial generated placement should normally be map-first. A stable, versioned placement rule uses
post and world identity to choose an available position; the position's biome context supplies the
habitat; then the post-to-tree contract chooses phenotype and permanent traits. If the resulting
tree cannot occupy the chosen space safely, any retry or reservation rule must be deterministic and
versioned rather than allowing phenotype, request order, or camera state to move writing arbitrarily.
Rooms, popularity, and mutable activity should not secretly choose more prestigious biomes.

The resolved habitat and resulting semantic projection should be captured as writing-layer
historical evidence when the tree is created. Later biome-generator, renderer, or mapping upgrades
must not silently move or ecologically reinterpret established trees. Such a change requires an
explicit, auditable reprojection or world-migration decision.

Personal relocation is different from ecological reprojection. Moving a tree as curation preserves
its captured habitat, phenotype, specimen seed, permanent traits, post association, and asset
identity. Habitat describes the context in which the tree was generated, not a permanent restriction
on where its owner may place it. An owner may therefore create intentional ecological exceptions,
such as placing a palm-like tree in an alpine region. The tree must not decay, weaken, or become
mechanically disadvantaged because it is now outside its originating habitat. Changing its
ecological identity would be a separate explicit reprojection action, not a side effect of movement.

## Mutation and historical evidence policy

The projection describes a stable writing-layer record, not a live activity dashboard. A future
persistent system should capture its mapping version and derived decisions when a tree is created.
It should not silently reproject on ordinary post reads.

- Correcting a title or body, moving rooms, or changing activity counts does not restyle the tree.
- Correcting `createdAt` may change permanent evidence, but only through an explicit reprojection or
  repair operation whose old version can be audited.
- Changing explicit habitat is a generated-base decision and may change phenotype only through an
  explicit base reprojection. Manually relocating a tree through personal curation does not change
  habitat, projection, seed, phenotype, or asset.
- Upgrading the meaning mapping does not silently rewrite historical trees. A future migration must
  explicitly choose whether to retain the captured projection or create a versioned replacement.
- Renderer and phenotype upgrades may produce new pixels while preserving the captured semantic
  projection. Their existing renderer and phenotype versions remain the relevant invalidators.

No production persistence or migration mechanism is implemented by this experiment.

## Runtime identity and cache rules

Ordinary renderer-v3 assets keep their established key:

```text
tree schema + renderer id/version + phenotype id/version + seed
```

Projected assets append:

```text
meaning mapping version + bounded visual fingerprint
```

The visual fingerprint contains only derived output decisions (currently the palette decision).
The cache already contains the seed and phenotype identity, so it does not duplicate raw source
data. Two habitat inputs that happen to select the same phenotype and palette reuse pixels even
though their full diagnostic projection fingerprints and explanations differ. A creation-season
palette change or mapping-version change gets a different key. This preserves the rule that
nonvisual explanation changes do not invalidate pixels while no two different rendered outputs
share an identity.

Runtime asset schema version remains 2. Projected assets retain the same ordered rear foliage,
wood, and front foliage layers, up to three motion groups per foliage layer, architectural identity,
dimensions, anchor, and bounds. Neither the projection nor explanations are added to runtime assets
or either transport. Explicit-seed generator and diagnostic behavior remains unchanged.

## Forest Lab evidence

Forest Lab now runs its 24 fixtures through the projection instead of forcing phenotypes directly.
The curated set still contains exactly eight fixtures per registered phenotype and exposes each
fixture's phenotype, specimen seed, habitat, creation season, palette decision, three explanations,
mapping version, and diagnostic fingerprint. Final-tree, leafless-wood, and branch-graph views are
unchanged.

Three adjacent pairs isolate the contract:

- one post identity and creation date under neutral-grove versus rocky-edge habitat;
- one post identity and habitat with spring versus autumn creation evidence;
- one post identity, date, and habitat with very low versus very high word/activity counts.

The habitat pair preserves the specimen seed while selecting different phenotypes. The season pair
preserves its graph and architecture while changing only foliage palette and visual key. The
activity pair produces the exact same projection and reuses the same asset object.

On Node 24.15.0, one local cold generation of this fixture set took about 1.43 seconds, produced 23
unique assets (the activity pair shares one), and stayed within the registered maximum dimensions
of 112 by 142 logical pixels. The same assets serialized to 3,007,300 bytes as color runs and
215,783 bytes through the existing lossless-raster transport. These are local architecture checks,
not device benchmarks.

## Projected writing grove evidence

Milestone 7B adds the explicit `post-tree-meaning` development profile to the explorable Activity
Forest. It does not change the representative default or `botanical-range` profile. The semantic
profile generates the ordinary deterministic 180-placement layout, then cycles the 24 projection
fixtures across those placements. Each placement receives only its normal bounded spatial fields,
fixture id, phenotype id, specimen seed, and complete versioned asset key. It does not receive the
projection, habitat, creation time, counts, or explanations.

The server retains a request-local map from asset key to the projection needed to prepare that
asset. Initial and regional asset preparation consult this map and call the validated projected
generator; ordinary profiles use the established seed-and-phenotype path. The process-local scene
pool and lossless-raster cache remain keyed by the same complete runtime asset key. The map is not
serialized into the scene response.

The exploration fixture associated with each placement contains ordinary bounded writing display
fields plus a `treeMeaning` explanation projection. It includes mapping version, specimen seed,
phenotype id, habitat token, creation-season token, palette id, and the three code-owned explanation
tokens and sentences. It excludes counts, raw post identity, projection fingerprints, title/body
source fields beyond what the existing writing dialog already presents, and all generation data.
Inspecting a tree displays this explanation in the existing accessible dialog. Nearby-bench
reflection resolves the same full fixture before opening it, so it presents the same meaning without
changing nearby-writing selection or persistence.

This inspection panel is development instrumentation, not a proposed final player-facing design.
Phenotype ids, specimen seeds, mapping versions, palette ids, and rule explanations exist here so
the contract can be reviewed. A future product may offer a gentler optional “why this tree?” view,
but it should not expose cache identity or turn selection mechanics into an optimization guide.

The fixed scene has 180 placements, 24 inspectable writing fixtures, and 23 unique projected assets;
the controlled activity pair deliberately shares one asset. Its placement distribution is 61
open-crown deciduous, 59 sunset lanternwood, and 60 wind-shaped highland conifers. Habitat inputs
appear on 128 neutral-grove and 52 rocky-edge placements because the scene repeats the representative
fixture set rather than synthesizing a biome distribution. Every fixture appears seven or eight
times, making paired comparisons reachable without expanding the asset pool.

On Node 24.15.0, one local cold preparation of all 23 projected assets took about 1.37 seconds. The
complete asset array serialized to 2,874,169 bytes as color runs and 206,394 bytes through the
existing lossless-raster transport. Runtime assets retain schema 2, renderer version 4, their
registered phenotype versions, ordered layers, and at most three foliage motion groups. These are
local architecture observations, not browser or baseline-device frame-time claims.

## Remaining unknowns and Milestone 8 boundary

Real post distributions may reveal clustering by creation month, missing or corrected timestamps,
and whether the two habitat biases feel too weak or too classificatory. The projected grove now
makes ordinary scene-scale review possible, but the permanent tint still requires human judgment on
the intended baseline display and with representative source data. No conclusion should be drawn
about mutable activity or surrounding features
until representative product data and humane visual studies exist.

Habitat in the Milestone 7 control remains an explicit two-value fixture input used only to prove
selection. It is not inferred from rooms, placement, terrain, or user behavior. Milestone 8A now
exercises the future derivation seam in the separately selectable `first-regions` profile: placement
is chosen first, the shared environment query supplies captured habitat, and mapping v1 projects the
tree afterward. The Milestone 7 fixtures and `post-tree-meaning` scene remain unchanged. The bounded
environment grammar and its persistence boundary are documented in
[`environment-region-contract.md`](./environment-region-contract.md). Milestone 8B adds water and
two harness crossings without changing the position-first habitat projection or the Milestone 7 control.
