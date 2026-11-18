import { createHomesteadExtension } from '/js/forest-homestead-extension.js';
/* global document, window */
import { startOwnerForest } from '/js/owner-forest-runtime.js';
const study = JSON.parse(document.getElementById('home-cart-study').textContent);
const durable = Boolean(study.saved);
const main = document.querySelector('main.owner-forest');
const note = document.createElement('section'); note.className = 'home-study-note';
note.innerHTML = `<strong>A home of your own · construction & travel study</strong>
  <p>At home, choose <b>Shape house</b> or <b>Build cart</b> to try parts and finishes. Then take your cart along the pale trail to Amber clearing, step out, and drive home. Touch and drag to travel.<span class="owner-forest__key-hint"> Arrow keys / WASD also work; C enters or leaves the cart and R toggles reversing.</span></p>
  <details><summary>Study options & recovery · temporary state, no account data</summary>
    <div class="home-study-controls">
      <label>Reset cart example<select data-study-cart><option value="canopy">Large canopy cart</option><option value="compact">Compact open cart</option></select></label>
      <label>Reset house example<select data-study-house><option value="large">Wide house</option><option value="compact">Small house</option></select></label>
      <label>Region delivery<select data-study-network><option value="normal">Normal</option><option value="slow">1.2 second delay</option><option value="failed">Unavailable</option></select></label>
      <button type="button" data-study-recover>Recover at home</button>
    </div><p data-home-study-state></p><a href="/__study/report">Placement report</a>
  </details>`;
if (durable) note.innerHTML = `<strong>A home of your own · saved construction & travel</strong>
  <p>Walk near the mule and choose <b>Offer hand</b> (E), then <b>Scratch</b> or <b>Come along</b>. Walk away whenever you like. Your companion, house and cart are remembered between visits. Stepping out saves your parking spot. While driving, your last confirmed parking is kept.</p>
  <div class="home-study-controls"><button type="button" data-study-recover>Recover at home</button>
  <button type="button" data-save-retry hidden>Retry save</button></div>
  <p role="status" aria-live="polite" data-save-status></p><p data-home-study-state></p>`;
main.prepend(note);
document.querySelector('[data-owner-forest-reset]').textContent = 'Return to home';

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input.url;
  if (/\/api\/v1\/forest\/(regions|authored-regions|terrain-regions)\?/.test(url)) {
    const mode = document.querySelector('[data-study-network]')?.value || 'normal';
    if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 1200));
    if (mode === 'failed') throw new Error('Simulated study region failure');
  }
  return originalFetch(input, options);
};

startOwnerForest({ createExtension: api => createHomesteadExtension(api, study) });
