import { Router } from 'express';
import * as helpers from './helpers.js';

const router = Router();

const useAPIV1 = (app, mongo) => {
  helpers.init(mongo);
  app.use('/api/v1', router);

  // Public Endpoints (no authentication required)
  router.get('/page/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', helpers.sendPage); // View content by date
  router.get('/page/:room/:date*?', helpers.sendPage); // View room content by date
  router.get('/pageDates/:year([0-9]{4})/:month(1[0-2]|(0?[1-9]))', helpers.pageDatesForYearMonthCombo); // View available content dates
  router.get('/pageDates', helpers.allYearMonthCombos); // View all content dates
  router.get('/peers*?', helpers.peersForRoom); // View peers in a room

  // Protected Endpoints (requires logged-in user)
  router.post('/page/:room', helpers.updatePageForRoom); // Update content
  router.delete('/peers/:room/:id', helpers.removePeerFromRoom); // Remove peer
  router.post('/peers/:room/:id', helpers.addPeerToRoom); // Add peer
};

export default useAPIV1;
