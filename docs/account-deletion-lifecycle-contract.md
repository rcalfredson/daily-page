# Account deletion lifecycle contract

## User promise

Account deletion is immediate and irreversible. It requires an authenticated session, the current
password, the literal confirmation `DELETE`, and a current authenticator or recovery code when
two-factor authentication is enabled. The operation revokes every account session.

The person chooses one global disposition for authored posts:

| Choice | Public posts | Locked unlisted posts | In-progress unlisted posts |
| --- | --- | --- | --- |
| Delete posts | Deleted | Deleted | Deleted |
| Deleted author | Retained as `Deleted author` | Retained as `Deleted author` | Deleted |
| Anonymous | Retained as `anonymous` | Retained as `anonymous` | Deleted |

The application treats locked unlisted posts as published posts. In-progress unlisted posts are
never retained. A future private visibility state must also default to deletion until this contract
is deliberately revised.

Retained posts have no `userId` or edit token and have an explicit non-live `authorshipState`.
They cannot be managed by a later account, a collaborator, an old edit-token cookie, or username
fallback. `Deleted author` attribution is localized plain text with no profile link. Anonymous
attribution links to the protected `/users/anonymous` presentation page, but that link represents
no owner account, stable author identity, or edit authority.

## Authoritative lifecycle

`AccountDeletionRequest` is the bounded lifecycle record. Within one MongoDB transaction the
service:

1. verifies that the user still exists and does not administer an active quest;
2. creates the processing request and a 365-day exact-username reservation;
3. applies the chosen post disposition;
4. reconciles dependent database records;
5. revokes all authentication sessions;
6. deletes the User record; and
7. marks the request complete with aggregate post counts.

The transaction is all-or-nothing. A database error leaves the account and its sessions intact, so
the authenticated person may safely retry. The unique request-per-owner constraint and the User
delete guard prevent duplicate completion. Completed request evidence becomes eligible for expiry
only after required profile-media and Activity Forest cleanup reach terminal states, then expires
after 90 days.

The request's `processing` and `completed` states and bounded `forestCleanup` subdocument are the
Activity Forest cleanup boundary. New requests explicitly begin with forest cleanup `pending`;
pre-forest historical requests default to `not-required`. Account deletion marks any owner-world
root as deleting and clears its reconciliation lease inside the bounded account transaction. A
worker then deletes writing trees in bounded owner-keyed batches, removes the small owner-world
root, verifies both collections are empty, and marks cleanup `completed`. Retries are idempotent.

Future forest write transactions must increment `User.forestLedgerFence` before writing. Deleting
that same User record creates a Mongo write conflict: reconciliation either commits before deletion
and is subsequently cleaned, or cannot commit after deletion. Forest ownership is never inferred
from a retained post or username.

## Database cascade

- Exact `Block.userId` ownership is authoritative. A legacy post with no user id and an exact
  creator-username match is also included so it cannot transfer to a later username holder.
- Retained posts lose ownership and edit capability. Deleted post ids are removed from translation
  ancestry and editorial relationships. Translation `originalAuthor` values matching the deleted
  username are removed.
- The username is removed from every collaborator array. Votes are removed and `voteCount` is
  recomputed.
- Authored comments and replies that cannot survive their deleted top-level thread are deleted.
  Comment reports for deleted comments and reports made by the account are deleted.
- Reactions and short-lived rate-limit events for the account are deleted. Moderation flags retain
  their moderation content but lose the reporter username.
- Notifications addressed to the account or pointing at deleted posts/comments are deleted.
  Surviving notifications lose the deleted actor id.
- Quest claims are released. Draft, pending, and changes-requested submissions are revoked.
  Submissions whose post is deleted are also revoked. An approved submission attached to a
  retained post remains approved as historical progress, but loses owner/contributor identity.
  Review events retain workflow history but change the deleted user actor to a system actor.
  Non-active quests lose the deleted administrator id; active quest administration must be
  transferred or archived before deletion.
- Collaborative session and collaboration-backup mappings for every owned post are removed,
  including retained posts, so stale live-editing state cannot survive ownership removal.
- All in-process application caches are cleared after commit.
- Activity Forest access ends with session/User removal. Any existing owner-world root is marked
  deleting in the transaction; writing trees and the root are removed afterward through bounded,
  verified cleanup independent of source-post disposition.

## Username reuse

The exact deleted username is unavailable for 365 days. Before a username can return to the pool,
all authorization-bearing references to it are removed. Ownership checks for retained posts also
reject non-live `authorshipState` values, so reuse cannot restore ownership even after quarantine.

Old external links to `/users/{username}` may resolve to a different person after the quarantine.
That is an accepted presentation tradeoff and must never be treated as historical identity proof.

## Profile media

MongoDB and S3 cannot share a transaction. After database completion, an idempotent cleanup pass
deletes all objects under the app-owned `profile-pics/{ownerUserId}-` prefix. Only a current
profile URL matching the configured Daily Page bucket and region authorizes that prefix cleanup.
Failures remain `pending` and the hourly job retries them; logs include only status, attempt count,
and error class.

Deletion evidence does not receive its TTL expiry while managed profile cleanup or Activity Forest
cleanup remains pending. `none`, `deleted`, and `not-managed` are terminal profile-media states;
`completed` and `not-required` are terminal forest states. Whichever cleanup finishes last performs
one atomic convergence check and schedules expiry without extending an already scheduled record.
A separate bounded hourly convergence pass retries the expiry update if cleanup reached terminal
state but that final scheduling write was temporarily unavailable.

Externally hosted or unrecognized profile URLs are marked `not-managed`. They require action by
the external operator and are not covered by the application deletion promise.

## Operational dependencies and limits

This repository does not establish the retention or deletion schedule for MongoDB provider
backups, S3 versioning and lifecycle rules, CDN copies, infrastructure logs, email-provider
records, Stripe customer/payment records, support exports, or separately produced data exports.
Production rollout requires owners and tested expiry/restoration procedures for each system.

A backup restoration must not silently recreate a deleted account. Restore runbooks must replay
unexpired deletion evidence or an equivalent separately retained suppression ledger before the
restored service accepts traffic. The 90-day application evidence window is not itself a complete
backup policy.

No code path should log usernames, emails, content, profile URLs, raw resource ids, credentials, or
tokens as deletion diagnostics. Production aggregate audits require separate explicit
authorization and must suppress small buckets.
