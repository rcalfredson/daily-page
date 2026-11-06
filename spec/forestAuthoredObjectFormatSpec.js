import { canonicalForestWritingLink, readForestAuthoredObjectFormat } from '../server/services/forestAuthoredObjectFormat.js';
import { createForestAuthoredCreationFingerprint } from '../server/services/forestAuthoredCreationFingerprint.js';

const TREE = '33333333-3333-4333-8333-333333333333';
const LINK = { version: 1, writingTreeId: TREE };
const INPUT = { objectId: '22222222-2222-4222-8222-222222222222', kind: 'personal-marker', worldX: 10, worldY: 20 };

describe('authored marker format and immutable creation encoding', () => {
  it('preserves a fixed version-1 digest and the independently specified version-2 digest', () => {
    expect(createForestAuthoredCreationFingerprint(INPUT)).toEqual({
      version: 1, digest: 'wd8iDT7T6xODveu4vr9AQVlyEb14-0O-Vwi4ZhhYqNA'
    });
    expect(createForestAuthoredCreationFingerprint({ ...INPUT, writingLink: LINK })).toEqual({
      version: 2, digest: 'gKqUQWMGJnEKwgPQqPbzi0zB8hYREhMIt3XruufvJOw'
    });
  });

  it('normalizes request link casing and property order before computing retry identity', () => {
    const expected = createForestAuthoredCreationFingerprint({ ...INPUT, writingLink: LINK });
    expect(createForestAuthoredCreationFingerprint({ ...INPUT,
      writingLink: { writingTreeId: TREE.toUpperCase(), version: 1 }
    })).toEqual(expected);
    expect(canonicalForestWritingLink(LINK)).toEqual(LINK);
    expect(Object.isFrozen(canonicalForestWritingLink(LINK))).toBeTrue();
  });

  it('makes another source or linked versus unlinked intent a different creation', () => {
    const linked = createForestAuthoredCreationFingerprint({ ...INPUT, writingLink: LINK });
    expect(linked).not.toEqual(createForestAuthoredCreationFingerprint(INPUT));
    expect(linked).not.toEqual(createForestAuthoredCreationFingerprint({ ...INPUT,
      writingLink: { ...LINK, writingTreeId: '44444444-4444-4444-8444-444444444444' }
    }));
  });

  it('rejects malformed, future or arbitrary relationship payloads instead of hashing them as ordinary markers', () => {
    for (const writingLink of [null, [], {}, { ...LINK, version: 2 }, { ...LINK, writingTreeId: 'bad' },
      { ...LINK, title: 'private' }]) {
      expect(() => createForestAuthoredCreationFingerprint({ ...INPUT, writingLink })).toThrow();
    }
  });

  it('validates exact stored shapes and distinguishes unsupported versions from malformed combinations', () => {
    expect(readForestAuthoredObjectFormat({ schemaVersion: 1, creationFingerprint: { version: 1 } }).writingLink).toBeNull();
    expect(readForestAuthoredObjectFormat({ schemaVersion: 2, creationFingerprint: { version: 2 }, writingLink: LINK }).writingLink).toEqual(LINK);
    for (const value of [
      { schemaVersion: 1, creationFingerprint: { version: 1 }, writingLink: null },
      { schemaVersion: 1, creationFingerprint: { version: 2 } },
      { schemaVersion: 2, creationFingerprint: { version: 2 } }
    ]) expect(() => readForestAuthoredObjectFormat(value)).toThrowError('INVALID_AUTHORED_OBJECT_FORMAT');
    expect(() => readForestAuthoredObjectFormat({ schemaVersion: 3 })).toThrowError('UNSUPPORTED_AUTHORED_OBJECT_SCHEMA');
    expect(() => readForestAuthoredObjectFormat({ schemaVersion: 2, creationFingerprint: { version: 2 },
      writingLink: { ...LINK, version: 3 }
    })).toThrowError('UNSUPPORTED_AUTHORED_WRITING_LINK_VERSION');
  });
});
