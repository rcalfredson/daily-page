# Home, cart and companion: first Activity Forest integration

November 15, 2026. Follows the accepted saved construction and physical companion milestone.

## Playable boundary

The ordinary `/forest` page now composes the existing forest runtime with shared home, construction,
cart and companion modules. The development study imports the same modules; the game no longer
needs `/__study` scripts. The ordinary page keeps its existing entrance and canonical writing/marker
return resolution. It does not move the player to the parked cart on every visit.

New accounts in the local development allowlist receive an explicit **Make my clearing** choice.
Establishment uses the existing transactional site planner and reservations, rather than replacing
terrain or moving writing/garden objects. No suitable site means establishment cannot complete;
there is no fallback that deletes existing content. An unresolved establishment keeps the same
operation identity across reload, including when it committed before its response was lost.

Established homes/cart/Mallow use the same revision checks, material accounting, exact retries,
parking authority and recognition as the saved study. Initial read failure holds entry until retry
so an unread saved house cannot disappear from collision. Unsafe parking offers recovery through
More; saved construction remains intact. New establishment can be disabled without hiding existing
homes in the development environment.

The normal interface omits study instructions, destination scenery, the pale test trail, performance
snapshots and network simulation. Workshop controls appear near home, boarding appears near the
cart, and driving controls appear while mounted. **Guide me home**, **Find my cart**, and **Recover
cart at home** live in More. The center-return action retains its ordinary meaning and asks the
player to step out if mounted. The companion retains physical greetings/following and the small
contextual dock. On narrow screens the camera reserves the dock's height. Garden and marker
previews respect home/access/parking reservations locally as well as through server validation.

## Availability and local review

This is application integration behind a **development-only** account gate. It does not authorize
production activation or a deployment. `FOREST_HOMESTEAD_DEV_OWNER_IDS` is a comma-separated list of
canonical account IDs. Both `NODE_ENV=production` and a production database flag disable new access.
The application API derives ownership from authentication and keeps the existing same-origin JSON
mutation requirement. Existing development homesteads retain read/mutation access when their ID is
removed from the creation allowlist. Compatible readers/reservations must remain installed.

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
npm run forest:homestead-application
```

The dedicated preview is `http://127.0.0.1:4185/en/forest`. It binds only to loopback, refuses the
production database, and uses reserved test owner `...a097` with username
`forest_homestead_application_preview`. Its explicit test authentication is confined to this script.
It retains saves and seeds one real writing projection (`...a098` block, `...a099` group). The
original saved construction study on port 4184 and its `...a095` owner remain separate. The
standalone preview installs the main page handler and real forest APIs; it does not install the
rest of Daily Page's writing-page routes.

## Verification and next increment

`checkForestHomesteadApplication.js` exercises the main page and real database-backed APIs with
only the reserved integration identity: establishment, ordinary entrance, home navigation, design
save, boarding, careful controls, parking/reload, a real writing inspection/return locator, garden
preservation, reserved-space rejection, malformed-command rejection, and 320/390px containment.
It writes review images to `/tmp/forest-homestead-application-review`. The saved companion browser
walkthrough still exercises physical contact, cancellation, following/waiting, reunion, exact save
retry/conflict recovery, reduced motion and native emulated touch through the shared modules.
The rendering checker retains the 639 angle/pose regressions. Focused service/UI specs cover gate
behavior, existing-home continuity, safe parking recovery and unresolved establishment retries.

Owner playtesting should assess discovery and control crowding in this ordinary forest flow.
The current preview's terrain is the ordinary terrain-free account configuration; the existing
river/bridge study remains available for crossing review. Broader qualification on dense and
terrain-enabled personal forests, full writing-page round trips and an explicit production reader/
writer rollout remain release work.

Verification for this pass: **63 focused specs** passed. The full Jasmine run exercised **1,601
specs**: **1,598 passed** inside the sandbox, and the three subprocess-startup specs passed when
rerun with subprocess access. Both Firefox walkthroughs described above passed, as did all **639
rendering cases**, scoped lint and whitespace checks. Desktop and narrow-screen review images were
visually inspected. These checks establish local integration behavior; owner playtesting and
production qualification remain distinct.

November 17 follow-up: [Unified navigation](unified-navigation-increment.md) replaces the independent
home/cart guides with a shared destination picker and compass, including contextual plant guidance.

## First-time homestead

Use one suggested clearing per search. The site planner already checks the yard, parking space
and approaches against the owner's world. The shared compass and a ground marker let the player
inspect the suggestion before confirming it. Multiple sites would add comparison and navigation
work before playtesting has shown that location choice matters. The server rechecks the same
site when the player confirms. If it has changed or become unavailable, the player can search
again.

Player-led placement is a future enhancement. See the [home geography
design](home-cart-expedition-implementation-brief.md#7-spatial-foundation-home-area-route-and-destination).

| What the player sees and does | Feedback and saved state |
| --- | --- |
| Enter at the usual forest entrance or writing return. Choose **Find a home clearing**, follow the compass, and select **Make my clearing** near the marked spot. **Later** puts the invitation in More for the visit. | The house appears, the compass destination becomes Home, and the confirmation saves the chosen site, reservations and editable house. The parking area is empty. |
| At the workshop, choose **Unpack starter supplies**. **Shape house** is available as soon as the clearing is yours. | The Satchel gains 96 timber and 24 cloth, enough for every basic cart design. A confirmation shows the balance. The supply claim and credit save together. House finishes are free and house edits save independently. |
| Open **Build first cart**, choose a design and select **Assemble cart**. | The editor previews the parts and costs. Assembly leaves a visible parked cart and updates the Satchel. The design, parking and material commitment save together. Canceling the preview costs nothing, and redesigning refunds the stored commitment for reuse. |
| Approach the mule and choose **Offer hand**, then **Come along**. These actions can happen before cart assembly. | Mallow physically approaches for the greeting and follows after the invitation. The introduction and invitation save as separate facts. The cart reminds the player to invite Mallow until **Enter cart** becomes available. Parking still saves when the player steps out. |

The increment uses the existing development allowlist, normal forest entrance, workshop, Satchel,
compass and companion controls. Every saved step can resume after a return. The compass and
unsaved previews are visit-local. Revisions and operation receipts protect material and encounter
saves when a response is lost or two tabs act at once. Existing records keep their house, cart,
parking, material balances, companion stage and prior cart access without a data migration.

## Meet Tansy Rook

Tansy rests off to one side of the ordinary forest entrance. Her hood and joke about burying
boots come from the development scene. The ochre patchwork canopy is the landmark, and the cart
stays parked. Tansy and the cart block movement at ground level. The conversation runs along
the bottom of the forest view and frames the player, Tansy and her cart above it. Tansy looks
toward the canopy as she talks about its patches.
Players can find her as soon as they can walk in the forest, including before claiming a home.

The development allowlist enables the encounter and its save. After the canopy story, Tansy offers
a spare **Ridge frame**. **Maybe later** records the introduction and keeps the offer available.
**Take the frame** records the introduction and permanent ownership together on the owner’s forest.
That single ownership fact makes repeated acceptance safe, including before a clearing exists.
The open dialogue and campsite coordinates are visit-local. The forest checks a bounded set of
resting spots against terrain, the entrance approach, and existing objects and home reservations.
A spot may change if it becomes occupied. If none fits, the forest continues without a campsite.

The workshop lists the Ridge frame under **Supports** once it’s owned. It makes a tall, peaked
canopy or leaves two exposed timber gables and a ridge beam on an open cart. It fits every bed
size, costs the same timber as bentwood bows, and uses the existing ground clearance, driving,
and parking rules. The new Supports choice uses the existing version-1 cart design, so saved
designs load as written. Ownership stays available when switching back to basic supports. Tansy comments
on the peak when the player talks to her with a saved, fitted cart parked nearby. The response is
based on the cart present at the visit. The destination clue, expedition, new materials, and
gifting are future increments.

### Local playtest

Run the application preview command above and open `http://127.0.0.1:4185/en/forest`.

1. Walk out from the entrance and look for the patched ochre canopy, or choose **Covered cart**
   under **More → Navigate**. Approach on foot and select **Talk to Tansy**.
2. Select **Did you make that canopy?**, then **Maybe later**. Reload, follow **Tansy Rook** in the
   compass, and talk to her again. She should remember the conversation and offer the frame again.
3. Select **Take the frame** and reload. You can do this before making a clearing or after building
   a cart. If you have no cart yet, claim a clearing and unpack starter supplies at the workshop.
4. Park at home if you already have a cart. Open **Build first cart** or the cart editor, choose
   **Supports → Ridge frame**, and toggle the canopy between **Open sky** and a cover. Cancel,
   reopen the editor, and check that your saved supports are still selected or that you still have
   an unbuilt cart. Select the Ridge frame again and choose **Assemble cart** or **Save design**.
5. Invite Mallow if needed, drive toward Tansy, and step out in clear ground within about 100
   steps of her. Walk over and talk. She should say, “You fitted the ridge frame! Look at that peak.
   Your cart wears it well.” Reload and talk again to check the parked cart still gets the response.

The preview retains the introduction, ownership, and saved cart. Use a fresh allowlisted development
account to repeat the entire first meeting.
