# Authored migration-readiness harness contract

`buildForestAuthoredMigrationHarness` provides the pre-version-2 batching and recovery machinery
required by Milestone 3. Version 1 is the first production authored-object shape, so the repository
does not invent a version-0 record or register a production transformation before a real successor
exists.

The harness is internal library code. It adds no HTTP route, browser control, scheduler, durable
migration-operation collection, or automatic repair behavior. Before a real production migration
is enabled, its deployment must first add compatible readers plus any durable operation evidence,
indexes, retention, and account-deletion integration required by that migration.

## Plan boundary

A migration supplies an explicit plan id, distinct positive source and target versions, and five
operations: bounded stable-order reading, record classification, transformation, preservation
validation, and compare-and-set writing. No production plan is currently registered.

Classification distinguishes source, already-target, malformed, and unsupported evidence. A plan
must assign every record a bounded stable record id. The harness rejects duplicate, descending,
oversized, or otherwise unstable batch evidence rather than advancing through it.

## Execution and recovery

Dry-run is the default. It executes classification, transformation, and preservation validation but
never invokes the writer. Apply mode accepts only `migrated`, `already-current`, or `conflict` as
compare-and-set outcomes.

Batches default to 100 records and cannot exceed 250. The harness requests one overflow record,
processes at most the accepted batch size, and returns an opaque caller-held checkpoint bound to its
exact plan versions and mode. A checkpoint cannot be replayed from dry-run into apply mode.

The checkpoint advances only after an already-current record or an accepted, invariant-preserving
transformation. Malformed, unsupported, invariant-breaking, conflicting, or unavailable work stops
the batch at that record and leaves the checkpoint at the last safe predecessor. Retrying therefore
revisits the unresolved record. Rerunning from the beginning classifies accepted target records as
already current and performs no second write.

## Privacy and invariants

Results contain aggregate counts, a bounded reason, and an opaque checkpoint. They contain no
owner, forest, object, coordinate, fingerprint, or raw record identity. A concrete authored-object
plan must preserve object identity, creation fingerprint, current/final coordinates, record
revision, lifecycle state, and original user timestamps; generated incompatibility is never
permission to relocate, delete, or silently reinterpret a record.
