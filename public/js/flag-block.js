document.addEventListener('DOMContentLoaded', () => {
  // Re‑use your modal setup helper
  setupModal('flag-modal', 'flag-block-btn', async () => {
    const modal = document.getElementById('flag-modal');
    const toastSuccess = modal?.dataset.toastSuccess || 'Report submitted—thank you!';
    const toastFailed = modal?.dataset.toastFailed || 'Failed to submit report.';

    const parts = window.location.pathname.split('/').filter(Boolean);
    const blocksIdx = parts.indexOf('blocks');
    const blockId = blocksIdx >= 0 ? parts[blocksIdx + 1] : null;
    if (!blockId) throw new Error('Missing block id');
    const reasonEl = document.getElementById('flag-reason');
    const descEl = document.getElementById('flag-description');
    const reason = reasonEl?.value || '';
    const description = descEl?.value || '';

    try {
      const res = await fetch(`/api/v1/blocks/${blockId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(toastSuccess, 'success');

      modal?.classList.add('hidden');

      document.getElementById('flag-form').reset();
    } catch (err) {
      console.error('Flag submission failed', err);
      showToast(toastFailed, 'error');
    }
  });

  // Make sure setupModal is in global scope (from your modal.js)
});
