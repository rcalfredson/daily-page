import { Router } from 'express';

import optionalAuth from '../../middleware/optionalAuth.js';
import { getPreferredContentLang } from '../../services/localeContext.js';
import {
  forestAuthoredObjectMutations,
  FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION,
  ForestAuthoredMutationError
} from '../../services/forestAuthoredObjectMutation.js';
import {
  enforceForestAuthoredMutationRateLimit,
  ForestAuthoredMutationRateLimitError
} from '../../services/forestAuthoredMutationRateLimit.js';
import {
  ForestAuthoredPlacementError
} from '../../services/forestAuthoredPlacement.js';
import {
  ForestAuthoredRegionManifestError,
  readForestAuthoredRegionManifest
} from '../../services/forestAuthoredRegionManifest.js';
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
import {
  ForestOwnerTreeInclusionError,
  setForestOwnerTreeInclusion
} from '../../services/forestOwnerTreeInclusion.js';
import { requestOrigin } from '../../services/corsPolicy.js';
import {
  FOREST_AUTHORED_COORDINATE_LIMIT
} from '../../db/schemas/ForestAuthoredObjectSchema.js';

const router = Router();

const QUERY_FIELDS = Object.freeze(['cells', 'cursor', 'limit']);
const AUTHORED_QUERY_FIELDS = Object.freeze(['cells', 'cursor', 'limit']);
const ASSET_QUERY_FIELDS = Object.freeze(['cells', 'cursor', 'assetKeys', 'transport']);
const INSPECTION_QUERY_FIELDS = Object.freeze(['cursor', 'limit']);
const CELL_ID_PATTERN = /^(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*))$/;
const CELLS_QUERY_MAX_LENGTH = 256;
const ASSET_KEYS_QUERY_MAX_LENGTH = FOREST_OWNER_REGION_MAX_ASSET_REQUEST * 401;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function invalidRequest(message) {
  throw new ForestOwnerRegionManifestError('INVALID_OWNER_REGION_INPUT', message);
}

function parseCells(value, invalid = invalidRequest) {
  if (typeof value !== 'string' || !value.length || value.length > CELLS_QUERY_MAX_LENGTH) {
    invalid('cells must be a bounded comma-separated string.');
  }
  return value.split(',').map((cellId) => {
    const match = CELL_ID_PATTERN.exec(cellId);
    if (!match) invalid('cells contains an invalid exact cell id.');
    const cellX = Number(match[1]);
    const cellY = Number(match[2]);
    if (`${cellX}:${cellY}` !== cellId) {
      invalid('cells must use canonical signed integer ids.');
    }
    return { cellX, cellY };
  });
}

function invalidAuthoredRegionRequest(message) {
  throw new ForestAuthoredRegionManifestError('INVALID_AUTHORED_REGION_INPUT', message);
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

function authoredManifestRequest(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    invalidAuthoredRegionRequest('The authored region query is invalid.');
  }
  const extraFields = Object.keys(query).filter(
    field => !AUTHORED_QUERY_FIELDS.includes(field)
  );
  if (extraFields.length || Array.isArray(query.cursor) || Array.isArray(query.limit)) {
    invalidAuthoredRegionRequest('The authored region query contains unsupported fields.');
  }
  return {
    cells: parseCells(query.cells, invalidAuthoredRegionRequest),
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

function inclusionRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ForestOwnerTreeInclusionError(
      'INVALID_TREE_INCLUSION_INPUT', 'The inclusion body is invalid.'
    );
  }
  const fields = Object.keys(body);
  if (fields.length !== 2 || !fields.includes('hidden') || !fields.includes('expectedRevision')) {
    throw new ForestOwnerTreeInclusionError(
      'INVALID_TREE_INCLUSION_INPUT', 'The inclusion body contains unsupported fields.'
    );
  }
  return { hidden: body.hidden, expectedRevision: body.expectedRevision };
}

function invalidAuthoredMutation(message) {
  throw new ForestAuthoredMutationError('INVALID_AUTHORED_MUTATION_INPUT', message);
}

function exactMutationBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalidAuthoredMutation('The authored mutation body is invalid.');
  }
  const actual = Object.keys(body);
  if (actual.length !== fields.length || fields.some(field => !actual.includes(field))) {
    invalidAuthoredMutation('The authored mutation body contains unsupported fields.');
  }
  return body;
}

function authoredObjectId(value) {
  const objectId = String(value || '').toLowerCase();
  if (!UUID_V4_PATTERN.test(objectId)) {
    invalidAuthoredMutation('The authored object id is invalid.');
  }
  return objectId;
}

function mutationProtocol(value) {
  if (value !== FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION) {
    invalidAuthoredMutation('The authored mutation protocol is unsupported.');
  }
  return value;
}

function mutationCoordinate(value) {
  if (!Number.isSafeInteger(value)
    || Math.abs(value) > FOREST_AUTHORED_COORDINATE_LIMIT) {
    invalidAuthoredMutation('The authored coordinate is invalid.');
  }
  return value;
}

function mutationRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    invalidAuthoredMutation('The authored object revision is invalid.');
  }
  return value;
}

function createMutationRequest(req) {
  const body = exactMutationBody(req.body, ['protocolVersion', 'kind', 'worldX', 'worldY']);
  if (body.kind !== 'personal-marker') {
    invalidAuthoredMutation('The authored object kind is unsupported.');
  }
  return {
    objectId: authoredObjectId(req.params.objectId),
    protocolVersion: mutationProtocol(body.protocolVersion),
    kind: body.kind,
    worldX: mutationCoordinate(body.worldX),
    worldY: mutationCoordinate(body.worldY)
  };
}

function moveMutationRequest(req) {
  const body = exactMutationBody(
    req.body,
    ['protocolVersion', 'expectedRevision', 'worldX', 'worldY']
  );
  return {
    objectId: authoredObjectId(req.params.objectId),
    protocolVersion: mutationProtocol(body.protocolVersion),
    expectedRevision: mutationRevision(body.expectedRevision),
    worldX: mutationCoordinate(body.worldX),
    worldY: mutationCoordinate(body.worldY)
  };
}

function removalMutationRequest(req) {
  const body = exactMutationBody(req.body, ['protocolVersion', 'expectedRevision']);
  return {
    objectId: authoredObjectId(req.params.objectId),
    protocolVersion: mutationProtocol(body.protocolVersion),
    expectedRevision: mutationRevision(body.expectedRevision)
  };
}

const MUTATION_REQUESTS = Object.freeze({
  create: createMutationRequest,
  move: moveMutationRequest,
  remove: removalMutationRequest
});

export function privateForestApiResponse(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  if (typeof res.vary === 'function') res.vary('Cookie');
  else res.set('Vary', 'Cookie');
  next();
}

export function requireForestAuthoredMutationOrigin(req, res, next) {
  const suppliedOrigin = req.get?.('origin');
  const expectedOrigin = requestOrigin(req);
  let normalizedOrigin = null;
  try {
    normalizedOrigin = new URL(suppliedOrigin).origin;
  } catch {
    normalizedOrigin = null;
  }
  if (!normalizedOrigin || !expectedOrigin || normalizedOrigin !== expectedOrigin) {
    return res.status(403).json({
      error: 'FOREST_AUTHORED_MUTATION_ORIGIN_REQUIRED',
      code: 'FOREST_AUTHORED_MUTATION_ORIGIN_REQUIRED'
    });
  }
  if (typeof req.is !== 'function' || !req.is('application/json')) {
    return res.status(415).json({
      error: 'FOREST_AUTHORED_MUTATION_JSON_REQUIRED',
      code: 'FOREST_AUTHORED_MUTATION_JSON_REQUIRED'
    });
  }
  return next();
}

export function buildForestAuthoredRegionRouteHandler({
  readManifest = readForestAuthoredRegionManifest
} = {}) {
  return async function forestAuthoredRegionRoute(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    try {
      const manifest = await readManifest({
        ownerUserId: req.user.id,
        ...authoredManifestRequest(req.query)
      });
      return res.status(200).json(manifest);
    } catch (error) {
      if (error instanceof ForestAuthoredRegionManifestError) {
        if (error.code === 'INVALID_AUTHORED_REGION_INPUT') {
          return res.status(400).json({
            error: 'INVALID_FOREST_AUTHORED_REGION_REQUEST',
            code: 'INVALID_FOREST_AUTHORED_REGION_REQUEST'
          });
        }
        if (error.code === 'AUTHORED_REGION_CHANGED') {
          return res.status(409).json({
            error: 'FOREST_AUTHORED_REGION_CHANGED',
            code: 'FOREST_AUTHORED_REGION_CHANGED'
          });
        }
        if (error.code === 'AUTHORED_REGION_MIGRATION_REQUIRED') {
          return res.status(409).json({
            error: 'FOREST_AUTHORED_MIGRATION_REQUIRED',
            code: 'FOREST_AUTHORED_MIGRATION_REQUIRED'
          });
        }
      }
      console.error(
        'Forest authored region request failed:',
        error instanceof ForestAuthoredRegionManifestError
          ? error.code : 'UNEXPECTED_FAILURE'
      );
      return res.status(503).json({
        error: 'FOREST_AUTHORED_REGION_UNAVAILABLE',
        code: 'FOREST_AUTHORED_REGION_UNAVAILABLE'
      });
    }
  };
}

function mutationErrorResponse(error, res) {
  if (error instanceof ForestAuthoredMutationRateLimitError) {
    if (error.code === 'AUTHORED_MUTATION_RATE_LIMITED') {
      if (error.retryAfterSeconds) res.set('Retry-After', String(error.retryAfterSeconds));
      return res.status(429).json({
        error: 'FOREST_AUTHORED_MUTATION_RATE_LIMITED',
        code: 'FOREST_AUTHORED_MUTATION_RATE_LIMITED'
      });
    }
    return res.status(503).json({
      error: 'FOREST_AUTHORED_MUTATION_UNAVAILABLE',
      code: 'FOREST_AUTHORED_MUTATION_UNAVAILABLE'
    });
  }
  if (error instanceof ForestAuthoredPlacementError) {
    if (error.code === 'AUTHORED_PLACEMENT_COLLISION') {
      return res.status(409).json({
        error: 'FOREST_AUTHORED_PLACEMENT_COLLISION',
        code: 'FOREST_AUTHORED_PLACEMENT_COLLISION'
      });
    }
    if (error.code === 'AUTHORED_PLACEMENT_DENSITY') {
      return res.status(409).json({
        error: 'FOREST_AUTHORED_PLACEMENT_DENSITY',
        code: 'FOREST_AUTHORED_PLACEMENT_DENSITY'
      });
    }
  }
  if (error instanceof ForestAuthoredMutationError) {
    if ([
      'INVALID_AUTHORED_MUTATION_INPUT',
      'UNSUPPORTED_AUTHORED_MUTATION_PROTOCOL',
      'UNSUPPORTED_AUTHORED_OBJECT_KIND'
    ].includes(error.code)) {
      return res.status(400).json({
        error: 'INVALID_FOREST_AUTHORED_MUTATION_REQUEST',
        code: 'INVALID_FOREST_AUTHORED_MUTATION_REQUEST'
      });
    }
    if ([
      'AUTHORED_CREATE_IDEMPOTENCY_CONFLICT',
      'AUTHORED_OBJECT_CONFLICT'
    ].includes(error.code)) {
      return res.status(409).json({
        error: 'FOREST_AUTHORED_OBJECT_CONFLICT',
        code: 'FOREST_AUTHORED_OBJECT_CONFLICT',
        ...(error.object ? { object: error.object } : {})
      });
    }
    if (['AUTHORED_OBJECT_NOT_FOUND', 'AUTHORED_OBJECT_REMOVED'].includes(error.code)) {
      return res.status(404).json({
        error: 'FOREST_AUTHORED_OBJECT_UNAVAILABLE',
        code: 'FOREST_AUTHORED_OBJECT_UNAVAILABLE',
        ...(error.object ? { object: error.object } : {})
      });
    }
    if (error.code === 'AUTHORED_MIGRATION_REQUIRED') {
      return res.status(409).json({
        error: 'FOREST_AUTHORED_MIGRATION_REQUIRED',
        code: 'FOREST_AUTHORED_MIGRATION_REQUIRED'
      });
    }
    if (error.code === 'AUTHORED_RESETTING') {
      return res.status(409).json({
        error: 'FOREST_AUTHORED_RESETTING',
        code: 'FOREST_AUTHORED_RESETTING'
      });
    }
  }
  return null;
}

export function buildForestAuthoredMutationRouteHandler({
  operation,
  mutate = forestAuthoredObjectMutations[operation],
  enforceRateLimit = enforceForestAuthoredMutationRateLimit
} = {}) {
  if (!MUTATION_REQUESTS[operation]
    || typeof mutate !== 'function'
    || typeof enforceRateLimit !== 'function') {
    throw new Error('Invalid forest authored mutation route dependencies.');
  }
  return async function forestAuthoredMutationRoute(req, res) {
    if (!req.user?.id || !req.authSession?._id) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    try {
      const request = MUTATION_REQUESTS[operation](req);
      await enforceRateLimit({
        ownerUserId: req.user.id,
        authSessionId: String(req.authSession._id)
      });
      const mutation = await mutate({ ownerUserId: req.user.id, ...request });
      return res.status(200).json(mutation);
    } catch (error) {
      const mapped = mutationErrorResponse(error, res);
      if (mapped) return mapped;
      console.error(
        'Forest authored mutation failed:',
        error?.name || 'Error',
        'UNEXPECTED_FAILURE'
      );
      return res.status(503).json({
        error: 'FOREST_AUTHORED_MUTATION_UNAVAILABLE',
        code: 'FOREST_AUTHORED_MUTATION_UNAVAILABLE'
      });
    }
  };
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

export function buildForestOwnerTreeInclusionRouteHandler({
  setInclusion = setForestOwnerTreeInclusion
} = {}) {
  return async function forestOwnerTreeInclusionRoute(req, res) {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED', code: 'AUTHENTICATION_REQUIRED'
      });
    }
    try {
      const result = await setInclusion({
        ownerUserId: req.user.id,
        writingTreeId: req.params.writingTreeId,
        ...inclusionRequest(req.body)
      });
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ForestOwnerTreeInclusionError) {
        if (error.code === 'INVALID_TREE_INCLUSION_INPUT') {
          return res.status(400).json({
            error: 'INVALID_FOREST_TREE_INCLUSION_REQUEST',
            code: 'INVALID_FOREST_TREE_INCLUSION_REQUEST'
          });
        }
        if (error.code === 'TREE_INCLUSION_NOT_FOUND') {
          return res.status(404).json({
            error: 'FOREST_TREE_UNAVAILABLE', code: 'FOREST_TREE_UNAVAILABLE'
          });
        }
        if (error.code === 'TREE_INCLUSION_CONFLICT') {
          return res.status(409).json({
            error: 'FOREST_TREE_INCLUSION_CONFLICT',
            code: 'FOREST_TREE_INCLUSION_CONFLICT'
          });
        }
      }
      console.error('Forest owner tree inclusion failed:', error?.name || 'Error');
      return res.status(503).json({
        error: 'FOREST_TREE_INCLUSION_UNAVAILABLE',
        code: 'FOREST_TREE_INCLUSION_UNAVAILABLE'
      });
    }
  };
}

const regionHandler = buildForestOwnerRegionRouteHandler();
const authoredRegionHandler = buildForestAuthoredRegionRouteHandler();
const assetHandler = buildForestOwnerRegionAssetRouteHandler();
const inspectionHandler = buildForestOwnerTreeInspectionRouteHandler();
const inclusionHandler = buildForestOwnerTreeInclusionRouteHandler();
const authoredCreateHandler = buildForestAuthoredMutationRouteHandler({ operation: 'create' });
const authoredMoveHandler = buildForestAuthoredMutationRouteHandler({ operation: 'move' });
const authoredRemovalHandler = buildForestAuthoredMutationRouteHandler({ operation: 'remove' });

const useForestAPI = (app) => {
  app.use('/api/v1/forest', router);
  router.use(privateForestApiResponse);
  router.use('/authored-objects', requireForestAuthoredMutationOrigin);
  router.use(optionalAuth);
  router.get('/regions', regionHandler);
  router.get('/authored-regions', authoredRegionHandler);
  router.get('/assets', assetHandler);
  router.get('/trees/:writingTreeId/inspection', inspectionHandler);
  router.patch('/trees/:writingTreeId/inclusion', inclusionHandler);
  router.put('/authored-objects/:objectId', authoredCreateHandler);
  router.patch('/authored-objects/:objectId/placement', authoredMoveHandler);
  router.post('/authored-objects/:objectId/removal', authoredRemovalHandler);
};

export default useForestAPI;
