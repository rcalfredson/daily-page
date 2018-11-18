import BackendHelper from './backendHelper';

function showViewer() {
  document.getElementById('viewer').classList.remove('hide');
}

function showError() {
  document.getElementById('viewer').innerText = 'We could not find any pages during that timeframe.';
}

function showDates(dates) {
  showViewer();
  const viewer = document.getElementById('viewer');
  viewer.classList.add('year-month');
  if (!dates || dates.length === 0) {
    showError();
    return;
  }
  dates.forEach((date) => {
    const newLink = document.createElement('a');
    newLink.href = `../${date}`;
    newLink.innerText = date;
    newLink.classList.add('date-link');
    viewer.appendChild(newLink);
  });
}

BackendHelper.getPageDatesByYearAndMonth(year, month).then((dates) => {
  showDates(dates);
}).catch(() => {
  showError();
});
