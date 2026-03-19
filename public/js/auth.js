document.addEventListener('DOMContentLoaded', async () => {
  const navLogin = document.querySelector('#nav-login');
  const navLogout = document.querySelector('#nav-logout');
  const navLoginMenu = document.querySelector('#nav-login-menu');
  const navLogoutMenu = document.querySelector('#nav-logout-menu');
  const notificationsRoot = document.querySelector('[data-notifications-root]');
  const welcomeMessage = document.querySelector('#welcome-message');
  const siteHeader = document.querySelector('.site-header');
  const headerRow = document.querySelector('header.navbar-header');
  const brandLink = document.querySelector('a.brand');
  const mainMenu = document.querySelector('nav#main-menu.main-menu');
  const mainMenuList = mainMenu?.querySelector('ul');
  const navbarRight = document.querySelector('.navbar-right');
  const prefix = welcomeMessage?.dataset.welcomePrefix ?? 'Welcome, ';
  const fallbackUser = welcomeMessage?.dataset.welcomeFallback ?? 'you';
  const suffix = welcomeMessage?.dataset.welcomeSuffix ?? '!';
  let headerLayoutFrame = null;

  const uiBaseRaw = document.body?.dataset.uiBase || '';
  const uiBase = uiBaseRaw.endsWith('/') ? uiBaseRaw.slice(0, -1) : uiBaseRaw;
  const ui = (path) => (path.startsWith('/') ? `${uiBase}${path}` : `${uiBase}/${path}`);

  const measureInlineHeaderFit = () => {
    if (!siteHeader || !headerRow || !brandLink || !navbarRight || !mainMenu || !mainMenuList) return;

    if (window.innerWidth < 980) {
      return false;
    }

    const wasInline = siteHeader.classList.contains('site-header--nav-inline');
    siteHeader.classList.add('site-header--nav-inline');

    const headerWidth = Math.ceil(headerRow.getBoundingClientRect().width);
    const brandWidth = Math.ceil(brandLink.getBoundingClientRect().width);
    const utilitiesWidth = Math.ceil(navbarRight.getBoundingClientRect().width);
    const navWidth = Math.ceil(mainMenuList.scrollWidth);
    const headerStyles = window.getComputedStyle(headerRow);
    const navStyles = window.getComputedStyle(mainMenu);
    const columnGap = parseFloat(headerStyles.columnGap || headerStyles.gap || '0') || 0;
    const navPaddingLeft = parseFloat(navStyles.paddingLeft || '0') || 0;
    const inlineWidthNeeded = brandWidth + navWidth + utilitiesWidth + (columnGap * 2) + navPaddingLeft;
    const fitsInline = inlineWidthNeeded <= headerWidth + 1;

    if (!wasInline) {
      siteHeader.classList.remove('site-header--nav-inline');
    }

    return fitsInline;
  };

  const updateHeaderLayout = () => {
    if (!siteHeader) return;

    if (window.innerWidth < 980) {
      siteHeader.classList.remove('site-header--nav-inline');
      return;
    }

    siteHeader.classList.toggle('site-header--nav-inline', measureInlineHeaderFit());
  };

  const scheduleHeaderLayoutUpdate = () => {
    if (headerLayoutFrame !== null) {
      window.cancelAnimationFrame(headerLayoutFrame);
    }

    headerLayoutFrame = window.requestAnimationFrame(() => {
      headerLayoutFrame = null;
      updateHeaderLayout();
    });
  };

  window.addEventListener('resize', scheduleHeaderLayoutUpdate);
  window.addEventListener('load', scheduleHeaderLayoutUpdate);
  window.visualViewport?.addEventListener('resize', scheduleHeaderLayoutUpdate);

  if (typeof ResizeObserver !== 'undefined') {
    const headerResizeObserver = new ResizeObserver(() => {
      scheduleHeaderLayoutUpdate();
    });

    [
      headerRow,
      brandLink,
      mainMenu,
      mainMenuList,
      navbarRight
    ].filter(Boolean).forEach((element) => headerResizeObserver.observe(element));
  }

  document.fonts?.ready
    ?.then(() => {
      scheduleHeaderLayoutUpdate();
    })
    .catch(() => {});

  const publishAuthState = (isLoggedIn, user = null) => {
    if (document.body?.dataset) {
      document.body.dataset.isLoggedIn = isLoggedIn ? 'true' : 'false';
      document.body.dataset.userId = isLoggedIn && user?.id ? String(user.id) : '';
    }

    window.dispatchEvent(new CustomEvent('auth:state-changed', {
      detail: { isLoggedIn, user }
    }));
  };

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
    if (notificationsRoot) {
      notificationsRoot.style.display = 'none';
      notificationsRoot.removeAttribute('open');
    }

    // dashboard menu item (li) is optional to toggle here too
    const dashLi = document.querySelector('li.nav-mobile-only#dashboard');
    if (dashLi) dashLi.style.display = 'none';

    if (welcomeMessage) welcomeMessage.style.display = 'none';
    scheduleHeaderLayoutUpdate();
    publishAuthState(false, null);
  };

  const setLoggedInUI = (user) => {
    if (navLogin) navLogin.style.display = 'none';

    if (navLogout) navLogout.style.display = 'block';
    if (navLogoutMenu) navLogoutMenu.style.display = 'block';
    if (notificationsRoot) notificationsRoot.style.display = 'inline-block';

    const dashLi = document.querySelector('li.nav-mobile-only#dashboard');
    if (dashLi) dashLi.style.display = 'list-item';

    if (welcomeMessage) {
      welcomeMessage.textContent = '';

      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'welcome-message__prefix';
      prefixSpan.textContent = prefix;

      const a = document.createElement('a');
      a.className = 'welcome-message__user';
      a.href = ui('/dashboard');
      a.style.color = 'rgb(26, 167, 214)';
      a.style.textDecoration = 'underline dotted';
      a.textContent = user.username ?? fallbackUser;

      const suffixSpan = document.createElement('span');
      suffixSpan.className = 'welcome-message__suffix';
      suffixSpan.textContent = suffix;

      welcomeMessage.appendChild(prefixSpan);
      welcomeMessage.appendChild(a);
      welcomeMessage.appendChild(suffixSpan);
      welcomeMessage.style.display = 'block';
    }

    scheduleHeaderLayoutUpdate();
    publishAuthState(true, user);
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
