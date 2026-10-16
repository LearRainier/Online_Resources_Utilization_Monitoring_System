let currentTarget = '#', currentResource = '';
let allVisits = [];
let isAdminAllowed = false;

// Helper for consistent local YYYY-MM-DD date string (prevents UTC timezone drift)
function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Comprehensive Course Abbreviations
const COURSE_ABBR = {
  'Bachelor of Science in Nursing': 'BSN',
  'Bachelor of Science in Pharmacy': 'BSPharm',
  'Bachelor of Elementary Education': 'BEEd',
  'Bachelor of Secondary Education': 'BSEd',
  'Bachelor of Science in Education': 'BSEd',
  'Bachelor of Science in Accountancy': 'BSA',
  'Bachelor of Science in Business Administration': 'BSBA',
  'Bachelor of Science in Computer Science': 'BSCS',
  'Bachelor of Science in Information Technology': 'BSIT',
  'Bachelor of Science in Management Accounting': 'BSMA',
  'Bachelor of Science in Management Accountancy': 'BSMA',
  'Bachelor of Science in Psychology': 'BSPsych',
  'Bachelor of Science in Social Work': 'BSSW',
  'Bachelor of Arts in Communication': 'BA Comm',
  'Bachelor of Arts': 'BA',
  'BED - Elementary': 'BED Elem',
  'BED - Junior Highschool Student': 'BED JHS',
  'BED - Senior Highschool': 'BED SHS',
  'BED Faculty': 'BED Fac',
  'HED Faculty - BSN': 'Fac BSN',
  'HED Faculty - BSPharmacy': 'Fac Pharm',
  'HED Faculty - BSEducation': 'Fac Educ',
  'HED Faculty - BSA': 'Fac BSA',
  'HED Faculty - BSBA': 'Fac BSBA',
  'HED Faculty - BSMA': 'Fac BSMA',
  'HED Faculty - BSCS': 'Fac BSCS',
  'HED Faculty - BSP': 'Fac BSP',
  'HED Faculty - BSSW': 'Fac BSSW',
  'HED Faculty - ABCOM': 'Fac ABCOM',
  'GS Faculty - MAED': 'GS Fac MAED',
  'GS Faculty - MSN': 'GS Fac MSN',
  'GS Faculty - Other': 'GS Fac Other',
  'Graduate School Student (MAED)': 'GS MAED',
  'Graduate School Student (MSN)': 'GS MSN',
  'Graduate School': 'Grad School',
  'Senior High School': 'SHS',
  'Faculty / Staff': 'Faculty',
  'NTP': 'NTP',
  'Other': 'Other'
};

function formatCourseName(k) {
  if (!k) return 'Unknown';
  if (COURSE_ABBR[k]) return COURSE_ABBR[k];
  return k.replace(/Bachelor of Science in /gi, 'BS ')
    .replace(/Bachelor of Elementary Education/gi, 'BEEd')
    .replace(/Bachelor of Secondary Education/gi, 'BSEd')
    .replace(/Bachelor of Arts in /gi, 'BA ')
    .replace(/Bachelor of /gi, 'B. ');
}

// Dynamic Year & AY synchronization
function updateYearToday() {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Academic year typically starts around July/August in PH
  const startYear = getAcademicYearStart(now).getFullYear();
  const ayPill = document.getElementById('heroAY');
  if (ayPill) {
    ayPill.textContent = `AY ${startYear}–${startYear + 1}`;
  }

  const fy = document.getElementById('footerYear');
  if (fy) fy.textContent = currentYear;

  const fID = document.getElementById('fID');
  if (fID && (!fID.value || fID.value.startsWith('e.g.'))) {
    fID.placeholder = `e.g. ${currentYear}-00123`;
  }

  const pdfTitle = document.getElementById('pdfTitle');
  if (pdfTitle && (!pdfTitle.value || pdfTitle.value.startsWith('e.g.'))) {
    const monthName = now.toLocaleString('default', { month: 'long' });
    pdfTitle.placeholder = `e.g. ${monthName} ${currentYear} Library Report`;
  }

  populateYearDropdowns(currentYear);
}

function populateYearDropdowns(currentYear) {
  const yearsSet = new Set([2024, 2025, 2026, currentYear, currentYear + 1]);
  if (Array.isArray(allVisits)) {
    allVisits.forEach(e => {
      if (e.visited_at) {
        const y = new Date(e.visited_at).getFullYear();
        if (!isNaN(y) && y > 2000 && y < 2100) yearsSet.add(y);
      }
    });
  }
  const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

  ['filterYear', 'pdfYear'].forEach(selectId => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">All Years</option>' + sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
    if (currentVal && yearsSet.has(parseInt(currentVal))) {
      sel.value = currentVal;
    }
  });
}

// Initialize config from multiple sources (in priority order):
// 1. Netlify Function (for production)
// 2. config.js (for local development)
// 3. localStorage (user-entered backup)
async function initializeConfig() {
  try {
    // Try to fetch from Netlify Function first
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      if (config.SUPABASE_URL && config.SUPABASE_KEY) {
        localStorage.setItem('sb_url', config.SUPABASE_URL);
        localStorage.setItem('sb_key', config.SUPABASE_KEY);
        return;
      }
    }
  } catch (e) {
    // Netlify Function not available (local development)
  }

  // Fall back to config.js (local development)
  if (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL && window.APP_CONFIG.SUPABASE_KEY) {
    localStorage.setItem('sb_url', window.APP_CONFIG.SUPABASE_URL);
    localStorage.setItem('sb_key', window.APP_CONFIG.SUPABASE_KEY);
  }
  // Otherwise use localStorage (user-entered credentials)
}

// Initialize config on page load
updateYearToday();
initializeConfig().then(() => {
  loadStatsBar();
}).catch(err => {
  console.error('Config initialization error:', err);
  loadStatsBar();
});

function getCfg() {
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || ''
  };
}

function isConfigured() {
  let c = getCfg();
  return c.url && c.key;
}

// Escape user-entered values before inserting them into innerHTML / report HTML
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function sbRequest(path, opts = {}) {
  const c = getCfg();
  if (!c.url || !c.key) return null;
  // Pull headers out first so caller headers merge with (not replace) the auth headers
  const { headers = {}, ...rest } = opts;
  const res = await fetch(c.url + '/rest/v1/' + path, {
    ...rest,
    headers: {
      'apikey': c.key,
      'Authorization': 'Bearer ' + c.key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...headers
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Supabase ${rest.method || 'GET'} ${path} failed (${res.status}):`, body);
    return null;
  }
  return res;
}

async function sbFetch(path, opts = {}) {
  const res = await sbRequest(path, opts);
  if (!res) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Supabase caps every response at the project's "max rows" (1000 by default),
// regardless of the limit we ask for — so page through until an empty batch comes back.
async function sbFetchAll(query, pageSize = 1000) {
  const rows = [], seen = new Set();
  let offset = 0;
  while (true) {
    const batch = await sbFetch(`${query}&limit=${pageSize}&offset=${offset}`);
    if (!batch) return null;
    if (!batch.length) break;
    // A visit inserted mid-paging shifts rows across a page boundary; skip the repeat
    batch.forEach(r => { if (r.id == null || !seen.has(r.id)) { seen.add(r.id); rows.push(r); } });
    offset += batch.length;
  }
  return rows;
}

// Exact row count from the Content-Range header, without downloading the rows
async function sbCount(query) {
  const res = await sbRequest(query + '&limit=1', { headers: { 'Prefer': 'count=exact' } });
  if (!res) return null;
  const total = (res.headers.get('content-range') || '').split('/')[1];
  return total && total !== '*' ? parseInt(total, 10) : null;
}

async function loadStatsBar() {
  if (!isConfigured()) {
    document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-pending">Not configured</span>';
    document.getElementById('totalVisits').textContent = '—';
    document.getElementById('todayVisits').textContent = '—';
    return;
  }
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [total, todayC, last] = await Promise.all([
      sbCount('visitor_log?select=id'),
      sbCount('visitor_log?select=id&visited_at=gte.' + encodeURIComponent(todayStart.toISOString())),
      sbFetch('visitor_log?select=name,resource&order=visited_at.desc&limit=1')
    ]);
    // Judge the connection on the plain row query; counts need the Content-Range header,
    // so if a proxy hides it we show "—" rather than a false "Connection error"
    if (!last) {
      document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-fail">Connection error</span>';
      return;
    }
    document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-ok">Connected</span>';
    document.getElementById('totalVisits').textContent = total ?? '—';
    document.getElementById('todayVisits').textContent = todayC ?? '—';
    var wbt = document.getElementById('wb-total'); if (wbt) wbt.textContent = total ?? '—';
    var wbd = document.getElementById('wb-today'); if (wbd) wbd.textContent = todayC ?? '—';
    if (last.length > 0) {
      let l = last[0];
      document.getElementById('lastVisitor').textContent = (l.name || '—') + ' — ' + (l.resource || '').split(' ').slice(0, 2).join(' ');
    } else {
      document.getElementById('lastVisitor').textContent = '—';
    }
  } catch (e) {
    document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-fail">Error</span>';
  }
}
// Check URL for admin access parameter
function checkAdminAccess() {
  let params = new URLSearchParams(window.location.search);
  if (params.get('admin') === 'enabled') {
    isAdminAllowed = true;
    sessionStorage.setItem('admin_session', 'true');
    document.getElementById('nav-admin').style.display = 'inline';
    // Arrived via the /admin link: go straight to the sign-in screen and tidy the URL
    params.delete('admin');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    showPage('admin');
  } else if (sessionStorage.getItem('admin_session') === 'true') {
    isAdminAllowed = true;
    document.getElementById('nav-admin').style.display = 'inline';
  } else {
    document.getElementById('nav-admin').style.display = 'none';
  }
}

checkAdminAccess();

function showPage(p) {
  if (p === 'admin' && !isAdminAllowed) {
    alert('Admin access denied. Admin dashboard is not available.');
    return;
  }
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-bar a').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
  // Only pull the visitor log once the admin has signed in
  if (p === 'admin' && isAdminDashActive()) loadVisits();
}

function isAdminDashActive() {
  const dash = document.getElementById('adminDash');
  return !!dash && dash.classList.contains('active');
}

// Returns true, false (wrong password) or an error message
async function verifyAdminPassword(pwd) {
  try {
    // Production: the Netlify Function compares against the ADMIN_PASSWORD env variable
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.ok) return true;
      if (res.status === 401) return false;
      if (data.error) return data.error;
    }
  } catch (e) {
    // Netlify Function not available (local development)
  }
  // Local development: compare with config.js
  const localPwd = window.APP_CONFIG && window.APP_CONFIG.ADMIN_PASSWORD;
  if (localPwd) return pwd === String(localPwd).trim();
  return 'Could not verify the password. Check your connection and try again.';
}

let _checkingLogin = false;

async function checkLogin() {
  if (_checkingLogin) return;
  const enteredPwd = document.getElementById('adminPwd').value.trim();
  const showError = msg => {
    const errEl = document.getElementById('loginError');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; }
  };
  if (!enteredPwd) { showError('Please enter the password.'); return; }

  const btn = document.querySelector('.btn-login');
  _checkingLogin = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  let result;
  try {
    result = await verifyAdminPassword(enteredPwd);
  } finally {
    _checkingLogin = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
  if (result !== true) {
    showError(result === false ? 'Incorrect password. Please try again.' : result);
    return;
  }
  // Hide login and show dashboard
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDash').classList.add('active');
  // Clear any previous error
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.style.display = 'none';
  // Populate config fields if available
  let c = getCfg();
  const cfgUrlEl = document.getElementById('cfgUrl');
  const cfgKeyEl = document.getElementById('cfgKey');
  if (cfgUrlEl && c.url) cfgUrlEl.value = c.url;
  if (cfgKeyEl && c.key) cfgKeyEl.value = c.key;
  // Load visitor data
  loadVisits();
}

function logoutAdmin() {
  document.getElementById('adminLogin').style.display = 'flex';
  document.getElementById('adminDash').classList.remove('active');
  document.getElementById('adminPwd').value = '';
  document.getElementById('loginError').style.display = 'none';
}

let _loadingVisits = false, _lastSyncedAt = null;

function setSyncStatus(text, isError) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('sync-error', !!isError);
}

// silent = background refresh: keep the current table on screen instead of a "Loading" row
async function loadVisits(silent = false) {
  if (_loadingVisits) return;
  if (!silent) document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="7">Loading records from Supabase...</td></tr>';
  if (!isConfigured()) {
    document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="7">Please configure Supabase credentials below to load visitor records.</td></tr>';
    document.getElementById('ds-total').textContent = '—';
    document.getElementById('ds-today').textContent = '—';
    document.getElementById('ds-week').textContent = '—';
    document.getElementById('ds-top').textContent = '—';
    setSyncStatus('Not connected', true);
    return;
  }
  _loadingVisits = true;
  setSyncStatus('Syncing…');
  try {
    let data = await sbFetchAll('visitor_log?select=*&order=visited_at.desc,id.desc');
    if (!data) {
      if (!silent) document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="7">Failed to connect. Check your Supabase URL and key.</td></tr>';
      setSyncStatus('Sync failed — showing last loaded data', true);
      return;
    }
    // Background refresh with no new rows: skip the redraw so the charts don't flicker every minute
    const unchanged = silent && data.length === allVisits.length && (data[0] || {}).id === (allVisits[0] || {}).id;
    allVisits = data;
    _lastSyncedAt = new Date();
    if (!unchanged) {
      populateYearDropdowns(new Date().getFullYear());
      updateDashStats(data);
      sortTable(); // re-applies whatever search/filters/sort are active
      setTimeout(() => renderAllCharts(), 100);
    }
    setSyncStatus(`Synced ${_lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${data.length} records`);
  } catch (e) {
    if (!silent) document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="7">Error loading data: ' + escapeHtml(e.message) + '</td></tr>';
    setSyncStatus('Sync error', true);
  } finally {
    _loadingVisits = false;
  }
}

// Keep the dashboard in step with the database while it is open and visible
const AUTO_REFRESH_MS = 60000;
setInterval(() => {
  if (isAdminDashActive() && document.visibilityState === 'visible') loadVisits(true);
}, AUTO_REFRESH_MS);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isAdminDashActive() &&
    (!_lastSyncedAt || Date.now() - _lastSyncedAt.getTime() > AUTO_REFRESH_MS)) {
    loadVisits(true);
  }
});

function updateDashStats(data) {
  let today = getLocalDateString(new Date());
  let week = new Date();
  week.setDate(week.getDate() - 6); // today + previous 6 days = 7 calendar days
  week.setHours(0, 0, 0, 0);
  let todayC = data.filter(e => e.visited_at && getLocalDateString(e.visited_at) === today).length;
  let weekC = data.filter(e => e.visited_at && new Date(e.visited_at) >= week).length;
  let resCount = {};
  data.forEach(e => {
    if (e.resource) resCount[e.resource] = (resCount[e.resource] || 0) + 1;
  });
  let top = Object.entries(resCount).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('ds-total').textContent = data.length;
  document.getElementById('ds-today').textContent = todayC;
  document.getElementById('ds-today-date').textContent = today;
  document.getElementById('ds-week').textContent = weekC;
  document.getElementById('ds-top').textContent = top ? top[0].split(' ').slice(0, 2).join(' ') + ' (' + top[1] + ')' : '—';
}

function filterTable() {
  sortTable();
}

function sortTable() {
  let s = (document.getElementById('searchLog').value || '').toLowerCase().trim();
  let r = document.getElementById('filterRes').value;
  let d = document.getElementById('filterDate').value;
  let m = document.getElementById('filterMonth').value;
  let y = document.getElementById('filterYear').value;
  let sortBy = document.getElementById('sortBy') ? document.getElementById('sortBy').value : '';
  let sortOrder = document.getElementById('sortOrder') ? document.getElementById('sortOrder').value : 'desc';

  let today = getLocalDateString(new Date());
  let week = new Date();
  week.setDate(week.getDate() - 6); // today + previous 6 days = 7 calendar days
  week.setHours(0, 0, 0, 0);
  let now = new Date();
  let month = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  let f = allVisits.filter(e => {
    if (s && !((e.name || '').toLowerCase().includes(s) || (e.id_number || '').toLowerCase().includes(s) || (e.course || '').toLowerCase().includes(s))) return false;
    if (r && e.resource !== r) return false;
    if (d === 'today' && (!e.visited_at || getLocalDateString(e.visited_at) !== today)) return false;
    if (d === 'week' && (!e.visited_at || new Date(e.visited_at) < week)) return false;
    if (d === 'month' && (!e.visited_at || new Date(e.visited_at) < month)) return false;
    if (m && (!e.visited_at || new Date(e.visited_at).getMonth() + 1 !== parseInt(m))) return false;
    if (y && (!e.visited_at || new Date(e.visited_at).getFullYear() !== parseInt(y))) return false;
    return true;
  });

  if (sortBy) {
    f.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'date':
          aVal = new Date(a.visited_at || 0).getTime();
          bVal = new Date(b.visited_at || 0).getTime();
          break;
        case 'course':
          aVal = (a.course || '').toLowerCase();
          bVal = (b.course || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  renderTableData(f);
}

function renderTableData(data) {
  if (data.length === 0) {
    document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="7">No records found.</td></tr>';
    return;
  }
  let badge = (r) => {
    if (!r) return 'b-gold';
    if (r.includes('ProQuest')) return 'b-blue';
    if (r.includes('World')) return 'b-green';
    return 'b-red';
  };
  document.getElementById('logTableBody').innerHTML = data.map((e, i) => `
    <tr>
      <td style="color:var(--muted);font-size:11px;">${i + 1}</td>
      <td style="font-weight:500;">${escapeHtml(e.name) || '—'}</td>
      <td style="font-family:monospace;font-size:12px;">${escapeHtml(e.id_number) || '—'}</td>
      <td style="font-size:12px;">${escapeHtml(e.course) || '—'}</td>
      <td><span class="badge b-green">${escapeHtml(e.purpose) || '—'}</span></td>
      <td><span class="badge ${badge(e.resource)}">${escapeHtml(e.resource) || '—'}</span></td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap;">${e.visited_at ? new Date(e.visited_at).toLocaleString() : '—'}</td>
    </tr>
  `).join('');
}

function exportCSV() {
  if (allVisits.length === 0) {
    showToast('No data to export.');
    return;
  }
  let headers = ['#', 'Name', 'ID Number', 'Course', 'Purpose', 'Resource', 'Date & Time'];
  let rows = allVisits.map((e, i) => [
    i + 1,
    e.name || '',
    e.id_number || '',
    e.course || '',
    e.purpose || '',
    e.resource || '',
    e.visited_at ? new Date(e.visited_at).toLocaleString() : ''
  ]);
  let csv = [headers, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  let blob = new Blob([csv], { type: 'text/csv' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'SHC_Library_Visitor_Log_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded! ' + allVisits.length + ' records exported.');
}

function exportPDF() {
  if (allVisits.length === 0) {
    showToast('No data to export.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('PDF export library is still loading or unavailable.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Add header
  doc.setFontSize(20);
  doc.text('SHC Library Visitor Log', 20, 30);
  doc.setFontSize(12);
  doc.text('Sacred Heart College Lucena City, Inc.', 20, 40);
  doc.text('Generated on: ' + new Date().toLocaleString(), 20, 50);
  doc.text('Total Records: ' + allVisits.length, 20, 60);

  // Prepare table data
  const headers = [['#', 'Name', 'ID Number', 'Course', 'Purpose', 'Resource', 'Date & Time']];
  const rows = allVisits.map((e, i) => [
    i + 1,
    e.name || '',
    e.id_number || '',
    e.course || '',
    e.purpose || '',
    e.resource || '',
    e.visited_at ? new Date(e.visited_at).toLocaleString() : ''
  ]);

  // Add table
  doc.autoTable({
    head: headers,
    body: rows,
    startY: 70,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [185, 28, 28], // Crimson color
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 70 },
  });

  // Save the PDF
  const filename = 'SHC_Library_Visitor_Log_' + new Date().toISOString().slice(0, 10) + '.pdf';
  doc.save(filename);
  showToast('PDF downloaded! ' + allVisits.length + ' records exported.');
}

async function saveConfig() {
  const urlEl = document.getElementById('cfgUrl');
  const keyEl = document.getElementById('cfgKey');
  const st = document.getElementById('cfgStatus');
  if (!urlEl || !keyEl || !st) return;

  let url = urlEl.value.trim().replace(/\/$/, '');
  let key = keyEl.value.trim();
  if (!url || !key) {
    st.className = 'cfg-status show err';
    st.textContent = 'Please enter both Project URL and Anon Key.';
    return;
  }
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  st.className = 'cfg-status show info';
  st.textContent = 'Testing connection to Supabase...';
  try {
    let res = await fetch(url + '/rest/v1/visitor_log?select=id&limit=1', {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key
      }
    });
    if (res.ok) {
      st.className = 'cfg-status show ok';
      st.textContent = 'Connection successful! Database is live.';
      document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-ok">Connected</span>';
      loadStatsBar();
      loadVisits();
      showToast('Supabase connected successfully!');
    } else {
      st.className = 'cfg-status show err';
      st.textContent = 'Connection failed (' + res.status + '). Check your URL and key, and make sure the visitor_log table exists.';
    }
  } catch (e) {
    st.className = 'cfg-status show err';
    st.textContent = 'Network error: ' + e.message;
  }
}

function openModal(name, url) {
  currentTarget = url;
  currentResource = name;
  document.getElementById('modalTitle').textContent = 'Access: ' + name;
  document.getElementById('overlay').classList.add('active');
}

// iPhone-compatible link opener (works better than window.open on mobile)
function openLink(url) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function closeModal() {
  document.getElementById('overlay').classList.remove('active');
  ['fLastName', 'fFirstName', 'fID'].forEach(id => document.getElementById(id).value = '');
  // Clear checkboxes
  document.querySelectorAll('#courseCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
  ['fPurpose'].forEach(id => document.getElementById(id).value = '');
}

async function submitForm() {
  let ln = document.getElementById('fLastName').value.trim();
  let fn = document.getElementById('fFirstName').value.trim();
  let id = document.getElementById('fID').value.trim();

  // Get selected courses
  let selectedCourses = Array.from(document.querySelectorAll('#courseCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
  let course = selectedCourses.join(', ');

  let purpose = document.getElementById('fPurpose').value;
  if (!ln || !fn || selectedCourses.length === 0) {
    showToast('Please fill in Last Name, First Name, and select at least one Course.');
    return;
  }
  let entry = {
    name: fn + ' ' + ln,
    id_number: id,
    course: course,
    purpose: purpose,
    resource: currentResource
  };
  let btn = document.getElementById('submitBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    // sbFetch returns null on any rejected insert (bad key, RLS policy, missing column…)
    const saved = isConfigured() ? await sbFetch('visitor_log', { method: 'POST', body: JSON.stringify(entry) }) : null;
    if (saved) {
      showToast('Welcome, ' + fn + '! Opening ' + currentResource + '...');
      if (isAdminDashActive()) loadVisits(true);
    } else {
      showToast('Notice: Could not log visit to database, opening resource...');
    }
  } catch (err) {
    console.error('Error logging visit:', err);
    showToast('Notice: Could not log visit to database, opening resource...');
  } finally {
    btn.textContent = 'Proceed to Resource';
    btn.disabled = false;
    closeModal();
    loadStatsBar();
    setTimeout(() => { openLink(currentTarget); }, 1000);
  }
}

function showToast(msg) {
  let t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

document.getElementById('overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.getElementById('pdfExportOverlay').addEventListener('click', function (e) {
  if (e.target === this) closePdfExportModal();
});
/* ═══════════════════════════════════════════════════
   ANALYTICS ENGINE  —  no function wrapping, no recursion
═══════════════════════════════════════════════════ */

let _chartRes = null, _chartDaily = null, _chartDept = null,
  _chartPurpose = null, _chartHour = null, _chartWeekday = null;

const PALETTE_BAR = ['#B91C1C', '#1E3A5F', '#166534', '#C9952A', '#7C2D12', '#1E40AF', '#065F46', '#6B21A8'];
const PALETTE_PIE = ['#1E3A5F', '#B91C1C', '#C9952A', '#166534', '#7C2D12', '#6B21A8', '#0369A1', '#9F1239'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // school week: Monday first
const PERIOD_LABELS = { all: 'All Time', ay: 'This Academic Year', year: 'This Year', last30: 'Last 30 Days', month: 'This Month', week: 'Last 7 Days', today: 'Today' };
const SORT_LABELS = { count: 'Sorted by visit count', name: 'Sorted by name', recent: 'Sorted by most recent visit' };

// Academic year starts in July (same rule as the AY pill in the header)
function getAcademicYearStart(now = new Date()) {
  const y = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 6, 1);
}

function getReportPeriod() {
  return (document.getElementById('reportPeriod') || {}).value || 'all';
}

// Local-midnight start of the selected period (null = no lower bound)
function getPeriodStart(period, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'today': return start;
    case 'week': start.setDate(start.getDate() - 6); return start;
    case 'last30': start.setDate(start.getDate() - 29); return start;
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year': return new Date(now.getFullYear(), 0, 1);
    case 'ay': return getAcademicYearStart(now);
    default: return null;
  }
}

function getFilteredVisits() {
  const start = getPeriodStart(getReportPeriod());
  return allVisits.filter(e => {
    if (!e.visited_at) return false;
    const d = new Date(e.visited_at);
    if (isNaN(d.getTime())) return false;
    return !start || d >= start;
  });
}

function normalizeValue(v) { return String(v ?? '').trim() || 'Unknown'; }

// Count and most-recent visit per distinct value of `key`, highest count first
function aggregateBy(arr, key) {
  const map = new Map();
  arr.forEach(e => {
    const k = normalizeValue(e[key]);
    const t = new Date(e.visited_at).getTime() || 0;
    const cur = map.get(k);
    if (cur) { cur.count++; if (t > cur.latest) cur.latest = t; }
    else map.set(k, { name: k, count: 1, latest: t });
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function countBy(arr, key) {
  return aggregateBy(arr, key).map(r => [r.name, r.count]);
}

/* ── Disseminate courses for analytics ── */
function disseminateCourses(data) {
  // Records with multiple courses ("BSN, BSCS") become one virtual entry per course,
  // so each course gets credit; the original record in the visitor log is unchanged.
  const disseminated = [];
  data.forEach(entry => {
    const courses = String(entry.course || '').split(',').map(c => c.trim()).filter(Boolean);
    if (!courses.length) disseminated.push(entry);
    else courses.forEach(course => disseminated.push({ ...entry, course }));
  });
  return disseminated;
}

// Same person = same ID number; fall back to the normalised name when no ID was given
function visitorKey(e) {
  const id = String(e.id_number || '').trim().toLowerCase();
  if (id) return 'id:' + id;
  return 'name:' + String(e.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatHour(h) { return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; }

function formatMonthKey(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-PH', { month: 'short', year: 'numeric' });
}

function pct(part, whole) { return whole ? Math.round(part / whole * 100) : 0; }

// One pass over the visits → every number the dashboard and the reports need
function computeAnalytics(data) {
  const courseData = disseminateCourses(data);
  const dayMap = {}, monthMap = {};
  const hours = Array(24).fill(0), weekdays = Array(7).fill(0);
  const visitCounts = new Map();

  data.forEach(e => {
    const d = new Date(e.visited_at);
    if (isNaN(d.getTime())) return;
    const day = getLocalDateString(d);
    const vk = visitorKey(e);
    dayMap[day] = (dayMap[day] || 0) + 1;
    hours[d.getHours()]++;
    weekdays[d.getDay()]++;
    const mk = day.slice(0, 7);
    if (!monthMap[mk]) monthMap[mk] = { visits: 0, visitors: new Set() };
    monthMap[mk].visits++;
    monthMap[mk].visitors.add(vk);
    visitCounts.set(vk, (visitCounts.get(vk) || 0) + 1);
  });

  const activeDays = Object.keys(dayMap).length;
  const courses = countBy(courseData, 'course');
  const busiest = Object.entries(dayMap).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  const peakHour = hours.indexOf(Math.max(...hours));
  const peakWeekday = weekdays.indexOf(Math.max(...weekdays));

  return {
    total: data.length,
    uniqueVisitors: visitCounts.size,
    returningVisitors: [...visitCounts.values()].filter(c => c > 1).length,
    activeDays,
    avgPerDay: activeDays ? data.length / activeDays : 0,
    resources: countBy(data, 'resource'),
    purposes: countBy(data, 'purpose'),
    courses,
    coursesServed: courses.filter(([k]) => k !== 'Unknown').length,
    hours, weekdays,
    peakHour: data.length ? peakHour : null,
    peakWeekday: data.length ? peakWeekday : null,
    busiestDay: busiest ? { date: busiest[0], count: busiest[1] } : null,
    dayMap,
    months: Object.keys(monthMap).sort().map(k => ({ key: k, label: formatMonthKey(k), visits: monthMap[k].visits, unique: monthMap[k].visitors.size }))
  };
}

// Continuous, zero-filled trend: per day for ranges up to ~3 months, per month beyond that.
// clipToData limits the range to the first..last visit (used when the report has extra filters).
function buildTrendSeries(dayMap, period, clipToData = false) {
  const days = Object.keys(dayMap).sort();
  if (!days.length) return { labels: [], values: [], unit: 'day' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const periodStart = clipToData ? null : getPeriodStart(period);
  const firstData = parseLocalDate(days[0]);
  const lastData = parseLocalDate(days[days.length - 1]);
  const start = periodStart && periodStart < firstData ? periodStart : firstData;
  const end = clipToData || lastData > today ? lastData : today;
  const spanDays = Math.round((end - start) / 86400000) + 1;

  const labels = [], values = [];
  if (spanDays <= 92) {
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
      values.push(dayMap[getLocalDateString(d)] || 0);
    }
    return { labels, values, unit: 'day' };
  }
  const monthTotals = {};
  days.forEach(day => { const k = day.slice(0, 7); monthTotals[k] = (monthTotals[k] || 0) + dayMap[day]; });
  for (const d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
    const k = getLocalDateString(d).slice(0, 7);
    labels.push(formatMonthKey(k));
    values.push(monthTotals[k] || 0);
  }
  return { labels, values, unit: 'month' };
}

function destroyChart(ref) { try { if (ref) ref.destroy(); } catch (e) { } return null; }

function destroyAllCharts() {
  _chartRes = destroyChart(_chartRes);
  _chartDaily = destroyChart(_chartDaily);
  _chartDept = destroyChart(_chartDept);
  _chartPurpose = destroyChart(_chartPurpose);
  _chartHour = destroyChart(_chartHour);
  _chartWeekday = destroyChart(_chartWeekday);
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function renderAllCharts() {
  const data = getFilteredVisits();
  const emptyEl = document.getElementById('analyticsEmpty');
  const contentEl = document.getElementById('analyticsContent');
  if (!data.length) {
    // Clear everything so the previous period's numbers don't linger on screen
    destroyAllCharts();
    ['kpi-total', 'kpi-unique', 'kpi-days', 'kpi-avg', 'kpi-courses', 'kpi-top-res'].forEach(id => setText(id, '—'));
    if (contentEl) contentEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = '';

  const a = computeAnalytics(data);
  // Use disseminated courses for course-based analytics
  const courseData = disseminateCourses(data);

  updateKPIs(a);
  renderResourceChart(data);
  renderDailyChart(a);
  renderDeptChart(courseData);
  renderPurposeChart(data);
  renderHourChart(a);
  renderWeekdayChart(a);
  const sortLabel = SORT_LABELS[(document.getElementById('analyticsSortBy') || {}).value] || SORT_LABELS.count;
  setText('rankCourseSub', sortLabel);
  setText('rankResourceSub', sortLabel);
  renderRankingTable('rankCourse', getSortedEntries(courseData, 'course'), 'course', a.total);
  renderRankingTable('rankResource', getSortedEntries(data, 'resource'), 'resource', a.total);
}

function getSortedEntries(data, field) {
  const sortBy = (document.getElementById('analyticsSortBy') || {}).value || 'count';
  const dir = ((document.getElementById('analyticsSortOrder') || {}).value || 'desc') === 'asc' ? 1 : -1;
  const rows = aggregateBy(data, field);
  const val = r => sortBy === 'name' ? r.name.toLowerCase() : sortBy === 'recent' ? r.latest : r.count;
  rows.sort((a, b) => {
    const x = val(a), y = val(b);
    return x < y ? -dir : x > y ? dir : b.count - a.count;
  });
  return rows.map(r => [r.name, r.count]);
}

function updateKPIs(a) {
  setText('kpi-total', a.total);
  setText('kpi-unique', a.uniqueVisitors);
  setText('kpi-days', a.activeDays);
  setText('kpi-avg', a.avgPerDay.toFixed(1));
  setText('kpi-courses', a.coursesServed);
  const top = a.resources[0];
  setText('kpi-top-res', top ? top[0].split(' ').slice(0, 2).join(' ') : '—');
}

const BAR_SCALES = { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } } };
const visitsTooltip = { callbacks: { label: c => ` ${c.raw} visit${c.raw === 1 ? '' : 's'}` } };

/* ── Chart configs — shared by the dashboard and the generated report ── */
const RES_SHORT = { 'ProQuest Ebook Central': 'PQ Ebook', 'ProQuest Research Library': 'PQ Research', 'World Book Online': 'World Book', '3G E-Learning': '3G Learn', 'Kite Academy': 'Kite', 'Encleare (GEAP)': 'Encleare', 'Library and AVRC Utilization Guide': 'AVRC Guide' };

function resourceChartConfig(entries) {
  return {
    type: 'bar',
    data: { labels: entries.map(([k]) => RES_SHORT[k] || k.split(' ').slice(0, 2).join(' ')), datasets: [{ label: 'Visits', data: entries.map(([, v]) => v), backgroundColor: PALETTE_BAR, borderRadius: 6, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => entries[items[0].dataIndex][0], label: visitsTooltip.callbacks.label } } }, scales: BAR_SCALES }
  };
}

function trendChartConfig(series) {
  return {
    type: 'line',
    data: { labels: series.labels, datasets: [{ label: 'Visits', data: series.values, borderColor: '#B91C1C', backgroundColor: 'rgba(185,28,28,0.08)', fill: true, tension: 0.3, pointRadius: series.values.length > 45 ? 0 : 3, pointHoverRadius: 4, pointBackgroundColor: '#B91C1C' }] },
    options: { responsive: true, maintainAspectRatio: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: visitsTooltip }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } } } }
  };
}

function courseChartConfig(entries) {
  return {
    type: 'bar',
    data: { labels: entries.map(([k]) => formatCourseName(k)), datasets: [{ label: 'Visits', data: entries.map(([, v]) => v), backgroundColor: PALETTE_BAR, borderRadius: 5, borderSkipped: false }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => entries[items[0].dataIndex][0], label: visitsTooltip.callbacks.label } } }, scales: { x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
  };
}

function purposeChartConfig(entries, total) {
  return {
    type: 'doughnut',
    data: { labels: entries.map(([k]) => k), datasets: [{ data: entries.map(([, v]) => v), backgroundColor: PALETTE_PIE, borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: true, cutout: '58%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} (${pct(c.raw, total)}%)` } } } }
  };
}

// Bar colours: the peak bar in crimson, the rest in navy
const peakColors = (values) => { const max = Math.max(...values); return values.map(v => v === max && v > 0 ? '#B91C1C' : '#1E3A5F'); };

function hourChartConfig(a) {
  // Only show the span of hours that actually had visits
  const used = a.hours.map((v, h) => v ? h : -1).filter(h => h >= 0);
  const from = used.length ? used[0] : 7, to = used.length ? used[used.length - 1] : 18;
  const hrs = []; for (let h = from; h <= to; h++) hrs.push(h);
  const values = hrs.map(h => a.hours[h]);
  return {
    type: 'bar',
    data: { labels: hrs.map(formatHour), datasets: [{ label: 'Visits', data: values, backgroundColor: peakColors(values), borderRadius: 4, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: visitsTooltip }, scales: BAR_SCALES }
  };
}

function weekdayChartConfig(a) {
  const values = WEEKDAY_ORDER.map(d => a.weekdays[d]);
  return {
    type: 'bar',
    data: { labels: WEEKDAY_ORDER.map(d => WEEKDAYS[d].slice(0, 3)), datasets: [{ label: 'Visits', data: values, backgroundColor: peakColors(values), borderRadius: 4, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: visitsTooltip }, scales: BAR_SCALES }
  };
}

function renderResourceChart(data) {
  const ctx = document.getElementById('chartResource'); if (!ctx) return;
  _chartRes = destroyChart(_chartRes);
  _chartRes = new Chart(ctx, resourceChartConfig(getSortedEntries(data, 'resource').slice(0, 7)));
}

function renderDailyChart(a) {
  const ctx = document.getElementById('chartDaily'); if (!ctx) return;
  _chartDaily = destroyChart(_chartDaily);
  const series = buildTrendSeries(a.dayMap, getReportPeriod());
  setText('chartDailySub', series.unit === 'month' ? 'Visits per month' : 'Visits per day');
  _chartDaily = new Chart(ctx, trendChartConfig(series));
}

function renderDeptChart(data) {
  const ctx = document.getElementById('chartDept'); if (!ctx) return;
  _chartDept = destroyChart(_chartDept);
  _chartDept = new Chart(ctx, courseChartConfig(getSortedEntries(data, 'course').slice(0, 8)));
}

function renderPurposeChart(data) {
  const ctx = document.getElementById('chartPurpose'); if (!ctx) return;
  _chartPurpose = destroyChart(_chartPurpose);
  _chartPurpose = new Chart(ctx, purposeChartConfig(getSortedEntries(data, 'purpose').slice(0, 8), data.length));
}

function renderHourChart(a) {
  const ctx = document.getElementById('chartHour'); if (!ctx) return;
  _chartHour = destroyChart(_chartHour);
  setText('chartHourSub', a.peakHour !== null ? `Peak at ${formatHour(a.peakHour)}` : 'Visits by time of day');
  _chartHour = new Chart(ctx, hourChartConfig(a));
}

function renderWeekdayChart(a) {
  const ctx = document.getElementById('chartWeekday'); if (!ctx) return;
  _chartWeekday = destroyChart(_chartWeekday);
  setText('chartWeekdaySub', a.peakWeekday !== null ? `Busiest: ${WEEKDAYS[a.peakWeekday]}` : 'Visits by weekday');
  _chartWeekday = new Chart(ctx, weekdayChartConfig(a));
}

// Draw a chart on a hidden canvas and return it as a PNG data URL, for embedding in the report
const whiteBackground = { id: 'whiteBackground', beforeDraw: c => { const x = c.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } };

function chartToImage(config, width, height) {
  if (!window.Chart) return '';
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;`;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  host.appendChild(canvas);
  document.body.appendChild(host);
  let chart = null;
  try {
    chart = new Chart(canvas, { ...config, options: { ...config.options, responsive: false, maintainAspectRatio: false, animation: false, devicePixelRatio: 2 }, plugins: [whiteBackground] });
    return chart.toBase64Image('image/png');
  } catch (e) {
    console.error('Chart image failed:', e);
    return '';
  } finally {
    destroyChart(chart);
    host.remove();
  }
}

function renderRankingTable(containerId, entries, type, total) {
  const el = document.getElementById(containerId); if (!el) return;
  if (!entries.length) { el.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--tx-xs);">No data</div>'; return; }
  // Bars scale to the real maximum and medals follow visit count, whatever the display order is
  const max = Math.max(...entries.map(([, c]) => c));
  const medals = new Map([...entries].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n], i) => [n, ['gold', 'silver', 'bronze'][i]]));
  const ABBR_R = { 'Library and AVRC Utilization Guide': 'AVRC Guide' };
  el.innerHTML = entries.slice(0, 8).map(([name, count], i) => {
    const display = type === 'course' ? formatCourseName(name) : (ABBR_R[name] || name);
    return `<div class="rank-row">
      <div class="rank-pos ${medals.get(name) || ''}">${i + 1}</div>
      <div class="rank-name" title="${escapeHtml(name)}">${escapeHtml(display)}</div>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.round(count / max * 100)}%"></div></div>
      <div class="rank-count">${count}<span class="rank-pct">${pct(count, total)}%</span></div>
    </div>`;
  }).join('');
}

/* ── Export CSV ── */
function downloadReportCSV() {
  const data = getFilteredVisits();
  if (!data.length) { showToast('No data for the selected period.'); return; }
  const period = getReportPeriod();
  const headers = ['#', 'Name', 'ID Number', 'Course / Department', 'Purpose', 'Resource Accessed', 'Date & Time'];
  const rows = data.map((e, i) => [i + 1, e.name || '', e.id_number || '', e.course || '', e.purpose || '', e.resource || '', e.visited_at ? new Date(e.visited_at).toLocaleString() : '']);
  const csv = [headers, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `SHC_Library_Report_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast(`CSV exported — ${data.length} records.`);
}

/* ── Download PDF Report (current analytics period, no extra filters) ── */
function downloadReportPDF() {
  const data = getFilteredVisits();
  if (!data.length) { showToast('No data for the selected period.'); return; }
  generateCustomPDF(data, 'Library Resource Center Usage Analytics Report', '', true, true, true, 'date');
}

/* ── PDF Export Modal ── */
function openPdfExportModal() {
  // Reset form values
  document.getElementById('pdfTitle').value = '';
  document.getElementById('pdfMonth').value = '';
  document.getElementById('pdfYear').value = '';
  document.getElementById('pdfDate').value = '';
  document.getElementById('pdfCourse').value = '';
  document.getElementById('pdfSortBy').value = 'date';
  document.getElementById('pdfSortOrder').value = 'desc';
  document.getElementById('pdfIncludeSummary').checked = true;
  document.getElementById('pdfIncludeCharts').checked = true;
  document.getElementById('pdfIncludeLog').checked = true;

  // Show modal
  document.getElementById('pdfExportOverlay').classList.add('active');
}

function closePdfExportModal() {
  document.getElementById('pdfExportOverlay').classList.remove('active');
}

function generateFilteredPDF() {
  const sel = getExportSelection(); if (!sel) return;
  generateCustomPDF(sel.data, sel.title, sel.filterText, sel.includeSummary, sel.includeCharts, sel.includeLog, sel.sortBy);
  closePdfExportModal();
}

async function generateFilteredDOCX() {
  const sel = getExportSelection(); if (!sel) return;
  const btn = document.getElementById('docxGenerateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    await generateCustomDOCX(sel);
    closePdfExportModal();
  } catch (e) {
    console.error('DOCX export failed:', e);
    showToast('Could not create the Word file. Check your connection and try again.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Word (.docx)'; }
  }
}

// Read the export modal → filtered + sorted data and report options (null when nothing matches)
function getExportSelection() {
  // Get filter values
  const title = document.getElementById('pdfTitle').value.trim() || 'Library Usage Report';
  const month = document.getElementById('pdfMonth').value;
  const year = document.getElementById('pdfYear').value;
  const date = document.getElementById('pdfDate').value;
  const course = document.getElementById('pdfCourse').value;
  const sortBy = document.getElementById('pdfSortBy').value;
  const sortOrder = document.getElementById('pdfSortOrder').value;
  const includeSummary = document.getElementById('pdfIncludeSummary').checked;
  const includeCharts = document.getElementById('pdfIncludeCharts').checked;
  const includeLog = document.getElementById('pdfIncludeLog').checked;

  // Get base filtered data (from analytics period)
  let data = getFilteredVisits();

  // Apply additional filters
  data = data.filter(entry => {
    const d = new Date(entry.visited_at);
    if (month && d.getMonth() + 1 !== parseInt(month)) return false;
    if (year && d.getFullYear() !== parseInt(year)) return false;
    if (date && getLocalDateString(d) !== date) return false;
    // Multi-course visits are stored comma-joined ("BSN, BSCS"), so match any of them
    if (course && !String(entry.course || '').split(',').map(c => c.trim()).includes(course)) return false;
    return true;
  });

  if (!data.length) {
    showToast('No data matches the selected filters.');
    return null;
  }

  // Sort the data
  data.sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'course':
        aVal = (a.course || '').toLowerCase();
        bVal = (b.course || '').toLowerCase();
        break;
      case 'resource':
        aVal = (a.resource || '').toLowerCase();
        bVal = (b.resource || '').toLowerCase();
        break;
      default:
        aVal = new Date(a.visited_at || 0).getTime();
        bVal = new Date(b.visited_at || 0).getTime();
    }

    if (sortOrder === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  // Generate filter description
  let filterDesc = [];
  if (month) filterDesc.push(`Month: ${new Date(2000, parseInt(month) - 1, 1).toLocaleString('en-PH', { month: 'long' })}`);
  if (year) filterDesc.push(`Year: ${year}`);
  if (date) filterDesc.push(`Date: ${parseLocalDate(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  if (course) filterDesc.push(`Course: ${course}`);

  return { data, title, filterText: filterDesc.join(', '), includeSummary, includeCharts, includeLog, sortBy };
}

// Executive summary as [text, bold] pieces, so the PDF and the Word report share one wording
function reportSummarySegments(a, filterText, includeLog, sortBy) {
  const periodLabel = PERIOD_LABELS[getReportPeriod()] || 'All Time';
  const topRes = a.resources[0];
  const topCourse = a.courses.find(([k]) => k !== 'Unknown');
  const s = n => n === 1 ? '' : 's';
  const segs = [];
  const t = text => segs.push([text, false]);
  const b = text => segs.push([String(text), true]);
  t('During '); b(periodLabel);
  if (filterText) t(` (filtered by ${filterText})`);
  t(', the SHC Library Resource Center recorded '); b(`${a.total} visit${s(a.total)}`);
  t(' from '); b(`${a.uniqueVisitors} unique visitor${s(a.uniqueVisitors)}`);
  t(' across '); b(`${a.coursesServed} academic course${s(a.coursesServed)}/department${s(a.coursesServed)}`);
  t(' over '); b(`${a.activeDays} active day${s(a.activeDays)}`);
  t(', an average of '); b(`${a.avgPerDay.toFixed(1)} visits per active day`);
  t('. '); b(a.returningVisitors);
  t(` visitor${s(a.returningVisitors)} (${pct(a.returningVisitors, a.uniqueVisitors)}%) used the e-resources more than once.`);
  if (topRes) { t(' The most accessed resource was '); b(topRes[0]); t(' with '); b(`${topRes[1]} visits`); t(` (${pct(topRes[1], a.total)}% of all visits)`); }
  if (topCourse) { t(', and the most represented course/department was '); b(topCourse[0]); t(` (${topCourse[1]} visits)`); }
  t('.');
  if (a.peakHour !== null) { t(' Usage peaked around '); b(formatHour(a.peakHour)); t(', with '); b(WEEKDAYS[a.peakWeekday]); t(' as the busiest day of the week'); }
  if (a.busiestDay) {
    t('; the single busiest day was '); b(parseLocalDate(a.busiestDay.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }));
    t(' with '); b(`${a.busiestDay.count} visits`);
  }
  t('.');
  if (includeLog) { t(' The visitor log below is sorted by '); b(sortBy === 'date' ? 'date & time' : sortBy); t('.'); }
  return segs;
}

// Chart images (same charts as the dashboard, drawn from the report's data)
function reportChartImages(a, filterText) {
  const series = buildTrendSeries(a.dayMap, getReportPeriod(), !!filterText);
  const courseEntries = a.courses.slice(0, 10);
  const img = { trendUnit: series.unit, size: {} };
  const draw = (key, config, w, h) => { img[key] = chartToImage(config, w, h); img.size[key] = [w, h]; };
  draw('trend', trendChartConfig(series), 900, 260);
  draw('resource', resourceChartConfig(a.resources.slice(0, 7)), 440, 280);
  draw('purpose', purposeChartConfig(a.purposes.slice(0, 8), a.total), 440, 280);
  draw('course', courseChartConfig(courseEntries), 900, 50 + courseEntries.length * 30);
  draw('weekday', weekdayChartConfig(a), 440, 260);
  draw('hour', hourChartConfig(a), 440, 260);
  return img;
}

function generateCustomPDF(data, title, filterText, includeSummary, includeCharts, includeLog, sortBy) {
  const now = new Date();
  const a = computeAnalytics(data);
  const periodLabel = PERIOD_LABELS[getReportPeriod()] || 'All Time';
  const topRes = a.resources[0];
  const esc = escapeHtml;
  const LOG_LIMIT = 500;

  const tblRows = data.slice(0, LOG_LIMIT).map((e, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9f8f6'}"><td>${i + 1}</td><td><strong>${esc(e.name) || '—'}</strong></td><td style="font-family:monospace;font-size:11px;">${esc(e.id_number) || '—'}</td><td>${esc(e.course) || '—'}</td><td>${esc(e.purpose) || '—'}</td><td>${esc(e.resource) || '—'}</td><td style="font-size:11px;">${e.visited_at ? new Date(e.visited_at).toLocaleString() : '—'}</td></tr>`).join('');

  const mkRank = (arr, limit = 10) => arr.slice(0, limit).map(([n, c], i) => `<tr><td style="width:28px;font-weight:700;color:#B91C1C;">${i + 1}</td><td>${esc(n)}</td><td style="text-align:right;font-weight:700;color:#1E3A5F;">${c}</td><td style="text-align:right;color:#78716C;">${pct(c, a.total)}%</td></tr>`).join('');
  const mkSplit = (arr) => arr.map(([n, c]) => `<tr><td>${esc(n)}</td><td style="text-align:right;font-weight:700;">${c}</td><td style="text-align:right;color:#78716C;">${pct(c, a.total)}%</td></tr>`).join('');
  const weekdayRows = WEEKDAY_ORDER.map(d => `<tr${d === a.peakWeekday ? ' style="background:#FEF2F2;"' : ''}><td>${WEEKDAYS[d]}</td><td style="text-align:right;font-weight:700;">${a.weekdays[d]}</td><td style="text-align:right;color:#78716C;">${pct(a.weekdays[d], a.total)}%</td></tr>`).join('');
  const hourRows = a.hours.map((c, h) => [h, c]).filter(([, c]) => c > 0).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([h, c]) => `<tr><td>${formatHour(h)} – ${formatHour((h + 1) % 24)}</td><td style="text-align:right;font-weight:700;">${c}</td><td style="text-align:right;color:#78716C;">${pct(c, a.total)}%</td></tr>`).join('');
  const monthRows = a.months.map(m => `<tr><td>${m.label}</td><td style="text-align:right;font-weight:700;">${m.visits}</td><td style="text-align:right;">${m.unique}</td></tr>`).join('');
  const summaryHtml = reportSummarySegments(a, filterText, includeLog, sortBy).map(([t, b]) => b ? `<strong>${esc(t)}</strong>` : esc(t)).join('');

  const img = includeCharts ? reportChartImages(a, filterText) : {};
  const chartBox = (caption, src) => src ? `<div class="chart-box"><div class="sub">${caption}</div><img src="${src}" alt="${caption}"></div>` : '';
  const chartRow = (...boxes) => boxes.some(Boolean) ? `<div class="chart-row${boxes.length === 1 ? ' one' : ''}">${boxes.join('')}</div>` : '';

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1C1917;font-size:13px;}
  .cover{background:linear-gradient(135deg,#152A47 0%,#1E3A5F 100%);color:#fff;padding:48px;position:relative;overflow:hidden;page-break-after:always;}
  .cover::after{content:'';position:absolute;right:-60px;top:-60px;width:300px;height:300px;border-radius:50%;background:rgba(185,28,28,0.18);}
  .logo{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;text-align:center;line-height:1.2;margin-bottom:20px;position:relative;z-index:1;}
  h1{font-size:26px;font-weight:700;line-height:1.2;margin-bottom:6px;position:relative;z-index:1;}
  h2{font-size:14px;font-weight:400;opacity:.7;margin-bottom:28px;position:relative;z-index:1;}
  .meta{display:flex;gap:32px;flex-wrap:wrap;position:relative;z-index:1;}
  .meta-item .lbl{font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:.8px;}
  .meta-item .val{font-size:14px;font-weight:600;margin-top:2px;color:#FDE68A;}
  .body{padding:40px 48px;}
  .sec{margin-bottom:36px;page-break-inside:avoid;}
  .sec-log{page-break-inside:auto;}
  .sec-flow{page-break-inside:auto;}
  .sec-flow .two{page-break-inside:avoid;}
  .sec-title{font-size:15px;font-weight:700;color:#1E3A5F;border-bottom:2px solid #B91C1C;padding-bottom:6px;margin-bottom:16px;page-break-after:avoid;}
  .chart-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:18px;page-break-inside:avoid;}
  .chart-row.one{grid-template-columns:1fr;}
  .chart-box{border:1px solid #E2DDD8;border-radius:8px;padding:12px 14px;background:#fff;}
  .chart-box img{width:100%;height:auto;display:block;}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
  .kpi{background:#F7F6F3;border-radius:8px;padding:16px 18px;border:1px solid #E2DDD8;}
  .kpi .v{font-size:28px;font-weight:700;color:#1E3A5F;line-height:1;}
  .kpi .v.sm{font-size:20px;}
  .kpi .l{font-size:10px;color:#78716C;text-transform:uppercase;letter-spacing:.6px;margin-top:3px;}
  .summary{font-size:13px;color:#44403C;line-height:1.75;background:#FEF2F2;border-left:4px solid #B91C1C;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:8px;}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;}
  .sub{font-size:12px;font-weight:700;color:#44403C;margin-bottom:8px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:#1E3A5F;color:#fff;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.6px;}
  td{padding:8px 12px;border-bottom:1px solid #EDE9E4;vertical-align:top;}
  tr:last-child td{border-bottom:none;}
  .ft{background:#152A47;color:rgba(255,255,255,.45);padding:14px 48px;font-size:11px;display:flex;justify-content:space-between;}
  @media print{.cover,.kpi,.summary,th,tr{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>
  <div class="cover">
    <div class="logo">SHC<br>LCI</div>
    <h1>${esc(title)}</h1>
    <h2>Sacred Heart College — Lucena City, Inc.</h2>
    <div class="meta">
      <div class="meta-item"><div class="lbl">Period</div><div class="val">${periodLabel}</div></div>
      <div class="meta-item"><div class="lbl">Filters</div><div class="val">${esc(filterText) || 'None'}</div></div>
      <div class="meta-item"><div class="lbl">Generated</div><div class="val">${now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
      <div class="meta-item"><div class="lbl">Time</div><div class="val">${now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div></div>
      <div class="meta-item"><div class="lbl">Records</div><div class="val">${a.total}</div></div>
    </div>
  </div>
  <div class="body">`;

  if (includeSummary) {
    html += `
    <div class="sec">
      <div class="sec-title">Executive Summary</div>
      <div class="kpis">
        <div class="kpi"><div class="v">${a.total}</div><div class="l">Total Visits</div></div>
        <div class="kpi"><div class="v">${a.uniqueVisitors}</div><div class="l">Unique Visitors</div></div>
        <div class="kpi"><div class="v">${a.activeDays}</div><div class="l">Active Days</div></div>
        <div class="kpi"><div class="v">${a.avgPerDay.toFixed(1)}</div><div class="l">Avg Visits / Active Day</div></div>
        <div class="kpi"><div class="v">${a.coursesServed}</div><div class="l">Courses Served</div></div>
        <div class="kpi"><div class="v">${topRes ? topRes[1] : 0}</div><div class="l">Top Resource Hits</div></div>
        <div class="kpi"><div class="v sm">${a.peakHour !== null ? formatHour(a.peakHour) : '—'}</div><div class="l">Peak Hour</div></div>
        <div class="kpi"><div class="v sm">${a.peakWeekday !== null ? WEEKDAYS[a.peakWeekday] : '—'}</div><div class="l">Busiest Weekday</div></div>
      </div>
      <div class="summary">${summaryHtml}</div>
    </div>`;
  }

  if (includeCharts) {
    html += `
    ${img.trend ? `<div class="sec">
      <div class="sec-title">Visit Trend</div>
      ${chartRow(chartBox(img.trendUnit === 'month' ? 'Visits per Month' : 'Visits per Day', img.trend))}
    </div>` : ''}
    <div class="sec sec-flow">
      <div class="sec-title">Resource Utilization &amp; Visit Purpose</div>
      ${chartRow(chartBox('Most Accessed Resources', img.resource), chartBox('Purpose of Visit', img.purpose))}
      <div class="two">
        <table><thead><tr><th>#</th><th>Resource</th><th style="text-align:right">Visits</th><th style="text-align:right">%</th></tr></thead><tbody>${mkRank(a.resources)}</tbody></table>
        <table><thead><tr><th>Purpose</th><th style="text-align:right">Count</th><th style="text-align:right">%</th></tr></thead><tbody>${mkSplit(a.purposes)}</tbody></table>
      </div>
    </div>
    <div class="sec sec-flow">
      <div class="sec-title">Visitor Demographics</div>
      ${chartRow(chartBox('Visits by Course / Department', img.course))}
      <div class="two">
        <table><thead><tr><th>#</th><th>Course / Department</th><th style="text-align:right">Visits</th><th style="text-align:right">%</th></tr></thead><tbody>${mkRank(a.courses, 15)}</tbody></table>
        <table><thead><tr><th>Month</th><th style="text-align:right">Visits</th><th style="text-align:right">Unique Visitors</th></tr></thead><tbody>${monthRows}</tbody></table>
      </div>
      ${a.courses.length ? '<p style="font-size:11px;color:#78716C;margin-top:8px;">Visitors who selected more than one course are counted under each course, so course percentages can total more than 100%.</p>' : ''}
    </div>
    <div class="sec sec-flow">
      <div class="sec-title">Usage Patterns</div>
      ${chartRow(chartBox('Visits by Day of Week', img.weekday), chartBox('Visits by Hour', img.hour))}
      <div class="two">
        <div><div class="sub">Visits by Day of Week</div><table><thead><tr><th>Day</th><th style="text-align:right">Visits</th><th style="text-align:right">%</th></tr></thead><tbody>${weekdayRows}</tbody></table></div>
        <div><div class="sub">Peak Hours</div><table><thead><tr><th>Time</th><th style="text-align:right">Visits</th><th style="text-align:right">%</th></tr></thead><tbody>${hourRows}</tbody></table></div>
      </div>
    </div>`;
  }

  if (includeLog) {
    html += `
    <div class="sec sec-log">
      <div class="sec-title">Visitor Log — ${Math.min(data.length, LOG_LIMIT)} of ${data.length} records</div>
      <table><thead><tr><th>#</th><th>Name</th><th>ID No.</th><th>Course</th><th>Purpose</th><th>Resource</th><th>Date &amp; Time</th></tr></thead><tbody>${tblRows}</tbody></table>
      ${data.length > LOG_LIMIT ? `<p style="text-align:center;font-size:11px;color:#78716C;margin-top:10px;">Showing first ${LOG_LIMIT} records. Use Export CSV for full data.</p>` : ''}
    </div>`;
  }

  html += `
  </div>
  <div class="ft"><span>Sacred Heart College Lucena City, Inc. — Library Resource Center</span><span>Generated ${now.toLocaleString('en-PH')}</span></div>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  openLink(url);
  showToast("Report opened — Print → Save as PDF.");
}

/* ── Word (.docx) report — same content as the PDF, but with real, editable Word tables ── */
const DOCX_LIB = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
const _scriptLoads = {};

// Load a library only when it is first needed (the docx builder is ~750 KB)
function loadScriptOnce(src) {
  if (!_scriptLoads[src]) {
    _scriptLoads[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { delete _scriptLoads[src]; reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }
  return _scriptLoads[src];
}

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function generateCustomDOCX({ data, title, filterText, includeSummary, includeCharts, includeLog, sortBy }) {
  if (!window.docx) {
    showToast('Preparing Word export…');
    await loadScriptOnce(DOCX_LIB);
  }
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
    HeadingLevel, ShadingType, BorderStyle, Footer, PageNumber, TableLayoutType, VerticalAlign } = window.docx;

  const now = new Date();
  const a = computeAnalytics(data);
  const periodLabel = PERIOD_LABELS[getReportPeriod()] || 'All Time';
  const LOG_LIMIT = 5000;
  const NAVY = '1E3A5F', CRIMSON = 'B91C1C', MUTED = '78716C', CONTENT = 10080; // 7" of usable width (twips)
  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

  const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), size: 20, ...o });
  const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...o });
  const heading = text => para(run(text, { bold: true, color: NAVY, size: 28 }), {
    heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: CRIMSON, space: 4 } }
  });
  const subheading = text => para(run(text, { bold: true, color: '44403C', size: 20 }), { keepNext: true, spacing: { before: 200, after: 80 } });
  const note = text => para(run(text, { italics: true, color: MUTED, size: 16 }), { spacing: { before: 80, after: 120 } });

  const cell = (text, width, o = {}) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [para(run(text, { bold: o.bold, color: o.color, size: o.size || 18 }), { alignment: o.align || AlignmentType.LEFT })]
  });

  // headers: [{ label, width, align }]; rows: arrays of cell values, or { cells, fill } to shade a row
  const table = (headers, rows, o = {}) => new Table({
    width: { size: headers.reduce((s, h) => s + h.width, 0), type: WidthType.DXA },
    columnWidths: headers.map(h => h.width),
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map(h => cell(h.label.toUpperCase(), h.width, { bold: true, color: 'FFFFFF', fill: NAVY, size: 16, align: h.align })) }),
      ...rows.map((r, i) => {
        const cells = Array.isArray(r) ? r : r.cells;
        const fill = (!Array.isArray(r) && r.fill) || (o.zebra && i % 2 ? 'F9F8F6' : undefined);
        return new TableRow({ cantSplit: true, children: cells.map((v, j) => cell(v, headers[j].width, { fill, align: headers[j].align, bold: headers[j].bold, color: headers[j].color })) });
      })
    ]
  });

  const R = AlignmentType.RIGHT;
  const rankTable = (label, arr, width, limit = 10) => table([
    { label: '#', width: 500, bold: true, color: CRIMSON },
    { label, width: width - 2300 },
    { label: 'Visits', width: 1000, align: R, bold: true, color: NAVY },
    { label: '%', width: 800, align: R, color: MUTED }
  ], arr.slice(0, limit).map(([n, c], i) => [i + 1, n, c, pct(c, a.total) + '%']));

  const image = (src, [w, h], maxWidth) => {
    const scale = Math.min(1, maxWidth / w);
    return new ImageRun({ data: dataUrlToBytes(src), transformation: { width: Math.round(w * scale), height: Math.round(h * scale) } });
  };
  const chartBlock = (caption, src, size, maxWidth = 640) => src
    ? [subheading(caption), para(image(src, size, maxWidth), { keepLines: true, spacing: { after: 160 } })]
    : [];
  // Two charts side by side in a borderless table
  const chartPair = (left, right) => {
    const half = CONTENT / 2;
    const side = ([caption, src, size]) => new TableCell({
      width: { size: half, type: WidthType.DXA }, borders: NO_BORDERS,
      children: src ? [subheading(caption), para(image(src, size, 320))] : [para(run(''))]
    });
    if (!left[1] && !right[1]) return [];
    return [new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [half, half], borders: NO_BORDERS, layout: TableLayoutType.FIXED, rows: [new TableRow({ cantSplit: true, children: [side(left), side(right)] })] }), para(run(''))];
  };
  // Two tables side by side — keeps the same layout as the PDF while each table stays editable
  const tablePair = (left, right) => {
    const half = CONTENT / 2;
    const side = content => new TableCell({ width: { size: half, type: WidthType.DXA }, borders: NO_BORDERS, margins: { right: 120 }, children: [...content, para(run(''))] });
    return new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [half, half], borders: NO_BORDERS, layout: TableLayoutType.FIXED, rows: [new TableRow({ children: [side(left), side(right)] })] });
  };
  const HALF = CONTENT / 2 - 200;

  const children = [
    para(run(title, { bold: true, size: 44, color: NAVY })),
    para(run('Sacred Heart College — Lucena City, Inc.', { color: MUTED, size: 24 }), { spacing: { after: 240 } }),
    table([{ label: 'Period', width: 2016 }, { label: 'Filters', width: 3024 }, { label: 'Generated', width: 2016 }, { label: 'Time', width: 1512 }, { label: 'Records', width: 1512, align: R }],
      [[periodLabel, filterText || 'None', now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }), now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }), a.total]])
  ];

  if (includeSummary) {
    const topRes = a.resources[0];
    const kpis = [
      [a.total, 'Total Visits'], [a.uniqueVisitors, 'Unique Visitors'], [a.activeDays, 'Active Days'], [a.avgPerDay.toFixed(1), 'Avg Visits / Active Day'],
      [a.coursesServed, 'Courses Served'], [topRes ? topRes[1] : 0, 'Top Resource Hits'],
      [a.peakHour !== null ? formatHour(a.peakHour) : '—', 'Peak Hour'], [a.peakWeekday !== null ? WEEKDAYS[a.peakWeekday] : '—', 'Busiest Weekday']
    ];
    const kpiCell = ([v, l]) => new TableCell({
      width: { size: CONTENT / 4, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F7F6F3' },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: [para(run(v, { bold: true, size: 36, color: NAVY })), para(run(l.toUpperCase(), { size: 14, color: MUTED }))]
    });
    const kpiBorder = { style: BorderStyle.SINGLE, size: 4, color: 'E2DDD8' };
    children.push(
      heading('Executive Summary'),
      new Table({
        width: { size: CONTENT, type: WidthType.DXA }, columnWidths: Array(4).fill(CONTENT / 4), layout: TableLayoutType.FIXED,
        borders: { top: kpiBorder, bottom: kpiBorder, left: kpiBorder, right: kpiBorder, insideHorizontal: kpiBorder, insideVertical: kpiBorder },
        rows: [new TableRow({ cantSplit: true, children: kpis.slice(0, 4).map(kpiCell) }), new TableRow({ cantSplit: true, children: kpis.slice(4).map(kpiCell) })]
      }),
      para(reportSummarySegments(a, filterText, includeLog, sortBy).map(([t, b]) => run(t, { bold: b, color: '44403C' })), {
        spacing: { before: 240, after: 120, line: 320 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FEF2F2' },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: CRIMSON, space: 8 } }
      })
    );
  }

  if (includeCharts) {
    const img = reportChartImages(a, filterText);
    const hourRows = a.hours.map((c, h) => [h, c]).filter(([, c]) => c > 0).sort((x, y) => y[1] - x[1]).slice(0, 6);
    if (img.trend) children.push(heading('Visit Trend'), ...chartBlock(img.trendUnit === 'month' ? 'Visits per Month' : 'Visits per Day', img.trend, img.size.trend));
    children.push(
      heading('Resource Utilization & Visit Purpose'),
      ...chartPair(['Most Accessed Resources', img.resource, img.size.resource], ['Purpose of Visit', img.purpose, img.size.purpose]),
      tablePair(
        [rankTable('Resource', a.resources, HALF)],
        [table([{ label: 'Purpose', width: HALF - 1800 }, { label: 'Count', width: 1000, align: R, bold: true }, { label: '%', width: 800, align: R, color: MUTED }],
          a.purposes.map(([n, c]) => [n, c, pct(c, a.total) + '%']))]
      ),
      heading('Visitor Demographics'),
      ...chartBlock('Visits by Course / Department', img.course, img.size.course),
      tablePair(
        [rankTable('Course / Department', a.courses, HALF, 15)],
        [table([{ label: 'Month', width: HALF - 2400 }, { label: 'Visits', width: 1000, align: R, bold: true }, { label: 'Unique Visitors', width: 1400, align: R }],
          a.months.map(m => [m.label, m.visits, m.unique]))]
      ),
      ...(a.courses.length ? [note('Visitors who selected more than one course are counted under each course, so course percentages can total more than 100%.')] : []),
      heading('Usage Patterns'),
      ...chartPair(['Visits by Day of Week', img.weekday, img.size.weekday], ['Visits by Hour', img.hour, img.size.hour]),
      tablePair(
        [subheading('Visits by Day of Week'), table([{ label: 'Day', width: HALF - 1800 }, { label: 'Visits', width: 1000, align: R, bold: true }, { label: '%', width: 800, align: R, color: MUTED }],
          WEEKDAY_ORDER.map(d => ({ cells: [WEEKDAYS[d], a.weekdays[d], pct(a.weekdays[d], a.total) + '%'], fill: d === a.peakWeekday ? 'FEF2F2' : undefined })))],
        [subheading('Peak Hours'), table([{ label: 'Time', width: HALF - 1800 }, { label: 'Visits', width: 1000, align: R, bold: true }, { label: '%', width: 800, align: R, color: MUTED }],
          hourRows.map(([h, c]) => [`${formatHour(h)} – ${formatHour((h + 1) % 24)}`, c, pct(c, a.total) + '%']))]
      )
    );
  }

  if (includeLog) {
    const rows = data.slice(0, LOG_LIMIT).map((e, i) => [i + 1, e.name || '—', e.id_number || '—', e.course || '—', e.purpose || '—', e.resource || '—', e.visited_at ? new Date(e.visited_at).toLocaleString() : '—']);
    children.push(
      heading(`Visitor Log — ${rows.length} of ${data.length} records`),
      table([{ label: '#', width: 500 }, { label: 'Name', width: 1800, bold: true }, { label: 'ID No.', width: 1000 }, { label: 'Course', width: 1500 }, { label: 'Purpose', width: 1200 }, { label: 'Resource', width: 1780 }, { label: 'Date & Time', width: 2300 }], rows, { zebra: true })
    );
    if (data.length > LOG_LIMIT) children.push(note(`Showing first ${LOG_LIMIT} records. Use Export CSV for full data.`));
  }

  const doc = new Document({
    creator: 'SHC Library Resource Center',
    title,
    styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      footers: {
        default: new Footer({
          children: [para([
            run('Sacred Heart College Lucena City, Inc. — Library Resource Center    ·    Generated ' + now.toLocaleString('en-PH') + '    ·    Page ', { size: 16, color: MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED })
          ], { alignment: AlignmentType.CENTER })]
        })
      },
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Library_Report';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}_${getLocalDateString(now)}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000); // Safari needs the URL alive while the download starts
  showToast(`Word report downloaded — ${a.total} records. Open it in Word to edit.`);
}
