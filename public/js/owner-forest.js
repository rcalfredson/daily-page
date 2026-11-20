import { startOwnerForest } from './owner-forest-runtime.js';
import { createHomesteadClient } from './forest-homestead-client.js';

const start = document.querySelector('[data-homestead-start]');
if (!start) startOwnerForest();
else {
  const copy = start.querySelector('[data-homestead-start-copy]');
  const action = start.querySelector('[data-homestead-start-action]');
  const later = start.querySelector('[data-homestead-start-later]');
  function install(api, record, createExtension, justEstablished = false) {
    const { layout } = record;
    const plan = { ...layout, destination: layout.route.at(-1), spawn: layout.parking };
    start.hidden = true;
    return createExtension(api, { saved: record, plan, extent: 999_980_000 }, { integrated: true, justEstablished });
  }
  function offerClearing(record, createExtension) {
    let site = null, api, finding = false, dismissed = false;
    let notice = '';
    const client = createHomesteadClient({ initial: record });
    const resume = document.createElement('button');
    resume.type = 'button';
    resume.textContent = 'Home clearing';
    resume.hidden = true;
    document.querySelector('[data-owner-forest-more-panel]').append(resume);
    const nearby = () => {
      if (!site) return false;
      const { player } = api.state();
      return Math.hypot(player.worldX - site.x, player.worldY - site.y) <= 85;
    };
    function update() {
      const state = client.snapshot();
      const { busy } = api.state();
      start.hidden = busy || dismissed;
      later.hidden = Boolean(state.pending) || ['reload', 'stale'].includes(state.status);
      later.disabled = state.busy || finding;
      const atSite = nearby();
      const label = state.status === 'reload' ? 'Reload forest' : state.pending ? 'Retry save'
        : state.status === 'stale' ? 'Retry loading' : atSite ? 'Make my clearing'
          : site ? 'Guide me to the clearing' : 'Find a home clearing';
      const message = state.pending || ['reload', 'stale'].includes(state.status) ? state.message
        : finding ? 'Looking for a clearing…' : notice || (atSite ? 'Make this spot your home clearing?'
          : site ? 'Walk to the suggested clearing to take a look.' : 'You can make a home clearing whenever you’re ready.');
      if (action.textContent !== label) action.textContent = label;
      if (copy.textContent !== message) copy.textContent = message;
      action.disabled = state.busy || finding || busy;
    }
    const forest = startOwnerForest({ unifiedNavigation: true, createExtension(extensionApi) {
      api = extensionApi;
      api.navigation.register('suggested-clearing', () => site
        ? [{ id: 'home', label: 'Suggested clearing', worldX: site.x, worldY: site.y, nearbyRadius: 85 }]
        : []);
      return {
        update,
        paintGround(ctx, camera) {
          if (!site || !api.regionLoaded({ worldX: site.x, worldY: site.y })) return;
          ctx.save();
          ctx.strokeStyle = '#f4daa0';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 6]);
          ctx.beginPath();
          ctx.ellipse(site.x - camera.x, site.y - camera.y, 36, 18, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      };
    } });
    action.hidden = false;
    update();
    later.onclick = () => { dismissed = true; resume.hidden = false; update(); api.focus(); };
    resume.onclick = () => {
      dismissed = false; resume.hidden = true;
      document.querySelector('[data-owner-forest-more]').click();
      update(); action.focus({ preventScroll: true });
    };
    action.onclick = async () => {
      const state = client.snapshot();
      if (state.status === 'reload') { window.location.reload(); return; }
      if (state.pending || state.status === 'stale' || nearby()) {
        const done = state.pending ? client.retry() : state.status === 'stale'
          ? client.refresh() : client.save('establish', { site });
        update();
        await done;
        const current = client.snapshot();
        if (current.status === 'reload') { update(); return; }
        if (current.record.established) {
          site = null;
          resume.remove();
          forest.installExtension(extensionApi => install(extensionApi, current.record, createExtension, true));
          api.focus();
          return;
        }
        if (!current.pending) {
          site = null;
          notice = 'Find the suggested clearing again.';
          api.requestRender();
        }
      } else if (site) {
        api.navigation.navigate('home'); api.focus();
      } else {
        finding = true; notice = ''; update();
        try {
          const response = await fetch('/api/v1/forest/homestead?site=1', { credentials: 'same-origin', cache: 'no-store' });
          const result = await response.json();
          if (result.code === 'HOME_ALREADY_ESTABLISHED' || result.code === 'HOME_TERRAIN_CHANGED'
            || response.ok && (result.forestId !== record.forestId || result.terrainToken !== record.terrainToken)) {
            window.location.reload(); return;
          }
          if (!response.ok) {
            notice = result.code === 'HOME_SITE_UNAVAILABLE' ? 'No suitable clearing is available right now.' : 'Could not look for a clearing. Try again.';
          } else {
            site = result.site; api.navigation.navigate('home'); api.focus(); api.requestRender();
          }
        } catch { notice = 'Could not look for a clearing. Try again.'; }
        finally { finding = false; }
      }
      update();
    };
  }
  async function open() {
    action.disabled = true;
    try {
      const response = await fetch('/api/v1/forest/homestead', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Home unavailable');
      const record = await response.json();
      const { createHomesteadExtension } = await import('./forest-homestead-extension.js');
      if (record.established) {
        startOwnerForest({ unifiedNavigation: true, createExtension: api => install(api, record, createHomesteadExtension) });
      } else offerClearing(record, createHomesteadExtension);
    } catch {
      // Do not let an unread saved house/cart disappear while walking through its footprint.
      copy.textContent = 'Your clearing could not be loaded. Try again to enter the forest.';
      action.hidden = false; action.disabled = false; action.textContent = 'Try again'; action.onclick = open;
    }
  }
  open();
}
