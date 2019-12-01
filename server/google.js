/* eslint-disable no-await-in-loop */
const baseballFolderID = process.env.BASEBALL_FOLDER_ID;
const { google } = require('googleapis');
const jsdom = require('jsdom');

const { JSDOM } = jsdom;
const fs = require('fs');

const cache = require('./cache');

const scopes = ['https://www.googleapis.com/auth/drive'];
let credentials;
let auth;
let drive;
let mongo;

function init(mongoConnection) {
  try {
    mongo = mongoConnection;
    credentials = JSON.parse(fs.readFileSync('./credentials.json'));
  } catch (error) {
    credentials = JSON.parse(process.env.GOOG_CREDS);
    fs.writeFileSync('./credentials.json', JSON.stringify(credentials));
  }
  auth = new google.auth.JWT(credentials.client_email, null, credentials.private_key, scopes);
  drive = google.drive({ version: 'v3', auth });
}

async function docTitles() {
  const titles = {};
  const prefix = 'Major League Baseball: ';
  function updateTitles(res) {
    res.data.files.forEach((docFile) => {
      const nm = docFile.name;
      titles[docFile.id] = nm.indexOf(prefix) > -1 ? nm.split(prefix)[1] : nm;
    });
  }
  try {
    return await cache.get('docMappings', mongo.getDocMappings);
  } catch (error) {
    const queryParams = {
      pageSize: 500,
      fields: 'nextPageToken, files(name,fullFileExtension,id)',
      orderBy: 'createdTime desc',
      q: `'${baseballFolderID}' in parents`,
    };
    let res = await drive.files.list(queryParams);
    updateTitles(res);
    while (res.data.nextPageToken) {
      res = await drive.files.list(Object.assign(queryParams,
        { pageToken: res.data.nextPageToken }));
      updateTitles(res);
    }
    await mongo.updateDocMappings(titles);
    return cache.get('docMappings', mongo.getDocMappings);
  }
}

async function docText(fileId) {
  let res;
  try {
    res = await drive.files.export({
      fileId,
      alt: 'media',
      mimeType: 'text/html',
    });
  } catch (error) {
    return 'Not found';
  }

  const dom = new JSDOM(res.data);
  const style = dom.window.document.createElement('link');
  const titles = await docTitles();
  style.rel = 'stylesheet';
  style.href = '/css/googleDocs.css';
  dom.window.document.querySelector('head').appendChild(style);
  dom.window.document.querySelector('body').style = 'font-family: "Times New Roman"; margin-left: 20px;';

  const uls = dom.window.document.getElementsByTagName('ul');
  Object.keys(uls).forEach((ul) => {
    uls[ul].className = '';
  });

  const links = dom.window.document.getElementsByTagName('a');
  Object.keys(links).forEach((pageLink) => {
    if (Object.keys(titles).some((docKey) => links[pageLink].href.includes(docKey))) {
      const components = links[pageLink].href.split('/');
      links[pageLink].href = `/baseball/${components[components.length - 2]}`;
    }
  });

  const listItems = dom.window.document.getElementsByTagName('li');
  Object.keys(listItems).forEach((listItem) => {
    listItems[listItem].style.marginLeft = `${(parseInt(listItems[listItem].style.marginLeft.split('px')[0], 10) / 2).toString()}px`;
  });
  const headerDiv = dom.window.document.createElement('div');
  const docTitle = titles[fileId];
  const titleHeader = dom.window.document.createElement('h2');
  titleHeader.style.marginBottom = '2px';
  titleHeader.textContent = docTitle;
  const titleEl = dom.window.document.createElement('title');
  titleEl.textContent = docTitle;
  headerDiv.appendChild(titleHeader);
  dom.window.document.querySelector('head').appendChild(titleEl);
  dom.window.document.querySelector('body').insertAdjacentElement('afterbegin', headerDiv);
  const backEl = dom.window.document.createElement('a');
  backEl.href = '/baseball';
  backEl.textContent = 'Go back';
  headerDiv.insertAdjacentElement('beforeend', backEl);
  for (let index = 0; index < 2; index += 1) {
    headerDiv.appendChild(dom.window.document.createElement('br'));
  }
  return dom.serialize();
}

module.exports = {
  docText,
  docTitles,
  init,
};
