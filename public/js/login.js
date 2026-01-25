document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const feedback = document.querySelector('.form-feedback');

  const msgSuccess = feedback?.dataset.success ?? 'Login successful! Redirecting...';
  const msgFailedGeneric = feedback?.dataset.failedGeneric ?? 'Login failed. Please try again.';
  const msgUnexpected = feedback?.dataset.unexpected ?? 'An unexpected error occurred. Please try again.';

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
        // Success: Redirect or show success message
        feedback.textContent = msgSuccess;
        feedback.style.color = 'green';
        feedback.style.display = 'block';

        const redirectTo = form?.dataset.redirect || '/dashboard';
        setTimeout(() => (window.location.href = redirectTo), 2000); // Redirect to dashboard
      } else {
        // Failure: Show error
        feedback.textContent = result.error || msgFailedGeneric;
        feedback.style.color = 'red';
        feedback.style.display = 'block';
      }
    } catch (error) {
      // Unexpected error
      feedback.textContent = msgUnexpected;
      feedback.style.color = 'red';
      feedback.style.display = 'block';
    }
  });
});
