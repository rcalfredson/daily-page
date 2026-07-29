import {
  FOREST_TRANSLATION_DISCOVERY,
  FOREST_WRITING_CLASSIFICATIONS,
  FOREST_WRITING_REASON_CODES,
  classifyForestOwnerWriting,
  classifyForestTranslationDiscovery
} from '../server/services/forestOwnerWritingPolicy.js';

const OWNER_ID = '64b000000000000000000001';
const OTHER_OWNER_ID = '64b000000000000000000002';
const BLOCK_ID = '65c000000000000000000001';
const GROUP_ID = '66d000000000000000000001';

function block(overrides = {}) {
  return {
    recordType: 'Block',
    blockId: BLOCK_ID,
    userId: OWNER_ID,
    groupId: GROUP_ID,
    status: 'in-progress',
    visibility: 'unlisted',
    authorshipState: 'live',
    lang: 'en',
    ...overrides
  };
}

function ownerDecision(record = block()) {
  return classifyForestOwnerWriting({ authenticatedOwnerId: OWNER_ID, record });
}

function translationDecision(record = block()) {
  return classifyForestTranslationDiscovery({ authenticatedOwnerId: OWNER_ID, record });
}

describe('forest owner-writing policy', () => {
  it('accepts every supported owner status and visibility combination', () => {
    for (const status of ['in-progress', 'locked']) {
      for (const visibility of ['public', 'unlisted']) {
        expect(ownerDecision(block({ status, visibility }))).toEqual({
          policyVersion: 2,
          classification: FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE,
          reasonCode: FOREST_WRITING_REASON_CODES.ELIGIBLE_OWNER_BLOCK,
          logicalIdentity: {
            ownerUserId: OWNER_ID,
            translationGroupId: GROUP_ID
          }
        });
      }
    }
  });

  it('uses owner and translation group as identity rather than block or language', () => {
    const english = ownerDecision();
    const hindi = ownerDecision(block({
      blockId: '65c000000000000000000002',
      lang: 'hi'
    }));

    expect(hindi.logicalIdentity).toEqual(english.logicalIdentity);
    expect(JSON.stringify(hindi)).not.toContain('65c000000000000000000002');
    expect(JSON.stringify(hindi)).not.toContain('"hi"');
  });

  it('fails closed for legacy, mismatched, and invalid ownership evidence', () => {
    expect(ownerDecision(block({ userId: undefined }))).toEqual(jasmine.objectContaining({
      classification: FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      reasonCode: FOREST_WRITING_REASON_CODES.LEGACY_OWNERSHIP_UNRESOLVED,
      logicalIdentity: null
    }));
    expect(ownerDecision(block({ userId: OTHER_OWNER_ID }))).toEqual(jasmine.objectContaining({
      classification: FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE,
      reasonCode: FOREST_WRITING_REASON_CODES.OWNER_MISMATCH,
      logicalIdentity: null
    }));
    expect(ownerDecision(block({ userId: 'legacy-username' }))).toEqual(jasmine.objectContaining({
      classification: FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      reasonCode: FOREST_WRITING_REASON_CODES.INVALID_RECORD_OWNER,
      logicalIdentity: null
    }));
  });

  it('never treats a deletion-retained post as owner writing', () => {
    for (const state of ['deleted-author', 'anonymous']) {
      expect(ownerDecision(block({
        userId: undefined,
        authorshipState: state,
        visibility: 'public'
      }))).toEqual(jasmine.objectContaining({
        policyVersion: 2,
        classification: FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE,
        reasonCode: FOREST_WRITING_REASON_CODES.NON_LIVE_AUTHORSHIP,
        logicalIdentity: null
      }));
      expect(ownerDecision(block({ authorshipState: state }))).toEqual(jasmine.objectContaining({
        classification: FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE,
        reasonCode: FOREST_WRITING_REASON_CODES.NON_LIVE_AUTHORSHIP
      }));
    }
  });

  it('does not admit creator or collaborator fields into the ownership boundary', () => {
    expect(() => ownerDecision({
      ...block({ userId: OTHER_OWNER_ID }),
      creator: 'matching-name'
    })).toThrowError(/unsupported fields: creator/);
    expect(() => ownerDecision({
      ...block({ userId: OTHER_OWNER_ID }),
      collaborators: ['matching-name']
    })).toThrowError(/unsupported fields: collaborators/);
  });

  it('classifies unsupported records and malformed supported evidence without guessing', () => {
    expect(ownerDecision(block({ recordType: 'Page' }))).toEqual(jasmine.objectContaining({
      classification: FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE,
      reasonCode: FOREST_WRITING_REASON_CODES.UNSUPPORTED_RECORD_TYPE
    }));

    for (const [overrides, reasonCode] of [
      [{ blockId: 'not-an-object-id' }, FOREST_WRITING_REASON_CODES.INVALID_BLOCK_IDENTITY],
      [{ groupId: '' }, FOREST_WRITING_REASON_CODES.INVALID_GROUP_IDENTITY],
      [{ lang: 'english' }, FOREST_WRITING_REASON_CODES.INVALID_LANGUAGE],
      [{ status: 'archived' }, FOREST_WRITING_REASON_CODES.UNSUPPORTED_STATUS],
      [{ visibility: 'private' }, FOREST_WRITING_REASON_CODES.UNSUPPORTED_VISIBILITY]
    ]) {
      expect(ownerDecision(block(overrides))).toEqual(jasmine.objectContaining({
        classification: FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
        reasonCode,
        logicalIdentity: null
      }));
    }
  });

  it('keeps translation discovery separate from owner tree eligibility', () => {
    const cases = [
      [block(), FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
        FOREST_WRITING_REASON_CODES.OWNER_TRANSLATION_AVAILABLE],
      [block({ userId: OTHER_OWNER_ID, visibility: 'public', status: 'in-progress' }),
        FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
        FOREST_WRITING_REASON_CODES.PUBLIC_TRANSLATION_DISCOVERABLE],
      [block({ userId: OTHER_OWNER_ID, visibility: 'public', status: 'locked' }),
        FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
        FOREST_WRITING_REASON_CODES.PUBLIC_TRANSLATION_DISCOVERABLE],
      [block({ userId: OTHER_OWNER_ID, visibility: 'unlisted', status: 'locked' }),
        FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
        FOREST_WRITING_REASON_CODES.LOCKED_UNLISTED_TRANSLATION_DISCOVERABLE],
      [block({ userId: OTHER_OWNER_ID, visibility: 'unlisted', status: 'in-progress' }),
        FOREST_TRANSLATION_DISCOVERY.HIDDEN,
        FOREST_WRITING_REASON_CODES.UNLISTED_IN_PROGRESS_TRANSLATION_HIDDEN]
    ];

    for (const [record, classification, reasonCode] of cases) {
      expect(translationDecision(record)).toEqual({
        policyVersion: 2,
        classification,
        reasonCode
      });
    }

    expect(ownerDecision(block({ userId: OTHER_OWNER_ID, status: 'locked' })).classification)
      .toBe(FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE);
  });

  it('does not reveal malformed or unsupported translations', () => {
    expect(translationDecision(block({ userId: undefined }))).toEqual({
      policyVersion: 2,
      classification: FOREST_TRANSLATION_DISCOVERY.UNRESOLVED,
      reasonCode: FOREST_WRITING_REASON_CODES.LEGACY_OWNERSHIP_UNRESOLVED
    });
    expect(translationDecision(block({ recordType: 'Page' }))).toEqual({
      policyVersion: 2,
      classification: FOREST_TRANSLATION_DISCOVERY.HIDDEN,
      reasonCode: FOREST_WRITING_REASON_CODES.UNSUPPORTED_RECORD_TYPE
    });
  });

  it('keeps retained public writing discoverable without restoring ownership', () => {
    for (const authorshipState of ['deleted-author', 'anonymous']) {
      expect(translationDecision(block({
        userId: undefined,
        authorshipState,
        visibility: 'public',
        status: 'in-progress'
      }))).toEqual({
        policyVersion: 2,
        classification: FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
        reasonCode: FOREST_WRITING_REASON_CODES.PUBLIC_TRANSLATION_DISCOVERABLE
      });
      expect(translationDecision(block({
        userId: undefined,
        authorshipState,
        visibility: 'unlisted',
        status: 'locked'
      }))).toEqual({
        policyVersion: 2,
        classification: FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
        reasonCode: FOREST_WRITING_REASON_CODES.LOCKED_UNLISTED_TRANSLATION_DISCOVERABLE
      });
      expect(translationDecision(block({
        userId: undefined,
        authorshipState,
        visibility: 'unlisted',
        status: 'in-progress'
      }))).toEqual({
        policyVersion: 2,
        classification: FOREST_TRANSLATION_DISCOVERY.HIDDEN,
        reasonCode: FOREST_WRITING_REASON_CODES.UNLISTED_IN_PROGRESS_TRANSLATION_HIDDEN
      });
    }
  });

  it('fails closed on inconsistent or unknown authorship state', () => {
    expect(translationDecision(block({ authorshipState: 'anonymous' }))).toEqual({
      policyVersion: 2,
      classification: FOREST_TRANSLATION_DISCOVERY.UNRESOLVED,
      reasonCode: FOREST_WRITING_REASON_CODES.INVALID_RECORD_OWNER
    });
    expect(ownerDecision(block({ authorshipState: 'future-state' }))).toEqual(
      jasmine.objectContaining({
        classification: FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
        reasonCode: FOREST_WRITING_REASON_CODES.UNSUPPORTED_AUTHORSHIP_STATE
      })
    );
  });

  it('requires a bounded exact caller-owned input shape', () => {
    expect(() => classifyForestOwnerWriting({
      authenticatedOwnerId: 'owner-name',
      record: block()
    })).toThrowError(/authenticatedOwnerId/);
    expect(() => classifyForestOwnerWriting({
      authenticatedOwnerId: OWNER_ID,
      record: block(),
      routeOwnerId: OTHER_OWNER_ID
    })).toThrowError(/unsupported fields: routeOwnerId/);
    expect(() => ownerDecision({ ...block(), title: 'Private title' }))
      .toThrowError(/unsupported fields: title/);
  });
});
