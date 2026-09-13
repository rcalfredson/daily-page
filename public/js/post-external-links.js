(function () {
  const postLinkSelector = [
    '.block-content a[href]',
    '.content-preview a[href]',
    '.featured-content-preview a[href]'
  ].join(', ');

  const isExternalHttpLink = link => {
    let url;

    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return false;
    }

    return (url.protocol === 'http:' || url.protocol === 'https:')
      && url.origin !== window.location.origin;
  };

  const decorateExternalPostLinks = () => {
    document.querySelectorAll(postLinkSelector).forEach(link => {
      if (isExternalHttpLink(link) && !link.querySelector('img')) {
        link.classList.add('post-external-link');
      }
    });
  };

  document.addEventListener('DOMContentLoaded', decorateExternalPostLinks);
}());
