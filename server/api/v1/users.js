import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import multer from 'multer';

import {
  createUser, findUserByEmail, findUserById, findUserByUsername, starRoom, unstarRoom, updateUserProfile,
  updateUserStreak
} from '../../db/userService.js';
import User from '../../db/models/User.js';
import { isAuthenticated } from '../../middleware/auth.js'
import { getUiLangFromReq } from '../../services/localeContext.js';
import { uploadProfilePic } from '../../services/uploadProfilePic.js';
import { buildVerifyEmail } from '../../services/emailTemplates/verifyEmail.js';
import { makeUserJWT, refreshAuthToken } from '../../utils/jwtHelper.js';
import { sendEmail } from '../../services/mailgunService.js';

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

    const reservedUsernames = ['anonymous', 'admin', 'root', 'null'];
    if (reservedUsernames.includes(username.trim().toLowerCase())) {
      return res.status(400).json({ error: 'That username is reserved. Please choose another.' });
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

      const verificationToken = crypto.randomBytes(20).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expira en 24h

      // Create the new user
      const userId = await createUser({
        email,
        username,
        password: hashedPassword, // Save the hashed password
        verified: false,
        verificationToken,
        verificationTokenExpires: tokenExpires,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const uiLang = getUiLangFromReq(req);
      const verifyLink = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      // Envía email de verificación
      const { subject, html } = await buildVerifyEmail({
        uiLang,
        username,
        verifyLink,
        hours: 24
      });

      await sendEmail({ to: email, subject, html });

      res.status(201).json({ userId, message: 'User created successfully!' });
    } catch (error) {
      console.error('Error creating user:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/users/verify-email?token=abc123
  router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ ok: false, code: 'MISSING_TOKEN' });
    }

    try {
      const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() },
      });

      if (!user) {
        return res.status(400).json({ ok: false, code: 'INVALID_OR_EXPIRED_TOKEN' });
      }

      user.verified = true;
      user.verificationToken = null;
      user.verificationTokenExpires = null;
      await user.save();

      return res.status(200).json({ ok: true, code: 'VERIFIED' });
    } catch (error) {
      console.error('Error verifying email:', error.message);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
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
      refreshAuthToken(res, updatedUser);

      res.status(200).json({ streakLength: updatedUser.streakLength });
    } catch (error) {
      console.error('Error updating streak:', error);
      res.status(500).json({ error: 'Failed to update streak' });
    }
  });

  router.patch('/:userId/starredRooms', isAuthenticated, mustMatchLoggedInUser, async (req, res) => {
    const { userId } = req.params;
    const { roomId, action } = req.body; // e.g. "star" or "unstar"

    try {
      let updatedUser;
      if (action === 'star') {
        updatedUser = await starRoom(userId, roomId);
      } else if (action === 'unstar') {
        updatedUser = await unstarRoom(userId, roomId);
      } else {
        return res.status(400).json({ error: 'Invalid action. Must be "star" or "unstar".' });
      }

      res.status(200).json({ starredRooms: updatedUser.starredRooms });
    } catch (error) {
      console.error('Error starring or unstarring room:', error);
      res.status(500).json({ error: 'Failed to update starred rooms' });
    }
  });

  router.post('/:userId/uploadProfilePic', isAuthenticated, mustMatchLoggedInUser, upload.single('profilePic'),
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
