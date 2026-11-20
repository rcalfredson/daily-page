import { HOME_DESIGN_OPTIONS, CART_DESIGN_OPTIONS, validateConstructionDesign, constructionCartCost } from '/js/forest-construction-design.js';

const LABELS = { width: 'Width', depth: 'Depth', walls: 'Wall material', color: 'Wall finish', roof: 'Roof material',
  roofColor: 'Roof finish', length: 'Bed length', body: 'Body', wheels: 'Wheels', supports: 'Supports',
  canopy: 'Canopy', wood: 'Wood finish', cloth: 'Cloth color' };

export function createConstructionEditor({ viewport, preview, apply, close, saved = false, saveState = () => null, retry = null }) {
  const panel = document.createElement('form');
  panel.className = 'home-study-editor'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'study-editor-title');
  panel.innerHTML = `<header><span>THE CLEARING WORKSHOP</span><h2 id="study-editor-title" tabindex="-1"></h2></header>
    <div class="home-study-editor-scroll"><p>${saved ? "Preview your changes here, then save them for your next visit." : "Try your ideas here in the clearing. Apply keeps them for this visit; reloading starts fresh."}</p>
    <div data-design-fields></div><p data-design-description></p><p role="status" aria-live="polite" data-design-status></p></div>
    <footer><button type="button" data-design-retry hidden>Retry save</button><button type="button" data-design-cancel>Cancel</button><button type="submit" data-design-apply>Apply design</button></footer>`;
  viewport.append(panel);
  let kind = null, draft = null, locked = [], pending = false;
  const fields = panel.querySelector('[data-design-fields]');
  const status = panel.querySelector('[data-design-status]');
  const submit = panel.querySelector('[data-design-apply]');
  const description = panel.querySelector('[data-design-description]');
  function refresh() {
    const error = validateConstructionDesign(kind, draft) ? preview(kind, { ...draft }) : 'Choose supported parts and dimensions.';
    const state = saveState();
    submit.disabled = pending || Boolean(error) || Boolean(state?.pending) || ['stale', 'reload'].includes(state?.status);
    const fits = kind === 'cart' ? 'The cart fits at its parking spot.' : 'The house fits in your clearing.';
    status.textContent = pending ? 'Saving…' : error || (state && state.status !== 'saved' ? state.message : fits);
    const firstCart = kind === 'cart' && state?.record.cartDesign === null;
    submit.textContent = firstCart ? 'Assemble cart' : saved ? 'Save design' : 'Apply design';
    panel.querySelector('[data-design-retry]').hidden = !state?.pending && !['stale', 'reload'].includes(state?.status);
    panel.querySelector('[data-design-retry]').disabled = pending;
    panel.querySelector('[data-design-retry]').textContent = state?.status === 'reload' ? 'Reload forest' : state?.status === 'stale' ? 'Retry loading' : 'Retry save';
    panel.querySelector('[data-design-cancel]').disabled = pending;
    for (const select of fields.querySelectorAll('select')) select.disabled = pending || Boolean(state?.pending);
    status.dataset.invalid = String(Boolean(error));
    description.textContent = kind === 'home'
      ? `${draft.width} × ${draft.depth} footprint. The doorway stays in place as the house grows toward the back.`
      : `${draft.length} × ${draft.width} bed. Supports and axles fit the chosen size. Finishes do not change speed or clearance.`;
    if (saved && kind === 'home') description.textContent += ' House finishes are freely available.';
    if (saved && kind === 'cart' && validateConstructionDesign('cart', draft)) {
      const cost = constructionCartCost(draft), current = state.record;
      const remaining = `${current.holdings.timber + current.cartCommitment.timber - cost.timber} timber and ${current.holdings.cloth + current.cartCommitment.cloth - cost.cloth} cloth will remain.`;
      description.textContent += ` Uses ${cost.timber} timber and ${cost.cloth} cloth. ${firstCart
        ? remaining : `Reusing your current cart returns its materials. ${remaining}`}`;
    }
    const cloth = fields.querySelector('[name="cloth"]');
    if (cloth) { cloth.disabled = pending || Boolean(state?.pending) || draft.canopy === 'none'; cloth.parentElement.hidden = draft.canopy === 'none'; }
  }
  function finish() {
    if (!kind || pending) return;
    panel.hidden = true; kind = null; draft = null;
    delete viewport.dataset.studyEditing;
    for (const [element, inert] of locked) element.inert = inert;
    locked = [];
    close();
    viewport.focus({ preventScroll: true });
  }
  panel.addEventListener('change', event => {
    const choices = (kind === 'home' ? HOME_DESIGN_OPTIONS : CART_DESIGN_OPTIONS)[event.target.name];
    if (!choices) return;
    draft[event.target.name] = choices.find(([value]) => String(value) === event.target.value)?.[0];
    refresh();
  });
  async function perform(work) {
    if (pending) return;
    pending = true; refresh();
    let success = false;
    try { success = await work(); } finally { pending = false; refresh(); }
    if (success) finish();
  }
  panel.addEventListener('submit', event => {
    event.preventDefault(); refresh();
    if (!submit.disabled) perform(() => apply(kind, { ...draft }));
  });
  panel.querySelector('[data-design-retry]').addEventListener('click', () => perform(retry));
  panel.querySelector('[data-design-cancel]').addEventListener('click', finish);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll('button:not(:disabled), select:not(:disabled)')].filter(el => !el.closest('[hidden]'));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement.tagName === 'H2')) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // The scene remains visible behind the editor, with its gestures and inspection suspended.
  for (const type of ['pointerdown', 'pointerup', 'keydown']) viewport.addEventListener(type, event => {
    if (kind && !panel.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  return {
    get active() { return Boolean(kind); },
    refresh() { if (kind) refresh(); },
    snapshot: () => kind ? { kind, draft: { ...draft }, valid: !submit.disabled } : null,
    cancel: finish,
    open(nextKind, design) {
      if (kind) return;
      kind = nextKind; draft = { ...design };
      const options = kind === 'home' ? HOME_DESIGN_OPTIONS : CART_DESIGN_OPTIONS;
      panel.querySelector('h2').textContent = kind === 'home' ? 'Make yourself at home' : 'Build your traveling cart';
      fields.replaceChildren();
      for (const [name, choices] of Object.entries(options)) {
        const label = document.createElement('label'); label.textContent = LABELS[name];
        const select = document.createElement('select'); select.name = name;
        select.dataset.designField = name;
        for (const [value, text] of choices) {
          const option = document.createElement('option'); option.value = value; option.textContent = text;
          select.append(option);
        }
        select.value = draft[name]; label.append(select); fields.append(label);
      }
      locked = [...viewport.children].filter(el => el !== panel).map(el => [el, el.inert]);
      for (const [el] of locked) el.inert = true;
      viewport.dataset.studyEditing = kind; panel.hidden = false; refresh();
      panel.querySelector('h2').focus({ preventScroll: true });
    }
  };
}
