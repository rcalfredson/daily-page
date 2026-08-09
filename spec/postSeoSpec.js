import {
  buildPostArticleJsonLd,
  buildPostSeo,
  POST_META_DESCRIPTION_MAX_LENGTH
} from '../server/utils/postSeo.js';
import pug from 'pug';

describe('post SEO metadata', () => {
  const options = {
    siteName: 'Daily Page',
    baseUrl: 'https://dailypage.org/',
    canonicalUrl: 'https://dailypage.org/rooms/science/blocks/temperature'
  };

  it('builds branded page and social titles with a Markdown-free description', () => {
    const metadata = buildPostSeo({
      title: 'How to Read a Temperature–Entropy Diagram',
      description: '**Learn** how [temperature](https://example.com) relates to entropy.'
    }, options);

    expect(metadata.title)
      .toBe('How to Read a Temperature–Entropy Diagram | Daily Page');
    expect(metadata.socialTitle).toBe(metadata.title);
    expect(metadata.description).toBe('Learn how temperature relates to entropy.');
    expect(metadata.socialDescription).toBe(metadata.description);
    expect(metadata.canonicalUrl).toBe(options.canonicalUrl);
    expect(metadata.openGraphType).toBe('article');
  });

  it('uses an image banner for large social cards', () => {
    const metadata = buildPostSeo({
      title: 'A visual post',
      description: 'A useful summary.',
      bannerImage: {
        kind: 'image',
        url: 'https://images.example.com/banner.jpg',
        caption: 'Temperature and entropy chart'
      }
    }, options);

    expect(metadata.socialImageUrl).toBe('https://images.example.com/banner.jpg');
    expect(metadata.socialImageAlt).toBe('Temperature and entropy chart');
    expect(metadata.socialCardType).toBe('summary_large_image');
  });

  it('falls back to content and the site image for posts without an image banner', () => {
    const metadata = buildPostSeo({
      title: 'A post without a banner',
      content: `${'A useful sentence '.repeat(20)}ending.`,
      bannerImage: {
        kind: 'streetview',
        url: 'https://www.google.com/maps/embed?pb=example'
      }
    }, options);

    expect(metadata.description.length).toBeLessThanOrEqual(POST_META_DESCRIPTION_MAX_LENGTH);
    expect(metadata.description.endsWith('…')).toBeTrue();
    expect(metadata.socialImageUrl).toBe('https://dailypage.org/assets/img/logo-512.png');
    expect(metadata.socialImageAlt).toBe('Daily Page');
    expect(metadata.socialCardType).toBe('summary');
  });

  it('prefers a complete sentence when a description exceeds the metadata limit', () => {
    const completeSentence =
      'Build a core–satellite portfolio with clear boundaries and explicit rebalancing rules.';
    const metadata = buildPostSeo({
      title: 'A resilient portfolio',
      description: `${completeSentence} The follow-up thought ${'continues '.repeat(20)}past the limit.`
    }, options);

    expect(completeSentence.length)
      .toBeGreaterThanOrEqual(Math.floor(POST_META_DESCRIPTION_MAX_LENGTH * 0.5));
    expect(metadata.description).toBe(completeSentence);
    expect(metadata.socialDescription).toBe(completeSentence);
    expect(JSON.parse(metadata.articleJsonLd).description).toBe(completeSentence);
  });

  it('uses a word-boundary ellipsis when the first sentence is too long', () => {
    const metadata = buildPostSeo({
      title: 'One long thought',
      description: `${'A continuous explanation without a sentence boundary '.repeat(5)}ends here.`
    }, options);

    expect(metadata.description.length).toBeLessThanOrEqual(POST_META_DESCRIPTION_MAX_LENGTH);
    expect(metadata.description.endsWith('…')).toBeTrue();
    expect(metadata.description.endsWith(' …')).toBeFalse();
  });

  it('includes a valid publication timestamp when one exists', () => {
    const metadata = buildPostSeo({
      title: 'Dated post',
      createdAt: new Date('2026-08-02T12:30:00Z')
    }, options);

    expect(metadata.socialPublishedTime).toBe('2026-08-02T12:30:00.000Z');
  });

  it('can omit Article markup for a post that is not publicly visible', () => {
    const metadata = buildPostSeo({
      title: 'Unlisted draft',
      content: 'Work in progress.'
    }, {
      ...options,
      includeArticleJsonLd: false
    });

    expect(metadata.articleJsonLd).toBeNull();
  });

  it('renders Open Graph and Twitter card tags', () => {
    const metadata = buildPostSeo({
      title: 'Temperature & entropy',
      description: 'A concise guide.',
      bannerImage: { url: 'https://images.example.com/diagram.jpg' }
    }, options);
    const html = pug.renderFile('views/partials/_social_meta.pug', metadata);

    expect(html).toContain('property="og:title"');
    expect(html).toContain('content="Temperature &amp; entropy | Daily Page"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image"');
  });

  it('builds Article JSON-LD from visible post metadata', () => {
    const article = JSON.parse(buildPostArticleJsonLd({
      title: 'Reading a temperature diagram',
      lang: 'en',
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-02T13:30:00Z',
      tags: ['thermodynamics', ' diagrams '],
      bannerImage: { url: 'https://images.example.com/diagram.jpg' }
    }, {
      author: {
        name: 'Ada Reader',
        url: 'https://dailypage.org/en/users/ada'
      },
      baseUrl: options.baseUrl,
      canonicalUrl: options.canonicalUrl,
      description: 'A concise guide.',
      roomName: 'Physics'
    }));

    expect(article['@type']).toBe('Article');
    expect(article['@id']).toBe(`${options.canonicalUrl}#article`);
    expect(article.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': options.canonicalUrl
    });
    expect(article.headline).toBe('Reading a temperature diagram');
    expect(article.description).toBe('A concise guide.');
    expect(article.inLanguage).toBe('en');
    expect(article.datePublished).toBe('2026-08-01T12:00:00.000Z');
    expect(article.dateModified).toBe('2026-08-02T13:30:00.000Z');
    expect(article.author).toEqual({
      '@type': 'Person',
      name: 'Ada Reader',
      url: 'https://dailypage.org/en/users/ada'
    });
    expect(article.publisher).toEqual({
      '@id': 'https://dailypage.org/#organization'
    });
    expect(article.image).toBe('https://images.example.com/diagram.jpg');
    expect(article.articleSection).toBe('Physics');
    expect(article.keywords).toEqual(['thermodynamics', 'diagrams']);
  });

  it('omits unavailable optional fields and non-image banners', () => {
    const article = JSON.parse(buildPostArticleJsonLd({
      title: 'A panorama',
      bannerImage: {
        kind: 'streetview',
        url: 'https://www.google.com/maps/embed?pb=example'
      }
    }, {
      baseUrl: options.baseUrl,
      canonicalUrl: options.canonicalUrl,
      description: 'A mapped location.'
    }));

    expect(article.image).toBeUndefined();
    expect(article.author).toBeUndefined();
    expect(article.datePublished).toBeUndefined();
    expect(article.dateModified).toBeUndefined();
    expect(article.keywords).toBeUndefined();
  });

  it('renders JSON-LD without allowing post content to close the script element', () => {
    const articleJsonLd = buildPostArticleJsonLd({
      title: '</script><script>alert("unsafe")</script>'
    }, {
      baseUrl: options.baseUrl,
      canonicalUrl: options.canonicalUrl,
      description: 'Safe description'
    });
    const html = pug.renderFile('views/partials/_article_json_ld.pug', { articleJsonLd });

    expect(html.match(/<script/g).length).toBe(1);
    expect(html).not.toContain('</script><script>');
    expect(JSON.parse(articleJsonLd).headline)
      .toBe('</script><script>alert("unsafe")</script>');
  });
});
