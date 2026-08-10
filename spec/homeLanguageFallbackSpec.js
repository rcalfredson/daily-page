import fs from 'fs';
import { partitionHomePostsByLocale } from '../server/services/homepage.js';

describe('homepage language fallback grouping', () => {
  it('deduplicates conceptual posts and caps source-language fallbacks separately', () => {
    const exact = {
      _id: 'ru', groupId: 'translated', selection: { isSourceFallback: false }
    };
    const sameFamilyFallback = {
      _id: 'en', groupId: 'translated', selection: { isSourceFallback: true }
    };
    const fallback = {
      _id: 'cs', groupId: 'czech-source', selection: { isSourceFallback: true }
    };

    const result = partitionHomePostsByLocale([exact, sameFamilyFallback, fallback], {
      exactLimit: 20,
      fallbackLimit: 1
    });

    expect(result.exact.map(block => block._id)).toEqual(['ru']);
    expect(result.sourceFallbacks.map(block => block._id)).toEqual(['cs']);
  });

  it('renders fallback cards with concrete source URLs, language metadata, and a badge', () => {
    const template = fs.readFileSync('views/partials/_home_trending_posts.pug', 'utf8');
    expect(template).toContain("t('home.sourceFallback.title'");
    expect(template).toContain('home-language-badge');
    expect(template).toContain('href=`/rooms/${block.roomId}/blocks/${block._id}`');
    expect(template).toContain("dir=(textDirForLang ? textDirForLang(block.lang || 'en') : 'ltr')");
  });
});
