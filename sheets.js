const { google } = require('googleapis');
const path = require('path');
const fs   = require('fs');

// ── SHEET ID from env ──────────────────────────────────────────────────────
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// ── CREDENTIALS: loaded from env or from credentials file ─────────────────
// NEVER hardcode private keys in source code — they get committed to git
// and cannot be un-leaked once pushed.
//
// Two options (pick one, both set in .env):
//   Option A: path to the downloaded JSON file
//     GOOGLE_CREDENTIALS_FILE=/path/to/kryptoinsides-xxxx.json
//   Option B: paste the entire JSON as a single-line string
//     GOOGLE_CREDENTIALS_JSON={"type":"service_account","private_key":"..."}
function getAuth() {
  let credentials;

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } catch(e) {
      console.error('[Sheets] GOOGLE_CREDENTIALS_JSON is not valid JSON:', e.message);
      return null;
    }
  } else if (process.env.GOOGLE_CREDENTIALS_FILE) {
    try {
      credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_CREDENTIALS_FILE, 'utf8'));
    } catch(e) {
      console.error('[Sheets] Cannot read GOOGLE_CREDENTIALS_FILE:', e.message);
      return null;
    }
  } else {
    // Fallback: look for the json file next to this module (kept OUT of git via .gitignore)
    const localFile = path.join(__dirname, 'google-credentials.json');
    if (fs.existsSync(localFile)) {
      try {
        credentials = JSON.parse(fs.readFileSync(localFile, 'utf8'));
      } catch(e) {
        console.error('[Sheets] Cannot parse google-credentials.json:', e.message);
        return null;
      }
    } else {
      console.warn('[Sheets] No Google credentials found — Sheet logging disabled.');
      console.warn('[Sheets] Add GOOGLE_CREDENTIALS_FILE or GOOGLE_CREDENTIALS_JSON to .env');
      return null;
    }
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

async function addUserToSheet(name, email, plan) {
  try {
    const auth = getAuth();
    if (!auth || !SHEET_ID) return;  // credentials not configured — skip silently
    const sheets = google.sheets({ version: 'v4', auth });
    const timestamp = new Date().toLocaleString('en-GB');

    // Check if headers exist, add if not
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1:D1'
    });

    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: 'Sheet1!A1:D1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Name', 'Email', 'Signup Date', 'Plan']] }
      });
    }

    // Append new user row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:D',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[name, email, timestamp, plan || 'free']] }
    });

    console.log('Added to Google Sheet:', email);
  } catch(err) {
    console.error('Google Sheets error:', err.message);
  }
}

async function updateUserPlan(email, plan) {
  try {
    const auth = getAuth();
    if (!auth || !SHEET_ID) return;
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:D'
    });

    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] && rows[i][1].toLowerCase() === email.toLowerCase()) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: 'Sheet1!D' + (i + 1),
          valueInputOption: 'RAW',
          requestBody: { values: [[plan]] }
        });
        console.log('Updated plan in sheet for:', email);
        break;
      }
    }
  } catch(err) {
    console.error('Google Sheets update error:', err.message);
  }
}

module.exports = { addUserToSheet, updateUserPlan };
