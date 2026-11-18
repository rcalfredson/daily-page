// Visit-local destinations. Providers resolve current positions rather than copying a route.
export function createForestNavigationState() {
  const groups = new Map();
  let active = null;
  const destinations = () => [...groups.values()].flatMap(provider => provider()).filter(p =>
    p && typeof p.id === 'string' && typeof p.label === 'string'
      && Number.isFinite(p.worldX) && Number.isFinite(p.worldY));
  return {
    register(group, provider) { groups.set(group, provider); },
    destinations,
    select(id) { if (!destinations().some(p => p.id === id)) return false; active = id; return true; },
    stop() { active = null; },
    snapshot(player) {
      const target = destinations().find(p => p.id === active);
      const removed = Boolean(active && !target);
      if (removed) active = null;
      if (!target) return { active: null, removed };
      const distance = Math.hypot(target.worldX - player.worldX, target.worldY - player.worldY);
      const bearing = Math.atan2(target.worldY - player.worldY, target.worldX - player.worldX);
      const direction = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'][(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
      return { active, target, distance, direction, degrees: bearing * 180 / Math.PI + 90,
        nearby: distance <= (target.nearbyRadius ?? 56), removed: false };
    }
  };
}

export function createForestNavigation({ dock, more, state, focus }) {
  const model = createForestNavigationState();
  const picker = document.createElement('details'); picker.className = 'forest-navigation-picker';
  picker.innerHTML = '<summary>Navigate</summary><label for="forest-navigation-destination">Destination</label><select id="forest-navigation-destination" data-forest-navigation-destination><option value="">Choose a destination</option></select><button type="button" data-forest-navigation-go disabled>Guide me</button><p data-forest-navigation-notice role="status" aria-live="polite"></p>';
  more.prepend(picker);
  const compass = document.createElement('section'); compass.className = 'owner-forest__navigation';
  compass.dataset.forestNavigation = ''; compass.hidden = true; compass.setAttribute('aria-label', 'Navigation');
  compass.innerHTML = '<span class="owner-forest__navigation-arrow" data-forest-navigation-arrow role="img" aria-label="Direction">↑</span><p data-forest-navigation-copy></p><button type="button" data-forest-navigation-stop>Stop</button>';
  dock.prepend(compass);
  const announcer = document.createElement('span'); announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status'); dock.append(announcer);
  const select = picker.querySelector('select'), go = picker.querySelector('button');
  const notice = picker.querySelector('[data-forest-navigation-notice]');
  const copy = compass.querySelector('p'), arrow = compass.querySelector('span');
  let signature = '', lastUpdate = -Infinity;
  function update(time = 0, force = false) {
    if (!force && time - lastUpdate < 150) return;
    lastUpdate = time;
    const destinations = model.destinations(), nextSignature = JSON.stringify(destinations.map(p => [p.id, p.label]));
    if (signature !== nextSignature) {
      const chosen = select.value; signature = nextSignature;
      select.replaceChildren(new window.Option('Choose a destination', ''));
      for (const target of destinations) select.add(new window.Option(target.label, target.id));
      select.value = destinations.some(p => p.id === chosen) ? chosen : '';
    }
    go.disabled = !select.value;
    const { player, available } = state(), current = model.snapshot(player);
    if (current.removed) {
      notice.textContent = 'That destination is no longer available. Choose another place.';
      announcer.textContent = notice.textContent;
    }
    compass.hidden = !current.active || !available;
    if (current.active) {
      const text = `${current.target.label} · ${current.nearby ? 'Nearby' : `${Math.round(current.distance)} steps`}`;
      if (copy.textContent !== text) copy.textContent = text;
      arrow.setAttribute('aria-label', `Direction: ${current.direction}`);
      arrow.style.transform = `rotate(${current.degrees}deg)`;
    }
  }
  function navigate(id) {
    if (!model.select(id)) return false;
    select.value = id; notice.textContent = ''; announcer.textContent = `Guiding to ${model.destinations().find(p => p.id === id).label}.`; picker.open = false; update(0, true); return true;
  }
  select.addEventListener('change', () => { go.disabled = !select.value; });
  go.addEventListener('click', () => { if (navigate(select.value)) focus(); });
  compass.querySelector('button').addEventListener('click', () => { model.stop(); announcer.textContent = 'Navigation stopped.'; update(0, true); focus(); });
  return { register: model.register, navigate, update };
}
