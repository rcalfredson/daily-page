// server/utils/markdownHelper.js
import MarkdownIt from 'markdown-it';
const md = new MarkdownIt();

/**
 * Limpia y renderiza el contenido Markdown.
 *
 * @param {string} content - El contenido original.
 * @returns {string} - HTML renderizado o un placeholder si el contenido está vacío.
 */
export function renderMarkdownContent(content) {
  const cleanedContent = content ? content.replace(/\u200B/g, '').trim() : '';
  return cleanedContent.length > 0 ? md.render(cleanedContent) : '<p><em>(No content yet)</em></p>';
}
