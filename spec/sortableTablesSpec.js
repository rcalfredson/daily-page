import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync('public/js/sortable-tables.js', 'utf8');

function render(markup) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only' });
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom.window.document;
}

function columnValues(table, columnIndex = 0) {
  return Array.from(table.tBodies[0].rows, row => row.cells[columnIndex].textContent.trim());
}

describe('sortable Markdown tables', () => {
  it('sorts decimal and percent columns numerically and keeps empty cells last', () => {
    const document = render(`
      <div class="table-scroll-wrapper"><table>
        <thead><tr><th>Score</th></tr></thead>
        <tbody><tr><td>10</td></tr><tr><td></td></tr><tr><td>9.2%</td></tr><tr><td>2</td></tr></tbody>
      </table></div>
    `);
    const table = document.querySelector('table');
    const button = table.querySelector('button');

    button.click();
    expect(columnValues(table)).toEqual(['2', '9.2%', '10', '']);
    expect(button.parentElement.getAttribute('aria-sort')).toBe('ascending');

    button.click();
    expect(columnValues(table)).toEqual(['10', '9.2%', '2', '']);
    expect(button.parentElement.getAttribute('aria-sort')).toBe('descending');
  });

  it('sorts text alphabetically and resets aria-sort on the previous column', () => {
    const document = render(`
      <div class="table-scroll-wrapper"><table>
        <thead><tr><th>Rank</th><th>Place</th></tr></thead>
        <tbody><tr><td>1</td><td>Zulu</td></tr><tr><td>2</td><td>alpha</td></tr></tbody>
      </table></div>
    `);
    const table = document.querySelector('table');
    const headers = table.querySelectorAll('th');

    headers[0].querySelector('button').click();
    headers[1].querySelector('button').click();

    expect(columnValues(table, 1)).toEqual(['alpha', 'Zulu']);
    expect(headers[0].getAttribute('aria-sort')).toBe('none');
    expect(headers[1].getAttribute('aria-sort')).toBe('ascending');
  });

  it('enhances multiple tables independently', () => {
    const document = render(`
      <div class="table-scroll-wrapper"><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>2</td></tr><tr><td>1</td></tr></tbody></table></div>
      <div class="table-scroll-wrapper"><table><thead><tr><th>B</th></tr></thead><tbody><tr><td>4</td></tr><tr><td>3</td></tr></tbody></table></div>
    `);
    const tables = document.querySelectorAll('table');

    tables[0].querySelector('button').click();

    expect(columnValues(tables[0])).toEqual(['1', '2']);
    expect(columnValues(tables[1])).toEqual(['4', '3']);
  });

  it('respects table and column opt-outs', () => {
    const document = render(`
      <div class="table-scroll-wrapper"><table class="no-sort"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></div>
      <div class="table-scroll-wrapper"><table><thead><tr><th data-no-sort>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>
    `);
    const tables = document.querySelectorAll('table');

    expect(tables[0].querySelector('button')).toBeNull();
    expect(tables[1].querySelector('th').querySelector('button')).toBeNull();
    expect(tables[1].querySelectorAll('button').length).toBe(1);
  });
});
