// server/services/emailTemplates/passwordReset.js
import { getTranslatorRuntime } from '../i18n.js';
import { escapeHtml } from '../escapeHtml.js';

export async function buildPasswordResetEmail({ uiLang, username, resetUrl, hours = 1 }) {
  const t = await getTranslatorRuntime(uiLang, ['forgotPassword']);

  const safeName = escapeHtml(username || '');
  const safeLink = resetUrl;

  const subject = t('forgotPassword.email.subject');

  const heading = username
    ? t('forgotPassword.email.headingWithName', { username: safeName })
    : t('forgotPassword.email.heading');

  const html = `
    <h2>${heading}</h2>
    <p>${t('forgotPassword.email.body')}</p>
    <p><a href="${safeLink}">${t('forgotPassword.email.cta')}</a></p>
    <p>${t('forgotPassword.email.expires', { hours })}</p>
    <p>${t('forgotPassword.email.ignore')}</p>
  `;

  return { subject, html };
}
