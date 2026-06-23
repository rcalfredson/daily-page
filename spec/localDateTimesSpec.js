import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync(new URL('../public/js/local-date-times.js', import.meta.url), 'utf8');

function pageWith(body) {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${body}</body></html>`, {
    runScripts: 'outside-only'
  });
  dom.window.eval(script);
  return dom;
}

describe('local date-time formatting', () => {
  it('formats an instant in the browser locale and timezone', () => {
    const iso = '2026-01-01T01:00:00.000Z';
    const dom = pageWith(
      `<time datetime="${iso}" data-local-date-time data-date-style="medium" data-time-style="short">fallback</time>`
    );

    dom.window.formatLocalDateTimes();

    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso));
    expect(dom.window.document.querySelector('time').textContent).toBe(expected);
  });

  it('keeps translated text around the localized date', () => {
    const dom = pageWith(
      '<time datetime="2026-01-01T01:00:00.000Z" data-local-date-time data-date-template="Created on __DATE__">fallback</time>'
    );

    dom.window.formatLocalDateTimes();

    expect(dom.window.document.querySelector('time').textContent).toMatch(/^Created on .+/);
  });

  it('leaves an invalid timestamp fallback unchanged', () => {
    const dom = pageWith('<time datetime="not-a-date" data-local-date-time>fallback</time>');

    dom.window.formatLocalDateTimes();

    expect(dom.window.document.querySelector('time').textContent).toBe('fallback');
  });
});
