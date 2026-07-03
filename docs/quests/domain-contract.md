# Community Quests Domain Contract

## Status

Approved for implementation. This document defines the first implementation of community quests. It is the source of truth for schema validation, service behavior, authorization, and domain-level tests.

## Goals

Community quests coordinate collaborative posts toward a shared target. A quest may either:

- accept a configured number of qualifying posts (`count`), or
- require one qualifying post for every configured item (`set`).

Every counted post is reviewed by the quest administrator. Registered creators and registered collaborators on an approved post receive equal contribution credit. Quests expose progress, badges, and a leaderboard without changing ordinary public collaboration before review.

## Non-goals for the first release

- User-created quests or a general quest-creation UI
- Programmatic validation of editorial instructions
- Credit for anonymous collaborators
- Separate credit for translations of a qualifying post
- Review of translations added after the qualifying post
- Arbitrary SVG upload or SVG source stored in MongoDB
- Weighted contributor credit or distinctions between creator and collaborator
- Permanent cached progress, medal, or leaderboard counters

## Terminology

- **Quest administrator:** the registered user who reviews submissions for one quest.
- **Qualifying post:** the one language-specific block submitted and approved for quest credit.
- **Translation:** another block in the qualifying post's translation group. It remains normal site content but does not count separately.
- **Claim:** a temporary reservation of a set item by a registered user.
- **Submission owner:** the registered user who claimed the item or created the count-quest submission. This user controls submission and revision actions even when other people contribute to the post.
- **Contributor snapshot:** the durable set of registered user IDs credited when a submission is approved.
- **Live progress:** the number of submissions currently in `approved` state and still eligible.

## Entities

### Quest

Required fields:

| Field | Contract |
|---|---|
| `slug` | Stable, unique, lowercase URL identifier. It is not translated. |
| `type` | `count` or `set`; immutable after the quest has submissions or items. |
| `status` | `draft`, `active`, `completed`, or `archived`. |
| `name_i18n` | Map of language code to non-empty name; English is required initially. |
| `description_i18n` | Map of language code to description; English is required initially. |
| `instructions_i18n` | Map of language code to submission instructions; English is required initially. |
| `administratorUserId` | ID of an existing registered user. |
| `allowedRoomIds` | Non-empty, deduplicated array of existing room IDs. |
| `defaultRoomId` | Existing room ID included in `allowedRoomIds`. |
| `badgeAssetPath` | Site-local path to a webmaster-managed SVG asset. |
| `acceptingSubmissionsAfterCompletion` | Boolean controlling whether new work may begin after completion. |
| `reservationDurationHours` | Positive integer; defaults to 168 hours (seven days). |
| `medalThresholds` | Bronze, silver, and gold proportions; defaults to `0.25`, `0.50`, and `0.75`. |

Count quests additionally require `targetCount`, a positive integer. Set quests do not store an independently editable target; their target is the number of active quest items.

Quest lifecycle meanings:

- `draft`: not publicly listed and cannot accept claims or submissions.
- `active`: publicly listed and accepts work.
- `completed`: target has been reached at least once. It accepts new work only when `acceptingSubmissionsAfterCompletion` is true.
- `archived`: remains readable but accepts no claims, submissions, revisions, or reviews.

Completion is a lifecycle milestone, not proof that progress can never fall below the target later. Revocation may reduce live progress without automatically returning a completed quest to `active`; an administrator may do that explicitly.

### QuestItem

Quest items exist only for set quests.

| Field | Contract |
|---|---|
| `questId` | Parent quest ID. |
| `key` | Stable, non-empty item identifier unique within the quest, such as `tioga-pa`. |
| `label` | Initial display label, such as `Tioga, PA`. |
| `label_i18n` | Optional future-facing language map; falls back to `label`. |
| `active` | Allows an item to be retired without erasing history. |
| `reservedByUserId` | Current claimant, or null. |
| `reservedUntil` | Claim expiry, or null when there is no expiring claim. |
| `activeSubmissionId` | Current draft, review, or approved submission, or null. |
| `approvedSubmissionId` | Currently counted submission, or null. |

`questId + key` is unique. The item document is the serialization point for atomic claims: a claim succeeds only if the item has no approved submission, no active submission, and no unexpired reservation.

The UI may display derived item states (`available`, `reserved`, `draft`, `pending`, `changes-requested`, or `completed`), but these labels are not independently mutable domain state.

### QuestSubmission

| Field | Contract |
|---|---|
| `questId` | Parent quest ID. |
| `questItemId` | Required for set quests and absent for count quests. |
| `ownerUserId` | Registered user responsible for the submission workflow. |
| `blockId` | Exact language-specific qualifying block. |
| `blockGroupId` | Translation group captured from the qualifying block. |
| `status` | Submission state defined below. |
| `submittedAt` | Most recent review-request time, or null. |
| `approvedAt` | Most recent approval time, or null. |
| `approvedSequence` | Monotonic sequence assigned on approval for deterministic ties. |
| `reviewedBlockUpdatedAt` | Block revision timestamp considered by the most recent decision. |
| `contributorUserIds` | Deduplicated registered user IDs captured at approval. |
| `reviewHistory` | Append-only review and lifecycle events. |
| `createdAt`, `updatedAt` | Standard timestamps. |

Submission states:

- `draft`
- `pending`
- `changes-requested`
- `approved`
- `rejected`
- `withdrawn`
- `revoked`

At most one non-terminal submission may reference a block for a given quest. A block translation group does not establish uniqueness: the exact `blockId` qualifies, while other blocks sharing `blockGroupId` do not count. However, a set item can have only one active or approved submission regardless of language.

`rejected`, `withdrawn`, and `revoked` are terminal history records. A later attempt creates a new submission rather than mutating a terminal record back into use.

### Review history event

Each event records:

- event type
- actor user ID, or `system` for reconciliation and expiry
- timestamp
- prior and resulting submission states
- optional administrator comment
- block `updatedAt` observed by the action
- optional structured reason code

Review comments are required for `changes-requested` and `rejected`, optional for `approved`, and immutable after creation.

## Localization

Quest name, description, and instructions use database maps like rooms. Resolution order is:

1. requested UI language
2. English
3. first available translation
4. legacy scalar value only if one exists during migration

Application interface copy lives in English i18n namespaces from the first release. Quest slugs, item keys, room IDs, badge paths, and review states are never translated.

Item labels are plain strings initially. The optional `label_i18n` shape permits later translation without a migration.

## Authorization

### Public visitors

- May browse public quests, progress, approved posts, items, and leaderboards.
- May edit an in-progress quest post they can access under the ordinary block rules, including an unlisted post reached through its direct URL.
- May not claim items, own submissions, request review, review, revise an approved submission, or earn quest credit.

### Registered users

- May claim available items and create submissions while the quest accepts work.
- May own only submissions they initiate.
- May request review, withdraw, and initiate revision only for their own submissions.
- May collaborate on accessible quest posts under ordinary block rules.
- Receive credit only when their registered identity is present in the approval snapshot.

### Quest administrator

- Has all ordinary registered-user permissions.
- May view the private review queue for quests they administer.
- May approve, request changes, reject, and revoke submissions for those quests.
- May not review submissions for other quests merely because they administer one quest.

Quest creation and structural editing remain webmaster operations outside the public application UI in the first release.

## Claims and reservations

Claims apply only to set quests.

1. A registered user requests an available item.
2. The service atomically sets `reservedByUserId` and `reservedUntil` using the quest's reservation duration.
3. Claiming alone does not affect progress.
4. Creating the post and submission attaches `activeSubmissionId` to the item. The initial reservation deadline continues to apply while the submission is `draft`.
5. A claimant may voluntarily release a claim before review. If a post exists, the submission becomes `withdrawn`; the post remains ordinary site content.
6. A claim cannot be transferred. It must be released or expire and then be claimed by the other user.

Expiration behavior:

- Expiry is evaluated both lazily during claim-sensitive operations and by a maintenance job.
- An expired unattached claim is cleared.
- An expired `draft` submission becomes `withdrawn` with reason `claim-expired`; the item link and reservation are cleared. The post is not deleted or hidden.
- `pending`, `changes-requested`, and `approved` submissions do not expire.
- Requesting changes preserves the item for the submission owner without an expiry deadline.
- A race at the expiration boundary is settled by the database's atomic item update; only one claimant succeeds.

An owner whose draft expired may reclaim the item if it is still available and create a new submission for the existing eligible block.

Count quests do not use reservations or quest items.

## Post creation and eligibility

A quest post must:

- be created or attached by a registered submission owner;
- belong to an allowed room;
- be publicly visible under the site's existing block-visibility rule when submitted and while approved;
- identify one exact language-specific block;
- not already have a non-terminal submission to the same quest;
- target the claimed item for a set quest; and
- meet ordinary block validation.

The quest create flow prepopulates the default room, selected item title where applicable, and quest association. The server validates all context rather than trusting query or hidden form values.

A block is publicly visible for quest purposes when `isPubliclyVisibleBlock(block)` is true. In the current visibility model, that means either:

- `visibility` is `public`; or
- `visibility` is `unlisted` and `status` is `locked`.

There are no fully private posts in the current model. An unlisted in-progress post may be developed through its direct URL without appearing in public listings. Once locked, it becomes publicly visible and may be submitted without changing its `visibility` value.

Before review, an accessible in-progress post remains open to ordinary registered and anonymous collaboration. A submission owner may lock it using the existing post workflow.

Changing a post's room is not currently supported. If introduced later, moving a quest post outside `allowedRoomIds` makes it ineligible and triggers reconciliation.

## Submission state machine

### Draft to pending

The owner may request review only when:

- the quest accepts review actions;
- the block exists, is publicly visible, is in an allowed room, and is locked;
- the owner is still a registered valid user;
- the set item, if any, remains assigned to this submission; and
- no other active submission violates uniqueness.

The transition sets `pending`, captures `submittedAt` and the current block `updatedAt`, and notifies the administrator.

While pending, all content and metadata edits are blocked for every user, including the creator and edit-token holders. Deletion is also blocked through normal user actions. An administrator/system moderation path may still remove content and trigger revocation.

### Pending to changes requested

The administrator supplies a required comment. The post remains locked, the item remains exclusively assigned, and the owner is notified.

The owner may reopen editing. Reopening changes the submission to `draft`, keeps the item assignment without an expiry deadline, and restores ordinary block editing rules. Anonymous editing is therefore permitted again for anyone with access to the post. An unlisted post drops out of public listings while it is in progress but remains reachable through its direct URL.

After relocking, the owner may resubmit. Each resubmission records the new block revision and appends history rather than replacing earlier review events.

### Pending to rejected

The administrator supplies a required comment. The item reservation and active assignment are released immediately. The post remains locked ordinary content and may later be used in a new submission if it remains eligible and its item is available.

### Pending to approved

Approval is atomic from the domain's perspective:

1. Revalidate block existence, public visibility through `isPubliclyVisibleBlock`, allowed room, locked status, item assignment, and unchanged `updatedAt` since the review request.
2. Resolve the creator and collaborator usernames to registered users.
3. Deduplicate those user IDs and store the contributor snapshot. Anonymous IDs and unresolved/deleted users are omitted.
4. Include the registered creator even if the creator is not listed among collaborators.
5. Set approval timestamps, sequence, reviewed revision, and `approved` state.
6. For set quests, set the item's `approvedSubmissionId` and retain `activeSubmissionId`.
7. Notify the owner.
8. Recompute whether the quest has reached its target and mark it `completed` when appropriate.

Notification/email failure does not roll back approval. It is logged and may be retried independently.

### Withdrawal

The owner may withdraw a `draft`, `changes-requested`, or `pending` submission. Withdrawal releases a set item and leaves the post unchanged. Withdrawing a pending submission removes it from the administrator queue.

An approved submission cannot be withdrawn; it must be revised by the owner or revoked by the administrator/system.

### Revising an approved post

The approved post remains locked and immutable by default. Its owner receives a deliberate **Revise this post** action.

Starting revision:

- changes the existing approval record to `revoked` with reason `owner-revision`;
- immediately removes it from live progress, profiles, medals, and leaderboards;
- preserves its prior contributor snapshot and approval history for audit;
- retains the set item for the owner without expiry; and
- creates a new `draft` submission linked to the same block and item.

Ordinary editing then resumes, including anonymous editing for visitors who can access the post. An unlisted post leaves public listings while reopened. The revised post must be locked, become publicly visible under the normal rule, be submitted, and be approved again. The new approval receives a fresh contributor snapshot.

## External invalidation and reconciliation

An approved submission stops counting if its qualifying block is:

- deleted;
- administratively removed;
- moved outside the quest's allowed rooms in a future room-move feature; or
- otherwise no longer publicly visible according to `isPubliclyVisibleBlock`.

Changing a locked post's visibility from `public` to `unlisted` does not revoke approval because the post remains publicly visible. Likewise, an unlisted-and-locked post is fully eligible for approval and continued progress.

The submission becomes `revoked` with a structured reason. Its historical review and contributor snapshot remain stored, but only currently approved snapshots feed public aggregates. For set quests, the item becomes available again unless an administrator explicitly retires it.

Restoring public visibility or recreating content does not silently restore a revoked approval. A new claim/submission and review are required.

The primary block mutation paths must invoke reconciliation synchronously. A periodic reconciliation job may additionally repair inconsistencies caused by direct database or legacy administrative changes.

Pending submissions whose post becomes ineligible are revoked and removed from the review queue. Draft or changes-requested submissions whose post is deleted are withdrawn. Unlisted drafts remain attached and may be edited through their direct URLs; locking them makes them publicly visible and eligible for submission.

## Progress and completion

Live progress is computed from eligible `approved` submissions:

- count quest: `approved submission count / targetCount`
- set quest: `items with a current approved submission / active item count`

Progress cannot exceed 100% for display. Count quests may still report the raw approved count above the target when post-completion contributions are enabled.

Drafts, claims, pending reviews, requested changes, rejected submissions, withdrawn submissions, revoked submissions, and translations never increase progress.

When completion disables further contributions, no new claim or draft may begin after completion. Work already pending at the moment the target is reached may still be reviewed and approved. Administrators may continue resolving their existing queue.

## Contribution credit, badges, and leaderboards

Each currently approved submission gives one contribution to every user in its contributor snapshot. Creator and collaborator credit are identical. A user receives at most one contribution per submission.

Profile and leaderboard counts are derived from current approvals rather than stored on user documents.

Badge rules:

- one or more contributions earns the base quest badge;
- bronze requires contributions greater than or equal to 25% of the quest target;
- silver requires contributions greater than or equal to 50%;
- gold requires contributions greater than or equal to 75%.

Threshold counts use ceiling arithmetic. For example, a target of 10 requires 3 contributions for bronze, 5 for silver, and 8 for gold. Only the highest earned variant is displayed as the primary badge, though the UI may describe prior tiers.

For set quests, the denominator is the current number of active items. For count quests, it is `targetCount`. Structural target changes are webmaster actions and may change current badge tiers; historical awards are not permanently vested in the first release.

Leaderboard ordering is:

1. contribution count descending;
2. time the user reached their current contribution count ascending;
3. normalized username ascending.

The second value is derived from approval order/timestamps for the user's currently counted submissions. `approvedSequence` breaks equal-timestamp ties deterministically.

Anonymous collaborators, unresolved usernames, translations, and contributions on revoked approvals do not appear.

## Notifications and review queue

Required notification events:

- review requested to quest administrator;
- changes requested to submission owner;
- submission approved to submission owner;
- submission rejected to submission owner;
- submission revoked to submission owner; and
- claim nearing expiry or expired to submission owner, if expiry reminders are enabled.

Quest notifications require typed quest/submission references rather than overloading comment fields. In-app notification creation is part of the action; email delivery is best-effort and non-transactional.

The private administrator panel lists pending submissions only for quests administered by the current user. It includes the quest, item, post link, owner, submission time, current revision, and prior review history. Every review endpoint rechecks authorization and current submission state.

## Badge assets

- Badge artwork is stored as static, webmaster-managed SVG files in the application assets.
- MongoDB stores only a validated site-local asset path.
- Paths must remain under the configured quest badge asset directory and may not be external URLs or traversal paths.
- Bronze, silver, and gold may use dedicated static variants or a controlled presentation treatment. Arbitrary SVG/XML is never rendered from database content.
- Every badge requires localized accessible alt text generated from quest name and tier UI strings.

## Service contracts

All mutation services return the resulting domain object and throw typed errors suitable for mapping to HTTP status codes. All services re-read authoritative records and enforce authorization; routes do not implement domain rules independently.

### `claimQuestItem({ questId, itemId, userId, now })`

- Requires an active/accepting set quest and registered user.
- Atomically claims an available active item.
- Returns item plus reservation deadline.
- Errors: not found, quest closed, wrong quest type, item unavailable.

### `releaseQuestItem({ questId, itemId, userId, now })`

- Requires the current claimant/owner.
- Clears an unattached claim or withdraws the attached eligible submission.
- Errors: not found, forbidden, invalid state.

### `createQuestSubmission({ questId, itemId?, blockId, ownerUserId, now })`

- Validates quest type, ownership of any claim, block eligibility, room, and uniqueness.
- For set quests, atomically attaches the submission to the claimed item.
- For count quests, requires no item.
- Returns the draft submission.

### `submitQuestSubmission({ submissionId, ownerUserId, now })`

- Validates ownership, quest availability, block eligibility and lock, assignment, and state.
- Transitions draft to pending and records block revision.
- Creates administrator notification.

### `requestQuestSubmissionChanges({ submissionId, administratorUserId, comment, now })`

- Requires the quest administrator and pending state.
- Requires a comment and transitions to changes-requested.
- Preserves item assignment and creates owner notification.

### `reopenQuestSubmissionDraft({ submissionId, ownerUserId, now })`

- Requires owner and changes-requested state.
- Transitions to draft without an expiry deadline and restores eligible editing.

### `approveQuestSubmission({ submissionId, administratorUserId, comment?, now })`

- Requires the quest administrator and pending state.
- Revalidates unchanged eligible block revision.
- Atomically records approval/item completion and contributor snapshot.
- Creates owner notification and evaluates quest completion.

### `rejectQuestSubmission({ submissionId, administratorUserId, comment, now })`

- Requires the quest administrator, pending state, and comment.
- Releases item assignment and creates owner notification.

### `withdrawQuestSubmission({ submissionId, ownerUserId, now })`

- Requires owner and a withdrawable state.
- Releases item assignment and removes pending work from review.

### `startApprovedSubmissionRevision({ submissionId, ownerUserId, now })`

- Requires owner and approved state.
- Revokes the approval and creates a replacement draft while retaining the set item.
- Returns both historical approval and replacement draft.

### `reconcileQuestSubmissionForBlock({ blockId, reason, actorUserId?, now })`

- Called by deletion, visibility, and moderation paths.
- Revokes or withdraws affected submissions according to state.
- Releases set items where required and creates notifications.
- Is idempotent.

### `expireQuestClaims({ now, limit })`

- Clears expired unattached claims and withdraws expired drafts in bounded batches.
- Is safe to retry and records system history.

### Read services

- `getQuestBySlug({ slug, uiLang })`
- `listPublicQuests({ uiLang, page, limit })`
- `getQuestProgress({ questId })`
- `listQuestItems({ questId, state?, query?, page, limit, uiLang })`
- `listApprovedQuestPosts({ questId, page, limit, preferredContentLang? })`
- `getQuestLeaderboard({ questId, page, limit })`
- `getUserQuestContributions({ userId })`
- `listAdministratorReviewQueue({ administratorUserId, questId?, page, limit })`

Read services expose DTOs and do not leak private review comments outside the owner/administrator context.

## Required database constraints and indexes

- Unique quest slug.
- Unique quest item `{ questId, key }`.
- Index quest items by quest, active flag, reservation deadline, and approved state.
- Index submissions by quest and status for progress/review queues.
- Index submissions by owner and status.
- Index submissions by exact block ID and quest.
- Index contributor snapshots by user ID and approved status.
- Use the quest item document's conditional atomic update to enforce one live assignment; do not rely solely on a preflight read.
- Assign approval sequence atomically per quest or via another monotonic deterministic mechanism.

MongoDB transactions should be used where available for transitions that update a submission, item, and quest together. Services must still use conditional filters so retrying an operation cannot duplicate approval or credit.

## Error vocabulary

Domain errors should use stable codes, including:

- `QUEST_NOT_FOUND`
- `QUEST_NOT_ACCEPTING_SUBMISSIONS`
- `QUEST_ARCHIVED`
- `QUEST_TYPE_MISMATCH`
- `QUEST_ITEM_NOT_FOUND`
- `QUEST_ITEM_UNAVAILABLE`
- `QUEST_CLAIM_EXPIRED`
- `QUEST_SUBMISSION_NOT_FOUND`
- `QUEST_SUBMISSION_INVALID_STATE`
- `QUEST_SUBMISSION_BLOCK_INELIGIBLE`
- `QUEST_SUBMISSION_BLOCK_CHANGED`
- `QUEST_SUBMISSION_DUPLICATE`
- `QUEST_REVIEW_COMMENT_REQUIRED`
- `QUEST_FORBIDDEN`

Human-facing messages are localized at the route/UI boundary rather than embedded in domain services.

## Minimum domain test matrix

Tests must cover:

- quest validation for both types, rooms, localization, thresholds, and assets;
- simultaneous claims where exactly one succeeds;
- lazy and scheduled claim expiration;
- draft expiry without post deletion;
- changes requested preserving an item indefinitely;
- only registered users claiming/submitting/earning credit;
- ordinary anonymous collaboration before pending review;
- every allowed and forbidden submission transition;
- edit and delete blocking while pending;
- approval failure when the reviewed block revision changed;
- exact-language block counting and translation non-counting;
- creator/collaborator resolution, deduplication, and anonymous exclusion;
- rejection, withdrawal, revision, and revocation releasing or retaining items correctly;
- deletion or loss of public visibility removing progress and credit, while unlisted-and-locked posts remain eligible;
- completion behavior with post-completion contributions on and off;
- badge ceiling arithmetic and tier changes after revocation;
- deterministic leaderboard ties;
- administrator isolation between quests;
- retry/idempotency behavior for approval, reconciliation, and expiry; and
- localization fallback without exposing untranslated domain codes.

## Initial quest configuration example

The virtual road trip quest is expected to use:

```text
type: set
defaultRoomId: united-states
allowedRoomIds: [united-states]
reservationDurationHours: 168
acceptingSubmissionsAfterCompletion: configurable
medalThresholds: bronze 0.25, silver 0.50, gold 0.75
```

Its county and county-equivalent list is imported as quest items with stable keys and labels. The import must reject duplicate keys and be safely repeatable without overwriting live assignments or review history.
