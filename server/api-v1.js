const router = require('express').Router();
const cache = require('./cache');
const jwtHelper = require('./jwt-helper');

module.exports = (app, mongo) => {
  app.use('/api/v1', router);

  function authenticate(req, res, next) {
    try {
      jwtHelper.verifyReq(req);
      next();
    } catch (error) {
      res.sendStatus(403);
    }
  }

  async function sendPage(req, res) {
    try {
      res.send(JSON.stringify(await cache.get(req.params.date, mongo.getPage,
        [req.params.date, req.params.room])));
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  }

  router.get('/page/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', authenticate, sendPage);

  router.get('/page/:room/:date*?', authenticate, sendPage);

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
