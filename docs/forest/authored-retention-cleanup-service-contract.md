# Authored retention-cleanup service contract

`forestAuthoredRetentionCleanup` is the internal Milestone 3 boundary for physically removing
expired authored-marker tombstones and completed reset-operation evidence. The accepted product
policy remains authoritative in
[`account-backed-authored-overlay-contract.md`](account-backed-authored-overlay-contract.md).

The service has no HTTP route, browser control, or production scheduler. An operator or later
scheduler may invoke its two independent operations. Both default to 100 records and reject batch
sizes above 250.

## Tombstones

`purgeTombstones` reads only removed objects whose persisted `purgeEligibleAt` is at or before the
worker clock, ordered by `(purgeEligibleAt, _id)`. Before deleting each row, it validates the exact
supported object, identity, spatial, environment, appearance, fingerprint, revision, and lifecycle
evidence. Deletion uses a compare-and-set over record identity, supported versions, state, removal
timestamps, and record revision.

Purging does not acquire an owner fence or advance a regional revision: a tombstone has already
been excluded from authored rendering since removal. Account deletion is a separate authority and
may remove the same row without waiting for retention eligibility.

## Completed resets

`purgeCompletedResetOperations` derives a cutoff 90 days before its worker clock and reads only
completed operations at or before that cutoff, ordered by `(completedAt, _id)`. It validates exact
supported operation evidence and deletes by a compare-and-set over record identity, versions,
completed state, and completion time. Processing operations cannot enter the selection.

## Failure and observability

Each operation returns only `{ selected, deleted, failed }`. It never returns or logs owner, forest,
object, reset, coordinate, or record identity. Unsupported or malformed records, compare-and-set
misses, and individual deletion errors increment `failed` and leave the record in place. An invalid
dependency, invalid bound, or unbounded read rejects the operation as a whole.
