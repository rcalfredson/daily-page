import EasyMDE from 'easymde'

import Controller from './controller';
import Broadcast from './broadcast';
import Editor from './editor';

let peerId = initialTargetPeerId;
if (!peerId) {
  peerId = '0';
}

new Controller(
  peerId,
  room,
  location.origin,
  new Peer({
    host: location.hostname,
    port: location.port || (location.protocol === 'https:' ? 443 : 80),
    path: '/peerjs',
    config: {
      'iceServers':
        [
          { url: 'stun:stun1.l.google.com:19302' },
          // {
          //   urls: 'turn:numb.viagenie.ca',
          //   credential: '?uV5he_Et2PRAfrOZuy2',
          //   username: 'ask@dailypage.org'
          // },
          {
            urls: "turn:openrelay.metered.ca:80?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          }
        ]
    },
    debug: 1
  }),
  new Broadcast(),
  new Editor(new EasyMDE({
    placeholder: "The blank page awaits; write away!",
    spellChecker: false,
    toolbar: false,
    autofocus: false,
    indentWithTabs: true,
    tabSize: 4,
    indentUnit: 4,
    lineWrapping: true,
    shortCuts: []
  }))
);
