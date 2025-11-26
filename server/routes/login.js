import express from 'express';
import { addI18n } from '../services/i18n.js'

const router = express.Router();

router.get('/login', addI18n(['auth']), (req, res) => {
  const { t } = res.locals;
  res.render('login', {
    title: t('auth.login.meta.title'),
    description: t('auth.login.meta.description')
  });
});

export default router;
