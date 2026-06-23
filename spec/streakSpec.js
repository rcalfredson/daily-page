import User from '../server/db/models/User.js';
import {
  calendarDateKey,
  streakDayDifference,
  updateUserStreak,
  validTimeZone
} from '../server/db/userService.js';
import { localCalendarDateKey } from '../lib/streakHelper.js';

describe('timezone-aware writing streaks', () => {
  it('uses the browser calendar date for the client ping guard', () => {
    const localDate = new Date(2026, 5, 22, 23, 30);
    expect(localCalendarDateKey(localDate)).toBe('2026-06-22');
  });

  it('recognizes consecutive local days that straddle UTC inconsistently', () => {
    const first = new Date('2026-06-21T00:00:00.000Z'); // June 20, 8 PM in New York
    const second = new Date('2026-06-21T23:00:00.000Z'); // June 21, 7 PM in New York
    const third = new Date('2026-06-23T00:00:00.000Z'); // June 22, 8 PM in New York

    expect(streakDayDifference(first, second, 'America/New_York')).toBe(1);
    expect(streakDayDifference(second, third, 'America/New_York')).toBe(1);
  });

  it('treats local midnight as a new day across daylight-saving changes', () => {
    const before = new Date('2026-03-08T05:30:00.000Z'); // 12:30 AM EST
    const after = new Date('2026-03-09T04:30:00.000Z'); // 12:30 AM EDT, 23 hours later

    expect(streakDayDifference(before, after, 'America/New_York')).toBe(1);
  });

  it('updates and retains the timezone used for the streak', async () => {
    const user = {
      streakLength: 4,
      streakLastUpdatedAt: new Date('2026-06-21T23:00:00.000Z'),
      streakTimeZone: 'UTC',
      save: jasmine.createSpy('save').and.resolveTo(),
      toObject() { return this; }
    };
    spyOn(User, 'findById').and.resolveTo(user);

    await updateUserStreak('user-id', {
      timeZone: 'America/New_York',
      now: new Date('2026-06-23T00:00:00.000Z')
    });

    expect(user.streakLength).toBe(5);
    expect(user.streakTimeZone).toBe('America/New_York');
    expect(user.save).toHaveBeenCalled();
  });

  it('validates IANA timezone input', () => {
    expect(validTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(validTimeZone('not/a-timezone')).toBeNull();
    expect(calendarDateKey('2026-01-01T01:00:00.000Z', 'America/New_York')).toBe('2025-12-31');
  });
});
