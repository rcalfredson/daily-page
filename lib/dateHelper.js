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

  /**
   * Formato largo localizado con Intl (weekday, day, month, year).
   * lang: BCP-47 ('en', 'es', 'es-MX', etc.)
   * tz: zona a usar (por defecto Europe/London como tu sitio)
   */
  static formatDateI18n(date, lang = 'en', tz = 'Europe/London') {
    const d = (date instanceof Date) ? date : new Date(date);
    return new Intl.DateTimeFormat(lang, {
      timeZone: tz,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  }

  static currentDateI18n(lang = 'en', tz = 'Europe/London') {
    return DateHelper.formatDateI18n(Date.now(), lang, tz);
  }

  static localDateTimeI18n(date, lang = 'en', tz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    return new Intl.DateTimeFormat(lang, { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
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

  /**
   * Devuelve ['Sun','Mon',...,'Sat'] pero localizados y en formato 'short'
   * Siempre empezando en domingo para alinear con los calendarios del sitio.
  */
  static weekdayShortNames(lang = 'en') {
    // Domingo conocido: 2020-02-02 fue domingo (UTC)
    const start = new Date(Date.UTC(2020, 1, 2));
    const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      arr.push(fmt.format(d));
    }
    return arr;
  }

  static roundedDuration(durationMillis) {
    return duration(durationMillis, { round: true, units: ['m', 's'] });
  }

  static roundedDurationI18n(durationMillis, lang = 'en') {
    // Normalize 'en-US' → 'en', 'es-MX' → 'es'
    const language = (lang || 'en').split('-')[0];

    return duration(durationMillis, {
      round: true,
      units: ['m', 's'],
      language
    });
  }
}

export default DateHelper;
