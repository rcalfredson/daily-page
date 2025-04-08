import express from 'express';
import DateHelper from '../../lib/dateHelper.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';
import optionalAuth from '../middleware/optionalAuth.js';
import Block from '../db/models/Block.js';
import { getAllBlockYearMonthCombos, getBlockDatesByYearMonth } from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js'
const router = express.Router();

// GET /archive - Muestra todos los meses/años con contenido
router.get('/archive', optionalAuth, async (req, res) => {
  try {
    const yearMonthCombos = await getAllBlockYearMonthCombos();

    res.render('archive/calendar-index', {
      title: 'Archive Index',
      yearMonthCombos,
      monthName: DateHelper.monthName,
      user: req.user || null,
    });
  } catch (error) {
    console.error('Error loading archive index:', error);
    res.status(500).render('error', { message: 'Error loading archive index.' });
  }
});

// GET /archive/:year/:month - Muestra calendario del mes
router.get('/archive/:year/:month', optionalAuth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const datesWithContent = await getBlockDatesByYearMonth(year, month);

    res.render('archive/calendar', {
      title: `Archive for ${year}-${month}`,
      year,
      month,
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
    const date = `${year}-${month}-${day}`;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const blocks = await Block.find({
      createdAt: {
        $gte: new Date(`${date}T00:00:00.000Z`),
        $lt: new Date(`${date}T23:59:59.999Z`)
      }
    })
      .sort({ voteCount: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (req.user) {
      blocks.forEach(block => {
        block.userVote = block.votes.find(vote => vote.userId === req.user.id)?.type || null;
      });
    }

    blocks.forEach(block => {
      block.contentHTML = renderMarkdownContent(block.content);
    });

    const totalBlocks = await Block.countDocuments({
      createdAt: {
        $gte: new Date(`${date}T00:00:00.000Z`),
        $lt: new Date(`${date}T23:59:59.999Z`)
      }
    });

    res.render('archive/date', {
      title: `Archive for ${date}`,
      date,
      blocks,
      currentPage: page,
      totalPages: Math.ceil(totalBlocks / limit),
      user: req.user || null,
    });
  } catch (error) {
    console.error(`Error loading archive:`, error);
    res.status(500).render('error', { message: 'Error loading archive page.' });
  }
});

// Obtener todos los meses/años con contenido para una sala específica
router.get('/rooms/:roomId/archive', optionalAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const yearMonthCombos = await getAllBlockYearMonthCombos(roomId);
    const roomMetadata = await getRoomMetadata(roomId);

    res.render('archive/calendar-index', {
      title: 'Browse Archives',
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

    res.render('archive/calendar', {
      title: `Archive for ${year}-${month}`,
      year,
      month,
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
    const roomMetadata = await getRoomMetadata(roomId);
    const date = `${year}-${month}-${day}`;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

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

    if (req.user) {
      blocks.forEach(block => {
        block.userVote = block.votes.find(vote => vote.userId === req.user.id)?.type || null;
      });
    }

    blocks.forEach(block => {
      block.contentHTML = renderMarkdownContent(block.content);
    });

    const totalBlocks = await Block.countDocuments({
      roomId,
      createdAt: {
        $gte: new Date(`${date}T00:00:00.000Z`),
        $lt: new Date(`${date}T23:59:59.999Z`)
      }
    });

    res.render('archive/date', {
      title: `Archive for ${date}`,
      date,
      blocks,
      currentPage: page,
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
