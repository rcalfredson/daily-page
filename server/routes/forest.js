import express from 'express';

import { isAuthenticated } from '../middleware/auth.js';
import { addI18n } from '../services/i18n.js';
import {
  ForestOwnerSceneBootstrapError,
  readForestOwnerSceneBootstrap
} from '../services/forestOwnerSceneBootstrap.js';
import { privateForestResponse } from './forestWriting.js';

const router = express.Router();

export function buildForestRouteHandler({
  readBootstrap = readForestOwnerSceneBootstrap
} = {}) {
  return async function forestRoute(req, res) {
    const { t } = res.locals;
    try {
      const bootstrap = await readBootstrap({ ownerUserId: req.user.id });
      return res.status(200).render('forest/index', {
        title: t('forestScene.meta.title'),
        description: t('forestScene.meta.description'),
        user: req.user,
        forestStatus: bootstrap.status,
        bootstrap
      });
    } catch (error) {
      console.error('Forest scene bootstrap failed:', error?.name || 'Error');
      return res.status(error instanceof ForestOwnerSceneBootstrapError
        && error.code === 'INVALID_OWNER_SCENE_INPUT' ? 400 : 503).render('forest/index', {
        title: t('forestScene.meta.title'),
        description: t('forestScene.meta.description'),
        user: req.user,
        forestStatus: 'unavailable',
        bootstrap: null
      });
    }
  };
}

router.get(
  '/forest',
  privateForestResponse,
  isAuthenticated,
  addI18n(['forestScene']),
  buildForestRouteHandler()
);

export default router;
