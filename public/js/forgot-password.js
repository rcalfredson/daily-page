document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotPasswordForm');
  const feedback = document.querySelector('.form-feedback');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;

    try {
      const res = await fetch('/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      feedback.style.display = 'block';
      feedback.textContent = data.message || 'If that email exists, a reset link has been sent.';
      feedback.style.color = res.ok ? 'green' : 'red';
    } catch (err) {
      feedback.style.display = 'block';
      feedback.textContent = 'An unexpected error occurred. Please try again.';
      feedback.style.color = 'red';
    }
  });
});
