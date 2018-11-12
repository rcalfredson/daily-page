const router = require('express').Router();
const cache = require('./cache');
const jwtHelper = require('./jwt-helper');

function authenticate(req, res, next) {
  try {
    jwtHelper.verifyReq(req);
    next();
  } catch (error) {
    res.sendStatus(403);
  }
}

module.exports = (app, mongo) => {
  app.use('/api/v1', router);

  router.get('/page/:room/:date*?', authenticate, async (req, res) => {
    try {
      res.send(JSON.stringify(await cache.get(req.params.date, mongo.getPage,
        [req.params.date, req.params.room])));
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.post('/page/:room', authenticate, async (req, res) => {
    try {
      await mongo.updatePage(req.body.content, req.params.room);
      res.json({ updated: new Date().getTime() });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.get('/peers/:room*?', authenticate, async (req, res) => {
    try {
      res.send(JSON.stringify(await mongo.peerIDs(req.params.room)));
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.delete('/peers/:room/:id', authenticate, async (req, res) => {
    try {
      await mongo.removePeer(req.params.id, req.params.room);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.post('/peers/:room/:id', authenticate, async (req, res) => {
    try {
      await mongo.addPeer(req.params.id, req.params.room);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
};
