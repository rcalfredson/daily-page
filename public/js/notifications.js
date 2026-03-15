(function () {
  function uiPath(path) {
    const uiBaseRaw = document.body?.dataset.uiBase || '';
    const uiBase = uiBaseRaw.endsWith('/') ? uiBaseRaw.slice(0, -1) : uiBaseRaw;
    return path.startsWith('/') ? `${uiBase}${path}` : `${uiBase}/${path}`;
  }

  function text(key, fallback, params) {
    const translated = window.i18nT?.(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('[data-notifications-root]');
    if (!root) return;

    const badge = root.querySelector('[data-notifications-badge]');
    const panel = root.querySelector('.notifications-panel');
    const status = root.querySelector('[data-notifications-status]');
    const list = root.querySelector('[data-notifications-list]');

    const locale = document.documentElement.lang || 'en';
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    let isLoggedIn = document.body?.dataset?.isLoggedIn === 'true';
    let hasLoadedList = false;
    let unreadCount = 0;

    function setStatus(message) {
      if (!status) return;
      if (!message) {
        status.textContent = '';
        status.classList.add('hidden');
        return;
      }
      status.textContent = message;
      status.classList.remove('hidden');
    }

    function setBadge(count) {
      unreadCount = Math.max(0, Number(count) || 0);
      root.dataset.unreadCount = String(unreadCount);
      if (!badge) return;

      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.classList.remove('hidden');
      } else {
        badge.textContent = '0';
        badge.classList.add('hidden');
      }
    }

    function setReadState(item, readAt) {
      if (!item) return;

      item.dataset.readAt = readAt || new Date().toISOString();
      item.classList.remove('notifications-item--unread');
      item.classList.add('notifications-item--read');

      const markReadButton = item.querySelector('[data-mark-read]');
      if (markReadButton) {
        markReadButton.remove();
      }
    }

    function positionPanel() {
      if (!panel) return;

      panel.style.removeProperty('transform');
      panel.style.removeProperty('top');

      // On tablet/mobile-ish layouts the panel becomes a fixed sheet with viewport gutters.
      if (window.innerWidth <= 979) {
        const rootRect = root.getBoundingClientRect();
        const top = Math.max(12, Math.round(rootRect.bottom + 10));
        panel.style.top = `${top}px`;
        return;
      }

      const margin = 12;
      const rect = panel.getBoundingClientRect();
      let shift = 0;

      if (rect.left < margin) {
        shift = margin - rect.left;
      } else if (rect.right > window.innerWidth - margin) {
        shift = (window.innerWidth - margin) - rect.right;
      }

      if (shift !== 0) {
        panel.style.transform = `translateX(${Math.round(shift)}px)`;
      }
    }

    function renderNotifications(notifications) {
      if (!list) return;

      list.innerHTML = '';
      list.classList.remove('hidden');

      if (!Array.isArray(notifications) || notifications.length === 0) {
        list.classList.add('hidden');
        setStatus(text('notifications.inSite.empty', 'No notifications yet.'));
        return;
      }

      setStatus('');

      notifications.forEach((notification) => {
        const item = document.createElement('li');
        item.className = `notifications-item ${notification.readAt ? 'notifications-item--read' : 'notifications-item--unread'}`;
        item.dataset.notificationId = notification._id;
        if (notification.readAt) item.dataset.readAt = notification.readAt;

        const body = document.createElement(notification.path ? 'a' : 'div');
        body.className = 'notifications-item__body';
        if (notification.path) {
          body.href = uiPath(notification.path);
        }

        const message = document.createElement('span');
        message.className = 'notifications-item__message';
        message.textContent = notification.message || text('notifications.inSite.item.unknown', 'Notification');

        const meta = document.createElement('time');
        meta.className = 'notifications-item__time';
        if (notification.createdAt) {
          const createdAt = new Date(notification.createdAt);
          meta.dateTime = createdAt.toISOString();
          meta.textContent = dateFormatter.format(createdAt);
        }

        body.appendChild(message);
        body.appendChild(meta);
        item.appendChild(body);

        if (!notification.readAt) {
          const markReadButton = document.createElement('button');
          markReadButton.type = 'button';
          markReadButton.className = 'notifications-item__mark-read';
          markReadButton.dataset.markRead = 'true';
          markReadButton.textContent = text('notifications.inSite.markRead', 'Mark read');
          item.appendChild(markReadButton);
        }

        list.appendChild(item);
      });
    }

    async function fetchUnreadCount() {
      const response = await fetch(uiPath('/api/v1/notifications/unread-count'), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Unread count failed: ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));
      setBadge(payload.unreadCount);
    }

    async function fetchNotifications() {
      const response = await fetch(uiPath('/api/v1/notifications?limit=8'), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Notifications failed: ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));
      renderNotifications(payload.notifications);
      hasLoadedList = true;
    }

    async function markRead(notificationId) {
      const response = await fetch(uiPath(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Mark read failed: ${response.status}`);
      }

      return response.json().catch(() => ({}));
    }

    async function refreshPanel() {
      if (!isLoggedIn) return;

      setStatus(text('notifications.inSite.loading', 'Loading notifications...'));

      try {
        await Promise.all([fetchUnreadCount(), fetchNotifications()]);
      } catch (error) {
        console.error('Failed to load notifications:', error);
        setStatus(text('notifications.inSite.error', 'Unable to load notifications right now.'));
      }
    }

    function handleAuthState(nextIsLoggedIn) {
      isLoggedIn = Boolean(nextIsLoggedIn);

      if (!isLoggedIn) {
        root.style.display = 'none';
        root.removeAttribute('open');
        hasLoadedList = false;
        setBadge(0);
        if (list) {
          list.innerHTML = '';
          list.classList.add('hidden');
        }
        setStatus('');
        return;
      }

      root.style.display = 'inline-block';
      fetchUnreadCount().catch((error) => {
        console.error('Failed to load unread notification count:', error);
      });
    }

    root.addEventListener('toggle', function () {
      if (!root.open || !isLoggedIn) return;
      positionPanel();
      if (!hasLoadedList) {
        refreshPanel();
        return;
      }

      Promise.all([fetchUnreadCount(), fetchNotifications()]).catch((error) => {
        console.error('Failed to refresh notifications:', error);
        setStatus(text('notifications.inSite.error', 'Unable to load notifications right now.'));
      });
    });

    root.addEventListener('click', async function (event) {
      const markReadButton = event.target.closest('[data-mark-read]');
      if (markReadButton && root.contains(markReadButton)) {
        event.preventDefault();
        const item = markReadButton.closest('.notifications-item');
        const notificationId = item?.dataset?.notificationId;
        if (!notificationId) return;

        markReadButton.disabled = true;

        try {
          const payload = await markRead(notificationId);
          setReadState(item, payload?.notification?.readAt);
          setBadge(unreadCount - 1);
        } catch (error) {
          console.error('Failed to mark notification read:', error);
          markReadButton.disabled = false;
        }

        return;
      }

      const link = event.target.closest('.notifications-item__body[href]');
      if (!link || !root.contains(link)) return;

      const item = link.closest('.notifications-item');
      const notificationId = item?.dataset?.notificationId;
      const alreadyRead = Boolean(item?.dataset?.readAt);
      if (!notificationId || alreadyRead) return;

      event.preventDefault();

      try {
        const payload = await markRead(notificationId);
        setReadState(item, payload?.notification?.readAt);
        setBadge(unreadCount - 1);
      } catch (error) {
        console.error('Failed to mark notification read before navigation:', error);
      }

      window.location.assign(link.href);
    });

    window.addEventListener('auth:state-changed', function (event) {
      handleAuthState(event.detail?.isLoggedIn);
    });

    window.addEventListener('resize', function () {
      if (root.open) {
        positionPanel();
      }
    });

    handleAuthState(isLoggedIn);
  });
})();
