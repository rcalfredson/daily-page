document.addEventListener('DOMContentLoaded', () => {
  const passwordForm = document.getElementById('changePasswordForm');
  const passwordFeedback = document.getElementById('passwordFeedback');
  const setupForm = document.getElementById('twoFactorSetupForm');
  const enableForm = document.getElementById('twoFactorEnableForm');
  const disableForm = document.getElementById('twoFactorDisableForm');
  const twoFactorFeedback = document.getElementById('twoFactorFeedback');
  const setupResult = document.querySelector('.two-factor-setup-result');
  const qrImage = document.querySelector('.two-factor-qr');
  const manualKey = document.querySelector('[data-manual-key]');

  const show = (element, message, ok) => {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle('is-success', ok);
    element.classList.toggle('is-error', !ok);
  };

  const messageFor = (feedback, code) => {
    const key = String(code || '')
      .toLowerCase()
      .replace(/_([a-z])/gu, (_, char) => char.toUpperCase());
    return feedback?.dataset[key] || feedback?.dataset.genericError || 'Something went wrong. Please try again.';
  };

  const postJson = async (url, payload) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { res, data };
  };

  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(passwordForm);

    try {
      const { res, data } = await postJson('/api/v1/auth/change-password', Object.fromEntries(formData.entries()));
      if (res.ok) {
        passwordForm.reset();
        show(passwordFeedback, passwordFeedback?.dataset.success, true);
        return;
      }
      show(passwordFeedback, messageFor(passwordFeedback, data?.code), false);
    } catch (error) {
      show(passwordFeedback, passwordFeedback?.dataset.unexpectedError, false);
    }
  });

  setupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(setupForm);

    try {
      const { res, data } = await postJson('/api/v1/auth/2fa/setup', Object.fromEntries(formData.entries()));
      if (res.ok) {
        if (qrImage) qrImage.src = data.qrDataUrl;
        if (manualKey) manualKey.textContent = data.manualKey;
        if (setupResult) setupResult.hidden = false;
        setupForm.reset();
        show(twoFactorFeedback, twoFactorFeedback?.dataset.setupReady, true);
        return;
      }
      show(twoFactorFeedback, messageFor(twoFactorFeedback, data?.code), false);
    } catch (error) {
      show(twoFactorFeedback, twoFactorFeedback?.dataset.unexpectedError, false);
    }
  });

  enableForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(enableForm);

    try {
      const { res, data } = await postJson('/api/v1/auth/2fa/enable', Object.fromEntries(formData.entries()));
      if (res.ok) {
        show(twoFactorFeedback, twoFactorFeedback?.dataset.enabled, true);
        setTimeout(() => window.location.reload(), 900);
        return;
      }
      show(twoFactorFeedback, messageFor(twoFactorFeedback, data?.code), false);
    } catch (error) {
      show(twoFactorFeedback, twoFactorFeedback?.dataset.unexpectedError, false);
    }
  });

  disableForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(disableForm);

    try {
      const { res, data } = await postJson('/api/v1/auth/2fa/disable', Object.fromEntries(formData.entries()));
      if (res.ok) {
        show(twoFactorFeedback, twoFactorFeedback?.dataset.disabled, true);
        setTimeout(() => window.location.reload(), 900);
        return;
      }
      show(twoFactorFeedback, messageFor(twoFactorFeedback, data?.code), false);
    } catch (error) {
      show(twoFactorFeedback, twoFactorFeedback?.dataset.unexpectedError, false);
    }
  });
});
