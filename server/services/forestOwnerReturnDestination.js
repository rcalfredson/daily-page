import { forestTerrainReturnPredicate } from './forestOwnerTerrain.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import { forestReturnTreeId } from '../../public/js/forest-writing-navigation.js';
import {
  ownerForestCellsAround, ownerForestReturnSpawn, OWNER_FOREST_COORDINATE_LIMIT
} from '../../public/js/owner-forest-scene.js';
import { inspectForestOwnerTree } from './forestOwnerTreeInspection.js';
import { readForestOwnerRegionManifest } from './forestOwnerRegionManifest.js';

// Bound optional navigation independently of the forest's normal paginated loading.
export const FOREST_RETURN_MAX_PAGES = 4;
export const FOREST_RETURN_PAGE_SIZE = 250;

export function buildForestOwnerReturnDestinationService({
  ForestWritingTreeModel = ForestWritingTree,
  inspectTree = inspectForestOwnerTree,
  readManifest = readForestOwnerRegionManifest,
  terrainPredicate = forestTerrainReturnPredicate
} = {}) {
  return async function resolveForestOwnerReturnDestination({
    ownerUserId, forestId, writingTreeId, preferredContentLang = 'en', spawn, cellSize, world = null
  }) {
    const treeId = forestReturnTreeId(writingTreeId);
    if (!treeId) return null;
    try {
      // Reuse current-writing authorization, not merely a saved placement's visibility.
      const inspection = await inspectTree({ ownerUserId, writingTreeId: treeId, preferredContentLang });
      if (inspection.status !== 'ready' || inspection.tree?.id !== treeId) return null;
      const query = ForestWritingTreeModel.findOne({
        ownerUserId, forestId, writingTreeId: treeId,
        recordRevision: inspection.tree.recordRevision,
        sourceState: 'active', hiddenFromForest: false
      }, { _id: 0, placement: 1 });
      const lean = query.lean();
      const tree = await (typeof lean.exec === 'function' ? lean.exec() : lean);
      const position = tree?.placement;
      if (!Number.isSafeInteger(position?.worldX) || !Number.isSafeInteger(position?.worldY)
        || Math.abs(position.worldX) > OWNER_FOREST_COORDINATE_LIMIT
        || Math.abs(position.worldY) > OWNER_FOREST_COORDINATE_LIMIT) return null;
      const cells = ownerForestCellsAround(position, cellSize);
      const placements = [];
      let cursor = null;
      for (let page = 0; page < FOREST_RETURN_MAX_PAGES; page += 1) {
        const manifest = await readManifest({
          ownerUserId, cells, cursor, limit: FOREST_RETURN_PAGE_SIZE
        });
        if (manifest.status !== 'ready' || !Array.isArray(manifest.placements)
          || manifest.placements.length > FOREST_RETURN_PAGE_SIZE) return null;
        placements.push(...manifest.placements);
        cursor = manifest.page.nextCursor;
        if (!cursor) break;
      }
      if (cursor) return null; // Never choose a spawn against incomplete collision evidence.
      const target = placements.find(item => item.id === treeId);
      if (!target || target.worldX !== position.worldX || target.worldY !== position.worldY) return null;
      const isWalkable = await terrainPredicate({ ownerUserId, world,
        position: { worldX: target.worldX, worldY: target.worldY } });
      const destination = ownerForestReturnSpawn(spawn, target, placements, isWalkable);
      if (!destination) return null;
      return { treeId, spawn: destination };
    } catch {
      // A stale, unauthorized, unsupported or temporarily unavailable locator must not break
      // ordinary forest entry or reveal why a particular tree was unavailable. No private logs.
      return null;
    }
  };
}

export const resolveForestOwnerReturnDestination = buildForestOwnerReturnDestinationService();
