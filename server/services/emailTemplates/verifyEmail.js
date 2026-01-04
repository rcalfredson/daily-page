// server/services/emailTemplates/verifyEmail.js
import { getTranslatorRuntime } from '../i18n.js';
import { escapeHtml } from "../escapeHtml.js"

export async function buildVerifyEmail({ uiLang, username, verifyLink, hours = 24 }) {
  const t = await getTranslatorRuntime(uiLang, ['verifyEmail']);

  const safeName = escapeHtml(username);
  const safeLink = verifyLink;

  const subject = t('verifyEmail.verificationMsg.subject');

  const html = `
    <h1>${t('verifyEmail.verificationMsg.heading', { username: safeName })}</h1>
    <p>${t('verifyEmail.verificationMsg.body')}</p>
    <p><a href="${safeLink}">${t('verifyEmail.verificationMsg.cta')}</a></p>
    <p>${t('verifyEmail.verificationMsg.expires', { hours })}</p>
  `;

  return { subject, html };
}
