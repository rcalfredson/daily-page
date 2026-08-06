import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION
} from '../db/schemas/ForestWritingTreeSchema.js';
import {
  FOREST_OWNER_REGION_MAX_PAGE_SIZE,
  readForestOwnerRegionManifest
} from './forestOwnerRegionManifest.js';
import { FOREST_WRITING_TREE_PROJECTION_REVISION } from './forestWritingTreeCreation.js';
import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
} from './forestPostTreeProjection.js';
import { prepareForestSceneAssets } from './forestSceneAssetPool.js';
import {
  encodeForestSceneAssets,
  FOREST_ASSET_TRANSPORT_RASTER,
  FOREST_ASSET_TRANSPORT_RUNS
} from './forestSceneAssetTransport.js';
import { FOREST_RENDERER_VERSION_V3 } from './forestTreeGeneratorV3.js';
import {
  FOREST_RENDERER_ID,
  FOREST_TREE_ASSET_SCHEMA_VERSION
} from './forest/v3/treeAsset.js';

export const FOREST_OWNER_REGION_ASSET_DELIVERY_VERSION = 1;
export const FOREST_OWNER_REGION_MAX_ASSET_REQUEST = 24;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ASSET_KEY_PATTERN = /^[a-z0-9@._:-]+$/i;
const ASSET_KEY_MAX_LENGTH = 400;
const CURRENT_ASSET_KEY_PREFIX = [
  `tree-asset-v${FOREST_TREE_ASSET_SCHEMA_VERSION}`,
  `${FOREST_RENDERER_ID}@${FOREST_RENDERER_VERSION_V3}`
].join(':');
const TREE_PROJECTION = Object.freeze({
  _id: 0,
  schemaVersion: 1,
  identityVersion: 1,
  writingTreeId: 1,
  ownerUserId: 1,
  sourceState: 1,
  hiddenFromForest: 1,
  projection: 1
});

export class ForestOwnerRegionAssetDeliveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerRegionAssetDeliveryError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerRegionAssetDeliveryError(code, message);
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail('INVALID_OWNER_REGION_ASSET_INPUT', 'ownerUserId must be a canonical ObjectId string.');
  }
  return ownerUserId;
}

function canonicalAssetKeys(value) {
  if (!Array.isArray(value)
    || value.length < 1
    || value.length > FOREST_OWNER_REGION_MAX_ASSET_REQUEST) {
    fail(
      'INVALID_OWNER_REGION_ASSET_INPUT',
      `assetKeys must contain 1 through ${FOREST_OWNER_REGION_MAX_ASSET_REQUEST} keys.`
    );
  }
  for (const key of value) {
    if (typeof key !== 'string'
      || key.length < 1
      || key.length > ASSET_KEY_MAX_LENGTH
      || !ASSET_KEY_PATTERN.test(key)
      || !key.startsWith(`${CURRENT_ASSET_KEY_PREFIX}:`)) {
      fail('INVALID_OWNER_REGION_ASSET_INPUT', 'assetKeys contains an unsupported asset key.');
    }
  }
  if (new Set(value).size !== value.length) {
    fail('INVALID_OWNER_REGION_ASSET_INPUT', 'assetKeys must not contain duplicates.');
  }
  return value.slice();
}

function exactTransport(value) {
  if (![FOREST_ASSET_TRANSPORT_RUNS, FOREST_ASSET_TRANSPORT_RASTER].includes(value)) {
    fail('INVALID_OWNER_REGION_ASSET_INPUT', 'transport is unsupported.');
  }
  return value;
}

async function lean(query) {
  const result = query.lean();
  return typeof result.exec === 'function' ? result.exec() : result;
}

function projectedTreeRecord(row, ownerUserId, authorizedPlacement) {
  if (row?.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
    || row?.identityVersion !== FOREST_WRITING_TREE_IDENTITY_VERSION
    || !UUID_V4_PATTERN.test(row?.writingTreeId || '')
    || row?.writingTreeId !== authorizedPlacement.id
    || row?.ownerUserId !== ownerUserId
    || row?.sourceState !== 'active'
    || row?.hiddenFromForest !== false
    || row?.projection?.revision !== FOREST_WRITING_TREE_PROJECTION_REVISION
    || row?.projection?.schemaVersion !== FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
    || row?.projection?.mappingVersion !== FOREST_POST_TREE_MAPPING_VERSION) {
    fail('OWNER_REGION_ASSET_INCOHERENT', 'An authorized tree projection is unsupported.');
  }
  return {
    schemaVersion: row.projection.schemaVersion,
    mappingVersion: row.projection.mappingVersion,
    specimen: {
      seed: row.projection.specimenSeed,
      source: 'stable-writing-identity'
    },
    phenotype: {
      id: row.projection.phenotypeId,
      version: row.projection.phenotypeAssetVersion
    },
    permanentTraits: {
      creationSeason: row.projection.creationSeason,
      foliagePaletteId: row.projection.foliagePaletteId
    },
    identity: {
      projectionFingerprint: row.projection.projectionFingerprint,
      visualFingerprint: row.projection.visualFingerprint
    }
  };
}

function emptyDelivery(status, transport) {
  return {
    assetDeliveryVersion: FOREST_OWNER_REGION_ASSET_DELIVERY_VERSION,
    status,
    transport,
    assetContract: null,
    assets: []
  };
}

export function buildForestOwnerRegionAssetDeliveryService({
  readManifest = readForestOwnerRegionManifest,
  ForestWritingTreeModel = ForestWritingTree,
  prepareAssets = prepareForestSceneAssets,
  encodeAssets = encodeForestSceneAssets
} = {}) {
  return async function deliverForestOwnerRegionAssets({
    ownerUserId: ownerValue,
    cells,
    cursor = null,
    assetKeys: assetKeyValue,
    transport: transportValue = FOREST_ASSET_TRANSPORT_RUNS
  }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const assetKeys = canonicalAssetKeys(assetKeyValue);
    const transport = exactTransport(transportValue);
    const manifest = await readManifest({
      ownerUserId,
      cells,
      cursor,
      limit: FOREST_OWNER_REGION_MAX_PAGE_SIZE
    });
    if (manifest.status !== 'ready') return emptyDelivery(manifest.status, transport);

    const placementsByAssetKey = new Map(manifest.placements.map(placement => (
      [placement.assetKey, placement]
    )));
    const authorizedPlacements = assetKeys.map((assetKey) => {
      const placement = placementsByAssetKey.get(assetKey);
      if (!placement) {
        fail('OWNER_REGION_ASSET_UNAVAILABLE', 'A requested asset is not in the current region.');
      }
      return placement;
    });
    const writingTreeIds = [...new Set(authorizedPlacements.map(placement => placement.id))];
    const rows = await lean(ForestWritingTreeModel.find({
      ownerUserId,
      writingTreeId: { $in: writingTreeIds },
      sourceState: 'active',
      hiddenFromForest: false
    }, TREE_PROJECTION).limit(writingTreeIds.length));
    if (!Array.isArray(rows) || rows.length !== writingTreeIds.length) {
      fail('OWNER_REGION_ASSET_UNAVAILABLE', 'An authorized tree projection became unavailable.');
    }
    const rowsByTreeId = new Map(rows.map(row => [row.writingTreeId, row]));
    if (rowsByTreeId.size !== rows.length) {
      fail('OWNER_REGION_ASSET_INCOHERENT', 'Authorized tree projections were not unique.');
    }
    const projections = new Map();
    for (const placement of authorizedPlacements) {
      const row = rowsByTreeId.get(placement.id);
      if (!row) {
        fail('OWNER_REGION_ASSET_UNAVAILABLE', 'An authorized tree projection became unavailable.');
      }
      projections.set(placement.assetKey, projectedTreeRecord(row, ownerUserId, placement));
    }

    let runtimeAssets;
    try {
      ({ assets: runtimeAssets } = prepareAssets(authorizedPlacements, projections));
    } catch {
      fail('OWNER_REGION_ASSET_DELIVERY_FAILED', 'An authorized asset could not be prepared.');
    }
    if (!Array.isArray(runtimeAssets)
      || runtimeAssets.length !== assetKeys.length
      || runtimeAssets.some((asset, index) => asset?.cacheKey !== assetKeys[index])) {
      fail('OWNER_REGION_ASSET_INCOHERENT', 'Prepared assets changed requested identity.');
    }

    let encoded;
    try {
      encoded = await encodeAssets(runtimeAssets, transport);
    } catch {
      fail('OWNER_REGION_ASSET_DELIVERY_FAILED', 'An authorized asset could not be encoded.');
    }
    if (!Array.isArray(encoded?.assets)
      || encoded.assets.length !== assetKeys.length
      || encoded.assets.some((asset, index) => asset?.cacheKey !== assetKeys[index])) {
      fail('OWNER_REGION_ASSET_INCOHERENT', 'Encoded assets changed requested identity.');
    }

    return {
      assetDeliveryVersion: FOREST_OWNER_REGION_ASSET_DELIVERY_VERSION,
      status: 'ready',
      transport,
      assetContract: manifest.assetContract,
      assets: encoded.assets
    };
  };
}

export const deliverForestOwnerRegionAssets = buildForestOwnerRegionAssetDeliveryService();
