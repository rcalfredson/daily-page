# First live river/lake slice

November 8, 2026 · `feat/forest-live-terrain` · explicit development activation only.
This implements the accepted [landscape study](river-lake-landscape-study.md) in the owner scene.
No ordinary account was activated or upgraded, and nothing was committed or deployed.

## Landscape and presentation

Generation 4 shares `forest-river-lake.js` with the accepted preview. A complete system belongs
to a fixed 15,360-unit landscape region, centered on a signed world lattice. It spans small
1,920-unit loading cells without being clipped, capped, or regenerated at their boundaries.
Water stays at least 100 units inside the larger region; adjacent regions retain connected dry
perimeters. These are regional freshwater systems, not rivers connected across every region.

There are three composition families: sweeping river, elongated lake, and broad basin. River
span varies independently over 9,600–11,000 units, ordinary channel widths roughly 83–199 units,
and bends, lake axes, tributary length/junction, mirrored handedness, and sixteen orientations
vary deterministically. Every accepted system has a substantial lake and the study's curved
inlet. One long tributary and two main-channel crossings plus a tributary crossing are included.
Bridge selection tries bounded alternatives and rejects flooded approaches. More branching,
peninsulas, coastlines, snow, and wildlife remain follow-ups.

Presentation revision 3 keeps the shared pixel banks and rocks, removes broad channel color bands
for the larger systems, reduces texture/current density, and fades downstream cues before the
lake. Lake ripple groups gently expand/contract and change brightness in place. Their world-grid
anchors do not move with the camera, and they have no downstream translation. Reduced motion
holds a static frame. These effects never change authoritative footprints.

## Access and bounded authority

Generation 3's sampler remains unchanged. `owner-forest-terrain-authority.js` explicitly dispatches
between generations; server placement, allocation, return predicates, browser walking, and paint
consume the corresponding geometry.

Generation 4 proposes the full landscape around local protected footprints, then chooses a clear
cardinal approach from each reserved place to the region perimeter. It tries the nearer approaches
first, with a maximum length of 9,600 units. Candidate water must leave the complete approach clear;
water is never carved into corridors or circular holes. Rocks avoid those approaches too. If all
12 placement/orientation candidates conflict, omit that system while retaining safe land and rocks.
This avoids reserving the old small-cell dry grid through the new river, or excluding a large
district around the entrance. Dense content can still suppress a regional system.

Activation verifies each place against actual tree bodies and swept movement using a bounded
8-unit approach grid, at most 32,000 positions per transaction. Reads include rounded grid vertices
over loading boundaries. There is no whole-world pathfinder or page-load activation scan.

The server reads the complete home region's frozen protections, plus an outer small-cell margin
for neighboring footprints, before choosing geometry. Density overflow above 512 local records
fails closed; this is now a larger spatial density constraint than generation 3's district query.
It remains a limitation to measure on substantial accounts, not a lifetime post-count limit.

Private region responses deduplicate complete systems into `features`; small `districts` reference
them and carry local rocks. The existing nine-request-cell and 256,000-byte response limits remain.
A browser neighborhood at a region corner includes at most four complete systems. Arbitrary widely
separated cell requests can exceed the payload limit and are rejected. Browser cells are bounded
at 25; unreferenced feature models are evicted. Painting culls banks, texture, rocks, and bridges.
Missing, changed, unsupported, or malformed geometry blocks walking/placement rather than becoming
clear land. Frozen source identities and the world seed are absent from terrain responses.

## Existing-world compatibility and upgrade

Unactivated worlds retain the old terrain-free surface. Existing generation-3 worlds retain their
exact geometry and descriptor. No automatic activation or upgrade occurs. Ecology version, world
identity/seed, authored identity, writing coordinates, relationships, and retry fingerprints stay
unchanged. Activated scenes still use bootstrap 4 and placement protocol 3.

The explicit upgrade from generation 3 to 4 stores a separate resumable operation under the old
active descriptor's `replacement` field. Old terrain remains readable during preparation; new
spatial allocation and marker create/move pause under the existing owner fence. Equal committed
retries still recover. Capture scans all current reserved trees and markers again, including places
created or moved since the original activation, hidden trees, and retained removed markers.

After new access verification, one owner-fenced transaction publishes the new generation and
activation token. Old tokens cannot create new placements; committed retries keep their identity.
The old frozen set is retained until publication, then drained in bounded batches using its retired
activation id. Cleanup does not block new placements or affect current geometry. Interrupted
cleanup resumes, including with the activation gate off. Cancellation drains only an unfinished
replacement and keeps the previously published terrain; it cannot roll back a published upgrade.
Read APIs continue checking activation identity before delivering a response across publication.

Generation 4 is a new authoritative identity. Future footprint/anchor changes require another
generation decision; do not change this generator underneath an activated generation-4 owner.

## Review and use

Restart the development app with this code before activating or upgrading an account.
For an existing generation-3 development forest, the explicit command is:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
FOREST_LIVE_TERRAIN_ENABLED=true npm run forest:terrain-activate -- YOUR_USERNAME --write --upgrade
```

For a forest without activated terrain, replace `--upgrade` with `--generation=4`.
The helper refuses production configuration and requires `daily-page-test`. It never resets a seed
or changes placements. Large operations pause after bounded work; rerun the same command to resume.
Reload `/forest` after publication. Do not reactivate or reset an already active world.

Cancel unfinished capture/verification with
`npm run forest:terrain-activate -- YOUR_USERNAME --write --cancel`.
Finish retired protection cleanup with
`npm run forest:terrain-activate -- YOUR_USERNAME --write --cleanup`.
Neither command requires the activation gate; cancellation after publication is rejected.

For an account-free review of the actual owner template and browser modules:

```bash
npm run forest:terrain-live-review
```

Open **http://127.0.0.1:4179/en/forest?fixture=terrain-camera-inlet**. The fixture banner links to
bend, bridge, inlet, lake, and writing-grove cameras. Movement, water/rock collision, elevated
crossings, region delivery, and lake presentation use the live modules. The page is explicitly
a fixture with schematic writing assets, in-memory markers, and no account/database writes;
it is not a substitute for personal-account and physical-touch acceptance. Stop with Ctrl-C.
Optional port: `FOREST_TERRAIN_REVIEW_PORT=4180`. Optional seed: `FOREST_TERRAIN_SEED` (32–80
base64url characters). The older `npm run forest:water-study` remains available at port 4178.

## Validation

Relevant commands:

- `npx jasmine` and `npm run lint`, plus explicit lint for browser/development modules.
- `npm run forest:terrain-fixture -- --write --generation=4`: fresh activation of the reserved owner.
- `npm run forest:terrain-fixture -- --write --upgrade`: generation-3 activation, later placement,
  upgrade cancellation/resume, old-terrain reads, write fencing, new capture, atomic publication,
  stale tokens, equal retries, unchanged tree/marker records and seed, and retired-only cleanup.
- `FOREST_TERRAIN_GENERATION=4 node scripts/dev/checkForestWritingReturn.js`: real-template Firefox
  checks, lake motion/reduced motion, collision/elevation, and existing writing/marker return loops.
  Firefox BiDi must already be running, as described in that script. Set
  `FOREST_RETURN_SCREENSHOT_DIR` to retain views. Generation 3 remains the default test mode.

Three final review seeds exercise all families:
`regional_review_seed_0123456789abcdef_0` (broad basin), suffix `_1` (long lake), and `_2`
(sweeping river). Desktop/phone screenshots are in `/tmp/forest-regional-final/seed-{0,1,2}/`.
These are local evidence, not repository assets. The final regression run passed 1,473 Jasmine specs,
repository lint, explicit lint of browser/development modules, and `git diff --check`. The real-Mongo
fresh generation-4 activation fixture and the upgrade fixture passed. Upgrade coverage includes
cancellation/resume, publication, exact retries, unchanged stored places and
seed, stale tokens, and retired-only cleanup. The three-family Firefox review passed at 1280px and
390px, including active lake motion, frozen reduced motion, collision/elevation, and the existing
writing/marker loops. The standalone live-template launch and generation-4 bootstrap were verified.
No ordinary account was touched. Physical touch, broader account density, and a real owner's aesthetic acceptance remain
open. The next landscape increment should compose rocky shores and tree masses around this slice
before adding more distant biomes or wildlife.
