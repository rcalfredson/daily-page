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

async function wavFromText(fileName) {
  const queryParams = {
    pageSize: 500,
    fields: 'nextPageToken, files(name,fullFileExtension,id)',
    orderBy: 'createdTime desc',
    q: `'${musicFolderID}' in parents`,
  };

  let res = await drive.files.list(queryParams);
  // save only the ones beginning with the requested filename??
  let fileDocs = [];

  res.data.files.forEach((docFile) => {
    const nm = docFile.name;
    if (docFile.name.startsWith(fileName)) {
      const splitName = docFile.name.split('_');
        fileDocs.push([splitName[splitName.length - 1], docFile.id]);
    }
  });

  while (res.data.nextPageToken) {
    res = await drive.files.list(Object.assign(queryParams,
      { pageToken: res.data.nextPageToken }));
    res.data.files.forEach((docFile) => {
      const nm = docFile.name;
      if (docFile.name.startsWith(fileName)) {
        const splitName = docFile.name.split('_');
        fileDocs.push([splitName[splitName.length - 1], docFile.id]);
      }
    });
  }
  fileDocs.sort((a, b) => {
    if (a[0] > b[0]) { return 1; }
    if (b[0] > a[0]) { return -1; }
    return 0;
  });
  let base64Text = '';
  await Promise.each(fileDocs, async (fileDoc) => {
    try {
      res = await drive.files.export({
        fileId: fileDoc[1],
        alt: 'media',
        mimeType: 'text/plain',
      });
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
  wavFromText
};
