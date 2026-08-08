# Owner writing-tree inspection contract

## Scope

`GET /api/v1/forest/trees/:writingTreeId/inspection` completes the first production
tree-to-writing recognition boundary. It is a private, read-only endpoint for the authenticated
owner's currently active and visible writing tree. The opaque tree id supplied by a regional
manifest locates a candidate only; it does not confer authorization.

The endpoint independently derives the owner from the current session, rechecks the active primary
owner world, scopes the tree read to that owner and world, validates current ledger and projection
identity, and resolves writing from current Blocks. Responses use `Cache-Control: private,
no-store` and vary on `Cookie` through the shared forest API boundary.

## Current owner display writing

Inspection preserves the personal meaning of the tree. Its default recognition writing is selected
only from current eligible owner-authored variants, using the accepted preference order:

1. earliest owner variant in the interface/preferred language;
2. the captured founding owner variant, when still available; then
3. the earliest current eligible owner variant.

A foreign-authored or account-deletion-retained translation can never become that default. The
response returns only the selected title, language, creation date, and canonical post path. Body
content, group identity, owner identity, founding evidence, placement, projection fingerprint, and
asset identity remain absent.

## Dynamic translation discovery

Available translation links are resolved on every inspection from current group Blocks. Each row is
classified through `classifyForestTranslationDiscovery()`:

- owner-authored eligible variants are available;
- public foreign or deletion-retained variants are available;
- locked unlisted foreign or deletion-retained variants are available;
- in-progress unlisted foreign or deletion-retained variants are hidden; and
- malformed, legacy, deleted, or unsupported rows are not disclosed.

The tree ledger does not retain a translation array. Inspection reads at most 12 raw group rows by
default and 25 by explicit bound. An opaque versioned cursor is tied to the selected writing-tree id
and continues after the last raw Block id, so hidden evidence cannot cause silent truncation or an
unbounded scan. Returned translation entries contain only language, current title, canonical path,
and whether the current live owner authored that variant.

## Honest states and errors

- `ready` contains one reauthorized recognition result and a bounded translation page.
- `reconciling` contains no tree or writing metadata.
- Missing worlds, cross-owner ids, inactive trees, hidden trees, and trees with no current eligible
  owner writing use the same generic `404 FOREST_TREE_UNAVAILABLE` response.
- Malformed ids, cursors, limits, and extra query authority use a generic 400 response before a
  private tree read.
- Unsupported ledger or projection state and unexpected failures use a generic 503 response and
  log only the error class.

The canonical post route remains responsible for its own current authorization. A previously
returned inspection link is not permanent access.

## Scene interaction

The owner scene highlights the nearest tree within the existing interaction radius. The owner may
inspect it with Enter, Space, or E, with the visible Inspect tree button, or by selecting the nearby
tree sprite with a pointer or touch. Direct sprite selection is limited in the browser to currently
loaded visual bounds and the same nearby radius; it is interaction presentation, not server
authority.

The accessible details panel remains inside the forest frame rather than changing page layout. On
wide viewports it overlays the right edge; on narrow viewports it becomes a bottom sheet occupying
at most 55% of the frame and scrolls internally. A restrained scrim keeps the selected-tree context
visible behind it without competing with the writing.

The panel header remains outside that internal scroll area so the Writing tree label and close
action are always reachable. Writing metadata, the canonical post action, and translation pages
scroll beneath the fixed header.

Opening inspection clears active movement input, including the transient touch joystick, and pauses
keyboard and pointer movement. Panel controls do not bubble into Canvas movement handling. Escape,
the close action, or selecting the
restrained backdrop dismisses the panel, restores the nearby-tree prompt, and returns focus directly
to the forest viewport. The
panel shows tree type and captured creation season, selected writing title/date/language, canonical
post action, and bounded translation links. Player and camera position remain page-lifetime
transient state.

## Verification

Focused service tests cover owner-preferred selection, dynamic foreign and retained discovery,
hidden foreign variants, reconciliation, owner-scoped absence, privacy, and tree-bound cursor
pagination. API tests cover missing sessions, session-derived ownership and language, forged query
authority, non-enumerating failures, and privacy-safe logs. Browser-policy tests cover paused
inspection movement and nearby sprite hit selection in addition to the existing movement,
collision, regional, and environment rules.
