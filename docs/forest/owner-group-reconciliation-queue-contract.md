# Owner/group reconciliation queue contract

The Activity Forest reconciliation queue makes exact owner/group reconciliation asynchronous from
ordinary post writes. A successful post creation, eligibility-relevant update, or deletion remains
successful even if queue persistence is temporarily unavailable; the periodic owner sweep remains
the eventual repair path for a missed event.

## Durable identity and deduplication

There is at most one queue row for each `(ownerUserId, translationGroupId)`. Every enqueue increments
`requestedRevision` and makes the row pending and immediately available. Repeated post mutations
therefore coalesce into one request to inspect current truth rather than preserving a stale event
log.

Enqueueing runs in a MongoDB transaction that increments the owner's `forestLedgerFence`. This
orders job creation against account deletion: a committed job precedes deletion cleanup and is
removed by it, while deletion that wins first prevents a stale hook from inserting work afterward.
The post-write hook catches enqueue failure and emits only a bounded error class, never an owner,
group, Block, title, or content value.

## Leasing and newer-event races

The worker atomically claims the oldest available pending row with a bounded lease. It records a
fresh opaque lease token, expiry, attempt count, and attempt time before calling
`reconcileForestOwnerGroup()`.

On success, the worker deletes the row only when its lease token and claimed `requestedRevision`
still match. If another post mutation incremented the revision during processing, deletion fails by
design; the worker releases the lease and makes the newer request immediately available. Thus an
older successful pass cannot acknowledge unseen newer work.

Expired leases are claimable by another process. Multiple application instances can run the same
minute worker without processing one live lease concurrently.

## Failures and retry bounds

Transient failures release the lease and use exponential backoff starting at 15 seconds, capped at
one hour. After eight attempts by default, a row becomes `failed` and stops consuming worker cycles.
Only a normalized error code is retained. A later enqueue resets the attempt budget and revives the
same owner/group row, while the future convergence sweep can also re-enqueue it.

`FOREST_OWNER_UNAVAILABLE` is terminal because it means account deletion has removed or suppressed
the owner. That queue row is dropped rather than retried. Account-deletion forest cleanup also
removes and verifies the absence of all owner queue rows before declaring convergence.

## Runtime bounds

- The cron drain runs once per minute.
- A pass claims at most 25 jobs by default and never more than 100.
- The default lease is two minutes and is bounded between 10 seconds and 10 minutes.
- Attempts are bounded from 1 through 20 by configuration.
- Queue diagnostics contain counts and error classes only.

## Current post-write hooks

The API schedules reconciliation after:

- a fully successful ordinary or quest-aware Block creation;
- a successful status mutation; and
- a successful quest-aware Block deletion transaction.

Content, title, description, tags, editorial presentation, banners, collaborators, and votes do not
change forest eligibility and do not enqueue work. Foreign translations enqueue their own author's
owner/group identity; they do not mutate another owner's tree ledger.

Direct database maintenance and a process failure between a committed post write and best-effort
enqueue can still miss an event. The resumable cursor-based owner sweep is deliberately retained as
the convergence mechanism for those cases and for historical enrollment.
