(function () {
  const messages = {
    info: 'Your changes are being prepared.',
    success: 'Your changes were saved successfully.',
    error: 'Something went wrong while saving your changes.',
    long: 'This is a deliberately long toast message for checking wrapping, responsive sizing, and how the shared component behaves when its content needs more than one line.',
  };

  document.querySelectorAll('[data-toast-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.toastType;

      if (type === 'stack') {
        window.showToast(messages.info);
        window.showToast(messages.success, 'success');
        window.showToast(messages.error, 'error');
        return;
      }

      window.showToast(messages[type], type === 'long' ? 'info' : type);
    });
  });
})();
