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
