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

// Creates a dedicated spreadsheet for one business (never a shared multi-tenant
// sheet — sharing per-business keeps one owner from ever seeing another's data)
// and shares it with the owner's email so they can view/edit it directly.
async function createBusinessSheet(business, ownerEmail) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `ZARAZ — ${business.name} — резервні записи` },
      sheets: [{ properties: { title: 'Bookings' } }],
    },
  });
  const spreadsheetId = createRes.data.spreadsheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Bookings!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER] },
  });

  if (ownerEmail) {
    const drive = google.drive({ version: 'v3', auth });
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { role: 'writer', type: 'user', emailAddress: ownerEmail },
      sendNotificationEmail: false,
    });
  }

  return {
    spreadsheetId,
    spreadsheetUrl: createRes.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
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

module.exports = { isConfigured, createBusinessSheet, readSheetRows, writeSheetRows, HEADER };
