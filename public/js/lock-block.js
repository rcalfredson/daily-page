// public/js/lock-block.js
document.addEventListener('DOMContentLoaded', () => {
  const lockBlockBtn = document.getElementById('lock-block-btn');
  const lockModal = document.getElementById('lock-modal');
  const lockConfirmBtn = document.getElementById('lock-confirm-btn');
  const lockCancelBtn = document.getElementById('lock-cancel-btn');

  const t =
    typeof window.i18nT === 'function'
      ? window.i18nT
      : (key) => key;

  function toast(kind, key, fallback) {
    const msg = t(key);
    const finalMsg = (msg && msg !== key) ? msg : (fallback || key);
    if (typeof window.showToast === 'function') window.showToast(finalMsg, kind);
    else alert(finalMsg);
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
    lockConfirmBtn.addEventListener('click', async () => {
      lockModal.classList.add('hidden');

      if (typeof block_id === 'undefined') {
        console.warn('block_id not defined; lock will fail.');
        toast('error', 'blockEditor.lockModal.errorToast', 'Error locking block.');
        return;
      }

      try {
        const res = await fetch(`/api/v1/blocks/${block_id}/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'locked' })
        });

        if (res.ok) {
          toast('success', 'blockEditor.lockModal.successToast', 'Block locked successfully.');

          if (typeof room_id !== 'undefined') {
            setTimeout(() => {
              window.location.href = `/rooms/${room_id}/blocks/${block_id}`;
            }, 1500);
          }
        } else {
          toast('error', 'blockEditor.lockModal.errorToast', 'Error locking block.');
        }
      } catch (err) {
        console.error('Error locking block:', err);
        toast('error', 'blockEditor.lockModal.errorToast', 'Error locking block.');
      }
    });
  }
});
