(function () {
  const DATE_PLACEHOLDER = '__DATE__';

  function formatLocalDateTimes(root = document) {
    const locale = document.documentElement.lang || undefined;

    root.querySelectorAll('[data-local-date-time]').forEach((element) => {
      const rawDate = element.getAttribute('datetime') || element.dataset.localDateTime;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;

      const options = { dateStyle: element.dataset.dateStyle || 'medium' };
      if (element.dataset.timeStyle) options.timeStyle = element.dataset.timeStyle;

      const formatted = new Intl.DateTimeFormat(locale, options).format(date);
      const template = element.dataset.dateTemplate;
      element.textContent = template && template.includes(DATE_PLACEHOLDER)
        ? template.replace(DATE_PLACEHOLDER, formatted)
        : formatted;
    });
  }

  window.formatLocalDateTimes = formatLocalDateTimes;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => formatLocalDateTimes());
  } else {
    formatLocalDateTimes();
  }
})();
