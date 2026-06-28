(function () {
  async function hydrateRecommendations() {
    const loading = document.querySelector('[data-recommendations-loading]');
    if (!loading) return;

    try {
      const response = await fetch(loading.dataset.endpoint, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' }
      });

      if (response.status === 204) {
        const layout = loading.closest('.block-view-layout');
        loading.remove();
        layout?.classList.remove('block-view-layout--with-recommendations');
        return;
      }

      if (!response.ok) throw new Error(`Recommendation request failed with ${response.status}`);

      const html = await response.text();
      if (html.trim()) loading.outerHTML = html;
    } catch (error) {
      console.error('Unable to load recommendations:', error);
      const layout = loading.closest('.block-view-layout');
      loading.remove();
      layout?.classList.remove('block-view-layout--with-recommendations');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateRecommendations, { once: true });
  } else {
    hydrateRecommendations();
  }
})();
