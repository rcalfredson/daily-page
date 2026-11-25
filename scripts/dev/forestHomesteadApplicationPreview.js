// Main forest page and real APIs, with reserved local test identities.
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import Block from '../../server/db/models/Block.js';
import { createForestWritingTree } from '../../server/services/forestWritingTreeCreation.js';
import ForestHomestead from '../../server/db/models/ForestHomestead.js';
import { forestGarden } from '../../server/services/forestGarden.js';
import { forestHomesteadApplication } from '../../server/services/forestHomesteadApplication.js';
import { DEFAULT_CART_DESIGN } from '../../public/js/forest-construction-design.js';
import useForestAPI from '../../server/api/v1/forest.js';
import { buildForestRouteHandler } from '../../server/routes/forest.js';
import { uiPrefixAndLangContext } from '../../server/middleware/uiPrefix.js';
import { initI18n } from '../../server/services/i18n.js';

export const APPLICATION_PREVIEW_OWNER = '64b00000000000000000a097';
const ORCHARD_REVIEW_OWNER = '64b00000000000000000a0a7';
const OUTING_REVIEW_OWNER = '64b00000000000000000a0b8';

async function prepareOrchardReview(ownerUserId) {
  let record = await forestHomesteadApplication.read({ ownerUserId });
  async function save(action, extra = {}) {
    record = await forestHomesteadApplication.mutate({ ownerUserId, command: { action,
      operationId: crypto.randomUUID(), forestId: record.forestId,
      expectedRevision: record.revision, terrainToken: record.terrainToken, ...extra } });
  }
  if (!record.established) {
    const { site } = await forestHomesteadApplication.suggest({ ownerUserId });
    await save('establish', { site });
  }
  if (!record.starterSuppliesClaimed) await save('supplies');
  if (!record.cartDesign) await save('cart', { design: DEFAULT_CART_DESIGN });
  if (!record.companion) await save('companion', { encounter: 'meet' });
  if (record.companion.stage === 'acquainted') await save('companion', { encounter: 'invite' });
}

export async function createHomesteadApplicationPreview({ orchardReview = false, outingReview = false } = {}) {
  if (process.env.NODE_ENV === 'production'
    || ['1', 'true', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB).toLowerCase())) throw new Error('Local test database only');
  await initMongooseConnection({ useProductionDb: false, quiet: true });
  if (mongoose.connection.name !== 'daily-page-test') throw new Error('Unexpected database');
  const ownerUserId = outingReview ? OUTING_REVIEW_OWNER : orchardReview ? ORCHARD_REVIEW_OWNER : APPLICATION_PREVIEW_OWNER;
  const username = outingReview ? 'forest_walled_orchard_review' : orchardReview ? 'forest_orchard_review' : 'forest_homestead_application_preview';
  const user = await User.findById(ownerUserId).lean();
  if (user && user.username !== username) throw new Error('Preview identity collision');
  if (!user) await User.create({ _id: ownerUserId, username, email: `${username}@example.test`,
    password: crypto.randomBytes(32).toString('base64url'), verified: true, forestLedgerFence: 0 });
  await ForestHomestead.init();
  await forestGarden.mutate({ ownerUserId,
    command: { action: 'establish', expectedRevision: 0, terrainToken: null } });
  process.env.FOREST_HOMESTEAD_DEV_OWNER_IDS = ownerUserId;
  if (orchardReview || outingReview) await prepareOrchardReview(ownerUserId);
  // One real writing projection exercises the same renderer, inspection and return resolver.
  else {
    const blockId = '64b00000000000000000a098', groupId = '64b00000000000000000a099';
    const block = await Block.findById(blockId).lean();
    if (block && (String(block.userId) !== ownerUserId || String(block.groupId) !== groupId)) throw new Error('Preview writing identity collision');
    if (!block) await Block.create({ _id: blockId, userId: ownerUserId, creator: username,
      groupId, lang: 'en', roomId: 'daily', title: 'A first walk from home',
      status: 'locked', visibility: 'public', authorshipState: 'live', createdAt: new Date() });
    await createForestWritingTree({ ownerUserId, translationGroupId: groupId });
  }
  const app = express(); app.set('views', `${process.cwd()}/views`); app.set('view engine', 'pug');
  app.use(express.json({ limit: '8kb' })); app.use(express.static('public'));
  app.use(uiPrefixAndLangContext); app.use(initI18n(['layout', 'nav', 'forestScene', 'blockView']));
  app.use((req, res, next) => {
    req.user = { id: ownerUserId, username }; next();
  });
  useForestAPI(app);
  app.get('/forest', buildForestRouteHandler());
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--write') throw new Error('Use --write for this local account preview');
  const app = await createHomesteadApplicationPreview({ orchardReview: process.env.FOREST_APPLICATION_ORCHARD_REVIEW === 'true',
    outingReview: process.env.FOREST_APPLICATION_OUTING_REVIEW === 'true' });
  const server = app.listen(Number(process.env.FOREST_APPLICATION_PREVIEW_PORT || 4185), '127.0.0.1');
  await once(server, 'listening');
  console.log(`Main Activity Forest integration: http://127.0.0.1:${server.address().port}/en/forest (reserved test owner; saved state retained)`);
}
