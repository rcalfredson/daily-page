const express = require('express');
const bodyParser = require('body-parser');
const useAPIV1 = require('./server/api-v1');
const cache = require('./server/cache');
const jwtHelper = require('./server/jwt-helper');
const mongo = require('./server/mongo');

const app = express();
const port = process.env.PORT || 3000;
const backendURL = process.env.BACKEND_URL || `http://localhost:${port}`;

app.use(express.static('public'));
app.use(bodyParser.json());
app.set('views', './views');
app.set('view engine', 'pug');
useAPIV1(app);

app.get('/', async (req, res) => {
  const peerIDs = await cache.get('peerIDs', mongo.peerIDs);
  if (Object.keys(req.query).length !== 0 || peerIDs.length === 0) {
    res.render('index', {
      title: 'Conclave',
      backendURL,
      sessionID: jwtHelper.expiringKey(),
    });
    return;
  }
  res.redirect(`/?${peerIDs[Math.floor(Math.random() * peerIDs.length)]}`);
});

app.get('/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', async (req, res) => {
  let content;

  try {
    content = (await mongo.getPage(req.params.date)).replace(/\n/g, '<br>');
  } catch (error) {
    res.status(404).send('We cannot find that page.');
  }
  res.send(content);
});

const srv = app.listen(port, () => {
  console.log(`Listening on ${port}`); // eslint-disable-line no-console
});

app.use('/peerjs', require('peer').ExpressPeerServer(srv, {
  debug: true,
}));
