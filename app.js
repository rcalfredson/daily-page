import stream from 'stream';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createServer } from 'http';
import { ExpressPeerServer } from 'peer';
import axios from 'axios';
import DateHelper from './lib/dateHelper.js';
import * as encodeHelper from './lib/encodeHelper.js';

import useAPIV1 from './server/api/v1/index.js'; // Main API
import useRoomAPI from './server/api/v1/rooms.js'; // Room-specific API

import { getFeaturedContent } from './server/services/featuredContent.js'; // Services

import roomRoute from './server/routes/rooms.js'; // Routes

import { handleRoomRequest } from './server/services/roomRequests.js';
import * as cache from './server/services/cache.js';
import * as jwtHelper from './server/services/jwt.js';
import localizationMiddleware from './server/services/localization.js';
import { startJobs } from './server/services/cron.js';
import * as google from './server/services/google.js';

import * as viewHelper from './server/utils/view.js'; // Utils

import * as mongo from './server/db/mongo.js'; // Database

startJobs();

const app = express();
const port = process.env.PORT || 3000;
const audioHost = 'https://ipod.dailypage.org';
const backendBaseUrl = `${(process.env.BACKEND_URL || `http://localhost:${port}`)}`;
const backendApiUrl = `${backendBaseUrl}/api/v1`;
const ROOM_BASED_CUTOFF = new Date('2024-12-31');

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
    app.use(localizationMiddleware);
    app.options('*', cors(corsOptions));

    if (process.env.NODE_ENV === 'production') {
      app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
          // res.redirect(`https://${req.headers.host}${req.path}`);
          next();
        } else {
          next();
        }
      });
    }

    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.set('views', './views');
    app.set('view engine', 'pug');

    useAPIV1(app, mongo);
    useRoomAPI(app);
    app.use('/', roomRoute);

    const server = createServer(app)

    const peerServer = ExpressPeerServer(server, {
      debug: true,
    });

    app.use('/peerjs', peerServer);

    server.listen(port, () => {
      console.log(`Listening on port ${port}`);
    });

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
      const docTitles = await google.getDocTitles();
      const sortable = [];
      Object.keys(docTitles).forEach((slug) => sortable.push([slug, docTitles[slug].name]));
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
        basePaths: '/baseball',
        title: "Robert's Miscellaneous Baseball Notes",
        titlesWithHeaders,
      });
    });

    app.get('/baseball/:pageId', async (req, res) => {
      res.send(await google.docText(req.params.pageId));
    });

    app.get('/iPod/:gen?', async (req, res) => {
      res.render('iPod', {
        backendURL: audioHost,
        version: req.params.gen || '1g',
      });
    });

    app.get('/music', async (req, res) => {
      res.render('linkList', {
        basePaths: ['/artist', '/album'],
        title: 'Music',
        titlesWithHeaders: { Artists: [], Albums: [] },
      });
    });

    app.get('/music/meta/artist/:artistID', async (req, res) => {
      const albumIDs = await google.getAlbumIDsByArtist(req.params.artistID);
      const { Albums } = await cache.get('albums', google.getAlbums, [], 40 * 1000);
      res.send(albumIDs.map((albumID) => Albums.find(
        (el) => el[0] === albumID,
      )));
    });

    app.get('/artist/:artistID', async (req, res) => {
      const artistName = req.params.artistID;
      let albums = JSON.parse((await axios.get(`${audioHost}/meta/music/artist/${artistName}/albums`)).body);
      albums = albums.map((album) => [encodeHelper.htmlString(album), album]);

      res.render('linkList', {
        basePaths: `/artist/${artistName}/album`,
        title: '← Music',
        titleLink: '/music',
        titlesWithHeaders: {
          [artistName]: albums,
        },
      });
    });

    app.get('/album', async (req, res) => {
      res.render('linkList', {
        basePaths: '/album',
        title: '← Music',
        titleLink: '/music',
        titlesWithHeaders: await cache.get('albums', google.getAlbums, [], 40 * 1000),
      });
    });

    app.get('/artist', async (req, res) => {
      let artistRes = JSON.parse((await axios.get(`${audioHost}/meta/music/artists`)).body);
      artistRes = artistRes.map((artist) => [encodeHelper.htmlString(artist), artist]);
      res.render('linkList', {
        basePaths: '/artist',
        title: '← Music',
        titleLink: '/music',
        titlesWithHeaders: { Artists: artistRes },
      });
    });

    app.get('/music/meta/artist', async (req, res) => {
      res.send(await cache.get('artists', google.getArtists, [], 40 * 1000));
    });

    app.get('/music/meta/album', async (req, res) => {
      res.send(await cache.get('albums', google.getAlbums, [], 40 * 1000));
    });

    app.get('/music/meta/song', async (req, res) => {
      res.send(await cache.get('songs', google.getSongs, [], 40 * 1000));
    });

    app.get('/music/meta/album/:albumID', async (req, res) => {
      res.send({
        albumArtist: await google.getArtist(req.params.albumID),
        tracks: await cache.get(req.params.albumID, google.getTracks, [req.params.albumID],
          2 * 60 * 1000),
      });
    });

    app.get('/artist/:artistID/album/:albumID/:trackID', async (req, res) => {
      const albumName = req.params.albumID;
      const artist = req.params.artistID;
      const trackList = JSON.parse((await axios.get(`${audioHost}/meta/music/artist/${artist}/${albumName}`)).body);
      const { trackID } = req.params;
      const trackPos = trackList.tracks.findIndex((el) => encodeHelper.htmlString(el.name) === encodeHelper.htmlString(trackID));
      const trackArtist = trackList.tracks[trackPos].artist || trackList.albumArtist;
      let nextTrackIndex = trackPos + 1;
      if (trackPos === trackList.length - 1) {
        nextTrackIndex = 0;
      }
      res.render('audioPlayer', {
        host: audioHost,
        title: trackList.tracks[trackPos].name,
        artist: trackArtist,
        albumArtist: trackList.albumArtist,
        albumID: albumName,
        albumName,
        trackID: trackList.tracks[trackPos].id,
        nextTrackIndex,
        trackPos,
        trackList,
      });
    });

    app.get('/artist/:artistID/album/:albumID', async (req, res) => {
      const artist = req.params.artistID;
      const album = req.params.albumID;
      const albumTracks = JSON.parse((await axios.get(`${audioHost}/meta/music/artist/${artist}/${album}`)).body);
      res.redirect(`/artist/${artist}/album/${album}/${encodeHelper.htmlString(albumTracks.tracks[0].name)}`);
    });

    app.get('/audio/:fileID/:albumID*?.wav', async (req, res) => {
      let readStream;
      if (req.headers.range) {
        const { range } = req.headers;
        const parts = range.replace(/bytes=/, '').split('-');
        const partialStart = parts[0];
        const partialEnd = parts[1];

        const start = parseInt(partialStart, 10);
        let end;
        const total = parseInt((await cache.get(req.params.albumID, google.getTracks, [
          req.params.albumID], 30 * 1000)).find((el) => el[0] === req.params.fileID)[2], 10);
        let buffer;
        const chunksize = 1125000;
        if (partialEnd && partialEnd !== '1') {
          end = parseInt(partialEnd, 10);
          if (end - start > chunksize && end - start !== total - 1) {
            end = start + chunksize - 1;
          }
          buffer = await google.wavFromText(req.params.fileID, req.params.albumID, start, end);
        } else {
          end = start + chunksize - 1;
          buffer = await google.wavFromText(req.params.fileID, req.params.albumID, start, end);
          if (buffer.byteLength > 1 && partialEnd === '1') {
            end = 1;
            buffer = Buffer.from(buffer.toString('base64', 0, 1), 'base64');
          }
        }
        readStream = new stream.PassThrough();
        readStream.end(buffer);

        res.writeHead(206, {
          Range: `bytes ${start}-${end}/${total}`,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': buffer.byteLength,
          'Accept-Ranges': 'bytes',
          'Content-Type': 'audio/x-wav',
        });
        readStream.pipe(res);
      } else {
        const buffer = await cache.get(req.params.fileID, google.wavFromText, [req.params.fileID,
        req.params.albumID], 5 * 60 * 1000);
        const total = buffer.byteLength;
        readStream = new stream.PassThrough();
        readStream.end(buffer);
        res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'audio/x-wav' });
        readStream.pipe(res);
      }
    });

    app.get('/today', (_, res) => {
      res.redirect(`/rooms/overview/${DateHelper.currentDate()}`);
    });

    app.get('/:year([0-9]{4})/:month(1[0-2]|(0?[1-9]))', async (req, res) => {
      const { year, month } = req.params;
      const formattedTime = `${DateHelper.monthName(month)} ${year}`;
      const dates = await cache.get(`${year}-${month}`, mongo.getPageDatesByYearAndMonth, [year, month]);

      res.render('yearMonth', {
        title: `Daily Pages for ${formattedTime}`,
        header: formattedTime,
        dates,
      });
    });

    app.get(`/rooms/overview/${dateParam}`, async (req, res) => {
      const requestedDate = new Date(req.params.date);

      try {
        if (requestedDate < ROOM_BASED_CUTOFF) {
          // Legacy Concatenated View
          const pageData = await cache.get(req.params.date, mongo.getPage, [req.params.date]);
          const [errorMessage, text] = viewHelper.archiveContent(pageData);

          return res.render('archivedPage', {
            title: `Daily Page for ${DateHelper.formatDate(req.params.date, 'long')}`,
            header: DateHelper.formatDate(req.params.date, 'long'),
            errorMessage,
            text,
          });
        } else {
          // Room-Based View
          const pages = await mongo.pagesByDate(req.params.date); // Fetch all pages for the date
          const rooms = await mongo.getAllRooms(); // Fetch all room metadata

          const roomContents = rooms.map((room) => {
            const page = pages.find((p) => p.room === room._id); // Find the page matching the room
            const [errorMessage, text] = viewHelper.archiveContent(page)
            return {
              name: room.name,
              id: room._id,
              content: page ? text : null, // Include content or null if no page exists
            };
          });

          res.render('archivedPage', {
            title: `Daily Page for ${DateHelper.formatDate(req.params.date, 'long')}`,
            header: DateHelper.formatDate(req.params.date, 'long'),
            date: req.params.date,
            roomContents,
          });
        }
      } catch (error) {
        console.error('Error fetching archive content:', error.message);
        res.render('archivedPage', {
          title: 'Error',
          header: 'An Error Occurred',
          errorMessage: 'An error occurred while loading the archive. Please try again later.',
        });
      }
    });

    app.get(`/rooms/:room([a-zA-Z0-9\-]+)/${dateParam}`, async (req, res) => {
      const roomReq = req.params.room;
      let roomMetdata = await mongo.getRoomMetadata(roomReq);
      const dateAndRoom = `${DateHelper.formatDate(req.params.date, 'long')} - ${roomMetdata.name} Room`;
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

    app.post('/request-room', handleRoomRequest);

    app.get('/rooms/:room_id', async (req, res) => {
      const { room_id } = req.params;

      try {
        // Fetch room metadata
        const roomMetadata = await mongo.getRoomMetadata(room_id);
        if (!roomMetadata) {
          return res.status(404).render('error', { message: 'Room not found.' });
        }

        // Fetch peer IDs for the room
        const peerIDs = await mongo.peerIDs(room_id);

        if (peerIDs.length >= 6) {
          return res.render('fullRoom', {
            room: viewHelper.capitalize(roomMetadata.name),
            description: roomMetadata.description,
          });
        }

        // Determine the targetPeerId (random existing peer if available, or default to 0)
        const targetPeerId = peerIDs.length > 0
          ? peerIDs[Math.floor(Math.random() * peerIDs.length)]
          : '0';

        // Render the editor for the room
        const date = DateHelper.currentDate('long');
        res.render('index', {
          title: `Daily Page - ${roomMetadata.name}`,
          description: roomMetadata.description,
          date,
          room: roomMetadata._id,
          header: `${date} - ${viewHelper.capitalize(roomMetadata.name)} Room`,
          backendURL: backendApiUrl,
          sessionID: jwtHelper.expiringKey(),
          targetPeerId,
        });
      } catch (error) {
        console.error('Error loading room editor:', error.message);
        res.status(500).render('error', { message: 'An error occurred while loading the room.' });
      }
    });

    app.get('/', async (req, res) => {
      const featuredContent = await getFeaturedContent();
      res.render('about', {
        title: res.locals.translations.title,
        translations: res.locals.translations,
        lang: res.locals.lang,
        featuredContent,
      });
    });

    app.get('*', (req, res) => {
      res.status(404).render('404', {
        title: 'Page Not Found',
        translations: res.locals.translations,
        lang: res.locals.lang,
      });
    });
  } catch (error) {
    console.log(`Server startup failed: ${error.message}`); // eslint-disable-line no-console
    console.log(error.stack);
  }
})();
