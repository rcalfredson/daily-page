import { buildQuestBlockMutationService } from '../server/db/questBlockMutationService.js';
import { QUEST_ERROR_CODES, QuestDomainError } from '../server/db/questErrors.js';
import { QUEST_BLOCK_OPERATIONS } from '../server/db/questSubmissionPolicy.js';

describe('quest block mutation service', () => {
  it('loads block submissions and allows mutations for ordinary drafts', async () => {
    const loadActiveSubmissions = jasmine.createSpy('loadActiveSubmissions')
      .and.resolveTo([{ _id: 'submission-1', status: 'draft' }]);
    const service = buildQuestBlockMutationService({ loadActiveSubmissions });

    await expectAsync(service.getQuestMutationPolicyForBlock({
      blockId: 'block-1',
      operation: QUEST_BLOCK_OPERATIONS.CONTENT
    })).toBeResolvedTo({ allowed: true, reason: null, submissionId: null });
    expect(loadActiveSubmissions).toHaveBeenCalledWith('block-1');
  });

  it('rejects every protected mutation while review is pending', async () => {
    const service = buildQuestBlockMutationService({
      loadActiveSubmissions: async () => [{ _id: 'submission-1', status: 'pending' }]
    });

    for (const operation of Object.values(QUEST_BLOCK_OPERATIONS)) {
      try {
        await service.assertQuestMutationAllowedForBlock({ blockId: 'block-1', operation });
        fail(`Expected ${operation} to be blocked`);
      } catch (error) {
        expect(error).toEqual(jasmine.any(QuestDomainError));
        expect(error.code).toBe(QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE);
        expect(error.details.reason).toBe('quest-submission-pending');
      }
    }
  });
});
