import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import { forestReturnTreeId } from '../../public/js/forest-writing-navigation.js';
import { ownerForestCellsAround, ownerForestReturnSpawn,
  OWNER_FOREST_MARKER_RADIUS } from '../../public/js/owner-forest-scene.js';
import { validateForestAuthoredStoredObject } from './forestAuthoredObjectMutation.js';
import { readForestOwnerRegionManifest } from './forestOwnerRegionManifest.js';
import { FOREST_RETURN_MAX_PAGES, FOREST_RETURN_PAGE_SIZE } from './forestOwnerReturnDestination.js';

async function lean(query) {
  const value = query.lean();
  return typeof value.exec === 'function' ? value.exec() : value;
}

export function buildForestAuthoredReturnDestinationService({
  ForestAuthoredObjectModel = ForestAuthoredObject,
  readManifest = readForestOwnerRegionManifest
} = {}) {
  return async function resolveForestAuthoredReturnDestination({ ownerUserId, forestId,
    objectId: objectValue, spawn, cellSize }) {
    const objectId = forestReturnTreeId(objectValue);
    if (!objectId) return null;
    try {
      const filter = { ownerUserId, forestId, objectId, state: 'active' };
      const object = await lean(ForestAuthoredObjectModel.findOne(filter));
      if (!object || object.state !== 'active') return null;
      validateForestAuthoredStoredObject(object, { ownerUserId, forestId, objectId });
      const target = { id: objectId, ...object.placement, collisionRadius: OWNER_FOREST_MARKER_RADIUS };
      const cells = ownerForestCellsAround(target, cellSize);
      const placements = [];
      let cursor = null;
      for (let page = 0; page < FOREST_RETURN_MAX_PAGES; page += 1) {
        const manifest = await readManifest({ ownerUserId, cells, cursor, limit: FOREST_RETURN_PAGE_SIZE });
        if (manifest.status !== 'ready' || !Array.isArray(manifest.placements)
          || manifest.placements.length > FOREST_RETURN_PAGE_SIZE) return null;
        placements.push(...manifest.placements);
        cursor = manifest.page.nextCursor;
        if (!cursor) break;
      }
      if (cursor) return null;
      const destination = ownerForestReturnSpawn(spawn, target, placements);
      if (!destination) return null;
      // The marker may have moved or been removed while collision pages were loading.
      const unchanged = await lean(ForestAuthoredObjectModel.findOne({ ...filter,
        recordRevision: object.recordRevision }, { _id: 1 }));
      return unchanged ? { markerId: objectId, spawn: destination } : null;
    } catch {
      // Optional, private locator failures preserve ordinary forest entry without private logs.
      return null;
    }
  };
}

export const resolveForestAuthoredReturnDestination = buildForestAuthoredReturnDestinationService();
