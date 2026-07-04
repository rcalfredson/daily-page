document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelector('[data-quest-tabs]');
  const panel = document.querySelector('[data-quest-tab-panel]');
  if (!tabs || !panel) return;

  const detailPath = window.location.pathname;
  let controller = null;

  function isPanelUrl(value) {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin &&
      url.pathname === detailPath &&
      url.searchParams.has('view');
  }

  async function loadPanel(value, { push = true } = {}) {
    const url = new URL(value, window.location.href);
    const currentContributionPage = new URL(window.location.href)
      .searchParams.get('contributionsPage');
    if (push && currentContributionPage && !url.searchParams.has('contributionsPage')) {
      url.searchParams.set('contributionsPage', currentContributionPage);
    }
    controller?.abort();
    controller = new window.AbortController();
    panel.setAttribute('aria-busy', 'true');
    panel.classList.add('quest-tab-panel--loading');

    try {
      const response = await fetch(url, {
        headers: { 'X-Requested-With': 'quest-tab-panel' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Quest panel request failed (${response.status})`);
      const documentFragment = new window.DOMParser()
        .parseFromString(await response.text(), 'text/html');
      const nextPanel = documentFragment.querySelector('[data-quest-tab-panel]');
      const nextTabs = documentFragment.querySelector('[data-quest-tabs]');
      if (!nextPanel || !nextTabs) throw new Error('Quest panel response was incomplete.');

      panel.innerHTML = nextPanel.innerHTML;
      tabs.innerHTML = nextTabs.innerHTML;
      document.title = documentFragment.title || document.title;
      if (push) window.history.pushState({ questPanel: true }, '', url);
    } catch (error) {
      if (error.name === 'AbortError') return;
      window.location.assign(url);
    } finally {
      panel.removeAttribute('aria-busy');
      panel.classList.remove('quest-tab-panel--loading');
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-quest-tabs] a, [data-quest-tab-panel] a');
    if (!link || !isPanelUrl(link.href) || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    loadPanel(link.href);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-quest-tab-panel] .quest-filters');
    if (!form) return;
    event.preventDefault();
    const url = new URL(form.action, window.location.href);
    url.search = new URLSearchParams(new FormData(form)).toString();
    url.hash = 'quest-sections';
    loadPanel(url);
  });

  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    if (url.pathname === detailPath) loadPanel(url, { push: false });
  });
});
