import crypto from 'node:crypto';
import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import {
  validateForestAuthoredStoredObject, validateForestAuthoredOwnerWorld
} from './forestAuthoredObjectMutation.js';
import {
  inspectForestOwnerTree, ForestOwnerTreeInspectionError
} from './forestOwnerTreeInspection.js';
import { forestReturnTreeId } from '../../public/js/forest-writing-navigation.js';

export const FOREST_AUTHORED_MARKED_DEFAULT_PAGE_SIZE = 25;
export const FOREST_AUTHORED_MARKED_MAX_PAGE_SIZE = 50;
const OWNER_PATTERN = /^[a-f0-9]{24}$/i;

export class ForestAuthoredObjectReadError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ForestAuthoredObjectReadError';
    this.code = code;
  }
}

function fail(code) { throw new ForestAuthoredObjectReadError(code); }

async function lean(query) {
  const result = query.lean();
  return typeof result.exec === 'function' ? result.exec() : result;
}

function ownerId(value) {
  if (typeof value !== 'string' || !OWNER_PATTERN.test(value)) fail('INVALID_AUTHORED_READ_INPUT');
  return value.toLowerCase();
}

function markerId(value) {
  const id = forestReturnTreeId(value);
  if (!id) fail('INVALID_AUTHORED_READ_INPUT');
  return id;
}

function validObject(object, ownerUserId, forestId) {
  if (!object || forestReturnTreeId(object.objectId) !== object.objectId) fail('AUTHORED_READ_UNAVAILABLE');
  validateForestAuthoredStoredObject(object, { ownerUserId, forestId, objectId: object?.objectId });
  return object;
}

function objectPresentation(object) {
  return {
    objectId: object.objectId,
    schemaVersion: object.schemaVersion,
    recordRevision: object.recordRevision,
    placement: { worldX: object.placement.worldX, worldY: object.placement.worldY }
  };
}

function cursorContext(ownerUserId, forestId) {
  return crypto.createHash('sha256').update(JSON.stringify([
    ownerUserId, forestId, 'marked', 1, [1, 2], 1
  ])).digest('base64url').slice(0, 22);
}

function decodeCursor(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.length || value.length > 256) fail('INVALID_AUTHORED_READ_INPUT');
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!cursor || Array.isArray(cursor) || Object.keys(cursor).length !== 3
      || cursor.version !== 1 || !/^[A-Za-z0-9_-]{22}$/.test(cursor.context || '')
      || forestReturnTreeId(cursor.afterObjectId) !== cursor.afterObjectId) throw new Error('cursor');
    return cursor;
  } catch { fail('INVALID_AUTHORED_READ_INPUT'); }
}

export function buildForestAuthoredObjectReadService({
  ForestAuthoredObjectModel = ForestAuthoredObject,
  ForestOwnerWorldModel = ForestOwnerWorld,
  inspectTree = inspectForestOwnerTree
} = {}) {
  async function worldFor(ownerUserId) {
    const world = await lean(ForestOwnerWorldModel.findOne({ ownerUserId, worldRole: 'primary' }));
    if (!world) return null;
    // Reconciliation is an honest temporary state, never source unavailability.
    validateForestAuthoredOwnerWorld(world, ownerUserId, { allowReconciling: true });
    return world;
  }

  async function writingFor(ownerUserId, object, preferredContentLang) {
    if (object.schemaVersion === 1) return { writingState: 'unlinked' };
    try {
      const result = await inspectTree({ ownerUserId,
        writingTreeId: object.writingLink.writingTreeId, preferredContentLang, limit: 1 });
      if (result.status !== 'ready' || result.tree?.id !== object.writingLink.writingTreeId
        || !result.writing) fail('AUTHORED_READ_UNAVAILABLE');
      return { writingState: 'ready', writing: {
        title: result.writing.title.slice(0, 500), lang: result.writing.lang,
        createdAt: result.writing.createdAt, path: result.writing.path
      } };
    } catch (error) {
      if (error instanceof ForestOwnerTreeInspectionError && error.code === 'TREE_INSPECTION_NOT_FOUND') {
        return { writingState: 'unavailable' };
      }
      throw error;
    }
  }

  async function inspect({ ownerUserId: ownerValue, objectId: objectValue, preferredContentLang = 'en' }) {
    const ownerUserId = ownerId(ownerValue);
    const objectId = markerId(objectValue);
    const world = await worldFor(ownerUserId);
    if (!world) fail('AUTHORED_READ_NOT_FOUND');
    if (world.reconciliation.state === 'running') return { inspectionVersion: 1, status: 'reconciling' };
    const object = await lean(ForestAuthoredObjectModel.findOne({
      ownerUserId, forestId: world.forestId, objectId, state: 'active'
    }));
    if (!object || object.state !== 'active') fail('AUTHORED_READ_NOT_FOUND');
    validObject(object, ownerUserId, world.forestId);
    if (object.objectId !== objectId) fail('AUTHORED_READ_UNAVAILABLE');
    return { inspectionVersion: 1, status: 'ready', object: objectPresentation(object),
      ...await writingFor(ownerUserId, object, preferredContentLang) };
  }

  async function listMarked({ ownerUserId: ownerValue, preferredContentLang = 'en', cursor = null,
    limit = FOREST_AUTHORED_MARKED_DEFAULT_PAGE_SIZE }) {
    const ownerUserId = ownerId(ownerValue);
    const decoded = decodeCursor(cursor);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > FOREST_AUTHORED_MARKED_MAX_PAGE_SIZE) {
      fail('INVALID_AUTHORED_READ_INPUT');
    }
    const world = await worldFor(ownerUserId);
    const empty = status => ({ listVersion: 1, status, markers: [],
      page: { returnedMarkerCount: 0, nextCursor: null } });
    if (!world) return empty('not-established');
    if (world.reconciliation.state === 'running') return empty('reconciling');
    const context = cursorContext(ownerUserId, world.forestId);
    if (decoded && decoded.context !== context) fail('INVALID_AUTHORED_READ_INPUT');
    const rows = await lean(ForestAuthoredObjectModel.find({ ownerUserId, forestId: world.forestId,
      schemaVersion: 2, state: 'active',
      ...(decoded ? { objectId: { $gt: decoded.afterObjectId } } : {})
    }).sort({ objectId: 1 }).limit(limit + 1));
    if (!Array.isArray(rows) || rows.length > limit + 1) fail('AUTHORED_READ_UNAVAILABLE');
    const page = rows.slice(0, limit);
    let previous = decoded?.afterObjectId || '';
    for (const object of page) {
      validObject(object, ownerUserId, world.forestId);
      if (object.schemaVersion !== 2 || object.state !== 'active' || object.objectId <= previous) {
        fail('AUTHORED_READ_UNAVAILABLE');
      }
      previous = object.objectId;
    }
    const sources = new Map();
    for (const object of page) {
      const treeId = object.writingLink.writingTreeId;
      if (!sources.has(treeId)) sources.set(treeId, writingFor(ownerUserId, object, preferredContentLang));
    }
    const resolved = new Map(await Promise.all([...sources].map(async ([key, value]) => [key, await value])));
    const markers = page.map(object => ({ object: objectPresentation(object),
      ...resolved.get(object.writingLink.writingTreeId) }));
    return { listVersion: 1, status: 'ready', markers, page: { returnedMarkerCount: markers.length,
      nextCursor: rows.length > limit ? Buffer.from(JSON.stringify({
        version: 1, context, afterObjectId: page.at(-1).objectId
      })).toString('base64url') : null } };
  }

  return Object.freeze({ inspect, listMarked });
}

export const forestAuthoredObjectRead = buildForestAuthoredObjectReadService();
