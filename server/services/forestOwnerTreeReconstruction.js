import crypto from 'crypto';

import {
  createForestEnvironmentManifest,
  forestEnvironmentAt,
} from '../../public/js/forest-environment.js';
import { hashSeed } from './forest/v3/random.js';
import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION,
  projectPostToForestTree,
} from './forestPostTreeProjection.js';
import {
  FOREST_OWNER_VARIANT_SELECTION_VERSION,
} from './forestOwnerVariantSelection.js';

export const FOREST_OWNER_TREE_RECONSTRUCTION_VERSION = 1;
export const FOREST_OWNER_TREE_IDENTITY_VERSION = 1;
export const FOREST_OWNER_TREE_RECONSTRUCTION_PLACEMENT_VERSION = 1;

const DEFAULT_WORLD = Object.freeze({
  width: 3_200,
  height: 2_000,
  edgeMargin: 120,
});

export class ForestOwnerTreeReconstructionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerTreeReconstructionError';
    this.code = code;
  }
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ForestOwnerTreeReconstructionError(
      'INVALID_RECONSTRUCTION_INPUT',
      `${fieldName} must be a non-empty string`,
    );
  }

  return value;
}

function requirePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ForestOwnerTreeReconstructionError(
      'INVALID_RECONSTRUCTION_INPUT',
      `${fieldName} must be a positive integer`,
    );
  }

  return value;
}

function normalizeWorld(world = DEFAULT_WORLD) {
  const width = requirePositiveInteger(world.width, 'world.width');
  const height = requirePositiveInteger(world.height, 'world.height');
  const edgeMargin = Number.isInteger(world.edgeMargin)
    ? world.edgeMargin
    : DEFAULT_WORLD.edgeMargin;

  if (
    edgeMargin < 0
    || edgeMargin * 2 >= width
    || edgeMargin * 2 >= height
  ) {
    throw new ForestOwnerTreeReconstructionError(
      'INVALID_RECONSTRUCTION_INPUT',
      'world.edgeMargin must leave positive placement space',
    );
  }

  return Object.freeze({ width, height, edgeMargin });
}

function shortDigest(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('base64url')
    .slice(0, 22);
}

export function deriveForestOwnerTreeId({
  ownerUserId,
  groupId,
  identityVersion = FOREST_OWNER_TREE_IDENTITY_VERSION,
}) {
  const owner = requireString(ownerUserId, 'ownerUserId');
  const group = requireString(groupId, 'groupId');
  const version = requirePositiveInteger(identityVersion, 'identityVersion');

  return `writing-tree-${shortDigest(`owner-tree:${version}:${owner}:${group}`)}`;
}

export function deriveForestOwnerTreeReconstructionPlacement({
  ownerUserId,
  groupId,
  placementVersion = FOREST_OWNER_TREE_RECONSTRUCTION_PLACEMENT_VERSION,
  world,
}) {
  const owner = requireString(ownerUserId, 'ownerUserId');
  const group = requireString(groupId, 'groupId');
  const version = requirePositiveInteger(placementVersion, 'placementVersion');
  const normalizedWorld = normalizeWorld(world);
  const usableWidth = normalizedWorld.width - normalizedWorld.edgeMargin * 2;
  const usableHeight = normalizedWorld.height - normalizedWorld.edgeMargin * 2;
  const seedBase = `owner-tree-placement:${version}:${owner}:${group}`;

  return Object.freeze({
    placementVersion: version,
    worldX:
      normalizedWorld.edgeMargin
      + (hashSeed(`${seedBase}:x`) % (usableWidth + 1)),
    worldY:
      normalizedWorld.edgeMargin
      + (hashSeed(`${seedBase}:y`) % (usableHeight + 1)),
  });
}

function validateSelection(selection) {
  if (!selection || typeof selection !== 'object') {
    throw new ForestOwnerTreeReconstructionError(
      'INVALID_RECONSTRUCTION_INPUT',
      'selection must be an owner variant selection result',
    );
  }

  requireString(selection.ownerUserId, 'selection.ownerUserId');
  requireString(
    selection.translationGroupId,
    'selection.translationGroupId',
  );

  if (typeof selection.active !== 'boolean') {
    throw new ForestOwnerTreeReconstructionError(
      'INVALID_RECONSTRUCTION_INPUT',
      'selection.active must be a boolean',
    );
  }
}

function reconstructWith({
  selection,
  environmentManifest,
  world,
  identityVersion,
  placementVersion,
  projectTree,
  environmentAt,
}) {
  validateSelection(selection);

  const treeId = deriveForestOwnerTreeId({
    ownerUserId: selection.ownerUserId,
    groupId: selection.translationGroupId,
    identityVersion,
  });

  if (!selection.active) {
    return Object.freeze({
      reconstructionVersion: FOREST_OWNER_TREE_RECONSTRUCTION_VERSION,
      status: 'inactive',
      treeId,
      identityVersion,
      limitation:
        'Pure reconstruction can report inactivity only when the former owner/group identity is already known.',
    });
  }

  if (!selection.foundingVariant) {
    throw new ForestOwnerTreeReconstructionError(
      'CAPTURED_FOUNDER_UNAVAILABLE',
      'The captured founding Block is no longer present in the owner history, so its founding traits cannot be reconstructed.',
    );
  }

  const normalizedWorld = normalizeWorld(world);
  const manifest = environmentManifest
    || createForestEnvironmentManifest({
      seed: 'activity-forest-owner-tree-reconstruction-proof',
      world: {
        width: normalizedWorld.width,
        height: normalizedWorld.height,
      },
    });
  const placement = deriveForestOwnerTreeReconstructionPlacement({
    ownerUserId: selection.ownerUserId,
    groupId: selection.translationGroupId,
    placementVersion,
    world: normalizedWorld,
  });
  const environment = environmentAt(manifest, {
    worldX: placement.worldX,
    worldY: placement.worldY,
  });
  const projection = projectTree(
    {
      id: treeId,
      createdAt: selection.foundingVariant.createdAt,
      roomId: selection.foundingVariant.roomId,
    },
    {
      habitat: environment.habitatId,
    },
  );

  return Object.freeze({
    reconstructionVersion: FOREST_OWNER_TREE_RECONSTRUCTION_VERSION,
    status: 'active',
    treeId,
    identityVersion,
    placement,
    habitat: Object.freeze({
      habitatId: environment.habitatId,
      originatingRegionId: environment.dominantRegionId,
      groundSurfaceId: environment.groundSurfaceId,
      transitionState: environment.transition.state,
    }),
    projection,
    versions: Object.freeze({
      ownerVariantSelectionVersion: FOREST_OWNER_VARIANT_SELECTION_VERSION,
      projectionSchemaVersion:
        projection.schemaVersion ?? FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION,
      mappingVersion:
        projection.mappingVersion ?? FOREST_POST_TREE_MAPPING_VERSION,
      environmentSchemaVersion: manifest.schemaVersion,
      worldGenerationVersion: manifest.worldGenerationVersion,
      placementVersion,
    }),
  });
}

export function buildForestOwnerTreeReconstructor({
  projectTree = projectPostToForestTree,
  environmentAt = forestEnvironmentAt,
} = {}) {
  if (typeof projectTree !== 'function' || typeof environmentAt !== 'function') {
    throw new ForestOwnerTreeReconstructionError(
      'INVALID_RECONSTRUCTION_DEPENDENCY',
      'projectTree and environmentAt must be functions',
    );
  }

  return function reconstructForestOwnerTree({
    selection,
    environmentManifest,
    world = DEFAULT_WORLD,
    identityVersion = FOREST_OWNER_TREE_IDENTITY_VERSION,
    placementVersion = FOREST_OWNER_TREE_RECONSTRUCTION_PLACEMENT_VERSION,
  }) {
    return reconstructWith({
      selection,
      environmentManifest,
      world,
      identityVersion,
      placementVersion,
      projectTree,
      environmentAt,
    });
  };
}

export const reconstructForestOwnerTree =
  buildForestOwnerTreeReconstructor();

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function describeForestOwnerTreeContinuityChanges(before, after) {
  const changes = [];

  if (before.status !== after.status) changes.push('lifecycle');
  if (before.treeId !== after.treeId) changes.push('tree-identity');
  if (!jsonEqual(before.placement, after.placement)) changes.push('placement');
  if (!jsonEqual(before.habitat, after.habitat)) changes.push('habitat');
  if (
    before.projection?.specimen?.seed
    !== after.projection?.specimen?.seed
  ) {
    changes.push('specimen');
  }
  if (
    before.projection?.phenotype?.id
    !== after.projection?.phenotype?.id
  ) {
    changes.push('phenotype');
  }
  if (
    !jsonEqual(
      before.projection?.permanentTraits,
      after.projection?.permanentTraits,
    )
  ) {
    changes.push('permanent-traits');
  }
  if (
    before.projection?.identity?.projectionFingerprint
    !== after.projection?.identity?.projectionFingerprint
  ) {
    changes.push('projection-identity');
  }
  if (!jsonEqual(before.versions, after.versions)) changes.push('versions');

  return Object.freeze(changes);
}
