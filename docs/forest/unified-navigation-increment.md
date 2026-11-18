# Unified forest navigation

November 17, 2026. Implements one shared compass in the development-gated main Activity Forest
and the construction fixture.

## Experience

Open **More → Navigate**, choose Home, Parked cart or a saved lanternbell, then **Guide me**.
A wild lanternbell is also offered before the starter cutting has been collected. Only one target
is active. The satchel's existing plant **guide me** action selects that same compass and replaces
any previous target. **Stop** dismisses guidance. Close proximity is labeled **Nearby**; guidance
remains available until stopped or replaced. This is a bearing toward a destination, not a route
around obstacles, automatic movement, or a teleport.

Destination identity is stable while its position and display label are resolved from the latest
local authoritative view. The cart target follows its physical position during a drive. Plant moves
update the bearing/distance; packing a plant removes its target and stops guidance rather than
selecting a different plant that now has the same display number. Failed garden reads retain the
last known data. Navigation itself adds no network requests, save writes or persistent state. A page
reload starts without an active destination. Background changes from another visit become visible
through the existing save/garden refresh paths, not a new polling service.

Garden panels, placement and inspection temporarily hide the compass without discarding its target.
The picker lives in More, sharing its keyboard/touch behavior. Direction has an accessible text
label; selecting, stopping or losing a destination announces a brief status without announcing every
distance update. **Recover cart at home** remains a separate world-changing action.

## Integration boundary

`public/js/forest-navigation.js` owns selection and presentation. The runtime passes its controller
to both the garden and homestead extension, which register destination providers. The old independent
home/cart toggles and fixture-only expedition compass are absent in this mode. The construction
study retains its test trail, scenery and diagnostics.

The main entry enables this only along its existing development-gated homestead path (including
before establishment). Ordinary accounts continue using their existing plant-navigation behavior.
The construction fixture explicitly enables the same controller. This increment performs no public
enablement, data migration or saved-state reset.

## Verification

**43 focused Jasmine specs passed**, including shared selection/Stop, moving and removed targets,
stable plant identities, temporary UI hiding, picker changes, contextual garden guidance and the
legacy garden behavior. Scoped ESLint and whitespace checks passed.

The Firefox checker `scripts/dev/checkForestNavigation.js` passed:

- Main preview home/cart selection, Stop, visit-local reload, and unchanged homestead save data.
- Fixture contextual plant guidance replacing Home, a refreshed moved plant, and removed-plant handling.
- Actual cart boarding/driving with guidance following its new position.
- Desktop, 390px and 320px picker/compass containment.

It saves review images under `/tmp/forest-navigation-review`; main and fixture images were visually
reviewed. Main-preview checks are navigation-only and do not mutate that owner's saved progress.
Mutable garden responses and driving tests belong to a separate temporary fixture. The earlier
full integration checker now uses the unified picker selectors, but was not rerun because it edits
the main preview owner's designs and parking.

The existing local main preview remains at `http://127.0.0.1:4185/en/forest`; refresh to load these
client modules. General material inventory and the first-time acquisition sequence remain later
increments.
