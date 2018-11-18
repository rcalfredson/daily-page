function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function monthName(index) {
  return ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'][index];
}

module.exports = { capitalize, monthName };
