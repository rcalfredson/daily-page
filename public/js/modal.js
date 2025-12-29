const setupModal = (modalId, openBtnId, confirmCallback) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const openBtn = openBtnId && document.getElementById(openBtnId);
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.cancel');
  const confirmBtn = confirmCallback && modal.querySelector('.confirm');

  const hide = () => modal.classList.add('hidden');
  const show = () => modal.classList.remove('hidden');

  openBtn?.addEventListener('click', show);
  closeBtn?.addEventListener('click', hide);
  cancelBtn?.addEventListener('click', hide);

  if (confirmBtn && confirmCallback) {
    confirmBtn.addEventListener('click', async () => {
      // Guard against double submit
      confirmBtn.disabled = true;
      confirmBtn.setAttribute('aria-busy', 'true');
      try {
        await confirmCallback();
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-busy');
      }
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) hide();
  });

  return { show, hide };
};

window.setupModal = setupModal;

document.addEventListener('DOMContentLoaded', () => {
  const deleteModal = document.getElementById('delete-modal');
  const deleteBtn = document.getElementById('delete-block-btn');

  if (deleteModal && deleteBtn) {
    const blockId = deleteBtn.dataset.blockId;
    const toastSuccess = deleteModal.dataset.toastSuccess || 'Block deleted successfully!';
    const toastFailed = deleteModal.dataset.toastFailed || 'Failed to delete block.';
    const redirectUrl = deleteModal.dataset.redirectUrl || '/';

    if (blockId) {
      setupModal('delete-modal', 'delete-block-btn', async () => {
        try {
          const res = await fetch(`/api/v1/blocks/${blockId}`, { method: 'DELETE' });
          if (res.ok) {
            window.showToast?.(toastSuccess, 'success');
            setTimeout(() => (window.location.href = redirectUrl), 1000);
          } else {
            window.showToast?.(toastFailed, 'error');
          }
        } catch (err) {
          console.error('Delete failed', err);
          window.showToast?.(toastFailed, 'error');
        } finally {
          deleteModal.classList.add('hidden');
        }
      });
    }
  }

  setupModal('login-modal');
});
