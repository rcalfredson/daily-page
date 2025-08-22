import express from 'express';
import DateHelper from '../../lib/dateHelper.js';
import { toBlockPreviewDTO } from '../utils/block.js'
import { getMonthNav, getDateNav } from '../utils/archiveNav.js';
import optionalAuth from '../middleware/optionalAuth.js';
import Block from '../db/models/Block.js';
import {
  findByRoomWithLangPref,
  getAllBlockYearMonthCombos,
  getBlockDatesByYearMonth,
  getTopBlocksByTimeframe
} from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js'
const router = express.Router();

// GET /archive - Muestra todos los meses/años con contenido
router.get('/archive', optionalAuth, async (req, res) => {
  try {
    const yearMonthCombos = await getAllBlockYearMonthCombos();
    const description = "Explore Daily Page’s full archive of creative " +
      "blocks—thoughts, stories, jokes, confessions, and everything in between. " +
      "Jump to any month and see what was posted that day.";

    res.render('archive/calendar-index', {
      title: 'Archive Index',
      description,
      yearMonthCombos,
      monthName: DateHelper.monthName,
      user: req.user || null,
    });
  } catch (error) {
    console.error('Error loading archive index:', error);
    res.status(500).render('error', { message: 'Error loading archive index.' });
  }
});

router.get('/rooms/:roomId/archive/best-of', optionalAuth, async (req, res) => {
  const { roomId } = req.params;
  const preferredLang = req.query.lang
    || req.user?.preferredLang
    || (req.acceptsLanguages()[0] || 'en').split('-')[0];
  const userId = req.user?.id || null;
  try {
    const [top24h, top7d, top30d, topAll, roomMetadata] = await Promise.all([
      getTopBlocksByTimeframe(1, 20, roomId, preferredLang),
      getTopBlocksByTimeframe(7, 20, roomId, preferredLang),
      getTopBlocksByTimeframe(30, 20, roomId, preferredLang),
      getTopBlocksByTimeframe(null, 20, roomId, preferredLang),
      getRoomMetadata(roomId)
    ]);

    const top24hDTO = top24h.map(b => toBlockPreviewDTO(b, { userId }));
    const top7dDTO = top7d.map(b => toBlockPreviewDTO(b, { userId }));
    const top30dDTO = top30d.map(b => toBlockPreviewDTO(b, { userId }));
    const topAllDTO = topAll.map(b => toBlockPreviewDTO(b, { userId }));

    const description = `Discover standout posts from the ${roomMetadata.name} room—` +
      `the ones readers loved most over the past 24 hours, 7 days, 30 days, and all time.`;

    res.render('archive/best-of-room', {
      title: `Best of ${roomMetadata.name}`,
      description,
      top24h: top24hDTO,
      top7d: top7dDTO,
      top30d: top30dDTO,
      topAll: topAllDTO,
      roomMetadata,
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading best-of archive for room ${roomId}:`, error);
    res.status(500).render('error', { message: 'Error loading room-specific best-of archive.' });
  }
});

router.get('/archive/best-of', optionalAuth, async (req, res) => {
  try {
    const preferredLang = req.query.lang
      || req.user?.preferredLang
      || (req.acceptsLanguages()[0] || 'en').split('-')[0];
    const userId = req.user?.id || null;
    const [top24h, top7d, top30d, topAll] = await Promise.all([
      getTopBlocksByTimeframe(1, 20, null, preferredLang),
      getTopBlocksByTimeframe(7, 20, null, preferredLang),
      getTopBlocksByTimeframe(30, 20, null, preferredLang),
      getTopBlocksByTimeframe(null, 20, null, preferredLang)
    ]);

    const top24hDTO = top24h.map(b => toBlockPreviewDTO(b, { userId }));
    const top7dDTO = top7d.map(b => toBlockPreviewDTO(b, { userId }));
    const top30dDTO = top30d.map(b => toBlockPreviewDTO(b, { userId }));
    const topAllDTO = topAll.map(b => toBlockPreviewDTO(b, { userId }));

    const description = "The most-loved blocks on Daily Page—funny, honest, poetic, or just plain weird. " +
      "See what stood out over the past day, week, month, and beyond.";

    res.render('archive/best-of', {
      title: 'Best of Daily Page',
      description,
      top24h: top24hDTO,
      top7d: top7dDTO,
      top30d: top30dDTO,
      topAll: topAllDTO,
      user: req.user || null,
    });
  } catch (error) {
    console.error('Error loading best-of archive:', error);
    res.status(500).render('error', { message: 'Error loading best-of archive.' });
  }
});

// GET /archive/:year/:month - Muestra calendario del mes
router.get('/archive/:year/:month', optionalAuth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const datesWithContent = await getBlockDatesByYearMonth(year, month);

    const description = `View all creative blocks posted in ${DateHelper.monthName(month)} ${year}—from quick thoughts to deep reflections. ` +
      `Click any date to explore what was shared.`;

    const { prevMonth, nextMonth } = await getMonthNav(null, year, month, { getAllBlockYearMonthCombos });

    res.render('archive/calendar', {
      title: `Archive for ${year}-${month}`,
      description,
      year,
      month,
      prevMonth,
      nextMonth,
      datesWithContent,
      monthName: DateHelper.monthName,
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading calendar for ${req.params.year}-${req.params.month}:`, error);
    res.status(500).render('error', { message: 'Error loading calendar.' });
  }
});

// Render archive view for a specific date
router.get('/archive/:year/:month/:day', optionalAuth, async (req, res) => {
  try {
    const { year, month, day } = req.params;
    const dateISO = `${year}-${month}-${day}`;
    const date = `${year}-${month}-${day}`;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const userId = req.user?.id || null;

    // parse ints
    const y = parseInt(year, 10);
    const m = parseInt(month, 10) - 1;   // zero-based months in JS Date
    const d = parseInt(day, 10);

    // build start/end as UTC
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0));

    const blocks = await Block.find({
      createdAt: {
        $gte: start,
        $lt: end
      }
    })
      .sort({ voteCount: -1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const lightBlocks = blocks.map(
      b => toBlockPreviewDTO(b, {
        userId
      })
    );

    const totalBlocks = await Block.countDocuments({
      createdAt: {
        $gte: start,
        $lt: end
      }
    });

    const { prevDate, nextDate } = await getDateNav(null, dateISO, Block);

    const description = `Explore the posts written on ${year}-${month}-${day}—from quiet notes to wild confessions. ` +
      `Every block is a moment frozen in time.`;

    res.render('archive/date', {
      title: `Archive for ${date}`,
      description,
      date,
      blocks: lightBlocks,
      currentPage: page,
      prevDate,
      nextDate,
      totalPages: Math.ceil(totalBlocks / limit),
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading archive:`, error);
    res.status(500).render('error', { message: 'Error loading archive page.' });
  }
});

// GET /rooms/:roomId/index?page=1&sort=createdAt&dir=desc
router.get('/rooms/:roomId/index', optionalAuth, async (req, res) => {
  const { roomId } = req.params;
  const preferredLang =
    req.query.lang ||
    req.user?.preferredLang ||
    (req.acceptsLanguages()[0] || "en").split("-")[0];

  const page = +req.query.page || 1;
  const limit = 20;
  const sortKey = ['title', 'createdAt', 'voteCount'].includes(req.query.sort)
    ? req.query.sort : 'createdAt';
  const dirStr = req.query.dir === 'asc' ? 'asc' : 'desc';
  const sortDir = dirStr === 'asc' ? 1 : -1;

  const currentLang = preferredLang;                     // <- alias
  const langQuery = currentLang ? `&lang=${currentLang}` : '';

  const roomMetadata = await getRoomMetadata(roomId);

  const blocks = await findByRoomWithLangPref({
    roomId,
    preferredLang,
    sortBy: sortKey,
    sortDir,
    startDate: null,
    endDate: null,
    skip: (page - 1) * limit,
    limit
  });

  const total = await Block.distinct("groupId", { roomId }).then(arr => arr.length);

  res.render('archive/index', {
    blocks,
    roomId,
    roomName: roomMetadata.name,
    title: `${roomMetadata.name} — All Blocks`,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    sortKey,
    dir: dirStr,
    currentLang,
    langQuery
  });
});

// Obtener todos los meses/años con contenido para una sala específica
router.get('/rooms/:roomId/archive', optionalAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const yearMonthCombos = await getAllBlockYearMonthCombos(roomId);
    const roomMetadata = await getRoomMetadata(roomId);

    const description = `Explore past writing in the ${roomMetadata.name} room—month by month. ` +
      `Jump to any date to see what others shared in this space over time.`;

    res.render('archive/calendar-index', {
      title: 'Browse Archives',
      description,
      yearMonthCombos,
      monthName: DateHelper.monthName,
      roomId,
      roomName: roomMetadata.name,
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading archive index for room ${req.params.roomId}:`, error);
    res.status(500).render('error', { message: 'Error loading archive index for room.' });
  }
});

// Calendario del mes específico en una sala
router.get('/rooms/:roomId/archive/:year/:month', optionalAuth, async (req, res) => {
  try {
    const { roomId, year, month } = req.params;
    const datesWithContent = await getBlockDatesByYearMonth(year, month, roomId);
    const roomMetadata = await getRoomMetadata(roomId);

    const description = `View the creative activity in ${roomMetadata.name} during ${DateHelper.monthName(month)} ${year}. ` +
      `Pick a date to explore the blocks shared that day.`;

    const { prevMonth, nextMonth } = await getMonthNav(roomId, year, month, { getAllBlockYearMonthCombos });

    res.render('archive/calendar', {
      title: `Archive for ${year}-${month}`,
      description,
      year,
      month,
      prevMonth,
      nextMonth,
      datesWithContent,
      monthName: DateHelper.monthName,
      roomId,
      roomName: roomMetadata.name,
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading calendar for room ${req.params.roomId}, ${req.params.year}-${req.params.month}:`, error);
    res.status(500).render('error', { message: 'Error loading calendar for room.' });
  }
});

// Archivo de una fecha específica en una sala
router.get('/rooms/:roomId/archive/:year/:month/:day', optionalAuth, async (req, res) => {
  try {
    const { roomId, year, month, day } = req.params;
    const dateISO = `${year}-${month}-${day}`;
    const roomMetadata = await getRoomMetadata(roomId);
    const date = `${year}-${month}-${day}`;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const userId = req.user?.id || null;

    const blocks = await Block.find({
      roomId,
      createdAt: {
        $gte: new Date(`${date}T00:00:00.000Z`),
        $lt: new Date(`${date}T23:59:59.999Z`)
      }
    })
      .sort({ voteCount: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const lightBlocks = blocks.map(
      b => toBlockPreviewDTO(b, {
        userId
      })
    );

    const totalBlocks = await Block.countDocuments({
      roomId,
      createdAt: {
        $gte: new Date(`${date}T00:00:00.000Z`),
        $lt: new Date(`${date}T23:59:59.999Z`)
      }
    });

    const { prevDate, nextDate } = await getDateNav(roomId, dateISO, Block);

    const description = `On ${date}, writers in the ${roomMetadata.name} room left their mark. ` +
      `Scroll through their reflections, ideas, and expressions shared that day.`;

    res.render('archive/date', {
      title: `Archive for ${date}`,
      description,
      date,
      blocks: lightBlocks,
      currentPage: page,
      prevDate,
      nextDate,
      totalPages: Math.ceil(totalBlocks / limit),
      roomId,
      roomName: roomMetadata.name,
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading archive for room ${req.params.roomId}:`, error);
    res.status(500).render('error', { message: 'Error loading archive page for room.' });
  }
});

export default router;
