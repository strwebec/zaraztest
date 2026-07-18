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

  // Sharing can fail even though the sheet itself was created fine — most commonly a
  // Workspace org policy blocking sharing to a specific external address. That must
  // not be fatal to the whole flow: readSheetRows/writeSheetRows below always use the
  // service account's own credentials, not the owner's, so the sheet is fully usable
  // for backup sync either way — only the owner's own view/edit access is at risk.
  // Without this try/catch, a permission failure here used to throw out of
  // createBusinessSheet entirely, so business.backupSheetId never got saved and every
  // 5-minute sync recreated a brand-new sheet from scratch forever, never actually
  // adopting one — which is why the backup table could get permanently stuck at
  // "not created yet" even though sheets were silently being created the whole time.
  if (ownerEmail) {
    const drive = google.drive({ version: 'v3', auth });
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { role: 'writer', type: 'user', emailAddress: ownerEmail },
        sendNotificationEmail: false,
      });
    } catch (err) {
      console.error(`[googleSheets] could not share sheet ${spreadsheetId} with ${ownerEmail}:`, err.message);
      // Fall back to link-sharing so the owner can still reach it via backupSheetUrl
      // even without an explicit per-user grant, in case only targeted external
      // sharing (not general link-sharing) is restricted by the org's Drive policy.
      try {
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: { role: 'writer', type: 'anyone' },
        });
      } catch (linkErr) {
        console.error(`[googleSheets] link-sharing fallback also failed for ${spreadsheetId}:`, linkErr.message);
      }
    }
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
