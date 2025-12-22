// public/js/lock-block.js
document.addEventListener('DOMContentLoaded', () => {
  const lockBlockBtn = document.getElementById('lock-block-btn');
  const lockModal = document.getElementById('lock-modal');
  const lockConfirmBtn = document.getElementById('lock-confirm-btn');
  const lockCancelBtn = document.getElementById('lock-cancel-btn');

  if (typeof window.i18nT !== 'function') {
    console.warn('i18nT not available in lock-block.js');
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

          // Success / error messages con i18n + fallback
          let successMsg = 'Block locked successfully.';
          let errorMsg = 'Error locking block.';

          if (typeof window.i18nT === 'function') {
            const maybeSuccess = i18nT('blockEditor.lockModal.successToast');
            const maybeError = i18nT('blockEditor.lockModal.errorToast');

            if (maybeSuccess && maybeSuccess !== 'blockEditor.lockModal.successToast') {
              successMsg = maybeSuccess;
            }
            if (maybeError && maybeError !== 'blockEditor.lockModal.errorToast') {
              errorMsg = maybeError;
            }
          }

          if (response.ok) {
            showToast(successMsg, 'success');
            // Recarga o redirige
            setTimeout(() => {
              window.location.href = `/rooms/${room_id}/blocks/${block_id}`;
            }, 1500);
          } else {
            showToast(errorMsg, 'error');
          }
        })
        .catch(err => {
          console.error('Error locking block:', err);
          lockModal.classList.add('hidden');

          let errorMsg = 'Error locking block.';
          if (typeof window.i18nT === 'function') {
            const maybeError = i18nT('blockEditor.lockModal.errorToast');
            if (maybeError && maybeError !== 'blockEditor.lockModal.errorToast') {
              errorMsg = maybeError;
            }
          }

          showToast(errorMsg, 'error');
        });
    });
  }
});
