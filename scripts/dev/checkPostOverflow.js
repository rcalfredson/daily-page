// Start a dedicated browser first:
// firefox --headless --no-remote --profile /tmp/daily-page-overflow-firefox --remote-debugging-port 9223
// Then: npm run test:post-overflow (or pass another ws://host:port/session URL).
// Uses Node's native WebSocket and Firefox BiDi; no database or browser package needed.
/* global document, getComputedStyle, innerWidth, WebSocket */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { renderMarkdownContent } from '../../server/utils/markdownHelper.js';

const styles = ['style', 'block-common', 'block-view', 'table-scroll-fade', 'street-view-embed']
  .map(name => fs.readFileSync(`public/css/${name}.css`, 'utf8')).join('\n');
const token = 'abcdefghij'.repeat(40);
const imageUrl = `data:image/png;base64,${(await sharp({
  create: { width: 1600, height: 800, channels: 3, background: '#8ab' }
}).png().toBuffer()).toString('base64')}`;
const markdown = `# Further Reading

https://example.com/${token}?query=${token}

- https://example.org/${token}
- Nested code:

      const value = "${token}";

> ${token}

${token}

Inline code: \`${token}\`.

[Normal link](https://example.com) and ordinary prose with natural spaces between words.

\`\`\`js
const value = "${token}";
\`\`\`

| One | Two | Three | Four |
| --- | --- | --- | --- |
| ${token} | ${token} | ${token} | ${token} |

![Large image](https://example.test/image.png)

@[streetview](https://www.google.com/maps/embed?pb=fixture)
`;

function fixture(recommendations, dir) {
  // Disable existing body clipping so it cannot conceal a regression. The embed
  // retains its real markup/styles but uses a local blank frame for this check.
  const content = renderMarkdownContent(markdown)
    .replace('src="https://example.test/image.png"', `src="${imageUrl}"`)
    .replace(/src="https:\/\/www.google.com[^" ]*"/, 'src="about:blank"');
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${styles}</style><style>body { overflow-x: visible; }</style>
    <body dir="${dir}"><div class="with-margins"><div id="block-page">
      <div class="block-view-layout ${recommendations ? 'block-view-layout--with-recommendations' : ''}">
        <div class="block-view-primary"><div class="block-content">${content}</div></div>
        ${recommendations ? '<aside class="block-recommendations">Recommended reading</aside>' : ''}
        <div class="block-view-conversation">Comments</div>
      </div>
    </div></div></body>`;
}

// Serialized and evaluated in the browser, where these DOM globals are available.
function inspectLayout() {
  const content = document.querySelector('.block-content');
  const bounds = content.getBoundingClientRect();
  const inside = rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
  const rectsFor = element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return Array.from(range.getClientRects());
  };
  const links = Array.from(content.querySelectorAll('a'));
  const longLinks = links.filter(link => link.textContent.length > 100);
  const normal = links.find(link => link.textContent === 'Normal link').parentElement;
  const proseRects = rectsFor(normal).map(rect => [rect.x, rect.y, rect.width, rect.height]);
  const oldWrap = normal.style.overflowWrap;
  normal.style.overflowWrap = 'normal';
  const naturalRects = rectsFor(normal).map(rect => [rect.x, rect.y, rect.width, rect.height]);
  normal.style.overflowWrap = oldWrap;
  const scrollers = Array.from(content.querySelectorAll('pre, .table-scroll-wrapper'));
  const scrollsLocally = scrollers.every(element => {
    element.scrollLeft = getComputedStyle(element).direction === 'rtl' ? -100 : 100;
    const moved = element.scrollLeft !== 0;
    element.scrollLeft = 0;
    return element.scrollWidth > element.clientWidth && moved && inside(element.getBoundingClientRect());
  });
  const image = content.querySelector('img');
  return {
    viewport: innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    linksWrap: longLinks.every(link => rectsFor(link).length > 1 && rectsFor(link).every(inside)),
    tokensFit: Array.from(content.querySelectorAll(':scope > p, blockquote p')).filter(element => element.textContent.trim()).every(element => rectsFor(element).every(inside)),
    proseUnchanged: JSON.stringify(proseRects) === JSON.stringify(naturalRects),
    scrollsLocally,
    codePreserved: Array.from(content.querySelectorAll('pre')).every(element => getComputedStyle(element).whiteSpace === 'pre'),
    imageFits: image.complete && inside(image.getBoundingClientRect()) && Math.abs(image.width / image.height - 2) < 0.01,
    embedFits: inside(content.querySelector('iframe').getBoundingClientRect())
  };
}

const ws = new WebSocket(process.argv[2] || 'ws://127.0.0.1:9223/session');
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timeout);
  if (message.type === 'error') request.reject(new Error(message.message));
  else request.resolve(message.result);
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 15000);
    pending.set(requestId, { resolve, reject, timeout });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
}
let sessionStarted = false;
try {
  await send('session.new', { capabilities: {} });
  sessionStarted = true;
  const { context } = await send('browsingContext.create', { type: 'tab' });
  for (const dir of ['ltr', 'rtl']) {
    for (const recommendations of [false, true]) {
      for (const width of [320, 375, 390, 430, 768, 1440]) {
        await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
        await send('browsingContext.navigate', {
          context, url: `data:text/html;base64,${Buffer.from(fixture(recommendations, dir)).toString('base64')}`, wait: 'complete'
        });
        // Include the external-link marker added on real post pages.
        await send('script.evaluate', {
          target: { context },
          expression: `${fs.readFileSync('public/js/post-external-links.js', 'utf8')}\ndocument.dispatchEvent(new Event('DOMContentLoaded'));`,
          awaitPromise: false
        });
        const result = await send('script.evaluate', {
          target: { context }, expression: `JSON.stringify((${inspectLayout.toString()})())`, awaitPromise: false
        });
        assert.equal(result.type, 'success', JSON.stringify(result));
        const metrics = JSON.parse(result.result.value);
        const label = `${width}px ${dir}, recommendations=${recommendations}`;
        assert.ok(metrics.pageWidth <= width && metrics.bodyWidth <= width, `${label}: page overflow ${JSON.stringify(metrics)}`);
        for (const check of ['linksWrap', 'tokensFit', 'proseUnchanged', 'scrollsLocally', 'codePreserved', 'imageFits', 'embedFits']) {
          assert.ok(metrics[check], `${label}: ${check} failed ${JSON.stringify(metrics)}`);
        }
        console.log(`PASS ${label}`);
      }
    }
  }
} finally {
  if (sessionStarted) await send('session.end');
  ws.close();
}
