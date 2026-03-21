// server/services/emailTemplates/commentNotification.js
import { getTranslatorRuntime } from '../i18n.js';
import { escapeHtml } from '../escapeHtml.js';

function truncate(str, max = 180) {
  const s = String(str || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function normalizeEmailLang(lang) {
  const supported = new Set(['en', 'es']);
  return supported.has(lang) ? lang : 'en';
}

export async function buildCommentNotificationEmail({
  uiLang,
  notificationType = 'block_comment',
  recipientUsername,
  actorUsername,
  blockTitle,
  commentBody,
  blockUrl
}) {
  const lang = normalizeEmailLang(uiLang);
  const t = await getTranslatorRuntime(lang, ['notifications']);

  const safeRecipient = escapeHtml(recipientUsername || '');
  const safeActor = escapeHtml(actorUsername || '');
  const safeBlockTitle = escapeHtml(blockTitle || '');
  const safeExcerpt = escapeHtml(truncate(commentBody || '', 180));
  const safeLink = blockUrl;
  const emailKey = notificationType === 'comment_reply' ? 'commentReply' : 'blockComment';

  const subject = t(`notifications.email.${emailKey}.subject`, {
    blockTitle: safeBlockTitle || t(`notifications.email.${emailKey}.fallbackBlockTitle`)
  });

  const heading = recipientUsername
    ? t(`notifications.email.${emailKey}.headingWithName`, { username: safeRecipient })
    : t(`notifications.email.${emailKey}.heading`);

  const html = `
    <h2>${heading}</h2>
    <p>${t(`notifications.email.${emailKey}.body`, {
      actorUsername: safeActor || t(`notifications.email.${emailKey}.fallbackActor`),
      blockTitle: safeBlockTitle || t(`notifications.email.${emailKey}.fallbackBlockTitle`)
    })}</p>
    <blockquote style="margin: 12px 0; padding-left: 12px; border-left: 3px solid #ccc; color: #444;">
      ${safeExcerpt}
    </blockquote>
    <p><a href="${safeLink}">${t(`notifications.email.${emailKey}.cta`)}</a></p>
  `;

  return { subject, html };
}
