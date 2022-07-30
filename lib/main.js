import EasyMDE from 'easymde'

import Controller from './controller';
import Broadcast from './broadcast';
import Editor from './editor';
import { getQueryVariable } from './util';

let peerId = getQueryVariable('id');
if (!peerId) {
  peerId = '0';
}
let roomId = getQueryVariable('room');

new Controller(
  peerId,
  roomId,
  location.origin,
  new Peer({
    host: location.hostname,
    port: location.port || (location.protocol === 'https:' ? 443 : 80),
    path: '/peerjs',
    config: {
      'iceServers':
        [
          { urls: 'stun:stun1.l.google.com:19302' },
          // {
          //   urls: 'turn:numb.viagenie.ca',
          //   credential: '?uV5he_Et2PRAfrOZuy2',
          //   username: 'ask@dailypage.org'
          // }
          {
            url: 'turn:192.158.29.39:3478?transport=udp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808'
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
