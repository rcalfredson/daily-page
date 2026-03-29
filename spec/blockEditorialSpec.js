import { normalizeEditorialInput } from '../server/db/editorial.js';

describe('normalizeEditorialInput', () => {
  it('leaves editorial absent when omitted', () => {
    expect(normalizeEditorialInput(undefined)).toEqual({
      value: undefined,
      shouldUnset: false
    });
  });

  it('normalizes valid editorial metadata', () => {
    expect(normalizeEditorialInput({
      clusterKey: '  mechanics  ',
      role: 'pillar',
      primaryPillarBlockId: '507f1f77bcf86cd799439011',
      sequence: '3',
      relatedBlockIds: [
        '507f1f77bcf86cd799439012',
        ' 507f1f77bcf86cd799439012 ',
        '507f1f77bcf86cd799439013'
      ]
    })).toEqual({
      value: {
        clusterKey: 'mechanics',
        role: 'pillar',
        primaryPillarBlockId: '507f1f77bcf86cd799439011',
        sequence: 3,
        relatedBlockIds: [
          '507f1f77bcf86cd799439012',
          '507f1f77bcf86cd799439013'
        ]
      },
      shouldUnset: false
    });
  });

  it('treats empty editorial payloads as removable', () => {
    expect(normalizeEditorialInput({
      clusterKey: '   ',
      role: null,
      primaryPillarBlockId: '',
      sequence: null,
      relatedBlockIds: []
    })).toEqual({
      value: undefined,
      shouldUnset: true
    });
  });

  it('rejects invalid editorial roles', () => {
    expect(() => normalizeEditorialInput({ role: 'hero' }))
      .toThrowError('editorial.role must be pillar, companion, texture, or null.');
  });

  it('rejects invalid related block ids', () => {
    expect(() => normalizeEditorialInput({ relatedBlockIds: ['not-an-id'] }))
      .toThrowError('editorial.relatedBlockIds must contain valid block ids.');
  });
});
