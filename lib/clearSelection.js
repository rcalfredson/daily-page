function triggerMouseEvent(node, eventType) {
  const clickEvent = document.createEvent('MouseEvents');
  clickEvent.initEvent(eventType, true, true);
  node.dispatchEvent(clickEvent);
}

function selectionMade(lines) {
  const initialMatcher = '<span class=" CodeMirror-selectedtext">';
  return [...lines].map((line) => line.innerHTML.includes(initialMatcher))
    .includes(true);
}

$(document).ready(() => {
  const callback = (mutationsList) => {
    mutationsList.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const lines = document.getElementsByClassName('CodeMirror-line');

        if (selectionMade(lines)) {
          const targetNode = lines[0];

          triggerMouseEvent(targetNode, 'mouseover');
          triggerMouseEvent(targetNode, 'mousedown');
          triggerMouseEvent(targetNode, 'mouseup');
        }
      }
    });
  };
  const observer = new MutationObserver(callback);
  const config = { attributes: true, childList: true, subtree: true };
  const targetNode = document.getElementsByClassName('CodeMirror')[0];
  observer.observe(targetNode, config);
});
