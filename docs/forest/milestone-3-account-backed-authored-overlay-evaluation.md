# Milestone 3 account-backed authored-overlay evaluation

## Judgment

**Milestone 3 is complete and ready to hand off to Milestone 4.**

As of August 18, 2026, the implementation through repository commit `01b84fb` provides the
smallest honest account-backed personal layer in the production Activity Forest. An authenticated
owner can place, move, and remove a private `personal-marker`; see the intended result from another
session and physical device; survive retries and stale concurrent changes without duplication or
silent overwrite; and recover visibly when the server cannot confirm a mutation.

This is a durable authored-overlay proof, not the restoration of the Forest Lab game. It does not
yet provide inventory, materials, gathering, trails, construction, public visiting, offline
mutation, or real-time collaboration. Those boundaries remain explicit so Milestone 4 can build on
the proven mutation and regional-read protocol rather than rediscovering persistence policy while
adding product mechanics.

## Product proof

The completed owner loop is:

```text
enter the authenticated private forest
  -> load generated, writing-linked, and authored state through separate bounded paths
  -> choose an in-frame marker placement
  -> show a provisional local result immediately
  -> commit one versioned account-backed marker
  -> reconcile the local result with the authoritative response
  -> move or remove it with compare-and-set protection
  -> leave and return from another authenticated session or device
  -> see exactly the committed result
```

When a response is lost, the browser retries the same logical operation and reconciles with the
authoritative record. When a save is rejected, the interface does not call the provisional state
saved: it restores the last confirmed state or shows a bounded recovery action. This is immediate
client prediction followed by server reconciliation; it is not a claim about any particular
commercial game's internal networking architecture.

The private API surface is deliberately narrow:

- `GET /api/v1/forest/authored-regions` reads bounded authored pages;
- `PUT /api/v1/forest/authored-objects/:objectId` creates or recovers one marker;
- `PATCH /api/v1/forest/authored-objects/:objectId/placement` moves one current marker;
- `POST /api/v1/forest/authored-objects/:objectId/removal` removes one current marker; and
- `GET /api/v1/forest/authored-diagnostics` returns privacy-safe owner diagnostics.

Owner identity and the primary forest come only from the authenticated session. Object, region,
and cursor identifiers are locators, never capabilities.

## Implemented state boundary

Milestone 3 introduced three independently indexed durable record families:

1. **Authored object:** stable owner/forest/object identity, closed kind and appearance versions,
   immutable creation fingerprint, current or final signed placement, lifecycle, revision, world
   compatibility evidence, and removal-retention evidence.
2. **Authored region revision:** a small per-cell generation that invalidates continuations and
   lets clients detect a changed regional view.
3. **Authored reset operation:** bounded, retryable owner-wide progress and aggregate results for
   the internal reset workflow.

They remain separate from the existing generated owner world and writing-tree ledgers. Transient
player, camera, focus, preview, animation, request, and save-status state remains in the browser.
Production neither reads nor uploads Forest Lab overlay `localStorage` data.

The only authored kind is `personal-marker`, with appearance `quiet-waymarker` version 1. It is
private, material-free, non-solid, non-singleton, and independent from writing identity. It carries
no free-form text or arbitrary payload. The accepted per-cell cap is 128 markers, the spatial index
reuses 720-unit signed cells, and world coordinates are bounded to plus or minus 1,000,000,000.

## Identity, mutation, and lifecycle result

- The browser creates one UUIDv4 `objectId` before the first request. Exact owner/forest/object
  uniqueness is the durable idempotency authority.
- A server-computed version-1 SHA-256 creation fingerprint distinguishes an equal retry from a
  different create intent under the same id.
- Equal concurrent creates converge on one logical record. Different intent under the same id
  returns an idempotency conflict.
- Move and removal require the expected current revision. A stale request cannot silently replace
  a newer accepted state.
- Retrying a committed create, move, or removal recovers the current desired outcome without
  duplicating, reverting, or resurrecting the marker.
- Removal creates a tombstone retained for a 90-day recovery and investigation window. Retention
  cleanup later deletes eligible tombstones in bounded batches.
- Reset is an internal, bounded, idempotent operation. It removes authored objects without deleting
  or changing source writing.
- Unknown durable or protocol versions fail closed. Malformed records are unavailable, while known
  incompatible records surface a migration-required state rather than being silently moved or
  deleted.

## Authorization and privacy result

HTML, regional reads, diagnostics, and mutation boundaries require a current authenticated owner,
derive authority from the session, and use private non-cacheable responses. Reads and errors do not
enumerate another owner's forest. Regional cursors bind the owner, requested signed cells, active
schema versions, and regional revision snapshot.

Mutations use exact same-origin JSON requests, deletion-fence checks, server-side schema, world,
terrain, reach, collision, density, and revision validation, and bounded machine-readable errors.
The current rate limiter is deliberately process-local: a 60-second window permits 30 requests per
owner and 20 per session, with at most 10,000 in-process buckets. It is useful prototype protection,
not a final distributed policy; a multi-process production deployment must replace it with shared
enforcement.

The diagnostic boundary returns aggregate record, lifecycle, version, region, reset, and recovery
information. It excludes private writing content and raw owner identity. Milestone 3 exposes JSON,
not a frozen downloadable backup artifact or user-facing support console.

## Cross-session and browser evidence

Human review completed the smallest proof on the development deployment:

- a marker was placed from a desktop browser;
- the same committed marker was observed, moved, and removed from a separate authenticated session
  on a physical iPhone;
- placement, movement, and removal were retested after optimistic local prediction and server
  reconciliation were introduced;
- a narrow mobile layout was retested after status pills were changed so simultaneous notices no
  longer overlap; and
- the developer-like control above the forest was removed in favor of the in-frame interaction.

The reviewer reported the completed loop working as intended. Exact browser and device model
versions were not recorded, so this is focused cross-device continuity evidence rather than broad
browser certification or physical-device performance coverage.

Automated browser suites additionally exercise keyboard, pointer, and touch intent; focus and
reduced-motion behavior; provisional, saving, committed, conflict, failure, retry, and recovery
states; regional composition; and marker inspection. The semantic writing path remains independent
of canvas interaction.

## Real-database mutation and recovery evidence

The guarded mutation fixture exercised the production services against the development MongoDB
path. Its sanitized outcomes were:

| Scenario | Observed outcome |
| --- | --- |
| Equal concurrent create | One `created`, one `existing-active` |
| Colliding creates | One created; loser rejected for placement collision |
| Same id, different create intent | One created; loser rejected for idempotency conflict |
| Competing compare-and-set changes | Exactly one accepted; stale loser observed the removed state |
| Lost move response | Retry recovered the unchanged accepted placement |
| Lost removal response | Retry returned `already-removed` |
| Create retry after removal | Returned `existing-removed`; no resurrection |
| Simulated create abort | Recovery later produced one created object |
| Stable regional continuation | Page 1 and its continuation returned once each |
| Changed regional continuation | Rejected with `AUTHORED_REGION_CHANGED` |
| Cross-owner regional read | Returned non-enumerating absence |
| Unsupported durable record | Returned `AUTHORED_REGION_MIGRATION_REQUIRED` |

The fixture finished with four active objects, three tombstones, five cell revisions, and a deletion
fence revision of 16. Those counts describe isolated fixture data, not a user entitlement.

The lifecycle fixture separately proved:

- active-only diagnostics skipped tombstones;
- reset progressed, completed one worker batch, then returned `already-completed` on retry after
  affecting two objects;
- retention deleted three tombstones in four bounded batches and one completed reset operation in
  two batches without changing regional revisions; and
- migration dry-run identified three records, an injected interruption stopped after one, resume
  migrated the remaining two, and a complete rerun reported all three already current.

The migration result proves forward-rejection, dry-run, compare-and-set application, interruption,
resume, and idempotent rerun mechanics. Version 1 has no predecessor requiring a real transform,
so Milestone 3 intentionally registers no production migration plan. Before a future schema change,
the actual transform and a durable deployment-operation record should be designed and exercised.

## Account-deletion evidence

The guarded account-deletion fixture seeded an isolated owner, deleted the account directly, and
verified the full cleanup lifecycle:

- access was allowed before deletion and failed closed immediately afterward;
- the first cleanup pass remained pending while removing one authored object, one region revision,
  one reset operation, and two writing trees;
- the second pass converged by removing the remaining writing tree and owner world;
- the next idempotent pass selected and deleted zero records;
- deletion evidence became eligible to expire only after cleanup converged; and
- all 32 post-deletion absence and disposition checks passed.

This proves immediate revocation and eventual bounded cleanup across owner-world, writing-tree, and
all three authored record families. It does not treat tombstone retention as permission to retain
records after account deletion.

## Pressure and performance evidence

One guarded synthetic run against the remote development database covered empty, first-object,
sparse, dense, many-region, combined-writing, reset, retention, and migration shapes.

| Profile | Sanitized observation |
| --- | --- |
| Setup | 512 markers in 4.62 s; 96 region revisions in 0.44 s; 655 writing trees in 10.18 s |
| Empty / first marker | One page, 213 / 436 bytes, 382 / 384 ms |
| Single mutations | Create 552 ms; retry 313 ms; conflict 314 ms; move 562 ms; remove 433 ms |
| Sparse authored | 36 markers across 9 cells; one 8,801-byte page in 761 ms |
| Collision neighborhood | Two database placement-neighborhood queries; limit-plus-one bounds of 1,153 marker rows and 10,001 tree rows |
| Dense accepted cell | 128 markers; two pages; 29,775 bytes; 1.85 s total |
| Density rejection | The 129th marker was rejected in 1.58 s |
| Changed continuation | Rejected in 157 ms; restart returned all 128 markers in two pages and 1.83 s |
| Many sparse cells | 256 markers across 64 cells and 8 request groups; 8 pages; 63,000 bytes; 5.58 s total, 705 ms median, 728 ms maximum |
| 55 writing trees plus authored | 36 markers in one 8,801-byte page and 55 trees in one 16,637-byte page; 25,438 bytes combined |
| 600 writing trees plus authored | 36 markers in one 8,801-byte page and 600 trees in six pages totaling 178,930 bytes; 187,731 bytes combined |
| Reset / purge | Reset 20 objects in two worker batches; purged 20 tombstones in three batches and one reset operation in two batches, without failures |
| Migration | Dry-ran 500 records in two batches; applied 500 in two batches; rerun reported all 500 already current |

The 600-tree writing pages took 7.73 seconds total, with a 1.29-second median and 1.33-second maximum.
The 500-record migration apply took 29.00 seconds because the readiness harness deliberately uses
sequential remote per-record compare-and-set writes. That is acceptable evidence of bounded,
resumable correctness, but the actual future migration should be measured and optimized before
deployment.

Node-side manifest serialization remained small in this fixture (about 0.4 to 1.5 ms for the
reported shapes), but that is not a browser frame measurement. All timings are diagnostic samples
from one development machine, one synthetic distribution, and one remote development database run.
They establish bounded query, page, payload, batch, and rejection behavior; they do not establish a
production SLO, statistical percentile, final capacity, mobile rendering budget, or paid limit.

## Automated verification

The implementation checkpoint completed **1,131 specs with 0 failures**, along with the full lint
task. Focused suites cover:

- authored schemas, closed versions, invariants, uniqueness, and indexes;
- account-deletion fences, cleanup batches, convergence, and evidence retention;
- exact create idempotency, fingerprint conflicts, compare-and-set changes, removal, and abort
  recovery;
- collision, reach, terrain, density, world compatibility, and region-revision authority;
- private routes, cache headers, same-origin JSON, rate limits, stale sessions, cross-owner absence,
  and bounded error mapping;
- regional pages, cursor binding, snapshot invalidation, diagnostics, and unsupported versions;
- optimistic browser prediction, reconciliation, retries, failures, marker interaction, and mobile
  notice layout;
- reset, tombstone retention, migration readiness, interruption, resume, and idempotent rerun; and
- empty, sparse, dense, many-region, combined-writing, cleanup, and migration fixture composition.

The guarded real-Mongo fixtures add transactional, index, concurrency, remote timing, lifecycle,
and deletion evidence that mocked unit paths cannot provide.

## Active Milestone 3 versions and bounds

| Boundary | Active value |
| --- | ---: |
| Authored-object schema / identity | 1 / 1 |
| Creation fingerprint | 1 |
| Authored mutation protocol | 1 |
| Marker appearance (`quiet-waymarker`) | 1 |
| Authored spatial index | 1; 720-unit cells |
| Authored-region revision schema | 1 |
| Authored-region manifest / cursor | 1 / 1 |
| Authored reset schema / operation | 1 / 1 |
| Authored diagnostic / cursor | 1 / 1 |
| Migration-readiness harness | 1 |
| Tombstone retention policy | 1; 90 days |
| Marker density | 128 per cell |
| Regional request | 1–9 cells |
| Regional page size | 100 default; 250 maximum |
| Reset, retention, and migration batch size | 100 default; 250 maximum |

These versions remain independent from owner-world, generated environment, writing-tree, and
writing-region versions. Unsupported versions fail closed rather than being silently reinterpreted.

## Completion-gate assessment

| Milestone 3 criterion | Judgment |
| --- | --- |
| One supported account-backed object is separate from generated and writing state | Met |
| Create retry produces one object and recovers a lost response | Met |
| Stale concurrent mutations cannot silently overwrite newer state | Met |
| Removal and reset neither resurrect objects nor affect source writing | Met |
| Authored objects load through bounded owner-only regional continuation | Met |
| Reload, another session, and another device show the intended result | Met |
| Unsupported versions and unsafe reconciliation fail visibly | Met |
| Migration and recovery mechanics are explicit, tested, and idempotent | Met, with a real transform deferred until one exists |
| Account deletion immediately revokes and eventually cleans every new family | Met |
| Cross-owner and stale-session boundaries do not enumerate private records | Met |
| Production rejects development `localStorage` as authority | Met |
| Generated, writing, authored, and transient layers remain independent | Met |
| Empty, sparse, dense, many-region, and combined histories remain bounded | Met with development-shaped performance limits |
| Provisional and failed changes are never represented as saved | Met |
| Human review distinguishes drawing a marker from remembering it | Met |

## Known deferrals and limitations

The following are explicit later work rather than incomplete Milestone 3 behavior:

- inventory, discovery persistence, gathering, materials, commitments, refunds, and scarcity;
- trails, benches, signs, lanterns, clearing objects, buildings, and construction catalog behavior;
- authored writing relationships, writing-tree relocation, free-form marker text, media, and
  appearance selection;
- a user-facing reset route, reset confirmation design, restore/undo UI, and tombstone restore;
- scheduled retention orchestration beyond the bounded internal cleanup service;
- a frozen diagnostic download, support console, or new backup guarantee;
- a real schema migration transform, durable deployment-operation record, and migration-specific
  throughput design;
- shared distributed rate limiting for multi-process deployment;
- offline replay, real-time collaboration, shared ownership, public visiting, and guest mutation;
- final production capacity, product density and request limits, SLOs, browser pressure profiling,
  and broad physical-device coverage; and
- importing or merging prior Forest Lab `localStorage` state.

None of these deferrals weakens the completed promise that the authenticated forest now remembers
one supported private authored change rather than relying on one browser.

## Milestone 4 handoff

Milestone 4 can now connect the real-writing grove and this durable owner layer to the smallest
complete owner loop. It should preserve the established separation and extend the existing
protocol deliberately:

1. select the minimum gathered material and commitment/refund semantics before adding inventory
   records;
2. select one authored spatial relationship around real writing, rather than generalizing every
   object kind at once;
3. version any new kind, appearance, payload, ledger, and mutation intent explicitly;
4. keep immediate previews provisional and the server authoritative;
5. preserve bounded regional composition across writing and authored layers;
6. retain semantic access to writing when customization is unused or unavailable;
7. define undo, removal, and full-refund concurrency before exposing material spending; and
8. repeat authorization, deletion, migration, recovery, pressure, and cross-device evidence for
   every new durable family.

The existing authored endpoints may share service primitives with later kinds, but their closed
Milestone 3 contracts must not be silently broadened. Inventory and material commitment should be
designed as their own durable ledgers rather than appended to the marker record or owner-world root.

## Governing contracts and evidence

- [`account-backed-authored-overlay-contract.md`](account-backed-authored-overlay-contract.md)
- [`authored-object-mutation-service-contract.md`](authored-object-mutation-service-contract.md)
- [`authored-region-private-api-contract.md`](authored-region-private-api-contract.md)
- [`authored-retention-cleanup-service-contract.md`](authored-retention-cleanup-service-contract.md)
- [`authored-migration-readiness-harness-contract.md`](authored-migration-readiness-harness-contract.md)
- [`production-owner-writing-lifecycle-contract.md`](production-owner-writing-lifecycle-contract.md)
- [`owner-production-scene-contract.md`](owner-production-scene-contract.md)
- [`../account-deletion-lifecycle-contract.md`](../account-deletion-lifecycle-contract.md)
- [`../testing/forest-authored-mutation-integration-fixture.md`](../testing/forest-authored-mutation-integration-fixture.md)
- [`../testing/forest-authored-lifecycle-integration-fixture.md`](../testing/forest-authored-lifecycle-integration-fixture.md)
- [`../testing/forest-authored-pressure-integration-fixture.md`](../testing/forest-authored-pressure-integration-fixture.md)
- [`../testing/account-deletion-integration-fixtures.md`](../testing/account-deletion-integration-fixtures.md)

Milestone 4 must preserve these accepted boundaries unless a later explicit product decision,
version, migration, and recovery plan supersedes them.
