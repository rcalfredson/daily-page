import { buildQuestAwareBlockCreator } from '../server/api/v1/blocks.js';

describe('quest-aware block creation', () => {
  function harness({ submissionError = null } = {}) {
    const block = { _id: 'block-1', roomId: 'united-states' };
    const createBlockFn = jasmine.createSpy('createBlockFn').and.resolveTo(block);
    const createSubmissionFn = jasmine.createSpy('createSubmissionFn');
    if (submissionError) createSubmissionFn.and.rejectWith(submissionError);
    else createSubmissionFn.and.resolveTo({ _id: 'submission-1' });
    const BlockModel = { deleteOne: jasmine.createSpy('deleteOne').and.resolveTo({ deletedCount: 1 }) };
    return {
      create: buildQuestAwareBlockCreator({ createBlockFn, createSubmissionFn, BlockModel }),
      createSubmissionFn,
      BlockModel
    };
  }

  it('attaches the newly created block using authenticated server-owned identity', async () => {
    const { create, createSubmissionFn, BlockModel } = harness();
    const result = await create({
      blockData: { title: 'Tioga, PA' },
      questId: 'quest-1',
      questItemId: 'item-1',
      userId: 'user-1'
    });
    expect(createSubmissionFn).toHaveBeenCalledWith({
      questId: 'quest-1', itemId: 'item-1', blockId: 'block-1', ownerUserId: 'user-1'
    });
    expect(result.questSubmission._id).toBe('submission-1');
    expect(BlockModel.deleteOne).not.toHaveBeenCalled();
  });

  it('removes the new block if quest attachment is rejected', async () => {
    const error = new Error('claim expired');
    const { create, BlockModel } = harness({ submissionError: error });
    await expectAsync(create({
      blockData: { title: 'Tioga, PA' }, questId: 'quest-1', questItemId: 'item-1', userId: 'user-1'
    })).toBeRejectedWith(error);
    expect(BlockModel.deleteOne).toHaveBeenCalledOnceWith({ _id: 'block-1' });
  });

  it('keeps ordinary block creation independent of quests', async () => {
    const { create, createSubmissionFn } = harness();
    const result = await create({ blockData: { title: 'Ordinary post' }, userId: null });
    expect(result.questSubmission).toBeNull();
    expect(createSubmissionFn).not.toHaveBeenCalled();
  });
});
