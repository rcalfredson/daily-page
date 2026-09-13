import fs from 'fs';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync('public/js/post-external-links.js', 'utf8');

const createDom = markup => {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    runScripts: 'outside-only',
    url: 'https://daily-page.example/posts/one'
  });

  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
};

describe('external links in post content', () => {
  it('decorates external web links in full posts and previews', () => {
    const dom = createDom(`
      <article class="block-content"><a id="full" href="https://example.com/article">Article</a></article>
      <article class="content-preview"><a id="preview" href="//example.org/news">News</a></article>
      <article class="featured-content-preview"><a id="featured" href="http://example.net">Featured</a></article>
    `);

    expect(dom.window.document.querySelector('#full').classList).toContain('post-external-link');
    expect(dom.window.document.querySelector('#preview').classList).toContain('post-external-link');
    expect(dom.window.document.querySelector('#featured').classList).toContain('post-external-link');
  });

  it('leaves internal and non-web links undecorated', () => {
    const dom = createDom(`
      <div class="block-content">
        <a id="relative" href="/posts/two">Relative</a>
        <a id="absolute" href="https://daily-page.example/posts/three">Absolute</a>
        <a id="fragment" href="#notes">Notes</a>
        <a id="email" href="mailto:hello@example.com">Email</a>
      </div>
    `);

    ['relative', 'absolute', 'fragment', 'email'].forEach(id => {
      expect(dom.window.document.querySelector(`#${id}`).classList).not.toContain('post-external-link');
    });
  });

  it('does not decorate UI links or links that wrap post images', () => {
    const dom = createDom(`
      <nav><a id="nav" href="https://example.com">Navigation</a></nav>
      <div class="content-preview">
        <a id="image" href="https://example.com/photo"><img src="photo.jpg" alt=""></a>
      </div>
    `);

    expect(dom.window.document.querySelector('#nav').classList).not.toContain('post-external-link');
    expect(dom.window.document.querySelector('#image').classList).not.toContain('post-external-link');
  });
});
