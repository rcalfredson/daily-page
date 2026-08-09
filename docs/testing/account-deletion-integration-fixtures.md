# Account deletion integration fixtures

This workflow creates disposable, deterministic records in `daily-page-test` for manually testing
the account-deletion UI and its cross-record cascade. It never supports the production database
name and every mutating command requires `--write`.

The script resets only the selected fixture scenario. It does not wipe unrelated test data.

## Fixture contents

Each disposition has an isolated scenario containing:

- an owner account to delete, a peer account, and an observer account;
- public in-progress, public locked, locked unlisted, in-progress unlisted, and legacy
  username-owned posts;
- peer-owned posts and a cross-owner translation of an owner source;
- owner and peer collaborator references and votes;
- top-level comments and replies whose deletion behavior differs;
- notifications addressed to the owner, created by the owner, attached to owner posts, and a
  surviving notification whose actor must be scrubbed;
- reactions, moderation flags, comment reports, and a short-lived rate-limit event;
- a second authentication session for the owner;
- collaboration session and backup mappings for owned and peer posts;
- one active owner forest with three durable writing trees; and
- an archived quest owned by the fixture account, optionally made active to test the administrator
  deletion guard.

Fixture titles and usernames include the scenario name. Object ids are deterministic, so reseeding
produces the same post URLs.

## Prerequisites

Run the script with the same MongoDB configuration used by the dev instance. The connected database
must resolve to exactly `daily-page-test`. The script refuses to run if `NODE_ENV=production` or
`USE_PRODUCTION_DB` is enabled.

Node 24 should be selected through `nvm`:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24
```

The default password for every fixture account is:

```text
DeletionFixture!2026
```

Set `ACCOUNT_DELETION_FIXTURE_PASSWORD` before seeding to use another password. The seed command
prints the actual fixture username, password, security-page URL, and relevant post URLs.

## Test one disposition

Replace `<scenario>` with `delete`, `deleted-author`, or `anonymous`.

1. Reset and seed the scenario:

   ```bash
   npm run account-deletion:fixture -- seed <scenario> --write
   ```

2. Confirm the starting state:

   ```bash
   npm run account-deletion:fixture -- verify-before <scenario>
   ```

3. Log into the dev instance using the printed owner credentials.

4. Inspect the printed post links and the account-security deletion panel.

5. Delete the account using the disposition matching the scenario name.

6. Confirm the final database state:

   ```bash
   npm run account-deletion:fixture -- verify-after <scenario>
   ```

`verify-after` exits nonzero if any expected cascade outcome fails. It checks the User and deletion
request, username quarantine, retained/deleted posts, ownership and edit tokens, legacy ownership,
translation ancestry, collaborators, votes, comments and replies, notifications, reactions,
moderation records, rate-limit events, auth-session revocation, collaboration state, and quest
administrator cleanup. It also verifies that bounded Activity Forest cleanup completed before the
deletion request received its evidence-expiry time.

For a database-only integration run that bypasses password/2FA confirmation and the browser UI,
invoke the real deletion service directly:

```bash
npm run account-deletion:fixture -- seed anonymous --write
npm run account-deletion:fixture -- delete-direct anonymous --write
npm run account-deletion:fixture -- verify-after anonymous
```

`delete-direct` exercises the transactional cascade and the Activity Forest cleanup boundary. It
acquires the real transactional forest fence, verifies that deletion changes the world to
`deleting`, drains three trees across deliberately small bounded cleanup passes, verifies that
evidence expiry remains unset while cleanup is pending, completes the owner-world removal, checks
an additional cleanup pass is idempotent, and proves that the fence fails closed after the owner is
deleted. It does not replace the manual HTTP authorization and UI test.

## Test transactional Activity Forest tree creation

The same disposable fixture can exercise the real writing-tree transaction independently of
account deletion:

```bash
npm run account-deletion:fixture -- seed anonymous --write
npm run account-deletion:fixture -- create-tree-direct anonymous --write
npm run account-deletion:fixture -- reset anonymous --write
```

`create-tree-direct` clears only the seeded owner's forest ledger, then verifies an initial tree
creation, an idempotent retry, full rollback after a deliberately failed projection, and two
concurrent requests converging on one durable tree identity. It then exercises deactivation,
idempotent inactivity, same-tree reactivation, malformed-evidence preservation, and the
zero-tree/zero-founder case. It checks that identity, projection, placement, the owner-world cursor,
tree revisions, and the account fence change only where their contracts allow. Finally, it verifies
durable owner/group queue deduplication, lease completion, transient retry state, recovery, queue
drain, and enqueue ordering through the account-deletion fence. It then deletes one source Block
without an event and proves the cursor-based convergence sweep enrolls missing historical groups,
deactivates the unseen tree, and completes the owner-world epoch over bounded pages.

To start the same scenario again, rerun its seed command. To remove it without reseeding:

```bash
npm run account-deletion:fixture -- reset <scenario> --write
```

## Test bounded writing and large-forest pressure

The 55-tree pagination and 600-tree pressure profiles must be run from separately reseeded fixture
scenarios so that their measurements do not accumulate into one larger, ambiguous history.

To exercise three forward and backward writing pages:

```bash
npm run account-deletion:fixture -- seed anonymous --write
npm run account-deletion:fixture -- seed-forest-pagination anonymous --write
```

To create 600 disposable eligible owner groups through the production reconciliation service and
measure the resulting private forest:

```bash
npm run account-deletion:fixture -- seed anonymous --write
npm run account-deletion:fixture -- seed-forest-pressure anonymous --write
```

Run the development server with scheduled background work disabled before seeding this profile:

```bash
DISABLE_BACKGROUND_JOBS=true npm start
```

The pressure command performs every exact owner/group reconciliation directly, so disabling the
scheduled queue and convergence workers does not skip tree creation. It prevents the periodic
whole-world convergence sweep from claiming the newly seeded world during the several-minute bulk
setup and temporarily replacing the forest with its reconciling state. Disabling background jobs
after a sweep has already started will not complete that sweep; either let the normally configured
worker finish first or reseed after restarting with background jobs disabled.

The pressure command reports only aggregate synthetic evidence:

- source status, visibility, and language counts;
- Block-upsert and per-group reconciliation timings and outcomes;
- occupied spatial-cell count, span, and occupancy percentiles;
- complete bounded writing-page counts, bytes, omissions, and timing samples;
- center, densest, and outer signed 3-by-3 regional page counts, placements, bytes, and timings; and
- one authorized batch of at most 24 lossless-raster assets measured cold and warm in the fixture
  process.

The command verifies that every pressure Block has one active visible durable tree, writing cursors
return every active visible tree without duplication, each regional request remains within the
production 250-placement page bound, and both asset passes return every authorized key. Exact
titles, owner ids, group ids, tree ids, positions, asset keys, routes, and cursors are not printed.

The fixture process starts with empty process-local tree and raster caches, so the first asset pass
is the local cold sample and the immediately repeated pass is the warm sample. These timings are
diagnostic baselines for the named machine, not universal latency budgets. Browser network,
preparation, frame, memory, and travel behavior should still be reviewed manually against the
seeded `/en/forest` route.

Reseeding or resetting the scenario removes both pressure records and their forest ledger:

```bash
npm run account-deletion:fixture -- reset anonymous --write
```

## Test the active-quest guard

Seed any scenario with an active quest:

```bash
npm run account-deletion:fixture -- seed deleted-author --active-quest --write
```

The first deletion attempt should remain on the account-security page and explain that active quest
administration must be transferred or archived. Confirm the owner account still exists:

```bash
npm run account-deletion:fixture -- verify-before deleted-author
```

Archive the fixture quest:

```bash
npm run account-deletion:fixture -- archive-quest deleted-author --write
```

Retry deletion, then run `verify-after deleted-author`.

## Suggested manual UI checklist

- All user-facing copy says “post,” not “Block.”
- The three choices are distinguishable without relying only on color.
- The immediate and irreversible nature of deletion is clear.
- Locked unlisted retention and in-progress unlisted deletion are explained.
- Password, optional second-factor, and literal `DELETE` confirmation fields are understandable.
- Validation and active-quest errors are announced visibly.
- The submit button cannot be accidentally double-submitted.
- After success, the session is gone and authenticated pages require login.
- `Deleted author` attribution is localized plain text with no profile link.
- Anonymous attribution links only to the protected `/users/anonymous` presentation page.
- Retained posts offer no edit route or collaborator mutation path.
- Deleted post URLs return not found.
- Peer and observer control content still renders normally.

## Safety notes

- There is intentionally no `--prod` option.
- A mutating command without `--write` fails before connecting.
- Reseeding removes prior fixture-created sessions and records for that scenario, including records
  created manually by its deterministic accounts.
- The script uses invented `example.invalid` addresses and does not send email.
- The fixture does not upload profile media or call S3.
