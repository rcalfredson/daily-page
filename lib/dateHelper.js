import duration from 'humanize-duration';
import moment from 'moment-timezone';

class DateHelper {
  static closingTime() {
    return moment().add(1, 'days').tz('Europe/London').startOf('day')
      .valueOf();
  }

  static currentDate() {
    return moment(Date.now()).tz('Europe/London').format('YYYY-MM-DD');
  }

  static roundedDuration(durationMillis) {
    return duration(durationMillis, { round: true, units: ['m', 's'] });
  }
}

export default DateHelper;
module.exports = DateHelper;
