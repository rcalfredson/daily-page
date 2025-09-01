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

  /**
   * index: 1..12 ; lang: BCP-47 (e.g., 'en', 'es', 'es-MX')
   */
  static monthName(index, lang = 'en') {
    // Usamos una fecha fija: día 1 del mes pedido.
    const d = new Date(Date.UTC(2020, index - 1, 1));
    // 'long' -> 'January', 'enero', etc.
    return new Intl.DateTimeFormat(lang, { month: 'long' }).format(d);
  }

  static roundedDuration(durationMillis) {
    return duration(durationMillis, { round: true, units: ['m', 's'] });
  }
}

export default DateHelper;
