document.addEventListener('DOMContentLoaded', () => {
  const lockBlockBtn = document.getElementById('lock-block-btn');
  const lockModal = document.getElementById('lock-modal');
  const lockConfirmBtn = document.getElementById('lock-confirm-btn');
  const lockCancelBtn = document.getElementById('lock-cancel-btn');

  // Local i18n helper
  function t(key, vars = {}) {
    try {
      if (!window.I18n || typeof window.I18n.t !== 'function') return key;
      return window.I18n.t(key, vars);
    } catch (e) {
      return key;
    }
  }

  if (lockBlockBtn && lockModal) {
    // Mostrar el modal al hacer clic en "Lock Block"
    lockBlockBtn.addEventListener('click', () => {
      lockModal.classList.remove('hidden');
    });
  }

  if (lockCancelBtn && lockModal) {
    // Cerrar el modal al hacer clic en "Cancel"
    lockCancelBtn.addEventListener('click', () => {
      lockModal.classList.add('hidden');
    });
  }

  if (lockConfirmBtn && lockModal) {
    // Confirmar el lock y llamar a la API
    lockConfirmBtn.addEventListener('click', () => {
      fetch(`/api/v1/blocks/${block_id}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'locked' })
      })
        .then(response => {
          lockModal.classList.add('hidden'); // Oculta el modal primero
          if (response.ok) {
            showToast(
              t('blockEditor.lockModal.successToast'),
              'success'
            );
            // Recarga o redirige
            setTimeout(() => {
              window.location.href = `/rooms/${room_id}/blocks/${block_id}`;
            }, 1500);
          } else {
            showToast(
              t('blockEditor.lockModal.errorToast'),
              'error'
            );
          }
        })
        .catch(err => {
          console.error('Error locking block:', err);
          lockModal.classList.add('hidden');
          showToast(
            t('blockEditor.lockModal.errorToast'),
            'error'
          );
        });
    });
  }
});
