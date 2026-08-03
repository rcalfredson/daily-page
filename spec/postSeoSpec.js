import { buildPostSeo, POST_META_DESCRIPTION_MAX_LENGTH } from '../server/utils/postSeo.js';
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

  it('includes a valid publication timestamp when one exists', () => {
    const metadata = buildPostSeo({
      title: 'Dated post',
      createdAt: new Date('2026-08-02T12:30:00Z')
    }, options);

    expect(metadata.socialPublishedTime).toBe('2026-08-02T12:30:00.000Z');
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
});
