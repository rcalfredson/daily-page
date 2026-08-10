import Block from '../server/db/models/Block.js';

describe('block language family metadata schema', () => {
  function validBlock(overrides = {}) {
    return new Block({
      title: 'Language metadata post',
      roomId: 'general',
      creator: 'writer',
      groupId: 'family-id',
      lang: 'cs',
      ...overrides
    });
  }

  it('accepts supported source metadata and editorial enums', async () => {
    const source = validBlock({
      sourceLanguage: 'cs',
      audienceScope: 'regional',
      translationPriority: 'high'
    });

    await expectAsync(source.validate()).toBeResolved();
  });

  it('rejects unsupported locale and editorial values', async () => {
    const invalid = validBlock({
      sourceLanguage: 'xx',
      audienceScope: 'planetary',
      translationPriority: 'urgent'
    });

    await expectAsync(invalid.validate()).toBeRejected();
  });
});
