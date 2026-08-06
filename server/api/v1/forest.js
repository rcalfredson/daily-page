import { Router } from 'express';

import optionalAuth from '../../middleware/optionalAuth.js';
import {
  ForestOwnerRegionManifestError,
  readForestOwnerRegionManifest
} from '../../services/forestOwnerRegionManifest.js';

const router = Router();

const QUERY_FIELDS = Object.freeze(['cells', 'cursor', 'limit']);
const CELL_ID_PATTERN = /^(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*))$/;
const CELLS_QUERY_MAX_LENGTH = 256;

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

const handler = buildForestOwnerRegionRouteHandler();

const useForestAPI = (app) => {
  app.use('/api/v1/forest', router);
  router.use(privateForestApiResponse);
  router.use(optionalAuth);
  router.get('/regions', handler);
};

export default useForestAPI;
