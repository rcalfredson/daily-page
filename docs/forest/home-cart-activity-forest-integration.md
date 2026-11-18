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
writer rollout remain release work. The traveler, special part, materials expedition and
making/gifting narrative remain the next gameplay connections after this integration review.

Verification for this pass: **63 focused specs** passed. The full Jasmine run exercised **1,601
specs**: **1,598 passed** inside the sandbox, and the three subprocess-startup specs passed when
rerun with subprocess access. Both Firefox walkthroughs described above passed, as did all **639
rendering cases**, scoped lint and whitespace checks. Desktop and narrow-screen review images were
visually inspected. These checks establish local integration behavior; owner playtesting and
production qualification remain distinct.

November 17 follow-up: [Unified navigation](unified-navigation-increment.md) replaces the independent
home/cart guides with a shared destination picker and compass, including contextual plant guidance.
