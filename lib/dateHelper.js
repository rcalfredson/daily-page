import duration from 'humanize-duration';
import moment from 'moment-timezone';

class DateHelper {
  static closingTime() {
    return moment().add(1, 'days').tz('Europe/London').startOf('day')
      .valueOf();
  }

  static currentDate(format = 'short') {
    return moment(Date.now()).tz('Europe/London').format(format === 'short' ? 'YYYY-MM-DD' : 'dddd, MMMM Do YYYY');
  }

  static roundedDuration(durationMillis) {
    return duration(durationMillis, { round: true, units: ['m', 's'] });
  }
}

export default DateHelper;
module.exports = DateHelper;
