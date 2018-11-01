const express = require('express');
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

app.post('/updatePage', async (req, res) => {
  try {
    jwtHelper.verifyReq(req);
  } catch (error) {
    res.sendStatus(403);
    return;
  }
  try {
    await mongo.updatePage(req.body.content);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send({error: error.message});
  }
});

app.get('/peers', async (req, res) => {
  try {
    jwtHelper.verifyReq(req);
  } catch (error) {
    res.sendStatus(403);
    return;
  }

  try {
    res.send({ids: await mongo.peerIDs()});
  } catch (error) {
    res.status(500).send({error: error.message});
  }
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

app.get('/about', function (req, res) {
  res.render('about', {title: 'About'});
});

app.get('/bots', function(req, res) {
  res.render('bots', {title: 'Talk to Bots'});
});

app.get('/idLength', function (req, res) {
  res.render('idGraph');
});

app.get('/opTime', function (req, res) {
  res.render('timeGraph');
})

app.get('/arraysGraph', function (req, res) {
  res.render('arraysGraph');
})

var srv = app.listen(port, function() {
	console.log('Listening on '+port)
})

app.use('/peerjs', require('peer').ExpressPeerServer(srv, {
	debug: true
}))
