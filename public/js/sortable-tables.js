(function () {
  'use strict';

  const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/;

  function cellValue(row, columnIndex) {
    const cell = row.cells[columnIndex];
    return cell ? cell.textContent.trim() : '';
  }

  function isNumericColumn(values) {
    const nonEmptyValues = values.filter(value => value !== '');
    return nonEmptyValues.length > 0 && nonEmptyValues.every(value => NUMBER_PATTERN.test(value));
  }

  function compareValues(left, right, numeric, direction) {
    if (left === '' || right === '') {
      if (left === right) return 0;
      return left === '' ? 1 : -1;
    }

    const comparison = numeric
      ? parseFloat(left) - parseFloat(right)
      : left.localeCompare(right, undefined, { numeric: false, sensitivity: 'base' });

    return direction === 'ascending' ? comparison : -comparison;
  }

  function sortTable(table, header, columnIndex) {
    const direction = header.getAttribute('aria-sort') === 'ascending'
      ? 'descending'
      : 'ascending';

    table.querySelectorAll('thead th[aria-sort]').forEach(th => {
      th.setAttribute('aria-sort', th === header ? direction : 'none');
    });

    Array.from(table.tBodies).forEach(tbody => {
      const rows = Array.from(tbody.rows);
      const values = rows.map(row => cellValue(row, columnIndex));
      const numeric = isNumericColumn(values);

      rows
        .map((row, index) => ({ row, index, value: values[index] }))
        .sort((left, right) => (
          compareValues(left.value, right.value, numeric, direction) || left.index - right.index
        ))
        .forEach(item => tbody.appendChild(item.row));
    });
  }

  function enhanceTable(table) {
    if (table.classList.contains('no-sort') || table.classList.contains('sortable-table')) return;

    const headerRow = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
    if (!headerRow || !table.tBodies.length) return;

    const headers = Array.from(headerRow.cells).filter(cell => cell.tagName === 'TH');
    if (!headers.length) return;

    table.classList.add('sortable-table');

    headers.forEach(header => {
      if (header.hasAttribute('data-no-sort') || header.dataset.sortable === 'false') return;

      const columnIndex = header.cellIndex;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sortable-table__button';

      while (header.firstChild) button.appendChild(header.firstChild);
      header.appendChild(button);
      header.setAttribute('aria-sort', 'none');
      button.addEventListener('click', () => sortTable(table, header, columnIndex));
    });
  }

  function enhanceSortableTables(root = document) {
    root.querySelectorAll('.table-scroll-wrapper > table').forEach(enhanceTable);
  }

  document.addEventListener('DOMContentLoaded', () => enhanceSortableTables());
})();
