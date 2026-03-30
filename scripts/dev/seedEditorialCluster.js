/* global console, process */
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import Block from '../../server/db/models/Block.js';
import { createBlock } from '../../server/db/blockService.js';

function usage() {
  console.log('Usage: node scripts/dev/seedEditorialCluster.js [roomId=physics] [lang=en] [creator=editorial-seed]');
  console.log('Example: node scripts/dev/seedEditorialCluster.js physics en editorial-seed');
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function buildContent(title, lines) {
  return [
    `## ${title}`,
    '',
    ...lines.flatMap((line) => [line, ''])
  ].join('\n').trim();
}

async function createDemoBlock({
  roomId,
  lang,
  creator,
  title,
  description,
  tags,
  content,
  editorial
}) {
  return createBlock({
    title,
    description,
    tags,
    content,
    roomId,
    creator,
    visibility: 'public',
    status: 'locked',
    lang,
    editorial
  });
}

async function main() {
  const arg1 = process.argv[2];
  if (arg1 === '--help' || arg1 === '-h') {
    usage();
    return;
  }

  const roomId = arg1 || 'physics';
  const lang = process.argv[3] || 'en';
  const creator = process.argv[4] || 'editorial-seed';
  const seedKey = timestampSlug();
  const prefix = '[Editorial demo]';
  const clusterKey = `editorial-demo-${roomId}-${seedKey}`;
  const guideTitle = 'Momentum starter guide';
  const tags = ['editorial-demo', roomId, 'sprint-0'];

  try {
    await initMongooseConnection();

    const pillar = await createDemoBlock({
      roomId,
      lang,
      creator,
      title: `${prefix} Momentum overview`,
      description: 'A core guide page for testing block-page editorial context.',
      tags,
      content: buildContent('Momentum overview', [
        'This is the anchor page for a small editorial cluster.',
        'Use it to verify the reader-facing "Start here" treatment.',
        '- Defines the topic',
        '- Connects to the rest of the guide',
        '- Provides a clear entry point'
      ]),
      editorial: {
        clusterKey,
        guideTitle,
        role: 'pillar',
        sequence: 1
      }
    });

    const companionOne = await createDemoBlock({
      roomId,
      lang,
      creator,
      title: `${prefix} Reading a momentum graph`,
      description: 'A companion page that points back to the core guide and forward to another read.',
      tags,
      content: buildContent('Reading a momentum graph', [
        'This page exists to exercise the companion experience.',
        'It should show a "Start here" link back to the core guide.',
        'It also includes curated follow-up reading.'
      ]),
      editorial: {
        clusterKey,
        guideTitle,
        role: 'companion',
        sequence: 2
      }
    });

    const companionTwo = await createDemoBlock({
      roomId,
      lang,
      creator,
      title: `${prefix} Conservation examples`,
      description: 'Another companion page so nearby cluster navigation has something to show.',
      tags,
      content: buildContent('Conservation examples', [
        'This page gives the cluster a second deep-dive stop.',
        'Open it from the nearby guide links or from curated reading.'
      ]),
      editorial: {
        clusterKey,
        guideTitle,
        role: 'companion',
        sequence: 3
      }
    });

    const texture = await createDemoBlock({
      roomId,
      lang,
      creator,
      title: `${prefix} Why momentum matters`,
      description: 'A lighter context page for testing the background/texture path.',
      tags,
      content: buildContent('Why momentum matters', [
        'This page gives the cluster a background/context stop.',
        'It is useful for checking that texture pages still feel connected without becoming the main guide.'
      ]),
      editorial: {
        clusterKey,
        guideTitle,
        role: 'texture',
        sequence: 4
      }
    });

    await Promise.all([
      Block.updateOne(
        { _id: pillar._id },
        {
          $set: {
            editorial: {
              clusterKey,
              guideTitle,
              role: 'pillar',
              sequence: 1,
              relatedBlockIds: [
                String(companionOne._id),
                String(texture._id)
              ]
            }
          }
        }
      ),
      Block.updateOne(
        { _id: companionOne._id },
        {
          $set: {
            editorial: {
              clusterKey,
              guideTitle,
              role: 'companion',
              primaryPillarBlockId: String(pillar._id),
              sequence: 2,
              relatedBlockIds: [
                String(companionTwo._id),
                String(texture._id)
              ]
            }
          }
        }
      ),
      Block.updateOne(
        { _id: companionTwo._id },
        {
          $set: {
            editorial: {
              clusterKey,
              guideTitle,
              role: 'companion',
              primaryPillarBlockId: String(pillar._id),
              sequence: 3,
              relatedBlockIds: [
                String(companionOne._id)
              ]
            }
          }
        }
      ),
      Block.updateOne(
        { _id: texture._id },
        {
          $set: {
            editorial: {
              clusterKey,
              guideTitle,
              role: 'texture',
              primaryPillarBlockId: String(pillar._id),
              sequence: 4,
              relatedBlockIds: [
                String(companionOne._id)
              ]
            }
          }
        }
      )
    ]);

    const blocks = [
      { label: 'Core guide', doc: pillar },
      { label: 'Deep dive 1', doc: companionOne },
      { label: 'Deep dive 2', doc: companionTwo },
      { label: 'Background', doc: texture }
    ];

    console.log('Seeded editorial demo cluster:', {
      roomId,
      lang,
      creator,
      clusterKey,
      blockCount: blocks.length
    });

    for (const block of blocks) {
      console.log(`${block.label}: /rooms/${roomId}/blocks/${block.doc._id}`);
    }

    console.log('');
    console.log('Suggested test drive:');
    console.log(`1. Open the companion page: /rooms/${roomId}/blocks/${companionOne._id}`);
    console.log(`2. Open the texture page: /rooms/${roomId}/blocks/${texture._id}`);
    console.log(`3. Open the pillar page: /rooms/${roomId}/blocks/${pillar._id}`);
    console.log(`4. Optionally seed comments: node scripts/dev/seedBlockComments.js ${companionOne._id} 12`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
