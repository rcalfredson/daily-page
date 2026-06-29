document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('save-banner-image-btn');
  const kindInput = document.getElementById('banner-image-kind');
  const urlInput = document.getElementById('banner-image-url');
  const captionInput = document.getElementById('banner-image-caption');
  if (!saveButton || !kindInput || !urlInput || !captionInput) return;

  const t = typeof window.i18nT === 'function' ? window.i18nT : (key) => key;

  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    try {
      const response = await fetch(`/api/v1/blocks/${block_id}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerImage: {
            kind: kindInput.value,
            url: urlInput.value,
            caption: captionInput.value
          }
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t('blockEditor.bannerImage.updateError'));
      }

      const message = urlInput.value.trim()
        ? t('blockEditor.bannerImage.saved')
        : t('blockEditor.bannerImage.removed');
      if (typeof window.showToast === 'function') window.showToast(message, 'success');
    } catch (error) {
      if (typeof window.showToast === 'function') window.showToast(error.message, 'error');
      else alert(error.message);
    } finally {
      saveButton.disabled = false;
    }
  });
});
