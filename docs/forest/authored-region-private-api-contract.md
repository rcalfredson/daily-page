# Authored-region reader and private API contract

Pass 5 exposes the already-accepted authored-overlay protocol through a separate bounded reader and
three authenticated mutation routes. Generated ground, writing-tree regions, and authored markers
remain separate payloads and services.

The product policy in
[`account-backed-authored-overlay-contract.md`](account-backed-authored-overlay-contract.md) remains
authoritative. This document records the implemented transport and operational defenses.

## Authored-region read

`GET /api/v1/forest/authored-regions` accepts only `cells`, optional `cursor`, and optional `limit`.
Cells use the existing canonical comma-separated `cellX:cellY` form. The service accepts one through
nine unique signed cells, defaults to 100 objects, and permits at most 250.

The service derives the owner from the authenticated session, loads the exact primary world, and
returns one of `not-established`, `reconciling`, `resetting`, or `ready`. A ready response contains:

- authored manifest version and 720-unit spatial-index identity;
- canonical requested regions and their exact revision values;
- active render-safe marker identity, placement, fixed appearance, record revision, and change time;
  and
- a bounded page count and opaque continuation.

Owner ids, forest ids, fingerprints, world-version evidence, tombstones, Mongo ids, writing data,
and nearby private records never cross this boundary.

For every ready page, the reader loads the exact cell-revision vector, reads `limit + 1` active rows
ordered by object id, and reads the vector again. The continuation binds the canonical cell set,
the vector fingerprint, and the last object id. A changed vector before or after row selection fails
as `FOREST_AUTHORED_REGION_CHANGED`; the caller must discard that page sequence and restart. Missing
revision evidence for an active object and unsupported object, world, reset, or revision versions
fail closed as migration-required. Reset state is checked before and after selection so a reset that
starts mid-read cannot return a misleading ready page.

## Mutation routes

The private routes are:

```text
PUT   /api/v1/forest/authored-objects/:objectId
PATCH /api/v1/forest/authored-objects/:objectId/placement
POST  /api/v1/forest/authored-objects/:objectId/removal
```

They accept exactly the version-1 bodies recorded in the primary contract. Unknown fields,
malformed UUIDs, unsupported kinds or protocol versions, unsafe coordinates, and invalid revisions
fail before rate limiting or authored-state queries. The owner and active auth-session id come only
from authenticated request context.

All forest API responses remain `Cache-Control: private, no-store` and `Vary: Cookie`. Mutation
routes additionally require an `application/json` request whose `Origin` exactly equals the request
origin. The check does not treat the broader CORS allowlist or cookie `SameSite` policy as proof of
same-origin intent.

Errors distinguish invalid input, rate limiting, current-object conflict, collision, density,
resetting, and migration-required states using bounded codes. Absence and removed-object access use
the generic owner-scoped object-unavailable boundary. Collision responses contain no nearby identity.
Unexpected logs contain only the error class and a bounded failure code.

## Operational rate protection

The prototype limiter uses hashed transient owner and auth-session keys. One fixed 60-second window
permits 30 mutations per owner and 20 per session. Its map is capped at 10,000 buckets, prunes expired
entries, and fails closed rather than evicting active protection. A limited response includes a
bounded `Retry-After` value.

These thresholds are rollout settings, not object capacity, entitlement, or gameplay policy. The
limiter is deliberately process-local for the current single-process prototype and resets on
restart. A multi-process deployment must replace it with a shared bounded limiter before claiming a
deployment-wide threshold; the service-level collision, identity, and transaction authority does not
depend on the limiter.

## Verification

Focused service tests cover canonical cells, zero and positive revisions, stable continuation,
cell changes before and after selection, reset races, malformed evidence, unsupported versions, and
bounded query results. API tests cover stale authentication, forged authority, exact bodies,
same-origin JSON, private caching, rate limits, non-enumerating errors, and privacy-safe logs.

The guarded `daily-page-test` fixture additionally proves real-Mongo stable continuation,
removal-driven cursor invalidation, cross-owner isolation, and fail-closed unsupported records. See
[`forest-authored-mutation-integration-fixture.md`](../testing/forest-authored-mutation-integration-fixture.md).
