import {
  normalizeStreetViewEmbedUrl
} from '../lib/streetViewEmbed.js';
import {
  renderMarkdownContent,
  renderMarkdownPreview
} from '../server/utils/markdownHelper.js';

describe('Street View Markdown embeds', () => {
  const embedUrl = 'https://www.google.com/maps/embed?pb=!4v1782694937409!6m8!1m7';
  const markdown = `@[streetview](${embedUrl})`;

  it('renders a validated Google Street View URL as a lazy iframe', () => {
    const html = renderMarkdownContent(markdown);

    expect(html).toContain('<iframe');
    expect(html).toContain(`src="${embedUrl}"`);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });

  it('renders a link instead of an iframe in post previews', () => {
    const { html } = renderMarkdownPreview(markdown);

    expect(html).not.toContain('<iframe');
    expect(html).toContain('class="street-view-embed-link"');
    expect(html).toContain(`href="${embedUrl}"`);
  });

  it('can disable embeds for Markdown fields such as post descriptions', () => {
    const html = renderMarkdownContent(markdown, {
      allowStreetViewEmbeds: false
    });

    expect(html).not.toContain('<iframe');
    expect(html).toContain('class="street-view-embed-link"');
  });

  it('rejects lookalike hosts and non-HTTPS URLs', () => {
    expect(normalizeStreetViewEmbedUrl(
      'https://www.google.com.evil.example/maps/embed?pb=value'
    )).toBeNull();
    expect(normalizeStreetViewEmbedUrl(
      'https://www.google.com@evil.example/maps/embed?pb=value'
    )).toBeNull();
    expect(normalizeStreetViewEmbedUrl(
      'http://www.google.com/maps/embed?pb=value'
    )).toBeNull();
  });

  it('rejects other Google paths and unexpected query parameters', () => {
    expect(normalizeStreetViewEmbedUrl(
      'https://www.google.com/maps/search?pb=value'
    )).toBeNull();
    expect(normalizeStreetViewEmbedUrl(
      'https://www.google.com/maps/embed?pb=value&next=other'
    )).toBeNull();
  });

  it('keeps arbitrary iframe HTML escaped', () => {
    const html = renderMarkdownContent(
      '<iframe src="https://evil.example"></iframe>'
    );

    expect(html).not.toContain('<iframe');
    expect(html).toContain('&lt;iframe');
  });
});
