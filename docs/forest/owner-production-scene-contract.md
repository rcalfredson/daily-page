# Owner production forest scene contract

## First production view

`GET /forest` is the authenticated, localized, private visual Activity Forest route. It derives the
owner only from the current session, sets `Cache-Control: private, no-store`, varies on `Cookie`, and
never accepts an owner id or username parameter as authority.

The first view is intentionally read-oriented, with reversible owner-tree inclusion as its only
durable mutation. It supports signed-world exploration, restrained owner-environment ground,
regional writing-tree loading, reusable procedural assets, tree proximity focus, reauthorized
writing inspection, keyboard movement, touch-drag movement, reduced motion, and a direct semantic
fallback to `/forest/writing`. It does not include development profiles,
diagnostics, streams, bridges, visitors, discoveries, trails, gathering, construction, clearing
mutation, or `localStorage` authority.

The owner may hide a currently inspected tree through the durable inclusion endpoint. Success
removes that placement from the page-lifetime scene immediately; restoration remains available in
the hidden-tree writing management view. The browser never treats its local removal as mutation
authority.

Regional manifests and assets contain no writing metadata. A nearby tree can open the private
inspection boundary documented in `owner-tree-inspection-contract.md`; that boundary rechecks the
owner, tree lifecycle, current owner writing, and dynamically discoverable translations before
returning bounded recognition context and a canonical post link.

## Private bootstrap

The server reads the exact authenticated owner's primary world and returns one of three expected
states:

- `not-established`: no owner world exists;
- `reconciling`: the world has active reconciliation; or
- `ready`: supported stable scene identity can be rendered.

Unsupported, deleting, or incoherent worlds fail closed as a generic unavailable page. Empty and
reconciling states do not expose the owner-world seed.

The ready bootstrap contains only:

```text
bootstrap and policy versions
signed origin spawn and movement presentation values
720-unit spatial index identity
owner-environment grammar/version and opaque private seed
regional placement, asset, and inspection API paths
placement page, asset batch, and transport bounds
the initial 3×3 signed cells
```

It contains no owner id, forest id, tree id, Block/group id, writing metadata, reconciliation
cursor, lease evidence, or diagnostic timing. The environment seed is private generated-base
identity needed to reproduce the same stable patchwork in the browser; it is embedded only in the
private no-store HTML response and never placed in an asset cache key or log.

## Signed world and camera

The player begins at stable presentation origin `(0, 0)`. Camera coordinates and player position
are page-lifetime presentation state and are not persisted. Production-specific movement and camera
helpers allow negative coordinates and do not reinterpret durable tree placement as a finite
nonnegative Forest Lab rectangle.

The browser requests the player's spatial cell and its eight neighbors. This 3×3 window remains
within the nine-cell API bound and covers the supported viewport around the centered player. When
the player enters another cell, only missing nearby cells are requested. Each arbitrary missing-cell
set is paginated to completion; no tree is silently omitted.

Browser collision against currently loaded tree radii is presentation behavior, not placement or
mutation authority. Durable coordinates, server reconciliation, and server regional authorization
remain authoritative.

Touch and stylus movement displays a floating joystick centered on the initial contact point. Its
stick is visually bounded while the shared movement calculation applies a small dead zone and
scales to full speed. The joystick is transient page presentation: it is hidden on release,
cancellation, focus loss, page hiding, reset, and inspection opening. The gesture's maximum
displacement distinguishes an inspection tap from movement, so dragging away and back cannot
accidentally open a tree.

## Environment presentation

`public/js/owner-forest-environment.js` is now the shared pure owner-environment grammar used by
server placement and browser presentation. It preserves the version-1 coarse/fine signed value-
noise field, calm-grove/rocky-rise identity, intergrade, ground-surface selection, and suitability
calculation.

Ground presentation version 2 samples that field into restrained 48-unit flat tiles. Closely
related colors follow the continuous rockiness field, while deterministic grass, moss, pebble, and
small-stone marks give calm cores, intergrades, and rocky rises quiet local recognition. A soft
presentation-only influence makes the signed origin somewhat calmer and more open without changing
tree habitat, placement eligibility, collision, or durable world identity.

Ground details are derived only from the private world seed and signed tile coordinates. They are
painted below the player and writing trees, confer no interaction or resource identity, and require
no database record. The production scene still does not import the development stream, bridges,
interactive boulders, or finite terrain manifest. This flat presentation remains compatible with a
later height field and movable 3D camera: durable `(worldX, worldY)` remain horizontal ground
anchors, while the current terrain and camera are replaceable presentation.

## Regional browser pipeline

For each missing cell set the browser:

1. requests a placement page from `/api/v1/forest/regions`;
2. merges placements by opaque public tree id;
3. divides missing visual keys into batches of at most 24;
4. requests each batch from `/api/v1/forest/assets` using the same cells and page cursor;
5. decodes lossless raster layers and prepares sprites outside the immediate loop; and
6. continues the placement cursor until the exact cell set is complete.

Loaded and pending cell identities prevent ordinary duplicate regional requests. Assets are reused
by their complete visual cache identity for the page lifetime. The browser never receives the
durable projection used to generate them. Lossless raster preparation prefers
`createImageBitmap()` and falls back to object-URL image decoding when a browser exposes that API
but rejects a valid generated PNG.

The scene shows semantic live-region messages for loading, loaded tree count, and generic regional
failure. Server-rendered not-established, reconciling, unavailable, and no-JavaScript states keep
the writing-grove link available without Canvas interaction.

## Verification and deferred work

`spec/forestOwnerSceneBootstrapSpec.js` verifies supported world identity, privacy-safe bootstrap,
honest states, session-derived ownership, generic route failure, and localized routing.
`spec/ownerForestSceneSpec.js` verifies signed 3×3 cell selection, asset batching, signed camera and
movement, touch dead-zone and joystick policy, maximum-displacement gesture intent, collision
behavior, exact server/browser environment parity, deterministic origin treatment, and bounded
ground-detail distribution. `npm run forest:environment-preview` renders the fixed-seed version-2
overview in `tmp/` for visual review. Existing manifest and asset suites remain authority for
regional privacy and generation.

The next production boundary is end-to-end lifecycle, privacy, distribution, and performance
evidence, including canonical writing return continuity. Later scene iteration should measure and
visually review regional loading, ground treatment, viewport coverage, touch feel, keyboard focus,
reduced motion, empty/high-count histories, and cold/warm asset behavior before adding richer
environment or gameplay systems.
