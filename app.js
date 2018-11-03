const express = require('express');
const useAPIV1 = require('./server/api-v1');
const jwtHelper = require('./server/jwt-helper');
const mongo = require('./server/mongo');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;
const backendURL = process.env.BACKEND_URL || `http://localhost:${port}`;

app.use(express.static('public'));
app.use(bodyParser.json());
app.set('views', './views');
app.set('view engine', 'pug');
useAPIV1(app);

app.get('/', async (req, res) => {
  let peerIDs = await mongo.peerIDs();
  if (Object.keys(req.query).length != 0 || peerIDs.length == 0) {
    res.render('index', {title: 'Conclave',
      backendURL,
      sessionID: jwtHelper.expiringKey()});
    return;
  }
  res.redirect(`/?${peerIDs[Math.floor(Math.random() * peerIDs.length)]}`);
});

app.post('/peers/:id', async (req, res) => {
  try {
    jwtHelper.verifyReq(req);
  } catch (error) {
    res.sendStatus(403);
    return;
  }
  try {
    await mongo.addPeer(req.params.id);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({error: error.message});
  }
});

app.delete('/peers/:id', async (req, res) => {
  try {
    jwtHelper.verifyReq(req);
  } catch (error) {
    res.sendStatus(403);
    return;
  }
  try {
    await mongo.removePeer(req.params.id);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({error: error.message});
  }
});

app.get('/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', async (req, res) => {
  var content;

  try {
    content = (await mongo.getPage(req.params.date)).replace(/\n/g, '<br>');
  } catch (error) {
    res.status(404).send('We cannot find that page.');
  }
  res.send(content);
});

var srv = app.listen(port, function() {
	console.log('Listening on '+port)
})

app.use('/peerjs', require('peer').ExpressPeerServer(srv, {
	debug: true
}))
