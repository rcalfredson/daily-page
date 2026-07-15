import {
  CORS_ALLOWED_ORIGINS,
  corsOptionsForRequest,
  corsOriginAllowed,
  requestOrigin
} from '../server/services/corsPolicy.js';

function request(protocol, host) {
  return {
    protocol,
    get(header) {
      return header.toLowerCase() === 'host' ? host : undefined;
    }
  };
}

function evaluateOrigin(origin, req) {
  return new Promise(resolve => {
    corsOptionsForRequest(req).origin(origin, (error, allowed) => resolve({ error, allowed }));
  });
}

describe('CORS policy', () => {
  it('allows requests without an Origin header', () => {
    expect(corsOriginAllowed(undefined, request('http', '192.168.1.20:3000'))).toBeTrue();
  });

  it('allows an origin matching the request protocol and LAN host', async () => {
    const req = request('http', '192.168.1.20:3000');
    const result = await evaluateOrigin('http://192.168.1.20:3000', req);

    expect(requestOrigin(req)).toBe('http://192.168.1.20:3000');
    expect(result).toEqual({ error: null, allowed: true });
  });

  it('uses the proxy-aware request protocol when checking the same host', () => {
    const req = request('https', 'preview.example.test');

    expect(corsOriginAllowed('https://preview.example.test', req)).toBeTrue();
    expect(corsOriginAllowed('http://preview.example.test', req)).toBeFalse();
  });

  it('preserves explicitly allowed cross-origin clients', () => {
    const req = request('https', 'api.example.test');

    for (const origin of CORS_ALLOWED_ORIGINS) {
      expect(corsOriginAllowed(origin, req)).toBeTrue();
    }
  });

  it('rejects malformed origins and different hosts or ports', async () => {
    const req = request('http', '192.168.1.20:3000');

    for (const origin of [
      'not an origin',
      'http://192.168.1.21:3000',
      'http://192.168.1.20:4000'
    ]) {
      const { error, allowed } = await evaluateOrigin(origin, req);
      expect(error).toEqual(jasmine.any(Error));
      expect(error.message).toBe('Not allowed by CORS');
      expect(allowed).toBeUndefined();
    }
  });
});
