import { Router } from 'express';
import {
  getPeerIDs,
  addPeer,
  removePeer
} from '../../db/sessionService.js';

const router = Router();

const usePeersAPI = (app) => {
  app.use('/api/v1', router);

  // 📌 Get peers working on a specific block
  router.get('/blocks/:block_id/peers', async (req, res) => {
    const { block_id } = req.params;
    try {
      const peers = await getPeerIDs(block_id);
      res.status(200).json(peers);
    } catch (error) {
      console.error('Error fetching peers for block:', error.message);
      res.status(500).json({ error: 'Failed to fetch peers for block.' });
    }
  });

  // 📌 Add a peer to a block
  router.post('/blocks/:block_id/peers/:peer_id', async (req, res) => {
    const { block_id, peer_id } = req.params;
    const { room_id } = req.body; // Room ID must be included in the request

    if (!room_id) {
      return res.status(400).json({ error: 'room_id is required.' });
    }

    try {
      await addPeer(peer_id, block_id, room_id);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error adding peer to block:', error.message);
      res.status(500).json({ error: 'Failed to add peer to block.' });
    }
  });

  // 📌 Remove a peer from a block
  router.delete('/blocks/:block_id/peers/:peer_id', async (req, res) => {
    const { block_id, peer_id } = req.params;

    try {
      await removePeer(peer_id, block_id);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error removing peer from block:', error.message);
      res.status(500).json({ error: 'Failed to remove peer from block.' });
    }
  });
};

export default usePeersAPI;
