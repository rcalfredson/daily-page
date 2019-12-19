/* eslint-disable no-await-in-loop */
const baseballFolderID = process.env.BASEBALL_FOLDER_ID;
const musicFolderID = process.env.MUSIC_FOLDER_ID;
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
  [styleLink, faviconLink].forEach(headLink => {
    dom.window.document.querySelector('head').appendChild(headLink);
  });
  dom.window.document.querySelector('body').style = 'margin-left: 20px;';

  const lists = [dom.window.document.getElementsByTagName('ul'),
    dom.window.document.getElementsByTagName('ol')];

  const typeMaps = {'36pt': ['disc', '1'], '72pt': ['circle', 'a'], '108pt': ['square', 'i']};

  lists.forEach((list, listIndex) => {
    const htmlList = list;
    Object.keys(htmlList).forEach((listItem) => {
      htmlList[listItem].className = '';
      htmlList[listItem].type = typeMaps[htmlList[listItem].firstChild.style.marginLeft][listIndex];
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

async function getTracks(albumID) {
  let metaFileID = (await drive.files.list({
    fields: 'files(id)',
    orderBy: 'createdTime desc',
    q: `'${albumID}' in parents and name = 'meta'`
  })).data.files[0].id;
  let trackData = await drive.files.export({
    fileId: metaFileID,
    alt: 'media',
    mimeType: 'text/plain',
  });
  return stripBom(trackData.data).split('~').map(el => el.split('*'));
}

async function getAlbums() {
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${musicFolderID}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
  };

  let res = await drive.files.list(queryParams);
  let fileDocs = [];

  res.data.files.forEach((docFile) => {
        fileDocs.push([docFile.id, docFile.name]);
  });

  while (res.data.nextPageToken) {
    res = await drive.files.list(Object.assign(queryParams,
      { pageToken: res.data.nextPageToken }));
    res.data.files.forEach((docFile) => {
        fileDocs.push([docFile.id, docFile.name]);
  })
}
fileDocs.sort((a, b) => {
  if (a[1] > b[1]) { return 1; }
  if (b[1] > a[1]) { return -1; }
  return 0;
});
return {'Albums': fileDocs};
}

async function wavFromText(fileName, parentName, start = null, end = null) {
  //console.log('getting wav from text?');
  const bytesPerChunk = 1125000;
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${parentName || musicFolderID}' in parents and name contains '${fileName}'`,
  };

  //console.log('query');
  //console.log(queryParams);

  let res = await drive.files.list(queryParams);
  // save only the ones beginning with the requested filename??
  let fileDocs = [];

  //console.log('check1');

  res.data.files.forEach((docFile) => {
    if (docFile.name.startsWith(fileName)) {
      const splitName = docFile.name.split('_');
        fileDocs.push([splitName[splitName.length - 1], docFile.id]);
    }
  });
  //console.log('check2');

  while (res.data.nextPageToken) {
    res = await drive.files.list(Object.assign(queryParams,
      { pageToken: res.data.nextPageToken }));
    res.data.files.forEach((docFile) => {
      if (docFile.name.startsWith(fileName)) {
        const splitName = docFile.name.split('_');
        fileDocs.push([splitName[splitName.length - 1], docFile.id]);
      }
    });
  }
  fileDocs.sort((a, b) => {
    var aSplit = a[0].split('_');
    var bSplit = b[0].split('_');
    var numA = parseInt(aSplit[aSplit.length - 1], 10);
    var numB = parseInt(bSplit[bSplit.length - 1], 10);
    return numA - numB;
  });
  let base64Text = '';
  if (start !== null) {
    let startIndex = Math.floor(start / bytesPerChunk);
    // example: file is three chunks. byteLength: 3375000
    // request one: start = 0, end = 1125000
    let endIndex = Math.ceil(end / bytesPerChunk);
    /*
    console.log(`start? ${start}`);
    console.log(`startIndex? ${startIndex}`);
    console.log(`end? ${end}`);
    console.log(`endIndex? ${endIndex}`);
    */
    //console.log('fileDocs before slice');
    //console.log(fileDocs)
    fileDocs = fileDocs.slice(startIndex, endIndex);
    /*
    console.log('start index');
    console.log(startIndex);
    console.log('end index');
    console.log(endIndex);
    */
  }
  //console.log('filedocs?');
  //console.log(fileDocs);
  await Promise.each(fileDocs, async (fileDoc) => {
    try {
      //console.log('trying to get this file?');
      //console.log(fileDoc);
      res = await cache.get(fileDoc[1], (opts) => drive.files.export(opts), [{
        fileId: fileDoc[1],
        alt: 'media',
        mimeType: 'text/plain',
      }], 5 * 60 * 1000);
      //console.log('size of chunk in bytes?');
      //console.log(Buffer.from(stripBom(res.data), 'base64').byteLength);
      /*
      console.log('start of this chunk?');
      console.log(res.data.slice(0, 4));
      console.log('end of this chunk?');
      console.log(res.data.slice(res.data.length - 10, res.data.length));
      console.log('charcode of last char?');
      console.log(res.data.slice(res.data.length - 1).charCodeAt(0));
      console.log('contains newline?');
      console.log(res.data.indexOf('\n'));
      console.log('length after removing null chars??');
      console.log(res.data.replace(/\0/g, '').length);
      console.log('chunk length?');
      console.log(res.data.length);
      */
      base64Text += stripBom(res.data);
    } catch (error) {
      return 'Not found';
    }
  });
  /*
  console.log('got base64 text??');
  console.log(base64Text);
  console.log('how long??');
  console.log(base64Text.length);
  */
  //fs.writeFileSync('../dataFromGoog.bin', base64Text);
  return Buffer.from(base64Text, 'base64');
}

module.exports = {
  docText,
  docTitles,
  init,
  wavFromText,
  getAlbums,
  getTracks,
};
