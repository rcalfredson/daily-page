import * as Autolinker from 'autolinker';
import SanitizeHTML from 'sanitize-html';
import BackendHelper from './backendHelper';

function showViewer() {
  document.getElementById('viewer').classList.remove('hide');
}

function getIndicesOf(inputtedSearchStr, inputtedStr, returnFirst = false, caseSensitive = false) {
  let searchStr = inputtedSearchStr;
  let str = inputtedStr;
  let startIndex = 0;
  let index;
  const searchStrLen = searchStr.length;
  const indices = [];
  if (searchStrLen === 0) {
    return [];
  }
  if (!caseSensitive) {
    str = str.toLowerCase();
    searchStr = searchStr.toLowerCase();
  }
  while (str.indexOf(searchStr, startIndex) > -1) {
    index = str.indexOf(searchStr, startIndex);
    if (str[index - 1] !== '\\') {
      indices.push(index);
    }
    startIndex = index + searchStrLen;
    if (returnFirst && indices.length === 1) {
      break;
    }
  }
  return indices;
}

function replaceBetween(string, start, end, newContent) {
  return string.substring(0, start) + newContent + string.substring(end);
}

function elementTemplate(isEven, element) {
  return `${isEven ? '<' : '</'}${element}>`;
}

function updateViewer(content) {
  showViewer();
  const viewer = document.getElementById('viewer');

  if (content.replace(/^(\s+|\u200b+)|(\s+|\u200b+)$/g, '') === '') {
    updateViewer('The page for this day is blank, although it was edited at least once.');
    return;
  }

  const delimiterMap = {
    _: { element: 'em', indexCount: getIndicesOf('_', content).length },
    '*': { element: 'strong', indexCount: getIndicesOf('*', content).length },
    '~': { element: 'del', indexCount: getIndicesOf('~', content).length },
  };

  let htmlOutput = SanitizeHTML(content).replace(/\n/g, '<br>');

  Object.keys(delimiterMap).forEach((delimiter) => {
    for (let i = 0; i < delimiterMap[delimiter].indexCount; i += 1) {
      const isEven = i % 2 === 0;
      const index = getIndicesOf(delimiter, htmlOutput, true)[0];
      if ((isEven && i < delimiterMap[delimiter].indexCount - 1) || !isEven) {
        htmlOutput = replaceBetween(htmlOutput, index, index + 1,
          elementTemplate(isEven, delimiterMap[delimiter].element));
      }
    }
    htmlOutput = htmlOutput.replace(new RegExp(`\\\\\\${delimiter}`, 'gi'), delimiter);
  });

  viewer.innerHTML = Autolinker.link(htmlOutput);
}

function lastComponent() {
  const components = window.location.href.split('/');

  return components[components.length - 1];
}

BackendHelper.getPage(lastComponent()).then(result => updateViewer(result.content))
  .catch(() => {
    updateViewer('We could not find the page for that day.');
  });
