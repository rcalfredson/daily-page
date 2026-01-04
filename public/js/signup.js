document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');
  const feedback = document.querySelector('.form-feedback');

  if (!form || !feedback) return;

  const msgSuccess = feedback.dataset.success || 'Account created successfully! Please check your email to verify your account.';
  const msgGenericError = feedback.dataset.genericError || 'Failed to create account. Please try again.';
  const msgUnexpectedError = feedback.dataset.unexpectedError || 'An unexpected error occurred. Please try again.';

  const showFeedback = (message, ok) => {
    feedback.textContent = message;
    feedback.style.display = 'block';
    feedback.style.color = ok ? 'green' : 'red';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        showFeedback(msgSuccess, true);
        form.reset();
        return;
      }

      let errorData = null;
      try {
        errorData = await response.json();
      } catch (_) {}

      showFeedback(errorData?.error || msgGenericError, false);
    } catch (error) {
      showFeedback(msgUnexpectedError, false);
    }
  });
});
