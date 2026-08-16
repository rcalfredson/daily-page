# Forest authored lifecycle integration fixture

This guarded Pass 7 fixture exercises authored reset, diagnostic inventory, retention cleanup, and
migration recovery against the local `daily-page-test` MongoDB replica set. It refuses production
configuration and an unexpected database name, requires explicit write acknowledgement, uses one
reserved owner scope, and removes its records after success or failure.

Run the complete fixture with:

```sh
npm run forest:authored-lifecycle-fixture -- run --write
```

The run proves that:

- diagnostics paginate a mixed active/removed inventory and active-only reads safely continue past
  tombstones;
- processing reset state blocks mutation and returns explicit `resetting` regional state;
- a one-record reset batch persists progress and the worker resumes it to completion;
- completed reset retries return the same durable aggregate evidence;
- tombstones and completed reset evidence become eligible at the accepted 90-day boundary;
- both retention paths converge in one-record batches without changing regional revisions;
- a disposable Mongo-backed migration plan performs a write-free dry run;
- an interrupted migration resumes from its last safe opaque checkpoint; and
- rerunning the completed migration performs no second writes.

The migration records use fixture-only versions in the dedicated
`forest-authored-migration-fixture-records` collection. They do not define or register a production
authored-object migration.

Production retention cleanup is globally scoped by design. The fixture injects thin Mongo model
adapters that add its reserved owner to candidate reads and compare-and-set deletes. This preserves
real database ordering, validation, and deletion behavior while preventing the future-dated fixture
clock from selecting unrelated development records. The production cleanup service and its global
query contract remain unchanged.

The fixture prints bounded aggregate JSON without owner, forest, object, coordinate, fingerprint,
checkpoint, or raw record identity. A manual cleanup is also available:

```sh
npm run forest:authored-lifecycle-fixture -- reset --write
```
