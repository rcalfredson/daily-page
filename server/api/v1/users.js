import { Router } from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';

import {
  createUser, findUserByEmail, findUserById, findUserByUsername, updateUserProfile,
  updateUserStreak
} from '../../db/userService.js';
import isAuthenticated from '../../middleware/auth.js'
import { uploadProfilePic } from '../../services/uploadProfilePic.js';
import { makeUserJWT } from '../../utils/jwtHelper.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function mustMatchLoggedInUser(req, res, next) {
  const { userId } = req.params;
  // If for some reason req.user isn't set, you'll want a check or a chain
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.id !== userId) {
    return res.status(403).json({ error: 'You are not authorized to update this user.' });
  }
  next();
}

const useUserAPI = (app) => {
  app.use('/api/v1/users', router);

  // Create a new user
  router.post('/', async (req, res) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    try {
      // Check if email is already in use
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      // Check if username is already in use
      const existingUsernameUser = await findUserByUsername(username); // <-- Add this check
      if (existingUsernameUser) {
        return res.status(400).json({ error: 'Username already in use' });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10); // 10 is the "salt rounds"

      // Create the new user
      const userId = await createUser({
        email,
        username,
        password: hashedPassword, // Save the hashed password
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.status(201).json({ userId, message: 'User created successfully!' });
    } catch (error) {
      console.error('Error creating user:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user by ID
  router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json(user);
    } catch (error) {
      console.error(`Error fetching user with ID: ${userId}`, error.message);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  router.put('/:userId', isAuthenticated, mustMatchLoggedInUser, async (req, res) => {
    const { userId } = req.params;
    const updates = req.body;

    try {
      const updatedUser = await updateUserProfile(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Genera el nuevo JWT incluyendo el bio
      const newToken = makeUserJWT({
        id: updatedUser._id,
        username: updatedUser.username,
        profilePic: updatedUser.profilePic,
        bio: updatedUser.bio,
        streakLength: updatedUser.streakLength
      });

      // Setear la cookie con el nuevo token
      res.cookie('auth_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
      console.error(`Error updating user profile for ID: ${userId}`, error.message);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  router.post('/:userId/streakPing', isAuthenticated, mustMatchLoggedInUser, async (req, res) => {
    const userId = req.user.id;
    try {
      const updatedUser = await updateUserStreak(userId);
      res.status(200).json({ streakLength: updatedUser.streakLength });
    } catch (error) {
      console.error('Error updating streak:', error);
      res.status(500).json({ error: 'Failed to update streak' });
    }
  });

  router.post('/:userId/uploadProfilePic',isAuthenticated, mustMatchLoggedInUser, upload.single('profilePic'),
    async (req, res) => {
      const { userId } = req.params;

      try {
        const { imageUrl, newToken } = await uploadProfilePic(req, userId);

        // Set the new JWT in the cookies
        res.cookie('auth_token', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict',
          maxAge: 24 * 60 * 60 * 1000,
        });

        res.status(200).json({ success: true, imageUrl });
      } catch (error) {
        console.error('Error uploading profile picture:', error.message);
        res.status(500).json({ error: 'Failed to upload profile picture' });
      }
    });
};

export default useUserAPI;
