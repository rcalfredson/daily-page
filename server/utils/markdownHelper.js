import MarkdownIt from 'markdown-it';
const md = new MarkdownIt();

/**
 * Limpia y renderiza el contenido Markdown.
 * Además, envuelve tablas en un contenedor scrollable.
 *
 * @param {string} content - El contenido original.
 * @returns {string} - HTML renderizado con ajustes.
 */
export function renderMarkdownContent(content) {
  const cleanedContent = content ? content.replace(/\u200B/g, '').trim() : '';
  if (cleanedContent.length === 0) {
    return '<p><em>(No content yet)</em></p>';
  }

  let html = md.render(cleanedContent);

  // Wrap <table> in .table-scroll-wrapper
  html = html.replace(
    /<table>/g,
    '<div class="table-scroll-container"><div class="table-scroll-wrapper"><table>'
  ).replace(
    /<\/table>/g,
    '</table></div></div>'
  );

  return html;
}
