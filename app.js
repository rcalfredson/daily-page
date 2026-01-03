import compression from 'compression';
import stream from 'stream';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import { ExpressPeerServer } from 'peer';
import axios from 'axios';
import DateHelper from './lib/dateHelper.js';
import * as encodeHelper from './lib/encodeHelper.js';

import { config } from './config/config.js';

import useAuthAPI from './server/api/v1/auth.js';
import useBlockAPI from './server/api/v1/blocks.js';
import usePeersAPI from './server/api/v1/peers.js';
import useRoomAPI from './server/api/v1/rooms.js';
import useUserAPI from './server/api/v1/users.js';
import useVoteAPI from './server/api/v1/votes.js';

import roomRoute from './server/routes/rooms.js'; // Routes
import usersRoute from './server/routes/users.js';
import tagsRoute from './server/routes/tags.js';
import loginRoute from './server/routes/login.js';
import blocksRoute from './server/routes/blocks.js';
import archiveRoutes from './server/routes/archive.js';
import blockViewRoute from './server/routes/blockView.js';

import { handleRoomRequest } from './server/services/roomRequests.js';
import * as cache from './server/services/cache.js';
import { getUiLang, getPreferredContentLang } from './server/services/localeContext.js';
import setLangMiddleware from './server/services/localization.js';
import { initI18n, addI18n } from './server/services/i18n.js'
import { startJobs } from './server/services/cron.js';
import * as google from './server/services/google.js';

import { renderMarkdownContent } from './server/utils/markdownHelper.js';
import * as viewHelper from './server/utils/view.js'; // Utils

import { initMongooseConnection } from './server/db/mongoose.js';
import {
  getBlocksByRoomWithFallback,
  getTopBlocksWithFallback, getTrendingTagsWithFallback,
  getFeaturedBlockWithFallback, getFeaturedRoomWithFallback,
  getGlobalBlockStats,
  getTotalTags
} from './server/db/blockService.js';
import {
  pagesByDate,
  getPageDatesByYearAndMonth,
  getPage
} from './server/db/pageService.js';
import {
  getAllRooms, getRoomMetadata,
  getTotalRooms

} from './server/db/roomService.js'
import optionalAuth from './server/middleware/optionalAuth.js';
import { addSeoLocals } from './server/middleware/seo.js';
import { stripLegacyLang } from './server/middleware/stripLegacyLang.js';
import { findUserById } from './server/db/userService.js';
import { toBlockPreviewDTO } from './server/utils/block.js';

startJobs();

const app = express();
const port = config.port || 3000;
const audioHost = 'https://ipod.dailypage.org';
const ROOM_BASED_CUTOFF = new Date('2024-12-31');

(async () => {
  const dateParam = ':date([0-9]{4}-[0-9]{2}-[0-9]{2})';

  try {
    await initMongooseConnection();
    google.init();

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

    app.set('trust proxy', true);

    if (process.env.NODE_ENV === 'production') {
      app.set('view cache', true);
      app.use(compression());
      app.use((req, res, next) => {
        if (!req.secure) {
          // return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
        }
        next();
      });
    }

    app.use(cookieParser());
    app.use(cors(corsOptions));
    app.use(setLangMiddleware);
    app.use(addSeoLocals);
    app.use(initI18n(['layout', 'nav', 'modals']));
    app.options('*', cors(corsOptions));

    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.set('views', './views');
    app.set('view engine', 'pug');

    useAuthAPI(app);
    useBlockAPI(app);
    useRoomAPI(app);
    usePeersAPI(app);
    useUserAPI(app);
    useVoteAPI(app);
    app.use('/', roomRoute);
    app.use('/', usersRoute);
    app.use('/', tagsRoute);
    app.use('/', loginRoute);
    app.use('/', blocksRoute);
    app.use('/', archiveRoutes);
    app.use('/', blockViewRoute);

    const server = createServer(app)

    const peerServer = ExpressPeerServer(server, {
      debug: true,
    });

    app.use('/peerjs', peerServer);

    server.listen(port, () => {
      console.log(`Listening on port ${port}`);
    });

    app.get('/random-writer', addI18n(['randomWriter']), (_, res) => {
      const { t } = res.locals;

      res.render('randomWriter', {
        title: t('randomWriter.meta.title'),
        description: t('randomWriter.meta.description')
      });
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
      const dates = await cache.get(`${year}-${month}`, getPageDatesByYearAndMonth, [year, month]);

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
          const pageData = await cache.get(req.params.date, getPage, [req.params.date]);
          const [errorMessage, text] = viewHelper.archiveContent(pageData);

          return res.render('archivedPage', {
            title: `Daily Page for ${DateHelper.formatDate(req.params.date, 'long')}`,
            header: DateHelper.formatDate(req.params.date, 'long'),
            errorMessage,
            text,
          });
        } else {
          // Room-Based View
          const pages = await pagesByDate(req.params.date); // Fetch all pages for the date
          const rooms = await getAllRooms(); // Fetch all room metadata

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
      let roomMetdata = await getRoomMetadata(roomReq);
      const dateAndRoom = `${DateHelper.formatDate(req.params.date, 'long')} - ${roomMetdata.name} Room`;
      const pageData = await cache.get(req.params.date, getPage,
        [req.params.date, roomReq, req.query]);

      const [errorMessage, text] = viewHelper.archiveContent(pageData);

      res.render('archivedPage', {
        title: `Daily Page for ${dateAndRoom}`,
        header: dateAndRoom,
        errorMessage,
        text,
      });
    });

    app.get('/support', addI18n(['support']), (_, res) => {
      const { t } = res.locals;

      res.render('support', {
        title: t('support.meta.title'),
        description: t('support.meta.description')
      })
    });

    app.post('/request-room', handleRoomRequest);

    app.get(
      '/rooms/:room_id',
      optionalAuth,
      addI18n(['roomDashboard', 'blockList', 'translation', 'readMore', 'voteControls']),
      stripLegacyLang({ canonicalPath: (req) => `/rooms/${encodeURIComponent(req.params.room_id)}` }),
      async (req, res) => {
        try {
          const { room_id } = req.params;

          const uiLang = getUiLang(res);
          const preferredContentLang = getPreferredContentLang(res);
          const userId = req.user?.id || null;

          const roomMetadataRaw = await getRoomMetadata(room_id, uiLang);

          const roomMetadata = roomMetadataRaw ? {
            ...roomMetadataRaw,
            displayName:
              roomMetadataRaw?.name_i18n?.get?.(uiLang)
              || roomMetadataRaw?.name_i18n?.[uiLang]
              || roomMetadataRaw?.name,
            displayDescription:
              roomMetadataRaw?.description_i18n?.get?.(uiLang)
              || roomMetadataRaw?.description_i18n?.[uiLang]
              || roomMetadataRaw?.description
          } : null;

          let isStarred = false;
          if (req.user) {
            const dbUser = await findUserById(req.user.id);
            isStarred = dbUser?.starredRooms?.includes(room_id);
          }

          const { blocks: lockedBlocks, period: lockedPeriod } =
            await getBlocksByRoomWithFallback({
              roomId: room_id,
              userId,
              status: 'locked',
              limit: 20,
              preferredLang: preferredContentLang,
            });

          const { blocks: inProgressBlocks, period: inProgressPeriod } =
            await getBlocksByRoomWithFallback({
              roomId: room_id,
              userId,
              status: 'in-progress',
              limit: 20,
              preferredLang: preferredContentLang
            });

          // Render markdown…
          const lightLocked = lockedBlocks.map(
            b => toBlockPreviewDTO(b, {
              userId
            })
          );
          const lightInProg = inProgressBlocks.map(
            b => toBlockPreviewDTO(b, {
              userId
            })
          )

          const date = DateHelper.currentDateI18n(uiLang || 'en', 'Europe/London');

          const showInProgressTab = (inProgressPeriod === 1 && inProgressBlocks.length > 0);
          const showLockedTab = (lockedBlocks.length > 0);
          const useTabs = (showLockedTab ? 1 : 0) + (showInProgressTab ? 1 : 0) >= 2;

          const roomName = roomMetadata?.displayName || roomMetadata?.name || '';

          res.render('rooms/blocks-dashboard', {
            room_id,
            title: res.locals.t('roomDashboard.meta.title', { roomName }),
            description: res.locals.t('roomDashboard.meta.description', { roomName }),

            lockedBlocks: lightLocked,
            inProgressBlocks: lightInProg,
            lockedPeriod,
            inProgressPeriod,
            showInProgressTab,
            showLockedTab,
            useTabs,

            user: req.user || null,
            roomMetadata,
            isStarred,
            date,

            uiLang,
            preferredContentLang,
          });
        } catch (error) {
          console.error('Error loading room dashboard:', error);
          res.status(500).send('Error loading room dashboard.');
        }
      });

    app.get('/about', optionalAuth, addI18n(['about']), async (req, res) => {
      const { t } = res.locals;

      res.render('about', {
        title: t('about.meta.title'),
        description: t('about.meta.description')
      })
    })

    app.get(
      '/',
      optionalAuth,
      addI18n(['home', 'translation', 'readMore', 'voteControls']),
      stripLegacyLang({ canonicalPath: '/' }),
      async (req, res) => {
        try {
          const { t } = res.locals;
          const uiLang = getUiLang(res);
          const preferredContentLang = getPreferredContentLang(res);
          const userId = req.user?.id || null;

          // Dispara todo en paralelo
          const [
            fbRes,   // featured block
            frRes,   // featured room (ids/raw)
            topRes,  // top blocks
            tagsRes, // trending tags
            statsRes,// global block stats
            roomsRes, // total rooms
            totalTagsRes // total tags
          ] = await Promise.all([
            getFeaturedBlockWithFallback({ preferredLang: preferredContentLang }),
            getFeaturedRoomWithFallback(),
            getTopBlocksWithFallback({ lockedOnly: false, limit: 20, preferredLang: preferredContentLang }),
            getTrendingTagsWithFallback({ limit: 10, sortBy: 'totalBlocks' }),
            getGlobalBlockStats(),
            getTotalRooms(),
            getTotalTags()
          ]);

          // Post-procesamiento mínimo (sin I/O extra)
          const featuredBlock = fbRes?.featuredBlock?.content
            ? { ...fbRes.featuredBlock, contentHTML: renderMarkdownContent(fbRes.featuredBlock.content) }
            : fbRes?.featuredBlock || null;

          const featuredBlockPeriod = fbRes?.period || null;

          // Para el room necesitamos metadata en el idioma -> un pequeño paso secuencial
          const featuredRoomData = frRes?.featuredRoomData || null;
          const featuredRoomPeriod = frRes?.period || null;


          const featuredRoom = (featuredRoomData?._id)
            ? await getRoomMetadata(featuredRoomData._id, uiLang)
            : null;

          // Mapear top blocks a DTO con userId
          const blocksPeriod = topRes?.period || null;
          const topBlocks = (topRes?.blocks || []).map(b => toBlockPreviewDTO(b, { userId }));

          // Tags + period
          const trendingTags = tagsRes?.tags || [];
          const tagsPeriod = tagsRes?.period || null;

          const globalStats = {
            totalBlocks: statsRes?.totalBlocks ?? 0,
            totalRooms: roomsRes ?? 0,
            totalTags: totalTagsRes ?? 0,
            collaborationsToday: statsRes?.collaborationsToday ?? 0,
          };

          res.render('home', {
            title: t('home.meta.title'),
            description: t('home.meta.description'),

            topBlocks,
            blocksPeriod,
            featuredBlock,
            featuredBlockPeriod,
            featuredRoom,
            featuredRoomData,
            featuredRoomPeriod,
            globalStats,
            trendingTags,
            tagsPeriod,

            user: req.user || null,
            uiLang,
            preferredContentLang,
          });
        } catch (err) {
          console.error('Error fetching homepage data:', err);
          res.status(500).send('Server Error');
        }
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
