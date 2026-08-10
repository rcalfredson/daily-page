import { isSupportedUiLang } from '../../server/services/localeContext.js';

function id(value) {
  return value == null ? '' : String(value);
}

function byCreatedAt(left, right) {
  const difference = new Date(left?.createdAt || 0) - new Date(right?.createdAt || 0);
  return difference || id(left?._id).localeCompare(id(right?._id));
}

export function planBlockLanguageMetadataBackfill(blocks) {
  const groups = new Map();
  for (const block of blocks || []) {
    const groupId = id(block?.groupId);
    if (!groupId) continue;
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(block);
  }

  const report = { families: groups.size, ready: [], ambiguous: [], operations: [] };

  for (const [groupId, unordered] of groups) {
    const family = unordered.slice().sort(byCreatedAt);
    const languages = new Set();
    const problems = [];
    for (const block of family) {
      const lang = String(block?.lang || '').trim().toLowerCase();
      if (!isSupportedUiLang(lang)) problems.push(`unsupported-language:${lang || 'missing'}`);
      if (languages.has(lang)) problems.push(`duplicate-language:${lang}`);
      languages.add(lang);
    }

    const byId = new Map(family.map(block => [id(block._id), block]));
    const referencedIds = new Set(
      family.map(block => id(block.originalBlock)).filter(sourceId => byId.has(sourceId))
    );
    const roots = family.filter(block => !block.originalBlock);
    let source = null;

    if (referencedIds.size === 1) source = byId.get([...referencedIds][0]);
    else if (referencedIds.size > 1) problems.push('multiple-referenced-sources');
    else if (roots.length === 1) source = roots[0];

    if (!source && roots.length > 1) problems.push('multiple-source-records');
    if (!source && roots.length === 0) problems.push('missing-source-record');
    if (source && source.originalBlock) problems.push('referenced-source-is-translation');
    if (source && roots.some(block => id(block._id) !== id(source._id))) {
      problems.push('multiple-source-records');
    }
    if (source?.sourceLanguage && source.sourceLanguage !== source.lang) {
      problems.push('conflicting-source-language');
    }

    if (problems.length) {
      report.ambiguous.push({
        groupId,
        blockIds: family.map(block => id(block._id)),
        apparentSourceBlockIds: roots.map(block => id(block._id)),
        referencedSourceBlockIds: [...referencedIds],
        problems: [...new Set(problems)],
        blocks: family.map(block => ({
          blockId: id(block._id),
          title: String(block.title || '').trim(),
          lang: String(block.lang || '').trim().toLowerCase(),
          roomId: String(block.roomId || '').trim(),
          originalBlock: id(block.originalBlock) || null,
          sourceLanguage: String(block.sourceLanguage || '').trim().toLowerCase() || null,
          createdAt: block.createdAt || null
        }))
      });
      continue;
    }

    report.ready.push({
      groupId,
      sourceBlockId: id(source._id),
      sourceLanguage: source.lang,
      variants: family.length
    });
    report.operations.push({
      updateOne: {
        filter: { _id: source._id },
        update: {
          $set: {
            sourceLanguage: source.lang,
            audienceScope: source.audienceScope || 'global',
            translationPriority: source.translationPriority || 'normal'
          }
        }
      }
    });

    for (const translation of family.filter(block => id(block._id) !== id(source._id))) {
      report.operations.push({
        updateOne: {
          filter: { _id: translation._id },
          update: {
            $set: { originalBlock: id(source._id) },
            $unset: {
              sourceLanguage: '',
              audienceScope: '',
              translationPriority: ''
            }
          }
        }
      });
    }
  }

  return report;
}
