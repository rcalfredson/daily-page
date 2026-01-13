document.addEventListener('DOMContentLoaded', async () => {
  const navLogin = document.querySelector('#nav-login');
  const navLogout = document.querySelector('#nav-logout');
  const welcomeMessage = document.querySelector('#welcome-message');
  const prefix = welcomeMessage?.dataset.welcomePrefix ?? 'Welcome, ';
  const fallbackUser = welcomeMessage?.dataset.welcomeFallback ?? 'you';
  const suffix = welcomeMessage?.dataset.welcomeSuffix ?? '!';

  const setLoggedOutUI = () => {
    if (navLogin) navLogin.style.display = 'block';
    if (navLogout) navLogout.style.display = 'none';
    if (welcomeMessage) welcomeMessage.style.display = 'none';
  };

  const setLoggedInUI = (user) => {
    if (navLogin) navLogin.style.display = 'none';
    if (navLogout) navLogout.style.display = 'block';
    if (welcomeMessage) {
      welcomeMessage.textContent = prefix;
      const a = document.createElement('a');
      a.href = '/dashboard';
      a.style.color = 'rgb(26, 167, 214)';
      a.style.textDecoration = 'underline dotted';
      a.textContent = user.username ?? fallbackUser;
      welcomeMessage.appendChild(a);
      welcomeMessage.appendChild(document.createTextNode(suffix));
      welcomeMessage.style.display = 'block';
    }
  };

  try {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' });

    if (res.status === 401) {            // estado normal: no autenticado
      setLoggedOutUI();
      return;
    }

    if (!res.ok) {                       // errores reales (500, etc.)
      console.warn('auth/me non-OK:', res.status);
      setLoggedOutUI();
      return;
    }

    const user = await res.json();
    setLoggedInUI(user);
  } catch (e) {
    console.warn('auth/me network error:', e);  // solo log “suave”
    setLoggedOutUI();
  }

  navLogout?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
      // idealmente el server también borra la cookie HttpOnly
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
});
