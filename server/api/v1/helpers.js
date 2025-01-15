import * as cache from '../../services/cache.js';

let mongo;

export async function addPeerToRoom(req, res) {
  try {
    await mongo.addPeer(req.params.id, req.params.room);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

export async function allYearMonthCombos(_, res) {
  try {
    res.send(JSON.stringify(await cache.get('monthYearCombos', mongo.getPageMonthYearCombos)));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

export function init(mongoConnection) {
  mongo = mongoConnection;
}

export function joinWithHyphens(params, keysToCheck) {
  let output = '';
  keysToCheck.forEach((k, i) => {
    let suffix = '';
    if (i + i < keysToCheck.length) {
      suffix = '-';
    }
    output += `${params[k] ? `${params[k]}${suffix}` : ''}`;
  });
  return output;
}

export async function sendPage(req, res) {
  try {
    res.send(JSON.stringify(await cache.get(
      joinWithHyphens(req.params, ['date', 'room']), mongo.getPage,
      [req.params.date, req.params.room, req.query],
    )));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

export async function pageDatesForYearMonthCombo(req, res) {
  const { year, month } = req.params;

  try {
    res.send(JSON.stringify(await cache.get(`${year}-${month}`, mongo.getPageDatesByYearAndMonth,
      [year, month])));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

export async function peersForRoom(req, res) {
  try {
    res.send(JSON.stringify(await mongo.peerIDs(req.query.room)));
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

export async function removePeerFromRoom(req, res) {
  try {
    await mongo.removePeer(req.params.id, req.params.room);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}

export async function updatePageForRoom(req, res) {
  try {
    await mongo.updatePage(req.body.content, req.params.room);
    res.json({ updated: new Date().getTime() });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
}
