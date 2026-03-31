/* global console, process */
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import Block from '../../server/db/models/Block.js';
import { createBlock } from '../../server/db/blockService.js';

function usage() {
  console.log('Usage: node scripts/dev/seedEditorialCluster.js [roomId=physics] [lang=en] [creator=editorial-seed] [mode=default]');
  console.log('Example: node scripts/dev/seedEditorialCluster.js physics en editorial-seed expanded-guide');
  console.log('Modes: default, expanded-guide');
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
  const mode = process.argv[5] || 'default';
  const seedKey = timestampSlug();
  const prefix = '[Editorial demo]';
  const clusterKey = `editorial-demo-${roomId}-${seedKey}`;
  const guideTitle = 'Momentum starter guide';
  const tags = ['editorial-demo', roomId, 'sprint-0'];
  const isExpandedGuideMode = mode === 'expanded-guide';

  if (!['default', 'expanded-guide'].includes(mode)) {
    throw new Error(`Unknown mode "${mode}". Supported modes: default, expanded-guide.`);
  }

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

    const extraBlockSpecs = isExpandedGuideMode
      ? [
          {
            key: 'extraCompanionOne',
            label: 'Deep dive 3',
            title: `${prefix} Impulse in everyday motion`,
            description: 'Extra companion content for exercising expanded reading guides.',
            lines: [
              'This companion exists to make the reading guide long enough to collapse.',
              'It adds another follow-up path for companion pages.'
            ],
            editorial: {
              role: 'companion',
              sequence: 5
            }
          },
          {
            key: 'extraCompanionTwo',
            label: 'Deep dive 4',
            title: `${prefix} Collision walkthrough`,
            description: 'An extra worked-example page for expanded guide testing.',
            lines: [
              'This page gives the cluster another companion stop.',
              'Use it to confirm longer related lists stay usable.'
            ],
            editorial: {
              role: 'companion',
              sequence: 6
            }
          },
          {
            key: 'extraTextureOne',
            label: 'Background 2',
            title: `${prefix} Momentum in sports`,
            description: 'Extra context content for expanded guide testing.',
            lines: [
              'This texture page broadens the cluster with a lighter real-world angle.',
              'It helps generate a longer nearby-guide section.'
            ],
            editorial: {
              role: 'texture',
              sequence: 7
            }
          },
          {
            key: 'extraCompanionThree',
            label: 'Deep dive 5',
            title: `${prefix} Net force and momentum change`,
            description: 'Another companion page for expanded reading-guide coverage.',
            lines: [
              'This page adds more depth to the cluster and increases guide length.',
              'It should appear in either related reading or nearby guide links.'
            ],
            editorial: {
              role: 'companion',
              sequence: 8
            }
          },
          {
            key: 'extraTextureTwo',
            label: 'Background 3',
            title: `${prefix} Historical momentum experiments`,
            description: 'Background reading to make the cluster feel realistically varied.',
            lines: [
              'This texture page helps test how mixed-role blocks appear in a longer guide.',
              'It is intentionally part of the oversized dev cluster.'
            ],
            editorial: {
              role: 'texture',
              sequence: 9
            }
          },
          {
            key: 'extraCompanionFour',
            label: 'Deep dive 6',
            title: `${prefix} Solving momentum word problems`,
            description: 'A final companion page for oversized-guide test coverage.',
            lines: [
              'This page pushes the cluster past the normal preview threshold.',
              'Use it to confirm the expand/collapse behavior stays stable.'
            ],
            editorial: {
              role: 'companion',
              sequence: 10
            }
          }
        ]
      : [];

    const extraBlocks = [];
    for (const spec of extraBlockSpecs) {
      const doc = await createDemoBlock({
        roomId,
        lang,
        creator,
        title: spec.title,
        description: spec.description,
        tags,
        content: buildContent(spec.title.replace(`${prefix} `, ''), spec.lines),
        editorial: {
          clusterKey,
          guideTitle,
          role: spec.editorial.role,
          sequence: spec.editorial.sequence
        }
      });

      extraBlocks.push({
        key: spec.key,
        label: spec.label,
        doc,
        editorial: spec.editorial
      });
    }

    const extraBlockIds = extraBlocks.map((item) => String(item.doc._id));
    const companionOneRelatedIds = isExpandedGuideMode
      ? [
          String(companionTwo._id),
          String(texture._id),
          ...extraBlockIds
        ]
      : [
          String(companionTwo._id),
          String(texture._id)
        ];

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
                String(texture._id),
                ...(isExpandedGuideMode ? extraBlockIds.slice(0, 1) : [])
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
              relatedBlockIds: companionOneRelatedIds
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
                String(companionOne._id),
                ...(isExpandedGuideMode ? extraBlockIds.slice(0, 2) : [])
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
      ),
      ...extraBlocks.map((item, index) =>
        Block.updateOne(
          { _id: item.doc._id },
          {
            $set: {
              editorial: {
                clusterKey,
                guideTitle,
                role: item.editorial.role,
                primaryPillarBlockId: String(pillar._id),
                sequence: item.editorial.sequence,
                relatedBlockIds: [
                  String(companionOne._id),
                  ...(extraBlocks[index + 1] ? [String(extraBlocks[index + 1].doc._id)] : [])
                ]
              }
            }
          }
        )
      )
    ]);

    const blocks = [
      { label: 'Core guide', doc: pillar },
      { label: 'Deep dive 1', doc: companionOne },
      { label: 'Deep dive 2', doc: companionTwo },
      { label: 'Background', doc: texture },
      ...extraBlocks.map((item) => ({ label: item.label, doc: item.doc }))
    ];

    console.log('Seeded editorial demo cluster:', {
      roomId,
      lang,
      creator,
      mode,
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
    if (isExpandedGuideMode) {
      console.log('   In expanded-guide mode, the companion page has a long "Keep reading" section and the texture page has a long "More in this guide" section.');
    }
    console.log(`4. Optionally seed comments: node scripts/dev/seedBlockComments.js ${companionOne._id} 12`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
