const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const peerServer = require('peer');
const stream = require('stream');
const dateHelper = require('./build/dateHelper');
const useAPIV1 = require('./server/api-v1');
const cache = require('./server/cache');
const jwtHelper = require('./server/jwt-helper');
const viewHelper = require('./server/view-helper');
const mongo = require('./server/mongo');
const google = require('./server/google');

const app = express();
const port = process.env.PORT || 3000;
const backendURL = `${(process.env.BACKEND_URL || `http://localhost:${port}`)}/api/v1`;

(async () => {
  const dateParam = ':date([0-9]{4}-[0-9]{2}-[0-9]{2})';

  try {
    await mongo.initConnection();
    google.init(mongo);
    const whitelist = ['https://dailypage.org', 'http://localhost:3000'];
    const corsOptions = {
      origin: (origin, callback) => {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    };
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    if (process.env.NODE_ENV === 'production') {
      app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
          res.redirect(`https://${req.headers.host}${req.path}`);
        } else {
          next();
        }
      });
    }
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

    app.get('/archive', async (_, res) => {
      const combos = await cache.get('monthYearCombos', mongo.getPageMonthYearCombos);

      res.render('archive', {
        combos,
        title: 'Archive',
      });
    });

    app.get('/random', (_, res) => {
      res.render('randomWriter', { title: 'Random Writer' });
    });

    app.get('/baseball', async (_, res) => {
      const docTitles = await google.docTitles();
      const sortable = [];
      Object.keys(docTitles).forEach((title) => sortable.push([title, docTitles[title]]));
      sortable.sort((a, b) => {
        if (a[1] > b[1]) { return -1; }
        if (b[1] > a[1]) { return 1; }
        return 0;
      });
      const firstNumericElement = sortable.findIndex((el) => !Number.isNaN(parseInt(el[1], 10)));
      const generalSortable = sortable.slice(0, firstNumericElement);
      generalSortable.sort((a, b) => {
        if (a[1] > b[1]) { return 1; }
        if (b[1] > a[1]) { return -1; }
        return 0;
      });
      const dateSortable = sortable.slice(firstNumericElement, sortable.length);
      dateSortable.sort((a, b) => {
        const date1 = Date.parse(a[1]);
        const date2 = Date.parse(b[1]);
        if (date1 > date2) { return -1; }
        if (date2 > date1) { return 1; }
        return 0;
      });
      const titlesWithHeaders = {
        'General notes': generalSortable,
        'Daily notes': dateSortable,
      };
      res.render('linkList', {
        basePath: '/baseball',
        header: "Robert's Miscellaneous Baseball Notes",
        titlesWithHeaders,
      });
    });

    app.get('/baseball/:docID', async (req, res) => {
      res.send(await google.docText(req.params.docID));
    });

    app.get('/stream/:fileID', (req, res) => {
      res.render('audioPlayer', {
        host: req.headers.host,
        fileID: req.params.fileID
      });
    });

    app.get('/audio/:fileID', async (req, res) => {
      let buffer = await cache.get(req.params.fileID, google.wavFromText, [req.params.fileID], 5 * 60 * 1000);
      let total = buffer.byteLength;
      if (req.headers.range) {
              const range = req.headers.range;
              const parts = range.replace(/bytes=/, '').split('-');
              const partialStart = parts[0];
              const partialEnd = parts[1];
  
              const start = parseInt(partialStart, 10);
              const end = partialEnd ? parseInt(partialEnd, 10) : total - 1;
              const chunksize = (end - start) + 1;
              var readStream = new stream.PassThrough();
              readStream.end(buffer);
  
              res.writeHead(206, {
                  'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                  'Accept-Ranges': 'bytes', 'Content-Length': chunksize,
                  'Content-Type': 'audio/wav'
              });
              readStream.pipe(res);
            } else {
              var readStream = new stream.PassThrough();
              readStream.end(buffer);
              res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'audio/wav' });
              readStream.pipe(res);
            }
  });

    app.get('/today', (_, res) => {
      res.redirect(`/${dateHelper.currentDate()}`);
    });

    app.get('/:year([0-9]{4})/:month(1[0-2]|(0?[1-9]))', async (req, res) => {
      const { year, month } = req.params;
      const formattedTime = `${dateHelper.monthName(month)} ${year}`;
      const dates = await cache.get(`${year}-${month}`, mongo.getPageDatesByYearAndMonth, [year, month]);

      res.render('yearMonth', {
        title: `Daily Pages for ${formattedTime}`,
        header: formattedTime,
        dates,
      });
    });

    app.get(`/${dateParam}`, async (req, res) => {
      const formattedTime = dateHelper.formatDate(req.params.date, 'long');
      const pageData = await cache.get(req.params.date, mongo.getPage,
        [req.params.date, req.params.room, req.query]);

      const [errorMessage, text] = viewHelper.archiveContent(pageData);

      res.render('archivedPage', {
        title: `Daily Page for ${formattedTime}`,
        header: formattedTime,
        errorMessage,
        text,
      });
    });

    app.get(`/:room([a-zA-Z]+)/${dateParam}`, async (req, res) => {
      const roomReq = req.params.room;
      const dateAndRoom = `${dateHelper.formatDate(req.params.date, 'long')} - ${viewHelper.capitalize(roomReq)} Room`;
      const pageData = await cache.get(req.params.date, mongo.getPage,
        [req.params.date, roomReq, req.query]);

      const [errorMessage, text] = viewHelper.archiveContent(pageData);

      res.render('archivedPage', {
        title: `Daily Page for ${dateAndRoom}`,
        header: dateAndRoom,
        errorMessage,
        text,
      });
    });

    app.get('/support', (_, res) => res.render('support', { title: 'Daily Page - Support' }));

    app.get('/about', (_, res) => res.render('about', { title: 'Daily Page - About' }));

    app.get('/:room*?', async (req, res) => {
      const maxCapacity = 6;
      const roomReq = req.params.room;
      const rooms = await cache.get('rooms', mongo.rooms);
      const peerIDs = (await cache.get('peerIDs', mongo.peerIDs));
      const roomsVacant = rooms.filter((room) => peerIDs[room].length < maxCapacity)
        .sort((roomA, roomB) => peerIDs[roomB].length - peerIDs[roomA].length);

      if (roomReq && !rooms.includes(roomReq)) {
        res.redirect('/');
        return;
      }

      if (roomsVacant.length === 0) {
        res.render('fullCapacity', {
          title: 'Daily Page - At Full Capacity!',
        });
        return;
      }

      if (!roomReq) {
        res.redirect(`/${peerIDs[roomsVacant[0]].length !== peerIDs[roomsVacant[roomsVacant.length - 1]].length ? roomsVacant[0]
          : roomsVacant[Math.floor(Math.random() * roomsVacant.length)]}`);
        return;
      }

      if (peerIDs[roomReq].length >= 6) {
        res.render('fullRoom', {
          room: viewHelper.capitalize(roomReq),
        });
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
