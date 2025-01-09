import DateHelper from './dateHelper';
import RemoteCursor from './remoteCursor';

class Editor {
  constructor(mde) {
    this.controller = null;
    this.mde = mde;
    this.remoteCursors = {};
    this.customTabBehavior();
    // this.trackRemainingTime();
  }

  customTabBehavior() {
    this.mde.codemirror.setOption("extraKeys", {
      Tab: function (codemirror) {
        codemirror.replaceSelection("\t");
      }
    });
  }

  bindButtons() {
    const openInsertImgBtn = document.getElementById('open-insert-img-btn');
    const imgTooltip = document.getElementById('insert-img-tooltip');
    const insertImgConfirm = document.getElementById('insert-img-confirm');
    const insertImgCancel = document.getElementById('insert-img-cancel');
    const imgUrlInput = document.getElementById('img-url');
    const imgAltInput = document.getElementById('img-alt');

    // Toggle Tooltip Visibility
    openInsertImgBtn.addEventListener('click', () => {
      imgTooltip.classList.toggle('hidden');
    });

    // Insert Image
    insertImgConfirm.addEventListener('click', () => {
      const url = imgUrlInput.value.trim();
      const alt = imgAltInput.value.trim();
      if (!url) {
        alert('Please enter an image URL.');
        return;
      }
      const snippet = `![${alt}](${url})`;
      const cm = this.mde.codemirror;
      const pos = cm.getCursor();
      cm.replaceRange(snippet, pos, pos, 'insertText');
      imgTooltip.classList.add('hidden');
      imgUrlInput.value = '';
      imgAltInput.value = '';
      this.markImages();
    });

    // Cancel Insertion
    insertImgCancel.addEventListener('click', () => {
      imgTooltip.classList.add('hidden');
      imgUrlInput.value = '';
      imgAltInput.value = '';
    });
  }

  bindDownloadButton() {
    const dlButton = document.querySelector('#download');

    dlButton.onclick = () => {
      const textToSave = this.mde.value();
      const textAsBlob = new Blob([textToSave], { type: "text/plain" });
      const textAsURL = window.URL.createObjectURL(textAsBlob);
      const fileName = "DailyPage-" + Date.now();
      const downloadLink = document.createElement("a");

      downloadLink.download = fileName;
      downloadLink.innerHTML = "Download File";
      downloadLink.href = textAsURL;
      downloadLink.onclick = this.afterDownload;
      downloadLink.style.display = "none";

      document.body.appendChild(downloadLink);
      downloadLink.click();
    };
  }

  afterDownload(e, doc = document) {
    doc.body.removeChild(e.target);
  }

  bindChangeEvent() {
    this.mde.codemirror.on("change", (_, changeObj) => {
      if (changeObj.origin === "setValue") return;
      if (changeObj.origin === "insertText") return;
      if (changeObj.origin === "deleteText") return;

      switch (changeObj.origin) {
        case 'redo':
        case 'undo':
          this.processUndoRedo(changeObj);
          break;
        case '*compose':
        case '+input':
        //          this.processInsert(changeObj);    // uncomment this line for palindromes!
        case 'paste':
          this.processInsert(changeObj);
          break;
        case '+delete':
        case 'cut':
          this.processDelete(changeObj);
          break;
        default:
          throw new Error("Unknown operation attempted in editor.");
      }

      this.markImages();
    });
  }

  markImages() {
    // 1. Remover viejos marcadores (si quieres refrescar)
    const cm = this.mde.codemirror;
    cm.getAllMarks().forEach(mark => mark.clear());

    // 2. Iterar líneas
    const lineCount = cm.lineCount();
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;

    for (let i = 0; i < lineCount; i++) {
      let lineText = cm.getLine(i);
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        const altText = match[1];
        const imgUrl = match[2];

        // crear widget
        const imgNode = document.createElement('img');
        imgNode.src = imgUrl;
        imgNode.alt = altText;
        // controla ancho:
        imgNode.classList.add('markdown-img-preview');

        // 3. Reemplazar el texto con un widget
        const fromPos = { line: i, ch: match.index };
        const toPos = { line: i, ch: match.index + match[0].length };
        cm.markText(fromPos, toPos, {
          replacedWith: imgNode,
        });
      }
    }
  }

  currentContents() {
    return [...document.getElementsByClassName('CodeMirror-line')]
      .map(line => {
        // Recorrer los nodos hijos (text nodes, img widgets, etc.)
        return [...line.firstChild.childNodes].map(node => {

          if (node.nodeType === Node.TEXT_NODE) {
            // Texto normal, se concatena tal cual
            return node.textContent;
          }
          else if (node.nodeName === 'SPAN' &&
            node.classList.contains('CodeMirror-widget')) {
            // A veces CodeMirror envuelve el widget en un
            // <span class="CodeMirror-widget">
            // Si ese <span> tiene un <img> adentro...
            const maybeImg = node.querySelector('img');
            if (maybeImg) {
              const altText = maybeImg.alt || '';
              const imgUrl = maybeImg.src || '';
              return `![${altText}](${imgUrl})`;
            }
            // Si no es una imagen, devuélvelo como vacío o como prefieras
            return '';
          }
          else if (node.nodeName === 'IMG') {
            // Si el widget es directamente un <img>
            const altText = node.alt || '';
            const imgUrl = node.src || '';
            return `![${altText}](${imgUrl})`;
          }

          // Por si hubiera otros casos con nodos extraños
          return node.textContent || '';
        }).join('');
      })
      .join('\n');
  }

  processInsert(changeObj) {
    this.processDelete(changeObj);
    const chars = this.extractChars(changeObj.text);
    const startPos = changeObj.from;

    this.updateRemoteCursorsInsert(chars, changeObj.to);
    this.controller.localInsert(chars, startPos);
  }

  isEmpty(textArr) {
    return textArr.length === 1 && textArr[0].length === 0;
  }

  processDelete(changeObj) {
    if (this.isEmpty(changeObj.removed)) return;
    const startPos = changeObj.from;
    const endPos = changeObj.to;
    const chars = this.extractChars(changeObj.removed);

    this.updateRemoteCursorsDelete(chars, changeObj.to, changeObj.from);
    this.controller.localDelete(startPos, endPos);
  }

  processUndoRedo(changeObj) {
    if (changeObj.removed[0].length > 0) {
      this.processDelete(changeObj);
    } else {
      this.processInsert(changeObj);
    }
  }

  extractChars(text) {
    if (text[0] === '' && text[1] === '' && text.length === 2) {
      return '\n';
    } else {
      return text.join("\n");
    }
  }

  replaceText(text) {
    const cursor = this.mde.codemirror.getCursor();
    this.mde.value(text);
    this.mde.codemirror.setCursor(cursor);
    this.markImages();
  }

  insertText(value, positions, siteId) {
    const localCursor = this.mde.codemirror.getCursor();
    const delta = this.generateDeltaFromChars(value);

    this.mde.codemirror.replaceRange(value, positions.from, positions.to, 'insertText');
    this.updateRemoteCursorsInsert(positions.to, siteId);
    this.updateRemoteCursor(positions.to, siteId, 'insert', value);

    if (localCursor.line > positions.to.line) {
      localCursor.line += delta.line
    } else if (localCursor.line === positions.to.line && localCursor.ch > positions.to.ch) {
      if (delta.line > 0) {
        localCursor.line += delta.line
        localCursor.ch -= positions.to.ch;
      }

      localCursor.ch += delta.ch;
    }

    this.mde.codemirror.setCursor(localCursor);
    this.markImages();
  }

  removeCursor(siteId) {
    const remoteCursor = this.remoteCursors[siteId];

    if (remoteCursor) {
      remoteCursor.detach();

      delete this.remoteCursors[siteId];
    }
  }

  updateRemoteCursorsInsert(chars, position, siteId) {
    const positionDelta = this.generateDeltaFromChars(chars);

    for (const cursorSiteId in this.remoteCursors) {
      if (cursorSiteId === siteId) continue;
      const remoteCursor = this.remoteCursors[cursorSiteId];
      const newPosition = Object.assign({}, remoteCursor.lastPosition);

      if (newPosition.line > position.line) {
        newPosition.line += positionDelta.line;
      } else if (newPosition.line === position.line && newPosition.ch > position.ch) {
        if (positionDelta.line > 0) {
          newPosition.line += positionDelta.line;
          newPosition.ch -= position.ch;
        }

        newPosition.ch += positionDelta.ch;
      }

      remoteCursor.set(newPosition)
    }
  }

  updateRemoteCursorsDelete(chars, to, from, siteId) {
    const positionDelta = this.generateDeltaFromChars(chars);

    for (const cursorSiteId in this.remoteCursors) {
      if (cursorSiteId === siteId) continue;
      const remoteCursor = this.remoteCursors[cursorSiteId];
      const newPosition = Object.assign({}, remoteCursor.lastPosition);

      if (newPosition.line > to.line) {
        newPosition.line -= positionDelta.line;
      } else if (newPosition.line === to.line && newPosition.ch > to.ch) {
        if (positionDelta.line > 0) {
          newPosition.line -= positionDelta.line;
          newPosition.ch += from.ch;
        }

        newPosition.ch -= positionDelta.ch;
      }

      remoteCursor.set(newPosition)
    }
  }

  updateRemoteCursor(position, siteId, opType, value) {
    const remoteCursor = this.remoteCursors[siteId];
    const clonedPosition = Object.assign({}, position);

    if (opType === 'insert') {
      if (value === '\n') {
        clonedPosition.line++;
        clonedPosition.ch = 0
      } else {
        clonedPosition.ch++;
      }
    } else {
      clonedPosition.ch--;
    }

    if (remoteCursor) {
      remoteCursor.set(clonedPosition);
    } else {
      this.remoteCursors[siteId] = new RemoteCursor(this.mde, siteId, clonedPosition);
    }
  }

  deleteText(value, positions, siteId) {
    const localCursor = this.mde.codemirror.getCursor();
    const delta = this.generateDeltaFromChars(value);

    this.mde.codemirror.replaceRange("", positions.from, positions.to, 'deleteText');
    this.updateRemoteCursorsDelete(positions.to, siteId);
    this.updateRemoteCursor(positions.to, siteId, 'delete');

    if (localCursor.line > positions.to.line) {
      localCursor.line -= delta.line;
    } else if (localCursor.line === positions.to.line && localCursor.ch > positions.to.ch) {
      if (delta.line > 0) {
        localCursor.line -= delta.line;
        localCursor.ch += positions.from.ch;
      }

      localCursor.ch -= delta.ch;
    }

    this.mde.codemirror.setCursor(localCursor);
  }

  findLinearIdx(lineIdx, chIdx) {
    const linesOfText = this.controller.crdt.text.split("\n");

    let index = 0
    for (let i = 0; i < lineIdx; i++) {
      index += linesOfText[i].length + 1;
    }

    return index + chIdx;
  }

  generateDeltaFromChars(chars) {
    const delta = { line: 0, ch: 0 };
    let counter = 0;

    while (counter < chars.length) {
      if (chars[counter] === '\n') {
        delta.line++;
        delta.ch = 0;
      } else {
        delta.ch++;
      }

      counter++;
    }

    return delta;
  }

  trackRemainingTime() {
    setInterval(() => {
      const now = new Date().getTime();
      const timeLeftElement = document.getElementById('time-left');
      const closingSoonInfoBox = document.getElementById('closing-soon-infobox');
      const displayed = (DateHelper.closingTime() - now) <= 10 * 60 * 1000;

      timeLeftElement.innerText = DateHelper.roundedDuration(DateHelper.closingTime() - now);
      closingSoonInfoBox.style.visibility = displayed ? 'visible' : 'hidden';
    }, 1000);
  }
}

export default Editor;
