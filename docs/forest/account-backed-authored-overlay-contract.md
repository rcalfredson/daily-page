# Account-backed authored-overlay and mutation contract

## Status and scope

This document records the accepted Roadmap Part III, Milestone 3 policy for the first durable
personal authored overlay. It is the Pass 2 contract that must govern schemas, indexes, services,
regional reads, private APIs, browser integration, migration, reset, diagnostics, and account
deletion.

The repository baseline audited for this contract was the clean
`personal-world-initial-rollout` branch at `1c1f8b6` on August 11, 2026. Milestone 2's closeout
commit `60b9392`, final implementation commit `9ba276b`, and 600-tree pressure fixture commit
`d407784` remain ancestors. No forest-path drift was found between `60b9392` and the audited
baseline.

This contract proves one account-backed authored spatial delta. It does not restore the whole
Forest Lab game, adopt browser-local authority, or authorize inventory, materials, trails,
construction, writing-tree relocation, public visiting, collaboration, or a generic persistence
framework.

No schema or production record was created during the audit and policy pass that produced this
document.

The governing prior contracts are:

- [`production-owner-writing-lifecycle-contract.md`](production-owner-writing-lifecycle-contract.md)
- [`owner-production-scene-contract.md`](owner-production-scene-contract.md)
- [`owner-tree-inclusion-contract.md`](owner-tree-inclusion-contract.md)
- [`owner-region-manifest-contract.md`](owner-region-manifest-contract.md)
- [`owner-placement-neighborhood-contract.md`](owner-placement-neighborhood-contract.md)
- [`../account-deletion-lifecycle-contract.md`](../account-deletion-lifecycle-contract.md)
- [`milestone-2-owner-writing-grove-evaluation.md`](milestone-2-owner-writing-grove-evaluation.md)

## Repository evidence and readiness

The Pass 1 audit found the following production seams ready to extend:

- `ForestOwnerWorld` is already the unique small primary-world root and carries active generated,
  placement, reconciliation, and deletion state.
- `ForestWritingTree` already owns writing-linked identity and signed 720-unit spatial placement,
  including hidden and inactive reservations that authored collision must respect.
- The tree-inclusion service supplies the closest mutation precedent: strict validation, MongoDB
  transaction, deletion fence, exact owner world, desired-state retry recovery, and per-record
  compare-and-set revision.
- The owner-region manifest supplies canonical signed-cell parsing, bounded pages, owner-derived
  authority, narrow projections, opaque region-bound continuation, and fail-closed validation.
- The account-deletion fixture and cleanup worker already prove bounded owner-keyed convergence,
  but their collection list and final absence check must be extended for every authored family.
- The 55- and 600-writing-tree fixtures provide independent writing pressure dimensions on which
  authored-overlay fixtures can later compose.

The development prototype provides reusable pure evidence for fixed marker presentation, culling,
depth order, preview, touch/keyboard intent, focus, and candidate-before-save behavior. Its
whole-overlay blob, unsigned finite world, 32-object maximum, client collision authority,
empty-on-invalid recovery, and `localStorage` adapter are explicitly rejected as production
authority.

Before their respective later passes can complete, the repository still needs authored migration
and pressure harnesses, reset and tombstone-purge workers, diagnostic reads, mutation-specific
same-origin/rate protection, and complete authored deletion convergence. These are implementation
requirements under this contract, not reasons to add a competing world root or generalized
persistence layer.

## Player promise

> I can place one quiet marker in my forest, leave, return from another session or device, and
> find exactly the marker I intended. A retry does not duplicate it, another tab cannot silently
> overwrite it, and a failed save does not pretend to have succeeded.

The first durable object is a protocol proof. It is deliberately smaller than the later
personalization and construction experience.

## Governing state boundary

The four accepted state layers remain independent:

1. **Generated base:** the existing owner world, private seed, active world and environment
   versions, generated ground, and immutable generated identity.
2. **Writing-linked state:** the existing durable owner/group writing trees, captured projections,
   lifecycle, placement, and inclusion preference.
3. **Personal authored overlay:** the new independently indexed marker records and the minimum
   revision/reset evidence needed to operate them safely.
4. **Transient presentation:** player and camera position, placement mode, preview, focus,
   animation, and save-status presentation.

Milestone 3 adds layer 3 alongside the implemented owner world and writing-tree ledgers. It must
not serialize the complete scene, append an object array to the owner-world root, attach markers to
writing-tree documents, or persist player position merely to validate reach.

Forest Lab's overlay, discovery, and inventory `localStorage` keys remain development-only. The
production forest neither reads nor uploads them and never treats them as consent or account
state.

## First authored object

### Product meaning

The only Milestone 3 object kind is `personal-marker`. It means only: **I marked this place.**

It is:

- material-free and unrelated to inventory, gathering, rewards, scarcity, or commitment ledgers;
- non-singleton, so the record model does not create an unsupported lifetime “home marker” rule;
- independent from writing trees, translations, rooms, posts, and semantic grouping;
- non-solid to the player and incapable of changing navigation topology;
- removable and movable under the mutation rules below; and
- private to the authenticated owner.

Milestone 3 needs to exercise one marker through the complete proof. Supporting a non-singleton
record kind does not require a bulk editor, catalog, or pressure-inducing placement interface.

### Appearance

The sole initial appearance is `quiet-waymarker` version 1. It is small, calm, deterministic,
code-owned, and visually subordinate to writing trees.

The durable record stores only the appearance id and version. Pixels, colors, dimensions,
collision radius, interaction radius, material description, and arbitrary styles are registry
policy rather than stored user content. Version 1 has no appearance picker and does not derive
rarity, color, or cosmetic traits from the object id.

A renderer-only improvement may preserve `quiet-waymarker` version 1 only when it preserves the
accepted semantic form, footprint, interaction meaning, and spatial validation. A change to any of
those properties requires an explicit appearance-version and compatibility decision.

## Stable identity and create idempotency

### Object identity

Before committing a placement, the browser generates a canonical opaque UUIDv4. That value is
both:

- the marker's stable `objectId`; and
- the bounded logical identity used to recover a retried create.

The object id is scoped by the session-derived owner and exact primary forest. It is a locator,
never a capability or authority token. Moving, removing, migrating, resetting, or reading a marker
does not replace its identity.

The eventual uniqueness authority is the exact owner/forest/object scope, backed by a database
unique constraint. No ever-growing mutation log is required.

### Creation fingerprint

The server computes an immutable version-1 creation fingerprint from a canonical encoding of:

```text
create protocol version
objectId
kind = personal-marker
originally requested signed worldX and worldY
appearance id = quiet-waymarker
appearance version = 1
```

The digest is fixed-length SHA-256 encoded as base64url. The client does not submit a trusted
fingerprint. Owner and forest ids are excluded from the digest because the lookup and unique index
already establish their scope. Generated-world validation versions are stored separately and do
not alter retry identity after a compatible deployment change.

The fingerprint version and digest survive moves, removal, reset, and migration. The original
creation coordinates need not be stored separately once the digest exists; the record retains its
current or final placement.

### Create outcomes

For one exact owner, forest, and object id:

| Current evidence | Create request result |
| --- | --- |
| No record and valid placement | Create one active marker at revision 1 |
| Active record and matching fingerprint | Return the current active record without writing |
| Removed tombstone and matching fingerprint | Return the removed record without restoring it |
| Existing record and different fingerprint | Idempotency conflict; do not mutate |
| Concurrent equal create | Unique constraint and transaction converge on one logical record |
| Concurrent different create under one id | One may commit; the other returns conflict |

A matching create retry after a later move or removal confirms that the original creation
committed. It never rolls the object back to its creation coordinate and never resurrects it.

## Lifecycle, revision, and conflict policy

### States and timestamps

The lifecycle is closed to `active` and `removed`. Creation records creation and change timestamps.
An accepted move advances the change timestamp. Removal records the final change time, removal
time, and tombstone purge-eligibility time.

The record starts at `recordRevision: 1`. Each accepted state-changing move or removal increments
the revision exactly once. Idempotent unchanged outcomes do not increment it.

### Desired-state compare-and-set

Move and removal supply a positive safe-integer `expectedRevision`.

- If an active marker already has the exact requested move position under compatible versions, the
  move returns `unchanged`, even when the supplied revision is older. This recovers a committed
  move whose response was lost without overwriting anything.
- If the desired position differs and the expected revision is stale, the move returns conflict.
- A successful move compare-and-sets the record revision and current state.
- A repeated removal against the tombstone returns `already-removed` and its final revision.
- A move against a tombstone fails as removed and cannot restore it.
- An older retry after a later edit returns conflict unless the current state already exactly
  matches its requested state, in which case it is a no-write success.

Conflict presentation may say that the forest changed elsewhere. It may return the current safe
marker presentation and revision needed to recover, but it never identifies another session,
request, device, owner, or nearby private object.

There is no last-write-wins behavior, generic merge, general mutation log, or separate move/remove
mutation receipt family.

### Removal and finite retry guarantee

Removal converts the active record into a compact tombstone rather than hard-deleting it. The
tombstone retains only the evidence needed for identity, retry, traceability, versions, final
placement, revision, and lifecycle timestamps.

The tombstone recovery window is 90 days from the accepted removal. During that window:

- repeated removal is unambiguous and idempotent;
- an older matching create retry returns the removed record and cannot resurrect it;
- moves fail as removed; and
- authenticated diagnostics may explain the final accepted state.

After 90 days, the tombstone becomes eligible for bounded physical purge. The finite window means
the server cannot distinguish an ancient create retry after purge from a genuinely new use of the
same UUID. Production clients therefore must not automatically replay pending mutations beyond
the recovery window. Creating a new marker uses a new UUID and fresh placement validation.

The window supports retry recovery and investigation, not a Milestone 3 restore or undo endpoint.
Restoration would require a separate collision, version, authorization, and conflict contract.
Account deletion ignores the window and removes tombstones as part of bounded cleanup.

## Position, reach, terrain, and collision authority

### Reach

The browser offers a provisional preview near the visible player as interaction design. Player
and camera position remain transient. The server neither trusts nor persists player position and
enforces no security-relevant reach rule for the first marker.

If a later feature needs authoritative reach, it must define the missing durable or server-observed
player contract rather than extending this request with a client-asserted coordinate.

### Coordinates and spatial index

Durable marker coordinates are signed integers from `-1,000,000,000` through `1,000,000,000`,
matching the current production owner-world coordinate boundary. Spatial index version 1 uses the
existing fixed 720-world-unit cell convention:

```text
cellX = floor(worldX / 720)
cellY = floor(worldY / 720)
```

The derived cell is replaceable indexing evidence. Moving across a cell boundary preserves object
identity and atomically changes the stored cell.

### Placement rules

The `quiet-waymarker` version-1 footprint has a code-owned radius of 9 world units and remains
non-solid to player movement.

The server validates placement inside the same transactional authority boundary as the write:

- exact active primary world and supported versions;
- coherent representability by the active owner environment grammar;
- signed coordinate bounds and derived spatial index;
- every reserved writing-tree placement in the collision neighborhood, including hidden and
  inactive trees;
- active authored markers in the collision neighborhood; and
- the provisional regional-density safety guard.

A marker must clear a writing tree by the tree's registered collision radius plus the marker radius
plus an 8-unit visual gap. Including hidden and inactive trees prevents later restoration from
creating an overlap.

Active marker centers must remain at least 26 units apart: two 9-unit marker footprints plus an
8-unit gap. Removed tombstones occupy no space.

The production owner environment is currently a signed, walkable ground grammar. Its writing-tree
density suitability must not be repurposed as marker-terrain policy. Forest Lab's finite world
edges, stream, bank, boulder, entrance, discovery, and material validations do not become
production authority.

Relevant writing-tree and marker neighborhoods are read through bounded indexed cell queries. The
owner ledger-fence write serializes competing owner mutation transactions; transaction retry must
reread collision evidence. Browser validation is immediate feedback only.

## Generated-version compatibility

Each marker records the exact validation evidence that can affect its spatial meaning:

- owner-world schema version;
- placement-policy version;
- environment-policy version;
- environment-schema version;
- world-generation version;
- spatial-index version; and
- marker appearance id and version.

The forest id already binds the marker to its exact owner world. Ground-presentation version is not
durable placement evidence because it controls compatible painting rather than generated spatial
meaning.

Exact supported versions load and mutate normally. A presentation-only ground change may render
the marker unchanged. An incompatible base, environment, placement, spatial-index, appearance, or
schema upgrade must not silently move, delete, reindex, reinterpret, or hide it.

If a requested authored-region page contains an active unsupported or incoherent record, the
entire authored response fails explicitly as unavailable or migration-required. It must not omit
the record and pretend the region is complete. Mutation remains unavailable until an accepted
migration succeeds or the compatible reader is restored.

Unknown future schema versions remain physically preserved and fail closed. There is no older
production authored-object shape before version 1, so Milestone 3 will not manufacture a
meaningless version-0 migration. The initial implementation must nevertheless include an exact
versioned reader and an idempotent migration harness before version 2 is introduced.

The [pre-version-2 harness](authored-migration-readiness-harness-contract.md) is internal, defaults
to dry-run, and accepts only an explicit injected source-to-target plan; Milestone 3 registers no
production transformation. It processes stable bounded batches, returns a
plan/version/mode-bound opaque caller-held checkpoint, advances that checkpoint only past verified
or already-current records, and stops at malformed, unsupported, conflicting, or unavailable
evidence. A real production migration must add its durable operation record and deployment-specific
integration before apply mode is enabled; the generic harness does not create speculative permanent
bookkeeping.

An accepted migration preserves object id, creation fingerprint, current/final coordinates,
user-facing record revision, lifecycle state, and original timestamps. Operational migration
metadata must not masquerade as a user edit or perform semantic reprojection.

## Regional revisions and bounded reads

### Per-cell revision records

One small authored-region revision record is created lazily for each touched authored 720-unit
cell. Its stable scope is:

```text
(ownerUserId, forestId, spatialIndexVersion, cellX, cellY)
```

It contains a monotonic positive safe-integer revision and timestamps, never an object membership
array. It is independently indexed and remains small.

The object mutation and all affected cell revisions change atomically:

- create increments the destination cell;
- a same-cell move increments that cell once;
- a cross-cell move increments both source and destination cells; and
- removal increments the marker's current cell.

Tombstone purge does not alter an active regional result and therefore does not advance the cell
revision. Empty touched-cell revision records remain durable for the active owner world so that an
old cursor cannot become valid again after a cell empties and is later reused. Account deletion
removes them.

### Authored regional read

The authored overlay loads independently from generated ground and writing-tree manifests. One
request accepts one through nine exact canonical signed cells. The default page size is 100 and the
maximum is 250. Rows are ordered by stable object id and queried with `limit + 1`.

Only active, supported, renderable marker presentation fields cross to the browser. Removed
tombstones are absent from the ordinary regional renderer. A separate authenticated diagnostic
read may include them.

For each page the service:

1. reads the exact revision vector for the requested cells;
2. reads a bounded active-object page;
3. rechecks the revision vector before returning;
4. binds continuation to the canonical cells and a compact fingerprint of that vector; and
5. rejects a later page as `REGION_CHANGED` if any requested revision differs.

The browser responds to `REGION_CHANGED` by discarding that authored-region page sequence and
performing a bounded restart. It never treats a changed sequence as complete. This prevents
insertion, movement, removal, or disappearance between pages from silently omitting accepted
active state.

The browser merges committed objects by `objectId` and keeps them separate from a transient
per-object prediction map. Pending create, move, and removal projections are reapplied after every
regional merge so an older regional response cannot visibly undo an in-flight player action.

## Accepted minimum production interaction

The production forest exposes one explicit **Mark this place** action inside the forest HUD rather
than in the page-level navigation. It enters a bounded placement mode whose preview remains 40
world units in the player's current facing direction, within the
existing 48-unit interaction neighborhood. Walking with keyboard, pointer drag, or touch joystick
moves that preview with the transient player. Enter or the visible save action submits it; Escape
or the visible cancel action abandons it without a write. A request freezes its submitted integer
coordinates and operation evidence while synchronization continues independently of movement and
unrelated marker actions.

The browser creates the UUIDv4 only when it first submits a create. Submission immediately projects
the intended marker state into the world, closes placement mode, and sends the frozen idempotent
request in the background. An ambiguous transport or generic unavailable response receives two
bounded automatic retries of that identical request. After those retries, the prediction remains
visibly unsynchronized with explicit Retry and Revert controls. Revert discards the local
prediction, restores the last confirmed snapshot, and requests current authoritative regional
state; it is not represented as a server-side undo. Reload does not replay pending work and the
production forest does not persist a mutation queue in `localStorage` or `sessionStorage`.

Immediate preview validation uses only the complete nearby authored region and visible writing
placements. Known bounds, visible-tree, visible-marker, and provisional-density failures disable
save and use both wording and a crossed visual treatment. An otherwise clear preview says that it
*looks* clear; only the server can account for hidden or inactive writing reservations and confirm
placement. A server collision or density rejection leaves placement mode available for choosing a
new position and rolls back its prediction without promoting it into confirmed state.

A committed nearby marker participates in the same proximity, keyboard, pointer, and touch focus
model as writing trees. Its marker-specific dialog offers move and removal. Move reuses placement
mode. Submitting move projects the marker at its intended position; confirming removal projects its
absence. The player can keep moving and can synchronize independent markers concurrently, while a
particular marker remains non-interactive until its pending operation resolves. A definitive first
rejection restores the last confirmed state and, when it will not displace another active dialog,
restores create or move placement for correction. Once any attempt has an ambiguous outcome, a
later response without canonical object evidence cannot cause a false rollback. Canonical evidence
always resolves uncertainty: matching state confirms the prediction and differing state replaces
it. A conflict says that the forest changed elsewhere without identifying a device or request.

The `quiet-waymarker` version-1 browser form is the fixed small signpost established by this
milestone: dark wooden post, muted ochre blank plaque, and no randomized or identity-derived
variation. Committed markers are opaque. A provisional marker uses reduced opacity and a dashed
ground ring; invalid state additionally uses a crossed ring, so color is not the only signal.
Focus uses the existing pale-gold ground highlight. A predicted marker otherwise uses its settled
opaque form with a small synchronization indicator; the indicator may pulse only when reduced
motion is not requested and changes to a distinct failure color after bounded retries.

Authored loading has a semantic status independent from grove loading. Marker actions are enabled
only after the player's current nine-cell authored neighborhood is complete. A changed paginated
region is discarded and restarted at most three times. A later failure retains previously complete
markers with an explicit potentially-stale warning and retry action; it never labels the layer
complete. Migration-required state disables marker actions until compatibility is restored.
Writing-tree movement, inspection, and semantic writing routes remain available throughout.

## Bounds and capacity

There is no lifetime marker maximum per forest.

The initial production bounds are:

- one object per create, move, or removal request;
- exact bodies and bounded canonical UUIDs;
- signed coordinates within the production ±1,000,000,000 boundary;
- one through nine cells per regional request;
- regional pages of 100 by default and 250 at most;
- bounded collision-neighborhood queries with `limit + 1` overflow detection; and
- owner/session mutation-rate protection as an operational safety boundary, not gameplay quota.

The initial active-marker safety ceiling is 128 markers per 720-unit cell. This is a provisional
implementation guard for payload, query, collision, and legibility protection, not an accepted
product capacity, account entitlement, paid limit, or lifetime allowance.

Reaching it returns an explicit density failure and never hides or deletes existing markers.
Existing cells above a later-lowered ceiling remain readable, movable out of the cell, and
removable; new placements into them are blocked. The ceiling is code/config policy, not stored in
the marker record. Per-cell revision records do not contain an authoritative membership count.

Pass 7 must measure empty, first-marker, sparse, dense-but-accepted, many-region, combined
writing-plus-marker, collision, pagination, cleanup, reset, and migration profiles before the
guard is described as evidence-based capacity.

## Exact mutation API

The authenticated private API contains three narrow operations.

### Create

```text
PUT /api/v1/forest/authored-objects/:objectId
```

The exact body contains only mutation-protocol version, `kind`, `worldX`, and `worldY`. Version 1
accepts only `personal-marker`. Owner, forest, appearance, fingerprint, revision, collision facts,
and version-validation claims are server authority and are not client inputs.

Expected outcomes are `created`, `existing-active`, and `existing-removed`, plus bounded invalid,
conflict, unavailable, collision, density, and migration-required failures.

### Move

```text
PATCH /api/v1/forest/authored-objects/:objectId/placement
```

The exact body contains only mutation-protocol version, `expectedRevision`, `worldX`, and `worldY`.
Expected success outcomes are `moved` and `unchanged`.

### Remove

```text
POST /api/v1/forest/authored-objects/:objectId/removal
```

The exact body contains only mutation-protocol version and `expectedRevision`. A dedicated action
avoids relying on inconsistent support for HTTP DELETE request bodies. Expected success outcomes
are `removed` and `already-removed`.

### Shared API boundary

Mutation protocol version 1 is explicit. Unknown fields and malformed ids fail before private
queries. Owner and forest come only from the authenticated session and exact active primary world.
Responses use `Cache-Control: private, no-store` and vary on session state. They contain only the
safe marker presentation, lifecycle, revision, and timestamps needed to explain the outcome.

There is no generic arbitrary object edit, upsert, batch mutation, client-selected appearance, or
client-supplied forest authority.

The `authored-objects` endpoint family may later support another closed standalone kind when that
kind explicitly adopts compatible identity, revision, spatial, lifecycle, migration, and deletion
semantics. Trails, writing-tree relocation, ledgers, reset, and generated-terrain changes must not
be forced through this record simply because the route name is extensible.

Before mutation routes are exposed, the API pass must select and test the repository-compatible
same-origin request defense and bounded owner/session rate-limit implementation. Exact rate
thresholds are operational rollout settings rather than durable marker schema. Existing cookie and
CORS behavior alone must not be cited as proof until the mutation-specific boundary is tested.

## Transactional mutation boundary

Every authored mutation performs strict public-shape validation before private work and then uses
one MongoDB transaction which:

1. acquires the owner's existing `User.forestLedgerFence`;
2. rejects processing or completed account deletion;
3. loads the exact primary owner world;
4. requires supported identity/version evidence, `status: active`, and idle reconciliation;
5. resolves the owner/forest/object state;
6. performs bounded authoritative environment, collision, and density reads where required;
7. compare-and-sets or inserts the object using unique constraints;
8. advances every affected authored-cell revision; and
9. returns one bounded machine-readable outcome.

Model writes and transaction orchestration remain outside Express handlers. Duplicate-key,
write-conflict, transaction-retry, and lost-response paths must be translated into the accepted
idempotent result or a bounded conflict. A request-valid coordinate never authorizes reading or
mutating another owner's state.

Ordinary failure logs contain only error class and bounded code. They do not contain owner, forest,
object, coordinate, creation-fingerprint, cursor, session, or nearby-record identity.

## Reset

“Clear authored geography” affects only authored markers. It does not alter source writing,
writing trees, tree inclusion, generated identity, or transient state.

The caller supplies a UUIDv4 `resetId`. One durable reset-operation record tracks the exact owner
and forest, operation version, processing/completed state, stable object-id cursor, affected count,
required policy versions, and timestamps. It contains no object or coordinate array. At most one
reset may be processing for an owner forest.

While reset is processing:

- create, move, and individual removal are temporarily unavailable;
- authored regional reads return an explicit `resetting` state instead of presenting a partially
  cleared overlay; and
- generated ground and semantic writing access remain available.

Each bounded stable-id batch converts active markers into ordinary 90-day tombstones and atomically
increments each affected cell revision by the number of active markers removed from that cell.
The operation advances its cursor only with the accepted batch. An interruption resumes after that
cursor. Reusing the same `resetId` returns the existing operation; another id reports that reset is
already in progress.

Completion requires a final owner/forest query proving that no active markers remain. A completed
retry returns the same aggregate result. Account deletion supersedes reset and removes its
operation evidence rather than finishing it first.

Milestone 3 keeps reset unexposed until confirmation wording and focus behavior are accepted. It
has no browser control or HTTP route. The internal service, bounded worker, fixture, support
semantics, and tests still exist and acquire the same owner ledger fence as individual mutations.
A later route requires its own destructive-action UX and security review. Tombstones provide
traceability but do not imply bulk undo.

Completed reset-operation evidence is retained for 90 days after `completedAt`, aligned with the
tombstone recovery window, and then becomes eligible for physical deletion. Completed-operation
cleanup and tombstone purging use separate stable oldest-first queries and batches of at most 250;
the default batch size is 100. Each deletion compares the exact supported version and lifecycle
evidence read by the worker. Unsupported, malformed, concurrently changed, or individually failed
records are counted as failures and retained rather than silently deleted. Processing reset
operations are never selected by retention cleanup.

Retention cleanup is an internal service with aggregate-only results. Milestone 3 adds no route,
browser control, or production scheduler for it. Tombstone purge does not increment authored region
revisions because removed records are already absent from rendered regional state. Account deletion
continues to ignore both retention windows and performs its own bounded cleanup.

## Diagnostic and export boundary

The authenticated diagnostic/export is read-only, generated on demand, private, and paginated. It
does not create a durable export snapshot record.

Milestone 3 exposes this boundary only as owner-authenticated JSON at
`GET /api/v1/forest/authored-diagnostics`; it has no browser UI or persisted download artifact.
Every request must include exactly one explicit `includeRemoved=true` or
`includeRemoved=false` query value. The choice is repeated and cursor-verified on continuation so
active-only and lifecycle inventories cannot change meaning through an implicit default. `limit`
defaults to 100 and is bounded at 250.

Its exact versioned envelope contains opaque forest identity but no raw owner id. Each row contains
only:

- object id;
- kind;
- active or removed state;
- current or final signed position;
- appearance and generated-version evidence;
- spatial-index identity;
- creation-fingerprint version and digest;
- record revision; and
- creation, change, removal, and purge-eligibility timestamps.

Rows are ordered by object id, with pages of at most 250. The cursor binds to the forest, export
schema, tombstone-inclusion choice, and export start time. Objects created after the export begins
are excluded using `createdAt <= exportStartedAt`.

The bounded reader validates every scanned record before applying the tombstone-inclusion choice.
An active-only page may therefore return fewer rows, including zero, with a continuation cursor
when its bounded scan contained valid tombstones. This prevents active-only diagnostics from
silently stepping over malformed lifecycle evidence.

This boundary is a diagnostic inventory, not an atomic historical snapshot or backup. A move,
removal, reset, tombstone purge, or account deletion during pagination may make a later row reflect
newer state or disappear. An exact recovery snapshot would require a separate frozen-revision or
operational-backup contract.

Unknown versions fail the page as migration-required, and malformed current-version records fail
the page as unavailable; neither is silently skipped or returned as a deceptively complete partial
inventory. No writing body, title, route, Block/group identity, session evidence, request history,
IP/device information, or nearby-object detail appears.

Ordinary aggregate diagnostics expose counts and bounded reasons only. Identifiers, coordinates,
fingerprints, and timestamps do not enter logs. Account deletion revokes diagnostic access
immediately. Milestone 3 avoids persisted transport artifacts; any later downloadable artifact
requires its own retention and cleanup integration.

## Migration and recovery

The initial reader accepts exact authored-object schema version 1, authored-cell revision schema
version 1, reset-operation schema version 1, and mutation protocol version 1. Unknown future
versions fail closed without mutation.

Malformed records remain available to privacy-safe operational diagnosis but are never serialized
as renderable empty state. A migration operates in bounded stable-order batches, records resumable
progress, writes or validates the target shape idempotently, and never destroys the last known-good
evidence before verification.

Rerunning an accepted migration does not change object identity, fingerprint, position, lifecycle,
record revision, or user timestamps again. Interrupted multi-record work resumes safely. Generated
incompatibility is an explicit migration/read-only state, never permission to relocate or delete
authored work.

Recovery in Milestone 3 means:

- exact create/move/remove lost-response recovery;
- stale conflict detection;
- 90-day removed-identity traceability;
- resumable reset and migration;
- privacy-safe diagnostic inventory; and
- operational database backup behavior under the broader account contract.

It does not mean a user-facing object restore, reset undo, frozen export snapshot, or claim that a
MongoDB record alone is a backup.

## Account deletion and retention

The existing `AccountDeletionRequest.forestCleanup` acknowledgement remains the single convergence
boundary for the complete private forest. No independent overlay status may declare success while
the existing forest cleanup disagrees.

The account-deletion transaction continues to mark the owner world `deleting`, clear its
reconciliation lease, revoke sessions, delete the User, and leave owner-keyed cleanup pending. The
ledger fence guarantees that an authored mutation either commits before deletion and is later
cleaned, or cannot commit after deletion wins the User write conflict.

The bounded forest-cleanup worker drains and verifies, in dependency-safe order:

1. active markers and marker tombstones;
2. authored-cell revision records;
3. reset-operation records;
4. writing trees;
5. owner/group reconciliation jobs; and
6. the small owner-world root.

Each growing collection is drained in owner-keyed stable-id batches. Cleanup ignores tombstone
recovery eligibility. Final convergence explicitly checks every new and existing forest collection
for remaining owner records before marking `forestCleanup` completed or allowing deletion evidence
to receive TTL expiry.

All three post dispositions remove authored state identically. Retained source writing and foreign
translations neither preserve nor inherit a deleted owner's markers. A processing reset is deleted,
not completed first.

Cleanup metrics contain bounded collection counts, attempt counts, status, and error class only.
They exclude owner, object, coordinate, fingerprint, and writing identity. Backup restoration must
replay authoritative deletion suppression evidence before accepting traffic, as required by the
existing account-deletion lifecycle contract.

## Browser integration

The ordinary production forest adds a deliberately bounded placement mode. The marker preview is
visually distinct and remains provisional until the server confirms commit.

The interface must expose saving, saved, conflict, unavailable, unsupported/migration-required,
resetting, collision/density rejection, and generic failure through visible and semantic status.
A failed or abandoned request cannot enter the committed scene as durable truth.

Committed regional markers merge by object id. Moves preserve identity across cells. Removal hides
the committed active object only after the accepted server response or subsequent authoritative
regional reconciliation.

Keyboard, pointer, touch, reduced motion, focus restoration, and narrow layout remain supported.
The semantic writing route remains complete if authored mutation or regional overlay loading is
unavailable. Production code does not read or upload Forest Lab `localStorage`.

## Failure mapping

The services and private routes must distinguish internally while exposing only bounded,
non-enumerating outcomes:

| Condition | Required behavior |
| --- | --- |
| Missing, stale, or revoked session | Authentication required; no private read |
| Malformed id/body/version | Invalid request before private queries |
| Foreign, absent, or removed object where active is required | Generic unavailable/not found without enumeration |
| Matching create retry | Return current active or removed logical object |
| Fingerprint mismatch | Idempotency conflict |
| Stale differing move/remove | Revision conflict; no write |
| Already achieved move/remove | Bounded unchanged/already-removed success |
| Deleting owner or missing fence target | Unavailable; no write |
| Reconciling, deleting, unsupported, or incoherent world | Explicit unavailable/migration state |
| Unsupported object/base/environment/placement/index/appearance | Fail closed; preserve record |
| Writing-tree or marker collision | Explicit placement rejection without nearby details |
| Provisional density guard reached | Explicit density rejection; existing state remains readable |
| Regional revision changed | Reject continuation and require bounded restart |
| Reset processing | Mutation unavailable and regional `resetting` state |
| Transaction abort or infrastructure failure | No false confirmation; retry remains safe |

No failure may duplicate, resurrect, silently move, silently omit, expose, or falsely confirm a
marker.

## Pre-schema verification matrix

Passes 3 through 7 must establish at least the following evidence.

### Schema and index proof

- exact current object, cell-revision, and reset-operation shapes validate;
- unknown fields and unsupported versions fail closed;
- signed coordinate and safe-integer revision boundaries are exact;
- owner/forest/object and owner/forest/cell uniqueness are enforced;
- active regional, collision-neighborhood, tombstone-purge, reset, diagnostic, and deletion query
  shapes are supported by named indexes;
- no owner-root object array or unbounded mutation history exists; and
- index creation and duplicate-key behavior are exercised against real MongoDB.

### Mutation proof

- create, matching retry, lost create response, and concurrent equal create produce one identity;
- same id with different creation input conflicts;
- move preserves identity and advances revision once;
- matching move retry after a lost response returns unchanged;
- stale differing moves conflict;
- removal creates one tombstone and advances revision once;
- removal retry returns the tombstone;
- older create and move retries cannot resurrect or roll back removed/newer state;
- same-cell and cross-cell revision increments are atomic;
- concurrent collision-neighborhood placements cannot both commit;
- negative, maximum-magnitude, and cell-boundary coordinates derive correctly;
- hidden and inactive writing-tree reservations still block overlap;
- deletion fence, reconciliation, reset, version, collision, density, and transaction-abort paths
  leave no partial state.

### Regional and authorization proof

- one through nine signed cells paginate without silent truncation;
- cursors are bound to exact canonical cells and their revision vector;
- insertion, move, removal, reset, and disappearance between pages force bounded restart;
- removed records are absent from render payloads but available to authorized diagnostics;
- unsupported/malformed active records fail the region instead of disappearing;
- absent, stale, revoked, and cross-owner sessions do not enumerate private objects;
- forged owner/forest/object/version/cursor fields fail safely;
- private no-store and session-varying responses are preserved; and
- ordinary failure logs contain no private identifiers or coordinates.

### Reset, migration, retention, and deletion proof

- reset batches tombstone all active markers, resumes after interruption, and completes only after
  an absence check;
- reset retry by the same id is idempotent and competing reset ids do not overlap;
- mutation and authored regional completeness remain unavailable while reset is processing;
- exact version 1 reads, unknown future versions fail closed, and the pre-version-2 migration
  harness is idempotent;
- tombstone purge is bounded and does not change active regional revisions;
- account deletion blocks mutation, drains every authored record family, verifies absence, and
  completes independently of post disposition;
- cleanup retry and expiry-scheduling failure remain observable and recoverable; and
- reset never edits source writing, writing trees, inclusion, or generated identity.

The guarded real-Mongo lifecycle fixture for reset, diagnostics, retention, and disposable
migration recovery is documented in
[`forest-authored-lifecycle-integration-fixture.md`](../testing/forest-authored-lifecycle-integration-fixture.md).

### Browser and continuity proof

- preview remains provisional through delay and failure;
- saving, saved, conflict, unavailable, unsupported, and density/collision states are visible and
  announced;
- refresh and a separate authenticated session/browser obtain the same committed identity and
  position through regional reads;
- movement preserves identity across cells and removal disappears only after authority confirms;
- keyboard, pointer, touch, reduced-motion, focus, and narrow layouts remain functional; and
- semantic writing access remains usable with authored mutation disabled.

### Pressure proof

- empty overlay and first marker;
- representative sparse regions;
- one dense but accepted cell and explicit 129th-marker rejection;
- many sparse cells;
- combined writing-tree and marker regional composition;
- collision-neighborhood query count and timing;
- create, retry, conflict, move, remove, reset, purge, migration, and cleanup batches;
- regional page count, continuation restarts, payload bytes, browser preparation, and ordinary
  frame work; and
- privacy-safe aggregates only.

Synthetic development results remain diagnostic evidence rather than a production service level,
final capacity, or monetization rule.

## Proposed active Milestone 3 versions

These identifiers are accepted contract targets; Pass 3 should name the runtime constants without
changing their meanings silently.

| Boundary | Initial version |
| --- | ---: |
| Authored-object schema | 1 |
| Authored-object identity | 1 |
| Authored mutation protocol | 1 |
| Creation fingerprint | 1 |
| Marker appearance (`quiet-waymarker`) | 1 |
| Authored spatial index | 1, reusing 720-unit cells |
| Authored-region revision schema | 1 |
| Authored-region manifest | 1 |
| Authored-region cursor | 1 |
| Authored reset operation | 1 |
| Authored diagnostic/export | 1 |
| Tombstone retention policy | 1 (90 days) |

These remain independent from owner-world schema 1, writing-tree schema/identity 1, owner-grove
placement 1, owner environment policy/schema/world generation 1, and writing-tree regional
manifest/cursor 1.

## Explicit deferrals

- Inventory, discovery persistence, materials, costs, commitments, refunds, and gathering.
- Trails, path topology, signs, benches, lanterns, buildings, and a construction catalog.
- Free-form marker text, uploaded media, appearance selection, and moderation surfaces.
- Writing-tree relocation, attachment, grouping, or semantic relationships.
- Authoritative persisted player/camera position or reach.
- User-facing marker restore, reset undo, offline mutation replay, and real-time collaboration.
- Public visiting, guest access, shared ownership, and collaborative mutation.
- General event sourcing, arbitrary object payloads, and a universal persistence abstraction.
- A frozen export snapshot, new backup promise, final retention policy for infrastructure backups,
  or production service-level guarantee.
- A final density/capacity or mutation-rate product limit.
- Import or migration of Forest Lab `localStorage` data.

## Pass 3 authorization gate

Schemas, models, and indexes may begin only after review confirms that this document accurately
records the accepted policy. Pass 3 must add only the authored object, per-cell revision, and reset
operation record families needed here, together with complete account-deletion cleanup
integration. It must not expose mutation routes or browser UI before their later passes.
