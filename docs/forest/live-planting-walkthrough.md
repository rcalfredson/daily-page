# Play the first live planting loop

Lanternbell gardening lives in the ordinary `/forest` owner template. No production or ordinary
account was activated or changed during implementation.

Use Robert's Node installation:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
node scripts/dev/forestGardenFixture.js serve --write
```

Open **http://127.0.0.1:4181/en/forest**. This separate loopback server supplies only the dedicated
`forest_lanternbell_fixture` identity in `daily-page-test`; it is not the normal application server
and needs no account login. The script refuses production mode/database selection, checks the
fixture owner identity, and creates/verifies the garden index. The normal application's route
continues to use its real session middleware, private no-store responses and same-origin JSON guard.

For a clean start, stop the fixture server, run
`node scripts/dev/forestGardenFixture.js reset --write`, then start `serve --write` again.
Do not reset while using it in another tab. Reset deletes only the dedicated fixture's records.
The development database must be reachable with the repository's existing environment credentials.

1. On an empty account, choose **Enter my forest**. You arrive empty-handed. Approach the wild
   lanternbell near the entrance: it highlights and offers **Take a cutting · E**. Press E, tap
   the shrub, or use the nearby button. The cutting moves from the shrub toward your avatar;
   its leafy stem is then visible beside the avatar and in **Satchel**. Opening the satchel
   or pressing Escape puts a held cutting away. Packing up stores its cutting directly; selecting
   **Plant cutting · P** takes one out again. Stored cuttings stay stored after a reload.
2. While carrying a cutting, choose **Plant cutting · P** in the forest or press **P**.
   **Satchel → Plant a cutting** is also available. Walk and face a spot. **Save here** or Enter plants;
   **Cancel** or Escape keeps your cutting. All controls stay inside the forest view.
3. In ordinary play the cutting sprouts after two minutes and flowers after twenty. The labeled
   development banner's **+2 minutes** and **+20 minutes** controls accelerate this review only.
4. Approach your flowering plant and **Take a cutting**. The parent stays. Plant its cutting
   nearby to create a pair, border, or cluster. Later cuttings take four hours; one waits for you.
5. Open **Satchel → My lanternbells** for saved-plant bearings. Reload or use another tab to check
   persistence. Near a plant, **Move** previews the plant at its current stage and preserves growth; **Pack up** confirms returning one cutting
   and restarting growth on replanting. Full holdings never discard a plant or cutting.
6. Growing tips are optional and collapsed. After an uncertain save, **Satchel → Refresh** reads
   the authoritative result before another action. No offline replay or optimistic planting occurs.

The injected preview clock resets when this fixture process stops. Use a clean reset for another
accelerated walkthrough; previously accelerated timestamps remain durable and will wait for real
server time after restart. In ordinary use no offset exists. The fixture begins with no writing;
writing inspection, marker creation and regional writing delivery remain the ordinary live paths.

Garden GET also serves as the bounded owner diagnostic inventory. Marker diagnostics and
**clear authored geography** continue to describe markers only. Garden state has no tombstones or
TTL: lifting returns its cutting, and account deletion drains and verifies the entire garden.

The forest uses one bottom dock for nearby interactions and everyday actions. **Plant cutting**
appears beside **Satchel** when stock is available; **More** contains **Place a marker** and
collapsed **Help & forest info**, including the nearby writing-tree count. Touch devices get
touch instructions without keyboard hints. Planting and marker previews replace the ordinary
actions, and opening the satchel or an inspection hides the dock. Successful garden feedback
disappears after 4.5 seconds; errors retain their explanation in the satchel and remain visible
until another action or refresh resolves them. The collected wild shrub no longer shows an
already-taken interaction card.

**My lanternbells → guide me** closes the satchel and shows a compact direction arrow and
remaining steps in the dock. The bearing and distance update while walking. The guide pauses
behind menus and placement controls, clears on reaching the plant's interaction range, and can
be dismissed with its **×** button. It is a directional aid, not an obstacle-aware route.

## Verification

- Full Jasmine suite: **1,514 specs, 0 failures**, Node 24.15.0. The sandbox's existing subprocess
  startup tests required running the suite with execution access outside the sandbox.
- Repository lint passed; new development scripts were linted separately. Native browser modules
  were syntax checked and exercised through Firefox.
- Guarded real-Mongo fixture: concurrent empty-handed entry and equal acquisition, planting and harvesting; unique index;
  competing same-revision commands; old retries; first/repeat/long-absence yield; transaction
  rollback; marker reservation; generation-3 activation and generation-4 upgrade preserving plant
  positions and capturing protections; placement on both published terrain versions; deletion
  rejection and bounded cleanup convergence.
- Owner-template Firefox walkthrough at desktop 1280px and narrow 390px: acquisition, three growth
  appearances, proximity entry/exit, collection with E and direct plant taps, a depicted cutting,
  an in-viewport satchel, mature preview, harvest and immediate replanting, reload and separate-context
  persistence, cancellation, lifting confirmation, lost-response recovery, reduced-motion rendering,
  emulated touch drag, and overflow checks. Screenshots were inspected at normal scale.
- Interface cleanup: Firefox checks at 320px, 390px and 1280px covered the shared dock,
  collection feedback expiry, More/Escape, marker placement, planting/cancellation, satchel,
  nearby immature plants, expanded Help, and guide selection, live bearing/distance and arrival.
  Garden writes were intercepted in this layout
  review to preserve the saved fixture account. The writing/marker regression below was rerun.
  With the fixture server and Firefox BiDi on port 9225 running, reproduce this review with
  `node scripts/dev/checkForestInterface.js`. Screenshots are written to `/tmp/forest-garden-review`.
- The established owner-template browser suite also passed writing inspection/post return,
  linked and ordinary markers, retry after concurrent removal, private terrain geometry,
  translation pagination, failure fallback and focus behavior at both widths.
- Physical-touch hardware testing has **not** been performed. Emulated input is separate evidence.

Reproduce the guarded database checks (they reset only the fixture owner and leave a clean start):

```bash
node scripts/dev/forestGardenFixture.js run --write
```

For browser automation, start the clean fixture server above and a separate headless Firefox:

```bash
mkdir -p /tmp/forest-garden-firefox
firefox --headless --no-remote --profile /tmp/forest-garden-firefox --remote-debugging-port 9225
node scripts/dev/checkForestGarden.js
```

The browser walkthrough expects a clean fixture, uses the injected growth preview and writes
screenshots to `/tmp/forest-garden-review`. It is not a production or physical-device test.

After playing, report whether you naturally noticed the wild plant, enjoyed arranging its offspring,
wanted to revisit growth, and trusted the move/lift/reload behavior. That experience should choose
the next increment; richer arrangements or habitat-specific plants are possibilities, not an
assumed need for a larger inventory, currency or market.

## Interaction refinement after the first playthrough

The first UI let empty-account setup grant a cutting before the wild plant was used, and placed
ordinary actions below the viewport. The refinement separates entry from collection, adds a
proximity highlight/action and visible cutting, and moves the satchel and plant actions into the
forest. Existing gardens and holdings are retained.

For repeatable QA without disturbing the owner's playthrough, set `FOREST_GARDEN_QA=true` for both
fixture and browser commands. This uses a separate guarded QA identity and port **4182**, while the
original fixture remains on **4181**. Reset/run only that QA identity for automated checks.

### Preview and satchel refinement — November 9

Moving rooted, sprouting and flowering plants now previews the actual selected appearance while
retaining mature placement clearance. The satchel opener hides while its panel is open, and the
close glyph is larger within its existing touch target. Carrying is transient intent, independent
of durable holdings: fresh collection equips, opening the satchel/cancelling/Escape stows, and
packing up stores its cutting. Reloading never equips stored cuttings automatically.

Eight focused DOM/controller specs cover all three move stages, mature clearance, stored versus
held cuttings, harvesting versus packing, satchel toggling and Escape. Controlled Firefox owner-
template reviews at 1280px and 390px inspect the three previews, panel controls, and held/stored
cutting appearances without mutating saved account data. Physical-touch review remains separate.
