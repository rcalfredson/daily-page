# Owner convergence sweep contract

The convergence sweep repairs an established owner world from current database truth. It uses the
same exact-group reconciler as the event queue, but discovers work by walking bounded owner Block
and active-tree pages instead of consuming mutation events.

## Epoch and lease lifecycle

An idle owner world starts a sweep by atomically:

- incrementing its reconciliation epoch exactly once;
- selecting the `owner-blocks` phase with a null Block cursor;
- recording the start time; and
- acquiring a bounded opaque lease.

A worker may resume a running world only after its lease expires. Resumption replaces the lease
token but preserves the epoch, phase, and cursor. A live lease returns `not-claimable`. The lease is
coordination rather than correctness authority: duplicate page work is safe because exact-group
reconciliation is idempotent, while cursor updates compare the world id, owner, status, epoch,
phase, and lease token.

Each invocation processes one page by default, then makes an unfinished lease reclaimable. The
scheduled worker prioritizes expired running worlds before starting due idle worlds, preventing a
large untouched population from starving recovery.

## Owner-Block phase

The Step 1 exact-owner adapter reads at most 25 Blocks by default, with its existing maximum of 100.
Only the translation-group ids in that page are deduplicated; no whole-owner group set is retained.
Every eligible group is passed to `reconcileForestOwnerGroup()`, which creates, preserves, or
reactivates the durable tree and marks eligible trees with the current epoch.

The Block cursor advances only after all page groups succeed. A crash or transient error leaves the
cursor unchanged, so the entire page is safely replayed. Adapter classification reasons are
returned only as bounded counts.

End-of-stream atomically changes the world to `unseen-trees` and clears the Block cursor.

## Unseen-tree phase

This phase pages through active owner trees whose `lastEligibleReconciliationEpoch` differs from the
current epoch, ordered by opaque `writingTreeId`. Each supported tree's exact group is reconciled:

- current eligible evidence marks it with the epoch;
- conclusively absent owner evidence deactivates it; and
- malformed or unsupported evidence preserves the last known-good tree and contributes a bounded
  reason count.

The tree cursor advances only after the page completes. After the final page, one compare-and-set
returns the world to `idle`, clears all active cursors and lease fields, and records completion.

## Scheduling bounds

The cron worker runs every five minutes and selects at most five worlds per pass. It first selects
expired running leases, then fills the remaining bound with idle worlds that have never completed or
last completed at least six hours ago. Owner errors are isolated and logged by error class only.
The service bounds owner selection at 25, tree pages at 100, steps per direct invocation at 10, and
leases between 30 seconds and 15 minutes.

## Current enrollment boundary

Scheduled sweeps operate only on existing primary owner-world roots. They repair missed events and
enroll previously unseen groups for owners whose forest has already been established. A future
rollout/bootstrap selector is still required if historical accounts with no owner-world root should
be enrolled before their next eligible post mutation.

## Verification

Focused tests cover new epochs, expired-lease resumption, page replay after failure, phase changes,
unseen-tree pagination, unsupported records, due-owner prioritization, and privacy-safe failures.
The guarded `daily-page-test` fixture additionally removes a source Block without enqueueing work,
then proves that three bounded passes enroll two missing historical groups, deactivate the unseen
tree without changing its identity, mark every active tree with the epoch, and complete the world.
