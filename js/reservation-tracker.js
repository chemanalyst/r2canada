document.addEventListener('DOMContentLoaded', function () {
  var resDate = document.getElementById('res-date');
  var delDate = document.getElementById('del-date');
  var region = document.getElementById('region');
  var trim = document.getElementById('trim');
  var submitBtn = document.getElementById('entry-submit');
  var formError = document.getElementById('form-error');
  var tbody = document.getElementById('entry-body');
  var emptyState = document.getElementById('empty-state');
  var table = document.getElementById('entry-table');
  var configBanner = document.getElementById('config-banner');

  var SEED_ENTRIES = [
    { region: 'British Columbia', trim: 'Performance', reserved_date: '2024-08-14', delivered_date: null },
    { region: 'Ontario', trim: 'Premium', reserved_date: '2024-09-02', delivered_date: null },
    { region: 'Quebec', trim: '', reserved_date: '2025-01-20', delivered_date: null }
  ];

  var config = window.SHEETS_CONFIG || {};
  var webAppUrl = config.webAppUrl;
  var isConfigured = webAppUrl && webAppUrl.indexOf('YOUR_APPS_SCRIPT') === -1;

  if (!isConfigured && configBanner) {
    configBanner.style.display = 'block';
  }

  function daysBetween(a, b) {
    var d1 = new Date(a + 'T00:00:00');
    var d2 = new Date(b + 'T00:00:00');
    return Math.round((d2 - d1) / 86400000);
  }

  function formatDate(str) {
    if (!str) return '—';
    var d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatWait(days) {
    if (days == null) return '<span style="color:var(--muted)">Waiting…</span>';
    var months = Math.round(days / 30.44 * 10) / 10;
    return days + ' days <span style="color:var(--muted)">(~' + months + ' mo)</span>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderEntries(entries) {
    // most recent reservation first
    entries = entries.slice().sort(function (a, b) {
      return new Date(b.reserved_date) - new Date(a.reserved_date);
    });

    tbody.innerHTML = '';

    if (entries.length === 0) {
      table.style.display = 'none';
      emptyState.style.display = 'block';
    } else {
      table.style.display = '';
      emptyState.style.display = 'none';
      entries.forEach(function (e) {
        var wait = e.delivered_date ? daysBetween(e.reserved_date, e.delivered_date) : null;
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(e.region || 'Not specified') + '</td>' +
          '<td>' + escapeHtml(e.trim || 'Unknown') + '</td>' +
          '<td>' + formatDate(e.reserved_date) + '</td>' +
          '<td>' + formatDate(e.delivered_date) + '</td>' +
          '<td>' + formatWait(wait) + '</td>';
        tbody.appendChild(tr);
      });
    }

    var delivered = entries.filter(function (e) { return e.delivered_date; });
    var waiting = entries.length - delivered.length;
    var avg = null;
    if (delivered.length) {
      var total = delivered.reduce(function (sum, e) { return sum + daysBetween(e.reserved_date, e.delivered_date); }, 0);
      avg = Math.round(total / delivered.length);
    }

    document.getElementById('stat-count').textContent = entries.length;
    document.getElementById('stat-delivered').textContent = delivered.length;
    document.getElementById('stat-waiting').textContent = waiting;
    document.getElementById('stat-avg').textContent = avg != null ? avg + 'd' : '—';
  }

  async function loadAndRender() {
    if (!isConfigured) {
      renderEntries(SEED_ENTRIES);
      return;
    }
    try {
      var res = await fetch(webAppUrl, { method: 'GET' });
      var data = await res.json();
      renderEntries(data.entries || []);
    } catch (err) {
      console.error('Sheets load error:', err);
      renderEntries(SEED_ENTRIES);
    }
  }

  submitBtn.addEventListener('click', async function () {
    if (!resDate.value) {
      formError.textContent = 'Add at least a reservation date before submitting.';
      formError.style.display = 'block';
      resDate.focus();
      return;
    }
    if (delDate.value && delDate.value < resDate.value) {
      formError.textContent = "Delivery date can't be before the reservation date.";
      formError.style.display = 'block';
      delDate.focus();
      return;
    }
    formError.style.display = 'none';

    if (!isConfigured) {
      formError.textContent = 'The shared tracker isn\'t connected yet — see the setup note above.';
      formError.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      // Sent as text/plain to avoid a CORS preflight, which Apps Script
      // web apps don't handle by default. The server still parses it as JSON.
      await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          region: region.value || '',
          trim: trim.value || '',
          reserved_date: resDate.value,
          delivered_date: delDate.value || ''
        })
      });

      resDate.value = '';
      delDate.value = '';
      region.value = '';
      trim.value = '';

      await loadAndRender();
    } catch (err) {
      console.error('Sheets insert error:', err);
      formError.textContent = 'Something went wrong saving your entry — try again in a moment.';
      formError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add my timeline';
    }
  });

  loadAndRender();
});
