document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('verification-status');

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    statusEl.textContent = 'Verification token missing or invalid.';
    statusEl.style.color = 'red';
    return;
  }

  try {
    const response = await fetch(`/api/v1/users/verify-email?token=${token}`);

    if (response.ok) {
      const data = await response.json();
      statusEl.textContent = data.message;
      statusEl.style.color = 'green';
    } else {
      const errorData = await response.json();
      statusEl.textContent = errorData.error || 'Verification failed.';
      statusEl.style.color = 'red';
    }
  } catch (error) {
    statusEl.textContent = 'An unexpected error occurred.';
    statusEl.style.color = 'red';
  }
});
