import User from './models/User.js';

export async function createUser(userData) {
  // Option 1: build a new instance and save
  const user = new User(userData);
  const result = await user.save();
  return result._id;
}

export async function findUserByUsername(username) {
  let user = await User.findOne({ username });
  if (!user) return user;
  return user.toObject();
}

export async function findUserByEmail(email) {
  let user = await User.findOne({ email });
  if (!user) return user;
  return user.toObject();
}

export async function findUserById(userId) {
  let user = await User.findById(userId);
  if (!user) return user;
  return user.toObject();
}

export async function updateUserProfile(userId, updates) {
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      ...updates,
      updatedAt: new Date(),
    },
    { returnDocument: 'after' }
  );

  // If there's no matching user, updatedUser will be null
  if (!updatedUser) return null;

  return updatedUser.toObject();
}

export async function starRoom(userId, roomId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (!user.starredRooms.includes(roomId)) {
    user.starredRooms.push(roomId);
  }
  await user.save();
  return user.toObject();
}

export async function unstarRoom(userId, roomId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  user.starredRooms = user.starredRooms.filter(r => r !== roomId);
  await user.save();
  return user.toObject();
}

export function validTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length > 100) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
    return timeZone;
  } catch {
    return null;
  }
}

export function calendarDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function streakDayDifference(lastUpdatedAt, now, timeZone) {
  const toDayNumber = (date) => {
    const [year, month, day] = calendarDateKey(date, timeZone).split('-').map(Number);
    return Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24);
  };
  return toDayNumber(now) - toDayNumber(lastUpdatedAt);
}

export async function updateUserStreak(userId, { timeZone, now = new Date() } = {}) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const streakTimeZone = validTimeZone(timeZone) || validTimeZone(user.streakTimeZone) || 'UTC';

  if (!user.streakLastUpdatedAt) {
    // No streak yet; start one
    user.streakLength = 1;
    user.streakLastUpdatedAt = now;
  } else {
    const diffDays = streakDayDifference(user.streakLastUpdatedAt, now, streakTimeZone);

    if (diffDays === 0) {
      // Already updated today, do nothing
    } else if (diffDays === 1) {
      // Consecutive day, increment
      user.streakLength += 1;
      user.streakLastUpdatedAt = now;
    } else {
      // Missed at least one day, reset
      user.streakLength = 1;
      user.streakLastUpdatedAt = now;
    }
  }

  user.streakTimeZone = streakTimeZone;
  await user.save();
  return user.toObject();
}
