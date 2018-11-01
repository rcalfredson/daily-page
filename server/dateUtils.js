const moment = require('moment-timezone');

function currentDate() {
  return moment(Date.now()).tz('Europe/London').format('YYYY-MM-DD');
}

module.exports = { currentDate };
