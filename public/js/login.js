document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const feedback = document.querySelector('.form-feedback');
  const twoFactorField = document.querySelector('.two-factor-login-field');
  const twoFactorInput = document.getElementById('totpCode');

  const msgSuccess = feedback?.dataset.success ?? 'Login successful! Redirecting...';
  const msgTwoFactorRequired = feedback?.dataset.twoFactorRequired ?? 'Enter the 6-digit code from your authenticator app.';
  const msgTwoFactorFailed = feedback?.dataset.twoFactorFailed ?? 'That code did not work. Please try again.';
  const msgFailedGeneric = feedback?.dataset.failedGeneric ?? 'Login failed. Please try again.';
  const msgUnexpected = feedback?.dataset.unexpected ?? 'An unexpected error occurred. Please try again.';
  let waitingForTwoFactor = false;

  const show = (message, ok) => {
    feedback.textContent = message;
    feedback.style.color = ok ? 'green' : 'red';
    feedback.style.display = 'block';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent page reload

    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      // Send AJAX request
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok) {
        if (result.requiresTwoFactor) {
          waitingForTwoFactor = true;
          if (twoFactorField) twoFactorField.hidden = false;
          if (twoFactorInput) {
            twoFactorInput.required = true;
            twoFactorInput.focus();
          }

          show(twoFactorInput?.value ? msgTwoFactorFailed : msgTwoFactorRequired, false);
          return;
        }

        // Success: Redirect or show success message
        show(msgSuccess, true);

        const redirectTo = form?.dataset.redirect || '/dashboard';
        setTimeout(() => (window.location.href = redirectTo), 2000); // Redirect to dashboard
      } else {
        // Failure: Show error
        show(waitingForTwoFactor ? msgTwoFactorFailed : msgFailedGeneric, false);
      }
    } catch (error) {
      // Unexpected error
      show(msgUnexpected, false);
    }
  });
});
