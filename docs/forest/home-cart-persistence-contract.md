# Home/cart persistence contract and implementation progress

November 12, 2026 · follows commit `11cfbe9`

The owner authorized persistence work for protected geography, reliable saves and construction
accounting. The existing construction study remains the visual/control reference. This document
records the foundations, transactional storage and connected saved development experience.
The temporary preview on port 4183 is unchanged in purpose. A separate saved preview on port 4184
now persists construction and confirmed parking in an isolated **daily-page-test** account.
Production enablement remains outside this increment.

The subsequent [companion increment](home-cart-companion-increment.md) adds encounter commands and
homestead aggregate schema 2. Schema-1 saves remain readable and upgrade only when their owner
first meets the mule; construction and parking are preserved. The owner-world schema stays 2.

## Implemented shared rules

`public/js/forest-home-reservations.js` represents the accepted bounded planner result as a versioned
layout with home, parking, entrance approach and expedition route. It rejects unknown layouts,
unbounded/diagonal segments and disconnected parking endpoints. Conversion copies geometry rather
than retaining mutable planner objects. These rules do not validate terrain or ownership: the server
must obtain and validate the candidate before publication.

Placement decisions include the proposed object's radius, not just its center. All writers avoid
the largest supported structure, parking/turning space and access corridors. Generated writing also
avoids the wider yard; owner gardening and markers may use suitable parts of it. The terrain bounds
function is for bounded coverage queries, **not** blanket terrain suppression across that rectangle.
The version-1 corridor widths follow the first study: approach 12, expedition and parking 84.

`server/services/forestConstructionAccounting.js` implements pure replacement arithmetic: refund
the object's recorded commitment, then subtract the next catalog cost. The caller supplies trusted
costs and capacity; client-supplied prices must never reach it. Capacity counts loose material and
commitments in all objects, ensuring future refunds fit. Invalid amounts, insufficient materials,
overflow and unsupported holdings fail without mutating inputs. Revision checks reject stale edits.
Transaction, ownership and retry enforcement are supplied by the service described below.

Fourteen focused specs pass, covering all three terrain generations, supported maximum structure,
yard permissions, access endpoints/radii, malformed layouts, material conservation through repeated
redesign, capacity reserved for other objects, failed spending and stale revisions. Scoped lint passes.

## Implemented transactional storage

The next increment adds `ForestHomestead`, one strict aggregate per owner/forest, and
`buildForestHomesteadService`. Schema and service validation cover stable site/home/cart identities,
versioned layout and designs, confirmed parking, holdings, recorded cart commitments, revision,
timestamp and a maximum of 64 operation receipts. The unique owner/forest index prevents duplicates.
Malformed or newer records produce explicit failures rather than a fresh empty homestead.

The service supports establish, home redesign, cart redesign, confirmed parking and explicit
recovery. It uses real Mongo transactions and the existing owner ledger fence, checks deletion,
world identity, reconciliation and terrain state, and replaces existing records with a revision
comparison. Identical retained receipts resolve to the current authoritative state plus the
original operation's committed revision. Reusing an operation ID with different intent conflicts.
After receipt eviction, the old expected revision still prevents replay as a new purchase or grant.

Version-1 catalog defaults supply 96 timber and 24 cloth once during establishment. House exterior
choices are freely available. Cart timber costs are 12 base, plus one per four bed-length units over
36, one per three width units over 24, 4/8 for rails/boards, 4/6 for spoked/solid wheels, and 4/6 for
posts/bows. Canopies cost 0/6/8 cloth for none/linen/patchwork. Colors are free. Every offered initial
cart fits this generous supply. The commitment is recorded at purchase and refunded from stored
amounts on replacement. This first catalog has no repeat grants, resource sources, gifts or blossom
spending. Later supply/transfer features must extend the ledger/catalog explicitly.

Account-deletion cleanup now drains homesteads in bounded pages and verifies their absence before
completing. Marker-only reset code retains its existing scope.

**Publication remains disabled by default.** The service has no production endpoint or environment
flag that enables it. It requires injected server planning and full placement validation, with
unsupported defaults that fail closed. Validation is mandatory on every write, including recovery
and redesign. Gate-off reads retain saved state, and explicitly integrated recovery remains usable;
other mutations are disabled. Neither schema validation nor the transaction layer alone proves safe
coexistence with live world writers.

Real-database verification used only reserved owner `64b00000000000000000a094` with username
`forest_homestead_transaction_fixture` in **daily-page-test**. It checked unique indexing, concurrent
establishment and edits, exact retries, refunds, transaction aborts including receipt rollback,
invalid parking, connection restart, recovery, deletion fencing and cleanup. The reserved fixture
was removed after success. These checks use injected fixture geography; the connected preview and integration checks below
exercise the authoritative geography adapter and browser save flow separately.

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
node scripts/dev/forestHomesteadFixture.js run --write
```

The fixture refuses production mode/production selection, asserts the test database name and
checks the reserved user's identity before clearing its records. Full regression verification after
the storage/cleanup changes passed **1,573 specs**, with repository and scoped lint also passing.
The subsequent gate-off recovery adjustment was verified with the focused homestead tests.

## Durable record and command decisions

- Use one bounded homestead aggregate per owner/forest for site identity, fixed layout, stable house
  and cart IDs, versioned designs, material holdings and recorded commitments, confirmed parking,
  revision and bounded operation receipts. Keep motion, camera, animation and editor previews local.
- Establishment is server-planned. Under the existing owner ledger fence, read current world,
  writing, marker and garden evidence with strict bounds, derive and validate the entire site and
  route, and commit the complete aggregate or nothing. Search exhaustion returns unavailable with
  no spending or partial home; it does not relocate existing objects. Any alternative geography
  remains an explicit design decision before rollout.
- Mutations carry an operation UUID, expected aggregate revision, forest/layout identity and terrain
  token. Canonical payload digests bind receipts to intent. An identical retry resolves the original
  outcome; reuse of an operation identity with a different payload conflicts. Receipt eviction must
  still reject stale revisions rather than treating an old action as new intent.
- Acquire the shared owner fence and verify deletion and terrain state in the same transaction as
  a mutation. Validate placement and dependent material state before replacing the aggregate.
  Current proximity remains a browser convention, not proof of physical travel.
- Park only at server-validated loaded/known walkable positions with complete compound cart
  clearance and an accessible dismount. Keep the last confirmed parking position while driving.
  A lost response enters an unresolved state and reconciles by receipt/authoritative read before
  a dependent change. Explicit recovery returns cart/player to the validated home arrival without
  discarding the design or materials. Writing/marker return destinations retain priority.
- Basic home finishes remain immediately available. The initial versioned cart prices and supply
  are recorded above. Costs are captured
  when committed, so future recipe changes cannot inflate refunds. No blossom harvest or gift
  behavior changes are bundled into this foundation.

## Connected development implementation

The bounded study planner is now shared server code in `forestHomeSitePlanner.js`.
`forestHomesteadGeography.js` reads authoritative terrain, strict writing/marker evidence and the
garden under the transaction session. Queries and terrain work are bounded. It plans on existing
terrain without changing its protections, and validates the compound parked cart and an accessible
dismount before every save. Dense or unsupported geography fails without publishing a partial home.
Inactive/hidden writing trees remain occupied geometry.

Writing allocation, authored placement and gardening now check the home reservation in their
existing fenced transactions. A conservative 110-unit apron around confirmed parking protects the
cart, animal and dismount paths. Moving the saved cart releases its old apron. Fixed home, yard and
route rules remain in effect. Local cart motion also respects loaded markers and garden plants.

Establishment upgrades the owner world from schema version 1 to **2 in the same transaction** as
creating the homestead. Version 2 means a homestead must exist. Updated readers accept both world
versions, and updated spatial writers read the reservation. Older workers reject version 2 through
their existing version checks. Historical marker version evidence stays at version 1; it is not
rewritten. Rollback after any home publication must retain capable readers/writers, never downgrade
these worlds to version 1 to make an old binary accept them.

Terrain activation captures an explicit conservative circle cover into the **new activation only**.
The yard grid covers its edges and corners; 120-unit-radius circles at intervals no greater than
120 cover the full 84-unit route half-width (sqrt(60² + 84²) < 120), bends and endpoints. Confirmed
parking is captured too. Existing bounded capture/verification, cancellation and density limits
apply. Failed capture rolls back, and replacement preparation leaves published terrain untouched.
Tests cover the geometry in generations 3 and 4 and transactionally failed capture.

The private homestead handler is installed only by the loopback development fixture. It uses the
existing JSON/origin guard, session-owner binding, no-store responses and explicit conflict errors.
There is no production enablement flag or production route registration. GET provides a bounded
owner snapshot suitable for inspecting/exporting the layout, identities, designs, materials and
revision; internal operation receipts are omitted. Existing marker diagnostics/reset retain their
marker scope, and account deletion includes homesteads.

The shared workshop supports asynchronous saves and shows the resulting material balance before
saving. House finishes remain free. Pending saves lock controls; failed/conflicting saves retain the
draft. The client stores one unresolved operation in session storage, retries its exact payload and
blocks dependent actions until resolved. A conflict loads current authority and requires an explicit
resave. Failed reconciliation has its own retry state; changed terrain requires a forest reload.
No material or design update is presented as saved before server confirmation.

Stepping out confirms parking. Driving retains the last confirmed location. Reload restores the
saved designs and a server-validated dismount beside the parked cart. Explicit recovery moves the
cart home without changing designs/materials. Unavailable parking presents a recovery screen rather
than silently discarding the record. Runtime return-to-home supports the asynchronous extension
without overwriting its eventual safe arrival. Existing writing/marker return destinations keep
priority in the owner runtime.

## Try the saved preview

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
npm run forest:home-cart-saved
```

Open **http://127.0.0.1:4184/en/forest**. The command refuses production selection, verifies the test
database and reserved identity, and never resets an existing preview on startup. Reserved owner:
`64b00000000000000000a095`, username `forest_homestead_saved_preview`. The transactional cleanup
fixture continues to use its separate `...a094` identity and removes it after success.

- Save a house/cart design, reload, and confirm the appearance remains.
- Drive away, step out, wait for parking confirmation, then reload. Arrive beside the saved cart.
- Recover at home and confirm the designs/materials remain.
- Open two tabs. Save in one, then save a draft from the other: it should retain the draft and ask
  for review before an explicit resave.

The saved preview starts with a sparse, isolated forest. It renders the real owner template and
published generation-4 terrain, while normal writing/garden content is still supplied by the
fixture. It is not a migration of the existing temporary study or a connection to a personal forest.
Production integration still requires mounting the authenticated endpoint and saved scene extension
in the main application, packaging the study presentation modules, and reviewing deployment/rollback
with the version-2 compatibility boundary. None of those production actions is enabled here.

## Verification

- Full Jasmine regression: **1,582 specs, 0 failures**. Subsequent focused checks including terrain
  reload handling and shared cost display: **45 specs, 0 failures**. Scoped server/client lint passes.
- Real Mongo fixture: unique aggregate, competing edits, exact retry/refunds, abort rollback,
  connection restart, safe parking/recovery, atomic version-2 world upgrade, live authored/garden
  reservation checks, deletion fence and cleanup.
- Firefox saved preview: actual workshop save/reload and stable identity; a committed response lost
  in transit, reload and exact retry without extra spending; competing tabs with retained drafts;
  driving versus confirmed parking; reload at a safe dismount; recovery preserving materials/designs.
- Actual preview process restart preserved object identities, designs, parking, revision and materials.
- Original Firefox construction/travel regression passed, including 27 rider/floor pixel assertions,
  customization and round trips, unavailable regions/recovery, occupied-space refusals, reduced motion,
  320/390px containment and native emulated touch.

The browser checker is `scripts/dev/checkForestHomesteadBrowser.js`; it targets the loopback saved
preview and accepts a Firefox BiDi websocket URL as its first argument. The original construction
walkthrough remains `npm run forest:home-cart-check -- <Firefox BiDi websocket URL>`.
