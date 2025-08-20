import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
  findUserByEmail, findUserById, findUserByUsername
} from '../../db/userService.js';
import User from '../../db/models/User.js';
import { noCache } from '../../middleware/auth.js'
import { verifyJWT } from '../../services/jwt.js';
import { makeUserJWT } from '../../utils/jwtHelper.js';
import { sendEmail } from '../../services/mailgunService.js';

const router = Router();

const useAuthAPI = (app) => {
  app.use('/api/v1/auth', router);

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
      const user =
        (await findUserByEmail(username)) ||
        (await findUserByUsername(username));

      if (!user) {
        return res.status(400).json({ error: 'Invalid username or email.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid password.' });
      }

      if (!user.verified) {
        return res.status(401).json({ error: 'Please verify your email before logging in.' });
      }

      const token = makeUserJWT({
        id: user._id,
        username: user.username,
        profilePic: user.profilePic,
        bio: user.bio,
        streakLength: user.streakLength
      });

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ message: 'Login successful!' });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'Lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    return res.sendStatus(204);
  });

  router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });

      const token = crypto.randomBytes(20).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.resetPasswordToken = token;
      user.resetPasswordExpires = expires;
      await user.save();

      const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

      await sendEmail({
        to: email,
        subject: 'Reset your Daily Page password',
        html: `
          <h2>Password Reset Request</h2>
          <p>Click the link below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}">Reset My Password</a>
        `
      });

      res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      console.error('Password reset error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token.' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      res.status(200).json({ message: 'Password updated successfully!' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/me', noCache, (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const userData = verifyJWT(token);
      findUserById(userData.id)
        .then((user) => {
          if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
          }
          res.status(200).json({
            id: user._id,
            username: user.username,
            email: user.email,
            profilePic: user.profilePic
          });
        })
        .catch((err) => {
          console.error('Error fetching user:', err);
          res.status(500).json({ error: 'Internal server error' });
        });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });
};

export default useAuthAPI;
