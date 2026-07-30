import fs from 'node:fs';

const globalStyles = fs.readFileSync('public/css/style.css', 'utf8');
const layout = fs.readFileSync('views/layout.pug', 'utf8');

describe('UI typography', () => {
  const weights = ['Light', 'Regular', 'Medium'];
  const latinLocales = [
    'cs', 'da', 'de', 'en', 'es', 'fi', 'fr', 'id',
    'it', 'nl', 'no', 'pl', 'pt', 'sv', 'tr', 'vi'
  ];
  const rubikLocales = ['he', 'ru'];
  const notoFamilies = new Map([
    ['ar', 'Noto Sans Arabic'],
    ['el', 'Noto Sans'],
    ['hi', 'Noto Sans Devanagari'],
    ['ja', 'Noto Sans JP'],
    ['ko', 'Noto Sans KR'],
    ['th', 'Noto Sans Thai'],
    ['zh', 'Noto Sans SC']
  ]);

  it('bundles Be Vietnam Pro as the default UI family', () => {
    for (const weight of weights) {
      expect(fs.existsSync(`public/assets/fonts/BeVietnamPro-${weight}.ttf`)).toBeTrue();
      expect(globalStyles).toContain(`font-family: 'BeVietnamPro-${weight}'`);
      expect(globalStyles).toContain(`url('../assets/fonts/BeVietnamPro-${weight}.ttf')`);
      expect(globalStyles).toContain(`--font-ui-${weight.toLowerCase()}: 'BeVietnamPro-${weight}'`);
    }
  });

  it('uses Be for Latin text before Rubik supplies Russian and Hebrew scripts', () => {
    const localeRule = globalStyles.match(/html:lang\(ru\),[\s\S]*?\n\}/)?.[0] || '';

    expect(localeRule).toContain('html:lang(he)');
    expect(localeRule).toContain("--font-ui-light: 'BeVietnamPro-Light', 'Rubik-Light'");
    expect(localeRule).toContain("--font-ui-regular: 'BeVietnamPro-Regular', 'Rubik-Regular'");
    expect(localeRule).toContain("--font-ui-medium: 'BeVietnamPro-Medium', 'Rubik-Medium'");
  });

  it('uses Be for Latin text before each remaining script-specific Noto family', () => {
    for (const [locale, family] of notoFamilies) {
      expect(layout).toContain(`${locale}: '${family.replaceAll(' ', '+')}'`);
      expect(globalStyles).toContain(`html:lang(${locale})`);
      expect(globalStyles)
        .toContain(`--font-ui-regular: 'BeVietnamPro-Regular', '${family}'`);
    }

    expect(layout).toContain('wght@300..800');
    expect(layout).toContain('href="https://fonts.gstatic.com" crossorigin');
  });

  it('assigns every supported locale to a font with matching script coverage', () => {
    const supportedLocales = fs.readdirSync('i18n', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const assignedLocales = [
      ...latinLocales,
      ...rubikLocales,
      ...notoFamilies.keys()
    ].sort();

    expect(assignedLocales).toEqual(supportedLocales);
  });

  it('preloads Be Vietnam Pro and keeps it on the Latin wordmark', () => {
    expect(layout).toContain('href="/assets/fonts/BeVietnamPro-Light.ttf"');
    expect(layout).toContain('href="/assets/fonts/BeVietnamPro-Medium.ttf"');
    expect(layout).toContain('span.logo Daily Page');
    expect(globalStyles.match(/\.logo \{[\s\S]*?\n\}/)?.[0] || '')
      .toContain("font-family: 'BeVietnamPro-Medium'");
    expect(globalStyles).not.toContain('--font-rubik-');
  });
});
