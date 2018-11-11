function triggerMouseEvent(node, eventType) {
  const clickEvent = document.createEvent('MouseEvents');
  clickEvent.initEvent(eventType, true, true);
  node.dispatchEvent(clickEvent);
}

setInterval(() => {
  if (window.getSelection) {
    if (window.getSelection().empty) {
      const initialMatcher = '<span class=" CodeMirror-selectedtext">';
      const lines = document.getElementsByClassName('CodeMirror-line');
      const textSelected = [...lines].map(line => line.innerHTML.includes(initialMatcher))
        .includes(true);
      const targetNode = lines[0];


      if (targetNode && textSelected) {
        triggerMouseEvent(targetNode, 'mouseover');
        triggerMouseEvent(targetNode, 'mousedown');
        triggerMouseEvent(targetNode, 'mouseup');
      }
    }
  } else if (document.selection) {
    document.selection.empty();
  }
}, 75);
