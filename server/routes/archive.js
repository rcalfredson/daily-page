import express from 'express';
import DateHelper from '../../lib/dateHelper.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';
import optionalAuth from '../middleware/optionalAuth.js';
import Block from '../db/models/Block.js';
import { getAllBlockYearMonthCombos, getBlockDatesByYearMonth } from '../db/blockService.js';
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

export default router;
