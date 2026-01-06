document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const tokenInput = document.getElementById('token');
  const feedback = document.querySelector('.form-feedback');
  const form = document.getElementById('resetPasswordForm');
  const newPasswordEl = document.getElementById('newPassword');

  if (!tokenInput || !feedback || !form || !newPasswordEl) return;

  const msgMissingToken = feedback.dataset.missingToken || 'Missing or invalid token.';
  const msgMissingFields = feedback.dataset.missingFields || 'Token and new password are required.';
  const msgInvalidOrExpired = feedback.dataset.invalidOrExpired || 'Invalid or expired token.';
  const msgSuccess = feedback.dataset.success || 'Password updated successfully!';
  const msgGenericError = feedback.dataset.genericError || 'Something went wrong. Please try again.';
  const msgUnexpectedError = feedback.dataset.unexpectedError || 'An unexpected error occurred. Please try again.';

  const messageForCode = (code) => {
    switch (code) {
      case 'MISSING_TOKEN': return msgMissingToken;
      case 'MISSING_FIELDS': return msgMissingFields;
      case 'INVALID_OR_EXPIRED_TOKEN': return msgInvalidOrExpired;
      case 'RESET_OK': return msgSuccess;
      case 'INTERNAL_ERROR': return msgGenericError;
      default: return null;
    }
  };

  const show = (message, ok) => {
    feedback.style.display = 'block';
    feedback.textContent = message;
    feedback.style.color = ok ? 'green' : 'red';
  };

  if (token) {
    tokenInput.value = token;
  } else {
    show(msgMissingToken, false);
    form.style.display = 'none';
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = newPasswordEl.value;

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      let data = null;
      try { data = await res.json(); } catch (_) {}

      if (res.ok) {
        show(messageForCode(data?.code) || msgSuccess, true);
        form.style.display = 'none';
        return;
      }

      const mapped = messageForCode(data?.code);
      show(mapped || msgGenericError, false);
    } catch (err) {
      show(msgUnexpectedError, false);
    }
  });
});
