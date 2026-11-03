# Forest writing read-and-return contract

Accepted November 1, 2026 as the first implementation increment of Part III Milestone 4, extended
the same day with request-scoped return to the source tree.
This is navigation presentation, not the writing-linked marker relationship or milestone completion.

## Promise and boundaries

Opening writing from the forest provides a visible way back to the owner's forest without relying
on browser Back. The writing remains the ordinary post, with its ordinary authorization and
visibility. A private forest does not make public or unlisted source writing private.

- Tree inspection's selected post and translation links append `?from=forest&returnTree=<tree UUID>`
  to the canonical path returned by the current inspection service. Browser links retain the current UI
  language prefix. The inspection API itself still returns canonical paths without context.
- Both title and read links in `/forest/writing` use the same context, source tree and UI language prefix. The
  read service's canonical writing path remains unchanged; the HTML view model adds a presentation
  path. This applies to visible and hidden writing lists.
- The shared path helper accepts trusted canonical post paths without queries or fragments; it is
  not a general URL builder or redirect validator.
- The post route evaluates context after normal optional session authentication and language
  resolution. Only an exact scalar `from=forest` enables the context. Arrays, objects, alternate
  strings, and supplied return URLs do not choose a destination.
- For an authenticated user, the post renders localized “Return to forest” links above and below
  its writing, both to the fixed UI-prefixed `/forest` route, carrying a syntactically valid scalar
  UUIDv4 locator as `returnTree` when present. Malformed or duplicate locators use the entrance.
  Links use normal same-tab navigation.
  The forest independently authorizes the current session on return. The token is not proof of a
  previous forest visit, tree eligibility, ownership of this post, or access permission.
- A visitor without a current authenticated user gets no personal forest return control. Exact
  forest-context responses, including guest responses, use `Cache-Control: private, no-store` and
  `Vary: Cookie` so contextual presentation cannot cross cache/session boundaries.
- Ordinary post visits receive no additional return UI or cache changes from this middleware.
  Post language-selector redirects preserve the fixed token through the existing redirect policy.
- Canonical URLs, alternate-language SEO links, and share URLs remain free of navigation context.
  The optional opaque tree reference is a locator, never authority. No writing content, owner,
  forest, Block/group, marker identity, or client-asserted coordinates enter navigation context.

## Source-tree arrival

The authenticated forest route canonicalizes `returnTree` and derives owner and preferred language
from the session/context. No request owner or coordinate is accepted. Normal entry does no target
lookup. Empty or reconciling forests retain their existing behavior.

The return resolver reuses current writing inspection authorization. It then reads one exact
owner/forest/tree row with the inspected record revision, requiring active, visible state and
supported signed coordinates. A mismatch or unavailable source means ordinary entrance entry.

Collision evidence comes from the existing validated regional manifest for the target's 3×3 signed
cells, at most four pages of 250 placements. No full-owner scan or asset generation is added to the
resolver. Pagination must finish before a spawn can be chosen; an over-budget region falls back
to the entrance while ordinary browser regional pagination remains available.

The pure placement helper tries 16 fixed positions around the target, separated from the trunk by
avatar radius plus an eight-unit gap. It rejects collisions with every returned visible tree and
coordinates beyond the supported world bounds. Production ground is traversable and existing
markers are non-solid. A fully obstructed destination falls back. Unknown versions, changed tree
identity/position, unauthorized writing, read failures and missing records share that fallback
without logging private details or exposing an enumeration reason.

Bootstrap version 2 optionally includes `returnDestination: { treeId, spawn }`. The ordinary spawn
stays at `(0, 0)`; initial cells instead surround an accepted destination. The browser waits for its
normal complete regional/asset load, rechecks the target and collision-free arrival, then shows
the avatar and focuses/highlights the source tree. Movement clears the arrival emphasis. A missing
tree, blocked arrival or failed target-region load returns to the entrance and loads its cells.
Movement and placement are unavailable until arrival is settled. The entrance control always uses
the ordinary spawn, even after arriving by a source-tree link.

The viewport receives keyboard focus once on page initialization, without scrolling or waiting
for async arrival work. Later load completion leaves the player's chosen focus alone.

Edits preserve the tree reference and resolve current writing. Hide, removal, loss of eligible
owner writing, or a different account cause entrance fallback. Restoration under the same identity
permits tree return again. Translation links retain the original owner-tree destination; they do
not retarget it to a foreign translation author's forest.

## State and access

No records, indexes, migrations, retention policies, account-deletion work, local storage, or
persisted player/camera state are added. Arrival is a request-scoped navigation destination, not a
saved location. Cross-session finding of linked markers remains later work.
Native links support keyboard, pointer, touch, and reduced motion without animation. Link targets
have a 44px minimum height, wrap on narrow layouts, and mirror the arrow in right-to-left UIs.
The label is supplied in every supported UI language using the existing localization system.

## Evidence and walkthrough

`spec/forestWritingReturnSpec.js` exercises real Express context middleware, localization, SEO,
the semantic forest writing handler, and full Pug templates with explicit authentication/writing
fixtures. It covers read/return destinations, normal/guest visits, invalid/duplicate query context,
language resolution, canonical metadata, cache boundaries, and translated copy. Return-destination
and bootstrap specs additionally cover authorization reuse, revision-scoped reads, bounded
pagination, collisions, signed boundaries, unavailable targets, and initial cell selection. These tests do not
prove live session authentication, physical-device interaction, or player attachment.

On a development deployment with a real authorized account:

1. Enter `/:lang/forest`, inspect a tree, and open its current post and a translation.
2. Confirm the post shows the correct writing and localized return links before and after it.
3. Follow a return link and confirm the avatar arrives near the same tree, with a static highlight
   and inspection prompt. Move away, then verify “Return to entrance” uses the normal entrance.
4. Repeat using both a title link and “Read post” in `/:lang/forest/writing`, including a hidden
   tree where available. Confirm the UI language survives.
5. Open the ordinary canonical post directly: it has no forest return controls. Open the contextual
   URL after signing out: the post follows its usual access policy and has no personal return UI.
6. Repeat with keyboard only, reduced motion, and physical mobile. Verify focus visibility, both
   links' touch targets, long writing, and narrow/RTL layouts. Record browsers/devices and results.
7. In another tab, hide the source tree after opening its post. Follow the old return link: the
   forest should use the entrance. Restore the tree and retry: the same destination works again.

An isolated browser walkthrough is reproducible without a database or actual account:

```sh
mkdir -p /tmp/forest-return-firefox
firefox --headless --no-remote --profile /tmp/forest-return-firefox --remote-debugging-port 9224
# In another terminal, using Node 24 through Robert's nvm:
node scripts/dev/checkForestWritingReturn.js
```

The fixture uses production bootstrap, return resolver, navigation middleware, owner template and
browser modules with in-memory writing/region responses. It verifies actual Firefox keyboard
inspection, post/return URLs, target-neighborhood loading, entrance reset, and disappearance/read-
failure fallback at 1280px and 390px widths. It does not prove real authentication, live database
behavior, physical touch, or usability with a human participant. No production access is involved.

Authenticated desktop and physical-mobile review remain open until explicitly recorded. No
database fixture is needed for this navigation-only change.
