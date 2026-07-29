# Activity Forest production owner and writing lifecycle contract

## Status

This document is the durable Milestone 1 contract for Activity Forest Roadmap Part III. It records
the repository evidence, product decisions, policy proof, authorization boundaries, lifecycle
rules, scalable record shapes, and remaining gates agreed through Passes 1–5.

Milestone 1 is a contract and pure-policy milestone. It does **not** authorize a production forest
route, database schemas, account-backed persistence, a background job system, public visiting, or
upload of development `localStorage` state.

The repository baseline inspected for this contract was `master` at `fb68322`. The production-data
audit was explicitly authorized, aggregate-only, and read-only. The bounded policy code introduced
by this milestone is:

- `server/services/forestOwnerWritingPolicy.js`
- `server/services/forestWritingLifecyclePolicy.js`

The focused synthetic evidence is:

- `spec/forestOwnerWritingPolicySpec.js`
- `spec/forestWritingLifecyclePolicySpec.js`

The governing roadmap remains
[`tmp/activity-forest-roadmap-part-iii.txt`](../../tmp/activity-forest-roadmap-part-iii.txt). This
contract narrows Milestone 1 decisions without replacing the longer-term product vision.

## Player promise

> The forest represents writing the signed-in owner is authorized to see and choices the owner is
> authorized to make. Ordinary writing and account changes never produce surprising exposure,
> duplication, loss, or identity replacement.

The first production forest is private to its authenticated owner. Public or guest access is
deliberately deferred.

## Terminology

`Block` is the internal model, schema, service, and API name for the modern writing entity selected
by this contract. The product and user interface conventionally call that same entity a **post**.
Accordingly:

- code, queries, migrations, and ownership rules should use `Block` when precision about the
  persisted entity matters;
- player-facing copy and product discussion may use **post**; and
- legacy `Page` is a different data model, not another synonym for a Block/post.

References in forest documents to a “post tree,” “post identity,” or “post-to-tree” projection
therefore mean a tree associated with the supported modern Block/post unless a document explicitly
labels the data as a development fixture or a different future source.

## Evidence and limitations

### Repository evidence

- Authentication exposes the stable User `_id` as the authenticated user's `id`.
- `Block` is the supported modern writing record. The legacy `Page` shape lacks equivalent stable
  ownership and lifecycle evidence.
- Blocks may contain stable `userId`, mutable legacy `creator` text, collaborator usernames,
  `live`, `deleted-author`, or `anonymous` authorship state, `public` or `unlisted` visibility,
  `in-progress` or `locked` status, translation `groupId`, language, and translation ancestry.
- Public site discovery already treats a Block as publicly visible when it is `public`, or when it
  is both `unlisted` and `locked`.
- Direct writing routes and translation resolution remain ordinary writing-system concerns; the
  forest must recheck their authorization rather than treating a loaded scene as authority.
- Account deletion is implemented through an owner-keyed `AccountDeletionRequest`, immediate
  session revocation and User deletion, three post dispositions, username quarantine, database
  cascade, and retryable profile-media cleanup. Retained posts explicitly lose `userId` and edit
  authority and become `deleted-author` or `anonymous`.
- `AccountDeletionRequest` is the downstream forest-cleanup seam. Future durable forest state must
  converge idempotently by `ownerUserId` without enlarging account deletion into one unbounded
  forest transaction.
- The present forest is development-only and fixture-backed. Its overlay and discovery persistence
  use separate base-specific `localStorage` keys.
- Generated scenes already use deterministic 480-world-unit regional cells, bounded regional
  requests, viewport culling, and separately cached runtime assets.

### Aggregate production audit

The authorized production audit observed:

- 153 User records and 185 Block records;
- 25 Blocks with an exact stable `userId`;
- 96 legacy creator-only Blocks;
- 64 Blocks without stable ownership evidence;
- 24 of the 25 exact-owner records in the largest reportable public/locked bucket, with one
  additional bucket suppressed to avoid identifying a person;
- 8 of the 25 exact-owner records containing collaborators;
- all observed Blocks locked at the time of the audit;
- complete `groupId`, language, creation-time, room, and reconstructable-route coverage;
- 162 translation groups, including 15 multi-Block groups;
- no observed multi-owner translation group among records with populated stable owner ids; and
- 20 `originalAuthor` values that were not ObjectId-shaped.

Tiny owner distributions were suppressed. No titles, bodies, excerpts, usernames, email addresses,
raw ids, route values, or credentials were emitted. The audit describes one point in time; it does
not establish eternal capacity, prove unobserved states safe, or convert malformed legacy evidence
into ownership.

### Evidence conclusions

- Stable `userId` is authoritative when it exactly matches the authenticated owner.
- Creator username cannot safely substitute for stable ownership.
- Collaborator membership does not make the collaborator an owner.
- Translation ancestry fields are not reliable enough to establish ownership.
- Production data is currently small, but record and API design must support histories and worlds
  substantially larger than the observed maximum.

## Canonical source, owner, forest, and tree identity

### Canonical writing source

The first production source is the modern post, whose internal entity name is `Block`. `Page`,
arbitrary content federation, creator-only legacy records, and records with unsupported lifecycle
values are excluded or explicitly unresolved.

This is a bounded first source, not a claim that no other Daily Page content can ever enter a
forest.

### Owner identity

The immutable User `_id` owns the forest. Username, creator text, profile route, room, language,
collaboration, and display name never establish forest ownership.

The authenticated owner id is derived from the server-side session. A client-supplied owner,
forest, tree, Block, group, region, or object id is only a locator and never authorization.

### Forest identity

An account has exactly one current **primary owner-world role**. The forest record has an opaque,
stable `forestId` and an owner key. Uniqueness is scoped as `(ownerUserId, worldRole)`, where the
initial role is `primary`; it must not be expressed as a schema assumption that an account can
never have another future world role.

The primary world is one stable owner root. Future public and private views may expose
access-scoped regions or projections of that root rather than forcing the owner to maintain two
unrelated forests. That access model remains deferred, and a public response must never receive
private region or writing metadata.

### Logical writing-tree identity

One logical tree represents one owner-scoped translation group:

```text
(ownerUserId, translationGroupId)
```

The production record receives its own opaque stable `writingTreeId`. The owner/group tuple has a
unique constraint. Different owners can therefore have distinct trees for writing in the same
translation group, while several translations authored by one owner resolve to one tree.

The first eligible owner-authored Block creates the group tree and captures the founding projection
evidence. Adding a later owner-authored translation does not create another tree or reproject the
existing tree. Adding another person's translation never creates, owns, preserves, or reactivates
the owner's tree.

Mutable title, body, counts, room, route text, visibility, status, collaborators, and current
preferred language are not tree identity.

The tree retains the minimum private source references required for lifecycle reconciliation.
Runtime visual assets and shared cache keys contain only derived visual identity, never raw owner,
Block, group, title, language, or route values.

## Eligibility and owner control

### Owner-tree eligibility

A writing record is eligible when all of the following are true:

- it is a supported `Block`;
- its authorship state is `live` (or is absent on a compatible pre-field record);
- its stable `userId` is present, valid, and exactly equals the authenticated owner id;
- its Block and translation-group identities are valid;
- its language is bounded and valid;
- its status is `in-progress` or `locked`; and
- its visibility is `public` or `unlisted`.

Both current statuses and both current visibility values therefore qualify in the private owner
forest. When the writing schema later supports totally private Blocks, owner-authored private
Blocks should be added to the private owner forest through an explicit policy and authorization
version; private data must not be inferred from the current two-value schema.

Creator-only legacy records remain `unresolved` and fail closed. They require an explicit ownership
repair or migration outside this policy. Collaborators are allowed on an eligible owner-authored
Block but do not gain tree ownership or mutation authority. A `deleted-author` or `anonymous`
retained post can never create, preserve, restore, or transfer an owner tree, even if malformed
historical data still carries an owner id.

### Automatic entry and hiding

Eligible writing enters automatically. This is a product guarantee, not a requirement that tree
work occur synchronously inside the writing transaction.

- A successful writing creation is never rolled back because forest reconciliation failed.
- Idempotent asynchronous work and periodic reconciliation make the tree appear without owner
  effort.
- Historical enrollment is cursor-based and batched.
- The owner can reversibly choose **Hide from my forest** without altering source writing.
- Hide applies to the entire owner/group tree, not one language variant.
- Hide preserves the tree's identity, projection, personal curation, and placement reservation.
- Unhide restores that same tree rather than creating a replacement.

### Translation discovery

Translation availability is dynamic inspection data and remains separate from eligibility:

| Translation | Forest inspection result |
| --- | --- |
| Owner-authored, public or unlisted, in-progress or locked | Available to the owner |
| Foreign-authored and public, in-progress or locked | Discoverable |
| Foreign-authored, unlisted, and locked | Discoverable |
| Foreign-authored, unlisted, and in-progress | Hidden |
| Deletion-retained `deleted-author` or `anonymous`, public | Discoverable without ownership |
| Deletion-retained `deleted-author` or `anonymous`, unlisted and locked | Discoverable without ownership |
| Deletion-retained `deleted-author` or `anonymous`, unlisted and in-progress | Hidden; this state is deleted by the account lifecycle |
| Legacy, malformed, deleted, or unsupported | Hidden or explicitly unresolved; never disclosed |

This follows the site's ordinary discovery rule that locked unlisted writing is visible through
public discovery surfaces. A status or visibility change updates the next inspection response
without changing the tree.

The tree record does not embed an ever-growing translation list. Inspection performs an authorized,
indexed, paginated group query, prioritizes the visitor's preferred language when available, and
uses a defined fallback. A foreign variant contributes no ownership, placement, projection, or
tombstone authority.

## Stable projection and spatial meaning

The writing projection is captured historical evidence, not a live activity dashboard.

- Ordinary writing reads and edits do not reproject a tree.
- Mutable counts never control size, rarity, brightness, complexity, power, or status.
- Correcting `createdAt` can affect permanent creation-season evidence only through an explicit,
  auditable reprojection or repair.
- The captured habitat is chosen from the generated position when the tree is first projected.
- Personal relocation preserves the stable tree, captured habitat, specimen seed, phenotype,
  permanent traits, mapping evidence, source association, and asset identity.
- Ecological reprojection is a separate explicit operation and may create a versioned replacement
  semantic projection.
- Renderer and phenotype upgrades may replace pixels without owner opt-in only when they preserve
  the captured semantic specimen and are operator-managed, versioned, auditable, and continuity
  reviewed.
- If a new renderer, generator, or world cannot safely represent established state, the old
  supported revision remains active or the forest becomes explicitly read-only. It is never
  silently reset.

## Scalable world and capacity contract

### World growth

The generated base is not fixed to one permanent rectangle. It consists of a stable owner-world
root and appendable, versioned regions.

- Existing region seeds, coordinates, writing-tree placements, authored objects, and identities
  remain stable when the world expands.
- Expansion adds deterministic regions rather than regenerating the complete old world.
- A versioned expansion policy may use usable area, biome-specific natural tree density, existing
  placement pressure, and reserved-space requirements.
- Exact expansion thresholds and biome-density coefficients require production-shaped
  measurements in later milestones.
- Region manifests, tree queries, assets, overlays, migrations, and exports are loaded or processed
  in bounded pages or batches.

The older long-term-vision proposal of roughly 300 spatially active post trees is a historical
product hypothesis, not this production contract. Eligible writing is not silently omitted at an
arbitrary tree count, and world expansion is not reserved as a paid remedy for having written too
much.

### Authored-object capacity

There is no independent lifetime maximum such as 32 objects per forest. Authored capacity is a
versioned spatial-density policy:

```text
aggregate authored capacity =
  sum of usable local capacities across active generated regions
```

- The density grid is anchored in stable world space, never the camera or viewport.
- The density cell size is independently versioned from the loading-cell size, even if both
  initially use the current 480-world-unit cell.
- The exact local limit, such as an initial hypothesis of 32, must be measured.
- Collision, object footprint, protected terrain, and a rolling neighboring-area check prevent
  boundary packing and excessive local concentration.
- Expansion adds usable density cells and therefore adds capacity.
- Per-request, mutation, sign-length, and response limits remain appropriate operational bounds.

Current development limits such as one 12-stone trail, nine clearing objects, and three objects per
type must not become whole-forest production ceilings. A bounded trail segment or edit may retain a
small stone limit, while multiple spatially indexed segments remain possible subject to local
density. Type-specific limits may express local composition rules, not lifetime account scarcity.
A single home marker may remain a semantic singleton if the product intentionally defines it that
way.

Object identity is independent of spatial membership. Moving an object across region or density
boundaries preserves its id and atomically changes its spatial index membership.

### Bounded work rather than bounded ownership

Production APIs use bounded pages, opaque cursors, request limits, and continuation. They never
silently truncate a forest or translation group. Spatial inspection uses an index; for example, a
bench may return three nearby writings without scanning every tree in the world.

## State ownership

### 1. Generated base

Account-backed identity needed to reproduce:

- opaque forest and owner-world identity;
- world seed;
- base, region, environment, terrain, crossing, and placement versions;
- active region revision pointers;
- deterministic writing-placement reservations; and
- explicit expansion history.

Generated terrain and discovery candidates remain reconstructable only under their exact recorded
versions.

### 2. Writing-linked state

Account-backed historical evidence:

- owner/group writing-tree identity;
- founding and current authorized source references;
- captured habitat and permanent writing evidence;
- projection, mapping, phenotype, renderer, and asset versions;
- stable specimen and visual identity;
- active, inactive, or tombstoned lifecycle state; and
- explicit reprojection history.

It does not contain full writing bodies or an unbounded metadata snapshot.

### 3. Personal authored overlay and durable ledgers

Account-backed owner state:

- tree hide decisions and other curation deltas;
- personal tree relocations;
- markers;
- bounded trail segments;
- signs, benches, lanterns, and later accepted authored objects;
- stable object identities and captured historical material costs;
- spatial shard and object revisions;
- total gathered material counters;
- aggregate material commitments;
- discovery offering cycle and collected identities for the active offering; and
- migration and recovery evidence.

Material prices are captured when an object is created. A later price change does not alter that
object's commitment while it remains in the world. Moves and text edits do not charge or refund.
Removal releases the captured commitment exactly once.

Available material is derived from verified gathered totals and transactional aggregate
commitments. Production mutations must not rescan the complete overlay. Numeric safety bounds are
input and storage protections, not intentionally frustrating gameplay maxima.

Generated discovery positions and types are reconstructed by versioned region/offering identity.
The active offering's collected-id list remains bounded. A discovery offering is a calm interaction
unit and does not have to grow merely because the map grows.

### 4. Transient presentation and life

Never persisted merely for convenience:

- player and camera position;
- focus, menus, previews, and editor modes;
- animation phases, wind, water, gait, and glow;
- ordinary bird state;
- Tansy's physical position and route state; and
- partially traversed dialog state.

If Tansy remains a product feature, a later bounded encounter record may persist encounter identity,
conversation version, and completion timestamps. It must be stored as independently indexed or
retained records rather than an ever-growing array on the owner root.

Development `localStorage` is not production authority and will not be uploaded, merged, or used to
override account state.

## Conceptual production records

These are conceptual boundaries, not authorization to create database schemas.

| Record | Stable identity and owner | Mutable/versioned state | Scale and retention |
| --- | --- | --- | --- |
| Owner world | Opaque `forestId`; owner id; `primary` role | Active base revision, checkpoint, status | One small root; retained for active account |
| Generated base revision | Forest plus opaque revision | Seed, generator versions, active region index | Append regions; never serialize rendered scene |
| Generated region | Forest, base revision, stable region id | Region generator/version evidence and bounds | Indexed spatially; paginated; reproducible where exact reader exists |
| Writing tree | Opaque tree id; unique owner/group tuple | Active state, founding source, captured projection pointer | One record per owner/group; no translation array |
| Writing projection revision | Tree plus projection revision | Captured semantic decisions and explicit replacement reason | Append/audit on explicit reprojection; private metadata minimized |
| Tree curation delta | Tree and owner | Hide, personal relocation, curation revision | Separate from projection; reversible |
| Authored object | Opaque object id, owner, forest | Type, bounded fields, coordinates, captured cost, object revision | Individually indexed by region/density cell |
| Overlay spatial shard | Forest, region/cell, shard revision | Membership/checkpoint data | Prevents one growing blob and forest-wide edit contention |
| Material ledger | Forest/owner and material id | Gathered total, committed aggregate, revision | Transactional aggregates plus auditable object commitments |
| Discovery state | Forest/owner and offering identity | Cycle, bounded collected ids, revision | Candidate manifest generated, not stored whole |
| Migration operation | Owner/forest, operation id, target version | Cursor, completed batches, status, error code | Resumable and idempotent; bounded retention |
| Tombstone | Owner/group tree identity | Minimal deletion/restoration evidence | Individually indexed; retained only as lifecycle promise requires |
| Recovery revision | Owner/forest and revision id | Prior heads, integrity evidence, scope | Bounded disclosed retention; never contains unnecessary writing |
| Future Tansy encounter | Owner and encounter/version id | Completion timestamps and bounded outcome | Deferred; paginated and retained by explicit policy |

Every durable record carries its own schema version, ownership key, timestamps, and appropriate
uniqueness/index evidence. Unknown fields or versions fail closed. Writers emit the current
supported schema; readers support only explicitly enumerated historical versions.

An overlay object, tree, tombstone, translation, migration, or encounter is never stored as an
unbounded array inside the owner-world root.

## Lifecycle matrix

| Transition | Tree and projection | Placement and overlay | Recovery, authorization, and support |
| --- | --- | --- | --- |
| First eligible owner Block | Create one owner/group tree; capture founding projection | Deterministically reserve initial placement | Exact owner recheck; idempotent automatic reconciliation; supported |
| Repeated/retried creation | Return existing logical tree | Preserve reservation | Owner/group uniqueness and idempotency key prevent duplicates; supported |
| Title/body edit | Preserve tree, specimen, and projection | Preserve placement and overlay | Inspection reads current authorized display data; supported |
| Mutable counts | Preserve all semantic and spatial identity | No overlay effect | Counts never become rewards or power; supported |
| Ordinary metadata correction | Preserve unless an explicitly projection-relevant field is repaired | Preserve | Audit explicit repair separately; supported |
| `createdAt` correction | No silent tint or projection change | Preserve | Explicit auditable reprojection required to adopt correction; supported |
| Room change | Preserve | Preserve | Room never owns or places the tree; supported |
| Owner translation added | Join existing tree | Preserve | Refresh dynamic variants; supported |
| Foreign translation added/changed | Never creates or preserves tree | Preserve | Refresh authorized inspection availability only; supported |
| Language correction | Preserve owner/group identity | Preserve | Refresh current inspection and fallback; supported |
| `groupId` ordinary mutation | Reject as identity mutation | No change | Requires explicit repair/migration contract; prohibited |
| Collaborator change | Preserve | Preserve | No ownership consequence; supported |
| Visibility change | Preserve in private owner forest | Preserve | Dynamic foreign discovery may change; supported |
| In-progress/locked change | Preserve in private owner forest | Preserve | Locked unlisted foreign variant becomes discoverable; supported |
| Unsupported archive/removal state | Fail closed; retain last known-good record | Preserve | No current Block archive contract; deliberately deferred |
| Hide | Preserve active logical tree and projection | Preserve reservation and authored state; omit from owner view | Whole owner/group tree; reversible; supported |
| Unhide | Restore same logical tree | Restore reserved/personal placement | No new projection; supported |
| Delete one owner variant | Preserve if another eligible owner variant remains | Preserve | Refresh inspection; supported |
| Delete last owner variant | Deactivate tree; keep minimal tombstone | Preserve reservation and recoverable authored relationship | Inspection exposes no stale writing; supported |
| Restore same logical identity | Reactivate captured tree | Restore reservation/personal placement | Tombstone proves identity; supported |
| Recreate under a new logical identity | Create a new tree | New deterministic reservation | Old tombstone remains separate; supported |
| Owner account deletion | Revoke owner access and deactivate every owner tree; retained posts cannot preserve ownership | Delete owner-private forest state regardless of source-post disposition | Consume `AccountDeletionRequest` by `ownerUserId`; cleanup is idempotent downstream convergence |
| Personal relocation | Preserve tree, source, projection, habitat, specimen, and asset | Replace only personal location delta | Server validates density/collision/revision; supported contract |
| Explicit ecological reprojection | Same logical tree with auditable projection replacement | Placement requires explicit migration decision | Never implied by relocation or edit; supported contract |
| Meaning-mapping upgrade | Preserve historical projection by default | Preserve | Explicit replacement only; supported contract |
| Phenotype/renderer/asset upgrade | Preserve semantic specimen when compatible; pixels may change | Preserve | Versioned, operator-managed, auditable; incompatible old revision remains active |
| Generated-world upgrade/expansion | Preserve tree semantic identity | Preserve old coordinates; append regions | No silent move/delete; regional migration; supported contract |
| Overlay schema upgrade | Preserve objects and commitments | Copy, validate, then cut over shard revisions | Resumable; unsupported version read-only; supported contract |
| Partial durable failure | Last known-good revision remains authoritative | No partial live mutation | Retry by idempotency key or resume cursor; supported contract |

Account deletion is implemented and documented in
[`docs/account-deletion-lifecycle-contract.md`](../account-deletion-lifecycle-contract.md). Its
`delete`, `deleted-author`, and `anonymous` choices govern source posts only. They never retain or
transfer the deleted account's private forest.

The database deletion transaction writes an owner-keyed request, removes the User, revokes sessions,
and applies the selected post disposition. Durable forest cleanup must use that request as an
idempotent downstream boundary. It must revoke access immediately through the missing User/session,
clean every forest root, tree, overlay shard, ledger, export, cache, and recovery record by
`ownerUserId`, and record or otherwise guarantee convergence before deletion evidence can expire.
It must not pull an arbitrarily large future forest into the existing all-or-nothing transaction.

Posts retained as `deleted-author` or `anonymous` have no `userId` or edit authority and cannot
create or preserve an owner tree. They may remain dynamically discoverable as translations in
another active owner's forest when they satisfy the ordinary public visibility rule.

## Authorization and privacy boundaries

| Boundary | Required behavior |
| --- | --- |
| Owner forest query | Derive owner from session and query by owner; never trust a supplied owner id |
| Writing selection | Require exact stable Block `userId`; creator and collaborator evidence are insufficient |
| Projection creation/read | Owner-constrain the tree and source query; enforce owner/group uniqueness |
| Scene delivery | Deliver only authorized bounded regions; private response caching |
| Regional asset delivery | Validate requested regions and allowed asset keys against the authorized forest |
| Writing inspection | Recheck current source and translation authorization on every request |
| Overlay/ledger mutation | Owner-constrain every lookup and validate schema, revision, terrain, density, collision, and commitments server-side |
| Export/reset/recovery/deletion | Authenticated ownership, CSRF protection, explicit scope, idempotency, and private delivery |
| Diagnostics/support | Bounded codes and aggregates by default; elevated access explicit and audited |

Unknown and foreign-owned resources use the application's ordinary non-enumerating not-found
behavior. An object id, forest id, tree id, group id, asset key, or idempotency key is never a
capability token.

Initial owner scenes, regional manifests, writing inspection, exports, and diagnostics use
authenticated private caching, normally `Cache-Control: private, no-store`. Shared immutable visual
assets may be introduced only after proving that their keys, pixels, metadata, error behavior, and
access path reveal no owner or source-writing identity.

The server does not accept client-authored material costs, balances, projection evidence,
authorization results, collision results, or density results.

### Mutation protocol

Every durable mutation supplies:

- an owner-scoped idempotency key;
- a bounded operation and payload;
- an expected object or spatial-shard revision; and
- locator ids whose ownership is resolved server-side.

Reusing an idempotency key with a different request is rejected. A legitimate retry returns the
original result. Stale conflicts are visible rather than silently last-write-wins. Unrelated edits
in distant spatial shards do not conflict merely because they belong to the same forest.
Cross-shard movement and any accompanying aggregate-ledger update are atomic.

### Stale authorization

Every regional load, inspection, mutation, export, reset, recovery, and deletion request rechecks
the session. A revoked session receives no further private state, and the client discards its
owner-scene state on authentication failure.

Already delivered bytes cannot be recalled. Responses therefore minimize writing metadata.
Lifecycle reconciliation may leave a visual tree temporarily present, but inspection exposes no
deleted or newly unauthorized content.

### Compact threat analysis

| Threat | Required mitigation |
| --- | --- |
| Owner/object id substitution | Session-derived owner plus owner-constrained database query |
| Cross-owner enumeration | Non-enumerating errors, opaque cursors, rate and payload limits |
| Creator-name collision | Never use creator text as production ownership |
| Collaborator escalation | Collaborator fields absent from ownership policy input |
| Stale/revoked session | Recheck every sensitive request; clear client owner state |
| Visibility change after load | Recheck inspection; minimize scene metadata |
| Shared/private cache leak | Private no-store default; prove any shareable asset boundary |
| Private content in keys/logs | Derived visual keys and bounded reason codes only |
| Replayed mutation | Owner-scoped idempotency key and request fingerprint |
| Stale revision | Explicit conflict; no silent overwrite |
| Large history/payload | Spatial and cursor pagination with no silent truncation |
| Partial deletion | Resumable deletion manifest covering active, recovery, cache, export, and backup state |

## Migration, failure, reset, recovery, and retention

### Regeneration and backup

Generated regions, discovery candidates, derived material availability, trail joins, and scene
composition may be reconstructed only from exact compatible versioned evidence.

Captured projections, writing-tree identities, tombstones, curation, authored objects, captured
costs, gathered totals, discovery progress, revisions, and migration state require durable backups.
Current source writing is not a backup for historical forest choices.

### Migration

A migration:

1. reserves a stable operation and target version;
2. reads a bounded cursor batch;
3. writes new-version records without destroying the active revision;
4. validates ownership, counts, identities, coordinates, ledgers, and references;
5. records batch completion idempotently;
6. resumes until all required batches are verified; and
7. atomically changes the relevant root or region pointer.

Storage migration cannot silently perform semantic reprojection. Regions may temporarily carry
different explicitly supported versions when the root manifest describes them correctly.

An unsupported future record is preserved, rejected for mutation, and never interpreted as empty.
If safely possible, it remains available through an explicit read-only recovery path.

### Failure behavior

- Writing creation succeeds independently of delayed tree reconciliation.
- Retried tree creation resolves to one owner/group tree.
- A committed mutation with a lost response is recovered through its idempotency key.
- A pre-commit failure changes neither live object, shard revision, nor ledger.
- Failed expansion leaves established regions active.
- Failed migration leaves the old authoritative pointer active.
- Failed asset generation preserves the semantic tree and uses an explicit unavailable state.
- Invalid material evidence disables new commitments while leaving objects visible and removable.
- Failed recovery preserves both the current head and recovery candidate.

### Reset scopes

Reset is never one ambiguous operation:

1. **Reset this visit** clears only transient browser state.
2. **Restore generated tree placements** removes personal relocations.
3. **Clear authored geography** removes authored objects and atomically releases commitments.
4. **Restore tree inclusion** reverses hide choices.
5. **Restart discovery/material state** requires no dependent commitments or atomically clears the
   confirmed dependent objects.
6. **Regenerate the whole owner world** is not an ordinary initial product control.

A durable reset creates a new revision. During its disclosed recovery window, undo creates another
new head from the retained snapshot rather than silently deleting intervening history.

Reset never edits or deletes source writing.

### Recovery

- Restore from an immutable or append-only known-good revision.
- Validate current ownership, source authorization, world compatibility, and ledgers before
  cutover.
- Present conflicts when newer changes exist.
- Preserve incompatible authored objects in a recovery state rather than moving or deleting them.
- Do not restore writing bodies from forest projection records.
- Re-resolve foreign translations under current discovery authorization.
- Distinguish user-facing revision recovery from operational encrypted database backup.

### Retention and deletion

Exact day counts remain gated on the broader account-deletion and operational-retention contract.
The binding invariants are:

- active records remain for the active account;
- tombstones contain minimal identity evidence and remain only as long as restoration and
  duplicate-prevention promises require;
- recovery revisions, idempotency records, migration logs, audits, exports, and backups have
  explicit bounded retention;
- expired evidence is purged rather than merely hidden;
- retained records omit unnecessary titles, excerpts, routes, and translation metadata; and
- migration, export, recovery, account deletion, and cleanup are resumable idempotent batch
  operations, never one unbounded transaction.

## Pure policy proof

`classifyForestOwnerWriting` accepts an exact summary containing only authenticated owner and
bounded Block identity/lifecycle fields. It returns `eligible`, `ineligible`, or `unresolved` with
a bounded reason code. It:

- accepts the four supported owner status/visibility combinations;
- requires live authorship and rejects deletion-retained authorship as owner writing;
- returns the owner/group logical identity;
- excludes Page and owner mismatch;
- leaves creator-only and malformed ownership unresolved;
- excludes creator, collaborator, title, body, and arbitrary fields from its input; and
- fails closed on unknown identity, language, status, or visibility evidence.

`classifyForestTranslationDiscovery` independently implements the accepted owner, foreign, and
deletion-retained translation discovery matrix without restoring ownership.

`classifyForestWritingLifecycle` consumes an enumerated event plus only the event-specific,
caller-authorized booleans it needs. It classifies creation, joining, foreign translation refresh,
ordinary edit, deletion, restoration, hide, unhide, personal relocation, explicit reprojection,
and prohibited group mutation.

The policy modules:

- perform no database or network access;
- create no records;
- contain no route authorization shortcut;
- consume no body content;
- return deterministic JSON-safe decisions;
- reject extra fields and unused facts;
- encode no whole-forest tree or object cap; and
- do not generalize into content federation.

They are executable contract evidence, not sufficient authorization by themselves. Future callers
must obtain their facts through owner-constrained queries and carry out results through durable,
idempotent persistence.

## Verification evidence

On Node 24.15.0 at the Milestone 1 handoff:

- changed executable files passed ESLint;
- the two new policy specs contributed 17 passing examples;
- the complete forest-specific selection passed 202 specs with no failures;
- the complete repository Jasmine suite passed 725 specs with no failures; and
- `git diff --check` reported no whitespace errors.

These tests prove deterministic policy behavior and guard existing repository contracts. They do
not prove production persistence, real-world emotional meaning, public access, mobile performance,
or downstream cleanup of forest records that do not yet exist.

After account deletion introduced explicit Block `authorshipState`, the owner-writing policy
advanced to version 2. Its focused owner-writing and lifecycle selection passed 20 specs; the
combined forest, account-deletion, attribution, and permission selection passed 233 specs; and the
complete repository suite passed 756 specs on Node 24.15.0. This compatibility update proves that
deletion-retained writing cannot regain tree ownership while remaining eligible for ordinary
public translation discovery.

## Runtime version reconciliation

The active runtime constants at this milestone are:

| Boundary | Active version |
| --- | ---: |
| Owner-writing policy | 2 |
| Writing-lifecycle policy | 1 |
| Post-tree projection schema / meaning mapping | 1 / 1 |
| Runtime tree asset schema | 3 |
| Renderer-v3 cache version | 4 |
| Scene / base-identity schema | 1 / 1 |
| Environment schema / world generation | 2 / 2 |
| Ground presentation / ground detail | 13 / 1 |
| Terrain-feature schema / generation | 2 / 5 |
| Crossing schema / generation | 3 / 7 |
| Stream-bank model | 3 |
| Overlay / placed-object schema | 1 / 1 |
| Discovery / discovery-state / discovery-generation | 1 / 1 / 1 |
| Transient life / actor / visitor | 3 / 2 / 1 |
| Humanoid presentation | 3 |

Earlier post-to-tree and environment documents contained active-sounding references to runtime
tree-asset schema 2, ground presentation 11, crossing schema 2, and crossing generation 5. Those
values describe earlier checkpoints. The governing documents must identify the current values while
preserving why the historical versions existed.

## Explicitly deferred gates

- Production forest schemas, indexes, route, and reconciliation job.
- Exact spatial-density cell size, local object count, rolling-neighborhood geometry, and expansion
  threshold.
- Production layout behavior for empty, representative, and unusually large histories.
- Totally private Block support, pending a source-writing privacy state and owner authorization.
- Public/private region presentation, visiting, guest, and social policy.
- Legacy creator-only ownership repair or backfill.
- General archive semantics, which the current Block lifecycle does not provide.
- Exact forest-specific recovery, backup, export, and cleanup retention durations.
- A durable forest-cleanup acknowledgement or equivalent convergence guarantee attached to the
  implemented account-deletion request before durable forest records are introduced.
- Shared visual caching until non-disclosure is demonstrated.
- The persistence and retention of a future bounded Tansy encounter record.
- Public monetization or membership distinctions; writing volume cannot silently become a reason
  to suppress eligible trees.

## Milestone judgment and handoff

Milestone 1 establishes a coherent bounded policy for the first production source, stable ownership,
owner/group tree identity, automatic reversible eligibility, translation discovery, lifecycle,
durable state, scalable records, authorization, migration, failure, reset, recovery, and retention.

It is strong enough to permit planning Milestone 2's authenticated real-writing grove only after:

- this contract and its policy specs pass final review;
- Milestone 2 honors the implemented account-deletion disposition and downstream cleanup seam;
- Milestone 2 retains owner-only private delivery;
- production adapters use owner-constrained queries and idempotent reconciliation; and
- real-history layout and payload behavior are measured without imposing arbitrary truncation.

Milestone 2 should implement the smallest authenticated read-only grove from real eligible Blocks.
It must not skip ahead to production overlay persistence, public visiting, or broader construction.
