import { buildQuestNotificationEmail } from '../server/services/emailTemplates/questNotification.js';

describe('quest notification email template', () => {
  it('renders localized, escaped quest notification content', async () => {
    const result = await buildQuestNotificationEmail({
      uiLang: 'en',
      notificationType: 'quest_submission_approved',
      recipientUsername: 'Alice',
      actorUsername: 'Admin',
      questName: '<Virtual road trip>',
      blockTitle: 'Tioga & beyond',
      targetUrl: 'https://example.test/en/quests/road-trip'
    });

    expect(result.subject).toContain('&lt;Virtual road trip&gt;');
    expect(result.html).toContain('Tioga &amp; beyond');
    expect(result.html).toContain('https://example.test/en/quests/road-trip');
    expect(result.html).not.toContain('<Virtual road trip>');
  });
});
