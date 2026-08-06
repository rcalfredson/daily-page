# Owner non-canvas forest read contract

## Scope

`GET /forest/writing` is the first production-facing Activity Forest read surface. It is an
authenticated, server-rendered alternative to canvas exploration that lets an owner recognize the
writing currently represented in their forest and follow its canonical post link. It does not
render the production forest scene, inspect foreign translations, mutate tree state, or establish
navigation entry points elsewhere in the site.

The initial player-facing presentation calls this collection the owner's **writing grove**. Cards
use current title, localized room and date context, a human-readable language only when it differs
from the interface language, and the durable tree type and creation season. A bounded decorative
species treatment gives the view forest identity without generating unique tree imagery through a
second temporary renderer. Full tree visuals must later reuse the production forest asset path.

## Authorization and delivery

- The owner key comes only from the authenticated session. Query parameters never select an owner.
- Every response, including redirects and failures, receives `Cache-Control: private, no-store` and
  varies on `Cookie`.
- The owner-world, tree page, and current Blocks are independently constrained to the same owner.
- The page never renders owner ids, translation-group ids, founding evidence, placement slots,
  projection fingerprints, or specimen seeds.
- Current canonical post paths are created only after the selected Block passes the current owner,
  lifecycle, room, language, and date checks.

## Bounded read behavior

The service reads at most 25 tree ledger rows by default and 50 when used with an explicit bounded
limit. Rows are ordered by immutable placement slot and opaque tree identity. A versioned opaque
cursor carries a forward or backward continuation point; there is no silent truncation. Pages may
therefore continue through an arbitrary number of bounded reads while exposing both earlier and
later navigation whenever those directions are available.

For each tree page, the current writing lookup retains at most three bounded candidates per owner
group: the preferred-language owner variant, the current founding owner variant, and the earliest
eligible owner fallback. A database aggregation chooses the earliest candidate without returning
the complete translation history to application memory.

Hidden and inactive trees are excluded at the tree query. If a ledger tree no longer has a current
eligible owner Block, it is omitted rather than restoring stale writing from founding evidence.

## Honest states and failures

- `not-established`: no primary owner world exists yet; the page shows an empty onboarding state.
- `reconciling`: the owner sweep is running; the page does not claim a partial list is complete.
- `ready`: a bounded current page can be shown, including an honestly empty page.
- malformed cursor: HTTP 400 with a restart link and no private database query.
- unsupported, deleting, or incoherent durable state: HTTP 503 with generic non-enumerating copy.

Unknown schema and identity versions fail closed. Logs name only the error class at this boundary;
they do not include owner, tree, group, Block, title, or route values.

## Deferred work

The production canvas scene and regional routes, dedicated tree inspection, hide/unhide controls,
site navigation entry, richer multilingual translation discovery, and final visual design remain
separate Milestone 2 work. Those surfaces should reuse this service's session-owned, current-source,
bounded-read boundary rather than treating a previously loaded scene as authorization.
