# Authored-object mutation service contract

`forestAuthoredObjectMutations` is the Pass 4 durable boundary for creating, moving, and removing
an owner-only `personal-marker`. The accepted product policy remains authoritative in
[`account-backed-authored-overlay-contract.md`](account-backed-authored-overlay-contract.md); this
document records how the transactional service realizes that policy.

The service is independent from Express, sessions, and canvas rendering. A later API adapter must
derive `ownerUserId` from the authenticated session and map the bounded service outcomes and errors
without exposing private neighborhood evidence.

## Operations

`create` accepts an owner id, client-generated UUIDv4 object id, mutation protocol version 1,
`personal-marker`, and signed integer coordinates. It returns:

- `created` after inserting revision 1 and advancing the destination cell revision;
- `existing-active` for matching creation intent already represented by an active marker; or
- `existing-removed` for matching creation intent represented by a tombstone.

The immutable creation fingerprint is SHA-256 base64url over a fixed JSON array containing protocol
version, normalized object id, kind, original coordinates, and fixed appearance identity. Different
creation intent under the same object id fails as an idempotency conflict.

`move` accepts protocol version 1, object id, expected positive safe-integer revision, and new signed
coordinates. Exact current desired state returns `unchanged` before stale-revision rejection. An
accepted move returns `moved`, preserves identity and creation evidence, increments the object once,
and advances one cell revision for a same-cell move or both source and destination revisions for a
cross-cell move. Same-cell movement does not apply the population-increase guard.

`remove` accepts protocol version 1, object id, and expected revision. It returns `removed` after one
compare-and-set transition to a 90-day tombstone and one cell-revision increment. A tombstone returns
`already-removed` without another write, regardless of the repeated expected revision.

## Transaction authority

Each operation performs strict public-value validation before starting a transaction. Inside one
MongoDB transaction it:

1. increments the existing owner's forest ledger fence;
2. rejects processing or completed account deletion;
3. loads the exact active primary world and validates every supported version;
4. requires idle owner reconciliation and no processing authored reset;
5. resolves and validates the exact owner/forest/object record;
6. resolves the signed owner environment and sequentially reads bounded writing-tree and active
   marker neighborhoods through the live transaction session;
7. performs the unique insert or per-object compare-and-set update; and
8. advances every affected per-cell revision before commit.

The owner fence serializes competing owner mutations, while unique indexes and compare-and-set
filters remain the write authority. Mongo transaction retries repeat neighborhood reads. Duplicate
creation races are re-run through the same authority boundary and converge on an accepted existing
result or idempotency conflict.

## Placement and boundedness

Placement uses signed 720-unit spatial cells. A fixed 3×3 neighborhood is sufficient for the
version-1 26-unit marker spacing and maximum registered writing-tree clearance. The writer reads at
most 1,152 active markers and 10,000 writing trees with `limit + 1` overflow detection. It validates
every returned record before interpreting the neighborhood.

All writing-tree lifecycle and visibility states reserve their placement. Marker-to-tree clearance
is the registered tree collision radius plus marker radius 9 plus visual gap 8. Other active marker
centers must be at least 26 units away. Removed markers reserve no space. A create or cross-cell move
fails when the destination already contains 128 other active markers; same-cell moves, moves out,
and removals remain available.

## Completion evidence

Focused specs cover strict inputs, fingerprints, desired-state recovery, conflicts, lifecycle,
version failures, signed cell derivation, exact collision boundaries, density, query overflow, and
cell-revision behavior. The guarded real-Mongo fixture covers concurrent equal and different
creates, competing collision, competing move/removal, lost-response recovery, cross-cell changes,
tombstones, hidden inactive tree reservations, transaction abort, and clean retry. See
[`forest-authored-mutation-integration-fixture.md`](../testing/forest-authored-mutation-integration-fixture.md).
