import { startOwnerForest } from './owner-forest-runtime.js';
import { createHomesteadClient } from './forest-homestead-client.js';

const start = document.querySelector('[data-homestead-start]');
if (!start) startOwnerForest();
else {
  const copy = start.querySelector('[data-homestead-start-copy]');
  const action = start.querySelector('[data-homestead-start-action]');
  let client = null;
  async function open() {
    action.disabled = true;
    try {
      const response = await fetch('/api/v1/forest/homestead', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Home unavailable');
      const record = await response.json();
      client = createHomesteadClient({ initial: record, onChange: state => {
        copy.textContent = state.message; action.disabled = state.busy;
      } });
      if (record.established) {
        const { createHomesteadExtension } = await import('./forest-homestead-extension.js');
        const { layout } = record;
        const plan = { ...layout, destination: layout.route.at(-1),
          spawn: { x: layout.parking.x, y: layout.parking.y } };
        start.hidden = true;
        startOwnerForest({ createExtension: api => createHomesteadExtension(api,
          { saved: record, plan, extent: 999_980_000 }, { integrated: true }) });
      } else {
        // Establishing is an explicit choice. Ordinary entrance and writing returns stay intact.
        startOwnerForest();
        copy.textContent = 'Make a home clearing in your forest?';
        action.textContent = client.snapshot().pending ? 'Retry save' : 'Make my clearing';
        action.hidden = false; action.disabled = false;
        action.onclick = async () => {
          if (client.snapshot().pending) await client.retry();
          else await client.save('establish');
          if (client.snapshot().record.established) location.reload();
          else { action.disabled = false; action.textContent = client.snapshot().pending ? 'Retry save' : 'Try again'; }
        };
      }
    } catch {
      // Do not let an unread saved house/cart disappear while walking through its footprint.
      copy.textContent = 'Your clearing could not be loaded. Try again to enter the forest.';
      action.hidden = false; action.disabled = false; action.textContent = 'Try again'; action.onclick = open;
    }
  }
  open();
}
