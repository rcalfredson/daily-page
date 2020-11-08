import EasyMDE from 'easymde'

import Controller from './controller';
import Broadcast from './broadcast';
import Editor from './editor';


new Controller(
  (location.search.slice(1) || '0'),
  location.origin,
  new Peer({
    host: location.hostname,
    port: location.port || (location.protocol === 'https:' ? 443 : 80),
    path: '/peerjs',
    config: {
      'iceServers':
        [
          { url: 'stun:stun1.l.google.com:19302' },
          {
            url: 'turn:numb.viagenie.ca',
            credential: '?uV5he_Et2PRAfrOZuy2',
            username: 'ask@dailypage.org'
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
