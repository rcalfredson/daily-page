import express from 'express';

import { getRoomMetadata } from '../db/roomService.js';
import { isAuthenticated } from '../middleware/auth.js';
import { addI18n } from '../services/i18n.js';
import { getPreferredContentLang, getUiLang } from '../services/localeContext.js';
import {
  ForestOwnerNonCanvasReadError,
  listForestOwnerWritingTrees
} from '../services/forestOwnerNonCanvasRead.js';

const router = express.Router();

export function privateForestResponse(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  if (typeof res.vary === 'function') res.vary('Cookie');
  else res.set('Vary', 'Cookie');
  next();
}

function forestWritingUrl(cursor) {
  return cursor
    ? `/forest/writing?cursor=${encodeURIComponent(cursor)}`
    : '/forest/writing';
}

function treePresentation(phenotypeId, t) {
  const presentationByPhenotype = {
    'open-crown-deciduous': {
      labelKey: 'forestWriting.treeTypes.deciduous',
      className: 'deciduous'
    },
    'sunset-lanternwood': {
      labelKey: 'forestWriting.treeTypes.lanternwood',
      className: 'lanternwood'
    },
    'wind-shaped-highland-conifer': {
      labelKey: 'forestWriting.treeTypes.conifer',
      className: 'conifer'
    }
  };
  const presentation = presentationByPhenotype[phenotypeId] || {
    labelKey: 'forestWriting.treeTypes.unknown',
    className: 'unknown'
  };
  return {
    label: t(presentation.labelKey),
    className: presentation.className
  };
}

function seasonLabel(season, t) {
  const supportedSeasons = ['spring', 'summer', 'autumn', 'winter'];
  return t(supportedSeasons.includes(season)
    ? `forestWriting.seasons.${season}`
    : 'forestWriting.seasons.unknown');
}

function languageName(lang, uiLang) {
  try {
    return new Intl.DisplayNames([uiLang], { type: 'language' }).of(lang) || lang;
  } catch {
    return lang;
  }
}

export function buildForestWritingRouteHandler({
  listWritingTrees = listForestOwnerWritingTrees,
  loadRoomMetadata = getRoomMetadata
} = {}) {
  return async function forestWritingRoute(req, res) {
    const { t } = res.locals;
    const uiLang = getUiLang(res);

    try {
      const result = await listWritingTrees({
        ownerUserId: req.user.id,
        preferredContentLang: getPreferredContentLang(res),
        cursor: req.query.cursor || null
      });
      const roomIds = [...new Set(result.trees.map(tree => tree.writing.roomId))];
      const roomNames = new Map(await Promise.all(roomIds.map(async roomId => {
        try {
          const metadata = await loadRoomMetadata(roomId, uiLang);
          return [roomId, metadata?.displayName || metadata?.name || roomId];
        } catch {
          return [roomId, roomId];
        }
      })));
      const uiBaseLang = uiLang.split('-')[0].toLowerCase();
      const trees = result.trees.map(tree => {
        const presentation = treePresentation(tree.projection.phenotypeId, t);
        const writingBaseLang = tree.writing.lang.split('-')[0].toLowerCase();
        return {
          ...tree,
          treeTypeLabel: presentation.label,
          treeTypeClass: presentation.className,
          seasonLabel: seasonLabel(tree.projection.creationSeason, t),
          writing: {
            ...tree.writing,
            roomName: roomNames.get(tree.writing.roomId) || tree.writing.roomId,
            languageName: languageName(tree.writing.lang, uiLang),
            showLanguage: writingBaseLang !== uiBaseLang,
            formattedCreatedAt: new Intl.DateTimeFormat(uiLang, {
              dateStyle: 'medium'
            }).format(new Date(tree.writing.createdAt))
          }
        };
      });

      return res.status(200).render('forest/writing', {
        title: t('forestWriting.meta.title'),
        description: t('forestWriting.meta.description'),
        user: req.user,
        uiLang,
        forestStatus: result.status,
        trees,
        omittedUnavailableCount: result.page.omittedUnavailableCount,
        previousUrl: result.page.previousCursor
          ? forestWritingUrl(result.page.previousCursor)
          : null,
        nextUrl: result.page.nextCursor
          ? forestWritingUrl(result.page.nextCursor)
          : null
      });
    } catch (error) {
      if (error instanceof ForestOwnerNonCanvasReadError
        && error.code === 'INVALID_FOREST_READ_INPUT') {
        return res.status(400).render('forest/writing', {
          title: t('forestWriting.meta.title'),
          description: t('forestWriting.meta.description'),
          user: req.user,
          uiLang,
          forestStatus: 'invalid-request',
          trees: [],
          omittedUnavailableCount: 0,
          previousUrl: null,
          nextUrl: null
        });
      }
      console.error('Forest non-canvas read failed:', error?.name || 'Error');
      return res.status(503).render('forest/writing', {
        title: t('forestWriting.meta.title'),
        description: t('forestWriting.meta.description'),
        user: req.user,
        uiLang,
        forestStatus: 'unavailable',
        trees: [],
        omittedUnavailableCount: 0,
        previousUrl: null,
        nextUrl: null
      });
    }
  };
}

router.get(
  '/forest/writing',
  privateForestResponse,
  isAuthenticated,
  addI18n(['forestWriting']),
  buildForestWritingRouteHandler()
);

export default router;
