# Forest authored pressure integration fixture

This guarded Pass 7 fixture records synthetic authored-overlay distribution and operation evidence
against the `daily-page-test` MongoDB replica set. It refuses production configuration and an
unexpected database name, requires explicit write acknowledgement, uses reserved fixture owners,
and removes its records after success or failure.

Run it with:

```sh
npm run forest:authored-pressure-fixture -- run --write
```

The fixed development profiles are:

- an empty overlay followed by its first marker;
- 36 sparse markers distributed across nine cells;
- 128 accepted markers in one cell plus an explicitly rejected 129th attempt;
- 256 markers distributed four at a time across 64 cells;
- separate nine-cell compositions of 36 markers with 55 and 600 writing trees;
- 20 markers reset and physically purged in batches of 10; and
- 500 disposable migration records processed in batches of 250.

Bulk inserts create validated distribution setup without conflating hundreds of setup transactions
with regional-read timings. The fixture uses the real transactional mutation service for create,
idempotent retry, conflict, move, remove, collision-neighborhood, density, and revision-change
measurements. It uses the real reset and owner-scoped retention boundaries for bounded lifecycle
measurements. The migration pressure collection and versions are fixture-only and do not register a
production transformation.

The aggregate report includes elapsed-time summaries, page and request counts, serialized JSON
bytes, bounded query evidence, continuation restart, cleanup convergence, and idempotent migration
evidence. It excludes owner, forest, object, coordinate, fingerprint, checkpoint, and raw record
identity.

These results characterize one development environment. They are not a production service-level
objective, final capacity claim, account entitlement, or justification for monetization. Browser
frame behavior and physical-device interaction remain separate manual evidence; this Node fixture
measures server/database work and transport preparation only.

A manual cleanup is available:

```sh
npm run forest:authored-pressure-fixture -- reset --write
```
