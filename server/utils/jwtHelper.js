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
