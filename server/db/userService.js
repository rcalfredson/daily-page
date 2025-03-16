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
    { new: true } // return the updated doc
  );

  // If there's no matching user, updatedUser will be null
  if (!updatedUser) return null;

  return updatedUser.toObject();
}

export async function updateUserStreak(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const nowUTC = new Date();
  // Round down to “date only” if needed
  const today = Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate());

  if (!user.streakLastUpdatedAt) {
    // No streak yet; start one
    user.streakLength = 1;
    user.streakLastUpdatedAt = nowUTC;
  } else {
    const last = new Date(user.streakLastUpdatedAt);
    const lastUTC = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
    const diffDays = (today - lastUTC) / (1000 * 60 * 60 * 24);

    if (diffDays === 0) {
      // Already updated today, do nothing
    } else if (diffDays === 1) {
      // Consecutive day, increment
      user.streakLength += 1;
      user.streakLastUpdatedAt = nowUTC;
    } else {
      // Missed at least one day, reset
      user.streakLength = 1;
      user.streakLastUpdatedAt = nowUTC;
    }
  }

  await user.save();
  return user.toObject();
}
