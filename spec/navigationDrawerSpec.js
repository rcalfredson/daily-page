import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const drawerScript = fs.readFileSync('public/js/navigation-drawer.js', 'utf8');

const setupDrawer = () => {
  const dom = new JSDOM(`<!doctype html>
    <html>
      <body>
        <a id="main-menu-toggle" href="#main-menu" aria-expanded="false">Menu</a>
        <nav id="main-menu" class="main-menu">
          <a id="main-menu-close" href="#main-menu-toggle">Close</a>
          <a href="/rooms">Rooms</a>
        </nav>
        <a class="backdrop" href="#main-menu-toggle" tabindex="-1"></a>
      </body>
    </html>`, {
    runScripts: 'outside-only',
    url: 'https://example.test/'
  });

  const mediaListeners = [];
  dom.window.matchMedia = () => ({
    matches: true,
    addEventListener: (eventName, listener) => {
      if (eventName === 'change') mediaListeners.push(listener);
    }
  });
  dom.window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  dom.window.eval(drawerScript);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  return { dom, mediaListeners };
};

describe('navigation drawer', () => {
  it('opens from the toolbar and closes on Escape while restoring focus', () => {
    const { dom } = setupDrawer();
    const { document, KeyboardEvent, MouseEvent } = dom.window;
    const toggle = document.querySelector('#main-menu-toggle');
    const drawer = document.querySelector('#main-menu');

    toggle.focus();
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(drawer.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.classList.contains('main-menu-open')).toBeTrue();
    expect(document.activeElement.id).toBe('main-menu-close');

    document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape'
    }));

    expect(drawer.getAttribute('aria-expanded')).toBe('false');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.classList.contains('main-menu-open')).toBeFalse();
    expect(document.activeElement).toBe(toggle);
  });

  it('closes when the backdrop is selected', () => {
    const { dom } = setupDrawer();
    const { document, MouseEvent } = dom.window;
    const toggle = document.querySelector('#main-menu-toggle');
    const drawer = document.querySelector('#main-menu');
    const backdrop = document.querySelector('.backdrop');

    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(drawer.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
