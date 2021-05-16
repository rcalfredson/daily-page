const Autolinker = require('autolinker');
const sanitizeHTML = require('sanitize-html');
sanitizeHTML.defaults.allowedAttributes.img = ['src', 'width'];
const showdown = require('showdown');
const converter = new showdown.Converter();

function archiveHTML(text) {
  text = converter.makeHtml(text);

  let htmlOutput = sanitizeHTML(text, { allowedTags: sanitizeHTML.defaults.allowedTags.concat(['img']) }).replace(/\n/g, '<br>');
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
