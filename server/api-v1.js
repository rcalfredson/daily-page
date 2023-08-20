import { Router } from 'express';
import * as helpers from './api-v1-helpers.js';

const router = Router();

const useAPIV1 = (app, mongo) => {
  helpers.init(mongo);
  app.use('/api/v1', router);

  router.get('/page/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', helpers.authenticate, helpers.sendPage);

  router.get('/page/:room/:date*?', helpers.authenticate, helpers.sendPage);

  router.get('/pageDates/:year([0-9]{4})/:month(1[0-2]|(0?[1-9]))', helpers.authenticate, helpers.pageDatesForYearMonthCombo);

  router.get('/pageDates', helpers.authenticate, helpers.allYearMonthCombos);

  router.post('/page/:room', helpers.authenticate, helpers.updatePageForRoom);

  router.get('/peers*?', helpers.authenticate, helpers.peersForRoom);

  router.delete('/peers/:room/:id', helpers.authenticate, helpers.removePeerFromRoom);

  router.post('/peers/:room/:id', helpers.authenticate, helpers.addPeerToRoom);
};

export default useAPIV1;
