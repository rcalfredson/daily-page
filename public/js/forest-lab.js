(function () {
  function humanDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
        dateStyle: 'medium'
      }).format(date);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const dialog = document.querySelector('[data-forest-tree-dialog]');
    if (!dialog) return;

    const fields = {
      title: dialog.querySelector('[data-forest-tree-title]'),
      room: dialog.querySelector('[data-forest-tree-room]'),
      date: dialog.querySelector('[data-forest-tree-date]'),
      species: dialog.querySelector('[data-forest-tree-species]'),
      season: dialog.querySelector('[data-forest-tree-season]'),
      excerpt: dialog.querySelector('[data-forest-tree-excerpt]'),
      link: dialog.querySelector('[data-forest-tree-link]')
    };

    document.querySelectorAll('[data-forest-tree]').forEach(function (tree) {
      tree.addEventListener('click', function () {
        fields.title.textContent = tree.dataset.title;
        fields.room.textContent = tree.dataset.room;
        fields.date.textContent = humanDate(tree.dataset.date);
        fields.species.textContent = tree.dataset.species;
        fields.season.textContent = tree.dataset.season;
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
