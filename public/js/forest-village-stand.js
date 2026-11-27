import { displayedItem, itemCount, offerAvailable, QUINCE_JAM, quickStepSeconds, TANSY_OFFER, WOVEN_TRIM } from './forest-village-goods.js';

const itemNames = { [QUINCE_JAM]: 'Quince jam', [WOVEN_TRIM]: 'Woven trim' };

export function createVillageStand({ dock, satchel, read, blocked, canEat, save, focus, say }) {
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.hidden = true; toggle.textContent = 'Your stand';
  toggle.setAttribute('aria-controls', 'forest-village-stand');
  toggle.setAttribute('aria-expanded', 'false');
  const claim = document.createElement('button');
  claim.type = 'button'; claim.hidden = true; claim.textContent = 'Take your jar from Tansy’s shelf';
  claim.dataset.claimStallJar = '';
  const stand = document.createElement('section');
  stand.id = 'forest-village-stand'; stand.className = 'forest-village-stand'; stand.hidden = true;
  stand.setAttribute('aria-label', 'Your stand');
  stand.innerHTML = '<div class="owner-forest__garden-actions" role="group" aria-label="Stand arrangement"><button type="button" data-arrangement="shelf">Shelf</button><button type="button" data-arrangement="barter-mat">Barter mat</button></div><p data-display-item></p><p data-customer role="status"></p><div class="owner-forest__garden-actions"><button type="button" data-display-jar>Set out quince jam</button><button type="button" data-pack-item>Return to Satchel</button><button type="button" data-barter-jar>Trade one jar for woven trim</button></div>';
  const arrangements = [...stand.querySelectorAll('[data-arrangement]')];
  const display = stand.querySelector('[data-display-item]'), customer = stand.querySelector('[data-customer]');
  const put = stand.querySelector('[data-display-jar]'), take = stand.querySelector('[data-pack-item]');
  const trade = stand.querySelector('[data-barter-jar]');
  const boost = document.createElement('p'); boost.hidden = true; boost.dataset.jamBoost = '';
  dock.append(toggle, claim, stand, boost);

  const provisions = document.createElement('div');
  provisions.className = 'forest-satchel-provisions'; provisions.hidden = true;
  provisions.innerHTML = '<p data-provisions></p><button type="button" data-eat-jam>Eat quince jam</button><p data-eat-status role="status"></p>';
  satchel.after(provisions);
  const gardenPanel = satchel.closest('[data-forest-garden]');
  const closeSatchel = gardenPanel.querySelector('[data-garden-close]');
  const holdings = provisions.querySelector('[data-provisions]'), eat = provisions.querySelector('[data-eat-jam]');
  const eatStatus = provisions.querySelector('[data-eat-status]');

  const write = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  let access;
  function open(value) {
    stand.hidden = !value;
    toggle.setAttribute('aria-expanded', String(value));
    if (value) update(access);
  }
  toggle.addEventListener('click', () => { if (!toggle.hidden) open(stand.hidden); });
  stand.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    open(false); toggle.focus(); event.stopPropagation();
  });

  async function perform(button, action, args, notice, after) {
    if (button.hidden || button.disabled || blocked() || button.getAttribute('aria-pressed') === 'true') return;
    if (await save(action, args)) {
      update(access);
      if (notice) say(notice);
      after?.();
    }
  }
  const move = (button, item, from, to, notice, after) =>
    perform(button, 'village-move-item', { item, from, to }, notice, after);
  arrangements.forEach(button => button.addEventListener('click', () => {
    perform(button, 'village-arrange', { arrangement: button.dataset.arrangement });
  }));
  claim.addEventListener('click', () => move(claim, QUINCE_JAM, 'stall-shelf', 'satchel', 'Your jar is back in the Satchel.', focus));
  put.addEventListener('click', () => move(put, QUINCE_JAM, 'satchel', 'stand', null, () => take.focus()));
  take.addEventListener('click', () => move(take, displayedItem(read(), 'stand'), 'stand', 'satchel', null, () => put.focus()));
  trade.addEventListener('click', () => perform(trade, 'village-barter', { offer: TANSY_OFFER.id },
    'You traded one jar. The woven trim is in your Satchel, ready to fit at the cart workshop.', () => toggle.focus()));
  eat.addEventListener('click', async () => {
    if (eat.hidden || eat.disabled || blocked() || !canEat()) return;
    if (await save('village-eat', { item: QUINCE_JAM })) {
      eatStatus.textContent = '';
      closeSatchel.click();
    } else eatStatus.textContent = 'Close the Satchel to review the save status.';
  });

  function update(nextAccess) {
    access = nextAccess;
    const { nearStand, nearShelf } = access;
    const village = read(), onStand = displayedItem(village, 'stand');
    const jars = itemCount(village, 'satchel', QUINCE_JAM), trim = itemCount(village, 'satchel', WOVEN_TRIM);
    const mat = village?.standArrangement === 'barter-mat';
    const ready = offerAvailable(village), spent = village?.acceptedOffers?.includes(TANSY_OFFER.id);
    toggle.hidden = !nearStand;
    if (!nearStand) open(false);
    claim.hidden = !nearShelf || !itemCount(village, 'stall-shelf', QUINCE_JAM);
    claim.disabled = blocked();
    if (!stand.hidden) {
      const arrangement = village?.standArrangement ?? 'shelf';
      for (const button of arrangements) {
        button.setAttribute('aria-pressed', String(button.dataset.arrangement === arrangement));
        button.disabled = blocked();
      }
      const surface = mat ? 'barter mat' : 'shelf';
      const displayText = onStand ? `${itemNames[onStand]} on the ${surface}.` : `The ${surface} is empty.`;
      const carriedText = jars === 1 ? '1 jar in your Satchel.' : `${jars} jars in your Satchel.`;
      write(display, `${displayText} ${carriedText}`);
      write(customer, spent ? 'You’ve already traded with Tansy. Anything you display here stays yours.' : ready ? 'Tansy: “I’ll trade a woven cart trim for that quince jam.”'
        : onStand && !mat ? 'Tansy: “I’ll leave that one for you. I look for quince jam on the barter mat.”'
          : 'Tansy: “I’m looking for quince jam. Set a jar on the barter mat if you’d like to trade.”');
      write(put, spent ? 'Display quince jam' : 'Set out quince jam');
      put.hidden = Boolean(onStand) || !jars;
      take.hidden = !onStand;
      trade.hidden = !ready;
      for (const button of [put, take, trade]) button.disabled = blocked();
    }
    const seconds = quickStepSeconds(village);
    boost.hidden = !seconds;
    write(boost, seconds ? `Quince jam · quicker on foot for ${seconds}s` : '');
    provisions.hidden = !jars && !trim && !seconds;
    write(holdings, [jars ? `Quince jam · ${jars} ${jars === 1 ? 'jar' : 'jars'}` : '',
      trim ? 'Woven trim · fit at the cart workshop' : '', seconds ? boost.textContent : ''].filter(Boolean).join(' · '));
    eat.hidden = !jars;
    eat.disabled = blocked() || !canEat() || Boolean(seconds);
    if (!blocked() && gardenPanel.hidden) eatStatus.textContent = '';
  }
  return { update };
}
