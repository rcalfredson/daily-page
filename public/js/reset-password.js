document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const tokenInput = document.getElementById('token');
  const feedback = document.querySelector('.form-feedback');
  const form = document.getElementById('resetPasswordForm');

  if (token) {
    tokenInput.value = token;
  } else {
    feedback.textContent = 'Missing or invalid token.';
    feedback.style.color = 'red';
    feedback.style.display = 'block';
    form.style.display = 'none';
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await res.json();

      feedback.style.display = 'block';
      feedback.textContent = data.message || 'Something happened.';
      feedback.style.color = res.ok ? 'green' : 'red';

      if (res.ok) {
        form.style.display = 'none';
      }
    } catch (err) {
      feedback.textContent = 'Unexpected error occurred.';
      feedback.style.color = 'red';
      feedback.style.display = 'block';
    }
  });
});
  