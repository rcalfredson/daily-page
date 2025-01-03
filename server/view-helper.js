import Autolinker from 'autolinker';
import sanitizeHTML from 'sanitize-html';
import showdown from 'showdown';

sanitizeHTML.defaults.allowedAttributes.img = ['src', 'width'];

const converter = new showdown.Converter();

export function archiveHTML(text) {
  text = converter.makeHtml(text.replace(/\u00A0/g, ' '));
  let htmlOutput = sanitizeHTML(text,
    { allowedTags: sanitizeHTML.defaults.allowedTags.concat(['img']) });
  if (text.indexOf('\\n') !== -1) {
    htmlOutput = htmlOutput.replace(/\\n/g, '<br>');
  }
  return Autolinker.link(htmlOutput);
}

export function archiveContent(pageData) {
  let errorMessage;
  let text;

  if (!pageData) {
    errorMessage = 'We could not find the page for that day.';
  } else if (!pageData.content ||
    pageData.content.replace(/^(\s+|\u200b+)|(\s+|\u200b+)$/g, '') === '') {
    errorMessage = 'The page for this day is blank, although it was edited at least once.';
  } else {
    text = archiveHTML(pageData.content);
  }

  return [errorMessage, text];
}

export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
