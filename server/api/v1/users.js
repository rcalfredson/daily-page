import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createUser, findUserByEmail, findUserByUsername, findUserById, updateUserProfile } from '../../db/user.js';

const router = Router();

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

  // Update user profile
  router.put('/:userId', async (req, res) => {
    const { userId } = req.params;
    const updates = req.body;

    try {
      const result = await updateUserProfile(userId, updates);
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
      console.error(`Error updating user profile for ID: ${userId}`, error.message);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });
};

export default useUserAPI;
