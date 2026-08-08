const copyNode = document.getElementById('forest-inclusion-copy');
const status = document.querySelector('[data-forest-inclusion-status]');

if (copyNode && status) {
  const copy = JSON.parse(copyNode.textContent);
  document.querySelectorAll('[data-forest-inclusion]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      const hidden = button.dataset.hidden === 'true';
      button.disabled = true;
      status.hidden = false;
      status.textContent = copy.saving;
      try {
        const response = await window.fetch(
          `/api/v1/forest/trees/${encodeURIComponent(button.dataset.treeId)}/inclusion`,
          {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hidden: !hidden,
              expectedRevision: Number(button.dataset.treeRevision)
            })
          }
        );
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw Object.assign(new Error('inclusion failed'), { code: error.code });
        }
        status.textContent = hidden ? copy.unhidden : copy.hidden;
        button.closest('.forest-writing__tree')?.remove();
        if (!document.querySelector('[data-forest-inclusion]')) window.location.reload();
      } catch (error) {
        status.textContent = error.code === 'FOREST_TREE_INCLUSION_CONFLICT'
          ? copy.conflict : copy.unavailable;
        button.disabled = false;
      }
    });
  });
}
