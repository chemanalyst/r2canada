#!/usr/bin/env node
/**
 * Rebuilds js/tracker-data.js from the Google Sheet linked to your
 * Reservation Tracker Google Form. Each run replaces the entire entries
 * list with whatever is currently in the Sheet — so both new rows and
 * deleted rows are reflected.
 *
 * Auth: uses a Google service account (a JWT signed with its private key),
 * NOT a public API key. This means the Sheet does not need to be shared
 * with "Anyone with the link" — it can stay fully private, shared only
 * with the service account's own email address, the same way you'd share
 * it with a real collaborator. Nobody else can read it.
 *
 * SETUP
 * 1. In Google Cloud Console, go to IAM & Admin -> Service Accounts ->
 *    Create Service Account. Any name is fine (e.g. "tracker-sync").
 * 2. Open the new service account -> Keys tab -> Add Key -> Create new key
 *    -> JSON. This downloads a .json file — treat it like a password.
 * 3. Open your Google Sheet (the Form's response sheet) -> Share -> paste
 *    in the service account's email (looks like
 *    tracker-sync@your-project.iam.gserviceaccount.com, found inside the
 *    downloaded JSON as "client_email") -> give it Viewer access.
 *    You do NOT need to enable link sharing for anyone else.
 * 4. In your GitHub repo: Settings -> Secrets and variables -> Actions ->
 *    New repository secret. Name it GOOGLE_SERVICE_ACCOUNT_KEY and paste
 *    the ENTIRE contents of the downloaded JSON file as the value.
 * 5. Add (or keep) GOOGLE_SHEETS_ID as a secret with your spreadsheet ID.
 * 6. You can delete the old GOOGLE_SHEETS_API_KEY secret and remove any
 *    "Anyone with the link" sharing on the Sheet — neither is used anymore.
 *
 * Assumes the response Sheet's columns are, in order:
 *   A: Timestamp | B: Region | C: Trim | D: Reservation Date
 *   E: Current Order Status | F: Delivery Date
 * If your form's questions are in a different order, adjust COLUMNS below
 * to match — check row 1 of your response Sheet to confirm.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'tracker-data.js');

const COLUMNS = {
  timestamp: 0,
  region: 1,
  trim: 2,
  reserved_date: 3,
  order_status: 4,
  delivered_date: 5
};

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_RANGE = process.env.GOOGLE_SHEETS_RANGE || 'A2:F1000'; // skip header row
const SERVICE_ACCOUNT_KEY_RAW = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!SHEET_ID || !SERVICE_ACCOUNT_KEY_RAW) {
  console.error('Missing GOOGLE_SHEETS_ID or GOOGLE_SERVICE_ACCOUNT_KEY env vars.');
  process.exit(1);
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken() {
  let key;
  try {
    key = JSON.parse(SERVICE_ACCOUNT_KEY_RAW);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON — make sure the whole downloaded file was pasted in as the secret value.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(key.private_key)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token request failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

function normalizeDate(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  console.warn(`Could not parse date "${raw}" — skipping this row's date.`);
  return null;
}

async function fetchRows(accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.values || [];
}

function loadFileTemplate() {
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  const match = content.match(/window\.TRACKER_ENTRIES\s*=\s*\[[\s\S]*?\];/);
  if (!match) throw new Error('Could not find window.TRACKER_ENTRIES array in tracker-data.js');
  return { content, oldBlock: match[0] };
}

function serializeEntries(entries) {
  if (entries.length === 0) return 'window.TRACKER_ENTRIES = [];';
  const lines = entries.map(e => {
    const parts = [
      `region: ${JSON.stringify(e.region || '')}`,
      `trim: ${JSON.stringify(e.trim || '')}`,
      `reserved_date: ${JSON.stringify(e.reserved_date)}`,
      `order_status: ${JSON.stringify(e.order_status || '')}`,
      `delivered_date: ${e.delivered_date ? JSON.stringify(e.delivered_date) : 'null'}`
    ];
    return `  { ${parts.join(', ')} }`;
  });
  return `window.TRACKER_ENTRIES = [\n${lines.join(',\n')}\n];`;
}

async function main() {
  const accessToken = await getAccessToken();
  const rows = await fetchRows(accessToken);

  const entries = [];
  for (const row of rows) {
    const reservedDate = normalizeDate(row[COLUMNS.reserved_date]);
    if (!reservedDate) continue;

    entries.push({
      region: (row[COLUMNS.region] || '').trim(),
      trim: (row[COLUMNS.trim] || '').trim(),
      reserved_date: reservedDate,
      order_status: (row[COLUMNS.order_status] || '').trim(),
      delivered_date: normalizeDate(row[COLUMNS.delivered_date])
    });
  }

  const { content, oldBlock } = loadFileTemplate();
  const newBlock = serializeEntries(entries);

  if (oldBlock === newBlock) {
    console.log('No changes — tracker-data.js already matches the Sheet.');
    return;
  }

  const newContent = content.replace(oldBlock, newBlock);
  fs.writeFileSync(DATA_FILE, newContent);

  console.log(`Rebuilt tracker-data.js with ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} from the Sheet.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
