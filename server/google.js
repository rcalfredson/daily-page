/* eslint-disable no-await-in-loop */
const baseballFolderID = process.env.BASEBALL_FOLDER_ID;
const albumsFolderID = process.env.ALBUMS_FOLDER_ID;
const { google } = require('googleapis');
const jsdom = require('jsdom');
const Promise = require('bluebird');
const stripBom = require('strip-bom');

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
  const styleLink = dom.window.document.createElement('link');
  const faviconLink = dom.window.document.createElement('link');
  faviconLink.rel = 'shortcut icon';
  faviconLink.href = '/assets/img/favicon.ico';
  const titles = await docTitles();
  styleLink.rel = 'stylesheet';
  styleLink.href = '/css/googleDocs.css';
  [styleLink, faviconLink].forEach((headLink) => {
    dom.window.document.querySelector('head').appendChild(headLink);
  });
  dom.window.document.querySelector('body').style = 'margin-left: 20px;';

  const lists = [dom.window.document.getElementsByTagName('ul'),
    dom.window.document.getElementsByTagName('ol')];

  const typeMaps = { 1: ['disc', '1'], 2: ['circle', 'a'], 0: ['square', 'i'] };

  lists.forEach((list, listIndex) => {
    const htmlList = list;
    Object.keys(htmlList).forEach((listItem) => {
      const mapKey = (parseInt(htmlList[listItem].firstChild.style.marginLeft.split('pt')[0], 10) / 36) % 3;
      htmlList[listItem].className = '';
      htmlList[listItem].type = typeMaps[mapKey][listIndex];
    });
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
    listItems[listItem].style.marginLeft = `${(parseInt(listItems[listItem].style.marginLeft.split('px')[0], 10) / 1.5).toString()}px`;
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

async function getArtist(albumID) {
  const metaFileID = (await cache.get(`${albumID}_metaID`, (opts) => drive.files.list(opts), [{
    fields: 'files(id)',
    orderBy: 'createdTime desc',
    q: `'${albumID}' in parents and name = 'meta'`,
  }], 5 * 60 * 1000)).data.files[0].id;
  const metaData = stripBom((await cache.get(`${albumID}_meta`, (opts) => drive.files.export(opts), [{
    fileId: metaFileID,
    alt: 'media',
    mimeType: 'text/plain',
  }], 5 * 60 * 1000)).data);

  return metaData.split('\n').length === 1 ? 'Unknown' : metaData.split('\n')[0];
}

async function getTracks(albumID) {
  const metaFileID = (await cache.get(`${albumID}_metaID`, (opts) => drive.files.list(opts), [{
    fields: 'files(id)',
    orderBy: 'createdTime desc',
    q: `'${albumID}' in parents and name = 'meta'`,
  }], 5 * 60 * 1000)).data.files[0].id;
  const metaData = stripBom((await cache.get(`${albumID}_meta`, (opts) => drive.files.export(opts), [{
    fileId: metaFileID,
    alt: 'media',
    mimeType: 'text/plain',
  }], 5 * 60 * 1000)).data);
  const trackData = metaData.split('\n').length === 1 ? metaData.split('\n')[0] : metaData.split('\n')[1];
  return trackData.split('~').map((el) => el.split('*'));
}

async function getAlbums() {
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${albumsFolderID}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
  };

  let res = await drive.files.list(queryParams);
  const fileDocs = [];

  res.data.files.forEach((docFile) => {
    fileDocs.push([docFile.id, docFile.name]);
  });

  while (res.data.nextPageToken) {
    res = await drive.files.list(Object.assign(queryParams,
      { pageToken: res.data.nextPageToken }));
    res.data.files.forEach((docFile) => {
      fileDocs.push([docFile.id, docFile.name]);
    });
  }
  fileDocs.sort((a, b) => {
    if (a[1] > b[1]) { return 1; }
    if (b[1] > a[1]) { return -1; }
    return 0;
  });
  return { Albums: fileDocs };
}

async function wavFromText(fileName, parentName, start = null, end = null) {
  const bytesPerChunk = 1125000;
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${parentName}' in parents and name contains '${fileName}'`,
  };

  let res = await drive.files.list(queryParams);
  let fileDocs = [];

  function addToFileDocs(docFile) {
    if (docFile.name.startsWith(fileName)) {
      const splitName = docFile.name.split('_');
      fileDocs.push([splitName[splitName.length - 1], docFile.id]);
    }
  }

  res.data.files.forEach((docFile) => {
    addToFileDocs(docFile);
  });

  while (res.data.nextPageToken) {
    res = await drive.files.list(Object.assign(queryParams,
      { pageToken: res.data.nextPageToken }));
    res.data.files.forEach((docFile) => {
      addToFileDocs(docFile);
    });
  }
  fileDocs.sort((a, b) => {
    const aSplit = a[0].split('_');
    const bSplit = b[0].split('_');
    const numA = parseInt(aSplit[aSplit.length - 1], 10);
    const numB = parseInt(bSplit[bSplit.length - 1], 10);
    return numA - numB;
  });
  let base64Text = '';
  if (start !== null) {
    const startIndex = Math.floor(start / bytesPerChunk);
    const endIndex = Math.ceil(end / bytesPerChunk);
    fileDocs = fileDocs.slice(startIndex, endIndex);
  }
  const data = {};
  const promises = [];
  fileDocs.forEach((fileDoc, fIdx) => {
    promises.push((async () => {
      data[fIdx] = await cache.get(fileDoc[1], (opts) => drive.files.export(opts), [{
        fileId: fileDoc[1],
        alt: 'media',
        mimeType: 'text/plain',
      }], 5 * 60 * 1000);
    })());
  });

  await Promise.all(promises);
  Object.keys(data).sort((a, b) => a - b).forEach((dataKey) => {
    base64Text += stripBom(data[dataKey].data);
  });
  return Buffer.from(base64Text, 'base64');
}

module.exports = {
  docText,
  docTitles,
  init,
  wavFromText,
  getArtist,
  getAlbums,
  getTracks,
};
