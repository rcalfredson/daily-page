/* eslint-disable no-await-in-loop */
import fs from 'fs';
import { google } from 'googleapis';
import jsdom from 'jsdom';
import Promise from 'bluebird';
import slug from 'slug';
import stripBom from 'strip-bom';

import * as cache from './cache.js';

const baseballFolderID = process.env.BASEBALL_FOLDER_ID;
const albumsFolderID = process.env.ALBUMS_FOLDER_ID;
const artistsFolderID = process.env.ARTISTS_FOLDER_ID;

const { JSDOM } = jsdom;

const scopes = ['https://www.googleapis.com/auth/drive'];
let credentials;
let auth;
let drive;
let mongo;
let lastRequestTime = 0;

export function init(mongoConnection) {
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

export async function getDocTitles() {
  const titles = {};
  const prefix = 'Major League Baseball: ';
  function updateTitles(res) {
    res.data.files.forEach((docFile) => {
      let nm = docFile.name;
      nm = nm.indexOf(prefix) > -1 ? nm.split(prefix)[1] : nm;
      titles[slug(nm)] = { name: nm, id: docFile.id };
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

export async function docText(slug) {
  const titles = await getDocTitles();
  const fileId = titles[slug].id;
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
  const viewportMeta = dom.window.document.createElement('meta');
  viewportMeta.setAttribute('name', 'viewport');
  viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1');
  faviconLink.rel = 'shortcut icon';
  faviconLink.href = '/assets/img/favicon.ico';
  styleLink.rel = 'stylesheet';
  styleLink.href = '/css/googleDocs.css';

  [styleLink, faviconLink].forEach((headLink) => {
    dom.window.document.querySelector('head').appendChild(headLink);
  });
  dom.window.document.querySelector('head').appendChild(viewportMeta);
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
  const docTitle = titles[slug].name;
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

export async function throttleAsNeeded(funcToCall, args) {
  return new Promise((resolve, reject) => {
    const timeDiff = new Date() - lastRequestTime;
    let timeToWait = 0;
    if (timeDiff < 100) {
      timeToWait = 100;
    }
    lastRequestTime = new Date();
    setTimeout(async () => {
      const result = await funcToCall(...args);
      resolve(result);
    }, timeToWait);
  });
}

export async function getArtist(albumID) {
  const metaFileID = (await cache.get(`${albumID}_metaID`, throttleAsNeeded, [(opts) => drive.files.list(opts), [{
    fields: 'files(id)',
    orderBy: 'createdTime desc',
    q: `'${albumID}' in parents and name = 'meta'`,
  }]], 5 * 60 * 1000)).data.files[0].id;
  const metaData = stripBom((await cache.get(`${albumID}_meta`, throttleAsNeeded, [(opts) => drive.files.export(opts), [{
    fileId: metaFileID,
    alt: 'media',
    mimeType: 'text/plain',
  }]], 5 * 60 * 1000)).data);

  return metaData.split('\r\n').length === 1 ? 'Unknown' : metaData.split('\r\n')[0];
}

export async function getTracks(albumID) {
  const metaFileID = (await cache.get(`${albumID}_metaID`, throttleAsNeeded, [(opts) => drive.files.list(opts), [{
    fields: 'files(id)',
    orderBy: 'createdTime desc',
    q: `'${albumID}' in parents and name = 'meta'`,
  }]], 5 * 60 * 1000)).data.files[0].id;
  const metaData = stripBom((await cache.get(`${albumID}_meta`, throttleAsNeeded, [(opts) => drive.files.export(opts), [{
    fileId: metaFileID,
    alt: 'media',
    mimeType: 'text/plain',
  }]], 5 * 60 * 1000)).data);
  const trackData = metaData.split('\r\n').length === 1 ? metaData.split('\r\n')[0] : metaData.split('\r\n')[1];
  return trackData.split('~').map((el) => el.split('*'));
}

export async function getArtists() {
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${artistsFolderID}' in parents and mimeType = 'application/vnd.google-apps.document'`,
  };

  let res = await throttleAsNeeded((opts) => drive.files.list(opts), [queryParams]);
  const fileDocs = [];

  res.data.files.forEach((docFile) => {
    fileDocs.push([docFile.id, docFile.name]);
  });

  while (res.data.nextPageToken) {
    res = await throttleAsNeeded((opts) => drive.files.list(opts), [Object.assign(queryParams,
      { pageToken: res.data.nextPageToken })]);
    res.data.files.forEach((docFile) => {
      fileDocs.push([docFile.id, docFile.name]);
    });
  }
  fileDocs.sort((a, b) => {
    if (a[1] > b[1]) { return 1; }
    if (b[1] > a[1]) { return -1; }
    return 0;
  });
  return { Artists: fileDocs };
}

export async function getSongs() {
  const { Albums } = await cache.get('albums', getAlbums, [], 40 * 1000);
  let allTracks = [];
  const promises = [];
  Albums.forEach((album) => {
    promises.push((async () => {
      const albumArtist = await getArtist(album[0]);
      const trackData = await getTracks(album[0]);
      trackData.forEach((track) => {
        allTracks.push({
          id: track[0], title: track[1], album, artist: track.length > 3 ? track[3] : albumArtist,
        });
      });
    })());
  });

  await Promise.all(promises);
  allTracks = allTracks.sort((a, b) => {
    if (a.title > b.title) { return 1; }
    if (b.title > a.title) { return -1; }
    return 0;
  });

  return { Songs: allTracks };
}

export async function getAlbums() {
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${albumsFolderID}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
  };

  let res = await throttleAsNeeded((opts) => drive.files.list(opts), [queryParams]);
  const fileDocs = [];

  res.data.files.forEach((docFile) => {
    fileDocs.push([docFile.id, docFile.name]);
  });

  while (res.data.nextPageToken) {
    res = await throttleAsNeeded((opts) => drive.files.list(opts), [Object.assign(queryParams,
      { pageToken: res.data.nextPageToken })]);
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

export async function getAlbumIDsByArtist(artistID) {
  return stripBom((await cache.get(artistID, throttleAsNeeded, [(opts) => drive.files.export(opts), [{
    fileId: artistID,
    alt: 'media',
    mimeType: 'text/plain',
  }]], 5 * 60 * 1000)).data).split('\r\n');
}

export async function wavFromText(fileName, parentName, start = null, end = null) {
  const bytesPerChunk = 1125000;
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${parentName}' in parents and name contains '${fileName}'`,
  };

  let res = await throttleAsNeeded((opts) => drive.files.list(opts), [queryParams]);
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
    res = await throttleAsNeeded((opts) => drive.files.list(opts), [Object.assign(queryParams,
      { pageToken: res.data.nextPageToken })]);
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
      data[fIdx] = await cache.get(fileDoc[1], throttleAsNeeded, [(opts) => drive.files.export(opts), [{
        fileId: fileDoc[1],
        alt: 'media',
        mimeType: 'text/plain',
      }]], 2 * 60 * 60 * 1000);
    })());
  });

  await Promise.all(promises);
  Object.keys(data).sort((a, b) => a - b).forEach((dataKey) => {
    base64Text += stripBom(data[dataKey].data);
  });
  return Buffer.from(base64Text, 'base64');
}
