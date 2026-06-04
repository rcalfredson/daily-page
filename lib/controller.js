import BackendHelper from './backendHelper.js';
import DateHelper from './dateHelper.js';
import CRDT from './crdt.js';
import Char from './char.js';
import Identifier from './identifier.js';
import VersionVector from './versionVector.js';
import Version from './version.js';
import { v4 } from 'uuid';
import { generateItemFromHash } from './hashAlgo.js';
import CSS_COLORS from './cssColors.js';
import { getCursorNameForSite } from './cursorHelper.js';
import { getUiLang } from './langContext.js';

/* global showToast */

class Controller {
  constructor(targetPeerId, roomId, blockId, host, peer, broadcast, editor, doc = document, win = window) {
    this.siteId = v4();
    this.doc = doc;
    this.win = win;
    this.host = host;
    this.buffer = [];
    this.calling = [];
    this.network = [];
    this.targetPeerId = targetPeerId;
    this.roomId = roomId;
    this.blockId = blockId;
    this.lastLocalInsertTime = new Date().getTime();
    this.hasLocalUserEdits = false;
    this.hasMarkedCollaborator = false;
    this.isMarkingCollaborator = false;
    this.peerPresenceId = null;
    this.peerPresenceIntervalId = null;
    this.removePeerPresenceOnExit = null;
    this.isLocked = false;
    this.isReadyForLocalEdits = false;
    this.backupHydrationRequestId = 0;
    this.makeOwnName(doc);
    this.setTimedActions(doc, win);

    this.broadcast = broadcast;
    this.broadcast.controller = this;
    this.broadcast.bindServerEvents(targetPeerId, peer);

    this.editor = editor;
    this.editor.controller = this;
    this.editor.bindChangeEvent();
    this.editor.setReadOnly(true);

    this.vector = new VersionVector(this.siteId);
    this.crdt = new CRDT(this);
    this.editor.bindButtons();
    this.bindCopyEvent(doc);

    if (targetPeerId == 0) {
      this.useBackupContent();
    }
  }

  setTimedActions(doc = this.doc, win = this.win) {
    if (typeof window === 'undefined') return;

    // Check lock status right away to avoid a "grace window" on locked blocks
    this.checkBlockStatus();

    setInterval(() => {
      this.backupChanges()
    }, 16000);

    setInterval(() => {
      this.updateSaveStatus();
    }, 5000);

    this.redirectInactive(doc, win);
  }

  bindCopyEvent(doc = this.doc) {
    const copyBtn = doc.querySelector('.copy-container');
    if (!copyBtn) return;

    copyBtn.onclick = () => {
      const linkSpan = doc.getElementById('myLinkInput');
      if (!linkSpan) return;
      this.copyToClipboard(linkSpan.textContent.trim());
    };
  }

  copyToClipboard(text) {
    const temp = document.createElement("input");
    document.body.appendChild(temp);
    temp.value = text;
    temp.select();
    document.execCommand("copy");
    temp.remove();

    this.showCopiedStatus();
  }

  showCopiedStatus() {
    document.querySelector('.copy-status').classList.add('copied');

    setTimeout(() => document.querySelector('.copy-status').classList.remove('copied'), 1000);
  }

  attachEvents(doc = document, win = window) {
    let xPos = 0;
    let yPos = 0;
    const modal = doc.querySelector('.video-modal');
    const dragModal = e => {
      xPos = e.clientX - modal.offsetLeft;
      yPos = e.clientY - modal.offsetTop;
      win.addEventListener('mousemove', modalMove, true);
    }
    const setModal = () => { win.removeEventListener('mousemove', modalMove, true); }
    const modalMove = e => {
      modal.style.position = 'absolute';
      modal.style.top = (e.clientY - yPos) + 'px';
      modal.style.left = (e.clientX - xPos) + 'px';
    };

    doc.querySelector('.video-modal')?.removeEventListener('mousedown', dragModal);
    doc.querySelector('.video-modal').addEventListener('mousedown', dragModal, false);
    win.removeEventListener('mouseup', setModal);
    win.addEventListener('mouseup', setModal, false);

    this.bindCopyEvent(doc);
  }

  lostConnection() {
    console.log('disconnected');
  }

  addPeer(id) {
    BackendHelper.addPeer(this.blockId, id, this.roomId);
  }

  startPeerPresence(id, win = this.win) {
    this.peerPresenceId = id;
    this.addPeer(id);

    if (this.peerPresenceIntervalId) {
      win.clearInterval(this.peerPresenceIntervalId);
    }

    this.peerPresenceIntervalId = win.setInterval(() => {
      this.addPeer(id);
    }, 60000);

    if (this.removePeerPresenceOnExit) {
      win.removeEventListener('pagehide', this.removePeerPresenceOnExit);
      win.removeEventListener('beforeunload', this.removePeerPresenceOnExit);
    }

    this.removePeerPresenceOnExit = () => {
      if (this.peerPresenceIntervalId) {
        win.clearInterval(this.peerPresenceIntervalId);
        this.peerPresenceIntervalId = null;
      }
      BackendHelper.removePeer(this.blockId, id, { keepalive: true }).catch(() => {});
    };

    win.addEventListener('pagehide', this.removePeerPresenceOnExit);
    win.addEventListener('beforeunload', this.removePeerPresenceOnExit);
  }

  markLocalUserEdit() {
    this.hasLocalUserEdits = true;
    if (this.hasMarkedCollaborator || this.isMarkingCollaborator) return;

    this.isMarkingCollaborator = true;
    BackendHelper.markBlockCollaborator(this.blockId)
      .then(() => {
        this.hasMarkedCollaborator = true;
      })
      .catch((error) => {
        console.log('Error occurred during attempt to mark block collaborator.');
        console.log(error);
      })
      .finally(() => {
        this.isMarkingCollaborator = false;
      });
  }

  setTargetPeerId(id) {
    this.targetPeerId = id;
  }

  updateRootUrl(id) {
    if (this.targetPeerId == 0) {
      this.setTargetPeerId(id);
    }
  }

  redirectInactive(doc = this.doc, win = this.win) {
    let lastTime = new Date().getTime();

    function dismissWithKeyPress(event) {
      event.preventDefault();
      doc.querySelector('.inactive-dismiss > button').click();
    }

    setInterval(() => {
      const currentTime = new Date().getTime();
      const timeDiff = currentTime - this.lastLocalInsertTime;

      // 1. Handle tab suspension or non-focus (original 60 seconds for production)
      if (currentTime > lastTime + 60000) {
        win.location.href = `/rooms/${this.roomId}/blocks/${this.blockId}`;
      }

      // 2. Handle user inactivity (original 5–5.5 minutes for production)
      if (timeDiff > 300000 && timeDiff < 330000) {
        const warningElem = doc.getElementById('inactive-warning');
        if (warningElem) {
          warningElem.style.visibility = 'visible';
          doc.addEventListener('keyup', dismissWithKeyPress, false);
        }
      } else if (timeDiff >= 330000) {
        win.location.href = `/rooms/${this.roomId}/blocks/${this.blockId}`;
      }

      // Update the lastTime variable to reflect current execution time
      lastTime = currentTime;
    }, 15000); // Restore to 15s interval for production


    doc.addEventListener('click', (event) => {
      if (!event.target.matches('.inactive-dismiss')) return;
      event.preventDefault();
      doc.getElementById('inactive-warning').style.visibility = 'hidden';
      doc.removeEventListener('keyup', dismissWithKeyPress, false);
      this.lastLocalInsertTime = new Date().getTime();
    }, false);
  }


  disableEditor(doc = this.doc) {
    doc.getElementById('block-page').classList.add('disabled');
  }

  unhideEditor(doc = this.doc) {
    doc.getElementById('block-page').classList.remove('hide');
  }

  unhideEditorWhenReady(doc = this.doc) {
    if (this.isReadyForLocalEdits) {
      this.unhideEditor(doc);
    }
  }

  hideEditor(doc = this.doc) {
    doc.getElementById('block-page').classList.add('hide')
  }

  updateSaveStatus(doc = document) {
    BackendHelper.getBlock(this.blockId).then((result) => {
      const box = doc.getElementById('sync-infobox');
      if (!box) return;

      if (result.block && result.block.updatedAt) {
        const block = result.block;

        const lang = getUiLang();

        const formatted = DateHelper.localDateTimeI18n(block.updatedAt, lang);

        let text = `Last backup: ${formatted}`;
        if (typeof window !== 'undefined' && window.I18n) {
          const maybe = window.I18n.t('blockEditor', 'status.lastBackup', { datetime: formatted });
          if (maybe && maybe !== 'status.lastBackup') {
            text = maybe;
          }
        }
        box.innerText = text;
      } else {
        let text = 'Last backup: Unknown';
        if (typeof window !== 'undefined' && window.I18n) {
          const maybe = window.I18n.t('blockEditor', 'status.lastBackupUnknown');
          if (maybe && maybe !== 'status.lastBackupUnknown') {
            text = maybe;
          }
        }
        box.innerText = text;
      }
    });
  }

  populateCRDT(initialStruct) {
    const struct = initialStruct.map(line => {
      return line.map(ch => {
        return new Char(ch.value, ch.counter, ch.siteId, ch.position.map(id => {
          return new Identifier(id.digit, id.siteId);
        }));
      });
    });

    this.crdt.struct = struct;
    this.editor.replaceText(this.crdt.toText());
  }

  async checkBlockStatus() {
    try {
      const res = await fetch(`/api/v1/blocks/${this.blockId}`);
      if (!res.ok) {
        throw new Error('Could not fetch block info');
      }

      const data = await res.json();
      const block = data.block || data;

      const canManageLockedBlock =
        typeof this.win !== 'undefined' &&
        Boolean(this.win.canManageBlock);

      if (block.status === 'locked' && !canManageLockedBlock) {
        this.isLocked = true;
        this.disableEditor();

        let msg = 'This block has been locked!';
        if (typeof window !== 'undefined' && window.I18n) {
          const maybe = window.I18n.t('blockEditor', 'toasts.blockLocked');
          if (maybe && maybe !== 'toasts.blockLocked') {
            msg = maybe;
          }
        }
        showToast(msg, "success");

        setTimeout(() => {
          window.location.href = `/rooms/${this.roomId}/blocks/${this.blockId}`;
        }, 1500);
        return true; // Locked 🔒
      }

      return false; // Libre como el viento 🌬️
    } catch (err) {
      console.error("Error checking block status:", err);
      return false; // fallback porque ni modo 🤷‍♂️
    }
  }

  async backupChanges() {
    const isLocked = await this.checkBlockStatus();
    if (isLocked) {
      // si está locked, no seguimos
      return;
    }
    if (this.firstPeerId() && this.firstPeerId() !== this.myPeerId()) {
      return;
    }

    BackendHelper.syncBlockContent(this.blockId, this.editor.getText())
      .then()
      .catch((error) => {
        console.log('Error occurred during attempt to save doc.');
        console.log(error);
      });
  }

  populateVersionVector(initialVersions) {
    const versions = initialVersions.map(ver => {
      let version = new Version(ver.siteId);
      version.counter = ver.counter;
      ver.exceptions.forEach(ex => version.exceptions.push(ex));
      return version;
    });

    versions.forEach(version => this.vector.versions.push(version));
  }

  addToNetwork(peerId, siteId, doc = this.doc) {
    if (!this.network.find(obj => obj.siteId === siteId)) {
      this.network.push({ peerId, siteId });
      if (siteId !== this.siteId) {
        this.addToListOfPeers(siteId, peerId, doc);
      }

      this.broadcast.addToNetwork(peerId, siteId);
    }
  }

  firstPeerId() {
    if (this.network.length === 0) return null;
    return this.network.slice().sort((a, b) => {
      const idA = a.peerId.toUpperCase();
      const idB = b.peerId.toUpperCase();
      return (idA < idB) ? -1 : (idA > idB) ? 1 : 0;
    })[0].peerId;
  }

  myPeerId() {
    return this.broadcast.peer.id;
  }

  removeFromNetwork(peerId, doc = this.doc) {
    const peerObj = this.network.find(obj => obj.peerId === peerId);
    const idx = this.network.indexOf(peerObj);
    if (idx >= 0) {
      const deletedObj = this.network.splice(idx, 1)[0];
      this.removeFromListOfPeers(peerId, doc);
      this.editor.removeCursor(deletedObj.siteId);
      this.broadcast.removeFromNetwork(peerId);
      if (this.firstPeerId() && this.firstPeerId() == this.myPeerId()) {
        BackendHelper.removePeer(this.blockId, peerId);
      }
    }
  }

  makeOwnName(doc = this.doc) {
    const listItem = doc.createElement('li');
    const node = doc.createElement('span');
    let youLabel = '(You)';

    if (typeof window !== 'undefined' && window.I18n) {
      const maybe = window.I18n.t('blockEditor', 'labels.you');
      if (maybe && maybe !== 'labels.you') {
        youLabel = maybe;
      }
    }

    const textNode = doc.createTextNode(youLabel);
    const color = generateItemFromHash(this.siteId, CSS_COLORS);
    const name = getCursorNameForSite(this.siteId);

    node.textContent = name;
    node.style.backgroundColor = color;
    node.classList.add('peer');

    listItem.appendChild(node);
    listItem.appendChild(textNode);
    doc.querySelector('#peerId').appendChild(listItem);
  }

  addToListOfPeers(siteId, peerId, doc = this.doc) {
    const listItem = doc.createElement('li');
    const node = doc.createElement('span');

    const color = generateItemFromHash(siteId, CSS_COLORS);
    const name = getCursorNameForSite(siteId);

    // COMMENTED OUT: Video editor does not work
    // const phone = parser.parseFromString(Feather.icons.phone.toSvg({ class: 'phone' }), "image/svg+xml");
    // const phoneIn = parser.parseFromString(Feather.icons['phone-incoming'].toSvg({ class: 'phone-in' }), "image/svg+xml");
    // const phoneOut = parser.parseFromString(Feather.icons['phone-outgoing'].toSvg({ class: 'phone-out' }), "image/svg+xml");
    // const phoneCall = parser.parseFromString(Feather.icons['phone-call'].toSvg({ class: 'phone-call' }), "image/svg+xml");

    node.textContent = name;
    node.style.backgroundColor = color;
    node.classList.add('peer');

    // this.attachVideoEvent(peerId, listItem);

    listItem.id = peerId;
    listItem.appendChild(node);
    // listItem.appendChild(phone.firstChild);
    // listItem.appendChild(phoneIn.firstChild);
    // listItem.appendChild(phoneOut.firstChild);
    // listItem.appendChild(phoneCall.firstChild);
    doc.querySelector('#peerId').appendChild(listItem);
  }

  getPeerElemById(peerId, doc = this.doc) {
    return doc.getElementById(peerId);
  }

  beingCalled(callObj) {
    const peerFlag = this.getPeerElemById(callObj.peer);

    this.addBeingCalledClass(callObj.peer);

    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(ms => {
        peerFlag.onclick = () => {
          this.broadcast.answerCall(callObj, ms);
        };
      });
  }

  getPeerFlagById(peerId, doc = this.doc) {
    const peerLi = doc.getElementById(peerId);
    return peerLi.children[0];
  }

  addBeingCalledClass(peerId, doc = this.doc) {
    const peerLi = doc.getElementById(peerId);

    peerLi.classList.add('beingCalled');
  }

  addCallingClass(peerId, doc = this.doc) {
    const peerLi = doc.getElementById(peerId);

    peerLi.classList.add('calling');
  }

  streamVideo(stream, callObj, doc = this.doc) {
    const peerFlag = this.getPeerFlagById(callObj.peer, doc);
    const color = peerFlag.style.backgroundColor;
    const modal = doc.querySelector('.video-modal');
    const bar = doc.querySelector('.video-bar');
    const vid = doc.querySelector('.video-modal video');

    this.answerCall(callObj.peer, doc);

    modal.classList.remove('hide');
    bar.style.backgroundColor = color;
    vid.srcObject = stream;
    vid.play();

    this.bindVideoEvents(callObj, doc);
  }

  bindVideoEvents(callObj, doc = this.doc) {
    const exit = doc.querySelector('.exit');
    const minimize = doc.querySelector('.minimize');
    const modal = doc.querySelector('.video-modal');
    const bar = doc.querySelector('.video-bar');
    const vid = doc.querySelector('.video-modal video');

    minimize.onclick = () => {
      bar.classList.toggle('mini');
      vid.classList.toggle('hide');
    };
    exit.onclick = () => {
      modal.classList.add('hide');
      callObj.close()
    };
  }

  answerCall(peerId, doc = this.doc) {
    const peerLi = doc.getElementById(peerId);

    if (peerLi) {
      peerLi.classList.remove('calling');
      peerLi.classList.remove('beingCalled');
      peerLi.classList.add('answered');
    }
  }

  closeVideo(peerId, doc = this.doc) {
    const modal = doc.querySelector('.video-modal');
    const peerLi = this.getPeerElemById(peerId, doc);

    modal.classList.add('hide');
    if (peerLi) {
      peerLi.classList.remove('answered', 'calling', 'beingCalled');
      this.attachVideoEvent(peerId, peerLi);
    }

    this.calling = this.calling.filter(id => id !== peerId);
  }

  attachVideoEvent(peerId, node) {
    node.onclick = () => {
      if (!this.calling.includes(peerId)) {
        navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          .then(ms => {
            this.addCallingClass(peerId);
            this.calling.push(peerId);
            this.broadcast.videoCall(peerId, ms);
          });
      }
    }
  }

  removeFromListOfPeers(peerId, doc = this.doc) {
    const peerElement = doc.getElementById(peerId);
    if (peerElement) peerElement.remove();
  }

  findNewTarget() {
    BackendHelper.getPeers(this.blockId).then(result => {
      const possibleTargets = result.filter(id => id !== this.myPeerId());

      if (possibleTargets.length === 0) {
        this.unhideEditorWhenReady();
        this.useBackupContent();
        this.broadcast.peer.on('connection', conn => this.setTargetPeerId(conn.peer));
      } else {
        const randomIdx = Math.floor(Math.random() * possibleTargets.length);
        const newTarget = possibleTargets[randomIdx];
        this.useBackupContent();
        this.broadcast.bindServerEvents(newTarget, this.broadcast.peer);
        this.broadcast.requestConnection(newTarget, this.broadcast.peer.id, this.siteId);
      }
    });
  }

  handleSync(syncObj, doc = this.doc) {
    if (syncObj.peerId != this.targetPeerId) { this.setTargetPeerId(syncObj.peerId); }
    this.backupHydrationRequestId++;

    syncObj.network.forEach(obj => this.addToNetwork(obj.peerId, obj.siteId, doc));

    if (this.crdt.totalChars() === 0) {
      this.populateCRDT(syncObj.initialStruct);
      this.populateVersionVector(syncObj.initialVersions);
    }
    this.markEditorReady(doc);

    this.syncCompleted(syncObj.peerId);
  }

  markEditorReady(doc = this.doc) {
    this.isReadyForLocalEdits = true;
    this.editor.setReadOnly(false);
    this.unhideEditor(doc);
  }

  syncCompleted(peerId) {
    const completedMessage = JSON.stringify({
      type: 'syncCompleted',
      peerId: this.broadcast.peer.id
    });

    let connection = this.broadcast.outConns.find(conn => conn.peer === peerId);

    if (connection && connection.open) {
      connection.send(completedMessage);
    } else {
      connection = this.broadcast.peer.connect(peerId);
      this.broadcast.addToOutConns(connection);
      connection.on('open', () => {
        connection.send(completedMessage);
      });
    }
  }

  handleRemoteOperation(operation) {
    if (this.vector.hasBeenApplied(operation.version)) return;

    if (operation.type === 'insert') {
      this.applyOperation(operation);
    } else if (operation.type === 'delete') {
      this.buffer.push(operation);
    }

    this.processDeletionBuffer();
    this.broadcast.send(operation);
  }

  processDeletionBuffer() {
    let i = 0;
    let deleteOperation;

    while (i < this.buffer.length) {
      deleteOperation = this.buffer[i];

      if (this.hasInsertionBeenApplied(deleteOperation)) {
        this.applyOperation(deleteOperation);
        this.buffer.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  hasInsertionBeenApplied(operation) {
    const charVersion = { siteId: operation.char.siteId, counter: operation.char.counter };
    return this.vector.hasBeenApplied(charVersion);
  }

  applyOperation(operation) {
    if (!operation.char) {
      console.error("Invalid operation received:", operation);
      return;
    }
    const char = operation.char;
    const identifiers = char.position.map(pos => new Identifier(pos.digit, pos.siteId));
    const newChar = new Char(char.value, char.counter, char.siteId, identifiers);

    if (operation.type === 'insert') {
      this.crdt.handleRemoteInsert(newChar);
    } else if (operation.type === 'delete') {
      this.crdt.handleRemoteDelete(newChar, operation.version.siteId);
    }

    this.vector.update(operation.version);
  }

  localDelete(startPos, endPos) {
    if (!this.isReadyForLocalEdits) return;
    if (this.isLocked) return;
    this.crdt.handleLocalDelete(startPos, endPos);
  }

  localInsert(chars, startPos) {
    if (!this.isReadyForLocalEdits) return;
    if (this.isLocked) return;
    if (!chars || chars.length === 0) return;
    for (let i = 0; i < chars.length; i++) {
      let char = chars[i];

      if (chars[i].charCodeAt(0) === 8203) {
        char = ' ';
      }
      if (chars[i - 1] === '\n') {
        startPos.line++;
        startPos.ch = 0;
      }
      this.crdt.handleLocalInsert(char, startPos);
      startPos.ch++;
    }
    this.lastLocalInsertTime = new Date().getTime();
  }

  useBackupContent() {
    if (!this.crdt.isEmpty()) {
      return;
    }
    const requestId = ++this.backupHydrationRequestId;
    this.hideEditor();
    BackendHelper.getBlock(this.blockId).then(result => {
      if (requestId === this.backupHydrationRequestId && this.crdt.isEmpty()) {
        this.isReadyForLocalEdits = true;
        this.localInsert(result.block.content || '', { line: 0, ch: 0 });
        this.editor.replaceText(this.crdt.toText());
        this.markEditorReady();
      }
    }).catch((error) => {
      console.log('Error occurred during attempt to hydrate doc from backup.');
      console.log(error);
      if (requestId === this.backupHydrationRequestId && this.crdt.isEmpty()) {
        this.isReadyForLocalEdits = true;
        this.localInsert(this.editor.getText() || '', { line: 0, ch: 0 });
        this.editor.replaceText(this.crdt.toText());
        this.markEditorReady();
      }
    });
  }

  broadcastInsertion(char) {
    if (!char || typeof char !== 'object') {
      console.error("Invalid char broadcast attempt:", char);
      return;
    }
    const operation = {
      type: 'insert',
      char: char,
      version: this.vector.getLocalVersion()
    };

    this.broadcast.send(operation);
  }

  broadcastDeletion(char, version) {
    if (!char || typeof char !== 'object' || !version) {
      console.error("Invalid deletion broadcast attempt:", char, version);
      return;
    }

    const operation = {
      type: 'delete',
      char: char,
      version: version
    };

    this.broadcast.send(operation);
  }

  insertIntoEditor(value, pos, siteId) {
    if (typeof value !== 'string' || value.length === 0) {
      console.error("Invalid insertion value:", value);
      return;
    }
    const positions = {
      from: {
        line: pos.line,
        ch: pos.ch,
      },
      to: {
        line: pos.line,
        ch: pos.ch,
      }
    }

    this.editor.insertText(value, positions, siteId);
  }

  deleteFromEditor(value, pos, siteId) {
    if (typeof value !== 'string' || value.length === 0) {
      console.error("Invalid deletion value:", value);
      return;
    }
    let positions;

    if (value === "\n") {
      positions = {
        from: {
          line: pos.line,
          ch: pos.ch,
        },
        to: {
          line: pos.line + 1,
          ch: 0,
        }
      }
    } else {
      positions = {
        from: {
          line: pos.line,
          ch: pos.ch,
        },
        to: {
          line: pos.line,
          ch: pos.ch + 1,
        }
      }
    }

    this.editor.deleteText(value, positions, siteId);
  }
}

export default Controller;
