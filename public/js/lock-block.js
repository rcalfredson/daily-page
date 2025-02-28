document.addEventListener('DOMContentLoaded', () => {
  const lockBlockBtn = document.getElementById('lock-block-btn');
  const lockModal = document.getElementById('lock-modal');
  const lockConfirmBtn = document.getElementById('lock-confirm-btn');
  const lockCancelBtn = document.getElementById('lock-cancel-btn');

  if (lockBlockBtn && lockModal) {
    // Mostrar el modal al hacer clic en "Lock Block"
    lockBlockBtn.addEventListener('click', () => {
      lockModal.classList.remove('hidden');
    });
  }

  if (lockCancelBtn) {
    // Cerrar el modal al hacer clic en "Cancel"
    lockCancelBtn.addEventListener('click', () => {
      lockModal.classList.add('hidden');
    });
  }

  if (lockConfirmBtn) {
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
          showToast('Block locked successfully.', 'success');
          // Recarga o redirige
          setTimeout(() => {
            window.location.href = `/rooms/${room_id}/blocks/${block_id}`;
          }, 1500);
        } else {
          showToast('Error locking block.', 'error');
        }
      })
      .catch(err => {
        console.error('Error locking block:', err);
        lockModal.classList.add('hidden');
        showToast('Error locking block.', 'error');
      });
    });
  }
});
