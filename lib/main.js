import EasyMDE from 'easymde'

import Controller from './controller';
import Broadcast from './broadcast';
import Editor from './editor';

let peerId = initialTargetPeerId;
if (!peerId) {
  peerId = '0';
}

const TURN_USERNAME =
  typeof window !== 'undefined' && window.TURN_CONFIG
    ? window.TURN_CONFIG.username
    : null;

const TURN_CREDENTIAL =
  typeof window !== 'undefined' && window.TURN_CONFIG
    ? window.TURN_CONFIG.credential
    : null;

// --- i18n hookup for the editor placeholder ---
let editorPlaceholder = "The blank page is waiting for your voice; write fearlessly.";
if (typeof window !== 'undefined' && window.I18n) {
  try {
    const blockEditorNs = window.I18n.get('blockEditor', {});
    const localized = window.I18n.t(blockEditorNs, 'editor.placeholder');
    if (localized && localized !== 'editor.placeholder') {
      editorPlaceholder = localized;
    }
  } catch (e) {
    // si algo sale mal, nos quedamos con el placeholder por defecto
    // (no pasa nada, solo se queda en inglés)
  }
}
// ---------------------------------------------

new Controller(
  peerId,
  room_id,
  block_id,
  location.origin,
  new Peer({
    host: location.hostname,
    port: location.port || (location.protocol === 'https:' ? 443 : 80),
    path: '/peerjs',
    config: {
      'iceServers':
        [
          {
            urls: "stun:stun.relay.metered.ca:80",
          },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL
          },
        ]
    },
    debug: 1
  }),
  new Broadcast(),
  new Editor(new EasyMDE({
    element: document.getElementById('editor-content'),
    placeholder: editorPlaceholder,
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
