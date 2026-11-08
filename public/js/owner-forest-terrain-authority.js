// Explicit dispatch keeps generation 3 immutable for previously activated worlds.
import { queryTerrainProof, sampleTerrainProof, terrainProofMovementAllowed, buildTerrainProofProtections }
  from './owner-forest-terrain.js';
import { queryRegionalTerrain, sampleRegionalTerrain, regionalMovementAllowed, buildRegionalProtections }
  from './owner-forest-terrain-regional.js';
export function queryOwnerTerrain({ generationVersion = 3, ...args }) {
  if (generationVersion === 3) return queryTerrainProof(args);
  if (generationVersion === 4) return queryRegionalTerrain(args);
  throw new Error('Unsupported terrain generation.');
}
export const sampleOwnerTerrain = (scene, p, radius) => scene.generationVersion === 4
  ? sampleRegionalTerrain(scene, p, radius) : sampleTerrainProof(scene, p, radius);
export const ownerTerrainMovementAllowed = (scene, from, to, radius) => scene.generationVersion === 4
  ? regionalMovementAllowed(scene, from, to, radius) : terrainProofMovementAllowed(scene, from, to, radius);
export const buildOwnerTerrainProtections = (records, generationVersion) => generationVersion === 4
  ? buildRegionalProtections(records) : buildTerrainProofProtections(records);
