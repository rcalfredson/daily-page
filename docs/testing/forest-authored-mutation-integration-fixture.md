# Forest authored-mutation integration fixture

The Pass 4 fixture exercises authored marker mutations against the local `daily-page-test` MongoDB
replica set. It refuses production configuration and an unexpected database name. The fixture uses
one reserved owner id, removes any prior records in that scope before starting, and removes them
again after a successful or failed run.

Run the complete fixture with:

```sh
npm run forest:authored-mutation-fixture -- run --write
```

The run proves that:

- concurrent equal creates converge on one marker;
- concurrent different creation intent under one object id preserves one winner and conflicts;
- concurrent colliding creates serialize through the owner ledger fence and exactly one commits;
- a concurrent move and removal with one expected revision commit exactly one state change;
- same-cell and cross-cell moves advance object and cell revisions correctly;
- a lost move response is recovered by desired state while a stale different move conflicts;
- removal produces a 90-day tombstone and repeated removal and creation cannot resurrect it;
- hidden and inactive writing-tree placement still blocks a marker;
- an intentional transaction abort leaks neither object nor regional-revision writes; and
- retry after that abort commits normally.

The fixture prints a bounded JSON summary without owner, object, coordinate, or fingerprint values.
It cleans itself up automatically. A manual cleanup is also available:

```sh
npm run forest:authored-mutation-fixture -- reset --write
```
