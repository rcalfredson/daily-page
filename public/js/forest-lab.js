(function () {
  function paintRuns(context, runs) {
    runs.forEach(function (run) {
      context.fillStyle = run.color;
      context.fillRect(run.x, run.y, run.width, 1);
    });
  }

  function renderTreeAssets() {
    const payload = document.getElementById('forest-tree-assets');
    if (!payload) return;
    const assets = JSON.parse(payload.textContent);
    document.querySelectorAll('[data-forest-asset]').forEach(function (canvas) {
      const asset = assets[Number(canvas.dataset.forestAsset)];
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = false;
      const layers = canvas.classList.contains('forest-wood-canvas')
        ? asset.layers.filter(function (layer) { return layer.id === 'wood'; })
        : asset.layers;
      layers.forEach(function (layer) { paintRuns(context, layer.runs); });
    });
  }

  function humanDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
        dateStyle: 'medium'
      }).format(date);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderTreeAssets();
    const dialog = document.querySelector('[data-forest-tree-dialog]');
    if (!dialog) return;

    const fields = {
      title: dialog.querySelector('[data-forest-tree-title]'),
      room: dialog.querySelector('[data-forest-tree-room]'),
      date: dialog.querySelector('[data-forest-tree-date]'),
      excerpt: dialog.querySelector('[data-forest-tree-excerpt]'),
      link: dialog.querySelector('[data-forest-tree-link]')
    };

    document.querySelectorAll('[data-forest-tree]').forEach(function (tree) {
      tree.addEventListener('click', function () {
        fields.title.textContent = tree.dataset.title;
        fields.room.textContent = tree.dataset.room;
        fields.date.textContent = humanDate(tree.dataset.date);
        fields.excerpt.textContent = tree.dataset.excerpt;
        fields.link.href = tree.dataset.url;
        dialog.showModal();
      });
    });

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
  });
})();
