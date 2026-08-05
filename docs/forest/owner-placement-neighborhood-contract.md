# Owner placement-neighborhood adapter contract

## Purpose

The pure owner-grove allocator accepts a bounded array of occupied placement summaries. Production
must supply that array without loading an owner's complete lifelong forest. The placement-
neighborhood adapter converts one candidate slot into an owner-scoped, bounded spatial database
read containing only the summaries that can affect that candidate.

The adapter performs no write, creates no tree, and grants no authority. Its `ownerUserId` must come
from an already authorized server workflow.

## Spatial index version 1

Version 1 divides the signed ground plane into fixed 720-unit square cells:

```text
cellX = floor(worldX / 720)
cellY = floor(worldY / 720)
```

`Math.floor` preserves adjacency across negative coordinates. The cell is replaceable derived
indexing; `placement.slot`, `placement.worldX`, and `placement.worldY` remain immutable authority.

Writing trees add the dedicated owner-first index:

```text
ownerUserId
placementIndex.cellX
placementIndex.cellY
writingTreeId
```

The lifecycle-oriented spatial index remains available for scene reads. Placement uses the
dedicated index because active, inactive, visible, and hidden trees all reserve their coordinates.

## Candidate query bounds

An ordinary open candidate needs a 700-unit radius:

- 84 units for tree spacing; or
- 360 units for an existing micro-grove opening plus as much as 340 units from its anchor to a
  stored halo member.

A micro-grove candidate queries around its reconstructed anchor with a 1,040-unit radius:

- 700 units of minimum anchor separation; plus
- as much as 340 units from an existing anchor to a stored halo member.

At 720 units per cell these become a fixed 3×3 or 5×5 cell query. Returned records may cover a
slightly larger square than the exact radius. The pure allocator reconstructs anchors from
`(worldSeed, placementSlot)` and applies the exact Euclidean spacing, grove separation, and grove
buffer rules.

## Boundedness and failure

The query requests at most 10,001 records and accepts at most 10,000, matching the pure allocator's
per-call occupied-summary bound. Exceeding that bound fails closed instead of silently omitting a
conflict. This is a local integrity/density limit, not a lifetime forest limit: trees outside the
candidate's fixed neighboring cells are never read and do not count toward it.

Every returned record must use supported tree-schema, placement-policy, and placement-index
versions. Its derived cell must agree with its immutable coordinate. Unsupported or stale records
fail the candidate attempt rather than being interpreted as empty space.

The adapter returns only:

```text
placementSlot
worldX
worldY
```

Raw writing-tree ids, group ids, Block ids, content, and lifecycle state do not cross into the pure
allocator.

The read accepts and propagates a MongoDB session. The production writer must supply its live
transaction session so neighborhood evidence, slot advancement, and tree insertion share one
transactional attempt. Session propagation does not replace the unique placement-slot constraint.

## Transactional-writer handoff

The forthcoming writer can inspect candidate slots one at a time inside its bounded search:

1. inspect the deterministic candidate;
2. apply deterministic environment exclusion;
3. read this candidate's placement neighborhood;
4. ask the pure allocator to evaluate the single candidate against those summaries;
5. continue after rejection; and
6. atomically insert the accepted tree and advance `nextCandidateSlot`.

The unique forest/placement-slot index and owner-world transaction provide concurrency authority.
The neighborhood read is a bounded conflict input, not a lock or uniqueness guarantee.
