import Editor from '../lib/editor.js';

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
