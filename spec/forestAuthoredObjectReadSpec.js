import express from 'express';
import { inject } from './support/inject.js';
import { buildForestAuthoredObjectReadService } from '../server/services/forestAuthoredObjectRead.js';
import { ForestOwnerTreeInspectionError } from '../server/services/forestOwnerTreeInspection.js';
import { buildForestAuthoredInspectionRouteHandler, privateForestApiResponse, requireForestAuthoredMutationOrigin } from '../server/api/v1/forest.js';
import { buildForestAuthoredReturnDestinationService } from '../server/services/forestAuthoredReturnDestination.js';
import { FOREST_OWNER_SCENE_SPAWN as SPAWN } from '../server/services/forestOwnerSceneBootstrap.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREIGN = '507f1f77bcf86cd799439012';
const FOREST = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const LATER = '33333333-3333-4333-8333-333333333333';
const TREE = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-11-03T12:00:00Z');
function world(overrides = {}) {
  return { schemaVersion: 1, ownerUserId: OWNER, forestId: FOREST, worldRole: 'primary',
    status: 'active', reconciliation: { state: 'idle' }, worldSeed: 'abcdefghijklmnopqrstuvwxyzABCDEF',
    placementPolicyVersion: 1, environmentPolicyVersion: 1, environmentSchemaVersion: 1,
    worldGenerationVersion: 1, ...overrides };
}
function marker(overrides = {}) {
  return { schemaVersion: 2, identityVersion: 1, objectId: OBJECT, ownerUserId: OWNER,
    forestId: FOREST, kind: 'personal-marker', state: 'active',
    placement: { worldX: -1440, worldY: 1440 }, placementIndex: { version: 1, cellX: -2, cellY: 2 },
    appearance: { id: 'quiet-waymarker', version: 1 }, recordRevision: 7,
    writingLink: { version: 1, writingTreeId: TREE }, creationFingerprint: { version: 2, digest: 'A'.repeat(43) },
    worldVersionEvidence: { ownerWorldSchemaVersion: 1, placementPolicyVersion: 1,
      environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1 },
    createdAt: NOW, changedAt: NOW, removedAt: null, purgeEligibleAt: null, ...overrides };
}
function query(value) {
  const q = { lean: () => Promise.resolve(value), sort: jasmine.createSpy('sort').and.callFake(() => q),
    limit: jasmine.createSpy('limit').and.callFake(() => q) };
  return q;
}
function harness({ object = marker(), objects = [marker()], ownerWorld = world() } = {}) {
  const listQuery = query(objects);
  const ForestAuthoredObjectModel = { findOne: jasmine.createSpy('findOne').and.callFake(() => query(object)),
    find: jasmine.createSpy('find').and.returnValue(listQuery) };
  const ForestOwnerWorldModel = { findOne: jasmine.createSpy('world.findOne').and.returnValue(query(ownerWorld)) };
  const inspectTree = jasmine.createSpy('inspectTree').and.resolveTo({ status: 'ready', tree: { id: TREE },
    writing: { title: 'A remembered walk', lang: 'en', createdAt: NOW, path: '/rooms/general/blocks/507f1f77bcf86cd799439013' } });
  return { ...buildForestAuthoredObjectReadService({ ForestAuthoredObjectModel, ForestOwnerWorldModel, inspectTree }),
    ForestAuthoredObjectModel, ForestOwnerWorldModel, inspectTree, listQuery };
}

describe('writing-linked marker reads', () => {
  it('inspects an active owner marker with current authorized writing and an exact public shape', async () => {
    const test = harness();
    const result = await test.inspect({ ownerUserId: OWNER, objectId: OBJECT, preferredContentLang: 'es' });
    expect(result).toEqual({ inspectionVersion: 1, status: 'ready',
      object: { objectId: OBJECT, schemaVersion: 2, recordRevision: 7, placement: { worldX: -1440, worldY: 1440 } },
      writingState: 'ready', writing: { title: 'A remembered walk', lang: 'en', createdAt: NOW,
        path: '/rooms/general/blocks/507f1f77bcf86cd799439013' } });
    expect(test.ForestAuthoredObjectModel.findOne).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER, forestId: FOREST, objectId: OBJECT, state: 'active' });
    expect(test.inspectTree).toHaveBeenCalledOnceWith({ ownerUserId: OWNER, writingTreeId: TREE,
      preferredContentLang: 'es', limit: 1 });
    expect(JSON.stringify(result)).not.toContain(TREE);
    expect(JSON.stringify(result)).not.toContain(OWNER);
  });

  it('reads a newly inserted marker when persistence time follows the mutation timestamp', async () => {
    const object = marker({ changedAt: NOW, createdAt: new Date(NOW.getTime() + 75) });
    const before = JSON.stringify(object);
    const test = harness({ object, objects: [object] });
    const listed = await test.listMarked({ ownerUserId: OWNER });
    expect(listed.markers[0].object.objectId).toBe(OBJECT);
    expect(listed.markers[0].writingState).toBe('ready');
    expect((await test.inspect({ ownerUserId: OWNER, objectId: OBJECT })).writingState).toBe('ready');
    expect(JSON.stringify(object)).toBe(before);
  });

  it('does no source lookup for ordinary markers', async () => {
    const ordinary = marker({ schemaVersion: 1, creationFingerprint: { version: 1, digest: 'A'.repeat(43) } });
    delete ordinary.writingLink;
    const test = harness({ object: ordinary });
    const result = await test.inspect({ ownerUserId: OWNER, objectId: OBJECT });
    expect(result.writingState).toBe('unlinked');
    expect(Object.hasOwn(result, 'writing')).toBeFalse();
    expect(test.inspectTree).not.toHaveBeenCalled();
  });

  it('keeps generic unavailable-source rows while failing honestly on infrastructure failures', async () => {
    const test = harness();
    test.inspectTree.and.rejectWith(new ForestOwnerTreeInspectionError('TREE_INSPECTION_NOT_FOUND', 'private reason'));
    const result = await test.inspect({ ownerUserId: OWNER, objectId: OBJECT });
    expect(result.writingState).toBe('unavailable');
    expect(Object.hasOwn(result, 'writing')).toBeFalse();
    expect(JSON.stringify(result)).not.toContain('private reason');
    test.inspectTree.and.rejectWith(new Error('database unavailable'));
    await expectAsync(test.inspect({ ownerUserId: OWNER, objectId: OBJECT })).toBeRejectedWithError('database unavailable');
    test.inspectTree.and.resolveTo({ status: 'reconciling' });
    await expectAsync(test.inspect({ ownerUserId: OWNER, objectId: OBJECT }))
      .toBeRejectedWith(jasmine.objectContaining({ code: 'AUTHORED_READ_UNAVAILABLE' }));
  });

  it('rejects absent, removed, foreign and malformed marker state before source resolution', async () => {
    for (const object of [null, marker({ state: 'removed' }), marker({ ownerUserId: FOREIGN }),
      marker({ schemaVersion: 3 }), marker({ writingLink: null }),
      marker({ placement: { worldX: 1e9 + 1, worldY: 1440 } }), marker({ changedAt: new Date('invalid') })]) {
      const test = harness({ object });
      await expectAsync(test.inspect({ ownerUserId: OWNER, objectId: OBJECT })).toBeRejected();
      expect(test.inspectTree).not.toHaveBeenCalled();
    }
  });

  it('bounds marked rows, deduplicates source authorization and retains each unavailable marker', async () => {
    const test = harness({ objects: [marker(), marker({ objectId: LATER })] });
    test.inspectTree.and.rejectWith(new ForestOwnerTreeInspectionError('TREE_INSPECTION_NOT_FOUND', 'private'));
    const result = await test.listMarked({ ownerUserId: OWNER });
    expect(result.markers.length).toBe(2);
    expect(result.markers.every(row => row.writingState === 'unavailable')).toBeTrue();
    expect(test.inspectTree).toHaveBeenCalledTimes(1);
    expect(test.listQuery.limit).toHaveBeenCalledOnceWith(26);
    expect(test.ForestAuthoredObjectModel.find).toHaveBeenCalledOnceWith({ ownerUserId: OWNER,
      forestId: FOREST, schemaVersion: 2, state: 'active' });
  });

  it('binds marked continuations to owner/world and resumes by stable object id', async () => {
    const first = await harness({ objects: [marker(), marker({ objectId: LATER })] })
      .listMarked({ ownerUserId: OWNER, limit: 1 });
    const cursor = first.page.nextCursor;
    const next = harness({ objects: [marker({ objectId: LATER })] });
    expect((await next.listMarked({ ownerUserId: OWNER, cursor, limit: 1 })).markers[0].object.objectId).toBe(LATER);
    expect(next.ForestAuthoredObjectModel.find.calls.first().args[0].objectId).toEqual({ $gt: OBJECT });
    for (const [test, ownerUserId] of [[harness({ ownerWorld: world({ ownerUserId: FOREIGN }) }), FOREIGN],
      [harness({ ownerWorld: world({ forestId: TREE }) }), OWNER]]) {
      await expectAsync(test.listMarked({ ownerUserId, cursor }))
        .toBeRejectedWith(jasmine.objectContaining({ code: 'INVALID_AUTHORED_READ_INPUT' }));
      expect(test.ForestAuthoredObjectModel.find).not.toHaveBeenCalled();
    }
  });

  it('rejects invalid inputs before reads and bounds the complete list result', async () => {
    for (const input of [{ limit: 51 }, { limit: '25' }, { cursor: [] }, { cursor: 'bad' }]) {
      const test = harness();
      await expectAsync(test.listMarked({ ownerUserId: OWNER, ...input })).toBeRejected();
      expect(test.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();
    }
    await expectAsync(harness({ objects: [marker(), marker(), marker()] })
      .listMarked({ ownerUserId: OWNER, limit: 1 })).toBeRejected();
  });

  it('reports unestablished and reconciling lists without marker or source reads', async () => {
    for (const ownerWorld of [null, world({ reconciliation: { state: 'running' } })]) {
      const test = harness({ ownerWorld });
      const result = await test.listMarked({ ownerUserId: OWNER });
      expect(result.markers).toEqual([]);
      expect(test.ForestAuthoredObjectModel.find).not.toHaveBeenCalled();
      expect(test.inspectTree).not.toHaveBeenCalled();
    }
  });
});

function response() {
  return { locals: {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}
describe('marker inspection API', () => {
  it('derives authority from the session and rejects extra authority queries before reads', async () => {
    const inspect = jasmine.createSpy('inspect').and.resolveTo({ inspectionVersion: 1, status: 'ready' });
    const route = buildForestAuthoredInspectionRouteHandler({ inspect });
    const req = { user: { id: OWNER }, params: { objectId: OBJECT }, query: {} };
    const res = response();
    await route(req, res);
    expect(res.statusCode).toBe(200);
    expect(inspect).toHaveBeenCalledOnceWith({ ownerUserId: OWNER, objectId: OBJECT, preferredContentLang: 'en' });
    inspect.calls.reset();
    const extra = response();
    await route({ ...req, query: { ownerUserId: FOREIGN } }, extra);
    expect(extra.statusCode).toBe(400);
    const anon = response();
    await route({ ...req, user: null }, anon);
    expect(anon.statusCode).toBe(401);
    expect(inspect).not.toHaveBeenCalled();
  });
});

describe('marker return destination', () => {
  function returning({ object = marker(), unchanged = true, pages = [{ status: 'ready', placements: [], page: { nextCursor: null } }] } = {}) {
    const ForestAuthoredObjectModel = { findOne: jasmine.createSpy('findOne').and.callFake(filter =>
      query(filter.recordRevision ? unchanged && { _id: 'marker' } : object)) };
    const readManifest = jasmine.createSpy('readManifest').and.callFake(async () => pages.shift());
    const resolve = buildForestAuthoredReturnDestinationService({ ForestAuthoredObjectModel, readManifest });
    return { ForestAuthoredObjectModel, readManifest, resolve: (overrides = {}) => resolve({
      ownerUserId: OWNER, forestId: FOREST, objectId: OBJECT, spawn: SPAWN, cellSize: 720, ...overrides }) };
  }
  it('uses the current marker place without consulting its writing and checks the revision after loading', async () => {
    const test = returning();
    const result = await test.resolve();
    expect(result).toEqual({ markerId: OBJECT, spawn: { ...SPAWN, worldX: -1440, worldY: 1468 } });
    expect(test.ForestAuthoredObjectModel.findOne.calls.first().args[0]).toEqual({
      ownerUserId: OWNER, forestId: FOREST, objectId: OBJECT, state: 'active' });
    expect(test.ForestAuthoredObjectModel.findOne.calls.mostRecent().args[0].recordRevision).toBe(7);
  });
  it('falls back for absent, foreign, unsupported, moved or removed markers', async () => {
    for (const options of [{ object: null }, { object: marker({ ownerUserId: FOREIGN }) },
      { object: marker({ schemaVersion: 3 }) }, { unchanged: false }]) {
      expect(await returning(options).resolve()).toBeNull();
    }
  });
  it('finishes collision pagination and avoids nearby writing trees', async () => {
    const blocker = { worldX: -1440, worldY: 1468, collisionRadius: 20 };
    const test = returning({ pages: [
      { status: 'ready', placements: [blocker], page: { nextCursor: 'two' } },
      { status: 'ready', placements: [], page: { nextCursor: null } }
    ] });
    const result = await test.resolve();
    expect(Math.hypot(result.spawn.worldX - blocker.worldX, result.spawn.worldY - blocker.worldY)).toBeGreaterThanOrEqual(31);
    expect(test.readManifest.calls.mostRecent().args[0].cursor).toBe('two');
  });
  it('never chooses a spawn with incomplete collision evidence or an invalid locator', async () => {
    const test = returning({ pages: Array.from({ length: 4 }, () => ({
      status: 'ready', placements: [], page: { nextCursor: 'more' } })) });
    expect(await test.resolve()).toBeNull();
    expect(test.readManifest).toHaveBeenCalledTimes(4);
    const invalid = returning();
    expect(await invalid.resolve({ objectId: ['bad'] })).toBeNull();
    expect(invalid.ForestAuthoredObjectModel.findOne).not.toHaveBeenCalled();
  });
});

// Mount the shared prefix guard before authentication, as the production router does.
// Calling the inspection handler alone cannot detect a write guard intercepting its GET.
describe('marker inspection through the authored API middleware', () => {
  function application(authenticated = true) {
    const app = express();
    const inspection = { inspectionVersion: 1, status: 'ready', object: { objectId: OBJECT, recordRevision: 7 },
      writingState: 'ready', writing: { title: 'A remembered walk', path: '/rooms/general/blocks/507f1f77bcf86cd799439013' } };
    const inspect = jasmine.createSpy('inspect').and.resolveTo(inspection);
    const authenticate = jasmine.createSpy('authenticate').and.callFake((req, res, next) => {
      req.user = authenticated ? { id: OWNER } : null;
      next();
    });
    app.use('/api/v1/forest', privateForestApiResponse);
    app.use('/api/v1/forest/authored-objects', requireForestAuthoredMutationOrigin);
    app.use(authenticate);
    app.get('/api/v1/forest/authored-objects/:objectId/inspection', buildForestAuthoredInspectionRouteHandler({ inspect }));
    return { app, inspect, authenticate, inspection };
  }

  it('allows authenticated read requests without Origin or JSON headers', async () => {
    const test = application();
    for (const method of ['GET', 'HEAD']) {
      const result = await inject(test.app, `/api/v1/forest/authored-objects/${OBJECT}/inspection`, { method });
      expect(result.status).toBe(200);
      expect(result.headers['cache-control']).toBe('private, no-store');
      expect(result.headers.vary).toContain('Cookie');
      if (method === 'GET') expect(JSON.parse(result.body)).toEqual(test.inspection);
    }
    expect(test.inspect).toHaveBeenCalledTimes(2);
  });

  it('still requires authentication for marker inspection', async () => {
    const test = application(false);
    const result = await inject(test.app, `/api/v1/forest/authored-objects/${OBJECT}/inspection`);
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).code).toBe('AUTHENTICATION_REQUIRED');
    expect(test.inspect).not.toHaveBeenCalled();
  });

  it('continues rejecting untrusted or non-JSON writes before authentication', async () => {
    const test = application();
    for (const method of ['PUT', 'PATCH', 'POST']) {
      for (const headers of [{}, { origin: 'https://foreign.example.test' }]) {
        const result = await inject(test.app, `/api/v1/forest/authored-objects/${OBJECT}`, { method, headers });
        expect(result.status).toBe(403);
        expect(JSON.parse(result.body).code).toBe('FOREST_AUTHORED_MUTATION_ORIGIN_REQUIRED');
      }
      const nonJson = await inject(test.app, `/api/v1/forest/authored-objects/${OBJECT}`, {
        method, headers: { origin: 'http://dailypage.org' }
      });
      expect(nonJson.status).toBe(415);
    }
    expect(test.authenticate).not.toHaveBeenCalled();
    expect(test.inspect).not.toHaveBeenCalled();
  });
});
