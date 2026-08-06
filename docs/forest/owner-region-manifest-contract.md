# Owner region manifest adapter contract

## Purpose

`readForestOwnerRegionManifest()` is the bounded database-to-scene boundary for a private owner's
durable writing trees. It reads a small exact set of spatial cells and returns only the placement
and visual identity needed to compose those trees into a scene. It does not render assets, inspect
writing, select translations, mutate the forest, or authorize an HTTP request.

The caller must derive `ownerUserId` from an already authenticated session. A production route must
not accept an owner id or username from URL or request data as authority.

## Exact regional input

One call accepts between one and nine exact signed spatial cells. Each cell contains only integer
`cellX` and `cellY`; duplicates, extra fields, unsupported ranges, malformed limits, and malformed
cursors fail before private database state is read. Cells are canonically ordered by Y and then X,
so request order does not change region identity.

The adapter uses spatial index version 1 and its fixed 720-unit cells. It queries the exact owner,
primary forest, active lifecycle, visible state, supported index version, and requested cell pairs.
The existing `forest_writing_tree_spatial_read` index supports this lifecycle-oriented access path.

Results are ordered by opaque `writingTreeId` and read with `limit + 1`. The default page is 100
placements and the maximum is 250. A returned cursor contains a version, a truncated SHA-256
fingerprint of the canonical requested cells, and the last tree id. It is an opaque continuation,
not authorization. Reusing it with another region fails before the owner world or trees are read.

## Honest world states

The adapter returns three states:

- `not-established`: the owner does not yet have a primary world;
- `reconciling`: the primary world has an active reconciliation lease; or
- `ready`: the requested cells were read from an idle, supported world.

The first two contain no placements and do not query writing trees. In particular, a running
reconciliation is not presented as a complete current scene.

Unsupported world identity, lifecycle, reconciliation state, placement policy, environment policy,
environment schema, or world-generation version fails closed as `OWNER_REGION_UNAVAILABLE`.

## Placement payload

A ready placement contains only:

```text
id
regionId
worldX
worldY
scale
collisionRadius
phenotypeId
assetKey
```

`id` is the opaque public writing-tree UUID. `regionId` is the signed derived cell identity.
Version 1 uses a fixed scale of `1`; scale is scene presentation policy, not new durable tree state.
Collision radius comes from the current phenotype scene-traits registry. `assetKey` is the complete
versioned tree-asset cache identity derived from the stored specimen seed, phenotype/version, visual
projection identity, renderer, and asset schema.

The response also declares the spatial-index cell size/version and the asset schema, renderer id,
and renderer version needed by a later delivery boundary. It deliberately contains no raw owner or
forest id, translation-group id, Block id, username, title, excerpt, body, route, translation
ancestry, founding evidence, or projection diagnostics.

## Fail-closed durable validation

Every returned record is revalidated before serialization. The tree must agree with the requested
owner and primary forest, be active and visible, and use supported ledger, identity, placement,
environment, projection, mapping, and asset versions. Signed coordinates must be safe integers;
their derived cell must equal the stored replaceable spatial index and belong to the exact request.

The stored creation season must select the phenotype's registered permanent foliage palette, and
that palette must agree with the visual fingerprint used in the asset key. Unknown creation season
must retain seed-selected foliage. A stale phenotype asset version is rejected instead of silently
rendering a newer-looking tree under old durable identity.

Malformed or unsupported returned records make the regional response unavailable. More than
`limit + 1` returned records likewise fails rather than silently trusting an unbounded model result.

## Deferred HTTP and rendering boundaries

This adapter is the pure regional read seam. The next production layer still needs to:

1. require current authentication and derive the owner solely from the session;
2. parse a bounded cell request and translate adapter errors into non-enumerating responses;
3. apply private, no-store cache headers and the appropriate `Vary` behavior;
4. authorize requested asset keys against the owner's current regional manifest;
5. generate or retrieve only the shared visual assets required by those keys; and
6. compose the initial private scene and later regional entries outside animation frames.

Writing recognition remains a separate reauthorized inspection boundary. The existing non-canvas
owner-writing route remains the semantic fallback and does not grant authority to this manifest.

## Verification

`spec/forestOwnerRegionManifestSpec.js` verifies honest empty states, exact signed-cell queries,
canonicalization, bounds, lifecycle filtering, privacy-safe serialization, region-bound cursor
continuation, stale spatial identity, and unsupported world/projection/asset versions without a
database.
