import { getTranslatorRuntime } from '../i18n.js';
import { escapeHtml } from '../escapeHtml.js';

const EMAIL_KEYS = Object.freeze({
  quest_review_requested: 'questReviewRequested',
  quest_changes_requested: 'questChangesRequested',
  quest_submission_approved: 'questSubmissionApproved',
  quest_submission_rejected: 'questSubmissionRejected',
  quest_submission_revoked: 'questSubmissionRevoked',
  quest_claim_expired: 'questClaimExpired'
});

export async function buildQuestNotificationEmail({
  uiLang = 'en',
  notificationType,
  recipientUsername,
  actorUsername,
  questName,
  blockTitle,
  itemLabel,
  targetUrl
}) {
  const emailKey = EMAIL_KEYS[notificationType];
  if (!emailKey) throw new Error(`Unsupported quest notification type: ${notificationType}`);

  const t = await getTranslatorRuntime(uiLang, ['notifications']);
  const params = {
    username: escapeHtml(recipientUsername || ''),
    actorUsername: escapeHtml(actorUsername || t('notifications.email.quest.fallbackActor')),
    questName: escapeHtml(questName || t('notifications.email.quest.fallbackQuestName')),
    blockTitle: escapeHtml(blockTitle || t('notifications.email.quest.fallbackBlockTitle')),
    itemLabel: escapeHtml(itemLabel || t('notifications.email.quest.fallbackItemLabel'))
  };

  const subject = t(`notifications.email.${emailKey}.subject`, params);
  const heading = recipientUsername
    ? t('notifications.email.quest.headingWithName', params)
    : t(`notifications.email.${emailKey}.heading`, params);
  const html = `
    <h2>${heading}</h2>
    <p>${t(`notifications.email.${emailKey}.body`, params)}</p>
    <p><a href="${escapeHtml(targetUrl || '')}">${t(`notifications.email.${emailKey}.cta`, params)}</a></p>
  `;

  return { subject, html };
}
