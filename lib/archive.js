import BackendHelper from './backendHelper';
import DateHelper from './dateHelper';

function showViewer() {
  document.getElementById('viewer').classList.remove('hide');
}

function showError() {
  document.getElementById('viewer').innerText = 'Sorry; something went wrong while loading the archive.';
}

function showMonthYearCombos(combos) {
  showViewer();
  const viewer = document.getElementById('viewer');
  viewer.classList.add('year-month');
  if (!combos || combos.length === 0) {
    showError();
    return;
  }
  combos.forEach((combo) => {
    const newLink = document.createElement('a');
    newLink.href = `${combo.year}/${combo.month}`;
    newLink.innerText = `${DateHelper.monthName(combo.month)} ${combo.year}`;
    newLink.classList.add('date-link');
    viewer.appendChild(newLink);
  });
}

BackendHelper.getPageMonthYearCombos().then((combos) => {
  showMonthYearCombos(combos);
}).catch(() => {
  showError();
});
