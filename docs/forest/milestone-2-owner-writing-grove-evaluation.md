# Milestone 2 owner-writing grove evaluation

## Judgment

**Milestone 2 is complete and ready to hand off to Milestone 3.**

As of August 9, 2026, the implementation at repository commit `9ba276b` provides the smallest
authenticated, owner-only Activity Forest grown from real eligible Daily Page Blocks. One stable
durable tree represents one owner/translation-group identity. The owner can explore bounded signed
regions, recognize and inspect current authorized writing, open its canonical post route, manage
tree inclusion through a semantic writing view, and return across ordinary writing lifecycle
changes without silently replacing tree identity.

The result is an honest read-oriented production slice, not a general Activity Forest launch. It
does not yet provide account-backed authored geography, inventory, gathering, construction, public
visiting, collaboration, or final biome topology. Those boundaries remain assigned to later
milestones.

## Product proof

The completed owner loop is:

```text
create or retain eligible owner writing
  -> reconcile one durable owner/group tree
  -> load it through bounded private forest regions
  -> encounter and inspect the tree
  -> resolve current authorized writing and translations
  -> open the canonical post
  -> hide or restore the tree independently from source-writing state
  -> return after edits, lifecycle changes, retries, or reconciliation
  -> retain the accepted tree identity and owner preference
```

The ordinary routes are:

- `GET /:lang/forest` for the private canvas scene;
- `GET /:lang/forest/writing` for the private semantic writing grove;
- `GET /:lang/forest/writing?view=hidden` for hidden-tree management;
- private bounded region, asset, inspection, translation-continuation, and inclusion endpoints; and
- canonical `/:lang/rooms/:roomId/blocks/:blockId` navigation back to writing.

Owner identity comes only from the authenticated session. Forest, tree, Block, group, route,
region, cursor, and asset identifiers are locators rather than authorization.

## Implemented state boundary

Milestone 2 introduced two production forest-owned durable record families:

1. **Owner world:** opaque forest identity, private deterministic seed, placement and environment
   versions, placement allocation cursor, lifecycle status, and resumable reconciliation state.
2. **Writing tree:** opaque public tree identity, exact owner/group uniqueness, founding historical
   evidence, stable placement and spatial index, captured originating environment, immutable
   semantic projection, current source lifecycle, independent hide preference, and revisions.

The implementation deliberately does not persist writing bodies, current titles, current display
routes, translation arrays, rendered tree pixels, player/camera position, focus, animation, or
ordinary transient life. Current recognition fields are reauthorized from Blocks at read time.

Generated identity, writing-linked identity, future authored overlay, and transient presentation
remain separate state layers. Milestone 3 must add authored state alongside the existing owner world
and writing tree records rather than serializing or replacing them.

## Eligibility, identity, and lifecycle result

- Exact live `userId` ownership is required; mutable creator names and collaborator membership are
  not owner authority.
- Supported public and unlisted, locked and in-progress, live-owner Blocks enter automatically.
- Unsupported or malformed authorship, group, room, route, language, date, status, or visibility
  evidence fails closed with bounded reasons.
- The first eligible owner-authored variant establishes immutable founding and projection evidence.
- A preferred-language foreign translation may be discoverable but never replaces the owner's
  default display variant or establishes tree identity.
- Ordinary title, body, language, route, room, and other mutable-writing changes do not silently
  reproject or move the tree.
- Conclusive loss of eligible owner writing deactivates the durable tree; restoration reactivates
  the same tree and preserves its inclusion preference.
- Unresolved or bounded-overflow evidence preserves the last known-good state instead of erasing it.
- Only account deletion currently removes the owner world and writing-tree ledger completely.

Synchronous group reconciliation handles the immediate exact owner/group. A durable deduplicating
queue handles delayed post-lifecycle work. A leased cursor-based convergence sweep scans owner
Blocks and then unseen trees to repair missed events and historical drift without treating a whole
forest as one transaction.

## Authorization and privacy result

The HTML, writing, region, asset, inspection, translation, and inclusion boundaries:

- require current authentication;
- derive the exact owner from the session;
- apply `Cache-Control: private, no-store` and `Vary: Cookie` where appropriate;
- bind opaque cursors to their owner-specific query shape;
- recheck current world, tree lifecycle, inclusion, projection, and source-writing authority;
- return generic, non-enumerating absence or unavailable errors; and
- keep raw owner, Block, group, founding, writing, and route identity out of regional manifests,
  raster asset identity, aggregate diagnostics, and failure logs.

Stale sessions and account deletion revoke access. Cross-owner scene, writing, region, asset,
inspection, inclusion, and cursor attempts do not disclose another owner's forest state.

## Distribution evidence

An explicitly authorized privacy-safe production audit on July 29, 2026 inspected bounded identity
and lifecycle fields only. It observed:

| Dimension | Sanitized result |
| --- | ---: |
| Users | 153 |
| Blocks | 189 |
| Exact live-owner Blocks | 29 |
| Eligible owner Blocks | 29 |
| Eligible owner/group trees | 19 |
| Policy-valid multilingual groups | 6 |
| Creator-only Blocks excluded from exact ownership | 160 |

The eligible owner population was fewer than five people, so per-owner history statistics remained
suppressed. The audit found no current unusually large eligible history and therefore could not set
a production capacity boundary. Retained authorship, in-progress writing, malformed evidence,
multi-owner groups, timestamp ties, and high-count histories remained synthetic verification cases.

The audit implementation is in `scripts/audits/activityForestWritingDistribution.js` and
`scripts/lib/activityForestWritingAudit.js`, with privacy-output guards in
`spec/activityForestWritingAuditSpec.js`.

## High-count and performance evidence

The account-deletion integration fixture provides separately reseeded profiles:

- **55-tree pagination:** exercises three forward and backward semantic writing pages and rejects
  duplicates, omissions, cursor drift, and mixing with the large profile.
- **600-tree pressure:** creates 600 deterministic eligible owner groups through the production
  reconciliation service, then validates every active visible tree, all writing continuations,
  signed center/dense/outer regional reads, page bounds, and authorized lossless-raster delivery.

One recorded development run produced 600 pressure trees and 603 active visible trees including
the baseline fixture. Its privacy-safe aggregate observations were:

| Measure | Observation |
| --- | ---: |
| Occupied placement cells | 96 |
| Signed cell span | 12 × 12 |
| Cell occupancy, minimum / median / p95 / maximum | 1 / 6 / 13 / 16 |
| Semantic writing pages / returned trees / maximum rows | 25 / 603 / 25 |
| Aggregate writing payload | 380,167 bytes |
| Center / densest / outer 3×3 placements | 58 / 80 / 15 |
| Authorized raster assets in sampled batch | 24 |
| Reconciliation total / median / p95 / maximum | 504.55 s / 736.71 ms / 1.33 s / 3.86 s |
| Writing-page total / median / p95 / maximum | 14.78 s / 603.13 ms / 656.28 ms / 657.45 ms |
| Sampled raster delivery, local cold / warm | 3.11 s / 1.28 s |

The initial run also exposed a fixture orchestration interaction: the scheduled whole-owner sweep
could claim the newly seeded world during the several-minute bulk setup and temporarily show its
reconciling state. The documented pressure procedure now starts the development server with
background jobs disabled before a clean seed. A later clean 600-tree run completed and was manually
explored successfully; its exact timing output was not retained and is not reconstructed here.

These figures are diagnostic evidence from the development machine, development MongoDB path, and
synthetic content. They do not establish a production service level, final capacity, slow-network
budget, universal mobile frame budget, or production cache hit rate. The fixture remains
reproducible and reports only aggregate evidence; see
[`docs/testing/account-deletion-integration-fixtures.md`](../testing/account-deletion-integration-fixtures.md).

## Interaction and accessibility evidence

Human review exercised:

- desktop and 330-pixel narrow layouts;
- keyboard and WASD movement;
- touch-drag movement and the bounded virtual joystick;
- direct touch selection and in-frame tree inspection;
- inspection scrolling with a fixed close control;
- Escape close and forest-focus restoration;
- reduced-motion behavior;
- visible and hidden semantic writing views;
- hide/unhide status, conflict, and recovery behavior;
- forward and backward pagination beyond two pages;
- empty, reconciling, regional-failure, and high-count states; and
- extended travel through the 600-tree grove and version-2 restrained ground presentation.

The non-canvas route uses ordinary headings, lists, links, buttons, live regions, current-page
navigation, and canonical writing routes. Canvas interaction is not required to recognize, open,
hide, or restore writing.

## Automated verification

The final implementation run completed **995 specs with 0 failures**. Focused suites cover:

- exact-owner Block adaptation, eligibility, lifecycle, group evidence, and variant selection;
- reconstruction limits, placement, environment, projection, and durable creation;
- synchronous, queued, and convergence reconciliation;
- owner-world and writing-tree schema invariants and indexes;
- account-deletion fences, cleanup, retry, and all three retained/deleted dispositions;
- non-canvas pagination, current writing selection, localization, and inclusion management;
- scene bootstrap, signed regional manifests, asset authorization, inspection, and API mapping;
- stale sessions, cross-owner absence, cache headers, bounded cursors, and privacy-safe failures;
- keyboard, touch, collision, focus, reduced motion, and ground presentation; and
- deterministic preview and pressure-fixture composition.

The guarded Mongo integration commands additionally exercise transactional creation, rollback,
concurrent idempotency, lifecycle transitions, durable queue recovery, convergence, account
deletion, semantic pagination, high-count spatial reads, and raster generation against
`daily-page-test`.

## Active Milestone 2 versions

| Boundary | Active version |
| --- | ---: |
| Owner-writing policy | 2 |
| Writing-lifecycle policy | 1 |
| Exact-owner Block adapter / cursor | 1 / 1 |
| Owner variant selection / group evidence | 1 / 1 |
| Owner world schema | 1 |
| Writing-tree schema / identity | 1 / 1 |
| Writing-tree creation / projection revision | 1 / 1 |
| Post-tree projection schema / mapping | 1 / 1 |
| Owner-grove placement / spatial index | 1 / 1 |
| Spatial index cell size | 720 world units |
| Owner environment policy / schema / world generation | 1 / 1 / 1 |
| Owner ground presentation | 2 |
| Tree asset schema / renderer | 3 / 4 |
| Exact-group reconciliation / queue / job schema | 1 / 1 / 1 |
| Owner convergence sweep | 1 |
| Scene bootstrap | 1 |
| Region manifest / cursor / asset delivery | 1 / 1 / 1 |
| Tree inspection / cursor | 1 / 1 |
| Non-canvas read / cursor | 2 / 3 |

Unsupported durable or payload versions fail closed rather than being silently reinterpreted.

## Completion-gate assessment

| Milestone 2 criterion | Judgment |
| --- | --- |
| Real eligible owner Blocks drive the ordinary route | Met |
| One stable tree represents one owner/group identity | Met |
| Locale and translation choice do not duplicate or replace trees | Met |
| Canvas and semantic paths recognize and open current writing | Met |
| Cross-owner private forest enumeration and retrieval fail closed | Met |
| Stale sessions and account deletion revoke access | Met |
| Retained deleted-author/anonymous writing never regains ownership | Met |
| Ordinary edits preserve accepted identity | Met |
| Deletion and restoration follow the durable lifecycle | Met |
| Empty and high-count histories remain bounded without silent omission | Met with development-shaped limits |
| Development diagnostics remain separate from production | Met |
| Production does not use development `localStorage` authority | Met |
| Account deletion cleans every Milestone 2 durable forest record | Met |
| Cache, payload, logs, and diagnostics avoid writing disclosure | Met |
| Tests and measurements support the technical claims | Met with stated environment limits |
| Human review finds that a real tree closes the writing-return loop | Met |

## Known deferrals and limitations

The following are explicit later work rather than incomplete Milestone 2 behavior:

- account-backed authored overlay objects, regional overlay revisions, and mutation APIs;
- durable discovery, gathered-material, and commitment ledgers;
- cross-device authored-state continuity, conflict resolution, migration, export, and recovery;
- gathering, inventory presentation, trails, signs, benches, lanterns, and construction;
- one later evidence-selected personal-geography improvement;
- public visiting, shared ownership, guest contribution, portals, and social authorization;
- totally private source writing before Daily Page has a supported owner-only writing state;
- creator-only legacy ownership repair and unsupported UUID-era group migration;
- general archive semantics not represented by the current Block lifecycle;
- final production capacity, production-network budgets, and broad physical-device profiling;
- richer biome topology, water, bridges, interactive rocks, weather, seasons, and movable 3D camera;
  and
- final forest-specific backup/export promises and cleanup-retention durations.

None of these deferrals weakens the completed promise that current eligible owner writing forms a
private, stable, inspectable, reversible, bounded grove.

## Milestone 3 handoff

Milestone 3 should begin by reconciling its original persistence assumptions with the durable
foundation already delivered here. Owner-world identity, writing-tree identity, lifecycle,
placement, environment, reconciliation, account-deletion fencing, and private regional delivery
must be extended rather than recreated.

The first accepted proof should be one bounded, material-free authored overlay object or equivalent
minimal mutation that:

1. is authorized from the session and stored separately from generated and writing-linked state;
2. uses stable opaque identity, unique constraints, region indexing, schema versions, and revision;
3. creates exactly once across retries and exposes explicit optimistic-concurrency conflicts;
4. loads through a bounded owner-only regional path without animation-frame database work;
5. survives reload, another session, and another device;
6. moves or edits without changing generated terrain or writing-tree identity;
7. removes idempotently and participates in complete account deletion;
8. fails visibly on unsupported versions or unsafe world reconciliation; and
9. has an explicit migration, reset, diagnostic, and recovery contract before being described as
   durable.

Inventory, gathering, material commitment, trails, and construction should depend on that accepted
mutation protocol rather than being the mechanism used to discover it.

## Governing contracts

- [`production-owner-writing-lifecycle-contract.md`](production-owner-writing-lifecycle-contract.md)
- [`writing-tree-creation-contract.md`](writing-tree-creation-contract.md)
- [`owner-group-reconciliation-contract.md`](owner-group-reconciliation-contract.md)
- [`owner-convergence-sweep-contract.md`](owner-convergence-sweep-contract.md)
- [`owner-non-canvas-read-contract.md`](owner-non-canvas-read-contract.md)
- [`owner-region-manifest-contract.md`](owner-region-manifest-contract.md)
- [`owner-region-asset-delivery-contract.md`](owner-region-asset-delivery-contract.md)
- [`owner-tree-inspection-contract.md`](owner-tree-inspection-contract.md)
- [`owner-tree-inclusion-contract.md`](owner-tree-inclusion-contract.md)
- [`owner-production-scene-contract.md`](owner-production-scene-contract.md)
- [`../account-deletion-lifecycle-contract.md`](../account-deletion-lifecycle-contract.md)

Milestone 3 must preserve these accepted boundaries unless a later explicit migration and product
decision supersedes them.
