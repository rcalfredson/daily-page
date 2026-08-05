# Exact owner/group reconciliation contract

`reconcileForestOwnerGroup()` is the lifecycle boundary for one authenticated owner and one
translation group. It converts current Block evidence into the durable tree states defined by the
Activity Forest ledger without changing established identity, placement, environment, projection,
or the owner's hidden preference.

## Outcomes

| Current ledger | Current evidence | Outcome |
| --- | --- | --- |
| no tree | eligible | create through the transactional writing-tree service |
| no tree | ineligible | remain absent |
| active tree | eligible | preserve and mark seen in the current world epoch |
| inactive tree | eligible | reactivate the same tree |
| active tree | conclusively ineligible | deactivate while retaining the record |
| inactive tree | conclusively ineligible | remain inactive |
| any existing tree | unresolved | preserve the last known-good state and report a bounded reason |

Creation, reactivation, and preservation never select a foreign user's translation as owner
evidence. Current display variants remain a separate read-time concern.

## Exact-group evidence

The shared owner-group evidence reader first performs the indexed deterministic founder query using
exact `userId` and `groupId`, supported writing fields, and ascending `createdAt` then Block id. If
that query finds no eligible founder, it inspects at most 100 exact-owner group rows to distinguish
conclusive ineligibility from malformed evidence. Reaching that bound is unresolved rather than
empty, so an unusually large or unsupported group cannot erase a last known-good tree.

The transactional creator uses the same evidence reader. This prevents creation and later
reconciliation from assigning different meanings to missing authorship fields or malformed source
metadata.

## Transaction and revision behavior

Every existing-tree reconciliation:

1. increments the still-existing owner's account-deletion fence;
2. rejects suppressing deletion evidence;
3. reloads and validates the exact owner/group tree and its primary owner world;
4. resolves current exact-group evidence in the same transaction; and
5. compare-and-sets any lifecycle update by tree state and `recordRevision`.

Activation and deactivation set `sourceStateChangedAt` and increment `recordRevision`. Merely
marking an eligible tree with the world's current reconciliation epoch does not increment the
owner-visible revision. Repeated active, inactive, and absent decisions are idempotent.

## Preserved state

Deactivation is a tombstone transition, not deletion. Reactivation preserves:

- `writingTreeId` and founding evidence;
- placement and its spatial index;
- originating environment and permanent projection;
- the owner's independent hidden/unhidden preference; and
- all creation-time policy evidence.

Only account deletion currently removes the tree record. Inspection and scene readers must exclude
inactive trees even though their placement remains reserved.

## Deferred orchestration

This service accepts one exact owner/group; it does not yet enqueue itself from Block mutations.
Remaining Milestone 2 orchestration includes the post-write lifecycle hook/queue and the resumable
cursor-based owner sweep that recovers missed events and deactivates unseen groups.
