import {
  renderMarkdownContent,
  renderMarkdownPreview
} from '../server/utils/markdownHelper.js';

const table = `| Scale | Freezing |
|---|---:|
| Celsius | 0 |`;

describe('Markdown table sorting opt-out', () => {
  it('adds no-sort to a table after a standalone marker', () => {
    const html = renderMarkdownContent(`{.no-sort}\n\n${table}`);

    expect(html).toContain('<table class="no-sort">');
    expect(html).not.toContain('{.no-sort}');
    expect(html).toContain('<div class="table-scroll-wrapper"><table class="no-sort">');
  });

  it('supports the marker directly above the table without a blank line', () => {
    const html = renderMarkdownContent(`{.no-sort}\n${table}`);

    expect(html).toContain('<table class="no-sort">');
    expect(html).not.toContain('{.no-sort}');
  });

  it('leaves ordinary tables sortable', () => {
    const html = renderMarkdownContent(table);

    expect(html).toContain('<table>');
    expect(html).not.toContain('no-sort');
  });

  it('preserves the marker as text when it is not immediately followed by a table', () => {
    const html = renderMarkdownContent(`{.no-sort}\n\nSome explanation.\n\n${table}`);

    expect(html).toContain('<p>{.no-sort}</p>');
    expect(html).toContain('<table>');
  });

  it('does not consume a marker combined with other text', () => {
    const html = renderMarkdownContent(`Use {.no-sort}\n\n${table}`);

    expect(html).toContain('<p>Use {.no-sort}</p>');
    expect(html).toContain('<table>');
  });

  it('retains the opt-out in rendered previews', () => {
    const { html } = renderMarkdownPreview(`{.no-sort}\n\n${table}`);

    expect(html).toContain('<table class="no-sort">');
    expect(html).not.toContain('{.no-sort}');
  });
});
