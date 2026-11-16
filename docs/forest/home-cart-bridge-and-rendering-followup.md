# Home/cart bridge handling and rendering follow-up

November 12, 2026. Follows the saved development milestone. Scope: make bridge alignment more
manageable and investigate CPU use before the narrative increment.

## Crossing controls

Normal driving remains directional. While mounted, **Careful driving** switches to slow manual
vehicle controls: Up/W rolls forward, Down/S rolls backward, Left/A and Right/D steer. Touch dragging
uses the same local controls: up/down rolls, left/right steers. Stop rolling to align at any angle,
then roll straight across. Turning alone does not translate the cart. The button's pressed state
and contextual instructions identify the active mode. Reverse still reverses the rolling direction.

Careful driving travels at 72 world units/second versus normal forward speed 224. It uses the same
compound footprint, swept collision, loaded-region checks and server-validated parking. There is
no bridge snapping, clearance exemption, terrain regeneration or change to saved designs. Existing
footbridges have arbitrary angles, which keyboard directional driving's eight headings could not
match accurately. This control option addresses that mismatch without steering for the player.

Narrow carts retain more lateral tolerance. A wide cart still needs clear approaches and accurate
alignment. Existing boulders/water can rule out an approach; careful driving does not promise every
cart can cross every bridge. The required expedition corridor continues to support every offered
cart. New bridge construction remains later work.

`forestCartBridgeCrossingSpec.js` exercises all nine offered width/length combinations on an actual
bridge in generations 3 and 4, narrow carts forward/backward across all three representative regional
bridges, rejection of water beside the deck, steering without rolling and bounded movement steps.
The Firefox construction walkthrough now exercises the mode button, steering/heading preservation
and returning to normal controls, alongside its existing mobile, touch, collision and travel checks.

## Rendering and measured work

The previous visible scene redrew on every animation tick, including when stationary. It now paints
ambient animation at about 30 frames/second while idle and retains the display's animation rate while
moving. Hidden tabs skip scene updates/painting and reset elapsed time; visibility restoration
requests a fresh frame. A direct paint cancels an already queued paint to avoid redundant work.
Reduced-motion behavior and explicit UI/region-load redraw requests remain in place.

Measurements use headless Firefox, 1280×880 at device ratio 1, the generation-4 mixed study fixture
and four-second idle/driving windows. `scripts/dev/profileForestHomeCart.js` instruments animation
callbacks, reports navigation-to-ready wall time and counts primary-canvas paints. These measure
JavaScript/canvas submission work; they do **not** measure GPU work, total browser-process CPU or
server-side site planning. Absolute timings vary with hardware and concurrent load.

| Measurement | Before | After |
| --- | ---: | ---: |
| Load-to-ready wall time | 505 ms | 480–503 ms |
| Idle callback work over four seconds | 1,251 ms | 431–725 ms |
| Driving callback work over four seconds | 1,265 ms | 1,217–1,483 ms |
| Idle paints over four seconds | Every visible tick (about 240) | 120 |
| Driving paints over four seconds | About 240 | 240 |

The first paired profile reduced idle callback work by 42%; subsequent runs were lower still.
Driving costs stayed substantial and varied between runs.
There is no evidence here of a meaningful loading-speed improvement, and sustained driving can
still use substantial CPU. Further optimization should follow profiling on representative personal
forests and hardware, especially near water or dense trees. The current result establishes that the
previous idle cost was avoidable rather than an intrinsic requirement of the art style.

## Verification and next step

**50 focused specs passed**, and the full Firefox construction/travel
walkthrough cover these changes, including the existing 27 rider/floor pixel checks, narrow-screen
containment and native emulated touch. The profiling script also checks hidden-tab painting and
visibility restoration. The saved preview serves the changed client modules without resetting the
owner's saved construction or parking.

Proceed next to the planned connected companion/traveler/expedition increment after playtesting
careful driving. No narrative features or production enablement are included in this follow-up.

## Bridge railing and canopy overlap correction

The cart was one scene depth item while each bridge railing member had its own depth. A member
could consequently paint across the raised canopy even when it should only obscure lower cart
geometry. The scene now separates the canopy fabric from the body/supports and includes bridge
elevation in cart depth. The roof uses its raised height and rotated center when interleaving with
the scene; foreground railings still obscure the lower cart. Ordinary standalone cart painting
retains its existing ordering, including the rider/floor fix.

Firefox pixel checks cover 48 bridge/cart configurations: 12 bridge orientations, linen/patchwork
canopies and post/bow supports. They verify 9,237 solid canopy/rail overlaps and 8,676 foreground
rail/body pixels, while reproducing 3,383 incorrect canopy pixels with the previous ordering. All
27 rider/floor checks also pass. Antialiased edges are excluded from solid-interior comparisons.
The checker saves `bridge-cart-rotation-sheet.png` beside the existing cart review images; the
sheet was visually reviewed. These changes affect presentation, not saved geometry or clearance.

The subsequent pillar correction separates canopy support posts/bows from the lower cart. Vertical
posts are drawn in six-unit height segments with individual projected depth, preserving legitimate
lower overlap while keeping the upper pillar visible. The fabric remains above its own frame.
Support segments paint directly, without rebuilding the complete cart for each segment.

The expanded Firefox regression covers 144 configurations across both ends and the center of the
bridge. It verifies 192 upper-support/rail intersections that fail with the previous ordering,
23,593 canopy intersections and 24,952 foreground rail/body pixels. All 27 rider/floor checks and
the actual-scene careful-driving/round-trip walkthrough pass. The rotation sheet was visually
reviewed, scoped lint passes, and the running saved preview serves the updated client modules.

## Rider and pillar overlap correction — November 15

Separating the support posts exposed another depth mismatch: the rider still belonged to the flat
cart-body layer. A raised rear post could therefore paint across the rider's face and torso. The
seated avatar now uses a bounded, cached 128×128 sprite whose visible rows join the scene ordering
at their respective heights. The cache retains the cart's existing near-side body occlusion and
is rebuilt only when the heading or design changes. Vertical posts now use one-unit segments so
their ordering can match the rider rows. Near posts still cover the rider naturally; the floor
remains underneath, and the previous bridge/roof/support ordering is preserved. Standalone review
painting and the actual scene use the same depth items.

Firefox checks passed **432 rider/support views**: all nine dimensions, both post/bow frames and
24 headings. They exercised 2,792 rear-post intersections that reproduce the previous bug and 828
legitimate foreground intersections. The existing **27 rider/floor** checks and **144 bridge/cart**
views also passed, followed by careful-driving controls and a full large-cart round trip. Rotation
sheets were visually reviewed. The saved preview serves these client changes on reload without a
save migration. Mallow's related eye correction is recorded in the
[companion increment](home-cart-companion-increment.md).
