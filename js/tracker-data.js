/**
 * HOW TO USE THIS FILE
 *
 * This tracker no longer writes to a public database — visitors submit their
 * reservation/delivery dates through a Google Form (link is in
 * reservation-tracker.html), which only you can see responses to. That keeps
 * the public site fully static with nothing for anyone to spam, inject, or
 * hack, at the cost of not being real-time: you review submissions and add
 * the ones you approve here, then re-upload the site.
 *
 * SETUP
 * 1. Create a Google Form with these questions: Region, Trim, Reservation
 *    Date, Current Order Status, Delivery Date (actual or estimated if
 *    available).
 * 2. Under Form responses, click the Sheets icon to link responses to a
 *    Google Sheet only you have access to.
 * 3. Get the form's public URL (Send -> link icon) and paste it into the
 *    "Submit your timeline" button href in reservation-tracker.html.
 * 4. Periodically check the response Sheet. For entries you want to
 *    publish, add a line below in the same format as the examples.
 * 5. Re-upload the site (this file) to make new entries go live.
 *
 * FIELDS
 *   region:          province/territory name, or '' if not given
 *   trim:             'Performance' | 'Premium' | 'Standard (Long Range)' |
 *                     'Standard (Base)' | '' if unknown
 *   reserved_date:    'YYYY-MM-DD', required
 *   order_status:     free text from the form, e.g. 'Reserved', 'Configured',
 *                     'In production', 'In transit', 'Delivered' — or '' if
 *                     not given
 *   delivered_date:   'YYYY-MM-DD' (actual or estimated), or null if not
 *                     yet available
 */

window.TRACKER_ENTRIES = [
  { region: "British Columbia", trim: "Performance", reserved_date: "2024-08-14", order_status: "In production", delivered_date: null },
  { region: "Ontario", trim: "Premium", reserved_date: "2024-09-02", order_status: "Configured", delivered_date: null },
  { region: "Quebec", trim: "", reserved_date: "2025-01-20", order_status: "Reserved", delivered_date: null },
  { region: "Quebec", trim: "Standard", reserved_date: "2026-06-09", order_status: "Reservation Only (No Configuration Yet)", delivered_date: "2027-03-19" },
  { region: "Ontario", trim: "Premium", reserved_date: "2026-03-01", order_status: "Reservation Only (No Configuration Yet)", delivered_date: "2027-07-15" }
];
