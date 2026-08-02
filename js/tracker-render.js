document.addEventListener('DOMContentLoaded', function () {
  var tbody = document.getElementById('entry-body');
  var emptyState = document.getElementById('empty-state');
  var table = document.getElementById('entry-table');

  var entries = window.TRACKER_ENTRIES || [];

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

  function render() {
    var sorted = entries.slice().sort(function (a, b) {
      return new Date(b.reserved_date) - new Date(a.reserved_date);
    });

    tbody.innerHTML = '';

    if (sorted.length === 0) {
      table.style.display = 'none';
      emptyState.style.display = 'block';
    } else {
      table.style.display = '';
      emptyState.style.display = 'none';
      sorted.forEach(function (e) {
        var wait = e.delivered_date ? daysBetween(e.reserved_date, e.delivered_date) : null;
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(e.region || 'Not specified') + '</td>' +
          '<td>' + escapeHtml(e.trim || 'Unknown') + '</td>' +
          '<td>' + formatDate(e.reserved_date) + '</td>' +
          '<td>' + escapeHtml(e.order_status || '—') + '</td>' +
          '<td>' + formatDate(e.delivered_date) + '</td>' +
          '<td>' + formatWait(wait) + '</td>';
        tbody.appendChild(tr);
      });
    }

    var delivered = sorted.filter(function (e) { return e.delivered_date; });
    var waiting = sorted.length - delivered.length;
    var avg = null;
    if (delivered.length) {
      var total = delivered.reduce(function (sum, e) { return sum + daysBetween(e.reserved_date, e.delivered_date); }, 0);
      avg = Math.round(total / delivered.length);
    }

    document.getElementById('stat-count').textContent = sorted.length;
    document.getElementById('stat-delivered').textContent = delivered.length;
    document.getElementById('stat-waiting').textContent = waiting;
    document.getElementById('stat-avg').textContent = avg != null ? avg + 'd' : '—';
  }

  render();
});
