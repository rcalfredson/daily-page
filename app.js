const express = require('express');
const bodyParser = require('body-parser');
const peerServer = require('peer');
const dateHelper = require('./build/dateHelper');
const useAPIV1 = require('./server/api-v1');
const cache = require('./server/cache');
const jwtHelper = require('./server/jwt-helper');
const mongo = require('./server/mongo');

const app = express();
const port = process.env.PORT || 3000;
const backendURL = `${(process.env.BACKEND_URL || `http://localhost:${port}`)}/api/v1`;

(async () => {
  try {
    await mongo.initConnection();
    app.use(express.static('public'));
    app.use(bodyParser.json());
    app.set('views', './views');
    app.set('view engine', 'pug');
    useAPIV1(app, mongo);

    app.get('/', async (req, res) => {
      const peerIDs = await cache.get('peerIDs', mongo.peerIDs);
      if (Object.keys(req.query).length !== 0 || peerIDs.length === 0) {
        res.render('index', {
          title: 'Daily Page',
          date: dateHelper.currentDate('long'),
          backendURL,
          sessionID: jwtHelper.expiringKey(),
        });
        return;
      }
      res.redirect(`/?${peerIDs[Math.floor(Math.random() * peerIDs.length)]}`);
    });

    app.get('/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', async (req, res) => {
      res.render('archivedPage', {
        title: `Daily Page for ${req.params.date}`,
        backendURL,
        sessionID: jwtHelper.expiringKey(),
      });
    });

    app.get('/about', (_, res) => res.render('about', { title: 'Daily Page - About' }));

    const srv = app.listen(port, () => {
      console.log(`Listening on ${port}`); // eslint-disable-line no-console
    });

    app.use('/peerjs', peerServer.ExpressPeerServer(srv, {
      debug: true,
    }));
  } catch (error) {
    console.log(`Server startup failed: ${error.message}`); // eslint-disable-line no-console
  }
})();
