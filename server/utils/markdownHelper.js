// server/utils/markdownHelper.js
import MarkdownIt from 'markdown-it';

/**
 * Instancia de Markdown-It.
 * - html: false (por seguridad, evita HTML crudo)
 * - linkify: true (URLs -> <a>)
 * - breaks: false (respeta párrafos)
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false
});

/** ---------- Helpers de HTML post-render ---------- */

/**
 * Envuelve <table> en contenedores scroll para overflow horizontal.
 * Mantiene tu comportamiento existente.
 * @param {string} html
 * @returns {string}
 */
function wrapTables(html) {
  return html
    .replace(
      /<table>/g,
      '<div class="table-scroll-container"><div class="table-scroll-wrapper"><table>'
    )
    .replace(/<\/table>/g, '</table></div></div>');
}

/** ---------- Core de render, compartido por full/preview ---------- */

/**
 * Renderiza Markdown a HTML. Si mode === 'preview', recorta de forma "token-aware"
 * para no romper estructuras (tablas, listas, párrafos, etc.).
 *
 * @param {string} content
 * @param {{ mode?: 'full'|'preview', previewOpts?: PreviewOptions }} [opts]
 * @returns {string}
 */
function renderCore(content, { mode = 'full', previewOpts = {} } = {}) {
  const cleaned = content ? content.replace(/\u200B/g, '').trim() : '';

  if (mode === 'full') {
    const html = cleaned
      ? md.render(cleaned)
      : '<p><em>(No content yet)</em></p>';
    return wrapTables(html);
  }

  // mode === 'preview' → siempre objeto:
  if (!cleaned) return { html: '<p><em>(No content yet)</em></p>', truncated: false };

  // mode === 'preview'
  const tokens = md.parse(cleaned, {});
  let { html, truncated } = renderPreviewFromTokens(tokens, previewOpts, md);
  html = wrapTables(html);
  return { html, truncated };
}

/** ---------- Preview "token-aware" ---------- */

/**
 * @typedef {Object} PreviewOptions
 * @property {number} [maxChars=1400]              - Límite aprox. de caracteres visibles.
 * @property {boolean} [includeWholeTables=true]   - Si el corte cae dentro de una tabla, extiende hasta </table>.
 * @property {boolean} [includeWholeFences=true]   - Si el corte cae dentro de un code fence, extiende hasta su cierre.
 * @property {boolean} [allowImages=false]         - Si false, el texto de imágenes no cuenta y las <img> pueden omitirse.
 * @property {string}  [ellipsis='…']              - Indicador de truncamiento al final.
 */

/**
 * Recorre tokens de markdown-it, cuenta texto visible y corta en límites de bloque.
 * Conserva estructura válida y cierra tablas/listas/bloques si aplica.
 *
 * @param {import('markdown-it/lib/token')[]} tokens
 * @param {PreviewOptions} opts
 * @param {MarkdownIt} mdInstance
 * @returns {string} HTML
 */
function renderPreviewFromTokens(tokens, opts, mdInstance) {
  const {
    maxChars = 1400,
    includeWholeTables = true,
    includeWholeFences = true,
    allowImages = false,
    ellipsis = '…'
  } = opts || {};

  // Pila para rastrear en qué bloque estamos (p.ej., 'table_open', 'list_item_open', etc.)
  const stack = [];
  let charCount = 0;
  let endIdx = tokens.length - 1; // por defecto, todo
  let truncated = false;

  const pushIfOpen = (tok) => {
    if (tok.type.endsWith('_open')) stack.push(tok.type);
  };
  const popIfClose = (tok) => {
    if (tok.type.endsWith('_close') && stack.length) stack.pop();
  };

  const isInside = (typeOpen) => stack.includes(typeOpen);

  const countInlineVisible = (inlineTok) => {
    if (!inlineTok.children || inlineTok.children.length === 0) {
      return inlineTok.content ? inlineTok.content.length : 0;
    }
    // Cuenta solo texto visible. Si allowImages=false, ignora 'image'
    let n = 0;
    for (const ch of inlineTok.children) {
      if (ch.type === 'image' && !allowImages) continue;
      if (ch.content) n += ch.content.length;
    }
    return n;
  };

  // Recorremos tokens sumando caracteres visibles y encontramos punto de corte
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type.endsWith('_open')) pushIfOpen(tok);

    if (tok.type === 'inline') {
      charCount += countInlineVisible(tok);
    } else if (tok.type === 'code_block' || tok.type === 'fence') {
      // Los code blocks muestran su contenido íntegro; cuenta su longitud.
      charCount += (tok.content || '').length;
    }

    if (charCount >= maxChars) {
      truncated = true;
      endIdx = i;

      // Si caímos dentro de tabla y queremos incluirla completa, avanza a table_close
      if (includeWholeTables && isInside('table_open')) {
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === 'table_close') {
            endIdx = j;
            break;
          }
        }
      }
      // Si caímos dentro de un fence/code_block y queremos incluirlo completo, avanza a su *_close
      else if (
        includeWholeFences &&
        (tok.type === 'fence' || tok.type === 'code_block')
      ) {
        endIdx = i; // el bloque de código completo ya quedó incluido
      } // (Opcional) si el corte cayó justo ANTES y lo siguiente es fence, inclúyelo entero:
      else if (
        includeWholeFences &&
        (tokens[i + 1]?.type === 'fence' || tokens[i + 1]?.type === 'code_block')
      ) {
        endIdx = i + 1; // nos “estiramos” para cubrir el fence entero
      } else if (stack.length) {
        // En otros casos, intentamos cerrar el bloque actual:
        // buscamos el primer *_close correspondiente al tope de la pila
        const top = stack[stack.length - 1]; // e.g., 'paragraph_open'
        const expectedClose = top.replace('_open', '_close');
        for (let j = i; j < tokens.length; j++) {
          if (tokens[j].type === expectedClose) {
            endIdx = j;
            break;
          }
        }
      }

      break;
    }

    if (tok.type.endsWith('_close')) popIfClose(tok);
  }

  const slice = tokens.slice(0, endIdx + 1);

  // Si no queremos que aparezcan imágenes en el preview, podemos filtrar tokens <image>
  // de forma no destructiva (opcional; si prefieres conservar <img> pero no contarlas,
  // comenta este bloque).
  if (!allowImages) {
    for (const t of slice) {
      if (t.type === 'inline' && Array.isArray(t.children)) {
        t.children = t.children.filter((ch) => ch.type !== 'image');
      }
    }
  }

  let html = mdInstance.renderer.render(slice, mdInstance.options, {});
  if (truncated && ellipsis) {
    html += `<p class="preview-ellipsis">${ellipsis}</p>`;
  }
  return { html, truncated };
}

/** ---------- API Pública ---------- */

/**
 * Render FULL (completo).
 * @param {string} content
 * @returns {string}
 */
export function renderMarkdownFull(content) {
  return renderCore(content, { mode: 'full' });
}

/**
 * Render PREVIEW (recortado, sin romper HTML).
 * @param {string} content
 * @param {PreviewOptions} [opts]
 * @returns {string}
 */
export function renderMarkdownPreview(content, opts) {
  return renderCore(content, { mode: 'preview', previewOpts: opts });
}

/**
 * Alias histórico para compatibilidad: antes se llamaba renderMarkdownContent.
 * Equivale a renderMarkdownFull.
 * @param {string} content
 * @returns {string}
 */
export function renderMarkdownContent(content) {
  return renderMarkdownFull(content);
}
