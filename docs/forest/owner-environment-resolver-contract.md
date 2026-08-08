# Owner-world environment resolver contract

## Purpose

Durable owner-grove placement uses an expanding signed coordinate plane centered on `(0, 0)`.
The finite Forest Lab environment manifest cannot classify those coordinates without resizing or
reinterpreting the world. Owner-world environment policy version 1 therefore uses a separate,
small server-side resolver before the first durable writing tree is created.

The resolver is production placement authority. Canvas state, viewport size, camera position,
loaded regions, total tree count, and current world dimensions are not inputs.

`worldX` and `worldY` are stable ground-plane coordinates, not Canvas pixels. Version 1 does not
declare that the world is permanently flat or that its camera is permanently fixed. A later 3D
renderer may treat them as the horizontal components of a world transform and derive elevation
from separately versioned terrain. If elevation or a full transform later becomes durable identity,
it requires an additive coordinate-frame or anchor revision rather than silently changing these
coordinates.

## Version 1 identity

- environment policy version: `1`
- environment snapshot schema version: `1`
- world generation version: `1`
- grammar id: `owner-grove-patchwork-v1`

An unsupported version fails closed. Changing the grammar's meaning requires advancing the
appropriate version; editing version 1 in place must not move habitat boundaries or change tree
suitability.

## Signed-coordinate grammar

The grammar combines two seeded, smoothly interpolated value-noise layers anchored to the integer
world plane. One coarse layer creates broad regions and one lighter fine layer softens their edges.
`Math.floor`-based lattice addressing treats negative and positive coordinates consistently.

The resulting bounded rockiness value selects the established vocabulary:

| Evidence | Calm side | Rocky side |
| --- | --- | --- |
| Region | `calm-grove` | `rocky-rise` |
| Habitat | `neutral-grove` | `rocky-edge` |
| Ground | `grove-moss` | `weathered-rock-grass` |
| Core transition | `grove-core` | `rocky-core` |

The bounded middle band is `intergrade`. Nearby coordinates vary smoothly, while distant areas and
different owner-world seeds can produce different region mixtures. Outward expansion adds queries;
it never changes an earlier coordinate.

This first grammar deliberately has no stream, bridge, elevation model, season simulation, or
mutable terrain. Those features require separately versioned policy rather than borrowing the
finite development-world manifest.

`worldX` and `worldY` are durable ground-plane anchors, not a declaration that the world is always
two-dimensional. A later generation may derive terrain elevation and surface normals, introduce an
explicit spatial-schema revision where necessary, regenerate three-dimensional tree geometry from
the captured specimen evidence, and offer a movable perspective camera. Camera state remains
presentation state. The initial orthographic view can remain a camera preset, while version 1
retains a defined flat compatibility surface until an explicit elevation policy is approved.

## Placement suitability

Each coordinate also receives a deterministic tree-density decision. Calm ground has a higher
density than rocky ground. The placement allocator uses the resolver's strict boolean exclusion
adapter before accepting a candidate, so unsuitable candidate slots advance normally and retries
remain deterministic.

Suitability, rockiness, and grammar diagnostics are decision evidence only. They are not copied
into the writing-tree ledger.

## Durable capture

An accepted tree copies exactly this immutable snapshot:

```text
policyVersion
schemaVersion
worldGenerationVersion
regionId
habitatId
groundSurfaceId
transitionState
```

The snapshot selects founding projection habitat and explains the tree's original ecology. Later
grammar changes, display changes, post edits, and outward growth do not rewrite it.

“Originating” is intentionally historical. It does not attempt to store the complete current
environment and does not prevent separately versioned terrain geometry, ecological overlays,
weather, lighting, three-dimensional assets, or movable orthographic/perspective cameras.

## Current boundary

The shared pure grammar now lives in `public/js/owner-forest-environment.js`. The server resolver
adds strict policy input and output validation around that sampler for placement classification and
exclusion. The private production `/forest` bootstrap supplies the same opaque owner-world seed and
versions to the browser, which uses the shared sampler for restrained flat ground presentation.

The resolver does not create the owner world, query occupied neighborhoods, reserve a candidate
slot, or write a tree. It also does not make browser ground or collision authoritative.

For lightweight spatial review, run:

```bash
npm run forest:environment-preview
```

The ignored SVG and PNG outputs in `tmp/` compare two seeds with 600 environment-filtered tree
placements apiece.

## Local visual review

Run:

```bash
npm run forest:environment-preview
```

The ignored SVG and PNG in `tmp/` show the smooth habitat field and 600 suitability-filtered trees
for two seeds. This is review instrumentation, not a runtime terrain asset or production renderer.
