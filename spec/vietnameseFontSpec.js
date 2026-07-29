import fs from 'node:fs';

const globalStyles = fs.readFileSync('public/css/style.css', 'utf8');
const layout = fs.readFileSync('views/layout.pug', 'utf8');

describe('Vietnamese UI typography', () => {
  const weights = ['Light', 'Regular', 'Medium'];

  it('bundles and declares each Be Vietnam Pro weight used by the UI', () => {
    for (const weight of weights) {
      expect(fs.existsSync(`public/assets/fonts/BeVietnamPro-${weight}.ttf`)).toBeTrue();
      expect(globalStyles).toContain(`font-family: 'BeVietnamPro-${weight}'`);
      expect(globalStyles).toContain(`url('../assets/fonts/BeVietnamPro-${weight}.ttf')`);
    }
  });

  it('replaces every Rubik role for Vietnamese pages', () => {
    const localeRule = globalStyles.match(/html:lang\(vi\) \{[\s\S]*?\n\}/)?.[0] || '';

    expect(localeRule).toContain("--font-rubik-light: 'BeVietnamPro-Light'");
    expect(localeRule).toContain("--font-rubik-regular: 'BeVietnamPro-Regular'");
    expect(localeRule).toContain("--font-rubik-medium: 'BeVietnamPro-Medium'");
  });

  it('preloads the locale-appropriate primary weights', () => {
    expect(layout).toContain("if htmlLang === 'vi'");
    expect(layout).toContain('href="/assets/fonts/BeVietnamPro-Light.ttf"');
    expect(layout).toContain('href="/assets/fonts/BeVietnamPro-Medium.ttf"');
  });
});
