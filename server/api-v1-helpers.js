const cache = require('./cache');
const jwtHelper = require('./jwt-helper');

let mongo;

async function addPeerToRoom(req, res) {
  try {
    await mongo.addPeer(req.params.id, req.params.room);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

async function allYearMonthCombos(_, res) {
  try {
    res.send(JSON.stringify(await cache.get('monthYearCombos', mongo.getPageMonthYearCombos)));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

function authenticate(req, res, next) {
  try {
    jwtHelper.verifyReq(req);
    next();
  } catch (error) {
    res.sendStatus(403);
  }
}

function init(mongoConnection) {
  mongo = mongoConnection;
}

async function sendPage(req, res) {
  try {
    res.send(JSON.stringify(await cache.get(req.params.date, mongo.getPage,
      [req.params.date, req.params.room, req.query])));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

async function pageDatesForYearMonthCombo(req, res) {
  const { year, month } = req.params;

  try {
    res.send(JSON.stringify(await cache.get(`${year}-${month}`, mongo.getPageDatesByYearAndMonth,
      [year, month])));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

async function peersForRoom(req, res) {
  try {
    res.send(JSON.stringify(await mongo.peerIDs(req.params.room)));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

async function removePeerFromRoom(req, res) {
  try {
    await mongo.removePeer(req.params.id, req.params.room);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

async function updatePageForRoom(req, res) {
  try {
    await mongo.updatePage(req.body.content, req.params.room);
    res.json({ updated: new Date().getTime() });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

module.exports = {
  addPeerToRoom,
  allYearMonthCombos,
  authenticate,
  init,
  pageDatesForYearMonthCombo,
  peersForRoom,
  removePeerFromRoom,
  sendPage,
  updatePageForRoom,
};
