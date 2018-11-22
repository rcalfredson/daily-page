const express = require('express');
const bodyParser = require('body-parser');
const peerServer = require('peer');
const dateHelper = require('./build/dateHelper');
const useAPIV1 = require('./server/api-v1');
const cache = require('./server/cache');
const jwtHelper = require('./server/jwt-helper');
const viewHelper = require('./server/view-helper');
const mongo = require('./server/mongo');

const app = express();
const port = process.env.PORT || 3000;
const backendURL = `${(process.env.BACKEND_URL || `http://localhost:${port}`)}/api/v1`;

(async () => {
  const dateParam = ':date([0-9]{4}-[0-9]{2}-[0-9]{2})';

  try {
    await mongo.initConnection();
    app.use(express.static('public'));
    app.use(bodyParser.json());
    app.set('views', './views');
    app.set('view engine', 'pug');
    useAPIV1(app, mongo);

    const srv = app.listen(port, () => {
      console.log(`Listening on ${port}`); // eslint-disable-line no-console
    });

    app.use('/peerjs', peerServer.ExpressPeerServer(srv, {
      debug: true,
    }));

    app.get('/archive', (_, res) => {
      res.render('archive', {
        title: 'Archive',
        backendURL,
        sessionID: jwtHelper.expiringKey(),
      });
    });

    app.get('/today', (_, res) => {
      res.redirect(`/${dateHelper.currentDate()}`);
    });

    app.get('/:year([0-9]{4})/:month(1[0-2]|[1-9])', (req, res) => {
      const { year, month } = req.params;

      res.render('yearMonth', {
        title: `Daily Pages for ${dateHelper.monthName(month)} ${year}`,
        year,
        month,
        backendURL,
        sessionID: jwtHelper.expiringKey(),
      });
    });

    app.get(`/${dateParam}`, (req, res) => {
      res.render('archivedPage', {
        title: `Daily Page for ${req.params.date}`,
        backendURL,
        sessionID: jwtHelper.expiringKey(),
      });
    });

    app.get(`/:room([a-zA-Z]+)/${dateParam}`, (req, res) => {
      const roomReq = req.params.room;

      res.render('archivedPage', {
        title: `Daily Page for ${req.params.date} - ${viewHelper.capitalize(roomReq)} Room`,
        backendURL,
        room: roomReq,
        sessionID: jwtHelper.expiringKey(),
      });
    });

    app.get('/about', (_, res) => res.render('about', { title: 'Daily Page - About' }));

    app.get('/:room*?', async (req, res) => {
      const maxCapacity = 6;
      const roomReq = req.params.room;
      const rooms = await cache.get('rooms', mongo.rooms);
      const peerIDs = (await cache.get('peerIDs', mongo.peerIDs));
      const roomsVacant = rooms.filter(room => peerIDs[room].length < maxCapacity)
        .sort((roomA, roomB) => peerIDs[roomB].length - peerIDs[roomA].length);

      if (roomReq && !rooms.includes(roomReq)) {
        res.redirect('/');
        return;
      }

      if (roomsVacant.length === 0) {
        res.render('fullCapacity', {
          title: 'Daily Page - At Full Capacity!'
        });
        return;
      }

      if (!roomReq) {
        res.redirect(`/${roomsVacant[0]}`);
        return;
      }

      if (peerIDs[roomReq].length >= 6) {
        res.send('too many people in the room.');
        return;
      }
      if (Object.keys(req.query).length !== 0 || peerIDs[roomReq].length === 0) {
        const date = dateHelper.currentDate('long');

        res.render('index', {
          title: 'Daily Page',
          date,
          room: roomReq,
          header: `${date} - ${viewHelper.capitalize(roomReq)} Room.`,
          backendURL,
          sessionID: jwtHelper.expiringKey(),
        });
        return;
      }
      res.redirect(`/${roomReq}?${peerIDs[roomReq][Math.floor(Math.random() * peerIDs[roomReq].length)]}`);
    });
  } catch (error) {
    console.log(`Server startup failed: ${error.message}`); // eslint-disable-line no-console
  }
})();
