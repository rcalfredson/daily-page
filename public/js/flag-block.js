document.addEventListener('DOMContentLoaded', () => {
  // Re‑use your modal setup helper
  setupModal('flag-modal', 'flag-block-btn', async () => {
    const blockId = window.location.pathname.split('/').filter(Boolean).slice(-1)[0];
    const reason = document.getElementById('flag-reason').value;
    const description = document.getElementById('flag-description').value;

    // TODO: wire up to real endpoint
    try {
      const res = await fetch(`/api/v1/blocks/${blockId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description })
      });
      showToast('Report submitted—thank you!', 'success');

      const modal = document.getElementById('flag-modal');
      modal.classList.add('hidden');

      document.getElementById('flag-form').reset();
    } catch (err) {
      console.error('Flag submission failed', err);
      showToast('Failed to submit report.', 'error');
    }
  });

  // Make sure setupModal is in global scope (from your modal.js)
});
