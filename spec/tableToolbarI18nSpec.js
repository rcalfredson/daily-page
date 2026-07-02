import fs from 'node:fs';
import path from 'node:path';

import { SUPPORTED_UI_LANGS } from '../server/services/localeContext.js';

const toolbarPaths = [
  'insertTable',
  'insertTableHelp',
  'tableRows',
  'tableColumns',
  'tableSortable'
];

function readToolbar(lang) {
  const file = path.join(process.cwd(), 'i18n', lang, 'blockEditor.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).blockEditor.toolbar;
}

describe('table toolbar localization', () => {
  for (const lang of SUPPORTED_UI_LANGS) {
    it(`defines every table toolbar string directly in ${lang}`, () => {
      const toolbar = readToolbar(lang);

      for (const key of toolbarPaths) {
        expect(typeof toolbar[key]).withContext(`blockEditor.toolbar.${key}`).toBe('string');
        expect(toolbar[key].trim().length)
          .withContext(`blockEditor.toolbar.${key}`)
          .toBeGreaterThan(0);
      }
    });
  }
});
