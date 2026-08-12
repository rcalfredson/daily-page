import ForestAuthoredObject from '../server/db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../server/db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../server/db/models/ForestAuthoredResetOperation.js';
import {
  FOREST_AUTHORED_COORDINATE_LIMIT,
  FOREST_AUTHORED_MARKER_APPEARANCE_ID,
  FOREST_AUTHORED_MARKER_APPEARANCE_VERSION,
  FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION,
  FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
  FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
} from '../server/db/schemas/ForestAuthoredObjectSchema.js';
import {
  FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION
} from '../server/db/schemas/ForestAuthoredRegionRevisionSchema.js';
import {
  FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION,
  FOREST_AUTHORED_RESET_OPERATION_VERSION
} from '../server/db/schemas/ForestAuthoredResetOperationSchema.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const RESET = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-11T12:00:00.000Z');
const PURGE = new Date('2026-11-09T12:00:00.000Z');
const DIGEST = 'A'.repeat(43);

function validObject(overrides = {}) {
  return {
    objectId: OBJECT,
    forestId: FOREST,
    ownerUserId: OWNER,
    kind: 'personal-marker',
    state: 'active',
    placement: { worldX: -720, worldY: 1_440 },
    placementIndex: { version: 1, cellX: -1, cellY: 2 },
    worldVersionEvidence: {
      ownerWorldSchemaVersion: 1,
      placementPolicyVersion: 1,
      environmentPolicyVersion: 1,
      environmentSchemaVersion: 1,
      worldGenerationVersion: 1
    },
    appearance: {
      id: FOREST_AUTHORED_MARKER_APPEARANCE_ID,
      version: FOREST_AUTHORED_MARKER_APPEARANCE_VERSION
    },
    creationFingerprint: {
      version: FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION,
      digest: DIGEST
    },
    recordRevision: 1,
    changedAt: NOW,
    removedAt: null,
    purgeEligibleAt: null,
    ...overrides
  };
}

function indexesByName(model) {
  return new Map(model.schema.indexes().map(([fields, options]) => (
    [options.name, { fields, options }]
  )));
}

describe('forest authored ledger schemas', () => {
  it('accepts one exact active marker with signed placement and immutable identity evidence', async () => {
    const object = new ForestAuthoredObject(validObject());

    await expectAsync(object.validate()).toBeResolved();
    expect(object.schemaVersion).toBe(FOREST_AUTHORED_OBJECT_SCHEMA_VERSION);
    expect(object.identityVersion).toBe(FOREST_AUTHORED_OBJECT_IDENTITY_VERSION);
    expect(object.kind).toBe('personal-marker');
    expect(object.state).toBe('active');
    expect(object.recordRevision).toBe(1);
    expect(object.removedAt).toBeNull();
    expect(object.purgeEligibleAt).toBeNull();
  });

  it('accepts coordinate extremes and rejects unsafe or out-of-policy coordinates', async () => {
    const minimum = new ForestAuthoredObject(validObject({
      placement: {
        worldX: -FOREST_AUTHORED_COORDINATE_LIMIT,
        worldY: FOREST_AUTHORED_COORDINATE_LIMIT
      }
    }));
    await expectAsync(minimum.validate()).toBeResolved();

    for (const placement of [
      { worldX: FOREST_AUTHORED_COORDINATE_LIMIT + 1, worldY: 0 },
      { worldX: 0.5, worldY: 0 },
      { worldX: 0, worldY: Number.MAX_SAFE_INTEGER + 1 }
    ]) {
      const invalid = new ForestAuthoredObject(validObject({ placement }));
      await expectAsync(invalid.validate()).toBeRejectedWithError(/validation failed/i);
    }
  });

  it('requires a coherent compact removed tombstone lifecycle', async () => {
    const removed = new ForestAuthoredObject(validObject({
      state: 'removed',
      recordRevision: 2,
      changedAt: NOW,
      removedAt: NOW,
      purgeEligibleAt: PURGE
    }));
    await expectAsync(removed.validate()).toBeResolved();

    for (const overrides of [
      { state: 'removed', removedAt: NOW, purgeEligibleAt: null },
      { state: 'active', removedAt: NOW, purgeEligibleAt: PURGE },
      { state: 'removed', changedAt: NOW, removedAt: NOW, purgeEligibleAt: NOW },
      {
        state: 'removed',
        changedAt: new Date('2026-08-10T12:00:00.000Z'),
        removedAt: NOW,
        purgeEligibleAt: PURGE
      }
    ]) {
      const invalid = new ForestAuthoredObject(validObject(overrides));
      await expectAsync(invalid.validate()).toBeRejectedWithError(/validation failed/i);
    }
  });

  it('rejects unsupported kinds, appearances, fingerprints, versions, and unknown fields', async () => {
    for (const overrides of [
      { kind: 'bench' },
      { appearance: { id: 'bright-beacon', version: 1 } },
      { creationFingerprint: { version: 1, digest: 'short' } },
      { schemaVersion: 2 },
      { identityVersion: 2 }
    ]) {
      const invalid = new ForestAuthoredObject(validObject(overrides));
      await expectAsync(invalid.validate()).toBeRejectedWithError(/validation failed/i);
    }
    expect(() => new ForestAuthoredObject(validObject({ title: 'private' })))
      .toThrowError(/not in schema/);
    const nested = new ForestAuthoredObject(validObject({
      placement: { worldX: 0, worldY: 0, playerX: 0 }
    }));
    await expectAsync(nested.validate()).toBeRejectedWithError(/StrictModeError/);
  });

  it('declares object uniqueness and every accepted bounded object query index', () => {
    const indexes = indexesByName(ForestAuthoredObject);

    expect(indexes.get('unique_forest_authored_object_owner_forest_id')).toEqual({
      fields: { ownerUserId: 1, forestId: 1, objectId: 1 },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('forest_authored_object_spatial_read')?.fields).toEqual({
      ownerUserId: 1,
      forestId: 1,
      state: 1,
      'placementIndex.version': 1,
      'placementIndex.cellX': 1,
      'placementIndex.cellY': 1,
      objectId: 1
    });
    expect(indexes.get('forest_authored_object_collision_neighborhood')?.fields).toEqual({
      ownerUserId: 1,
      forestId: 1,
      state: 1,
      'placementIndex.cellX': 1,
      'placementIndex.cellY': 1,
      objectId: 1
    });
    expect(indexes.get('forest_authored_object_tombstone_purge')?.fields).toEqual({
      state: 1, purgeEligibleAt: 1, _id: 1
    });
    expect(indexes.get('forest_authored_object_diagnostic_export')?.fields).toEqual({
      ownerUserId: 1, forestId: 1, objectId: 1, createdAt: 1
    });
    expect(indexes.get('forest_authored_object_deletion')?.fields).toEqual({
      ownerUserId: 1, _id: 1
    });
  });

  it('accepts monotonic per-cell revision state and rejects arrays or unknown fields', async () => {
    const revision = new ForestAuthoredRegionRevision({
      forestId: FOREST,
      ownerUserId: OWNER,
      spatialIndexVersion: 1,
      cellX: -1,
      cellY: 2,
      revision: 7
    });
    await expectAsync(revision.validate()).toBeResolved();
    expect(revision.schemaVersion).toBe(FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION);

    const invalid = new ForestAuthoredRegionRevision({
      forestId: FOREST,
      ownerUserId: OWNER,
      spatialIndexVersion: 1,
      cellX: -1,
      cellY: 2,
      revision: 0
    });
    await expectAsync(invalid.validate()).toBeRejectedWithError(/validation failed/i);
    expect(() => new ForestAuthoredRegionRevision({
      forestId: FOREST,
      ownerUserId: OWNER,
      spatialIndexVersion: 1,
      cellX: 0,
      cellY: 0,
      revision: 1,
      objectIds: []
    })).toThrowError(/not in schema/);
  });

  it('declares exact per-cell uniqueness and owner-keyed deletion indexes', () => {
    const indexes = indexesByName(ForestAuthoredRegionRevision);
    expect(indexes.get('unique_forest_authored_region_revision_cell')).toEqual({
      fields: {
        ownerUserId: 1,
        forestId: 1,
        spatialIndexVersion: 1,
        cellX: 1,
        cellY: 1
      },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('forest_authored_region_revision_deletion')?.fields).toEqual({
      ownerUserId: 1, _id: 1
    });
  });

  it('accepts coherent processing and completed reset operations', async () => {
    const processing = new ForestAuthoredResetOperation({
      resetId: RESET,
      forestId: FOREST,
      ownerUserId: OWNER,
      authoredObjectSchemaVersion: 1,
      spatialIndexVersion: 1,
      startedAt: NOW
    });
    await expectAsync(processing.validate()).toBeResolved();
    expect(processing.schemaVersion).toBe(FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION);
    expect(processing.operationVersion).toBe(FOREST_AUTHORED_RESET_OPERATION_VERSION);
    expect(processing.status).toBe('processing');
    expect(processing.affectedObjectCount).toBe(0);

    const completed = new ForestAuthoredResetOperation({
      resetId: RESET,
      forestId: FOREST,
      ownerUserId: OWNER,
      status: 'completed',
      afterObjectId: OBJECT,
      affectedObjectCount: 12,
      authoredObjectSchemaVersion: 1,
      spatialIndexVersion: 1,
      startedAt: NOW,
      completedAt: PURGE
    });
    await expectAsync(completed.validate()).toBeResolved();
  });

  it('rejects incoherent reset state and declares reset identity, lease, worker, and deletion indexes', async () => {
    for (const overrides of [
      { status: 'processing', completedAt: PURGE },
      { status: 'completed', completedAt: null },
      { affectedObjectCount: -1 },
      { afterObjectId: 'not-a-uuid' }
    ]) {
      const invalid = new ForestAuthoredResetOperation({
        resetId: RESET,
        forestId: FOREST,
        ownerUserId: OWNER,
        authoredObjectSchemaVersion: 1,
        spatialIndexVersion: 1,
        startedAt: NOW,
        ...overrides
      });
      await expectAsync(invalid.validate()).toBeRejectedWithError(/validation failed/i);
    }

    const indexes = indexesByName(ForestAuthoredResetOperation);
    expect(indexes.get('unique_forest_authored_reset_operation_id')).toEqual({
      fields: { ownerUserId: 1, forestId: 1, resetId: 1 },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('unique_forest_authored_reset_processing')).toEqual({
      fields: { ownerUserId: 1, forestId: 1, status: 1 },
      options: jasmine.objectContaining({
        unique: true,
        partialFilterExpression: { status: 'processing' }
      })
    });
    expect(indexes.get('forest_authored_reset_worker')?.fields).toEqual({
      status: 1, updatedAt: 1, _id: 1
    });
    expect(indexes.get('forest_authored_reset_deletion')?.fields).toEqual({
      ownerUserId: 1, _id: 1
    });
  });
});
