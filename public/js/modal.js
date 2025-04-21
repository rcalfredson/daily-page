document.addEventListener('DOMContentLoaded', () => {
  const setupModal = (modalId, openBtnId, confirmCallback) => {
    const modal     = document.getElementById(modalId);
    if (!modal) return;
    const openBtn   = openBtnId && document.getElementById(openBtnId);
    const closeBtn  = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.cancel');
    const confirmBtn= confirmCallback && modal.querySelector('.confirm');
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

  // DELETE‑BLOCK modal
  const pathParts = window.location.pathname.split('/');
  const blockIdIndex = pathParts.indexOf('blocks') + 1;
  const blockId = pathParts[blockIdIndex];
  setupModal('delete-modal', 'delete-block-btn', async () => {
    const res = await fetch(`/api/v1/blocks/${blockId}`, { method: 'DELETE' });
    console.log('res?', res);
    if (res.ok) {
      console.log('showing toast');
      showToast('Block deleted successfully!', 'success');
      setTimeout(() => window.location.href = '/', 1000);
    } else {
      showToast('Failed to delete block.', 'error');
    }
  });

  // LOGIN modal: solo configuro el cierre
  setupModal('login-modal');
});
