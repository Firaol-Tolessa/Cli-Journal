const fs = require('fs');
const { google } = require('googleapis');
const { file } = require('googleapis/build/src/apis/file');
const { Readable } = require('stream');
require('dotenv').config();

const ui = require('./journal.ui');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const tempDir = './temp/';

let metadataFileId;
let entriesFolderId;

class Journal {

  constructor() {
    this.metadataFileId = null;
    this.entriesFolderId = null;
    this.REFRESHTOKEN = process.env.REFRESHTOKEN;
  }

  async init() {
    this.metadataFileId = await this.getMetadataId();
    this.entriesFolderId = await this.getFolderId();
    // console.log("Init complete:", {
    //   metadataFileId: this.metadataFileId,
    //   entriesFolderId: this.entriesFolderId,
    // });
    return this;
  }

  async getMetadataId() {
    const auth = await this.authorize();
    const driveService = await google.drive({ version: "v3", auth });
    const metadata = await driveService.files.list({
      q: `name='metadata.json' and trashed=false`,
      fields: "files(id, name)",
    });
    if (metadata.data.files.length == 0) {
      console.log('Can find the required files on Google drive');
    } else {

      this.metadataFileId = metadata.data.files[0].id;
      return this.metadataFileId;
      // console.log('metadata id :' + metadataFileId);
    }
  }

  async getFolderId() {
    const auth = await this.authorize();
    const driveService = await google.drive({ version: "v3", auth });
    const folder = await driveService.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='entries' and trashed=false`,
      fields: "files(id, name)",
    });

    if (folder.data.files.length == 0) {
      console.log('Can find the required folder on Google drive');
    } else {

      this.entriesFolderId = folder.data.files[0].id;
      return this.entriesFolderId;
      // console.log('entry id :' + entriesFolderId);
    }

  }

  async authorize() {
    const auth = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    auth.setCredentials({
      refresh_token: this.REFRESHTOKEN,
    });
    return auth;
  }

  async uploadFile(bot, data) {
    const auth = await this.authorize();
    const driveService = google.drive({ version: "v3", auth });

    if (bot) {
      const journal = JSON.stringify(data, null, 2);
      const metadata = {
        name: data.id + '.txt',
        parents: [this.entriesFolderId]
      }
      const media = {
        mimeType: 'text/plain',
        body: Readable.from([journal])
      }
      await this.publish(driveService, media, metadata)
    } else {
      fs.readdir(tempDir, (err, journals) => {
        if (journals.length == 0) {
          console.log('All journals published');
        } else {
          journals.forEach(async journal => {
            const metadata = {
              name: journal,
              parents: [this.entriesFolderId]
            }
            const media = {
              mimeType: 'text/plain',
              body: fs.createReadStream(tempDir + journal)
            }

            this.publish(driveService, media, metadata).finally(() => { fs.unlink(tempDir + journal, (err) => { }); })
          });
        }
      })



    }



  }

  async publish(driveService, media, metadata) {
    console.log("metaddaar ", this.metadataFileId);

    try {
      console.log('Uploading file...');
      // The create method returns a promise, so we must 'await' it
      const response = driveService.files.create({
        requestBody: metadata, // 'requestBody' is used in v3
        media: media,
        fields: 'id,name', // Specify which fields to return in the response
      }).finally(async () => {
        const journalMetadata = await this.getFile(this.metadataFileId);

        if (media.wordcount > parseInt(journalMetadata.wordcountavg)) {
          this.updateFile(this.metadataFileId, {
            "entries": parseInt(journalMetadata.entries) + 1,
            "wordcountavg": parseInt(journalMetadata.wordcountavg) + journal.wordcount
          })
        } else {
          this.updateFile(this.metadataFileId, {
            "entries": parseInt(journalMetadata.entries) + 1,
            "wordcountavg": parseInt(journalMetadata.wordcountavg)
          })
          console.log('\x1b[31m' + 'Your are writing less ? What happened?' + '\x1b[0m');
        }

        // Delete the temp file


      });
    } catch (error) {
      console.error('Error uploading file:', error.message);
    }

  }

  async getFile(fileId) {
    const auth = await this.authorize();
    const driveService = await google.drive({ version: "v3", auth });
    try {
      const response = await driveService.files.get({
        fileId: fileId,
        alt: 'media',
      })

      return response.data;

    } catch (error) {
      console.log(error);

    }
  }

  async getLastFile() {
    const auth = await this.authorize();
    const driveService = await google.drive({ version: "v3", auth });
    try {
      const response = await driveService.files.list({
        pageSize: 5,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
      })
      const files = response.data.files;
      const lastFile = (files[0].name == 'metadata.json') ? files[1] : files[0];

      const journal = await this.getFile(lastFile.id);

      ui.journalDisplay({ date: lastFile.name.split('.')[0], mood: journal.mood, themes: journal.tags, entry: journal.entry });
      // .then((journal) => {
      //   console.log('\n \x1b[32m' + lastFile.name.split('.')[0] + '\x1b[0m' +
      //     '\x1b[33m' + '  [mood : ' + journal.mood + '] \x1b[0m' +
      //     '\x1b[33m' + ' [tags : ' + journal.tags + ']' + '\x1b[0m \n');
      //   console.log(journal.entry);
      //   console.log('──────────────────────────────────────────────');

return { date: lastFile.name.split('.')[0], mood: journal.mood, themes: journal.tags, entry: journal.entry };
    } catch (error) {
      console.log(error);

    }
  }

  async updateFile(fileId, newContent) {
    const auth = await this.authorize();
    const driveService = google.drive({ version: "v3", auth });
    try {
      const response = driveService.files.update({
        fileId: fileId,
        media: {
          body: newContent,
        },
      })
      // console.log('File content read successfully.');
      // console.log(((await response).data));
    } catch (error) {
      console.log(error);

    }
  }

  async listJournals(bot, listall, startDate, endDate) {
    let _RESULT = null;
    try {
      const auth = await this.authorize();
      const googleDriveClient = google.drive({ version: 'v3', auth });

      const response = await googleDriveClient.files.list
        ({
          pageSize: 150,
          q: `'${this.entriesFolderId}' in parents `
        });

      if (response && response.data && response.data.files) {
        _RESULT = response.data.files;
      }

      if (bot) {
         const entries = await this.listJournalsBot(listall, startDate, endDate, _RESULT);
         console.log(entries);
         
         return entries;
      } else {
        this.listJournalsCli(listall, startDate, endDate, _RESULT);
      }
    }
    catch (ex) { console.log(ex); }
  }

  async listJournalsCli(listall, startDate, endDate, _RESULT) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    var entries = [];
    let itemsProcessed = 0;
    ui.initProgress();


    for (const file of _RESULT) {
      const entry = file.name.split('.')[0];
      const entryDate = new Date(entry);
      if (listall) {
        const journal = await this.getFile(file.id);
        ui.progress(itemsProcessed + 1, _RESULT.length);
        entries.push({ date: entry, mood: journal.mood, themes: journal.tags, entry: journal.entry });
        itemsProcessed++;
      } else {
        if (start <= entryDate && entryDate <= end) {
          const journal = await this.getFile(file.id);
          ui.progress(itemsProcessed + 1, _RESULT.length);
          entries.push({ date: entry, mood: journal.mood, themes: journal.tags, entry: journal.entry });
          itemsProcessed++;
        }
      }

    }

    ui.tableMaker(entries);
  }

  async listJournalsBot(listall, startDate, endDate, _RESULT) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    var entries = [];
    let itemsProcessed = 0;

    for (const file of _RESULT) {
      const entry = file.name.split('.')[0];
      const entryDate = new Date(entry);
      if (listall) {
        const journal = await this.getFile(file.id);
        entries.push({ date: entry, mood: journal.mood, themes: journal.tags, entry: journal.entry });
        itemsProcessed++;
      } else {
        if (start <= entryDate && entryDate <= end) {
          const journal = await this.getFile(file.id);
          entries.push({ date: entry, mood: journal.mood, themes: journal.tags, entry: journal.entry });
          itemsProcessed++;
        }
      }

    }
 
    return entries;
  }
}
module.exports = Journal;
