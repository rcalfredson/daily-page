import Block from './models/Block.js';
import Quest from './models/Quest.js';
import QuestItem from './models/QuestItem.js';
import User from './models/User.js';
import {
  createQuestNotification,
  markNotificationEmailed
} from './notificationService.js';
import { resolveQuestItemLabel, resolveQuestLocalizedField } from './questDomain.js';
import { buildQuestNotificationEmail } from '../services/emailTemplates/questNotification.js';
import { sendEmail } from '../services/mailgunService.js';
import { buildQuestNotificationPath } from '../utils/questNotificationPath.js';
import { DEFAULT_UI_LANG, isSupportedUiLang } from '../services/localeContext.js';

export const QUEST_NOTIFICATION_EVENTS = Object.freeze({
  REVIEW_REQUESTED: 'quest_review_requested',
  CHANGES_REQUESTED: 'quest_changes_requested',
  APPROVED: 'quest_submission_approved',
  REJECTED: 'quest_submission_rejected',
  REVOKED: 'quest_submission_revoked',
  CLAIM_EXPIRED: 'quest_claim_expired'
});

function id(value) {
  return value == null ? '' : String(value);
}

function latestHistoryEvent(submission) {
  const history = submission?.reviewHistory || [];
  return history[history.length - 1] || null;
}

function dedupeKeyFor({ type, userId, submission, itemId, token }) {
  const subjectId = id(submission?._id) || id(itemId);
  const event = latestHistoryEvent(submission);
  const eventToken = id(event?._id) || id(token) || id(submission?.updatedAt);
  if (!subjectId || !eventToken) {
    throw new Error(`Quest notification ${type} requires stable subject and event identifiers.`);
  }
  return ['quest', type, id(userId), subjectId, eventToken].join(':');
}

export function buildQuestNotificationService({
  QuestModel = Quest,
  QuestItemModel = QuestItem,
  BlockModel = Block,
  UserModel = User,
  createNotificationRecord = createQuestNotification,
  markEmailed = markNotificationEmailed,
  buildEmail = buildQuestNotificationEmail,
  sendEmailFn = sendEmail
} = {}) {
  async function notifyQuestEvent({
    type,
    submission = null,
    expiry = null,
    actorUserId = null,
    token = null
  }) {
    const questId = id(submission?.questId) || id(expiry?.questId);
    const itemId = id(submission?.questItemId) || id(expiry?.itemId) || null;
    const ownerUserId = id(submission?.ownerUserId) || id(expiry?.ownerUserId);
    const quest = await QuestModel.findById(questId);
    if (!quest) return null;

    const recipientUserId = type === QUEST_NOTIFICATION_EVENTS.REVIEW_REQUESTED
      ? id(quest.administratorUserId)
      : ownerUserId;
    if (!recipientUserId) return null;

    const event = latestHistoryEvent(submission);
    const resolvedActorUserId = id(actorUserId) || id(event?.actorUserId) || null;
    const blockId = id(submission?.blockId) || id(expiry?.blockId) || null;
    const [recipient, actor, block, item] = await Promise.all([
      UserModel.findById(recipientUserId),
      resolvedActorUserId ? UserModel.findById(resolvedActorUserId) : Promise.resolve(null),
      blockId ? BlockModel.findById(blockId) : Promise.resolve(null),
      itemId ? QuestItemModel.findById(itemId) : Promise.resolve(null)
    ]);
    if (!recipient) return null;

    const dedupeKey = dedupeKeyFor({
      type,
      userId: recipientUserId,
      submission,
      itemId,
      token: token || expiry?.eventToken
    });
    const notification = await createNotificationRecord({
      userId: recipientUserId,
      type,
      actorUserId: resolvedActorUserId,
      blockId,
      questId,
      questSubmissionId: submission?._id || null,
      questItemId: itemId,
      dedupeKey
    });

    if (!notification || notification.emailedAt || !recipient?.email) return notification;

    const path = buildQuestNotificationPath({
      type,
      questId: quest._id,
      questSlug: quest.slug,
      submissionId: submission?._id,
      itemId
    });
    const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const recipientUiLang = isSupportedUiLang(recipient.preferredUiLang)
      ? recipient.preferredUiLang
      : DEFAULT_UI_LANG;
    const questName = resolveQuestLocalizedField(quest, 'name', recipientUiLang);
    const { subject, html } = await buildEmail({
      uiLang: recipientUiLang,
      notificationType: type,
      recipientUsername: recipient.username,
      actorUsername: actor?.username || '',
      questName,
      blockTitle: block?.title || '',
      itemLabel: item ? resolveQuestItemLabel(item, recipientUiLang) : '',
      targetUrl: `${baseUrl}/${recipientUiLang}${path}`
    });
    await sendEmailFn({ to: recipient.email, subject, html });
    await markEmailed(notification._id);
    return notification;
  }

  return { notifyQuestEvent };
}

const questNotificationService = buildQuestNotificationService();

export const notifyQuestEvent = questNotificationService.notifyQuestEvent;
