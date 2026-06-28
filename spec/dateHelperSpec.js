import DateHelper from '../lib/dateHelper.js';

describe('DateHelper archive labels', () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });

  afterEach(() => {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  });

  it('formats a one-based month without shifting it in a western timezone', () => {
    expect(DateHelper.monthName(6, 'en')).toBe('June');
  });

  it('keeps archive weekday headings aligned from Sunday through Saturday', () => {
    expect(DateHelper.weekdayShortNames('en')).toEqual([
      'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
    ]);
  });
});
