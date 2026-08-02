/**
 * SETUP
 * 1. Create a new Google Sheet.
 * 2. Rename the first tab to "Entries" (case-sensitive).
 * 3. In row 1, add these exact headers, one per column:
 *      A: timestamp   B: region   C: trim   D: reserved_date   E: delivered_date
 * 4. In the Sheet, go to Extensions -> Apps Script.
 * 5. Delete any starter code, paste this whole file in, and save.
 * 6. Click "Deploy" -> "New deployment".
 *      - Type: "Web app"
 *      - Execute as: "Me"
 *      - Who has access: "Anyone"
 * 7. Click Deploy, authorize when prompted, then copy the "Web app URL".
 * 8. Paste that URL into js/sheets-config.js as WEB_APP_URL.
 *
 * Whenever you edit this script after the first deploy, you must create
 * a NEW deployment (or "Manage deployments" -> edit -> new version) for
 * changes to take effect on the existing URL.
 */

var SHEET_NAME = 'Entries';

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var rows = values.slice(1); // skip header row

  var entries = rows
    .filter(function (r) { return r[3]; }) // must have a reserved_date
    .map(function (r) {
      return {
        region: r[1] || '',
        trim: r[2] || '',
        reserved_date: formatDate_(r[3]),
        delivered_date: r[4] ? formatDate_(r[4]) : null
      };
    });

  return ContentService
    .createTextOutput(JSON.stringify({ entries: entries }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (!data.reserved_date) {
      return jsonError_('Missing reserved_date');
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    sheet.appendRow([
      new Date(),
      data.region || '',
      data.trim || '',
      data.reserved_date,
      data.delivered_date || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return jsonError_(err.message);
  }
}

function jsonError_(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}
