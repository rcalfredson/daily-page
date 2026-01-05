document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotPasswordForm');
  const feedback = document.querySelector('.form-feedback');
  const emailEl = document.getElementById('email');

  if (!form || !feedback || !emailEl) return;

  const msgSuccess = feedback.dataset.success || 'If that email exists, a reset link has been sent.';
  const msgMissingEmail = feedback.dataset.missingEmail || 'Email is required.';
  const msgGenericError = feedback.dataset.genericError || 'Something went wrong. Please try again.';
  const msgUnexpectedError = feedback.dataset.unexpectedError || 'An unexpected error occurred. Please try again.';

  const messageForCode = (code) => {
    switch (code) {
      case 'MISSING_EMAIL': return msgMissingEmail;
      case 'SENT_IF_EXISTS': return msgSuccess;
      case 'INTERNAL_ERROR': return msgGenericError;
      default: return null;
    }
  };

  const showFeedback = (message, ok) => {
    feedback.style.display = 'block';
    feedback.textContent = message;
    feedback.style.color = ok ? 'green' : 'red';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailEl.value;

    try {
      const res = await fetch('/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      let data = null;
      try { data = await res.json(); } catch (_) {}

      // For privacy, even errors can safely map to the generic “sent if exists”
      // but we’ll still show real validation (missing email).
      const mapped = messageForCode(data?.code);

      if (res.ok) {
        showFeedback(mapped || msgSuccess, true);
        return;
      }

      // Non-OK: show mapped if known, otherwise generic
      showFeedback(mapped || msgGenericError, false);
    } catch (err) {
      showFeedback(msgUnexpectedError, false);
    }
  });
});
