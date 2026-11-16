// Contextual world actions. No modal, movement lock or scripted camera.
export function createCompanionEncounter({ dock, read, act, retry, focus }) {
  const panel = document.createElement('section'); panel.className = 'forest-companion-actions'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Companion actions');
  panel.innerHTML = `<span data-companion-name></span><button type="button" data-companion-action>Offer hand</button>
    <button type="button" data-companion-follow hidden>Come along</button>
    <button type="button" data-companion-retry hidden>Retry save</button>
    <p role="status" aria-live="polite" data-companion-status></p>`;
  dock.prepend(panel);
  const action = panel.querySelector('[data-companion-action]'), follow = panel.querySelector('[data-companion-follow]');
  const again = panel.querySelector('[data-companion-retry]'), status = panel.querySelector('[data-companion-status]');
  let caption = '', until = 0;
  function refresh() {
    const state = read(), saving = state.save;
    panel.hidden = !state.available;
    panel.querySelector('[data-companion-name]').textContent = state.companion?.name || 'Mule';
    action.textContent = state.companion ? 'Scratch' : 'Offer hand';
    action.disabled = state.blocked || state.actor.pending;
    follow.hidden = !state.companion;
    follow.textContent = state.actor.following ? 'Wait here' : 'Come along';
    follow.disabled = action.disabled;
    again.hidden = !saving?.pending && !['stale', 'reload'].includes(saving?.status);
    again.disabled = Boolean(saving?.busy);
    again.textContent = saving?.status === 'reload' ? 'Reload forest' : saving?.status === 'stale' ? 'Retry loading' : 'Retry save';
    const next = saving && !['saved', 'saving'].includes(saving.status) ? saving.message
      : state.actor.blocked ? 'Mallow needs a clearer way through.'
        : globalThis.performance.now() < until ? caption : '';
    if (status.textContent !== next) status.textContent = next;
  }
  action.addEventListener('click', () => { if (!action.disabled) { act(read().companion ? 'scratch' : 'meet'); focus(); } });
  follow.addEventListener('click', () => { if (!follow.disabled) { act('follow'); focus(); } });
  again.addEventListener('click', async () => { await retry(); refresh(); focus(); });
  return { refresh, notice(text) { caption = text; until = globalThis.performance.now() + 3000; refresh(); } };
}
