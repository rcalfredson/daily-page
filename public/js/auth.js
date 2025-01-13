document.addEventListener('DOMContentLoaded', async () => {
  const navLogin = document.querySelector('#nav-login');
  const navLogout = document.querySelector('#nav-logout');
  const welcomeMessage = document.querySelector('#welcome-message');

  try {
    const response = await fetch('/api/v1/auth/me', { credentials: 'include' });

    if (response.ok) {
      const user = await response.json();

      // Update UI for logged-in state
      navLogin.style.display = 'none';
      navLogout.style.display = 'block';
      welcomeMessage.textContent = `Welcome, ${user.username}!`;
      welcomeMessage.style.display = 'block';
    } else {
      throw new Error('Not logged in');
    }
  } catch (err) {
    navLogin.style.display = 'block';
    navLogout.style.display = 'none';
    welcomeMessage.style.display = 'none';
  }

  if (navLogout) {
    navLogout.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/v1/auth/logout', { method: 'POST' });

        if (response.ok) {
          document.cookie = 'auth_token=; Max-Age=0; path=/;';
          window.location.href = '/';
        } else {
          console.error('Failed to log out:', await response.text());
        }
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }
});
