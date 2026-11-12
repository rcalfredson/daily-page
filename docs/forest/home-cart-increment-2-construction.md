# Home/cart increment 2: construction and presentation

November 11, 2026 · `feat/forest-home-cart-expedition`

The owner authorized this increment after enjoying the first driving study. It extends the
database-free study in the real owner template with live construction previews, independently
configurable parts, representative rustic artwork, a consistent seated avatar and travel animation.
It remains temporary: applying a design keeps it until this page is reloaded. There is no account
access, persistent save, resource spending, new database schema or production enablement.

## Try it

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
npm run forest:home-cart-study
```

Open **http://127.0.0.1:4183/en/forest**. If an older study is running, stop and restart it to pick up
the editor module route, then reload the page.

1. At home, choose **Shape house**. Change width and depth separately, select planks or shingles,
   choose a wall color, and try the wood-shake or clay-tile roof with its own color.
2. Watch the house change in the clearing. **Cancel** or Escape restores the applied design;
   **Apply design** keeps the preview for this visit. The front door stays put as the house grows
   backward, preserving its approach.
3. Choose **Build cart**. Try length, width, open rails or a boarded bed, two wheel styles,
   timber posts or bentwood bows, and an optional linen or patchwork cover. Wood and cloth have
   independent finishes. Axles and supports fit the selected dimensions automatically.
4. Enter with the button or **C** and take the design on the existing expedition. Movement uses
   arrows/WASD or touch-drag; **R** toggles reversing. Dismount at the destination and return home.
5. Park near home and step out to revise it. Return/recovery preserves applied designs; reloading
   resets them. The old size examples remain explicitly labeled resets in the development options.

The workshop is one panel within the viewport, with the live scene beside it on desktop and above
it on narrow screens. Controls scroll; Apply and Cancel stay reachable. Other scene controls are
inert during editing, movement stops, Tab stays within the editor, Escape cancels, and closing
restores focus to the opening button. Shapes are previewed at actual play scale.

## Bounds and supported choices

| Design | Dimensions | Parts / materials | Finishes |
| --- | --- | --- | --- |
| House | Width 120/150/180; depth 72/86/100 | Plank or shingle walls; shake or tile roof | Honey, sage, clay, cream walls; moss, rust, slate roof |
| Cart | Bed length 36/44/52; width 24/30/36 | Rails or boarded body; spoked or iron-bound disc wheels; posts or bows; no canopy, linen or patchwork canopy | Honey, walnut, sage wood; ochre, moss, indigo cloth |

Dimensions are forest coordinate units. These are component choices, not whole-object skins.
Every offered support, wheel and canopy fits every supported chassis. Open carts still show the
selected support treatment as side braces; a covered cart extends it into posts or a bowed frame.
Cloth controls are hidden when there is no canopy, retaining the selected color for later use.

All house choices fit the first study's 180×100 structural envelope. The doorway remains on its
original front edge. All cart choices stay within the original largest tested vehicle's geometry.
The selected length and width feed the actual compound collision footprint, turning sweep and
dismount search. Finishes, wheels and canopy do not change speed or clearance. Designs cannot change
during a driving sweep.

Previews are separate copies. Apply rechecks the design and occupancy before replacing the temporary
applied value. A house cannot expand over the standing player or parked cart; a cart cannot expand
over the player, house, loaded tree obstacles or unwalkable/unloaded ground. Failure keeps the
editor open with an explanation. Nothing moves out of the way to make a preview fit. Static home
terrain clearance comes from the fixture's already-validated largest envelope; this is not a
substitute for authoritative validation in a future live-world construction service.

## Presentation

House artwork now includes staggered shingles or board seams, individual roof pieces, weathered
trim, shutters, warm windows, door hardware, masonry and a step. Cart artwork follows the chosen
body, wheel and support geometry, with separate wood/cloth treatments and optional patchwork.

The seated rider uses the existing forest avatar renderer at 1:1 scale and the cart's facing.
Its standing legs are clipped below the seat and replaced with bent legs; head, hat and torso
remain consistent with walking. The undercarriage, floor and seat are painted before the parts
above the bed; parts within each group retain their ground-depth ordering as the cart turns.

Wheel rotation follows signed distance traveled, including reverse. The mule's jointed legs use
a distance-driven diagonal gait and settle into a standing pose when movement stops. Collisions
and unloaded regions stop travel and its animation together. Reduced motion keeps travel usable
while suppressing wheel/leg cycles. There is no timer-driven idling, fabric simulation, new renderer
or generated raster asset pipeline in this increment. Art remains representative and reviewable;
general building occlusion, refined animal anatomy and broader environment artwork remain later work.

## What this settles before persistence

`public/js/forest-construction-design.js` supplies a small versioned vocabulary and validation shared
by the browser and Node checks. Unknown versions, keys, missing fields, unsupported parts and
out-of-range dimensions fail validation. It defines chosen dimensions and part IDs separately from
position, movement and presentation. The legacy study `variant` field is only an example/reset label;
the explicit design determines a customized cart's appearance and geometry.

Carry these decisions into the durable design:

- Keep home/cart object identity, forest ownership and site/parking coordinates separate from the
  chosen design. Rendering or color changes should not replace an object's identity.
- Give part definitions stable IDs and a catalog/version strategy. The study's strings are a
  vocabulary proposal, not a published save format. Future readers must preserve unavailable parts
  or report an explicit compatibility state; the study's strict rejection is not a migration policy.
- Reserve the supported maximum home footprint and access, while validating actual cart geometry.
  Keep the wider yard available for permitted gardening, as described in increment 1.
- Keep preview edits outside applied state. A durable apply must use authoritative server-side
  design/placement validation, expected revision and a stable operation identity for retries.
- Store the committed material quantities with each constructed component/object when resources
  arrive. Replacements refund the recorded commitments, then commit the new design's cost atomically;
  a later recipe update must not alter old refunds. This study has no holdings or costs, so no fake
  inventory numbers or consumption appear in its interface.

Before Stage C, settle the actual part/cost table, supply/refund capacity, home allocation fallback,
reservation schema and writer compatibility, plus safe parking/return behavior. The two dense-world
placement failures from increment 1 remain unresolved. This increment does not claim to finish
Stage A or establish durable compatibility. Chimney sockets, traveler parts, decoration attachments,
expedition materials, blossoms, encounters, interior editing and cross-user travel remain later work.

## Verification

- Full Jasmine suite: **1,543 specs, zero failures**. Nine new specs cover design rejection,
  footprint bounds, finish/handling independence, all nine cart sizes on real generation-3/4 bridge
  samples, and travel-driven/reversed/stopped/reduced-motion animation state.
- Repository lint and explicit lint for the browser study and new shared modules.
- Firefox walkthrough: default, customized medium and compact cart round trips; preview isolation,
  Cancel, Apply, focus restoration, refusal to resize over the player, unavailable/delayed regional
  delivery, reverse, reset-on-reload and reduced motion.
- Editor containment at **320px and 390px**, Escape cancellation and native emulated touch driving.
  Desktop and narrow screenshots inspected. Physical-device review remains unverified; emulation
  does not establish mobile performance.
- Alternate generation-3, seed-1 round trip with a right-angle bend also passed. The recorded
  cart-update p95 was 2 ms and recent frame-interval p95 about 17.2 ms; the largest terrain response
  was 91,923 bytes, with the existing nine-cell request cap retained. These are local headless
  browser observations, not a physical-device performance guarantee.

## Owner review and layering correction — November 11

The owner play-tested the experience and reviewed essentially the full customization range,
reporting that both the home and cart appearances were extremely pleasing. The substantive
critique was incorrect overlap of the floor and seated rider at certain cart headings, documented
with two screenshots.

The renderer had sorted the floor and rider solely by their ground positions. When the cart pointed
slightly away, that could draw the floor after the elevated rider. Rendering the undercarriage before
the above-bed parts fixes that dependency while retaining directional overlap among rails, rider,
canopy and animal. The local Firefox check now asserts 27 visible shirt pixels across all nine
cart sizes at the reported shallow upward angles. A 48-view rotation sheet covering open rails,
boarded carts and both canopy support styles was also visually inspected. Focused rendering checks
and lint passed after the correction; the full 1,543-spec result above predates this rendering fix.

Run only the rendering check with `FOREST_CART_RENDER_ONLY=true npm run forest:home-cart-check`
against the same local Firefox setup. It writes `cart-rotation-sheet.png` into the review directory.
This completes the immediate correction from the owner's review. The next recommended increment
is the remaining placement/save contract followed by durable construction, rather than catalog
expansion: protect home/access from later world writes, save designs and parking safely, and verify
reload, multiple sessions and recovery. Material commitments and compatibility rules must be settled
before their persistent representations are introduced.

Reproduce with `npm run forest:home-cart-check` and the Firefox setup in the
[first study](home-cart-increment-1-study.md#verification-and-remaining-review). Screenshots are in
`/tmp/forest-home-cart-review`. The existing generation/occupancy/seed environment options still work.
