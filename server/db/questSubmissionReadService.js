import Block from './models/Block.js';
import Quest from './models/Quest.js';
import QuestItem from './models/QuestItem.js';
import QuestSubmission from './models/QuestSubmission.js';
import User from './models/User.js';
import { resolveQuestItemLabel, resolveQuestLocalizedField } from './questDomain.js';
import { QUEST_ERROR_CODES, questError } from './questErrors.js';

const SUBMISSION_STATUSES = new Set([
  'draft', 'pending', 'changes-requested', 'approved', 'rejected', 'withdrawn', 'revoked'
]);

function id(value) {
  return value == null ? '' : String(value);
}

function pagination(page, limit) {
  return {
    page: Math.max(1, Number(page) || 1),
    limit: Math.max(1, Math.min(Number(limit) || 20, 100))
  };
}

function reviewHistoryDTO(history = []) {
  return history.map(event => ({
    id: id(event._id),
    type: event.type,
    actorType: event.actorType,
    actorUserId: event.actorUserId ? id(event.actorUserId) : null,
    occurredAt: event.occurredAt,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    comment: event.comment || null,
    blockUpdatedAt: event.blockUpdatedAt || null,
    reasonCode: event.reasonCode || null
  }));
}

function submissionDTO({ submission, quest, item, block, owner, uiLang }) {
  return {
    id: id(submission._id),
    status: submission.status,
    owner: owner ? {
      id: id(owner._id),
      username: owner.username,
      profilePic: owner.profilePic
    } : null,
    quest: quest ? {
      id: id(quest._id),
      slug: quest.slug,
      name: resolveQuestLocalizedField(quest, 'name', uiLang)
    } : null,
    item: item ? {
      id: id(item._id),
      key: item.key,
      label: resolveQuestItemLabel(item, uiLang)
    } : null,
    block: block ? {
      id: id(block._id),
      groupId: id(block.groupId),
      roomId: block.roomId,
      title: block.title,
      lang: block.lang,
      status: block.status,
      visibility: block.visibility,
      updatedAt: block.updatedAt
    } : null,
    submittedAt: submission.submittedAt || null,
    approvedAt: submission.approvedAt || null,
    reviewedBlockUpdatedAt: submission.reviewedBlockUpdatedAt || null,
    contributorCount: (submission.contributorUserIds || []).length,
    reviewHistory: reviewHistoryDTO(submission.reviewHistory),
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt
  };
}

export function buildQuestSubmissionReadService({
  QuestModel = Quest,
  QuestItemModel = QuestItem,
  QuestSubmissionModel = QuestSubmission,
  BlockModel = Block,
  UserModel = User
} = {}) {
  async function hydrate(submissions, uiLang) {
    const questIds = [...new Set(submissions.map(row => id(row.questId)).filter(Boolean))];
    const itemIds = [...new Set(submissions.map(row => id(row.questItemId)).filter(Boolean))];
    const blockIds = [...new Set(submissions.map(row => id(row.blockId)).filter(Boolean))];
    const ownerIds = [...new Set(submissions.map(row => id(row.ownerUserId)).filter(Boolean))];
    const [quests, items, blocks, owners] = await Promise.all([
      questIds.length ? QuestModel.find({ _id: { $in: questIds } }).lean() : [],
      itemIds.length ? QuestItemModel.find({ _id: { $in: itemIds } }).lean() : [],
      blockIds.length ? BlockModel.find({ _id: { $in: blockIds } })
        .select('_id groupId roomId title lang status visibility updatedAt').lean() : [],
      ownerIds.length ? UserModel.find({ _id: { $in: ownerIds } })
        .select('_id username profilePic').lean() : []
    ]);
    const questById = new Map(quests.map(row => [id(row._id), row]));
    const itemById = new Map(items.map(row => [id(row._id), row]));
    const blockById = new Map(blocks.map(row => [id(row._id), row]));
    const ownerById = new Map(owners.map(row => [id(row._id), row]));

    return submissions.map(submission => submissionDTO({
      submission,
      quest: questById.get(id(submission.questId)),
      item: itemById.get(id(submission.questItemId)),
      block: blockById.get(id(submission.blockId)),
      owner: ownerById.get(id(submission.ownerUserId)),
      uiLang
    }));
  }

  async function getQuestSubmissionForUser({ submissionId, userId, uiLang = 'en' }) {
    const submission = await QuestSubmissionModel.findById(id(submissionId)).lean();
    if (!submission) throw questError(QUEST_ERROR_CODES.SUBMISSION_NOT_FOUND, { status: 404 });
    const quest = await QuestModel.findById(id(submission.questId)).lean();
    if (!quest) throw questError(QUEST_ERROR_CODES.NOT_FOUND, { status: 404 });
    const authorized = id(submission.ownerUserId) === id(userId) ||
      id(quest.administratorUserId) === id(userId);
    if (!authorized) throw questError(QUEST_ERROR_CODES.FORBIDDEN, { status: 403 });
    return (await hydrate([submission], uiLang))[0];
  }

  async function listUserQuestSubmissions({
    questId, userId, status = null, statuses = null, page = 1, limit = 20, uiLang = 'en'
  }) {
    const quest = await QuestModel.findById(id(questId)).lean();
    if (!quest) throw questError(QUEST_ERROR_CODES.NOT_FOUND, { status: 404 });
    const paging = pagination(page, limit);
    const filter = { questId: id(questId), ownerUserId: id(userId) };
    const normalizedStatuses = Array.isArray(statuses)
      ? [...new Set(statuses.filter(value => SUBMISSION_STATUSES.has(value)))]
      : [];
    if (normalizedStatuses.length) filter.status = { $in: normalizedStatuses };
    else if (SUBMISSION_STATUSES.has(status)) filter.status = status;
    const [submissions, total] = await Promise.all([
      QuestSubmissionModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((paging.page - 1) * paging.limit)
        .limit(paging.limit)
        .lean(),
      QuestSubmissionModel.countDocuments(filter)
    ]);
    return {
      submissions: await hydrate(submissions, uiLang),
      total,
      status: normalizedStatuses.length ? null : filter.status || null,
      statuses: normalizedStatuses,
      ...paging
    };
  }

  async function listAdministratorReviewQueue({
    administratorUserId,
    questId = null,
    submissionId = null,
    page = 1,
    limit = 20,
    uiLang = 'en'
  }) {
    const questFilter = { administratorUserId: id(administratorUserId) };
    if (questId) questFilter._id = id(questId);
    const administeredQuests = await QuestModel.find(questFilter).select('_id').lean();
    if (questId && !administeredQuests.length) {
      const exists = await QuestModel.exists({ _id: id(questId) });
      if (!exists) throw questError(QUEST_ERROR_CODES.NOT_FOUND, { status: 404 });
      throw questError(QUEST_ERROR_CODES.FORBIDDEN, { status: 403 });
    }

    const questIds = administeredQuests.map(quest => id(quest._id));
    const paging = pagination(page, limit);
    if (!questIds.length) return { submissions: [], total: 0, ...paging };
    const filter = { questId: { $in: questIds }, status: 'pending' };
    if (submissionId) filter._id = id(submissionId);
    const [submissions, total] = await Promise.all([
      QuestSubmissionModel.find(filter)
        .sort({ submittedAt: 1, createdAt: 1 })
        .skip((paging.page - 1) * paging.limit)
        .limit(paging.limit)
        .lean(),
      QuestSubmissionModel.countDocuments(filter)
    ]);
    return {
      submissions: await hydrate(submissions, uiLang),
      total,
      ...paging
    };
  }

  return {
    getQuestSubmissionForUser,
    listUserQuestSubmissions,
    listAdministratorReviewQueue
  };
}

const questSubmissionReadService = buildQuestSubmissionReadService();

export const getQuestSubmissionForUser = questSubmissionReadService.getQuestSubmissionForUser;
export const listUserQuestSubmissions = questSubmissionReadService.listUserQuestSubmissions;
export const listAdministratorReviewQueue =
  questSubmissionReadService.listAdministratorReviewQueue;
