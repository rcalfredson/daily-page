import { Router } from 'express';

import optionalAuth from '../../middleware/optionalAuth.js';
import { getPreferredContentLang } from '../../services/localeContext.js';
import {
  deliverForestOwnerRegionAssets,
  ForestOwnerRegionAssetDeliveryError,
  FOREST_OWNER_REGION_MAX_ASSET_REQUEST
} from '../../services/forestOwnerRegionAssetDelivery.js';
import {
  ForestOwnerRegionManifestError,
  readForestOwnerRegionManifest
} from '../../services/forestOwnerRegionManifest.js';
import {
  ForestOwnerTreeInspectionError,
  inspectForestOwnerTree
} from '../../services/forestOwnerTreeInspection.js';

const router = Router();

const QUERY_FIELDS = Object.freeze(['cells', 'cursor', 'limit']);
const ASSET_QUERY_FIELDS = Object.freeze(['cells', 'cursor', 'assetKeys', 'transport']);
const INSPECTION_QUERY_FIELDS = Object.freeze(['cursor', 'limit']);
const CELL_ID_PATTERN = /^(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*))$/;
const CELLS_QUERY_MAX_LENGTH = 256;
const ASSET_KEYS_QUERY_MAX_LENGTH = FOREST_OWNER_REGION_MAX_ASSET_REQUEST * 401;

function invalidRequest(message) {
  throw new ForestOwnerRegionManifestError('INVALID_OWNER_REGION_INPUT', message);
}

function parseCells(value) {
  if (typeof value !== 'string' || !value.length || value.length > CELLS_QUERY_MAX_LENGTH) {
    invalidRequest('cells must be a bounded comma-separated string.');
  }
  return value.split(',').map((cellId) => {
    const match = CELL_ID_PATTERN.exec(cellId);
    if (!match) invalidRequest('cells contains an invalid exact cell id.');
    const cellX = Number(match[1]);
    const cellY = Number(match[2]);
    if (`${cellX}:${cellY}` !== cellId) {
      invalidRequest('cells must use canonical signed integer ids.');
    }
    return { cellX, cellY };
  });
}

function manifestRequest(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    invalidRequest('The region query is invalid.');
  }
  const extraFields = Object.keys(query).filter(field => !QUERY_FIELDS.includes(field));
  if (extraFields.length) invalidRequest('The region query contains unsupported fields.');
  if (Array.isArray(query.cursor) || Array.isArray(query.limit)) {
    invalidRequest('The region query contains repeated scalar fields.');
  }
  return {
    cells: parseCells(query.cells),
    cursor: query.cursor || null,
    limit: query.limit
  };
}

function assetRequest(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    invalidRequest('The asset query is invalid.');
  }
  const extraFields = Object.keys(query).filter(field => !ASSET_QUERY_FIELDS.includes(field));
  if (extraFields.length) invalidRequest('The asset query contains unsupported fields.');
  if (Array.isArray(query.cursor)
    || Array.isArray(query.assetKeys)
    || Array.isArray(query.transport)) {
    invalidRequest('The asset query contains repeated scalar fields.');
  }
  if (typeof query.assetKeys !== 'string'
    || !query.assetKeys.length
    || query.assetKeys.length > ASSET_KEYS_QUERY_MAX_LENGTH) {
    invalidRequest('assetKeys must be a bounded comma-separated string.');
  }
  return {
    cells: parseCells(query.cells),
    cursor: query.cursor || null,
    assetKeys: query.assetKeys.split(','),
    transport: query.transport
  };
}

function inspectionRequest(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new ForestOwnerTreeInspectionError(
      'INVALID_TREE_INSPECTION_INPUT',
      'The inspection query is invalid.'
    );
  }
  const extraFields = Object.keys(query).filter(
    field => !INSPECTION_QUERY_FIELDS.includes(field)
  );
  if (extraFields.length || Array.isArray(query.cursor) || Array.isArray(query.limit)) {
    throw new ForestOwnerTreeInspectionError(
      'INVALID_TREE_INSPECTION_INPUT',
      'The inspection query contains unsupported fields.'
    );
  }
  return { cursor: query.cursor || null, limit: query.limit };
}

export function privateForestApiResponse(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  if (typeof res.vary === 'function') res.vary('Cookie');
  else res.set('Vary', 'Cookie');
  next();
}

export function buildForestOwnerRegionRouteHandler({
  readManifest = readForestOwnerRegionManifest
} = {}) {
  return async function forestOwnerRegionRoute(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    try {
      const request = manifestRequest(req.query);
      const manifest = await readManifest({
        ownerUserId: req.user.id,
        ...request
      });
      return res.status(200).json(manifest);
    } catch (error) {
      if (error instanceof ForestOwnerRegionManifestError
        && error.code === 'INVALID_OWNER_REGION_INPUT') {
        return res.status(400).json({
          error: 'INVALID_FOREST_REGION_REQUEST',
          code: 'INVALID_FOREST_REGION_REQUEST'
        });
      }
      console.error('Forest owner region request failed:', error?.name || 'Error');
      return res.status(503).json({
        error: 'FOREST_REGION_UNAVAILABLE',
        code: 'FOREST_REGION_UNAVAILABLE'
      });
    }
  };
}

export function buildForestOwnerRegionAssetRouteHandler({
  deliverAssets = deliverForestOwnerRegionAssets
} = {}) {
  return async function forestOwnerRegionAssetRoute(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    try {
      const request = assetRequest(req.query);
      const delivery = await deliverAssets({
        ownerUserId: req.user.id,
        ...request
      });
      return res.status(200).json(delivery);
    } catch (error) {
      if ((error instanceof ForestOwnerRegionManifestError
          && error.code === 'INVALID_OWNER_REGION_INPUT')
        || (error instanceof ForestOwnerRegionAssetDeliveryError
          && error.code === 'INVALID_OWNER_REGION_ASSET_INPUT')) {
        return res.status(400).json({
          error: 'INVALID_FOREST_ASSET_REQUEST',
          code: 'INVALID_FOREST_ASSET_REQUEST'
        });
      }
      if (error instanceof ForestOwnerRegionAssetDeliveryError
        && error.code === 'OWNER_REGION_ASSET_UNAVAILABLE') {
        return res.status(404).json({
          error: 'FOREST_ASSETS_UNAVAILABLE',
          code: 'FOREST_ASSETS_UNAVAILABLE'
        });
      }
      console.error('Forest owner asset request failed:', error?.name || 'Error');
      return res.status(503).json({
        error: 'FOREST_ASSET_DELIVERY_UNAVAILABLE',
        code: 'FOREST_ASSET_DELIVERY_UNAVAILABLE'
      });
    }
  };
}

export function buildForestOwnerTreeInspectionRouteHandler({
  inspectTree = inspectForestOwnerTree
} = {}) {
  return async function forestOwnerTreeInspectionRoute(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    try {
      const inspection = await inspectTree({
        ownerUserId: req.user.id,
        writingTreeId: req.params.writingTreeId,
        preferredContentLang: getPreferredContentLang(res),
        ...inspectionRequest(req.query)
      });
      return res.status(200).json(inspection);
    } catch (error) {
      if (error instanceof ForestOwnerTreeInspectionError
        && error.code === 'INVALID_TREE_INSPECTION_INPUT') {
        return res.status(400).json({
          error: 'INVALID_FOREST_TREE_INSPECTION_REQUEST',
          code: 'INVALID_FOREST_TREE_INSPECTION_REQUEST'
        });
      }
      if (error instanceof ForestOwnerTreeInspectionError
        && error.code === 'TREE_INSPECTION_NOT_FOUND') {
        return res.status(404).json({
          error: 'FOREST_TREE_UNAVAILABLE',
          code: 'FOREST_TREE_UNAVAILABLE'
        });
      }
      console.error('Forest owner tree inspection failed:', error?.name || 'Error');
      return res.status(503).json({
        error: 'FOREST_TREE_INSPECTION_UNAVAILABLE',
        code: 'FOREST_TREE_INSPECTION_UNAVAILABLE'
      });
    }
  };
}

const regionHandler = buildForestOwnerRegionRouteHandler();
const assetHandler = buildForestOwnerRegionAssetRouteHandler();
const inspectionHandler = buildForestOwnerTreeInspectionRouteHandler();

const useForestAPI = (app) => {
  app.use('/api/v1/forest', router);
  router.use(privateForestApiResponse);
  router.use(optionalAuth);
  router.get('/regions', regionHandler);
  router.get('/assets', assetHandler);
  router.get('/trees/:writingTreeId/inspection', inspectionHandler);
};

export default useForestAPI;
