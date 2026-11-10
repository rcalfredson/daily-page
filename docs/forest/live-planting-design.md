# Lanternbell: first live planting

November 8, 2026. Bounded owner-only extension; no production activation or data mutation.

A low lanternbell shrub makes a better first planting than a fruit tree (too close to writing
silhouettes) or a crop (small and chore-like). Its amber bells sit above blue-green leaves.
A wild specimen at (40, 20), inside the existing entrance clearing, offers one cutting once.
It remains a recognizable flowering plant after collection. There are no random drops or wild
resource regeneration rules. Reach is a browser interaction aid, like marker authoring, not a
claim of authoritative player position.

Plant a cutting anywhere accepted by current placement authority. A 9-unit mature ground radius
and 8-unit clearance reuse the marker footprint; the plant is walk-through and never closes a
route. Plantings remain clear of writing, markers, water, bridges and boulders. Future writing
allocation and marker placement reserve the same mature space. Ground position and growth are
independent of terrain generation. Terrain-free and generation-3/4 worlds are supported without
activation or geographic changes. Activation/upgrade captures plant protections under the owner
fence; gardening waits during terrain preparation.

Stages: rooted cutting immediately, leafy sprout after two minutes, flowering shrub after twenty
minutes. First bloom yields one cutting; subsequent harvests wait four hours from collection.
Only one harvest waits regardless of absence. No watering, expiry, death, or unattended stockpile.
Moving preserves all timestamps. Lifting returns one cutting and resets growth on replanting;
it requires a confirmation and refuses if the satchel is full. A second planting can make a pair,
a curved border, or a loose cluster. There is no placement productivity bonus.

The provisional bounds are 24 active plants and eight carried cuttings. These are engineering
bounds for this slice, not membership limits. A separate, versioned singleton garden document
contains bounded holdings and at most 24 plants, never the writing world or an action history.
One unique owner/forest index supports the fixed-size read. Regional render reads return only
plants in one to nine signed 720-unit cells. A separate bounded directory returns plant identity,
position and growth for semantic management and compass bearings; it reveals no generated map.

Every command includes the garden revision. Acquisition, deduction+plant insertion, harvesting,
moving, and lifting atomically replace the bounded document inside a Mongo transaction after
acquiring the shared owner ledger fence and validating deletion, world and terrain state.
Authoritative server time supplies timestamps and eligibility. A digest of the most recent exact
command recognizes immediate lost-response retries. Older commands conflict after any intervening
mutation; they never repeat a reward, resurrect a lifted plant or consume twice. Revision zero
creates the garden only through acquisition; reads create nothing. A failed network response
requires authoritative refresh before a fresh decision. No offline replay or optimistic planting.

The independent schema leaves marker-only regional protocols, reset and retention unchanged.
Garden state persists until explicitly lifted or account deletion; there are no garden tombstones
or expiring request receipts. Garden diagnostic GET is also the bounded private inventory.
Account deletion drains and verifies the singleton before forest cleanup can converge. Marker
reset remains marker-only. No general inventory, job scheduler, trader or economy is introduced.

UI: a proximity card inside the viewport gives discovery and nearby harvest/move/lift actions.
The shrub highlights on approach; E, a tap on the shrub, or the native action button takes a
cutting. A short transfer animation (static with reduced motion), a carried leafy stem, and a
matching satchel icon make the collected item visible. The compact in-viewport Satchel contains
planting and saved-plant bearings, with optional growing tips. No gardening control requires page
scrolling. Keyboard focus returns to the viewport when closing the satchel. New-plant previews show mature size; move previews show the selected plant’s current stage.
Both keep the mature footprint ahead of the avatar, with visible and announced feedback; walk
and face to arrange, save explicitly, cancel without expenditure. Keyboard, pointer and emulated
touch use native buttons; reduced motion retains all stage cues. Physical touch remains a separate
human check. The development walkthrough uses the real owner template and a guarded isolated
fixture; accelerated stages use an injected server clock, never a production query or client clock.

An account without a world can explicitly choose **Enter my forest**. This entry action creates
its ordinary terrain-free primary world under the owner fence, without granting a cutting,
using the existing world schema, random seed and placement versions. This is an explicit owner
choice, not activation/migration on read. Explicit collection from the wild shrub grants the
first cutting. Existing acquired cuttings and saved gardens are preserved. Later writing uses
that existing identity.

Future writing candidates reserve a conservative 48-unit canopy apron around each mature plant
before the writing phenotype is resolved. Existing trees retain their exact identities/coordinates.
No gardening mutation edits a writing tree or source post.

Carried cuttings are a transient presentation state, not another holdings ledger. Fresh acquisition
or harvest equips a cutting. Packing up stores it directly, with collection feedback aimed toward
the satchel. Opening the satchel, cancelling placement, or pressing Escape stows it; choosing to
plant equips one again. Reload starts with stored holdings and empty hands. These transitions do
not alter quantities, growth timing, mutation commands or retry behavior.
