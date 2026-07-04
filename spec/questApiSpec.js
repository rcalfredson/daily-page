import { buildQuestApiHandlers } from '../server/api/v1/quests.js';
import { QUEST_ERROR_CODES, questError } from '../server/db/questErrors.js';

function response() {
  return {
    locals: { uiLang: 'en' },
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function submissionDTO(id = 'submission-1') {
  return { id, status: 'draft', reviewHistory: [] };
}

function makeHandlers(overrides = {}) {
  const services = {
    claimItem: jasmine.createSpy('claimItem').and.resolveTo({
      _id: 'item-1', questId: 'quest-1', key: 'tioga-pa', label: 'Tioga, PA'
    }),
    releaseItem: jasmine.createSpy('releaseItem').and.resolveTo({
      _id: 'item-1', questId: 'quest-1', key: 'tioga-pa', label: 'Tioga, PA'
    }),
    createSubmission: jasmine.createSpy('createSubmission').and.resolveTo({ _id: 'submission-1' }),
    submitSubmission: jasmine.createSpy('submitSubmission').and.resolveTo({ _id: 'submission-1' }),
    requestChanges: jasmine.createSpy('requestChanges').and.resolveTo({ _id: 'submission-1' }),
    reopenSubmission: jasmine.createSpy('reopenSubmission').and.resolveTo({ _id: 'submission-1' }),
    approveSubmission: jasmine.createSpy('approveSubmission').and.resolveTo({
      submission: { _id: 'submission-1' }, questCompleted: false
    }),
    rejectSubmission: jasmine.createSpy('rejectSubmission').and.resolveTo({ _id: 'submission-1' }),
    withdrawSubmission: jasmine.createSpy('withdrawSubmission').and.resolveTo({ _id: 'submission-1' }),
    startRevision: jasmine.createSpy('startRevision').and.resolveTo({
      replacementSubmission: { _id: 'submission-2' }
    }),
    revokeSubmission: jasmine.createSpy('revokeSubmission').and.resolveTo({ _id: 'submission-1' }),
    getSubmission: jasmine.createSpy('getSubmission').and.callFake(async ({ submissionId }) =>
      submissionDTO(String(submissionId))
    ),
    listMine: jasmine.createSpy('listMine').and.resolveTo({ submissions: [], total: 0 }),
    listReviewQueue: jasmine.createSpy('listReviewQueue').and.resolveTo({ submissions: [], total: 0 }),
    ...overrides
  };
  return { handlers: buildQuestApiHandlers(services), services };
}

describe('quest workflow API handlers', () => {
  it('rejects unauthenticated mutations before calling domain services', async () => {
    const { handlers, services } = makeHandlers();
    const res = response();
    await handlers.claim({ user: null, params: { questId: 'quest-1', itemId: 'item-1' } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(services.claimItem).not.toHaveBeenCalled();
  });

  it('takes claimant and owner identity only from the authenticated session', async () => {
    const { handlers, services } = makeHandlers();
    const claimRes = response();
    await handlers.claim({
      user: { id: 'session-user' },
      params: { questId: 'quest-1', itemId: 'item-1' },
      body: { userId: 'forged-user' }
    }, claimRes);
    expect(services.claimItem).toHaveBeenCalledWith({
      questId: 'quest-1', itemId: 'item-1', userId: 'session-user'
    });

    const createRes = response();
    await handlers.createSubmission({
      user: { id: 'session-user' },
      params: { questId: 'quest-1' },
      body: { blockId: 'block-1', itemId: 'item-1', ownerUserId: 'forged-user' }
    }, createRes);
    expect(services.createSubmission).toHaveBeenCalledWith({
      questId: 'quest-1',
      itemId: 'item-1',
      blockId: 'block-1',
      ownerUserId: 'session-user'
    });
    expect(createRes.statusCode).toBe(201);
  });

  it('uses the authenticated reviewer for administrator decisions', async () => {
    const { handlers, services } = makeHandlers();
    const res = response();
    await handlers.approve({
      user: { id: 'admin-1' },
      params: { submissionId: 'submission-1' },
      body: { administratorUserId: 'forged-admin', comment: 'Looks good.' }
    }, res);
    expect(services.approveSubmission).toHaveBeenCalledWith({
      submissionId: 'submission-1',
      administratorUserId: 'admin-1',
      comment: 'Looks good.'
    });
    expect(res.body.submission.id).toBe('submission-1');
  });

  it('scopes review queue reads to the authenticated administrator', async () => {
    const { handlers, services } = makeHandlers();
    const res = response();
    await handlers.listReviewQueue({
      user: { id: 'admin-1' },
      params: { questId: 'quest-1' },
      query: { page: '2', limit: '10' }
    }, res);
    expect(services.listReviewQueue).toHaveBeenCalledWith({
      administratorUserId: 'admin-1',
      questId: 'quest-1',
      page: '2',
      limit: '10',
      uiLang: 'en'
    });
  });

  it('returns stable typed domain errors for client handling', async () => {
    const claimItem = jasmine.createSpy('claimItem').and.rejectWith(
      questError(QUEST_ERROR_CODES.ITEM_UNAVAILABLE, {
        status: 409, details: { reason: 'already-claimed' }
      })
    );
    const { handlers } = makeHandlers({ claimItem });
    const res = response();
    await handlers.claim({
      user: { id: 'user-1' },
      params: { questId: 'quest-1', itemId: 'item-1' }
    }, res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'QUEST_ITEM_UNAVAILABLE',
      code: 'QUEST_ITEM_UNAVAILABLE',
      details: { reason: 'already-claimed' }
    });
  });

  it('reports a committed mutation as successful when response hydration fails afterward', async () => {
    spyOn(console, 'error');
    const committed = { _id: 'submission-1', status: 'pending', reviewHistory: [] };
    const submitSubmission = jasmine.createSpy('submitSubmission').and.resolveTo(committed);
    const getSubmission = jasmine.createSpy('getSubmission')
      .and.rejectWith(new Error('read replica unavailable'));
    const { handlers } = makeHandlers({ submitSubmission, getSubmission });
    const res = response();

    await handlers.submit({
      user: { id: 'owner-1' },
      params: { submissionId: 'submission-1' },
      body: {}
    }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.submission).toEqual({
      id: 'submission-1', status: 'pending', reviewHistory: []
    });
  });
});
