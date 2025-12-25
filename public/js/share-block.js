document.addEventListener('DOMContentLoaded', () => {
  const shareBtn = document.getElementById('share-btn');
  const shareModal = document.getElementById('share-modal');
  const shareCloseBtn = document.querySelector('.share-close-btn');

  if (!shareBtn || !shareModal) return;

  const nativeText =
    shareBtn.dataset.nativeText ||
    shareModal.dataset.nativeText ||
    'Check out this block';

  const blockTitleEl = document.querySelector('h1.block-title');
  const blockTitle = (blockTitleEl?.innerText || document.title).trim();
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.href;
  const currentURL = canonicalHref || (window.location.origin + window.location.pathname);

  const facebookLink = document.getElementById('share-facebook');
  const redditLink = document.getElementById('share-reddit');
  const whatsappLink = document.getElementById('share-whatsapp');
  const twitterLink = document.getElementById('share-twitter');

  function updateShareLinks() {
    if (!facebookLink || !redditLink || !whatsappLink || !twitterLink) return;

    facebookLink.href =
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentURL)}`;

    redditLink.href =
      `https://www.reddit.com/submit?url=${encodeURIComponent(currentURL)}&title=${encodeURIComponent(blockTitle)}`;

    whatsappLink.href =
      `https://wa.me/?text=${encodeURIComponent(blockTitle + ' ' + currentURL)}`;

    twitterLink.href =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(blockTitle)}&url=${encodeURIComponent(currentURL)}`;
  }

  updateShareLinks();

  shareBtn.addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({
        title: blockTitle,
        text: nativeText,
        url: currentURL
      }).catch(err => console.error('Error sharing:', err));
    } else {
      shareModal.classList.remove('hidden');
    }
  });

  shareCloseBtn?.addEventListener('click', () => {
    shareModal.classList.add('hidden');
  });

  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
      shareModal.classList.add('hidden');
    }
  });
});
