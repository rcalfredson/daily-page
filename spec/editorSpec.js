import Editor from '../lib/editor.js';
import { JSDOM } from 'jsdom';

describe("Editor", () => {
  const mockMDE = {
    value: function() {},
    codemirror: {
      setOption: function() {}
    }
  };
  const editor = new Editor(mockMDE);
  editor.controller = {
    crdt: { text: '' }
  };

  describe("constructor", () => {
    it("sets the mde passed in to the.mde", () => {
      expect(editor.mde).toEqual(mockMDE);
    });
  });

  describe("editing state helpers", () => {
    it("sets CodeMirror readOnly while waiting for hydration", () => {
      spyOn(editor.mde.codemirror, "setOption");
      editor.setReadOnly(true);
      expect(editor.mde.codemirror.setOption).toHaveBeenCalledWith('readOnly', 'nocursor');
    });

    it("restores CodeMirror editability after hydration", () => {
      spyOn(editor.mde.codemirror, "setOption");
      editor.setReadOnly(false);
      expect(editor.mde.codemirror.setOption).toHaveBeenCalledWith('readOnly', false);
    });

    it("returns the source editor value for persistence", () => {
      spyOn(editor.mde, "value").and.returnValue("source markdown");
      expect(editor.getText()).toEqual("source markdown");
    });
  });

  describe('Street View toolbar insertion', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalAlert = globalThis.alert;
    let dom;
    let toolbarEditor;
    let alertSpy;

    beforeEach(() => {
      dom = new JSDOM(`
        <button id="open-insert-street-view-btn" aria-expanded="true"></button>
        <div id="insert-street-view-tooltip"></div>
        <input id="street-view-url">
      `);
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      alertSpy = jasmine.createSpy('alert');
      globalThis.alert = alertSpy;

      toolbarEditor = new Editor({
        codemirror: {
          setOption() {},
          getCursor() { return { line: 2, ch: 3 }; }
        }
      });
    });

    afterEach(() => {
      dom.window.close();
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
      if (originalAlert === undefined) delete globalThis.alert;
      else globalThis.alert = originalAlert;
    });

    it('inserts a validated Street View directive through simulated typing', () => {
      const embedUrl = 'https://www.google.com/maps/embed?pb=!4v123!6m8';
      document.getElementById('street-view-url').value = ` ${embedUrl} `;
      spyOn(toolbarEditor, 'simulateTyping');

      toolbarEditor.insertStreetView();

      expect(toolbarEditor.simulateTyping).toHaveBeenCalledWith(
        `@[streetview](${embedUrl})`,
        { line: 2, ch: 3 }
      );
      expect(document.getElementById('insert-street-view-tooltip').classList)
        .toContain('hidden');
      expect(document.getElementById('street-view-url').value).toBe('');
      expect(document.getElementById('open-insert-street-view-btn')
        .getAttribute('aria-expanded')).toBe('false');
    });

    it('rejects a non-embed or untrusted URL', () => {
      document.getElementById('street-view-url').value =
        'https://www.google.com.evil.example/maps/embed?pb=value';
      spyOn(toolbarEditor, 'simulateTyping');

      toolbarEditor.insertStreetView();

      expect(alertSpy).toHaveBeenCalledWith(
        'Enter a valid Google Maps Street View embed URL.'
      );
      expect(toolbarEditor.simulateTyping).not.toHaveBeenCalled();
    });
  });

  describe("findLinearIdx", () => {
    it("returns 0 if lines of text is empty", () => {
      editor.controller.crdt.text = "";
      expect(editor.findLinearIdx(0, 0)).toEqual(0);
    });

    it("calculates linear index from a single line of text", () => {
      editor.controller.crdt.text = "abcdefghijklmnop";
      expect(editor.findLinearIdx(0, 7)).toEqual(7);
    });

    it("calculates linear index from multiple lines of text", () => {
      editor.controller.crdt.text = "abc\ndefgh\nijk\nlmnop";
      expect(editor.findLinearIdx(1, 2)).toEqual(6);
    });

    it("can find the linear index on the last line of text", () => {
      editor.controller.crdt.text = "abc\ndefgh\nijk\nlmnop";
      expect(editor.findLinearIdx(3, 2)).toEqual(16);
    });

    it("can find the linear index at the end of a line of text", () => {
      editor.controller.crdt.text = "abc\ndefgh\nijk\nlmnop";
      expect(editor.findLinearIdx(1, 5)).toEqual(9);
    });
  });
});
