import fs from 'node:fs';

const localeRoot = 'i18n';
const noSpaceAfterComma = new Set(['ja', 'zh']);

describe('localized login greetings', () => {
  it('separates comma-terminated prefixes from the username where required', () => {
    const locales = fs.readdirSync(localeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const locale of locales) {
      const nav = JSON.parse(fs.readFileSync(`${localeRoot}/${locale}/nav.json`, 'utf8'));
      const prefix = nav.nav.auth.welcomePrefix;
      const endsWithComma = /[,،、，]\s*$/.test(prefix);

      if (endsWithComma && !noSpaceAfterComma.has(locale)) {
        expect(prefix)
          .withContext(`${locale} welcomePrefix must include spacing before the username`)
          .toMatch(/\s$/);
      }
    }
  });
});
