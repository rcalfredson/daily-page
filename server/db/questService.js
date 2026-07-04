import Block from './models/Block.js';
import Quest from './models/Quest.js';
import QuestItem from './models/QuestItem.js';
import QuestSubmission from './models/QuestSubmission.js';
import Room from './models/Room.js';
import User from './models/User.js';
import {
  compareQuestLeaderboardEntries,
  getQuestMedalTier,
  getQuestProgressSummary,
  getQuestTargetCount,
  deriveQuestItemState,
  isQuestBlockEligible,
  questAcceptsNewWork,
  resolveQuestItemLabel,
  toQuestI18nDTO
} from './questDomain.js';
import { publiclyVisibleBlockMatch } from './blockService.js';
import { QUEST_ERROR_CODES, questError } from './questErrors.js';
import {
  expireQuestItemClaim,
  withdrawQuestSubmission
} from './questSubmissionService.js';

function id(value) {
  return value == null ? '' : String(value);
}

function requirePositivePagination(page, limit) {
  return {
    page: Math.max(1, Number(page) || 1),
    limit: Math.max(1, Math.min(Number(limit) || 20, 100))
  };
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function requireQuest(questId) {
  const quest = await Quest.findById(id(questId));
  if (!quest) throw questError(QUEST_ERROR_CODES.NOT_FOUND, { status: 404 });
  return quest;
}

function assertAcceptsNewWork(quest) {
  if (quest.status === 'archived') {
    throw questError(QUEST_ERROR_CODES.ARCHIVED, { status: 409 });
  }
  if (!questAcceptsNewWork(quest)) {
    throw questError(QUEST_ERROR_CODES.NOT_ACCEPTING_SUBMISSIONS, { status: 409 });
  }
}

export async function createQuest(data) {
  const [administratorExists, roomCount] = await Promise.all([
    User.exists({ _id: id(data.administratorUserId) }),
    Room.countDocuments({ _id: { $in: data.allowedRoomIds || [] } })
  ]);

  if (!administratorExists) {
    throw questError(QUEST_ERROR_CODES.INVALID, {
      details: { field: 'administratorUserId', reason: 'user-not-found' }
    });
  }
  if (roomCount !== new Set(data.allowedRoomIds || []).size) {
    throw questError(QUEST_ERROR_CODES.INVALID, {
      details: { field: 'allowedRoomIds', reason: 'room-not-found' }
    });
  }

  return Quest.create(data);
}

export async function getQuestBySlug({ slug, uiLang = 'en', includeDraft = false }) {
  const match = { slug: String(slug || '').trim().toLowerCase() };
  if (!includeDraft) match.status = { $in: ['active', 'completed', 'archived'] };
  const quest = await Quest.findOne(match).lean();
  return quest ? toQuestI18nDTO(quest, uiLang) : null;
}

export async function listPublicQuests({ uiLang = 'en', page = 1, limit = 20 } = {}) {
  const pagination = requirePositivePagination(page, limit);
  const filter = { status: { $in: ['active', 'completed'] } };
  const [quests, total] = await Promise.all([
    Quest.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    Quest.countDocuments(filter)
  ]);

  return {
    quests: quests.map(quest => toQuestI18nDTO(quest, uiLang)),
    total,
    ...pagination
  };
}

export async function listPublicQuestsOverview(options = {}) {
  const result = await listPublicQuests(options);
  const quests = await Promise.all(result.quests.map(async quest => ({
    ...quest,
    progress: await getQuestProgress({ questId: quest._id })
  })));
  return { ...result, quests };
}

export async function listQuestItems({
  questId,
  state = null,
  query = '',
  page = 1,
  limit = 24,
  uiLang = 'en',
  now = new Date()
}) {
  const quest = await requireQuest(questId);
  if (quest.type !== 'set') {
    throw questError(QUEST_ERROR_CODES.TYPE_MISMATCH, { status: 409 });
  }

  const pagination = requirePositivePagination(page, limit);
  const normalizedState = [
    'available', 'reserved', 'draft', 'pending', 'changes-requested', 'completed'
  ].includes(state) ? state : null;
  const filter = { questId: id(quest._id), active: true };
  const search = String(query || '').trim();
  if (search) {
    filter.$or = [
      { label: { $regex: escapeRegExp(search), $options: 'i' } },
      { key: { $regex: escapeRegExp(search), $options: 'i' } }
    ];
  }

  if (normalizedState === 'completed') {
    filter.approvedSubmissionId = { $ne: null };
  } else if (normalizedState === 'available') {
    filter.activeSubmissionId = null;
    filter.approvedSubmissionId = null;
    filter.$and = [{
      $or: [{ reservedUntil: null }, { reservedUntil: { $lte: now } }]
    }];
  } else if (normalizedState === 'reserved') {
    filter.activeSubmissionId = null;
    filter.approvedSubmissionId = null;
    filter.reservedUntil = { $gt: now };
  } else if (['draft', 'pending', 'changes-requested'].includes(normalizedState)) {
    const submissions = await QuestSubmission.find({
      questId: id(quest._id), status: normalizedState
    }).select('_id').lean();
    if (!submissions.length) {
      return { items: [], total: 0, state: normalizedState, query: search, ...pagination };
    }
    filter.activeSubmissionId = { $in: submissions.map(submission => id(submission._id)) };
  }

  const [items, total] = await Promise.all([
    QuestItem.find(filter)
      .sort({ label: 1, key: 1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    QuestItem.countDocuments(filter)
  ]);
  const submissionIds = [...new Set(items.map(item => id(item.activeSubmissionId)).filter(Boolean))];
  const submissions = submissionIds.length
    ? await QuestSubmission.find({ _id: { $in: submissionIds } }).lean()
    : [];
  const submissionById = new Map(submissions.map(submission => [id(submission._id), submission]));
  const blockIds = [...new Set(submissions.map(submission => id(submission.blockId)).filter(Boolean))];
  const blocks = blockIds.length
    ? await Block.find(publiclyVisibleBlockMatch({ _id: { $in: blockIds } }))
      .select('_id title roomId lang creator')
      .lean()
    : [];
  const blockById = new Map(blocks.map(block => [id(block._id), block]));

  return {
    items: items.map(item => {
      const submission = submissionById.get(id(item.activeSubmissionId)) || null;
      const block = submission ? blockById.get(id(submission.blockId)) || null : null;
      return {
        id: id(item._id),
        key: item.key,
        label: resolveQuestItemLabel(item, uiLang),
        state: deriveQuestItemState({ item, submission, now }),
        reservedUntil: item.reservedUntil || null,
        post: block ? {
          id: id(block._id),
          title: block.title,
          roomId: block.roomId,
          lang: block.lang,
          creator: block.creator
        } : null
      };
    }),
    total,
    state: normalizedState,
    query: search,
    ...pagination
  };
}

export async function listApprovedQuestPosts({ questId, page = 1, limit = 12 }) {
  const quest = await requireQuest(questId);
  const pagination = requirePositivePagination(page, limit);
  const filter = { questId: id(quest._id), status: 'approved' };
  const [submissions, total] = await Promise.all([
    QuestSubmission.find(filter)
      .sort({ approvedAt: -1, approvedSequence: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    QuestSubmission.countDocuments(filter)
  ]);
  const blockIds = submissions.map(submission => id(submission.blockId));
  const blocks = blockIds.length
    ? await Block.find(publiclyVisibleBlockMatch({ _id: { $in: blockIds } }))
      .select('_id title description roomId lang creator bannerImage createdAt')
      .lean()
    : [];
  const blockById = new Map(blocks.map(block => [id(block._id), block]));

  return {
    posts: submissions.map(submission => {
      const block = blockById.get(id(submission.blockId));
      if (!block) return null;
      return {
        ...block,
        _id: id(block._id),
        approvedAt: submission.approvedAt,
        approvedSequence: submission.approvedSequence,
        contributorCount: (submission.contributorUserIds || []).length
      };
    }).filter(Boolean),
    total,
    ...pagination
  };
}

export async function addQuestItems({ questId, items }) {
  const quest = await requireQuest(questId);
  if (quest.type !== 'set') {
    throw questError(QUEST_ERROR_CODES.TYPE_MISMATCH, { status: 409 });
  }

  const normalized = (items || []).map(item => ({
    questId: id(quest._id),
    key: String(item.key || '').trim().toLowerCase(),
    label: String(item.label || '').trim(),
    ...(item.label_i18n ? { label_i18n: item.label_i18n } : {})
  }));
  const keys = normalized.map(item => item.key);
  if (!normalized.length || new Set(keys).size !== keys.length) {
    throw questError(QUEST_ERROR_CODES.INVALID, {
      details: { field: 'items', reason: 'empty-or-duplicate-keys' }
    });
  }

  return QuestItem.insertMany(normalized, { ordered: true });
}

export async function claimQuestItem({ questId, itemId, userId, now = new Date() }) {
  await expireQuestItemClaim({ questId, itemId, now });
  const [quest, userExists] = await Promise.all([
    requireQuest(questId),
    User.exists({ _id: id(userId) })
  ]);
  if (!userExists) throw questError(QUEST_ERROR_CODES.FORBIDDEN, { status: 403 });
  if (quest.type !== 'set') {
    throw questError(QUEST_ERROR_CODES.TYPE_MISMATCH, { status: 409 });
  }
  assertAcceptsNewWork(quest);

  const current = await QuestItem.findOne({ _id: id(itemId), questId: id(quest._id) }).lean();
  if (!current) throw questError(QUEST_ERROR_CODES.ITEM_NOT_FOUND, { status: 404 });

  const deadline = new Date(now.getTime() + quest.reservationDurationHours * 60 * 60 * 1000);
  if (
    current.active &&
    !current.activeSubmissionId &&
    !current.approvedSubmissionId &&
    id(current.reservedByUserId) === id(userId) &&
    current.reservedUntil && new Date(current.reservedUntil) > now
  ) {
    return current;
  }

  const claimed = await QuestItem.findOneAndUpdate({
    _id: id(itemId),
    questId: id(quest._id),
    active: true,
    activeSubmissionId: null,
    approvedSubmissionId: null,
    $or: [
      { reservedByUserId: null },
      { reservedUntil: null },
      { reservedUntil: { $lte: now } }
    ]
  }, {
    $set: { reservedByUserId: id(userId), reservedUntil: deadline }
  }, { returnDocument: 'after' }).lean();

  if (!claimed) throw questError(QUEST_ERROR_CODES.ITEM_UNAVAILABLE, { status: 409 });
  return claimed;
}

export async function releaseQuestItem({ questId, itemId, userId, now = new Date() }) {
  const released = await QuestItem.findOneAndUpdate({
    _id: id(itemId),
    questId: id(questId),
    reservedByUserId: id(userId),
    activeSubmissionId: null,
    approvedSubmissionId: null
  }, {
    $set: { reservedByUserId: null, reservedUntil: null }
  }, { returnDocument: 'after' }).lean();

  if (released) return released;
  const item = await QuestItem.findOne({ _id: id(itemId), questId: id(questId) }).lean();
  if (!item) throw questError(QUEST_ERROR_CODES.ITEM_NOT_FOUND, { status: 404 });
  if (id(item.reservedByUserId) !== id(userId)) {
    throw questError(QUEST_ERROR_CODES.FORBIDDEN, { status: 403 });
  }
  if (item.activeSubmissionId && !item.approvedSubmissionId) {
    await withdrawQuestSubmission({
      submissionId: item.activeSubmissionId,
      ownerUserId: userId,
      now
    });
    return QuestItem.findById(id(itemId)).lean();
  }
  throw questError(QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE, { status: 409 });
}

export async function getQuestProgress({ questId }) {
  const quest = await requireQuest(questId);
  if (quest.type === 'count') {
    const approvedCount = await QuestSubmission.countDocuments({
      questId: id(quest._id), status: 'approved'
    });
    return getQuestProgressSummary({ quest, approvedCount });
  }

  const [activeItemCount, approvedCount] = await Promise.all([
    QuestItem.countDocuments({ questId: id(quest._id), active: true }),
    QuestItem.countDocuments({
      questId: id(quest._id), active: true, approvedSubmissionId: { $ne: null }
    })
  ]);
  return getQuestProgressSummary({ quest, approvedCount, activeItemCount });
}

export async function getQuestLeaderboard({ questId, page = 1, limit = 20 }) {
  const quest = await requireQuest(questId);
  const pagination = requirePositivePagination(page, limit);
  const submissions = await QuestSubmission.find({ questId: id(quest._id), status: 'approved' })
    .select('contributorUserIds approvedAt approvedSequence')
    .lean();
  const byUser = new Map();

  for (const submission of submissions) {
    for (const userId of submission.contributorUserIds || []) {
      const key = id(userId);
      const current = byUser.get(key) || { contributionCount: 0 };
      current.contributionCount += 1;
      if (
        !current.reachedCurrentCountAt ||
        new Date(submission.approvedAt) > new Date(current.reachedCurrentCountAt) ||
        (
          new Date(submission.approvedAt).getTime() === new Date(current.reachedCurrentCountAt).getTime() &&
          submission.approvedSequence > current.reachedCurrentCountSequence
        )
      ) {
        current.reachedCurrentCountAt = submission.approvedAt;
        current.reachedCurrentCountSequence = submission.approvedSequence;
      }
      byUser.set(key, current);
    }
  }

  const users = await User.find({ _id: { $in: [...byUser.keys()] } })
    .select('username profilePic')
    .lean();
  const targetCount = quest.type === 'set'
    ? await QuestItem.countDocuments({ questId: id(quest._id), active: true })
    : getQuestTargetCount(quest);
  const entries = users.map(user => {
    const contribution = byUser.get(id(user._id));
    return {
      userId: id(user._id),
      username: user.username,
      profilePic: user.profilePic,
      ...contribution,
      medalTier: getQuestMedalTier({
        contributionCount: contribution.contributionCount,
        targetCount,
        thresholds: quest.medalThresholds
      })
    };
  }).sort(compareQuestLeaderboardEntries);

  const offset = (pagination.page - 1) * pagination.limit;
  return {
    entries: entries.slice(offset, offset + pagination.limit),
    total: entries.length,
    targetCount,
    ...pagination
  };
}

export async function getUserQuestContributions({ userId, uiLang = 'en' }) {
  const rows = await QuestSubmission.aggregate([
    { $match: { status: 'approved', contributorUserIds: id(userId) } },
    {
      $group: {
        _id: '$questId',
        contributionCount: { $sum: 1 },
        reachedCurrentCountAt: { $max: '$approvedAt' }
      }
    }
  ]);
  const quests = await Quest.find({ _id: { $in: rows.map(row => row._id) } }).lean();
  const questById = new Map(quests.map(quest => [id(quest._id), quest]));

  return Promise.all(rows.map(async row => {
    const quest = questById.get(id(row._id));
    if (!quest) return null;
    const targetCount = quest.type === 'set'
      ? await QuestItem.countDocuments({ questId: id(quest._id), active: true })
      : getQuestTargetCount(quest);
    return {
      quest: toQuestI18nDTO(quest, uiLang),
      contributionCount: row.contributionCount,
      reachedCurrentCountAt: row.reachedCurrentCountAt,
      targetCount,
      medalTier: getQuestMedalTier({
        contributionCount: row.contributionCount,
        targetCount,
        thresholds: quest.medalThresholds
      })
    };
  })).then(results => results.filter(Boolean));
}

export async function validateQuestSubmissionBlock({ questId, blockId }) {
  const [quest, block] = await Promise.all([
    requireQuest(questId),
    Block.findById(id(blockId)).lean()
  ]);
  if (!block) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, {
      status: 409,
      details: { reason: 'block-not-found' }
    });
  }
  if (!isQuestBlockEligible(quest, block)) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, {
      status: 409,
      details: { reason: 'block-not-publicly-eligible' }
    });
  }
  return { quest, block };
}
