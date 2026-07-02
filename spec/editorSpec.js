import Editor, { createMarkdownTable } from '../lib/editor.js';
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
    let codemirror;

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

      codemirror = {
        setOption() {},
        getCursor() { return { line: 2, ch: 3 }; },
        replaceRange: jasmine.createSpy('replaceRange'),
        focus: jasmine.createSpy('focus')
      };
      toolbarEditor = new Editor({ codemirror });
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

    it('inserts a validated Street View directive as one editor change', () => {
      const embedUrl = 'https://www.google.com/maps/embed?pb=!4v123!6m8';
      document.getElementById('street-view-url').value = ` ${embedUrl} `;

      toolbarEditor.insertStreetView();

      expect(codemirror.replaceRange).toHaveBeenCalledWith(
        `@[streetview](${embedUrl})`,
        { line: 2, ch: 3 },
        { line: 2, ch: 3 },
        '+input'
      );
      expect(codemirror.focus).toHaveBeenCalled();
      expect(document.getElementById('insert-street-view-tooltip').classList)
        .toContain('hidden');
      expect(document.getElementById('street-view-url').value).toBe('');
      expect(document.getElementById('open-insert-street-view-btn')
        .getAttribute('aria-expanded')).toBe('false');
    });

    it('rejects a non-embed or untrusted URL', () => {
      document.getElementById('street-view-url').value =
        'https://www.google.com.evil.example/maps/embed?pb=value';

      toolbarEditor.insertStreetView();

      expect(alertSpy).toHaveBeenCalledWith(
        'Enter a valid Google Maps Street View embed URL.'
      );
      expect(codemirror.replaceRange).not.toHaveBeenCalled();
    });
  });

  describe('image toolbar insertion', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    let dom;
    let imageEditor;
    let codemirror;

    beforeEach(() => {
      dom = new JSDOM(`
        <div id="insert-img-tooltip"></div>
        <input id="img-url" value=" https://example.com/photo.jpg ">
        <input id="img-alt" value=" A view ">
      `);
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      codemirror = {
        setOption() {},
        getCursor() { return { line: 4, ch: 1 }; },
        replaceRange: jasmine.createSpy('replaceRange'),
        focus: jasmine.createSpy('focus')
      };
      imageEditor = new Editor({ codemirror });
      spyOn(imageEditor, 'markImages');
    });

    afterEach(() => {
      dom.window.close();
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    });

    it('inserts image Markdown as one editor change', () => {
      imageEditor.insertImage();

      expect(codemirror.replaceRange).toHaveBeenCalledWith(
        '![A view](https://example.com/photo.jpg)',
        { line: 4, ch: 1 },
        { line: 4, ch: 1 },
        '+input'
      );
      expect(codemirror.focus).toHaveBeenCalled();
      expect(imageEditor.markImages).toHaveBeenCalled();
    });
  });

  describe('table toolbar insertion', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    let dom;
    let tableEditor;
    let codemirror;

    beforeEach(() => {
      dom = new JSDOM(`
        <button id="open-insert-table-btn" aria-expanded="true"></button>
        <div id="insert-table-tooltip">
          <form id="insert-table-form">
            <input id="table-rows" type="number" min="1" max="20" value="2" required>
            <input id="table-columns" type="number" min="1" max="10" value="3" required>
            <input id="table-sortable" type="checkbox">
          </form>
        </div>
      `);
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      codemirror = {
        setOption() {},
        getCursor() { return { line: 1, ch: 4 }; },
        replaceRange: jasmine.createSpy('replaceRange'),
        focus: jasmine.createSpy('focus')
      };
      tableEditor = new Editor({ codemirror });
    });

    afterEach(() => {
      dom.window.close();
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    });

    it('builds a sortable Markdown table with the requested dimensions', () => {
      expect(createMarkdownTable(2, 3)).toBe(
        '|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |'
      );
    });

    it('adds the no-sort marker when sorting is disabled', () => {
      tableEditor.insertTable({ preventDefault() {} });

      expect(codemirror.replaceRange).toHaveBeenCalledWith(
        '\n\n{.no-sort}\n\n|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n\n',
        { line: 1, ch: 4 },
        { line: 1, ch: 4 },
        '+input'
      );
      expect(document.getElementById('insert-table-tooltip').classList)
        .toContain('hidden');
      expect(document.getElementById('open-insert-table-btn')
        .getAttribute('aria-expanded')).toBe('false');
      expect(codemirror.focus).toHaveBeenCalled();
    });

    it('rejects dimensions outside the supported limits', () => {
      expect(() => createMarkdownTable(0, 2)).toThrowError(RangeError);
      expect(() => createMarkdownTable(2, 11)).toThrowError(RangeError);
    });

    it('closes on Escape and restores focus to the toolbar button', () => {
      const button = document.getElementById('open-insert-table-btn');
      spyOn(button, 'focus');

      tableEditor.handleTableInsertionKeydown({
        key: 'Escape',
        preventDefault() {}
      });

      expect(document.getElementById('insert-table-tooltip').classList)
        .toContain('hidden');
      expect(button.focus).toHaveBeenCalled();
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
