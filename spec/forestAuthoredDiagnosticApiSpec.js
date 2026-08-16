import {
  buildForestAuthoredDiagnosticRouteHandler
} from '../server/api/v1/forest.js';
import {
  ForestAuthoredDiagnosticExportError
} from '../server/services/forestAuthoredDiagnosticExport.js';

const OWNER = '507f1f77bcf86cd799439011';
const OTHER_OWNER = '507f1f77bcf86cd799439012';

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe('forest authored diagnostic API', () => {
  it('rejects missing or stale authentication before parsing or private reads', async () => {
    const readDiagnostic = jasmine.createSpy('readDiagnostic');
    const handler = buildForestAuthoredDiagnosticRouteHandler({ readDiagnostic });
    const res = response();

    await handler({ user: null, query: { includeRemoved: 'invalid' } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(readDiagnostic).not.toHaveBeenCalled();
  });

  it('derives owner authority from the session and parses an exact explicit query', async () => {
    const diagnostic = {
      exportVersion: 1,
      status: 'ready',
      objects: [],
      page: { returnedObjectCount: 0, nextCursor: null }
    };
    const readDiagnostic = jasmine.createSpy('readDiagnostic').and.resolveTo(diagnostic);
    const handler = buildForestAuthoredDiagnosticRouteHandler({ readDiagnostic });
    const res = response();

    await handler({
      user: { id: OWNER },
      query: { includeRemoved: 'true', cursor: 'opaque', limit: '25' },
      body: { ownerUserId: OTHER_OWNER }
    }, res);

    expect(readDiagnostic).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER,
      includeRemoved: true,
      cursor: 'opaque',
      limit: '25'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(diagnostic);
  });

  it('requires explicit inclusion and rejects repeated or unsupported fields before reads',
    async () => {
      for (const query of [
        {},
        { includeRemoved: true },
        { includeRemoved: 'yes' },
        { includeRemoved: ['true', 'false'] },
        { includeRemoved: 'false', cursor: ['one', 'two'] },
        { includeRemoved: 'false', limit: ['10', '20'] },
        { includeRemoved: 'false', ownerUserId: OTHER_OWNER }
      ]) {
        const readDiagnostic = jasmine.createSpy('readDiagnostic');
        const handler = buildForestAuthoredDiagnosticRouteHandler({ readDiagnostic });
        const res = response();

        await handler({ user: { id: OWNER }, query }, res);

        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('INVALID_FOREST_AUTHORED_DIAGNOSTIC_REQUEST');
        expect(readDiagnostic).not.toHaveBeenCalled();
      }
    });

  it('maps migration and unavailable failures without leaking private detail', async () => {
    const privateDetail = `${OWNER}:private-coordinate`;
    const migration = buildForestAuthoredDiagnosticRouteHandler({
      readDiagnostic: jasmine.createSpy('readDiagnostic').and.rejectWith(
        new ForestAuthoredDiagnosticExportError(
          'AUTHORED_DIAGNOSTIC_MIGRATION_REQUIRED', privateDetail
        )
      )
    });
    const migrationResponse = response();

    await migration({ user: { id: OWNER }, query: { includeRemoved: 'true' } }, migrationResponse);

    expect(migrationResponse.statusCode).toBe(409);
    expect(migrationResponse.body.code).toBe('FOREST_AUTHORED_MIGRATION_REQUIRED');
    expect(JSON.stringify(migrationResponse.body)).not.toContain(privateDetail);

    spyOn(console, 'error');
    const unavailable = buildForestAuthoredDiagnosticRouteHandler({
      readDiagnostic: jasmine.createSpy('readDiagnostic').and.rejectWith(
        new ForestAuthoredDiagnosticExportError('AUTHORED_DIAGNOSTIC_UNAVAILABLE', privateDetail)
      )
    });
    const unavailableResponse = response();

    await unavailable(
      { user: { id: OWNER }, query: { includeRemoved: 'false' } },
      unavailableResponse
    );

    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.body.code).toBe('FOREST_AUTHORED_DIAGNOSTIC_UNAVAILABLE');
    expect(JSON.stringify(console.error.calls.allArgs())).not.toContain(privateDetail);
  });
});
