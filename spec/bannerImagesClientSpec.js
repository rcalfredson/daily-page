import fs from 'fs';
import { JSDOM } from 'jsdom';

const bannerScript = fs.readFileSync('public/js/banner-images.js', 'utf8');
const lightboxScript = fs.readFileSync('public/js/block-images.js', 'utf8');

const createDom = markup => new JSDOM(`<!doctype html><body>${markup}</body>`, {
  runScripts: 'outside-only',
  url: 'https://example.test/'
});

const setImageDimensions = (image, width, height) => {
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height }
  });
};

describe('banner image client behavior', () => {
  it('uses the natural ratio for ordinary list banners', () => {
    const dom = createDom(`
      <figure class="block-banner block-banner--card" data-banner-image="true">
        <img class="block-banner__image" src="/banner.jpg">
      </figure>
    `);
    const { document } = dom.window;
    setImageDimensions(document.querySelector('img'), 2000, 1000);

    dom.window.eval(bannerScript);
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    expect(document.querySelector('figure').style.getPropertyValue('--banner-aspect-ratio')).toBe('2');
  });

  it('clamps unusually tall and wide list banners to the supported range', () => {
    const dom = createDom(`
      <figure class="block-banner block-banner--card" data-banner-image="true">
        <img id="tall" class="block-banner__image" src="/tall.jpg">
      </figure>
      <figure class="block-banner block-banner--featured" data-banner-image="true">
        <img id="wide" class="block-banner__image" src="/wide.jpg">
      </figure>
    `);
    const { document } = dom.window;
    setImageDimensions(document.getElementById('tall'), 800, 1200);
    setImageDimensions(document.getElementById('wide'), 4000, 1000);

    dom.window.eval(bannerScript);
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const banners = document.querySelectorAll('figure');
    expect(Number(banners[0].style.getPropertyValue('--banner-aspect-ratio'))).toBeCloseTo(16 / 9);
    expect(banners[1].style.getPropertyValue('--banner-aspect-ratio')).toBe('2.5');
  });

  it('opens only hero banners in the shared image lightbox', () => {
    const dom = createDom(`
      <figure class="block-banner block-banner--hero block-banner--image" data-banner-image="true">
        <img id="hero" class="block-banner__image" src="/hero.jpg" alt="Hero description">
      </figure>
      <figure class="block-banner block-banner--card block-banner--image" data-banner-image="true">
        <img id="card" class="block-banner__image" src="/card.jpg" alt="">
      </figure>
    `);
    const { document, MouseEvent } = dom.window;

    dom.window.eval(lightboxScript);
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const hero = document.getElementById('hero');
    const card = document.getElementById('card');
    expect(hero.getAttribute('role')).toBe('button');
    expect(hero.tabIndex).toBe(0);
    expect(card.hasAttribute('role')).toBeFalse();

    hero.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const lightbox = document.querySelector('.block-image-lightbox');
    expect(lightbox.hidden).toBeFalse();
    expect(lightbox.querySelector('img').src).toBe('https://example.test/hero.jpg');
    expect(lightbox.querySelector('img').alt).toBe('Hero description');
  });
});
