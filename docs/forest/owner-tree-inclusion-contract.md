# Owner writing-tree inclusion contract

## Scope

`PATCH /api/v1/forest/trees/:writingTreeId/inclusion` is the private durable boundary for an
authenticated owner to hide or restore one active writing tree. Hiding changes forest inclusion
only. It never edits source writing or replaces tree identity, founding evidence, projection,
environment, placement, or spatial reservation.

The exact request body contains only `hidden` and `expectedRevision`. The owner comes exclusively
from the authenticated session. The desired-state mutation is whole-tree behavior for the
owner/translation-group identity; it is not language-variant visibility.

## Transaction and concurrency

The service validates its bounded identifiers and desired state before database work, then runs one
transaction which:

1. acquires the owner's account-deletion fence;
2. rejects processing or completed account deletion;
3. validates the active primary owner world;
4. reads the exact active owner/world/tree record;
5. returns success without writing when the desired state is already established; and
6. otherwise compare-and-sets the old inclusion state and `recordRevision`.

A changed inclusion sets `inclusionChangedAt` and increments `recordRevision`. An already-achieved
desired state remains idempotent even when a retried caller carries the prior revision, recovering
a committed mutation whose response was lost. A stale revision requesting a different state, or a
lost compare-and-set write, returns a generic conflict.

Inactive trees are not mutable through this endpoint. Reconciliation preserves their last owner
inclusion preference, and reactivation restores the same tree with that preference intact.

## Read behavior

The default `/forest/writing` view continues to list active included trees. Its owner-only
`?view=hidden` management view lists active hidden trees using the same bounded current-writing
selection. Version-3 cursors bind the continuation to `visible` or `hidden`; cursors from the older
visible-only formats remain valid only in the visible view.

Management rows expose only the public writing-tree id, inclusion state, last inclusion timestamp,
and record revision in addition to the existing safe writing-card presentation. They do not expose
owner/group ids, founding evidence, placement slots, specimen seeds, or projection fingerprints.

Hidden trees remain excluded from regional manifests, asset authorization, ordinary scene
inspection, and the default writing grove. The hidden management read is not regional or
inspection authority.

## Interaction

Visible writing cards offer **Hide from forest**. Hidden cards offer **Unhide tree**. The
mutation is reversible and therefore does not use a confirmation dialog; controls disable while
saving and report success, conflict, or generic failure through an accessible live region.

The in-frame tree inspection also offers **Hide from forest**. After a successful mutation the
browser removes the placement from the current page-lifetime scene, closes inspection, restores
forest focus, and explains that the tree can be restored from the hidden writing view. Unhide is
deliberately managed outside the canvas because a hidden tree has no scene affordance.

## Errors and privacy

- missing authentication: `401 AUTHENTICATION_REQUIRED`;
- malformed body or identifiers: `400 INVALID_FOREST_TREE_INCLUSION_REQUEST`;
- absent, cross-owner, inactive, or otherwise unavailable tree: generic `404` or `503` without
  private identity detail;
- concurrent state change: `409 FOREST_TREE_INCLUSION_CONFLICT`; and
- unsupported durable state or infrastructure failure: generic
  `503 FOREST_TREE_INCLUSION_UNAVAILABLE`.

Private responses retain the forest API's `private, no-store` and `Vary: Cookie` boundary. Logs
name only the error class.

## Verification

Focused service tests cover hide, unhide, identity preservation, idempotent lost-response recovery,
stale and lost compare-and-set conflicts, owner scoping, account deletion, and pre-query input
validation. API tests cover authentication, exact-body authority, generic absence, and conflict
mapping. Non-canvas tests cover hidden reads, safe inclusion metadata, and inclusion-bound cursors;
the existing reconciliation tests prove deactivation and reactivation preserve the hide preference.
