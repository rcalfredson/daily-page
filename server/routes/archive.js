import express from 'express';
import DateHelper from '../../lib/dateHelper.js';
import { addI18n } from '../services/i18n.js';
import { getUiQueryLang } from '../services/localization.js';
import { chooseActiveBestOfTab } from '../utils/bestOf.js'
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
router.get('/archive', optionalAuth, addI18n(['archive']), async (req, res) => {
  try {
    const yearMonthCombos = await getAllBlockYearMonthCombos();

    const { t } = res.locals;
    const uiLang = res.locals.uiLang || res.locals.lang || 'en';

    const description = t('archive.meta.description');

    res.render('archive/calendar-index', {
      title: t('archive.meta.title'),
      description,
      yearMonthCombos,

      // Month names should follow UI chrome language
      monthName: (m) => DateHelper.monthName(m, uiLang),

      uiLang,
      user: req.user || null,
    });
  } catch (error) {
    console.error('Error loading archive index:', error);
    res.status(500).render('error', { message: 'Error loading archive index.' });
  }
});

router.get(
  '/rooms/:roomId/archive/best-of',
  optionalAuth,
  addI18n(['bestOf', 'translation', 'readMore', 'voteControls']),
  async (req, res) => {
    const { roomId } = req.params;
    const { t } = res.locals;

    const uiLang = res.locals.uiLang || res.locals.lang || 'en';
    // For list selection, default content preference to UI language for now.
    const preferredContentLang = uiLang;
    const uiFromQuery = getUiQueryLang(req);

    const userId = req.user?.id || null;

    try {
      const [top24h, top7d, top30d, topAll, roomMetadata] = await Promise.all([
        getTopBlocksByTimeframe(1, 20, roomId, { preferredContentLang }),
        getTopBlocksByTimeframe(7, 20, roomId, { preferredContentLang }),
        getTopBlocksByTimeframe(30, 20, roomId, { preferredContentLang }),
        getTopBlocksByTimeframe(null, 20, roomId, { preferredContentLang }),

        // Room chrome metadata should follow UI language
        getRoomMetadata(roomId, uiLang)
      ]);

      const top24hDTO = top24h.map(b => toBlockPreviewDTO(b, { userId }));
      const top7dDTO = top7d.map(b => toBlockPreviewDTO(b, { userId }));
      const top30dDTO = top30d.map(b => toBlockPreviewDTO(b, { userId }));
      const topAllDTO = topAll.map(b => toBlockPreviewDTO(b, { userId }));

      const activeTab = chooseActiveBestOfTab({
        top24h: top24hDTO,
        top7d: top7dDTO,
        top30d: top30dDTO,
        topAll: topAllDTO
      });

      const roomName = roomMetadata.displayName || roomMetadata.name;

      const title = t('bestOf.meta.titleRoom', { roomName });
      const description = t('bestOf.meta.descriptionRoom', { roomName });

      res.render('archive/best-of-room', {
        title,
        description,
        top24h: top24hDTO,
        top7d: top7dDTO,
        top30d: top30dDTO,
        topAll: topAllDTO,
        activeTab,
        roomMetadata: { ...roomMetadata, roomName },
        uiLang,
        preferredContentLang,
        uiFromQuery,
        user: req.user || null,
      });
    } catch (error) {
      console.error(`Error loading best-of archive for room ${roomId}:`, error);
      res.status(500).render('error', {
        message: 'Error loading room-specific best-of archive.'
      });
    }
  }
);

router.get('/archive/best-of', optionalAuth, addI18n(
  ['bestOf', 'translation', 'readMore', 'voteControls']),
async (req, res) => {
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
    const activeTab = chooseActiveBestOfTab({
      top24h: top24hDTO, top7d: top7dDTO, top30d: top30dDTO, topAll: topAllDTO
    });

    res.render('archive/best-of', {
      title: res.locals.t('bestOf.meta.title'),
      description: res.locals.t('bestOf.meta.description'),
      top24h: top24hDTO,
      top7d: top7dDTO,
      top30d: top30dDTO,
      topAll: topAllDTO,
      activeTab,
      user: req.user || null,
    });
  } catch (error) {
    console.error('Error loading best-of archive:', error);
    res.status(500).render('error', { message: 'Error loading best-of archive.' });
  }
});

// GET /archive/:year/:month - Muestra calendario del mes
router.get('/archive/:year/:month', optionalAuth, addI18n(['archive']), async (req, res) => {
  try {
    const { year, month } = req.params;
    const datesWithContent = await getBlockDatesByYearMonth(year, month);

    const { t, lang } = res.locals;
    const monthStr = DateHelper.monthName(Number(month), lang || 'en');
    const description = t('archive.calendar.meta.description', { month: monthStr, year });

    const { prevMonth, nextMonth } = await getMonthNav(null, year, month, { getAllBlockYearMonthCombos });

    res.render('archive/calendar', {
      title: t('archive.calendar.title', { month: monthStr, year }),
      description,
      year,
      month,
      prevMonth,
      nextMonth,
      datesWithContent,
      monthName: (m) => DateHelper.monthName(m, lang || 'en'),
      weekdaysShort: DateHelper.weekdayShortNames(lang || 'en'),
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading calendar for ${req.params.year}-${req.params.month}:`, error);
    res.status(500).render('error', { message: 'Error loading calendar.' });
  }
});

// Render archive view for a specific date
router.get('/archive/:year/:month/:day',
  optionalAuth,
  addI18n(['archive', 'translation', 'readMore', 'voteControls']), async (req, res) => {
    try {
      const { year, month, day } = req.params;
      const { lang, t } = res.locals;

      // parse ints
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;   // zero-based months in JS Date
      const d = parseInt(day, 10);

      // build start/end as UTC
      const start = new Date(Date.UTC(y, m, d, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0));

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const userId = req.user?.id || null;

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

      const dateISO = `${year}-${month}-${day}`;
      const { prevDate, nextDate } = await getDateNav(null, dateISO, Block);

      // Fecha “bonita” y datetime con hora local (para metadatos)
      const fmtDate = new Intl.DateTimeFormat(lang || 'en', { dateStyle: 'full', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, m, d)));
      const fmtDateTime = (dt) =>
        new Intl.DateTimeFormat(lang || 'en', { dateStyle: 'medium', timeStyle: 'short' })
          .format(new Date(dt));

      res.render('archive/date', {
        title: t('archive.date.meta.titleSite', { date: fmtDate }),
        description: t('archive.date.meta.descriptionSite', { date: fmtDate }),
        date: fmtDate,
        dateISO,
        blocks: lightBlocks,
        currentPage: page,
        prevDate,
        nextDate,
        totalPages: Math.ceil(totalBlocks / limit),
        formatDateTime: fmtDateTime,
        user: req.user || null,
      });
    } catch (error) {
      console.error(`Error loading archive:`, error);
      res.status(500).render('error', { message: 'Error loading archive page.' });
    }
  });

// GET /rooms/:roomId/index?page=1&sort=createdAt&dir=desc
router.get(
  '/rooms/:roomId/index',
  optionalAuth,
  addI18n(['archive']),
  async (req, res) => {
    const { t, lang } = res.locals;
    const { roomId } = req.params;

    const page = +req.query.page || 1;
    const limit = 20;

    const sortKey = ['title', 'createdAt', 'voteCount'].includes(req.query.sort)
      ? req.query.sort
      : 'createdAt';

    const dirStr = req.query.dir === 'asc' ? 'asc' : 'desc';
    const sortDir = dirStr === 'asc' ? 1 : -1;

    // i18n language wiring
    const currentLang = lang || 'en';
    const langQuery = currentLang ? `&lang=${currentLang}` : '';

    // Room metadata localized
    const roomMetadata = await getRoomMetadata(roomId, currentLang);
    const roomDisplayName = roomMetadata.displayName || roomMetadata.name;

    const blocks = await findByRoomWithLangPref({
      roomId,
      preferredLang: currentLang,
      sortBy: sortKey,
      sortDir,
      startDate: null,
      endDate: null,
      skip: (page - 1) * limit,
      limit
    });

    const total = await Block
      .distinct("groupId", { roomId })
      .then(arr => arr.length);

    const pageTitle = t('archive.index.meta.titleRoom', { roomName: roomDisplayName });

    res.render('archive/index', {
      blocks,
      roomId,
      roomName: roomDisplayName,
      title: pageTitle,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      sortKey,
      dir: dirStr,
      lang: currentLang,
      langQuery
    });
  }
);

// Obtener todos los meses/años con contenido para una sala específica
router.get('/rooms/:roomId/archive', optionalAuth, addI18n(['archive']), async (req, res) => {
  try {
    const { roomId } = req.params;
    const yearMonthCombos = await getAllBlockYearMonthCombos(roomId);
    const { t, lang } = res.locals;
    const roomMetadata = await getRoomMetadata(roomId, lang);

    const description = t('archive.meta.descriptionRoom', { roomName: roomMetadata.name });

    res.render('archive/calendar-index', {
      title: t('archive.meta.titleRoom', { roomName: roomMetadata.name }),
      description,
      yearMonthCombos,
      monthName: (m) => DateHelper.monthName(m, lang || 'en'),
      roomId,
      roomName: roomMetadata.displayName,
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading archive index for room ${req.params.roomId}:`, error);
    res.status(500).render('error', { message: 'Error loading archive index for room.' });
  }
});

// Calendario del mes específico en una sala
router.get('/rooms/:roomId/archive/:year/:month', optionalAuth, addI18n(['archive']), async (req, res) => {
  try {
    const { roomId, year, month } = req.params;
    const datesWithContent = await getBlockDatesByYearMonth(year, month, roomId);
    const { t, lang } = res.locals;
    const roomMetadata = await getRoomMetadata(roomId, lang);
    const monthStr = DateHelper.monthName(Number(month), lang || 'en');
    const description = t('archive.calendar.meta.descriptionRoom', {
      roomName: roomMetadata.name, month: monthStr, year
    })

    const { prevMonth, nextMonth } = await getMonthNav(roomId, year, month, { getAllBlockYearMonthCombos });

    res.render('archive/calendar', {
      title: t('archive.calendar.title', { month: monthStr, year }),
      description,
      year,
      month,
      prevMonth,
      nextMonth,
      datesWithContent,
      monthName: (m) => DateHelper.monthName(m, lang || 'en'),
      weekdaysShort: DateHelper.weekdayShortNames(lang || 'en'),
      roomId,
      roomName: roomMetadata.displayName,
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading calendar for room ${req.params.roomId}, ${req.params.year}-${req.params.month}:`, error);
    res.status(500).render('error', { message: 'Error loading calendar for room.' });
  }
});

// Archivo de una fecha específica en una sala
router.get('/rooms/:roomId/archive/:year/:month/:day',
  optionalAuth,
  addI18n(['archive', 'translation', 'readMore', 'voteControls']), async (req, res) => {
    try {
      const { lang, t } = res.locals;
      const preferredLang = lang || 'en';
      const { roomId, year, month, day } = req.params;
      const roomMetadata = await getRoomMetadata(roomId, preferredLang);

      const roomDisplayName =
        roomMetadata.displayName ||
        roomMetadata.name_i18n?.[preferredLang] ||
        roomMetadata.name;

      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;
      const d = parseInt(day, 10);

      const start = new Date(Date.UTC(y, m, d, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0));

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const userId = req.user?.id || null;

      const blocks = await Block.find({
        roomId,
        createdAt: {
          $gte: start,
          $lt: end
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
          $gte: start,
          $lt: end
        }
      });

      const dateISO = `${year}-${month}-${day}`;
      const { prevDate, nextDate } = await getDateNav(roomId, dateISO, Block);

      const fmtDate = new Intl.DateTimeFormat(lang || 'en', { dateStyle: 'full', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, m, d)));
      const fmtDateTime = (dt) =>
        new Intl.DateTimeFormat(lang || 'en', { dateStyle: 'medium', timeStyle: 'short' })
          .format(new Date(dt));

      res.render('archive/date', {
        title: t('archive.date.meta.titleRoom', { roomName: roomDisplayName, date: fmtDate }),
        description: t('archive.date.meta.descriptionRoom', { roomName: roomDisplayName, date: fmtDate }),
        date: fmtDate,
        dateISO,
        blocks: lightBlocks,
        currentPage: page,
        prevDate,
        nextDate,
        totalPages: Math.ceil(totalBlocks / limit),
        roomId,
        roomName: roomDisplayName,
        formatDateTime: fmtDateTime,
        user: req.user || null,
      });
    } catch (error) {
      console.error(`Error loading archive for room ${req.params.roomId}:`, error);
      res.status(500).render('error', { message: 'Error loading archive page for room.' });
    }
  });

export default router;
