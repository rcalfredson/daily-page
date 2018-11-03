import BackendHelper from './backendHelper';

function showViewer() {
  document.getElementById('viewer').classList.remove('hide');
}

function updateViewer(content) {
  showViewer();
  document.getElementById('viewer').innerText = content;
}

function lastComponent() {
  const components = window.location.href.split('/');

  return components[components.length - 1];
}

BackendHelper.getPage(lastComponent()).then(result => updateViewer(result.content))
  .catch(() => {
    updateViewer('We could not find the page for that day.');
  });
