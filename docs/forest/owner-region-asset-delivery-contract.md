# Owner region asset-delivery contract

## Purpose

The owner region asset boundary turns a bounded set of currently authorized regional asset keys
into visual tree assets. It does not trust a key merely because the browser received it earlier,
and it does not attach writing, ownership, placement, or inspection metadata to the generated
asset or its shared process cache.

The private endpoint is:

```text
GET /api/v1/forest/assets?cells=-1:1,0:1&assetKeys=key-1,key-2&transport=color-runs
```

`cursor` is also accepted when the keys came from a continued regional placement request. Every
query value must be URL encoded normally.

## Request bounds

One request contains:

- one through nine exact canonical regional cells;
- one through 24 unique complete current asset keys;
- the regional placement cursor that authorized those keys, or no cursor for the first page; and
- either `color-runs` or `lossless-raster`, defaulting to `color-runs`.

Twenty-four is a production generation and payload bound, not a forest, region, or cache-size
limit. A placement page may contain as many as 250 trees. The browser can request additional
bounded asset batches as trees enter its preparation window.

Malformed keys, duplicate keys, unsupported asset/renderer prefixes, repeated query scalars,
unknown query fields, unsupported transports, and excessive counts fail before regional
authorization or tree generation.

## Current authorization flow

The endpoint derives the owner only from the current authenticated session. A supplied owner id or
username is rejected as an unknown field. Missing, expired, revoked, or otherwise stale sessions do
not enter the delivery service.

Delivery then performs these bounded steps:

1. Re-read the exact owner-region placement manifest for the requested cells and cursor, using its
   maximum 250-placement page bound.
2. Require every requested key to appear in that current authorized manifest page. The entire
   request fails if any key is absent; invented and cross-owner keys receive the same response.
3. Select one opaque writing-tree id for each authorized visual key and query only those trees,
   scoped to the exact owner, active lifecycle, and visible state.
4. Revalidate ledger, tree identity, lifecycle, and projection versions. A tree that disappeared,
   became inactive/hidden, or changed unsupported identity between the two reads fails closed.
5. Reconstruct the pure projected-tree input from the minimum durable projection fields.
6. Generate or reuse the runtime asset and require its complete cache key to equal the requested
   authorized identity before and after transport encoding.

The second tree read is necessary because the placement manifest intentionally does not expose the
specimen seed or complete durable projection. It is bounded by the 24-key request and projects no
founding Block, group, translation, title, route, or body evidence.

## Shared visual caches

The existing process-local runtime and lossless-raster caches remain keyed by the complete visual
asset identity:

```text
asset schema + renderer/version + phenotype/version + seed + visual projection fingerprint
```

The cached value contains derived dimensions, bounds, anchors, layers/pixels, and visual identity.
It contains no owner id, forest id, tree id, Block/group id, content, route, or authorization state.
Authorization is therefore repeated before cache access, while the successfully authorized visual
result can still be reused across requests with identical visual identity.

## Response and failure behavior

A ready response contains only:

```text
assetDeliveryVersion
status
transport
assetContract
assets
```

Server preparation timings, cache-hit diagnostics, projection explanations, and private identifiers
are not returned. `not-established` and `reconciling` remain honest `200` responses with no assets.
Every response is `private, no-store` and varies on `Cookie` because delivery depends on current
session authorization even though the resulting visual bytes contain no private metadata.

Malformed requests receive generic `400 INVALID_FOREST_ASSET_REQUEST`. A well-formed key that is
not currently authorized or whose backing projection became unavailable receives generic
`404 FOREST_ASSETS_UNAVAILABLE`. Unexpected infrastructure or unsupported durable-state failures
receive `503 FOREST_ASSET_DELIVERY_UNAVAILABLE`. Response bodies and route logs omit the underlying
private identity and validation detail.

## Production browser consumer

The private production `/forest` page now chooses a signed 3×3 neighborhood around its centered
player, fetches placement pages to completion, requests only missing asset keys in batches of 24,
and prepares lossless raster sprites with yields between assets. Empty, reconciling, unavailable,
no-JavaScript, reduced-motion, keyboard, touch, and regional-failure behavior remain explicit.

Writing recognition remains a separate reauthorized inspection endpoint. Possession of an asset
key, visual asset, placement manifest, or previously rendered tree grants no writing access.

## Verification

`spec/forestOwnerRegionAssetDeliverySpec.js` verifies input bounds, honest empty states, exact
regional reauthorization, minimum projection reads, lifecycle races, asset-key preservation,
privacy-safe output, and real projected-asset reconstruction. `spec/forestOwnerRegionApiSpec.js`
verifies current-session authority, exact query parsing, forged-owner rejection, generic failure
responses, and private cache headers at the HTTP boundary.
