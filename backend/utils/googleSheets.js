const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];

const HEADER = ['ID запису', 'Дата', 'Час', "Ім'я клієнта", 'Телефон', 'Послуга', 'Майстер', 'Ціна', 'Статус', 'Джерело'];

function isConfigured() {
  return !!(process.env.GOOGLE_SHEETS_CLIENT_EMAIL && process.env.GOOGLE_SHEETS_PRIVATE_KEY);
}

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
}

// Service accounts have no Drive storage quota of their own and can't create new
// files (they hit a "does not have permission" error on a plain, non-Workspace
// Google account the moment they try) — so instead the business creates
// an empty sheet in their own Drive and shares it with the service account as
// Editor, then connects it here by URL. Renames the first tab to "Bookings" so the
// hardcoded ranges in readSheetRows/writeSheetRows keep working regardless of what
// the business's spreadsheet happened to be named.
function extractSpreadsheetId(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(trimmed) ? trimmed : null;
}

async function connectExistingSheet(spreadsheetId) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheet = meta.data.sheets?.[0];
  if (!firstSheet) throw new Error('EMPTY_SPREADSHEET');

  if (firstSheet.properties.title !== 'Bookings') {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          { updateSheetProperties: { properties: { sheetId: firstSheet.properties.sheetId, title: 'Bookings' }, fields: 'title' } },
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Bookings!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER] },
  });

  return { spreadsheetUrl: meta.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}` };
}

async function readSheetRows(spreadsheetId) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Bookings!A2:J2000' });
  return res.data.values || [];
}

async function writeSheetRows(spreadsheetId, rows) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Bookings!A2:J100000' });
  if (rows.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Bookings!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

module.exports = {
  isConfigured,
  connectExistingSheet,
  extractSpreadsheetId,
  readSheetRows,
  writeSheetRows,
  HEADER,
};
