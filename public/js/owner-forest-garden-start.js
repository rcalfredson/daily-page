const button = document.querySelector('[data-garden-establish]');
const status = document.querySelector('[data-garden-establish-status]');
button?.addEventListener('click', async () => {
  button.disabled = true; status.textContent = 'Opening your forest…';
  try {
    const response = await fetch('/api/v1/forest/garden', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'establish', expectedRevision: 0, terrainToken: null }) });
    if (!response.ok) throw new Error('unavailable');
    location.reload();
  } catch {
    status.textContent = 'The result could not be confirmed. Reload to see your forest before trying again.';
    button.disabled = false;
  }
});
