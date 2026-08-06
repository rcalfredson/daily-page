# Writing-tree creation service contract

`createForestWritingTree()` is the durable boundary that turns one currently eligible owner/group
into one stable Activity Forest tree. It does not run the Block lifecycle queue or a full owner
reconciliation sweep; those callers invoke this boundary after identifying an exact owner/group.

## Input and outcomes

The service accepts canonical `ownerUserId` and `translationGroupId` ObjectId strings plus an
optional transition timestamp. It returns one of three outcomes:

- `created`: one complete writing-tree snapshot was inserted and its placement was committed;
- `existing`: the owner/group idempotency key already names a supported tree; or
- `no-eligible-founder`: no currently eligible exact-owner Block remains in the group.

The result never exposes a partly projected or partly placed tree. Callers may retry the same
owner/group after an uncertain response.

## Transaction order

Every ordinary outcome occurs inside one MongoDB transaction:

1. Increment the still-existing owner's `forestLedgerFence` and reject an account with suppressing
   deletion evidence.
2. Return a supported tree already identified by the unique owner/group key.
3. Load or create the owner's primary world and validate every policy version used by the writer.
4. Reselect the earliest eligible exact-owner Block, ordered by `createdAt` and then Block id.
5. Inspect the bounded placement stream one candidate at a time. Structural exclusions and terrain
   suitability are checked before the bounded spatial-neighborhood query; occupied candidates are
   skipped without accumulating an unbounded set.
6. Capture the accepted signed coordinates and originating environment, generate an opaque public
   tree id, and project the permanent tree traits exactly once.
7. Insert the complete tree and compare-and-set the owner world's candidate cursor and placement
   revision.
8. Commit the fence, tree, and owner-world state together.

Any failure rolls all of those writes back. A unique-index race is reloaded by owner/group after
the transaction and becomes `existing`; it never receives another placement.

## Captured versus current data

The founding Block id and timestamp, placement, originating environment, projection, and policy
versions are historical evidence and remain stable. `sourceStateChangedAt` records when the tree
entered its ledger state, not when the founding post was authored. Titles, bodies, routes,
languages, and display translations are intentionally absent from the tree snapshot and must be
authorized and resolved from current Block data when the tree is inspected.

## Deferred caller responsibilities

Direct Block lifecycle enqueueing and the cursor-based convergence sweep now orchestrate this
service. The private owner non-canvas writing route supplies the first production-facing read, and
the owner-region manifest adapter supplies the bounded durable-tree-to-scene read seam. Milestone 2
still needs the authenticated scene and asset-delivery routes, browser scene composition, and a
dedicated inspection route. Exact inactive-tree reactivation/deactivation is implemented by the owner/group
reconciliation service. Those paths must preserve this service's owner/group idempotency and
account-deletion fence.

## Verification

`spec/forestWritingTreeCreationSpec.js` exercises dependency boundaries and failure modes without a
database. The guarded `create-tree-direct` account-deletion fixture additionally proves real Mongo
creation, retry, rollback, and concurrent convergence in `daily-page-test`; see
`docs/testing/account-deletion-integration-fixtures.md` for the commands.
