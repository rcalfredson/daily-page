document.addEventListener('DOMContentLoaded', () => {
  // Re‑use your modal setup helper
  setupModal('flag-modal', 'flag-block-btn', async () => {
    const modal = document.getElementById('flag-modal');
    const toastSuccess = modal?.dataset.toastSuccess || 'Report submitted—thank you!';
    const toastFailed = modal?.dataset.toastFailed || 'Failed to submit report.';

    const blockId = window.location.pathname.split('/').filter(Boolean).slice(-1)[0];
    const reason = document.getElementById('flag-reason').value;
    const description = document.getElementById('flag-description').value;

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
