const Autolinker = require('autolinker');
const sanitizeHTML = require('sanitize-html');

function elementTemplate(isEven, element) {
  return `${isEven ? '<' : '</'}${element}>`;
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

function archiveHTML(text) {
  const delimiterMap = {
    _: { element: 'em', indexCount: getIndicesOf('_', text).length },
    '*': { element: 'strong', indexCount: getIndicesOf('*', text).length },
    '~': { element: 'del', indexCount: getIndicesOf('~', text).length },
  };

  let htmlOutput = sanitizeHTML(text).replace(/\n/g, '<br>');

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

  return Autolinker.link(htmlOutput);
}

function archiveContent(pageData) {
  let errorMessage;
  let text;

  if (!pageData) {
    errorMessage = 'We could not find the page for that day.';
  } else if (pageData.content.replace(/^(\s+|\u200b+)|(\s+|\u200b+)$/g, '') === '') {
    errorMessage = 'The page for this day is blank, although it was edited at least once.';
  } else {
    text = archiveHTML(pageData.content);
  }

  return [errorMessage, text];
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

module.exports = { capitalize, archiveContent };
