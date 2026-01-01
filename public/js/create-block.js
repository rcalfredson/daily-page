// public/js/create-block.js
let currentTooltipAnchor = null;
let currentTooltipOption = null;
let outsideClickListener = null;
let submitBtn = null;
let existingLangs = [];
let langSelect = null;

document.addEventListener('DOMContentLoaded', () => {
  // Ensure global i18n helper exists
  const t = (typeof window.i18nT === 'function')
    ? window.i18nT
    : (k) => k;

  // Placeholder responsive
  const titleInput = document.getElementById('title');
  const fullPlaceholder =
    titleInput?.dataset?.phFull
    || t('createBlock.form.title.placeholder.full');
  const shortPlaceholder =
    titleInput?.dataset?.phShort
    || t('createBlock.form.title.placeholder.short');

  const updatePlaceholder = () => {
    if (!titleInput) return;
    titleInput.placeholder =
      (window.innerWidth < 600) ? shortPlaceholder : fullPlaceholder;
  };
  updatePlaceholder();
  window.addEventListener('resize', updatePlaceholder);

  // Form
  const form = document.getElementById('block-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (existingLangs.includes(langSelect.value)) {
      alert(t('createBlock.messages.langExists'));
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // tags desde el partial
    const tagContainer = document.getElementById('tag-container');
    let tagsArray = [];
    if (tagContainer) {
      const tagPills = tagContainer.querySelectorAll('.tag-pill');
      tagPills.forEach(pill =>
        tagsArray.push(pill.firstChild.textContent.trim())
      );
    }
    data.tags = tagsArray;
    if (!data.content) data.content = '';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message =
          errJson?.error || t('createBlock.messages.genericError');
        throw new Error(message);
      }

      const block = await response.json();
      window.location.href = `/rooms/${block.roomId}/blocks/${block._id}/edit`;
    } catch (error) {
      console.error('Error:', error);
      alert(error.message || t('createBlock.messages.genericError'));
    }
  });

  // Advanced helpers
  langSelect = document.getElementById('lang');
  const sourceInput = document.getElementById('source-block');
  const groupIdField = document.getElementById('groupId');
  const originalBlockField = document.getElementById('originalBlock');
  submitBtn = document.querySelector('button[type="submit"]');

  existingLangs = [];

  // Default lang
  const guess =
    document.documentElement.lang
    || (window.I18n && typeof window.I18n.lang === 'function' && window.I18n.lang())
    || navigator.language
    || 'en';

  const short = String(guess).split('-')[0];
  langSelect.value = short;

  // Fetch info del bloque origen
  sourceInput.addEventListener('blur', async () => {
    const raw = sourceInput.value.trim();
    if (!raw) {
      groupIdField.value = '';
      originalBlockField.value = '';
      langSelect.querySelectorAll('option').forEach(o => (o.disabled = false));
      existingLangs = [];
      bumpIfDup();
      return;
    }

    const match =
      raw.match(/blocks\/([0-9a-fA-F]{24})/)
      || raw.match(/^([0-9a-fA-F]{24})$/);
    if (!match) {
      alert(t('createBlock.advanced.translate.invalid'));
      groupIdField.value = '';
      originalBlockField.value = '';
      return;
    }

    const id = match[1];
    try {
      const res = await fetch(`/api/v1/blocks/${id}`);
      if (!res.ok) throw new Error('NOT_FOUND');
      const json = await res.json();
      existingLangs = json.translations.map(ti => ti.lang);
      groupIdField.value = json.block.groupId;
      originalBlockField.value = id;

      // elegir primer idioma libre
      const allOpts = [...langSelect.options].map(o => o.value);
      const firstFree = allOpts.find(l => !existingLangs.includes(l)) || 'en';
      langSelect.value = firstFree;

      existingLangs.forEach(lang => {
        const option = langSelect.querySelector(`option[value="${lang}"]`);
        if (option) option.disabled = true;
      });

      bumpIfDup();
    } catch (err) {
      alert(t('createBlock.advanced.translate.fetchError'));
      groupIdField.value = '';
    }
  });

  langSelect.addEventListener('change', bumpIfDup);

  function bumpIfDup() {
    if (!langSelect || !submitBtn || !Array.isArray(existingLangs)) return;
    if (existingLangs.includes(langSelect.value)) {
      submitBtn.disabled = true;
      submitBtn.title = t('createBlock.messages.langExists');
    } else {
      submitBtn.disabled = false;
      submitBtn.title = '';
    }
  }

  // Tooltips
  window.toggleTooltip = function (event, option) {
    event.stopPropagation();
    currentTooltipAnchor = event.target;
    currentTooltipOption = option;

    let tooltip = document.getElementById(`${option}-tooltip`);
    const key = `createBlock.visibility.${option}.tooltip`;

    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = `${option}-tooltip`;
      tooltip.className = 'tooltip';
      tooltip.textContent = t(key);
      document.body.appendChild(tooltip);
    } else {
      tooltip.textContent = t(key);
    }

    if (tooltip.style.display !== 'block') {
      showTooltip(tooltip);
    } else {
      hideTooltip(tooltip);
    }
  };

  function showTooltip(tooltip) {
    tooltip.style.display = 'block';
    positionTooltip(currentTooltipAnchor, tooltip);
    outsideClickListener = function (e) {
      if (
        !tooltip.contains(e.target) &&
        currentTooltipAnchor &&
        !currentTooltipAnchor.contains(e.target)
      ) {
        hideTooltip(tooltip);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideClickListener), 0);
  }

  function hideTooltip(tooltip) {
    tooltip.style.display = 'none';
    if (outsideClickListener) {
      document.removeEventListener('click', outsideClickListener);
      outsideClickListener = null;
    }
  }

  function positionTooltip(anchor, tooltip) {
    if (!anchor) return;
    tooltip.style.display = 'block';
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const offsetY = 4;
    let top = anchorRect.bottom + window.scrollY + offsetY;
    let left =
      anchorRect.left +
      window.scrollX +
      (anchorRect.width / 2) -
      (tooltipRect.width / 2);

    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (left < 10) left = 10;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.maxWidth = '280px';
  }

  window.addEventListener('resize', () => {
    if (currentTooltipOption) {
      const tooltip = document.getElementById(`${currentTooltipOption}-tooltip`);
      if (tooltip && tooltip.style.display === 'block') {
        positionTooltip(currentTooltipAnchor, tooltip);
      }
    }
  });
});
