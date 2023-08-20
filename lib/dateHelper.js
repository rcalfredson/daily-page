import duration from 'humanize-duration';
import moment from 'moment-timezone';

class DateHelper {
  static formatMap() {
    return { short: 'YYYY-MM-DD', long: 'dddd, D MMMM YYYY' };
  }

  static closingTime() {
    return moment().add(1, 'days').tz('Europe/London').startOf('day')
      .valueOf();
  }

  static currentDate(format = 'short') {
    return DateHelper.formatDate(Date.now(), format);
  }

  static formatDate(date, format) {
    return moment(date).tz('Europe/London').format(DateHelper.formatMap()[format]);
  }

  static localDateWithTime(date) {
    return moment(date).tz(moment.tz.guess()).format('h:mm:ss A z, YYYY-MM-DD');
  }

  static monthName(index) {
    return ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'][index - 1];
  }

  static roundedDuration(durationMillis) {
    return duration(durationMillis, { round: true, units: ['m', 's'] });
  }
}

export default DateHelper;
