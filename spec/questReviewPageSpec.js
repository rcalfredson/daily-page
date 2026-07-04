import { buildQuestReviewPageHandler } from '../server/routes/quests.js';
import { QUEST_ERROR_CODES, questError } from '../server/db/questErrors.js';

function response() {
  return {
    locals: {
      uiLang: 'en',
      t(key, values = {}) { return values.count === undefined ? key : `${key}:${values.count}`; }
    },
    statusCode: 200,
    view: null,
    data: null,
    status(code) { this.statusCode = code; return this; },
    render(view, data) { this.view = view; this.data = data; return this; }
  };
}

describe('quest review page', () => {
  it('scopes the private queue to the authenticated administrator and selected quest', async () => {
    const listReviewQueue = jasmine.createSpy('listReviewQueue').and.resolveTo({
      submissions: [{ id: 'submission-1' }], total: 21, page: 2, limit: 20
    });
    const handler = buildQuestReviewPageHandler({ listReviewQueue });
    const res = response();
    await handler({
      user: { id: 'admin-1' },
      query: { questId: 'quest-1', page: '2' }
    }, res);

    expect(listReviewQueue).toHaveBeenCalledOnceWith({
      administratorUserId: 'admin-1',
      questId: 'quest-1',
      submissionId: null,
      page: 2,
      limit: 20,
      uiLang: 'en'
    });
    expect(res.view).toBe('quests/review');
    expect(res.data).toEqual(jasmine.objectContaining({
      pendingTotal: 21,
      currentPage: 2,
      totalPages: 2,
      paginationBaseUrl: '/quests/review?questId=quest-1'
    }));
  });

  it('shows a forbidden page when an administrator requests another quest', async () => {
    spyOn(console, 'error');
    const listReviewQueue = jasmine.createSpy('listReviewQueue').and.rejectWith(
      questError(QUEST_ERROR_CODES.FORBIDDEN, { status: 403 })
    );
    const handler = buildQuestReviewPageHandler({ listReviewQueue });
    const res = response();
    await handler({ user: { id: 'admin-1' }, query: { questId: 'quest-2' } }, res);

    expect(res.statusCode).toBe(403);
    expect(res.view).toBe('error');
    expect(res.data.message).toBe('quests.review.errors.forbidden');
  });

  it('renders an empty all-quests queue for users who administer no quests', async () => {
    const listReviewQueue = jasmine.createSpy('listReviewQueue').and.resolveTo({
      submissions: [], total: 0, page: 1, limit: 20
    });
    const handler = buildQuestReviewPageHandler({ listReviewQueue });
    const res = response();
    await handler({ user: { id: 'user-1' }, query: {} }, res);

    expect(res.view).toBe('quests/review');
    expect(res.data.submissions).toEqual([]);
    expect(res.data.totalPages).toBe(0);
  });

  it('passes a notification submission through for a focused anchored queue', async () => {
    const listReviewQueue = jasmine.createSpy('listReviewQueue').and.resolveTo({
      submissions: [{ id: 'submission-1' }], total: 1, page: 1, limit: 20
    });
    const handler = buildQuestReviewPageHandler({ listReviewQueue });
    const res = response();
    await handler({
      user: { id: 'admin-1' },
      query: { questId: 'quest-1', submission: 'submission-1' }
    }, res);

    expect(listReviewQueue).toHaveBeenCalledWith(jasmine.objectContaining({
      administratorUserId: 'admin-1',
      questId: 'quest-1',
      submissionId: 'submission-1'
    }));
    expect(res.data.highlightedSubmissionId).toBe('submission-1');
  });
});
