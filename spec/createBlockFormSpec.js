import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync('public/js/create-block.js', 'utf8');
const sourceId = '0123456789abcdef01234567';

function deferred() {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function render(fetch) {
  const dom = new JSDOM(`
    <!doctype html>
    <html lang="en"><body>
      <form id="block-form" action="/api/v1/rooms/room-1/blocks">
        <input id="title" name="title" value="A translated post">
        <textarea name="content"></textarea>
        <select id="lang" name="lang">
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="ru">Russian</option>
        </select>
        <input id="source-block" type="text">
        <input id="groupId" name="groupId" type="hidden">
        <input id="originalBlock" name="originalBlock" type="hidden">
        <button type="submit">Create</button>
      </form>
    </body></html>
  `, {
    runScripts: 'outside-only',
    url: 'https://example.test/rooms/room-1/blocks/create'
  });
  dom.window.fetch = fetch;
  dom.window.alert = jasmine.createSpy('alert');
  const ready = new Promise(resolve => {
    dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });
  dom.window.eval(script);
  await ready;
  return dom;
}

describe('create block translation fields', () => {
  it('waits for source lookup and preserves an available selected language', async () => {
    const lookup = deferred();
    let submittedData;
    const dom = await render((url, options = {}) => {
      if (!options.method) return lookup.promise;
      submittedData = JSON.parse(options.body);
      return new Promise(() => {});
    });
    const { document } = dom.window;
    const sourceInput = document.getElementById('source-block');
    const langSelect = document.getElementById('lang');

    langSelect.value = 'ru';
    sourceInput.value = sourceId;
    sourceInput.dispatchEvent(new dom.window.Event('blur'));
    document.getElementById('block-form').dispatchEvent(
      new dom.window.Event('submit', { bubbles: true, cancelable: true })
    );

    expect(submittedData).toBeUndefined();

    lookup.resolve({
      ok: true,
      json: async () => ({
        block: { groupId: 'translation-group-1' },
        translations: [{ lang: 'en' }]
      })
    });
    await lookup.promise;
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    expect(langSelect.value).toBe('ru');
    expect(submittedData.lang).toBe('ru');
    expect(submittedData.groupId).toBe('translation-group-1');
    expect(submittedData.originalBlock).toBe(sourceId);
  });
});
