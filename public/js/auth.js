document.addEventListener('DOMContentLoaded', async () => {
  const navLogin = document.querySelector('#nav-login');
  const navLogout = document.querySelector('#nav-logout');
  const navLoginMenu = document.querySelector('#nav-login-menu');
  const navLogoutMenu = document.querySelector('#nav-logout-menu');
  const welcomeMessage = document.querySelector('#welcome-message');
  const prefix = welcomeMessage?.dataset.welcomePrefix ?? 'Welcome, ';
  const fallbackUser = welcomeMessage?.dataset.welcomeFallback ?? 'you';
  const suffix = welcomeMessage?.dataset.welcomeSuffix ?? '!';

  const uiBaseRaw = document.body?.dataset.uiBase || '';
  const uiBase = uiBaseRaw.endsWith('/') ? uiBaseRaw.slice(0, -1) : uiBaseRaw;
  const ui = (path) => (path.startsWith('/') ? `${uiBase}${path}` : `${uiBase}/${path}`);

  const doLogout = async (e) => {
    e?.preventDefault?.();

    try {
      const res = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      // Optional: if you want to be strict
      // if (!res.ok) throw new Error(`logout failed: ${res.status}`);

      window.location.href = ui('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const setLoggedOutUI = () => {
    if (navLogin) navLogin.style.display = 'block';

    if (navLogout) navLogout.style.display = 'none';
    if (navLogoutMenu) navLogoutMenu.style.display = 'none';

    // dashboard menu item (li) is optional to toggle here too
    const dashLi = document.querySelector('li.nav-mobile-only#dashboard');
    if (dashLi) dashLi.style.display = 'none';

    if (welcomeMessage) welcomeMessage.style.display = 'none';
  };

  const setLoggedInUI = (user) => {
    if (navLogin) navLogin.style.display = 'none';

    if (navLogout) navLogout.style.display = 'block';
    if (navLogoutMenu) navLogoutMenu.style.display = 'block';

    const dashLi = document.querySelector('li.nav-mobile-only#dashboard');
    if (dashLi) dashLi.style.display = 'list-item';

    if (welcomeMessage) {
      welcomeMessage.textContent = prefix;
      const a = document.createElement('a');
      a.href = ui('/dashboard');
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

  navLogout?.addEventListener('click', doLogout);
  navLogoutMenu?.addEventListener('click', doLogout);
});
