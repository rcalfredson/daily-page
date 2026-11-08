# Live forest water and landscape rethink — starter prompt

Prepared November 8, 2026. Use this as the opening brief for a fresh implementation thread in this repository.

## What I want to achieve

Continue developing Daily Page's live Activity Forest into a game worth playing and a place worth inhabiting, by my own standards as a gamer, writer, and sandbox lover. I have deliberately deferred the participant pilot while we build a more compelling environment. Do not redirect this work toward recruiting participants or treat more terrain features as evidence of product validation.

Our immediate priority is to rethink the water formations. We recently connected terrain to the live owner forest and restored much of the experimental map's bank, current, and boulder styling. That improved the materials, but it has not solved the underlying composition and scale problems. Please approach those problems afresh rather than assuming another surface-detail pass will fix them.

After water feels convincing, I want to continue elevating the terrain and biomes: larger lakes, connected rivers, coastlines/seas, rocky terrain, snowy regions, and eventually wildlife such as the experimental birds. That is the direction, not a request to implement all of it in one increment.

## My concerns and aesthetic goals

- Current water formations sit awkwardly between satisfying cartoon stylization and convincing naturalistic landscape art. I am comparing them with coherent pixel-art environments in other games. Mario-like clarity and a more naturalistic artistic stream are examples of successful approaches, not instructions to copy either game's assets or to mix their styles.
- Scale feels wrong relative to the avatar and walking speed. A complete headwaters-to-receiving-pond system can feel like something I walk past in a few seconds. Even a creek should suggest a longer, continuous landscape feature, and a river much more so. Assess actual travel times and visible scale rather than merely enlarging a screenshot.
- The stream-to-receiving-water transition feels too compressed and diagrammatic. I want continuity and a sense that the water belongs to a larger landscape.
- The receiving pond generally looks too small. The primary formations should lead toward a substantial lake or sea-scale body of water. Small ponds can still exist as a secondary landscape feature; they should not remain the default answer to every stream outlet.
- Exposed headwaters currently look awkward. I am open to sources being implied beyond the visible area or encountered only occasionally, rather than always seeing an entire tiny catchment. This is a design question, not a requirement to show a spring at the top of every stream.
- I want a coherent visual language: pleasing shore silhouettes, readable channel widths, intentional bends and confluences, restrained flow marks, and a believable relationship between water, banks, rocks, bridges, trees, and the avatar. More noise, more particles, or faster animation alone will not address this.

Please distinguish channel/shore geometry, world scale and continuity, screen-space composition, and pixel rendering. Diagnose which layer is responsible before changing it. Previous stylistic parity was a useful foundation, not final visual acceptance.

## Start by verifying the repository

Read applicable `AGENTS.md` instructions and inspect branch/status before editing. Use Node through Robert's nvm, for example `source /home/robert/.nvm/nvm.sh` and `nvm use 24.15.0` where available. Do not discard local work.

At handoff we are on `feat/forest-live-terrain`, with extensive **uncommitted** implementation and documentation from this terrain effort. The earlier owner-writing/marker PR was deployed, but that does not mean this branch's terrain work is committed or deployed. Verify current state rather than treating this note as a Git guarantee. I make commits myself; suggest a conventional commit message when a coherent slice is ready, without committing or deploying for me.

Read these first:

1. `docs/forest/live-terrain-increment-1-design.md`. Its historical checkpoints describe several stages; the later live-scene and shared-presentation sections supersede earlier claims of incomplete integration.
2. `docs/testing/forest-live-terrain-walkthrough.md`.
3. `docs/forest/owner-production-scene-contract.md`, `owner-environment-resolver-contract.md`, and `environment-region-contract.md` as needed for their boundaries.
4. `docs/forest/activity-forest-long-term-gameplay-vision.md` for the broader direction. The older `activity-forest-reboot-starter-prompt.md` is context, not a new instruction to restart its milestone or undo our decision to defer the pilot.

Trace those documents into current code before proposing a change.

## Current implementation to understand and reuse

### World geometry and integration

- `public/js/owner-forest-terrain.js`: deterministic generation-3 geometry shared by server and browser. Current signed terrain districts are 1,920 world units across. Each generated system is a bounded main channel, two feeders, small source areas, and an irregular receiving pond. Separate district systems do not form a continuous regional river network.
- Main-channel longitudinal span is approximately 440–1,380 world units before meandering; receiving basins are only a few hundred units across. The current bootstrap movement speed is 108 world units/second. Verify these values and account for projection, camera size, and actual walked paths when assessing the experience; they do not establish a physical meters-per-unit scale.
- `public/js/owner-forest-terrain-access.js` and `owner-forest-terrain-scene.js`: access/collision, bounded district cache, live drawing, bridge elevation, and depth ordering. `owner-forest.js` and `owner-forest-scene.js` connect movement, inspection, markers, and return navigation.
- `server/services/forestOwnerTerrain.js`, `forestOwnerTerrainActivation.js`, and `forestOwnerTerrainRegion.js`: frozen protections, bounded authoritative reads, activation/access verification, and private regional delivery. Also inspect placement, tree allocation, and return-destination services when geometry changes.
- Activated worlds use bootstrap version 4 and terrain tokens. Legacy worlds remain terrain-free with bootstrap version 3. Marker placement/movement in activated worlds uses mutation protocol 3; retry identity and existing marker schema/link formats remain separate concerns.

### Presentation and earlier experiments

- `public/js/forest-terrain-paint.js`: shared pixel painters extracted from the experimental renderer, including bank details/marks, stepped currents, and original boulder variants/palettes.
- `public/js/owner-forest-terrain-presentation.js`: presentation version 2; adapts the original bank model to arbitrary live channels and closed shores. Water textures and currents follow the existing geometry. Exterior-shore effects avoid internal pond-inlet seams; currents taper into ponds. Reduced motion freezes animation.
- `public/js/activity-forest.js`, `forest-environment.js`, `forest-stream-banks.js`, `forest-bridges.js`, and `server/services/forestTerrainFeatures.js`: experimental reference implementations. Reuse useful techniques while recognizing their finite-map assumptions. Other experimental terrain/wildlife code should be discovered from this entry point before proposing later biome work.
- `scripts/dev/forestTerrainStyleReview.html`: a fixture-only comparison of original bank materials and the live adapter, with identical rock examples. This proves shared materials, not successful world composition or scale.
- `scripts/dev/renderForestOwnerTerrainPreview.js`: terrain overview/detail generation. Improve visual review tools if necessary so I can judge candidate shapes with an avatar, a real camera window, and movement rather than only an abstract diagram.

## Design constraints and choices to revisit explicitly

The earlier choice to restrict this increment to short district-local streams and small receiving ponds was a scope compromise. **It is open for reconsideration.** Do not use that historical exclusion to reject larger lakes, longer watercourses, or regional continuity when those are what the experience needs. Conversely, we do not need a full physical hydrology simulation or a continent generator to make one compelling landscape slice.

If sources or outlets extend beyond the screen, they must remain part of deterministic world geometry. Do not hide ends by making generation depend on the viewport or by moving boundaries as the camera travels. Crossing a loaded-region boundary should reveal a continuing world, not a newly capped stream or a seam. Larger features may require revisiting district ownership, feature reach, neighboring queries, transport size, and caching; do not simply multiply dimensions while retaining bounds that no longer cover them.

Keep these guarantees:

- Preserve owner/world identity, seed, existing writing-tree and marker coordinates, authored relationships, captured ecology, private account isolation, and durable retry semantics.
- Retain small local protections and usable approaches around existing places. We explicitly rejected a large permanently dry protected district. Do not silently restore one or carve obvious unnatural corridors without reviewing the visual consequences.
- Browser visuals, walking, server placement/tree allocation, bridge crossings, and safe return destinations must agree. Bridges need clear approaches and correct depth/elevation. Water cannot merely look impassable while placement ignores it.
- Keep signed-coordinate generation deterministic across request order, region boundaries, reloads, and animation time, with bounded reads/payloads and responsive rendering.
- A paint-only change may use a presentation revision. Changing authoritative water/rock/bridge footprints or anchors needs a terrain-generation/version and compatibility decision. Do not regenerate already activated worlds under an unchanged generation identity. Plan how existing activated development worlds can safely test the new geometry; do not assume cancellation reverses published activation.
- Development activation is currently explicit per owner. Do not couple this aesthetic work to automatic activation or a production rollout. Existing-world compatibility is still relevant even when only development accounts have been activated.
- Preserve keyboard focus, accessible semantic writing routes, linked-marker/read/return loops, reduced motion, and touch usability.

## How I would like this thread to proceed

First, briefly reconstruct the actual state and give a candid diagnosis of the water's shape, scale, and styling. Bring your own judgment; do not just agree or add ornamentation. Compare a small number of viable directions and recommend one coherent visual/landscape approach. Use original visual sketches or in-repository previews if they help; avoid a long research detour.

Then propose a bounded first slice with concrete dimensions and travel-time targets, including the transition into a meaningfully larger receiving body and a deliberate treatment of upstream continuation/headwaters. Explain the versioning and integration implications before changing authoritative geometry. Record the chosen direction in a short design note or update to the current note. Do not create a large speculative specification for every future biome.

Proceed with reversible preview/presentation work and the first sustainable implementation slice within this scope. Ask only where a real aesthetic choice or durable compatibility decision needs my input. Give me something concrete to experience and judge, with exact instructions for opening it. A preview is useful evidence; label it accurately until the same approach works in the live forest.

Judge the result by these questions:

1. Does the water look like it belongs in one intentional pixel-art world?
2. Does walking alongside it feel like exploring a landscape rather than walking around a miniature diagram?
3. Does the larger receiving body read as a lake or coastal water at normal avatar/camera scale?
4. Do inlets, bends, confluences, and upstream continuation remain convincing as the camera moves?
5. Do existing writing places remain stable and accessible, with collision and bridges matching what I see?

After that slice, identify the next terrain/biome increment based on what actually improves the environment. Keep long-term snowy areas, coasts, rivers, wildlife, and reasons to explore in view without implementing them all before we can assess the first result.

## Validation and handoff evidence

At the previous checkpoint, 1,442 Jasmine specs passed, lint passed, and database-free Firefox walkthroughs passed at 1,280px and 390px, including terrain collision/elevation and writing/marker returns. These are historical results, not proof of future changes or physical-touch acceptance. `npm test` has an autofixing pretest; direct `npx jasmine` is available for a non-mutating run.

Relevant commands and fixtures:

- `npm run forest:terrain-preview` for generated overview/detail artifacts.
- `scripts/dev/checkForestWritingReturn.js` for the real-template, database-free browser walkthrough. Its optional `FOREST_TERRAIN_STYLE_REVIEW=true` and `FOREST_RETURN_SCREENSHOT_DIR=...` produce comparison screenshots; inspect its Firefox BiDi setup requirements.
- `npm run forest:terrain-fixture -- --write` for guarded real-Mongo integration in `daily-page-test`, using a reserved owner and cleanup. Run it when persistence/activation changes justify it; this is not permission to alter ordinary accounts or production data.
- `FOREST_LIVE_TERRAIN_ENABLED=true npm run forest:terrain-activate -- YOUR_USERNAME --write` is the existing explicit development activation workflow. Consult the walkthrough and any new compatibility plan before using it. Do not run this against an arbitrary existing account as part of setup.

Test the changed boundaries meaningfully, retain existing regressions, and visually review multiple seeds, camera positions, and region boundaries at normal play scale. Report remaining limitations honestly. Leave changes reviewable and uncommitted for me.
