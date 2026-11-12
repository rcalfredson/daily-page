# Home/cart increment 1: geography and travel study

November 10, 2026 · `feat/forest-home-cart-expedition`

This records the original geography/travel study. The same development preview now also includes
[increment 2 construction and presentation](home-cart-increment-2-construction.md); the findings and
measurements below remain the evidence from increment 1.

This implements the first increment of the accepted
[home/cart brief](home-cart-expedition-implementation-brief.md). It is an isolated development
study in the ordinary owner template. It does not connect to a database, read an account, create
permanent geography, or implement crafting and relationships. Owner judgment of the experience
and physical-device review remain separate from the automated evidence below.

## Run and play

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
npm run forest:home-cart-study
```

Open **http://127.0.0.1:4183/en/forest**. The server binds only to loopback. All mutation requests
return an explicit study-only rejection. Reload resets the temporary home/cart presentation.

1. Enter the cart with its button or **C**. Use arrows/WASD or touch-drag to travel.
2. Follow the pale trail to the Amber clearing. Stop, step out, and look around.
3. Re-enter and drive home. The guide changes after exploring the destination on foot.
4. **Reverse** or **R** allows backing up; movement input still indicates the desired travel
   direction. Release movement to stop. The cart turns toward the input rather than rotating instantly.
5. Above the forest, expand **Study options & recovery**. Switch between the compact open cart and
   larger canopy cart; changing the cart returns it and the player home. The two house shells test
   footprint/visual size. These selectors are study presets, not the future assembly editor.
6. Try delayed or unavailable region delivery, then restore Normal. Movement waits for known
   surroundings. **Recover at home** is an explicit development recovery action and restarts the
   trip's progress indicator. It is not a saved-game or inventory operation.

The house is an exterior shell. Its door, destination props and animal have no conversation,
gathering or interior actions yet. Existing writing inspection, markers and garden presentation
use the owner scene; displayed writing and possessions belong only to the fixture. The fixture
does not pretend that its rejected garden/marker mutations are production persistence.

For alternative geography, stop the server and select a different case:

```bash
FOREST_CART_GENERATION=3 FOREST_CART_SEED=1 npm run forest:home-cart-study
FOREST_CART_GENERATION=4 FOREST_CART_OCCUPANCY=empty npm run forest:home-cart-study
FOREST_CART_GENERATION=0 npm run forest:home-cart-study
```

Generation choices are `0` (terrain-free), `3` and `4`; seed indices are `0`, `1`, `2`.
Occupancy choices are `empty`, `mixed`, `dense`, `blocked`. Port defaults to 4183 and can be changed
with `FOREST_CART_PORT`. An unavailable case returns a clear failure page and a report; it never
moves trees or invents a replacement world.

## What the study establishes

The planner uses the current generation-3/4 geometry with fixed fixture protections. It does not
regenerate terrain around a proposed house. Existing writing-shaped obstacles, markers and plants
are supplied before candidate selection and remain in place. The sample populations are synthetic;
this is not a survey of real accounts.

The search tries at most 32 home positions inside a 7,200-unit square. A candidate must clear the
largest home envelope, parking area, a walking approach from the original entrance, an expedition
route and a destination. Routes have at most one right-angle bend; candidate directions and bends
are finite. More complex paths may exist when this search fails.

The largest study house has a 180×100 ground footprint inside a 320×360 home envelope. The road
checks use an 84-unit half-width and explicit turning spaces. Small overlapping terrain samples
conservatively cover these larger spaces; their overhang can reject otherwise usable land. The
sample budget is 100,000 terrain evaluations per case. Budget exhaustion and search exhaustion
are different reported outcomes.

The resulting plan contains proposed coordinates and footprints, never saved reservations.
Neither an accepted candidate nor a painted trail proves compatibility with future writing or
terrain upgrades. Those require the durable integration described below.

### Placement matrix

Reproduce the 36-case investigation with:

```bash
npm run forest:home-cart-report
```

Three seeds × three terrain modes × four occupancy cases produced these results:

| Terrain | Empty | Mixed | Dense | Intentionally blocked |
| --- | --- | --- | --- | --- |
| Terrain-free | 3/3 ready | 3/3 ready | 3/3 ready | 0/3 ready |
| Generation 3 | 3/3 ready | 3/3 ready | 2/3 ready | 0/3 ready |
| Generation 4 | 3/3 ready | 3/3 ready | 2/3 ready | 0/3 ready |

“Empty” retains entrance landmarks; it has no synthetic writing population. Mixed supplies up to
70 distributed obstacles, dense up to 240, with a clear initial entrance. Blocked deliberately
rejects every proposed site to exercise failure behavior.

The latest recorded run took at most 181 ms per case and evaluated at most 7,561 terrain samples.
These are local Node measurements, not server latency guarantees. All nine blocked cases failed
without a plan. Two of the 27 non-blocked cases exhausted the limited search; both were dense worlds.
None exhausted the sample budget.

This supports pursuing connected placement with explicit failure handling. It does not justify a
promise that every account can receive a continuous home and expedition area. Before general
enablement, test more representative occupancy and decide what to offer when this bounded search
cannot find a site. A separate area remains a product alternative, not an automatic fallback.

## Movement findings and implementation

`public/js/forest-cart-motion.js` defines two study vehicle sizes. Both travel at 224 world units
per second, compared with the existing 108-unit walking speed. Backing up is slower. A compound
footprint covers the cart body, shafts and animal using circles small enough for existing terrain
queries. Sweeps include the arc of the animal during turns, with bounded substeps and a clamped
elapsed time. Testing only the cart center would miss these collisions.

The study checks trees, the home rectangle, terrain and loaded writing/authored cells. A footprint
that spans a loading-cell boundary requires both sides to be known. The garden and markers remain
walk-through presentation, while the placement study protects their space from construction and
the planned road. There is no vehicle damage or plant-destruction rule.

Dismounting searches a few nearby positions and checks the intervening ground. If both sides are
blocked, the player remains mounted with an explanation. Turning in a narrow crossing can fail
even when driving straight through it fits. Tests use real generation-3 and generation-4 bridge
and water geometry, rather than a collision-free bridge illustration.

The existing owner controller was extracted to `owner-forest-runtime.js`; the ordinary
`owner-forest.js` remains its small production entry point. The separate development entry supplies
movement and painting hooks. No production bootstrap, query flag or account setting enables the
study. Development art, controls and diagnostic snapshots are served only by the fixture server.
The renderer, regional delivery, joystick, writing/marker interface and garden controller remain
shared. The normal entry point supplies no extension.

Cart/house art is representative code-drawn geometry. Vehicle legs and wheels are not a finished
animation system, and house roof occlusion has not been generalized for arbitrary buildings.
The destination is a recognizable stopping place, not a material-acquisition loop. These are
deliberate limits of this increment.

## Reservation recommendation for the durable increment

Continue investigating an additive home area within the existing owner world. Treat reservations
as a new explicit spatial contract; do not stretch the marker schema to represent buildings.

Keep these roles distinct:

- The supported structural envelope protects the house and future allowed footprint changes.
- Door access, cart parking/turning space and the route protect usable passage.
- The wider home area protects terrain continuity and unwanted generated writing allocation while
  allowing later owner gardening in suitable space outside the structure and access corridors.

A single blanket “nothing may be placed in this clearing” rule would frustrate the intended garden.
The durable policy needs exclusions by purpose and writer, not just a single collision radius.
Footprints, passage width, stable identity and layout version must survive reload and upgrades.

Integration points to resolve before publishing homes:

| Existing path | Required future integration |
| --- | --- |
| `forestWritingTreeCreation.js` / grove candidate selection | Exclude structures and reserved access from new writing allocation; retain existing tree identities |
| `forestAuthoredPlacement.js` and `forestGarden.js` | Respect structure/access rules while allowing permitted owner arrangements in the wider yard |
| `forestOwnerTerrainActivation.js`, terrain protection schema and generation dispatch | Capture and verify complete home/access reservations; keep existing terrain readable; prevent old activation code from omitting new protection kinds |
| Owner/writing/marker return services and scene bootstrap | Select safe arrival positions without overriding a requested writing return |
| New home establishment service | Reserve the complete accepted plan atomically or publish only after a resumable operation verifies it; fence against concurrent spatial writes and deletion |

Current circular protection records cannot directly express this entire contract. The future
representation and compatibility/version strategy remain unresolved. This increment has made no
schema, activation, tree-allocation or mutation-service changes.

## Verification and remaining review

- Full Jasmine suite: **1,534 specs, zero failures** on Node 24.15.0. The suite's existing startup
  tests required execution outside the filesystem sandbox.
- Repository lint and explicit lint for the new browser/development modules passed.
- Eighteen added specs cover full footprints, swept translation/rotation, slow-frame bounds,
  backing up, loaded boundaries, dismounting, rectangle corners, both terrain bridge/water models,
  changed terrain tokens, deterministic allocation, bounded failures and home/approach separation.
- The established owner-template browser regression passed writing inspection and post return,
  linked/plain markers, creation and uncertain-save recovery, translation pagination, terrain,
  focus and failed-load cases at desktop and narrow widths.
- The new Firefox walkthrough passed both cart variants, the complete first route, parking and
  dismounting, reversing, unavailable/delayed region recovery, reload reset, reduced motion, and
  native emulated touch at 390px and 320px. Screenshots were inspected at normal scale.
- Additional generation-3 and generation-4 scenes with water geometry passed routes with a
  right-angle bend, including a populated generation-3 layout.

In the recorded main walkthrough, the recent-frame p95 interval was about 17.2 ms and cart-update
p95 was 2 ms. The generation-4 bent-route check recorded about 17.2 ms and 5 ms respectively.
These are headless desktop Firefox observations, not a mobile performance guarantee. Main fixture
terrain responses peaked at 3,818 bytes because that protected layout suppressed its water system;
the alternate generation-4 water scene peaked at 40,462 bytes. Main tree-asset responses peaked at
30,060 bytes. The populated generation-3 bend recorded cart-update p95 of 3 ms and terrain responses
up to 91,923 bytes. Recorded regional requests remained within nine cells. No API limit was raised.

For reproducible browser checks, run a separate temporary-profile Firefox, then the check:

```bash
mkdir -p /tmp/forest-home-cart-firefox
firefox --headless --no-remote --profile /tmp/forest-home-cart-firefox --remote-debugging-port 9226
```

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
npm run forest:home-cart-check
FOREST_CART_OCCUPANCY=empty FOREST_CART_QUICK=true npm run forest:home-cart-check
FOREST_CART_GENERATION=3 FOREST_CART_SEED=1 FOREST_CART_QUICK=true npm run forest:home-cart-check
```

Checks start their own database-free loopback server. Screenshots go to
`/tmp/forest-home-cart-review`; alternate runs replace some images there. `QUICK` exercises the
large-cart round trip on the selected layout; the default run includes both cart variants and UI
failure/input checks.

## Owner playtest feedback — November 11, 2026

The owner tried the demo, enjoyed driving, and found the cart easy to control. Both cart and house
variants were well received. The presentation worked but looked crude; requested refinements were
consistent avatar scale when mounting, moving wheels and animal legs, and a cozier, rustic,
rough-around-the-edges art direction with Stardew Valley as a reference. These are carried into
the implementation brief's visual study requirements; they are not implemented by this study.

This is encouraging first-person evidence for the controls and design direction, not acceptance
of the finished art or complete experience. The playtest device was not specified, so physical-touch
review remains unverified. Remaining questions include whether the route feels connected to a place
worth inhabiting and whether gathering, construction or character continuity motivates a return;
those require the later connected slice.
