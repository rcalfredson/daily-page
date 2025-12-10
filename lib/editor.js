import { getCurrentLang } from './cursorHelper';
import DateHelper from './dateHelper';
import RequestHelper from './requestHelper';
import RemoteCursor from './remoteCursor';
import {
  alreadyPingedToday,
  streakPing
} from './streakHelper';

class Editor {
  constructor(mde) {
    this.controller = null;
    this.mde = mde;
    this.remoteCursors = {};
    this.imageMarks = [];
    this.customTabBehavior();
    this.markImages = RequestHelper.throttle(this.markImages.bind(this), 250)
    // this.trackRemainingTime();
  }

  customTabBehavior() {
    this.mde.codemirror.setOption("extraKeys", {
      Tab: function (codemirror) {
        codemirror.replaceSelection("\t");
      }
    });
  }

  toggleTooltip = () => {
    const imgTooltip = document.getElementById('insert-img-tooltip');
    imgTooltip.classList.toggle('hidden');
  };

  simulateTyping(snippet, pos, callback) {
    const cm = this.mde.codemirror;
    let index = 0;
    const typeNext = () => {
      if (index < snippet.length) {
        // Insert one character at a time using '+input'
        cm.replaceRange(snippet.charAt(index), pos, pos, '+input');
        pos = cm.getCursor(); // update the cursor position
        index++;
        setTimeout(typeNext, 50); // tiny pause between keystrokes
      } else {
        if (callback) callback();
      }
    };
    typeNext();
  }

  insertImage = () => {
    const imgTooltip = document.getElementById('insert-img-tooltip');
    const imgUrlInput = document.getElementById('img-url');
    const imgAltInput = document.getElementById('img-alt');
    const cm = this.mde.codemirror;

    const url = imgUrlInput.value.trim();
    const alt = imgAltInput.value.trim();
    if (!url) {
      alert('Please enter an image URL.');
      return;
    }

    const snippet = `![${alt}](${url})`;
    const pos = cm.getCursor();
    // Simulate typing to insert the snippet so the CRDT sees each change
    this.simulateTyping(snippet, pos, () => {
      this.markImages();
    });

    imgTooltip.classList.add('hidden');
    imgUrlInput.value = '';
    imgAltInput.value = '';
  };

  cancelInsertion = () => {
    const imgTooltip = document.getElementById('insert-img-tooltip');
    const imgUrlInput = document.getElementById('img-url');
    const imgAltInput = document.getElementById('img-alt');

    imgTooltip.classList.add('hidden');
    imgUrlInput.value = '';
    imgAltInput.value = '';
  };

  bindButtons() {
    const openInsertImgBtn = document.getElementById('open-insert-img-btn');
    const imgTooltip = document.getElementById('insert-img-tooltip');
    const insertImgConfirm = document.getElementById('insert-img-confirm');
    const insertImgCancel = document.getElementById('insert-img-cancel');
    const imgUrlInput = document.getElementById('img-url');
    const imgAltInput = document.getElementById('img-alt');

    if (!openInsertImgBtn ||
      !imgTooltip ||
      !insertImgConfirm ||
      !insertImgCancel ||
      !imgUrlInput ||
      !imgAltInput) {
      console.warn("Warning: Some image insertion UI elements are missing. Skipping bindButtons.");
      return;
    }

    // Ensure no duplicate listeners
    openInsertImgBtn.removeEventListener('click', this.toggleTooltip);
    openInsertImgBtn.addEventListener('click', this.toggleTooltip);

    insertImgConfirm.removeEventListener('click', this.insertImage);
    insertImgConfirm.addEventListener('click', this.insertImage);

    insertImgCancel.removeEventListener('click', this.cancelInsertion);
    insertImgCancel.addEventListener('click', this.cancelInsertion);
  }

  bindDownloadButton() {
    const dlButton = document.querySelector('#download');
    if (!dlButton) {
      console.warn("Warning: Download button is missing. Skipping bindDownloadButton.");
      return;
    }

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
    if (e.target && e.target.parentNode) {
      doc.body.removeChild(e.target);
    }
  }

  bindChangeEvent() {
    this.mde.codemirror.on("change", (_, changeObj) => {
      if (changeObj.origin === "setValue") return;
      if (changeObj.origin === "insertText") return;
      if (changeObj.origin === "deleteText") {
        setTimeout(() => this.markImages(), 50);
        return;
      }

      if (!alreadyPingedToday()) {
        streakPing();
      }

      switch (changeObj.origin) {
        case 'redo':
        case 'undo':
          this.processUndoRedo(changeObj);
          break;
        case '*compose':
        case '+input':
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

  clearImagePreviews() {
    // Clear stored markers rather than querying the DOM
    this.imageMarks.forEach(marker => marker.clear());
    this.imageMarks = [];
  }

  markImages() {
    const cm = this.mde.codemirror;
    // Clear previous markers/widgets
    this.clearImagePreviews();

    const lineCount = cm.lineCount();
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;

    for (let i = 0; i < lineCount; i++) {
      const lineText = cm.getLine(i);
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        const altText = match[1];
        const imgUrl = match[2].trim();

        if (!/^https?:\/\//.test(imgUrl)) continue;

        // Define the start and end positions of the markdown tag
        const startPos = { line: i, ch: match.index };
        const endPos = { line: i, ch: match.index + match[0].length };

        // Create an image node that will replace the text visually
        const imgNode = document.createElement("img");
        imgNode.src = imgUrl;
        imgNode.alt = altText;
        imgNode.style.maxWidth = "200px";
        imgNode.style.verticalAlign = "middle"; // Adjust alignment if needed
        imgNode.style.pointerEvents = "none";

        imgNode.onload = () => {
          cm.refresh();
        };

        // Use markText with replacedWith so the widget is inline
        const marker = cm.markText(startPos, endPos, {
          replacedWith: imgNode,
          clearOnEnter: true // widget is cleared on edit in that area
        });

        // Store the marker so we can clear it later
        this.imageMarks.push(marker);
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
          return node.textContent || node.outerHTML || '';
        }).join('');
      })
      .join('\n');
  }

  processInsert(changeObj) {
    if (!this.isEmpty(changeObj.removed)) {
      this.processDelete(changeObj);
    }
    const chars = this.extractChars(changeObj.text);
    const startPos = changeObj.from;

    this.updateRemoteCursorsInsert(chars, changeObj.to);
    this.controller.localInsert(chars, startPos);
  }

  isEmpty(textArr) {
    return textArr.length === 0 || (textArr.length === 1 && textArr[0] === '');
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
    if (changeObj.removed.length > 0 && !this.isEmpty(changeObj.removed)) {
      this.processDelete(changeObj);
    } else {
      this.processInsert(changeObj);
    }
  }

  extractChars(text) {
    return text.length === 1 && text[0] === '' ? '\n' : text.join("\n");
  }

  replaceText(text) {
    const cm = this.mde.codemirror;
    cm.operation(() => {
      cm.setValue(text);
    });
    this.markImages();
  }

  insertText(value, positions, siteId) {
    const cm = this.mde.codemirror;
    const localCursor = cm.getCursor();
    const delta = this.generateDeltaFromChars(value);

    cm.replaceRange(value, positions.from, positions.to, 'insertText');
    this.updateRemoteCursorsInsert(positions.to, siteId);
    this.updateRemoteCursor(positions.to, siteId, 'insert', value);

    if (localCursor.line > positions.to.line) {
      localCursor.line += delta.line;
    } else if (localCursor.line === positions.to.line && localCursor.ch > positions.to.ch) {
      if (delta.line > 0) {
        localCursor.line += delta.line;
        localCursor.ch -= positions.to.ch;
      }
      localCursor.ch += delta.ch;
    }

    cm.setCursor(localCursor);
    this.markImages();
  }

  removeCursor(siteId) {
    if (this.remoteCursors[siteId]) {
      this.remoteCursors[siteId].detach();
      delete this.remoteCursors[siteId];
    }
  }

  updateRemoteCursorsInsert(chars, position, siteId) {
    const positionDelta = this.generateDeltaFromChars(chars);

    for (const cursorSiteId in this.remoteCursors) {
      if (cursorSiteId === siteId) continue;

      const remoteCursor = this.remoteCursors[cursorSiteId];
      const newPosition = { ...remoteCursor.lastPosition };

      if (newPosition.line > position.line) {
        newPosition.line += positionDelta.line;
      } else if (newPosition.line === position.line && newPosition.ch > position.ch) {
        if (positionDelta.line > 0) {
          newPosition.line += positionDelta.line;
          newPosition.ch -= position.ch;
        }
        newPosition.ch += positionDelta.ch;
      }

      remoteCursor.set(newPosition);
    }
  }

  updateRemoteCursorsDelete(chars, to, from, siteId) {
    const positionDelta = this.generateDeltaFromChars(chars);

    for (const cursorSiteId in this.remoteCursors) {
      if (cursorSiteId === siteId) continue;
      const remoteCursor = this.remoteCursors[cursorSiteId];
      const newPosition = { ...remoteCursor.lastPosition };

      if (newPosition.line > to.line) {
        newPosition.line -= positionDelta.line;
      } else if (newPosition.line === to.line && newPosition.ch > to.ch) {
        if (positionDelta.line > 0) {
          newPosition.line -= positionDelta.line;
          newPosition.ch = from.ch;
        }
        newPosition.ch -= positionDelta.ch;
      }

      remoteCursor.set(newPosition);
    }
  }

  updateRemoteCursor(position, siteId, opType, value) {
    const remoteCursor = this.remoteCursors[siteId];
    const clonedPosition = { ...position };

    if (opType === 'insert') {
      if (value === '\n') {
        clonedPosition.line++;
        clonedPosition.ch = 0;
      } else {
        clonedPosition.ch++;
      }
    } else {
      clonedPosition.ch = Math.max(0, clonedPosition.ch - 1);
    }

    if (remoteCursor) {
      remoteCursor.set(clonedPosition);
    } else {
      this.remoteCursors[siteId] = new RemoteCursor(this.mde, siteId, clonedPosition);
    }
  }

  deleteText(value, positions, siteId) {
    const cm = this.mde.codemirror;
    const localCursor = cm.getCursor();
    const delta = this.generateDeltaFromChars(value);

    cm.operation(() => {
      cm.replaceRange("", positions.from, positions.to, 'deleteText');
      this.updateRemoteCursorsDelete(value, positions.to, positions.from, siteId);
      this.updateRemoteCursor(positions.to, siteId, 'delete');

      if (localCursor.line > positions.to.line) {
        localCursor.line -= delta.line;
      } else if (localCursor.line === positions.to.line && localCursor.ch > positions.to.ch) {
        localCursor.line -= delta.line;
        localCursor.ch = delta.line > 0 ? positions.from.ch : localCursor.ch - delta.ch;
      }

      cm.setCursor(localCursor);
    });
  }

  findLinearIdx(lineIdx, chIdx) {
    const linesOfText = (this.controller.crdt.text || '').split("\n");

    let index = 0;
    for (let i = 0; i < Math.min(lineIdx, linesOfText.length); i++) {
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
    let lastTimeLeft = null;

    setInterval(() => {
      const now = Date.now();
      const timeLeft = DateHelper.closingTime() - now;
      const timeLeftElement = document.getElementById('time-left');
      const closingSoonInfoBox = document.getElementById('closing-soon-infobox');
      const displayed = timeLeft <= 10 * 60 * 1000;

      if (lastTimeLeft !== timeLeft) {
        const lang = getCurrentLang();
        timeLeftElement.innerText = DateHelper.roundedDurationI18n(timeLeft, lang);
        lastTimeLeft = timeLeft;
      }

      closingSoonInfoBox.style.visibility = displayed ? 'visible' : 'hidden';
    }, 1000);
  }
}

export default Editor;
