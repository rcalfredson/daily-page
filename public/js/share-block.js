document.addEventListener('DOMContentLoaded', () => {
  const shareBtn = document.getElementById('share-btn');
  const shareModal = document.getElementById('share-modal');
  const shareCloseBtn = document.querySelector('.share-close-btn');

  // Suponemos que el título del bloque se encuentra en el h1 con clase .block-title
  const blockTitle = document.querySelector('h1.block-title').innerText || document.title;
  const currentURL = window.location.href;

  // Elementos de los enlaces de share
  const facebookLink = document.getElementById('share-facebook');
  const redditLink = document.getElementById('share-reddit');
  const whatsappLink = document.getElementById('share-whatsapp');
  const twitterLink = document.getElementById('share-twitter');

  // Actualiza los enlaces con las URL correctas
  function updateShareLinks() {
    facebookLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentURL)}`;
    redditLink.href = `https://www.reddit.com/submit?url=${encodeURIComponent(currentURL)}&title=${encodeURIComponent(blockTitle)}`;
    whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(blockTitle + ' ' + currentURL)}`;
    twitterLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(blockTitle)}&url=${encodeURIComponent(currentURL)}`;
  }
  
  updateShareLinks();

  // Al hacer clic en el botón de Share
  shareBtn.addEventListener('click', () => {
    // Si el navegador soporta la API nativa de compartir
    if (navigator.share) {
      navigator.share({
        title: blockTitle,
        text: `Check out this block: ${blockTitle}`,
        url: currentURL,
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback: mostrar el modal personalizado
      shareModal.classList.remove('hidden');
    }
  });

  // Cerrar el modal al hacer clic en la "X"
  shareCloseBtn.addEventListener('click', () => {
    shareModal.classList.add('hidden');
  });

  // Cerrar el modal si se hace clic fuera del contenido
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
      shareModal.classList.add('hidden');
    }
  });
});
