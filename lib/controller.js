import BackendHelper from './backendHelper';
import DateHelper from './dateHelper';
import CRDT from './crdt';
import Char from './char';
import Identifier from './identifier';
import VersionVector from './versionVector';
import Version from './version';
import { v4 } from 'uuid';
import { generateItemFromHash } from './hashAlgo';
import CSS_COLORS from './cssColors';
import { ANIMALS } from './cursorNames';

class Controller {
  constructor(targetPeerId, roomId, host, peer, broadcast, editor, doc = document, win = window) {
    this.siteId = v4();
    this.host = host;
    this.buffer = [];
    this.calling = [];
    this.network = [];
    this.targetPeerId = targetPeerId;
    this.roomId = roomId;
    this.lastLocalInsertTime = new Date().getTime();
    this.makeOwnName(doc);
    this.setTimedActions();

    this.broadcast = broadcast;
    this.broadcast.controller = this;
    this.broadcast.bindServerEvents(targetPeerId, peer);

    this.editor = editor;
    this.editor.controller = this;
    this.editor.bindChangeEvent();

    this.vector = new VersionVector(this.siteId);
    this.crdt = new CRDT(this);
    this.editor.bindButtons();
    this.bindCopyEvent(doc);

    if (targetPeerId == 0) {
      this.useBackupContent();
    }
  }

  setTimedActions() {
    setInterval(() => {
      this.backupChanges()
    }, 16000);

    setInterval(() => {
      this.updateSaveStatus();
    }, 5000);

    this.setPageLock();
    this.redirectInactive();
  }

  bindCopyEvent(doc = document) {
    doc.querySelector('.copy-container').onclick = () => {
      this.copyToClipboard(doc.querySelector('#myLinkInput'));
    };
  }

  copyToClipboard(element) {
    const temp = document.createElement("input");
    document.querySelector("body").appendChild(temp);
    temp.value = element.textContent;
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

    doc.querySelector('.video-modal').addEventListener('mousedown', dragModal, false);
    win.addEventListener('mouseup', setModal, false);

    this.bindCopyEvent(doc);
  }

  lostConnection() {
    console.log('disconnected');
  }

  updateShareLink(id, doc = document) {
    const shareLink = this.host + '?' + id;
    const aTag = doc.querySelector('#myLink');
    const pTag = doc.querySelector('#myLinkInput');

    pTag.textContent = shareLink;
    aTag.setAttribute('href', shareLink);
    BackendHelper.addPeer(id);
  }

  updatePageURL(id, win = window) {
    this.targetPeerId = id;

    const newURL = `${this.host}/rooms/${room}?id=${id}`;
    win.history.pushState({}, '', newURL);
  }

  updateRootUrl(id, win = window) {
    if (this.targetPeerId == 0) {
      this.updatePageURL(id, win);
    }
  }

  setPageLock() {
    let regularChecks = setInterval(() => singleCheck(this), 1000);

    function singleCheck(controller) {
      const currentDate = DateHelper.currentDate();
      const timeLeft = DateHelper.closingTime() - new Date().getTime();

      if (timeLeft <= 3000) {
        controller.backupChanges();
        clearInterval(regularChecks);
        setTimeout(() => {
          controller.disableEditor();
          (function updateCountdown(secondsRemaining = 3) {
            if (secondsRemaining === 0) {
              window.location.href = `/rooms/overview/${currentDate}`;
            }
            document.getElementById('countdown').innerText = secondsRemaining;
            secondsRemaining--;
            setTimeout(() => updateCountdown(secondsRemaining), 1000);
          })();
        }, timeLeft);
      }
    }
  }

  redirectInactive() {
    const currentDate = DateHelper.currentDate();
    let lastTime = new Date().getTime();

    function dismissWithKeyPress(event) {
      event.preventDefault();
      document.querySelector('.inactive-dismiss > button').click();
    }

    setInterval(() => {
      const currentTime = new Date().getTime();
      const timeDiff = currentTime - this.lastLocalInsertTime;

      // 1. Handle tab suspension or non-focus (original 60 seconds for production)
      if (currentTime > lastTime + 60000) {
        window.location.href = `/rooms${room}/${currentDate}`;
      }

      // 2. Handle user inactivity (original 5–5.5 minutes for production)
      if (timeDiff > 300000 && timeDiff < 330000) {
        document.getElementById('inactive-warning').style.visibility = 'visible';
        document.addEventListener('keyup', dismissWithKeyPress, false);
      } else if (timeDiff >= 330000) {
        window.location.href = `/rooms/${room}/${currentDate}`;
      }

      // Update the lastTime variable to reflect current execution time
      lastTime = currentTime;
    }, 15000); // Restore to 15s interval for production


    document.addEventListener('click', (event) => {
      if (!event.target.matches('.inactive-dismiss')) return;
      event.preventDefault();
      document.getElementById('inactive-warning').style.visibility = 'hidden';
      document.removeEventListener('keyup', dismissWithKeyPress, false);
      this.lastLocalInsertTime = new Date().getTime();
    }, false);
  }


  disableEditor(doc = document) {
    doc.getElementById('daily-page').classList.add('disabled');
  }

  enableEditor(doc = document) {
    doc.getElementById('daily-page').classList.remove('hide');
  }

  hideEditor(doc = document) {
    doc.getElementById('daily-page').classList.add('hide')
  }

  updateSaveStatus(doc = document) {
    BackendHelper.getPage(DateHelper.currentDate(), { lastUpdate: true }).then((result) => {
      doc.getElementById('sync-infobox').innerText = `Last backup: ${DateHelper.localDateWithTime(result.lastUpdate)}`;
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

  backupChanges() {
    if (this.firstPeerId() !== this.myPeerId()) {
      return;
    }

    BackendHelper.syncPage(this.editor.currentContents()).then().catch((error) => {
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

  addToNetwork(peerId, siteId, doc = document) {
    if (!this.network.find(obj => obj.siteId === siteId)) {
      this.network.push({ peerId, siteId });
      if (siteId !== this.siteId) {
        this.addToListOfPeers(siteId, peerId, doc);
      }

      this.broadcast.addToNetwork(peerId, siteId);
    }
  }

  firstPeerId() {
    return this.network.sort((a, b) => {
      const idA = a.peerId.toUpperCase();
      const idB = b.peerId.toUpperCase();
      return (idA < idB) ? -1 : (idA > idB) ? 1 : 0;
    })[0].peerId;
  }

  myPeerId(doc = document) {
    return doc.querySelector('#myLinkInput').textContent.split('?')[1];
  }

  removeFromNetwork(peerId, doc = document) {
    const peerObj = this.network.find(obj => obj.peerId === peerId);
    const idx = this.network.indexOf(peerObj);
    if (idx >= 0) {
      const deletedObj = this.network.splice(idx, 1)[0];
      this.removeFromListOfPeers(peerId, doc);
      this.editor.removeCursor(deletedObj.siteId);
      this.broadcast.removeFromNetwork(peerId);
      if (this.firstPeerId() == this.myPeerId()) {
        BackendHelper.removePeer(peerId);
      }
    }
  }

  makeOwnName(doc = document) {
    const listItem = doc.createElement('li');
    const node = doc.createElement('span');
    const textnode = doc.createTextNode("(You)")
    const color = generateItemFromHash(this.siteId, CSS_COLORS);
    const name = generateItemFromHash(this.siteId, ANIMALS);

    node.textContent = name;
    node.style.backgroundColor = color;
    node.classList.add('peer');

    listItem.appendChild(node);
    listItem.appendChild(textnode);
    doc.querySelector('#peerId').appendChild(listItem);
  }

  addToListOfPeers(siteId, peerId, doc = document) {
    const listItem = doc.createElement('li');
    const node = doc.createElement('span');

    const parser = new DOMParser();

    const color = generateItemFromHash(siteId, CSS_COLORS);
    const name = generateItemFromHash(siteId, ANIMALS);

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

  getPeerElemById(peerId, doc = document) {
    return doc.getElementById(peerId);
  }

  beingCalled(callObj, doc = document) {
    const peerFlag = this.getPeerElemById(callObj.peer);

    this.addBeingCalledClass(callObj.peer);

    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(ms => {
        peerFlag.onclick = () => {
          this.broadcast.answerCall(callObj, ms);
        };
      });
  }

  getPeerFlagById(peerId, doc = document) {
    const peerLi = doc.getElementById(peerId);
    return peerLi.children[0];
  }

  addBeingCalledClass(peerId, doc = document) {
    const peerLi = doc.getElementById(peerId);

    peerLi.classList.add('beingCalled');
  }

  addCallingClass(peerId, doc = document) {
    const peerLi = doc.getElementById(peerId);

    peerLi.classList.add('calling');
  }

  streamVideo(stream, callObj, doc = document) {
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

  bindVideoEvents(callObj, doc = document) {
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

  answerCall(peerId, doc = document) {
    const peerLi = doc.getElementById(peerId);

    if (peerLi) {
      peerLi.classList.remove('calling');
      peerLi.classList.remove('beingCalled');
      peerLi.classList.add('answered');
    }
  }

  closeVideo(peerId, doc = document) {
    const modal = doc.querySelector('.video-modal');
    const peerLi = this.getPeerElemById(peerId, doc);

    modal.classList.add('hide');
    peerLi.classList.remove('answered', 'calling', 'beingCalled');
    this.calling = this.calling.filter(id => id !== peerId);

    this.attachVideoEvent(peerId, peerLi);
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

  removeFromListOfPeers(peerId, doc = document) {
    doc.getElementById(peerId).remove();
  }

  findNewTarget() {
    BackendHelper.getPeers().then(result => {
      const possibleTargets = result.filter(id => id !== this.myPeerId());

      if (possibleTargets.length === 0) {
        this.enableEditor();
        this.useBackupContent();
        this.broadcast.peer.on('connection', conn => this.updatePageURL(conn.peer));
      } else {
        const randomIdx = Math.floor(Math.random() * possibleTargets.length);
        const newTarget = possibleTargets[randomIdx];
        this.useBackupContent();
        this.broadcast.bindServerEvents(newTarget, this.broadcast.peer);
        this.broadcast.requestConnection(newTarget, this.broadcast.peer.id, this.siteId);
      }
    });
  }

  handleSync(syncObj, doc = document, win = window) {
    if (syncObj.peerId != this.targetPeerId) { this.updatePageURL(syncObj.peerId, win); }

    syncObj.network.forEach(obj => this.addToNetwork(obj.peerId, obj.siteId, doc));

    if (this.crdt.totalChars() === 0) {
      this.populateCRDT(syncObj.initialStruct);
      this.populateVersionVector(syncObj.initialVersions);
    }
    this.enableEditor(doc);

    this.syncCompleted(syncObj.peerId);
  }

  syncCompleted(peerId) {
    const completedMessage = JSON.stringify({
      type: 'syncCompleted',
      peerId: this.broadcast.peer.id
    });

    let connection = this.broadcast.outConns.find(conn => conn.peer === peerId);

    if (connection) {
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
    this.crdt.handleLocalDelete(startPos, endPos);
  }

  localInsert(chars, startPos) {
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
    this.hideEditor();
    BackendHelper.getPage().then(result => {
      if (this.crdt.isEmpty()) {
        this.localInsert(result.content, { line: 0, ch: 0 });
        this.editor.replaceText(this.crdt.toText());
      }
      this.enableEditor();
    });
  }

  broadcastInsertion(char) {
    const operation = {
      type: 'insert',
      char: char,
      version: this.vector.getLocalVersion()
    };

    this.broadcast.send(operation);
  }

  broadcastDeletion(char, version) {
    const operation = {
      type: 'delete',
      char: char,
      version: version
    };

    this.broadcast.send(operation);
  }

  insertIntoEditor(value, pos, siteId) {
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
