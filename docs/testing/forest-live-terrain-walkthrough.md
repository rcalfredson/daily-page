# Live forest terrain: development walkthrough

The current branch supports generation-3 streams/ponds and generation-4 regional rivers/lakes,
generated timber bridges, and boulders on the private `/forest` route. Existing worlds keep their
established surface until explicit per-owner activation or upgrade. This walkthrough uses
`daily-page-test`; no production activation command is provided.

The [first live river/lake slice](../forest/live-river-lake-slice.md) documents the current
generation-4 review fixture, explicit `--generation=4` activation, safe `--upgrade` workflow,
lake animation, bounds, and validation. `npm run forest:terrain-live-review` opens an account-free
real-template fixture on port 4179; the original scale study remains on port 4178.

## Enable one development account

Use Node 24 through Robert's nvm. Start the development app normally and visit the forest with an
account that already has writing trees. Then, from the repository, run:

```bash
FOREST_LIVE_TERRAIN_ENABLED=true npm run forest:terrain-activate -- YOUR_USERNAME --write
```

An owner ObjectId is also accepted. The helper resolves the account in `daily-page-test`, creates
the protection indexes, captures existing placements in bounded transactions, verifies local access,
and publishes the complete terrain descriptor. It refuses production configuration. It does not
change `.env`, existing tree/marker identities, or captured tree ecology.

Reload `/forest` after the command reports activation. The app does not require the activation flag
to remain enabled: already activated terrain stays authoritative. Use the existing
`FOREST_WRITING_LINKS_ENABLED=true` setting too if testing creation of writing-linked markers.

Large accounts may require another invocation; rerunning resumes the same operation. During
preparation, new tree allocation and marker placement/movement pause while existing forest reads
remain available. To abandon **unfinished preparation**, run:

```bash
npm run forest:terrain-activate -- YOUR_USERNAME --write --cancel
```

Cancellation drains partial protections in bounded batches. It cannot turn an already activated
world back into terrain-free land.
During an upgrade, cancellation discards only the replacement operation and retains the old active
terrain. Once the new generation is published, cancellation cannot restore the previous one.

## Human walkthrough

1. Enter and move immediately with the keyboard. Find nearby water and boulders; their locations
   depend on the account's existing seed and frozen placements. There is no large excluded district.
2. Walk along a stream and around a pond. Water and boulders should block walking; dry banks remain
   usable. Follow a generated bridge across the water. The avatar should rise onto its deck, with
   timber rails ordered around it.
3. Try placing a marker on water, rocks, or a bridge approach. The preview should reject that spot
   with terrain-specific copy. Place one on clear ground, move it, and remove it.
4. Read writing from a tree or linked marker, then return. The avatar should arrive on clear ground
   near the selected place, with keyboard focus ready. Use the entrance control afterward.
5. Reload and return in a new session. Streams, ponds, rocks, bridges, and previous placements should
   retain their positions. Moving or removing a marker must not reshape the landscape.
6. Check a hidden/restored tree and a previously placed marker. Their places must remain accessible.
7. Repeat movement, inspection, crossing, and placement on a physical touch device. Also inspect
   reduced motion: geometry and crossings remain usable without moving water glints.
8. Keep a pre-activation page open during activation, then attempt a new placement there. It should
   require reload rather than commit using the old terrain rules. An equal retry of an already
   committed mutation still recovers its saved result.

Record commit, account/data shape, browser/device, and observations. Automated narrow-screen
coverage is not physical-touch acceptance. The browser fixture uses schematic tree assets; the
normal development route uses the account's actual generated tree assets.

## Automated evidence

- `npx jasmine`: geometry, private transport, version dispatch, retry/placement, preparation,
  cancellation/publication, return navigation, and cleanup coverage.
- `npm run forest:terrain-preview`: schematic overview, labeled water detail, and scale comparisons.
- `npm run forest:terrain-fixture -- --write`: guarded real MongoDB fixture using reserved owner
  `64b00000000000000000a071`, username `forest_live_terrain_fixture`, only in `daily-page-test`.
  It verifies rollback, capture of hidden trees/tombstones, actual access verification/publication,
  unchanged existing markers, stale-client rejection, terrain collision, safe return, and index use.
  It removes its reserved records in `finally` and refuses an owner collision.
- `scripts/dev/checkForestWritingReturn.js`: database-free Firefox BiDi walkthrough with the real
  production template, terrain region handler, private-response middleware, and browser modules.
  Covers 1280px and 390px terrain loading/collision/elevation, plus the prior writing/marker loops.

No participant-pilot, physical-device, or production-rollout acceptance is implied by these checks.

## Shared terrain style review

The live scene and experimental map now share the original bank-detail, stepped-current, and
boulder painters. Reload an already activated forest to see the updated presentation; do not
reactivate it. Water outlines, rock anchors, collision, and captured placements are unchanged.
Review soil/grass/root/stone/log details, downstream currents, pond inlets without internal shore
seams, and the familiar rock variants. Reduced motion retains static water texture.

With Firefox BiDi running as required by the browser fixture, capture the optional material
comparison as well as the normal route screenshots:

```bash
FOREST_TERRAIN_STYLE_REVIEW=true FOREST_RETURN_SCREENSHOT_DIR=/tmp/forest-terrain-style node scripts/dev/checkForestWritingReturn.js
```

The comparison uses the original bank model on the left and the live channel/pond adapter on the
right, with identical boulder examples. It is a material reference, not the full experimental
scene. Its page is served only by the temporary test server, not the production application.
