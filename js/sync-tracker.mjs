#!/usr/bin/env node
/**
 * Reads new rows from the Google Sheet linked to your Reservation Tracker
 * Google Form, formats them, and appends them to js/tracker-data.js.
 *
 * Read-only: uses a Google Sheets API key, which can only fetch data, never
 * write back to the Sheet or anything else in your Google account.
 *
 * Requires two GitHub Actions secrets/variables (see workflow file):
 *   GOOGLE_SHEETS_API_KEY   - an API key with the Sheets API enabled
 *   GOOGLE_SHEETS_ID        - the spreadsheet ID from its URL
 *
 * Assumes the response Sheet's columns are, in order:
 *   A: Timestamp | B: Region | C: Trim | D: Reservation Date
 *   E: Current Order Status | F: Delivery Date
 * If your form's questions are in a different order, adjust COLUMNS below
 * to match — check row 1 of your response Sheet to confirm.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'tracker-data.js');
const STATE_FILE = path.join(__dirname, 'tracker-sync-state.json');

const COLUMNS = {
  timestamp: 0,
  region: 1,
  trim: 2,
  reserved_date: 3,
  order_status: 4,
  delivered_date: 5
};

const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_RANGE = process.env.GOOGLE_SHEETS_RANGE || 'A2:F1000'; // skip header row

if (!API_KEY || !SHEET_ID) {
  console.error('Missing GOOGLE_SHEETS_API_KEY or GOOGLE_SHEETS_ID env vars.');
  process.exit(1);
}

function normalizeDate(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Try native Date parsing as a fallback (handles most M/D/YYYY etc.)
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  console.warn(`Could not parse date "${raw}" — leaving entry's date as null.`);
  return null;
}

async function fetchRows() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.values || [];
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { syncedTimestamps: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function loadEntries() {
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  const match = content.match(/window\.TRACKER_ENTRIES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not find window.TRACKER_ENTRIES array in tracker-data.js');
  // Safe-ish eval of a JSON-like JS array literal
  // eslint-disable-next-line no-new-func
  const entries = Function(`"use strict"; return (${match[1]});`)();
  return { content, entries, arrayText: match[1] };
}

function serializeEntries(entries) {
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
  return `[\n${lines.join(',\n')}\n]`;
}

async function main() {
  const rows = await fetchRows();
  const state = loadState();
  const synced = new Set(state.syncedTimestamps);

  const { content, entries, arrayText } = loadEntries();

  let added = 0;
  for (const row of rows) {
    const timestamp = row[COLUMNS.timestamp];
    if (!timestamp || synced.has(timestamp)) continue;

    const reservedDate = normalizeDate(row[COLUMNS.reserved_date]);
    if (!reservedDate) {
      console.warn(`Skipping row with timestamp ${timestamp}: no valid reservation date.`);
      synced.add(timestamp);
      continue;
    }

    entries.push({
      region: (row[COLUMNS.region] || '').trim(),
      trim: (row[COLUMNS.trim] || '').trim(),
      reserved_date: reservedDate,
      order_status: (row[COLUMNS.order_status] || '').trim(),
      delivered_date: normalizeDate(row[COLUMNS.delivered_date])
    });

    synced.add(timestamp);
    added++;
  }

  if (added === 0) {
    console.log('No new entries to sync.');
    return;
  }

  const newArrayText = serializeEntries(entries);
  const newContent = content.replace(arrayText, newArrayText);
  fs.writeFileSync(DATA_FILE, newContent);

  saveState({ syncedTimestamps: Array.from(synced) });

  console.log(`Synced ${added} new entr${added === 1 ? 'y' : 'ies'}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
