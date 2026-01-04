document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('verification-status');
  if (!statusEl) return;

  const msgChecking = statusEl.dataset.checking || 'Checking token, please wait...';
  const msgMissingToken = statusEl.dataset.missingToken || 'Verification token missing or invalid.';
  const msgGenericFailure = statusEl.dataset.genericFailure || 'Verification failed.';
  const msgUnexpectedError = statusEl.dataset.unexpectedError || 'An unexpected error occurred.';
  const msgSuccess = statusEl.dataset.success || 'Your account has been verified successfully!';
  const msgInvalidOrExpired = statusEl.dataset.invalidOrExpired || 'Invalid or expired verification token.';

  const messageForCode = (code) => {
    switch (code) {
      case 'VERIFIED': return msgSuccess;
      case 'MISSING_TOKEN': return msgMissingToken;
      case 'INVALID_OR_EXPIRED_TOKEN': return msgInvalidOrExpired;
      case 'INTERNAL_ERROR': return msgUnexpectedError;
      default: return null;
    }
  };

  const showStatus = (message, ok) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? 'green' : 'red';
  };

  statusEl.textContent = msgChecking;

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showStatus(msgMissingToken, false);
    return;
  }

  try {
    const response = await fetch(`/api/v1/users/verify-email?token=${encodeURIComponent(token)}`);

    if (response.ok) {
      const data = await response.json();
      showStatus(messageForCode(data?.code) || msgSuccess, true);
      return;
    }

    let errorData = null;
    try {
      errorData = await response.json();
    } catch (_) { }

    const mapped = messageForCode(errorData?.code);
    showStatus(mapped || msgGenericFailure, false);
  } catch (error) {
    showStatus(msgUnexpectedError, false);
  }
});
