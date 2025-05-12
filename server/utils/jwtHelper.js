// server/utils/jwtHelper.js
import { generateJWT } from '../services/jwt.js';

export function makeUserJWT(user) {
  // Just your usual fields from updatedUser
  const { _id, id, username, profilePic, bio, streakLength } = user;
  return generateJWT({
    id: id || _id,
    username,
    profilePic,
    bio,
    streakLength,
  });
}

export function refreshAuthToken(res, user) {
  const token = makeUserJWT({
    id: user._id,
    username: user.username,
    profilePic: user.profilePic,
    bio: user.bio,
    streakLength: user.streakLength,
  });
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 24 * 60 * 60 * 1000,
  });
}
