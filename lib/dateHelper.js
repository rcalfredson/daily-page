import duration from 'humanize-duration';
import moment from 'moment-timezone';

class DateHelper {
  static closingTime() {
    return moment().add(1, 'days').tz('Europe/London').startOf('day')
      .valueOf();
  }

  static currentDate(format = 'short') {
    const formatMap = { short: 'YYYY-MM-DD', long: 'dddd, MMMM Do YYYY' };
    return moment(Date.now()).tz('Europe/London').format(formatMap[format]);
  }

  static localDateWithTime(date) {
    return moment(date).tz(moment.tz.guess()).format('h:mm:ss A z, YYYY-MM-DD');
  }

  static roundedDuration(durationMillis) {
    return duration(durationMillis, { round: true, units: ['m', 's'] });
  }
}

export default DateHelper;
module.exports = DateHelper;
