# Writing-linked marker: record and protocol design

Prepared and approved November 2, 2026 for Part III Milestone 4. This specifies the implementation slice
under the accepted [kickoff plan](milestone-4-kickoff-plan.md). Bootstrap 3 advertises mixed
regional reads and linked movement/removal. Ordinary mutations stay protocol 1; regional and
diagnostic endpoints accept explicit version-2 reads. Linked creation is implemented behind the
off-by-default `FOREST_WRITING_LINKS_ENABLED` gate. Automated browser and guarded test-database
checks pass; the user reported the local walkthrough and polished UI passing on November 5. No production database operation was performed.

## Implementation checkpoint: durable format and transaction core

The first code increment implements exact schema-1/schema-2 model validation, a shared format
reader, frozen fingerprint encodings, transaction-bound source validation and the internal
protocol-2 creation/movement/removal service. Existing marker defaults and protocol-1 envelopes
remain unchanged. Collision validation and tombstone retention handle the new format; retention
compares the actual stored version. The compatibility increment below extends regional, diagnostic
and reset boundaries without projecting linked records as ordinary markers.

The internal mutation factory's `linkedCreationEnabled` dependency initially defaulted to false.
Only isolated unit-test harnesses enabled it in the first increment; the environment gate was wired
in the final creation increment below. Subsequent compatibility and read/UI increments are recorded below. Do not enable
new linked writes or seed real schema-2 records before the isolated database gates pass. The first
increment performed no record migration, index change, new collection, production operation or commit.

The browser synchronization predicate now checks the writing relationship as well as coordinates
when reconciling a create or move. It cannot falsely confirm a different writing choice under the
same id. Protocol-2 client snapshots and regional negotiation were connected in the later read/UI
increment below.

## Implementation checkpoint: mixed-format compatibility (November 3)

Regional and diagnostic routes accept an exact scalar `version=2`; omission preserves version 1.
Regional version 2 returns each stored schema version and the relationship (null for ordinary
markers), with no writing metadata. Before any legacy regional page, an owner/forest/requested-cell
scoped existence check detects active schema-2 records and returns HTTP 409
`FOREST_AUTHORED_UPGRADE_REQUIRED`. Revision-vector checks still reject concurrent changes.
Version-2 regional cursors bind owner, forest, requested version, supported object/link formats,
cells and cell revisions; legacy cursor encodings and their 256-character limit remain unchanged.
The version-2 cursor limit is 384 characters.

Diagnostic version 2 validates both formats and reports actual schema/fingerprint versions but
omits the relationship, writing-tree identity and writing metadata. Its continuation binds owner,
forest, requested version, supported formats, removal filter and export start time. Legacy exports
require an explicit upgrade on encountering schema 2, including removed rows filtered from output.

Reset readers, workers and retention share exact immutable-scope validation. Existing operation-1
records keep their scalar schema-1 scope and operation-1 responses; retries never expand it. New
internal reset requests explicitly write schema 2 / operation 2 with `[1, 2]` scope, independently of
the disabled linked-create gate. Bounded mixed batches preserve relationships and fingerprints,
advance regional revisions and compare against each stored record version. Completed-reset
retention dispatches by the stored operation version and preserves malformed or unknown scopes.
Regional reads recognize either processing-reset format.

Verification: **1,390 Jasmine specs, zero failures**, including mixed reads, explicit upgrades,
owner/world/version-bound continuations, fixed legacy cursor encodings, diagnostic privacy,
immutable old reset scope, mixed batches and exact retention. Repository lint and whitespace checks
pass. The full suite passed outside the sandbox after local subprocess startup tests were denied
inside it.

These changes require the compatible-reader-first rollout below: pause new internal resets during
rolling deployment and finish old processing resets before enabling linked creation. No database
fixture or browser test is claimed for this compatibility increment; subsequent browser evidence
is recorded below.

## Implementation checkpoint: inspection, finding and marker return (November 3)

The private marker-inspection endpoint now validates complete owner/world/object evidence and
reauthorizes linked writing through the existing tree-inspection policy. Ordinary, ready and
source-unavailable variants carry exact presentation fields; only a current source-not-found
outcome becomes generic unavailable writing. Reconciliation, infrastructure and unsupported data
remain honest temporary failures. No writing body or source relationship is copied into responses.

`/forest/writing?view=marked` now renders a bounded active-linked-marker page, ordered by UUID,
with owner/world/filter/format-bound continuation and per-page deduplicated source authorization.
Unavailable writing retains a generic row. Visit place, Read post and confirmed revision-protected
removal are accessible from the list; successful removal moves keyboard focus to another row or
the forest-entry link. The partial `forest_authored_linked_marker_list` index is declared in the
schema but has not been created or explained against a database in this increment.

Marker-origin post links preserve `returnMarker` through language redirects and localized return
actions. Bootstrap resolves the owner's current active marker position without requiring its source
to remain readable, loads at most four collision pages and checks the marker revision again before
selecting the destination. Missing, removed, foreign, unsupported, moved-during-read, crowded or
incomplete destinations use the entrance. Conflicting tree/marker locators use the entrance even
when one locator is malformed. Existing tree returns are preserved.

Bootstrap 3 advertises manifest 2 and `authoredLinkedMutationProtocolVersion: 2`, preserving ordinary
protocol 1. The canvas retains/validates relationship intent in snapshots, requests mixed regional
reads, highlights and focuses the returned marker, and asynchronously loads authorized post details
without allowing stale responses to populate another marker's panel. Existing linked movement and
removal use protocol 2; new creation remains disabled (`writingLinkCreationEnabled: false`) and the
public creation parser still accepts only protocol 1. The environment gate and tree-selection/create
control remain for the next increment.

Verification: **1,408 Jasmine specs, zero failures**, plus repository lint, browser-module syntax
and whitespace checks.

The database-free Firefox fixture now covers both tree and linked-marker inspection→post→return
at 1280px and 390px, keyboard entry/close focus, unavailable-writing management, translation
pagination, delayed-load focus and missing/failed tree fallbacks. This is narrow-viewport desktop
Firefox evidence, not physical mobile/touch certification. Isolated database index/transaction/
lifecycle evidence and the actual creation loop remain open. No production operation or commit
was performed.

## Implementation checkpoint: creation loop and integration evidence (November 4)

The shared runtime gate now enables tree-specific creation only for the literal environment value
`FOREST_WRITING_LINKS_ENABLED=true`. Default-off creation leaves readers, ordinary markers and
existing linked movement/removal working. The protocol-2 creation parser accepts only the exact
relationship shape; disabled creation, unavailable writing and excessive range have explicit
bounded responses. Equal retries retain their pre-gate/pre-source recovery order.

The selected tree's inspection now offers **Mark this writing** when enabled. Placement retains
its immutable source identity and a transient recognition title, previews the inclusive 160-unit
initial radius, and sends the link in a version-2 body. Transient title/origin data are never sent
as durable relationship fields. Cancel clears selection; ordinary creation stays protocol 1.
Lost-response retries keep the exact id/link/placement. Tombstoned successful retry results and
conflict snapshots settle on removal rather than redrawing a marker.

Verification: **1,411 Jasmine specs, zero failures**, repository lint, explicit browser-module and
fixture lint, module syntax and whitespace checks pass. The Firefox fixture passes the complete
creation→inspection→post→marker-return loop at 1280px and 390px, including lost response followed
by a gate-off retry, a concurrent removal, out-of-range preview and ordinary creation with linked
creation disabled. Existing tree-return, focus, unavailable-writing and translation checks pass.
Narrow desktop viewports do not certify physical touch/mobile behavior.

`npm run forest:writing-linked-marker-fixture -- run --write` passed against `daily-page-test`.
The guarded fixture refuses production, uses reserved owner `64b00000000000000000a061`, and cleans
its records on exit. It exercises real transactions and owner-fence rollback, equal concurrent
creation, differing-link conflict, mixed collisions, unchanged legacy records, source/range checks,
gate-off/moved/removed/source-loss retries, current inspection, unavailable-source listing and
marker return, mixed pagination/invalidation, diagnostic privacy, mixed reset, exact retention and
bounded account-deletion convergence. The named partial-index query was explained with an explicit
hint and verified as an index scan without collection scan; only the fixture's active linked row
was examined. Unknown records survive retention and are drained by owner-scoped deletion.
The test-database index was created/verified; fixture owner records were removed. No production
database operation, environment-file edit, migration/backfill or commit was performed.

The complete marker implementation is ready for local review: restart the development server with
`FOREST_WRITING_LINKS_ENABLED=true`, inspect a tree and choose **Mark this writing**. Review creation,
reload, inspection/read/return, the marked-writing list, move/removal, ordinary markers and a source
becoming unavailable. Keep the deployment gate off until the compatible-reader rollout and old-reset
completion checks below are satisfied. User acceptance and physical-mobile review remain open.

## Local walkthrough fix: insertion and mutation timestamps (November 4)

The user reported that **Marked writing** returned the unavailable page after placing a marker.
The shared stored-record validator rejected `createdAt > changedAt`. That ordering is legitimate:
`changedAt` is captured before the transaction, while Mongoose assigns `createdAt` at insertion.
The diagnostic reader had the same invalid ordering assumption. The earlier database fixture's
fixed clock one minute in the future hid this production-writer behavior.

Regression tests and the guarded database fixture reproduced the failure before the fix. The two
readers now validate dates independently, retaining removal/tombstone checks and export-start
bounds. The writer and saved records remain unchanged; existing markers require no repair or
recreation. The fixture now uses the real creation clock, asserts insertion follows mutation time,
and advances time only for retention checks. The full guarded fixture passes with this clock.
The user should restart the development server and retry the existing marked-writing page.

## Local walkthrough fix: marker inspection routing (November 4)

The user next reported that every linked marker displayed the tree-writing-unavailable message,
even for readable posts. The authored-object prefix mounted the write-only Origin/JSON guard ahead
of authentication and all handlers, so normal marker-inspection GETs were rejected with HTTP 403
before reading any writing. Handler-only tests and the browser fixture had omitted this middleware.

The guard now passes GET/HEAD to the normal private authenticated read path. PUT/PATCH/POST still
require same-origin JSON before authentication/mutation work. Mounted-prefix regression tests
reproduced the failure before the fix and now verify header-free authenticated reads, anonymous 401
responses, private cache headers and blocked untrusted/non-JSON writes. The Firefox fixture now
mounts the production prefix guard for inspection and creation. Marker request failures use a
marker-specific retry message; actual source-unavailable responses retain their separate message.
No marker/post data or source eligibility rules changed. Restart the development server before
retrying marker inspection. User acceptance remains open.

## Presentation polish: one marker family (November 5)

The user reviewed both marker uses and requested clearer, player-facing copy and consistent nearby
controls. Both now share **Forest marker** identity, the sign silhouette and Move/Remove actions.
A small book detail denotes remembered writing. Place-marker copy explains remembering a location;
writing-marker inspection leads with the current authorized post title and primary Read post action.
Only the writing use offers Browse marked writing in its secondary management footer. No new marker
kind, relationship operation, data conversion or source-policy change was introduced.

The bottom controls form one action bar with matching 44px View/Place buttons and a nearby label.
The bar hides during inspection or placement and returns on close; narrow layouts put the label
above two equally sized buttons. Technical account-state/prototype language was removed from the
marker description, removal prompt and related placement copy. Both uses remain available.

Thirty-five focused specs, browser-module/fixture lint, syntax and whitespace checks pass. The
expanded Firefox fixture passes both panels and matching/contained toolbar targets at 1280px and
390px, plus the existing full interaction checks. Captured desktop/narrow screenshots were visually
reviewed. No database operation or commit was performed; user acceptance and physical-mobile review
remain open.

## User acceptance and commit review (November 5)

After the local correctness fixes and marker presentation polish, the user reported all their tests
passing and supplied screenshots of both marker uses and the nearby action bar. Final visual review
found the place/writing distinction, post-action hierarchy and toolbar treatment consistent with
the intended feature. This closes reported local functional and visual acceptance. Physical-device
specifics were not supplied; the existing narrow-viewport automation is not a physical-mobile claim.

The feature is ready for the user's coherent commit. No further UI or runtime edits were made in
this review, and no commit, deployment, environment change or database operation was performed.
The off-by-default gate and compatible-reader-first rollout requirements remain in force.

## Choice

Keep the existing collection, object identity, `personal-marker` kind, `quiet-waymarker` appearance,
placement policies and material-free behavior. Introduce one second, exact record shape for a
marker associated with a stable owner writing-tree identity. Existing markers remain version 1,
including after movement or removal. New unlinked markers also remain version 1.

Do not append an optional relationship to version 1, convert old markers, or create a separate
relationship collection. A shared version-dispatched validator must govern schemas and every
service reader; changing a single global “current schema” constant is insufficient.

## Exact durable shapes

Both variants retain all existing owner/forest/object, placement/index, world compatibility,
appearance, lifecycle, revision and timestamp fields. The only permitted combinations are:

| Field | Ordinary marker | Writing-linked marker |
| --- | --- | --- |
| `schemaVersion` | 1 | 2 |
| `identityVersion` | 1 | 1 |
| `kind` | `personal-marker` | `personal-marker` |
| `appearance` | `quiet-waymarker`, version 1 | Same |
| `creationFingerprint.version` | 1 | 2 |
| `writingLink` | Field absent, including on existing tombstones | Required immutable object below |

```json
{
  "schemaVersion": 2,
  "identityVersion": 1,
  "kind": "personal-marker",
  "writingLink": {
    "version": 1,
    "writingTreeId": "22222222-2222-4222-8222-222222222222"
  }
}
```

This example shows the discriminating fields; the common existing fields remain required.
`writingLink` has exactly those two keys. The tree id is canonical lowercase UUIDv4. Null,
missing or extra link fields, mismatched fingerprint versions, a link on schema 1, and unknown
versions fail closed. Durable schema 1 must not acquire a default `writingLink: null` through
Mongoose. Unknown record/relationship versions are unsupported; malformed supported shapes are
unavailable. Neither silently becomes an ordinary marker.

The relationship is to the tree, which already owns owner/group identity. Do not store a Block id,
translation list, owner supplied by the client, title, body, excerpt, canonical route, or copied
projection in the link. No tree habitat, seed, phenotype, asset, position or source identity changes.

The relationship cannot be added to an existing marker, changed, or detached in place in this slice.
To choose a different writing association, remove the marker and create another. Several markers
may deliberately reference the same tree; there is no per-tree singleton rule or unique link index.
An accidental repeated save retries one UUID rather than generating additional marker identities.

## Creation fingerprint and retry identity

Freeze the existing fingerprint algorithm literally. It currently hashes the UTF-8 encoding of
compact `JSON.stringify` of this array with SHA-256 and encodes the digest as base64url:

```text
[1, objectId, "personal-marker", initialWorldX, initialWorldY,
 "quiet-waymarker", 1]
```

Version 2 hashes the same encoding of this exact ordered array:

```text
[2, objectId, "personal-marker", initialWorldX, initialWorldY,
 "quiet-waymarker", 1, 1, writingTreeId]
```

The last numeric 1 is the relationship version. Each algorithm uses its fixed literal prefix,
not a mutable “latest protocol” constant. Dispatch from the validated create intent. Canonical
UUIDs and signed integer coordinates are normalized before hashing.

An existing id with a different digest **or fingerprint version** conflicts. Equality never
means “same coordinates” alone. Moving preserves the original fingerprint. Create retries use
original creation coordinates and link even after a subsequent move or removal.

Acquire the current owner ledger fence and active-world authority, then look up existing identity
before validating current source availability or placement. Equal retries return the currently
committed active or removed record. They neither require the writing to remain available nor
resurrect a tombstone. They return no writing metadata. Different link, initial position, or linked/
unlinked intent under the same id conflicts, even if the marker currently occupies the same place.

## Wire protocol and stale clients

| Request | Accepted exact body |
| --- | --- |
| Create, protocol 1 | Existing `protocolVersion`, `kind`, `worldX`, `worldY` |
| Create, protocol 2 | Same fields plus required exact `writingLink` |
| Move, protocol 1 or 2 | Existing `protocolVersion`, `expectedRevision`, `worldX`, `worldY` |
| Remove, protocol 1 or 2 | Existing `protocolVersion`, `expectedRevision` |

Object ids remain path locators; owner and primary forest come from the session. Protocol 1
creates schema 1. Protocol 2 creates schema 2. New clients can still create ordinary markers with
protocol 1. Protocol 2 move/removal accepts either supported record variant; protocol 1 mutation
of a schema-2 object returns an explicit upgrade-required outcome without writing or downgrading
its response. Unknown request versions or fields fail before private reads.

Preserve protocol-1 success/error object envelopes for schema-1 records. Protocol-2 object
representations add `schemaVersion` and `writingLink`; its representation of a schema-1 record
uses `writingLink: null`. That transport null does not enter durable schema 1. Conflict snapshots
follow the requesting protocol's supported representation. No protocol-1 snapshot disguises a
schema-2 object as a version-1 marker.

Authored regional reads add an exact scalar `version=2` query; omission continues to mean version 1.
Version 2 composes both record variants, adds those same two row fields, and contains no writing
metadata. Cursor version 2 binds owner/forest, canonical cells, requested manifest version,
supported record/relationship versions and cell revision vector. Existing version-1 cursors retain
their original interpretation. Every creation/move/removal invalidates affected cell continuations
through the existing cell revision transaction.

Before returning any version-1 regional page, check for schema-2 active records in the requested
cells using an owner/forest/cell-scoped existence query. If found, return
`409 FOREST_AUTHORED_UPGRADE_REQUIRED`; do not filter them out or return a partial-looking complete
region. The existing nine-cell and 128-active-markers-per-cell bounds apply across both variants.
This is an additive bounded compatibility check. New code reads mixed records; old browsers are
told to reload rather than silently losing relationships. Ordinary writing/base layers remain usable.
Unknown durable future versions retain migration-required behavior; they are not merely a stale
browser condition. Old deployed servers already fail closed on schema 2, which is why rollout
must establish compatible readers before enabling new writes.

Client pending snapshots and canonical reconciliation retain the relationship. For a create,
confirmation must match object identity, placement **and the validated linked/unlinked intent**.
The current coordinate-only prediction comparison is insufficient when a different writing choice
can collide under an object id. A move keeps its immutable link; removal still confirms a tombstone.

Bootstrap version 3 retains the ordinary `authoredMutationProtocolVersion: 1` field and adds
`authoredLinkedMutationProtocolVersion: 2`, `authoredRegionManifestVersion: 2`, and
`writingLinkCreationEnabled`. Supported readers/inspection remain available when creation is off;
only the new-create UI and genuinely new linked-create requests depend on that flag. Do not make
an ordinary marker request accidentally use protocol 2 by overwriting its existing scalar.

## Source validation and concurrent changes

For a genuinely new linked create, within the existing fenced MongoDB transaction:

1. Verify supported active world, deletion/reset state and absence of an existing logical object.
2. Read the exact owner/forest tree in that transaction. Require supported identity/projection,
   active source state and visible inclusion. Resolve current eligible owner writing using the
   transaction-capable owner-group evidence policy. Do not call the standalone inspection reader
   outside the transaction and treat that earlier result as creation authority.
3. Require the initial marker position within **160 world units** of the tree, plus all existing
   authoritative terrain/collision/density/world-bound checks. This is a source-neighborhood rule,
   not a claim that a server stores or knows the avatar's position. Mirror it in placement preview.
4. Insert schema 2, fingerprint 2 and the immutable link, then advance the cell revision atomically.

Reuse bounded group evidence; unresolved or over-budget evidence is unavailable. Reuse/refactor
validation policy rather than introducing a weaker parallel eligibility definition. Owner hide,
reconciliation and account deletion share the ledger fence. Ordinary source-writing writes do not
all share that transaction: source eligibility is validated at the creation snapshot, and may
change afterward or race a commit. The accepted result can consequently be a saved marker whose
writing is now unavailable. Reauthorization on each read prevents that reference granting access;
this slice does not promise permanent source availability or serialize all post edits globally.

Move/removal require only current marker authority and the existing revision/placement rules.
They do not require source access. Movement retains the link even beyond the initial 160-unit
neighborhood, with honest preview/inspection copy; it does not silently select the nearest tree.
The relationship expresses the owner's choice, not a computed proximity result.

## Inspection, finding and return

Add private `GET /api/v1/forest/authored-objects/:objectId/inspection`, with no extra authority query.
Scope to the current owner/world and active object, validate the complete record, then resolve a
schema-2 link through current tree/writing inspection policy. Return a version-1 inspection envelope
with an exact variant:

- ordinary marker: object identity/revision and `writingState: "unlinked"`, no writing;
- available linked writing: same object fields, `writingState: "ready"`, bounded current recognition
  metadata and canonical path;
- hidden, removed, ineligible, unauthorized or unresolved source: same owner marker fields,
  `writingState: "unavailable"`, no source metadata or reason distinguishing private conditions.

Missing/foreign/removed markers share generic absence. Infrastructure/version failures remain
honest failures, not a claimed source deletion. No current writing bodies are returned or stored.
Existing tree inspection remains the translation-discovery path; marker inspection need not build
another translation browser in this slice.

Use `/forest/writing?view=marked` for a bounded server-rendered list of active schema-2 markers,
ordered by object UUID. Default 25 and maximum 50 raw marker rows per page, limit-plus-one with
an owner/forest/filter/version-bound continuation. Each marker remains a row even when its writing
is unavailable. Deduplicate source resolution within a page; metadata lookups are bounded by the
page's distinct tree count. Do not scan all unlinked markers to fill a page.

Add one partial index on `{ownerUserId: 1, forestId: 1, objectId: 1}` with partial filter
`{schemaVersion: 2, state: "active"}`, named `forest_authored_linked_marker_list`. No reverse
writing-link index is needed because there is no source-change cascade or query by linked tree.
Prove the actual index/query shape against an isolated database before rollout.

The list offers Visit place and, when authorized, Read writing, with accessible removal using the
existing revision-protected mutation. A private `returnMarker` locator extends the existing fixed
forest-return navigation. Resolve the current active marker's placement by owner/world; choose a
clear nearby avatar position using bounded current collision evidence. Source unavailability does
not revoke access to the owner's marker place. Removed/foreign/unsupported markers fall back to
the entrance. Reuse the existing tree-return focus/highlight behavior; when both locator types are
supplied, treat the destination as invalid and use the entrance rather than silently prioritizing.
A post opened through a marker carries that marker locator back, not a copied coordinate or the
associated tree's location. The current tree-origin post links continue to return to their tree.

## Lifecycle, reset and diagnostics

| Change | Result |
| --- | --- |
| Writing edit, title/language selection change | Same marker/tree; fresh authorized metadata/path |
| Tree hidden or no eligible owner writing | Keep marker; show generic unavailable writing; move/remove/Visit place still work |
| Same tree restored and eligible | Link works again without rewriting marker |
| Different tree identity appears | No automatic reassignment |
| Marker removed | Ordinary 90-day tombstone, retaining immutable link and fingerprint for retry identity |
| Account deleted | Immediate access revocation; existing owner-keyed cleanup drains both shapes and tombstones regardless of retention |

Update collision readers to validate both variants without dereferencing writing. Reset/retention
must also operate when a source is unavailable. Preserve all existing unique, spatial, retention
and deletion indexes and query bounds; the marker-list index above is the only planned addition.

Reset requires an explicit mixed-version operation, not changing the meaning of the old scalar
`authoredObjectSchemaVersion`. Existing schema-1/operation-1 resets retain exact schema-1 scope.
New schema-2/operation-2 reset records replace that scalar with immutable
`authoredObjectSchemaVersions: [1, 2]`; other fields and bounds remain the same. New workers read
both reset shapes. Finish any old processing reset before enabling linked writes; an active reset
already excludes individual mutations. New resets after enablement use operation 2 and remove
both marker variants without touching source writing. Completed old operations retain their
original retention behavior. No user-facing reset/restore feature is introduced.

Retention dispatches by actual marker/reset version and compares the exact version and revision
read, rather than deleting against a global latest constant. Unknown/malformed records remain
preserved and reported as bounded failures. Account deletion must continue draining every owned
record irrespective of supported presentation versions and proving complete collection absence.

Diagnostic export adds an explicitly requested version-2 envelope/cursor that validates both
variants and reports actual object schema and fingerprint versions, but omits `writingLink`,
tree/group/Block ids and writing metadata. Version-1 diagnostics fail visibly on an encountered
schema-2 row rather than omitting it. No new persisted export artifact or backup promise is added.

## Compatibility and rollout

1. Implement exact shape dispatch and compatible readers across mutation, region, placement,
   diagnostics, reset, retention and fixtures. Keep new linked-marker creation disabled via one
   explicit runtime feature gate, `FOREST_WRITING_LINKS_ENABLED`, false by default. Bootstrap
   advertises read capabilities separately from creation availability. Pause initiation of internal
   reset operations during the rolling update. Roll out this compatible release to every serving
   process and worker before enabling it or resuming new resets; do not invent a durable rollout registry.
2. Prove original schema-1 records, hashes, revisions, timestamps, retry outcomes and client
   contracts remain unchanged. Exercise mixed variants and the partial index in isolated fixtures.
   Require existing processing resets to finish before feature enablement. Updated code starts new
   resets as operation 2 after the rollout, independently of the linked-create feature flag.
3. Enable linked writes/UI deliberately after compatibility is established. New clients request
   manifest/protocol 2 where needed. Stale clients receive explicit upgrade-required states.
4. To stop new linked creation, disable the gate while leaving compatible readers, existing-object
   movement/removal, diagnostics and cleanup operating. Equal linked-create retries must still
   recover committed results while the gate is off; reject only genuinely new linked creates.
   Once schema-2 marker or reset data exists, rolling back to the old version-1-only code is not a
   supported recovery. Disabling linked creation must not revert new resets to operation 1.

No existing record transform or backfill is required. Deploying a mixed-version reader is not a
data migration. The migration harness must explicitly classify both known shapes as supported and
preserve unknown versions; do not register a fictitious 1→2 transform. A later actual transform
would need its own durable resumable deployment-operation evidence.

## Implementation and acceptance

Land runtime work as one coherent linked-marker feature commit after the existing navigation
commits, using small working increments as needed. Tests must establish:

- byte-for-byte known version-1 fingerprint fixtures and unchanged old-record lifecycle;
- exact supported field/version combinations and fail-closed unknown shapes in every reader;
- equal and concurrent creation, differing-link conflicts, lost-response recovery, retries after
  movement/removal/source loss, and recovery while feature creation is disabled;
- transaction/session-bound eligibility, hide/deletion races and no foreign source access;
- initial proximity, signed/boundary/collision/density validation and move-with-link preservation;
- mixed regional pagination, changed continuations, old-client upgrade responses and client
  confirmation that never mistakes a different relationship for its prediction;
- mixed reset, exact retention, diagnostic privacy and full account-deletion convergence;
- bounded marked-list query/index, unavailable-source rows, marker-origin read/return, cross-session
  continuity, keyboard/pointer/touch/focus/reduced-motion and ordinary no-customization access.

Use isolated guarded database fixtures for transaction/index/reset/cleanup evidence, then the
existing browser fixture and real authorized desktop/physical-mobile walkthrough. Record unavailable
review gates honestly. No material loop, generalized relationship platform, migration job, public
visiting or membership work enters this slice.

Timestamp-fix verification: **1,413 Jasmine specs, zero failures**, repository lint, fixture lint
and whitespace checks pass. The real-clock guarded database fixture also passes.

Inspection-routing verification: **1,416 Jasmine specs, zero failures**, repository/fixture/browser
module lint and whitespace checks pass. Firefox passes the full creation/read/return fixture at
1280px and 390px with the production guard mounted, including the marker-loading error message.

Final commit-review verification: **1,416 Jasmine specs, zero failures**, repository lint, explicit
browser-module/fixture lint and whitespace checks pass. No blocking issue was found in the final
review. The changes remain uncommitted for the user.
