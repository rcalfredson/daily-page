const copyNode = document.getElementById('forest-marker-removal-copy');
const status = document.querySelector('[data-forest-marker-removal-status]');
if (copyNode && status) {
  const copy = JSON.parse(copyNode.textContent);
  document.querySelectorAll('[data-forest-marker-removal]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled || !window.confirm(copy.confirm)) return;
      button.disabled = true;
      status.hidden = false;
      status.textContent = copy.removing;
      try {
        const response = await window.fetch(`/api/v1/forest/authored-objects/${encodeURIComponent(button.dataset.objectId)}/removal`, {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ protocolVersion: 2, expectedRevision: Number(button.dataset.recordRevision) })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw Object.assign(new Error('removal failed'), { code: body.code });
        }
        const row = button.closest('.forest-writing__tree');
        const focusTarget = row.nextElementSibling?.querySelector('a')
          || row.previousElementSibling?.querySelector('a') || document.querySelector('.forest-writing__enter');
        row.remove();
        status.textContent = copy.removed;
        focusTarget?.focus();
      } catch (error) {
        status.textContent = error.code === 'FOREST_AUTHORED_OBJECT_CONFLICT' ? copy.conflict : copy.error;
        button.disabled = false;
      }
    });
  });
}
