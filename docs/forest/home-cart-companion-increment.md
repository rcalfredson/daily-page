# Companion encounter in the development fixture

## Accepted boundary

Following the construction, persistence and bridge/rendering work, the owner chose to introduce
the companion in the test fixture, then take the first integration step with the Activity Forest.
This increment covers one mule and its encounter. The traveler, destination material and lanternbell
gift sequence remain later work. Normal accounts and production entry points are unchanged.
The owner then requested a physical, action-oriented encounter in place of the initial dialogue
panel. This follow-up was completed on November 14, 2026, before main-forest integration.

## Playable interaction

- Walk near the mule and choose **Offer hand**, or press **E**. The avatar faces the animal and
  extends a hand. Mallow walks into reach, turns toward the player and sniffs before acquaintance saves.
- After meeting, **Scratch** (also **E**) produces an avatar scratching pose and Mallow's visible
  response. Repeating a scratch costs nothing and writes no additional relationship state.
- **Come along** invites Mallow, who then follows the player on foot. **Wait here** stops following.
  Walking immediately after an invitation works while its save is pending.
- Movement or **Escape** ends an unfinished gesture. Leaving before contact creates no acquaintance;
  after contact, an already-submitted save still needs its ordinary confirmation/retry.
- **Enter cart** / **C** asks Mallow to walk to the harness and face the travel direction before
  boarding completes. Pressing it again, pressing Escape, or walking away cancels boarding.
- A saved companion recognizes a returning player by approaching. Existing saved relationships,
  home/cart designs and material balances carry forward. Cart use remains available without replaying
  the introduction, including for established saves.

Mallow is now a separate world actor while the player is on foot. Local paths avoid the parked cart,
house, vegetation, authored objects, unsafe water and unloaded ground; body movement and turns are
swept against collisions. Searches are bounded and retried at a limited rate. If no safe local route
is available, Mallow waits and a brief caption explains the obstruction. This is local following,
not general world-scale navigation or autonomous wandering. Explicit home recovery reunites the
cart and animal without changing their saved designs or relationship.

The companion does not become a solid obstacle for the player. The full cart/animal collision
footprint remains authoritative while driving; on foot, walking collision retains the parked cart
and shafts and removes the animal's old fixed footprint. The independent animal receives its own
depth item; the previous cart roof/support layering remains in place.

The interaction uses small contextual buttons and brief semantic status captions in the dock. There
is no dialogue modal, scene lock or encounter camera takeover. The touch view reserves space above
the dock so the avatar and animal stay visible while moving. The existing study workshop and
diagnostics remain available. Shared actor, motion, gesture and UI code can serve the later forest
integration. Reduced motion retains essential animal movement and the avatar's interaction pose,
while suppressing gait, nuzzling and repetitive arm motion. There are no feeding requirements,
affinity scores, daily timers or absence penalties.

## Authority and compatibility

`companion` commands use the existing homestead transaction, revision fence, operation receipts and
lost-response recovery. The command accepts only `encounter: 'meet' | 'invite'`; the server owns the
identity and transition. Skipped or repeated transitions with a new operation ID conflict; an exact
retained retry returns the original outcome. Proximity is a presentation check in this fixture,
whose movement is client-side; these commands grant no items or currency.

Existing homestead schema-1 records remain readable and unchanged until the first successful
meeting. That transaction upgrades the **homestead aggregate** to schema 2 and adds a versioned
companion with stable UUID, species, working name and acquaintance/joined stage. The **owner-world**
schema remains 2. Construction identities, layout, designs, materials and parking are preserved.
Readers and writers validate both homestead versions; older readers reject the newer version rather
than silently dropping its memory. Rollback requires compatible readers, not downgrading saved data.

Companion-only saves leave the avatar at the encounter location. They do not trigger construction's
arrival repositioning. Recognition and posture are derived locally from the saved relationship;
no visits, affection counts or idle animation state are persisted.
On-foot position, current gesture, waiting/following preference and route are transient. Reloading
starts Mallow beside the confirmed parked cart and retains the saved acquaintance/invitation. No
new database schema or migration was required for the physical-interaction follow-up.

## Verification and review

Commands use Robert's Node installation:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
npx jasmine spec/forestCompanionActionSpec.js spec/forestHumanoidSpec.js spec/ownerForestSceneSpec.js spec/forestCartBridgeCrossingSpec.js
npx jasmine spec/forestHomesteadSpec.js spec/forestHomesteadIntegrationSpec.js spec/forestConstructionFoundationsSpec.js
node scripts/dev/forestHomesteadFixture.js run --write
node scripts/dev/checkForestCompanionBrowser.js ws://127.0.0.1:9236/session
```

The database transaction fixture uses its existing reserved `...a094` identity. The companion browser
checker uses a separate `...a096` identity, verifies the test database and username, and cleans up its
records. It never resets or plays through the owner's saved `...a095` preview. Browser checks cover
physical approach and contact, walking away, keyboard gestures, existing cart access, a committed
response lost before reload, exact retries, a competing visit, unchanged construction, following,
waiting, walking back to the harness, recognition after reload and narrow-screen/touch interaction.
Motion tests also cover bounded obstacle routing, refusal of unavailable ground, cancelling before
contact, walking during an invitation save, and recovery from blocked boarding.

Owner playtesting should judge whether the response is noticeable and warm enough at actual game
scale. Physical touch-device review remains distinct from automated emulation.

Initial persistence/encounter verification: the full Jasmine run exercised **1,589 specs**; **1,586 passed** and three
unrelated subprocess-startup checks were blocked by the sandbox (`EPERM`). Those three passed on
their separate run with subprocess access. The real Mongo transaction fixture passed, including
the companion upgrade and reconnect. Firefox passed the saved encounter walkthrough, keyboard,
320/390px touch, framing and reduced-motion checks. The cart regression also passed its 27 rider
checks, 144 bridge/cart views, careful driving and complete round trip. Scoped lint and diff
whitespace checks passed. Restarting the owner's saved preview preserved its existing revision,
identities, construction, materials and parking without performing the introduction for them.

Physical-interaction follow-up verification: **41 focused specs** passed for encounter motion,
humanoid presentation, bridge crossings and persistence. After adding the blocked-boarding recovery
check, **26 specs** passed across companion actions and the owner-scene helpers. Scoped lint and
whitespace checks passed. The saved Firefox walkthrough passed physical contact, cancellation,
following/waiting, boarding, persisted recognition, save retry/conflict handling, 320/390px native
emulated touch and reduced motion. Screenshots confirmed that both actors stay above the touch
dock. The temporary cart walkthrough passed all 27 rider and 144 bridge/cart rendering cases,
careful driving and the large-cart round trip after the actor separation.

November 15 rendering follow-up: Mallow's eyes now belong to visible beveled head faces, so the far
eye is hidden when the head turns. The muzzle starts at the front of the head, and its halter is
painted with the muzzle instead of crossing the cheek/eye area. Firefox pixel checks passed **36
head views**, covering both sides, front/back, head turns, resting and greeting. The review sheet
shows the animal at twice its normal scale to make small placement errors easier to inspect.
The cart's rear-pillar/rider correction and its regression checks are recorded in the
[rendering follow-up](home-cart-bridge-and-rendering-followup.md). **36 focused specs** also passed
for companion actions, humanoid presentation, scene helpers and bridge crossings.

## Next integration step

After reviewing this companion step, connect home/cart/companion through an explicitly enabled
development path in the main Activity Forest, reusing these modules and save authority. Exercise
ordinary entrance and writing-return behavior, a discoverable home locator, and coexistence with
real writing and gardens. Keep production enablement and the traveler/expedition increments separate
from that first integration pass.

The first development-gated application integration is now recorded in
[Activity Forest integration](home-cart-activity-forest-integration.md).
