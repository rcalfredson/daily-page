import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import QRCode from 'qrcode';
import User from '../../db/models/User.js';
import { isAuthenticated, noCache } from '../../middleware/auth.js'
import { getUiLangFromReq } from '../../services/localeContext.js';
import { sendEmail } from '../../services/mailgunService.js';
import { buildPasswordResetEmail } from '../../services/emailTemplates/passwordReset.js';
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCodes } from '../../services/recoveryCodes.js';
import { generateTotpSecret, makeOtpAuthUrl, verifyTotp } from '../../services/totp.js';
import {
  authenticateRequest,
  createAuthSession,
  revokeAuthSessionForRequest,
  revokeAuthSessionsForUser
} from '../../services/authSessions.js';

const router = Router();

function isRememberMeEnabled(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

const useAuthAPI = (app) => {
  app.use('/api/v1/auth', router);

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
      const user = await User.findOne({
        $or: [
          { email: username },
          { username },
        ],
      });

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

      if (user.twoFactorEnabled) {
        const validTotp = verifyTotp({ secret: user.twoFactorSecret, token: req.body.totpCode });
        const validRecoveryCode = validTotp ? false : await consumeRecoveryCode(user, req.body.totpCode);

        if (!validTotp && !validRecoveryCode) {
          return res.status(200).json({ requiresTwoFactor: true });
        }
      }

      await createAuthSession({
        user,
        rememberMe: isRememberMeEnabled(req.body.rememberMe),
        req,
        res,
      });

      res.status(200).json({ message: 'Login successful!' });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  router.post('/logout', async (req, res) => {
    await revokeAuthSessionForRequest(req, res);
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

      const uiLang = getUiLangFromReq(req);
      const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/${uiLang}/reset-password?token=${encodeURIComponent(token)}`;

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
      user.twoFactorPendingSecret = null;
      user.twoFactorPendingSecretExpires = null;
      await user.save();
      await revokeAuthSessionsForUser(user._id);

      return res.status(200).json({ ok: true, code: 'RESET_OK' });
    } catch (error) {
      console.error('Error resetting password:', error);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
    }
  });

  router.get('/me', noCache, async (req, res) => {
    try {
      const auth = await authenticateRequest(req, res);
      if (!auth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      res.status(200).json({
        id: auth.user.id,
        username: auth.user.username,
        email: auth.user.email,
        profilePic: auth.user.profilePic
      });
    } catch (error) {
      console.error('Error fetching authenticated user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, code: 'MISSING_FIELDS' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ ok: false, code: 'PASSWORD_TOO_SHORT' });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ ok: false, code: 'NOT_AUTHENTICATED' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ ok: false, code: 'INVALID_CURRENT_PASSWORD' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      user.twoFactorPendingSecret = null;
      user.twoFactorPendingSecretExpires = null;
      user.updatedAt = new Date();
      await user.save();
      await revokeAuthSessionsForUser(user._id, { exceptSessionId: req.authSession?._id });

      return res.status(200).json({ ok: true, code: 'PASSWORD_CHANGED' });
    } catch (error) {
      console.error('Error changing password:', error);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
    }
  });

  router.post('/2fa/setup', isAuthenticated, async (req, res) => {
    const { currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ ok: false, code: 'MISSING_CURRENT_PASSWORD' });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ ok: false, code: 'NOT_AUTHENTICATED' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ ok: false, code: 'INVALID_CURRENT_PASSWORD' });
      }

      const secret = generateTotpSecret();
      const otpAuthUrl = makeOtpAuthUrl({
        secret,
        accountName: user.email || user.username,
      });
      const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 240,
      });

      user.twoFactorPendingSecret = secret;
      user.twoFactorPendingSecretExpires = new Date(Date.now() + 10 * 60 * 1000);
      user.updatedAt = new Date();
      await user.save();

      return res.status(200).json({
        ok: true,
        code: 'TWO_FACTOR_SETUP_READY',
        qrDataUrl,
        manualKey: secret,
      });
    } catch (error) {
      console.error('Error starting two-factor setup:', error);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
    }
  });

  router.post('/2fa/enable', isAuthenticated, async (req, res) => {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ ok: false, code: 'MISSING_CODE' });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ ok: false, code: 'NOT_AUTHENTICATED' });
      }

      if (!user.twoFactorPendingSecret) {
        return res.status(400).json({ ok: false, code: 'NO_PENDING_SETUP' });
      }

      if (!user.twoFactorPendingSecretExpires || user.twoFactorPendingSecretExpires <= new Date()) {
        user.twoFactorPendingSecret = null;
        user.twoFactorPendingSecretExpires = null;
        await user.save();
        return res.status(400).json({ ok: false, code: 'SETUP_EXPIRED' });
      }

      if (!verifyTotp({ secret: user.twoFactorPendingSecret, token: code })) {
        return res.status(400).json({ ok: false, code: 'INVALID_CODE' });
      }

      user.twoFactorEnabled = true;
      user.twoFactorSecret = user.twoFactorPendingSecret;
      user.twoFactorPendingSecret = null;
      user.twoFactorPendingSecretExpires = null;
      const recoveryCodes = generateRecoveryCodes();
      user.twoFactorRecoveryCodes = await hashRecoveryCodes(recoveryCodes);
      user.updatedAt = new Date();
      await user.save();
      await revokeAuthSessionsForUser(user._id, { exceptSessionId: req.authSession?._id });

      return res.status(200).json({ ok: true, code: 'TWO_FACTOR_ENABLED', recoveryCodes });
    } catch (error) {
      console.error('Error enabling two-factor authentication:', error);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
    }
  });

  router.post('/2fa/disable', isAuthenticated, async (req, res) => {
    const { currentPassword, code } = req.body;

    if (!currentPassword || !code) {
      return res.status(400).json({ ok: false, code: 'MISSING_FIELDS' });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ ok: false, code: 'NOT_AUTHENTICATED' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ ok: false, code: 'INVALID_CURRENT_PASSWORD' });
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ ok: false, code: 'TWO_FACTOR_NOT_ENABLED' });
      }

      if (!verifyTotp({ secret: user.twoFactorSecret, token: code })) {
        return res.status(400).json({ ok: false, code: 'INVALID_CODE' });
      }

      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorPendingSecret = null;
      user.twoFactorPendingSecretExpires = null;
      user.twoFactorRecoveryCodes = [];
      user.updatedAt = new Date();
      await user.save();
      await revokeAuthSessionsForUser(user._id, { exceptSessionId: req.authSession?._id });

      return res.status(200).json({ ok: true, code: 'TWO_FACTOR_DISABLED' });
    } catch (error) {
      console.error('Error disabling two-factor authentication:', error);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
    }
  });

  router.post('/2fa/recovery-codes', isAuthenticated, async (req, res) => {
    const { currentPassword, code } = req.body;

    if (!currentPassword || !code) {
      return res.status(400).json({ ok: false, code: 'MISSING_FIELDS' });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ ok: false, code: 'NOT_AUTHENTICATED' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ ok: false, code: 'INVALID_CURRENT_PASSWORD' });
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ ok: false, code: 'TWO_FACTOR_NOT_ENABLED' });
      }

      if (!verifyTotp({ secret: user.twoFactorSecret, token: code })) {
        return res.status(400).json({ ok: false, code: 'INVALID_CODE' });
      }

      const recoveryCodes = generateRecoveryCodes();
      user.twoFactorRecoveryCodes = await hashRecoveryCodes(recoveryCodes);
      user.updatedAt = new Date();
      await user.save();

      return res.status(200).json({ ok: true, code: 'RECOVERY_CODES_REGENERATED', recoveryCodes });
    } catch (error) {
      console.error('Error regenerating two-factor recovery codes:', error);
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR' });
    }
  });
};

export default useAuthAPI;
