import { Router } from 'express';
import bcrypt from 'bcrypt';
import {
  findUserByEmail, findUserById, findUserByUsername
} from '../../db/userService.js';
import { verifyJWT } from '../../services/jwt.js';
import { makeUserJWT } from '../../utils/jwtHelper.js';

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
    res.clearCookie('auth_token');
    res.status(200).json({ message: 'Logged out successfully!' });
  });

  router.get('/me', (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const userData = verifyJWT(token);
      findUserById(userData.id)
        .then((user) => {
          if (!user) {
            return res.status(404).json({ error: 'User not found' });
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
