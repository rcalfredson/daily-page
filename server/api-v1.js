const router = require('express').Router();
const jwtHelper = require('./jwt-helper');
const mongo = require('./mongo');

function authenticate(req, res, next) {
  try {
    jwtHelper.verifyReq(req);
    next();
  } catch (error) {
    res.sendStatus(403);
  }
}

module.exports = (app) => {
  app.use('/api/v1', router);

  router.get('/page/:date*?', authenticate, async (req, res) => {
    try {
      res.send({ content: await mongo.getPage(req.params.date) });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.post('/page', authenticate, async (req, res) => {
    try {
      await mongo.updatePage(req.body.content);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.get('/peers', authenticate, async (req, res) => {
    try {
      res.send({ ids: await mongo.peerIDs() });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.delete('/peers/:id', authenticate, async (req, res) => {
    try {
      await mongo.removePeer(req.params.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  router.post('/peers/:id', authenticate, async (req, res) => {
    try {
      await mongo.addPeer(req.params.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
};
