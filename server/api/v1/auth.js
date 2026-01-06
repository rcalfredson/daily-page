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
import { getUiLangFromReq } from '../../services/localeContext.js';
import { sendEmail } from '../../services/mailgunService.js';
import { buildPasswordResetEmail } from '../../services/emailTemplates/passwordReset.js';

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

    if (!email) return res.status(400).json({ ok: false, code: 'MISSING_EMAIL' });

    try {
      const user = await User.findOne({ email });

      // Always return success-ish for privacy, whether user exists or not
      if (!user) return res.status(200).json({ ok: true, code: 'SENT_IF_EXISTS' });

      const token = crypto.randomBytes(20).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.resetPasswordToken = token;
      user.resetPasswordExpires = expires;
      await user.save();

      const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;

      const uiLang = getUiLangFromReq(req);

      const { subject, html } = await buildPasswordResetEmail({
        uiLang,
        username: user.username, // optional but nice in the email
        resetUrl,
        hours: 1,
      });

      await sendEmail({ to: email, subject, html });

      return res.status(200).json({ ok: true, code: 'SENT_IF_EXISTS' });
    } catch (err) {
      console.error('Password reset error:', err);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
    }
  });

  router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ ok: false, code: 'MISSING_FIELDS' });
    }

    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({ ok: false, code: 'INVALID_OR_EXPIRED_TOKEN' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      return res.status(200).json({ ok: true, code: 'RESET_OK' });
    } catch (error) {
      console.error('Error resetting password:', error);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
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
