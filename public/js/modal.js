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
  confirmBtn && confirmBtn.addEventListener('click', confirmCallback);

  // click fuera del contenido cierra el modal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hide();
  });
};

window.setupModal = setupModal;

document.addEventListener('DOMContentLoaded', () => {
  // DELETE‑BLOCK modal
  const deleteModal = document.getElementById('delete-modal');
  const deleteBtn = document.getElementById('delete-block-btn');

  if (deleteModal && deleteBtn) {
    const blockId = deleteBtn.dataset.blockId;
    const toastSuccess = deleteModal.dataset.toastSuccess || 'Block deleted successfully!';
    const toastFailed = deleteModal.dataset.toastFailed || 'Failed to delete block.';
    const redirectUrl = deleteModal.dataset.redirectUrl || '/';

    if (blockId) {
      setupModal('delete-modal', 'delete-block-btn', async () => {
        const res = await fetch(`/api/v1/blocks/${blockId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(toastSuccess, 'success');
          setTimeout(() => window.location.href = redirectUrl, 1000);
        } else {
          showToast(toastFailed, 'error');
        }
      });
    }
  }

  // LOGIN modal: solo configuro el cierre
  setupModal('login-modal');
});
