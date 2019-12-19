const musicFolderID = process.env.MUSIC_FOLDER_ID;
const fs = require('fs');
const { google } = require('googleapis');
const Promise = require('bluebird');
const scopes = ['https://www.googleapis.com/auth/drive'];
let credentials;
let drive;
const ffmpeg = require('fluent-ffmpeg');
let track = process.argv[2];

let slashSplit = track.split('/');
let fileName = slashSplit[slashSplit.length - 1].split('.mp3')[0];

/*
  Next steps:
    - Make the file a script that accepts an MP3 file path as an argument- DONE
    - Match the title of the files uploaded to Google Docs with the audio file name- DONE
    - At the end of the script, delete the intermediate .wav and .bin files- DONE

  Upload script sufficient for now. Next goal: dynamic endpoint on Daily Page, such as
  /mp3/filename_without_extension.

  It will get the list of files from the music folder, find the ones that match the file
  name, download them, concatenate them, decode the base-64 string, and serve up
  the resulting WAV file. Later, figure out how to make the player navigate
  automatically from track to track.
*/

ffmpeg(track)
.toFormat('wav')
.on('error', (err) => {
    console.log('An error occurred: ' + err.message);
})
.on('progress', (progress) => {
    // console.log(JSON.stringify(progress));
    console.log('Processing: ' + progress.targetSize + ' KB converted');
})
.on('end', () => {
    console.log('Processing finished!');

    var bitmap = fs.readFileSync(`./${fileName}.wav`);
    fs.writeFileSync(`${fileName}.bin`, Buffer.from(bitmap).toString('base64'));

    credentials = JSON.parse(fs.readFileSync('./credentials.json'));
    auth = new google.auth.JWT(credentials.client_email, null, credentials.private_key, scopes);
    drive = google.drive({ version: 'v3', auth });

    var fileMetadata = {
      'name': 'audioAsText',
      driveId: musicFolderID,
      parents: [musicFolderID],
      mimeType: 'application/vnd.google-apps.document',
    };

    let txt = fs.readFileSync(`${fileName}.bin`);
    (async () => {
      const chunkSize = 1500000;
      const chunks = [];
      const numChunks = Math.ceil(txt.toString().length / chunkSize);

      for (let index = 0; index < numChunks; index += 1) {
        chunks.push(txt.toString().slice(index*chunkSize, (index + 1) * chunkSize));
      }

      console.log('how many chunks?');
      console.log(chunks.length);
      console.log('how many chars to chunk?');
      console.log(txt.toString().length);
      chunks.forEach(myChunk => {
        console.log(`indiv chunk length: ${myChunk.length}`);
        console.log(`start of chunk: ${myChunk.slice(0, 8)}`);
        console.log(`chunk end: ${myChunk.slice(myChunk.length - 8, myChunk.length)}`);
      });
      //console.log('entire byte size:');
      //console.log(Buffer.from(bitmap).byteLength);

      await Promise.each(chunks, async (chunk, index) => {
        fileMetadata.parents = [musicFolderID];
        console.log(`creating file for chunk #${index}`);
        fileMetadata.name = `${fileName}_${index}`;
        let createdFile = await drive.files.create({
          resource: fileMetadata,
          // media: media,
          fields: 'id',
          supportsAllDrives: true
        });

        delete fileMetadata.parents;

        await drive.files.update({
          fileId: createdFile.data.id,
          resource: fileMetadata,
          uploadType: 'resumable',
          media: {
            body: chunk,
            mimeType: 'text/plain'
          }
        });
      });
      fs.unlinkSync(`${fileName}.wav`);
      fs.unlinkSync(`${fileName}.bin`);
    })();
})
.save(`./${fileName}.wav`);//path where you want to save your file
