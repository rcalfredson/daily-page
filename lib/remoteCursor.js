import CSS_COLORS from './cssColors.js';
import { generateItemFromHash } from './hashAlgo.js';
import { getCursorNameForSite } from './cursorHelper.js';

export default class RemoteCursor {
  constructor(mde, siteId, position) {
    this.mde = mde;

    const color = generateItemFromHash(siteId, CSS_COLORS);
    const name = getCursorNameForSite(siteId);

    this.createCursor(color);
    this.createFlag(color, name);

    this.set(position);
  }

  createCursor(color) {
    const textHeight = this.mde.codemirror.defaultTextHeight();

    this.cursor = document.createElement('div');
    this.cursor.classList.add('remote-cursor');
    this.cursor.style.backgroundColor = color;
    this.cursor.style.height = textHeight + 'px';
  }

  createFlag(color, name) {
    const cursorName = document.createTextNode(name);

    this.flagLine = document.createElement('div');
    this.flagLine.classList.add('remote-cursor-flag-line');

    this.flag = document.createElement('span');
    this.flag.classList.add('flag');
    this.flag.style.backgroundColor = color;
    this.flag.appendChild(cursorName);
    this.flagLine.appendChild(this.flag);
  }

  set(position) {
    this.detach();

    const coords = this.mde.codemirror.cursorCoords(position, 'local');
    const left = coords.left >= 0 ? coords.left : 0;
    this.cursor.style.left = left + 'px';
    this.flagLine.style.marginLeft = left + 'px';
    this.bookmark = this.mde.codemirror.getDoc().setBookmark(position, { widget: this.cursor });
    this.lineWidget = this.mde.codemirror.addLineWidget(position.line, this.flagLine, { above: true });
    this.lastPosition = position;
  }

  detach() {
    if (this.bookmark) {
      this.bookmark.clear();
      this.bookmark = null;
    } else if (this.cursor.parentElement) {
      this.cursor.parentElement.remove();
    }

    if (this.lineWidget) {
      this.lineWidget.clear();
      this.lineWidget = null;
    }
  }
}
