// Admin access is URL-based only. Add ?admin=enabled to URL to access.
let currentTarget = '#', currentResource = '';
let allVisits = [];
let isAdminAllowed = false;

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

async function sbFetch(path, opts = {}) {
  let c = getCfg();
  if (!c.url || !c.key) return null;
  let res = await fetch(c.url + '/rest/v1/' + path, {
    headers: {
      'apikey': c.key,
      'Authorization': 'Bearer ' + c.key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {})
    },
    ...opts
  });
  if (!res.ok) return null;
  return res.json();
}

async function loadStatsBar() {
  if (!isConfigured()) {
    document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-pending">Not configured</span>';
    document.getElementById('totalVisits').textContent = '—';
    document.getElementById('todayVisits').textContent = '—';
    return;
  }
  try {
    let today = new Date().toISOString().slice(0, 10);
    let all = await sbFetch('visitor_log?select=id,name,resource,visited_at&order=visited_at.desc');
    if (!all) {
      document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-fail">Connection error</span>';
      return;
    }
    document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-ok">Connected</span>';
    document.getElementById('totalVisits').textContent = all.length;
    let todayC = all.filter(e => e.visited_at && e.visited_at.startsWith(today)).length;
    document.getElementById('todayVisits').textContent = todayC;
    if (all.length > 0) {
      let l = all[0];
      document.getElementById('lastVisitor').textContent = (l.name || '—') + ' — ' + (l.resource || '').split(' ').slice(0, 2).join(' ');
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
  } else if (sessionStorage.getItem('admin_session') === 'true') {
    isAdminAllowed = true;
    document.getElementById('nav-admin').style.display = 'inline';
  } else {
    document.getElementById('nav-admin').style.display = 'none';
  }
}

checkAdminAccess();
loadStatsBar();

function showPage(p) {
  if (p === 'admin' && !isAdminAllowed) {
    alert('Admin access denied. Admin dashboard is not available.');
    return;
  }
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-bar a').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
}

function checkLogin() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDash').classList.add('active');
  let c = getCfg();
  if (c.url) document.getElementById('cfgUrl').value = c.url;
  if (c.key) document.getElementById('cfgKey').value = c.key;
  loadVisits();
}

function logoutAdmin() {
  document.getElementById('adminLogin').style.display = 'flex';
  document.getElementById('adminDash').classList.remove('active');
  document.getElementById('adminPwd').value = '';
  document.getElementById('loginError').style.display = 'none';
}

async function loadVisits() {
  document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="8">Loading records from Supabase...</td></tr>';
  if (!isConfigured()) {
    document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="8">Please configure Supabase credentials below to load visitor records.</td></tr>';
    document.getElementById('ds-total').textContent = '—';
    document.getElementById('ds-today').textContent = '—';
    document.getElementById('ds-week').textContent = '—';
    document.getElementById('ds-top').textContent = '—';
    return;
  }
  try {
    let data = await sbFetch('visitor_log?select=*&order=visited_at.desc&limit=500');
    if (!data) {
      document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="8">Failed to connect. Check your Supabase URL and key.</td></tr>';
      return;
    }
    allVisits = data;
    updateDashStats(data);
    renderTableData(data);
  } catch (e) {
    document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="8">Error loading data: ' + e.message + '</td></tr>';
  }
}

function updateDashStats(data) {
  let today = new Date().toISOString().slice(0, 10);
  let week = new Date();
  week.setDate(week.getDate() - 7);
  let todayC = data.filter(e => e.visited_at && e.visited_at.startsWith(today)).length;
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
  let s = document.getElementById('searchLog').value.toLowerCase();
  let r = document.getElementById('filterRes').value;
  let d = document.getElementById('filterDate').value;
  let today = new Date().toISOString().slice(0, 10);
  let week = new Date();
  week.setDate(week.getDate() - 7);
  let month = new Date();
  month.setDate(1);
  let f = allVisits.filter(e => {
    if (s && !((e.name || '').toLowerCase().includes(s) || (e.id_number || '').toLowerCase().includes(s) || (e.course || '').toLowerCase().includes(s))) return false;
    if (r && e.resource !== r) return false;
    if (d === 'today' && !(e.visited_at || '').startsWith(today)) return false;
    if (d === 'week' && new Date(e.visited_at) < week) return false;
    if (d === 'month' && new Date(e.visited_at) < month) return false;
    return true;
  });
  renderTableData(f);
}

function renderTableData(data) {
  if (data.length === 0) {
    document.getElementById('logTableBody').innerHTML = '<tr class="loading-row"><td colspan="8">No records found.</td></tr>';
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
      <td style="font-weight:500;">${e.name || '—'}</td>
      <td style="font-family:monospace;font-size:12px;">${e.id_number || '—'}</td>
      <td style="font-size:12px;">${e.course || '—'}</td>
      <td style="font-size:12px;">${e.year_level || '—'}</td>
      <td><span class="badge b-green">${e.purpose || '—'}</span></td>
      <td><span class="badge ${badge(e.resource)}">${e.resource || '—'}</span></td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap;">${e.visited_at ? new Date(e.visited_at).toLocaleString() : '—'}</td>
    </tr>
  `).join('');
}

function exportCSV() {
  if (allVisits.length === 0) {
    showToast('No data to export.');
    return;
  }
  let headers = ['#', 'Name', 'ID Number', 'Course', 'Year Level', 'Purpose', 'Resource', 'Date & Time'];
  let rows = allVisits.map((e, i) => [
    i + 1,
    e.name || '',
    e.id_number || '',
    e.course || '',
    e.year_level || '',
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

async function saveConfig() {
  let url = document.getElementById('cfgUrl').value.trim().replace(/\/$/, '');
  let key = document.getElementById('cfgKey').value.trim();
  let st = document.getElementById('cfgStatus');
  if (!url || !key) {
    st.style.color = 'var(--red)';
    st.textContent = 'Please enter both URL and key.';
    return;
  }
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  st.style.color = 'var(--muted)';
  st.textContent = 'Testing connection...';
  try {
    let res = await fetch(url + '/rest/v1/visitor_log?select=id&limit=1', {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key
      }
    });
    if (res.ok) {
      st.style.color = 'var(--green)';
      st.textContent = 'Connection successful! Database is live.';
      document.getElementById('dbStatus').innerHTML = '<span class="db-badge db-ok">Connected</span>';
      loadStatsBar();
      loadVisits();
      showToast('Supabase connected successfully!');
    } else {
      st.style.color = 'var(--red)';
      st.textContent = 'Connection failed (' + res.status + '). Check your URL and key, and make sure the visitor_log table exists.';
    }
  } catch (e) {
    st.style.color = 'var(--red)';
    st.textContent = 'Network error: ' + e.message;
  }
}

function openModal(name, url) {
  currentTarget = url;
  currentResource = name;
  document.getElementById('modalTitle').textContent = 'Access: ' + name;
  document.getElementById('overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('active');
  ['fLastName', 'fFirstName', 'fID'].forEach(id => document.getElementById(id).value = '');
  ['fCourse', 'fYear', 'fPurpose'].forEach(id => document.getElementById(id).value = '');
}

async function submitForm() {
  let ln = document.getElementById('fLastName').value.trim();
  let fn = document.getElementById('fFirstName').value.trim();
  let id = document.getElementById('fID').value.trim();
  let course = document.getElementById('fCourse').value;
  let year = document.getElementById('fYear').value;
  let purpose = document.getElementById('fPurpose').value;
  if (!ln || !fn || !course) {
    showToast('Please fill in Last Name, First Name, and Course.');
    return;
  }
  let entry = {
    name: fn + ' ' + ln,
    id_number: id,
    course: course,
    year_level: year,
    purpose: purpose,
    resource: currentResource
  };
  let btn = document.getElementById('submitBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  if (isConfigured()) {
    await sbFetch('visitor_log', { method: 'POST', body: JSON.stringify(entry) });
  }
  btn.textContent = 'Proceed to Resource';
  btn.disabled = false;
  closeModal();
  loadStatsBar();
  showToast('Welcome, ' + fn + '! Opening ' + currentResource + '...');
  setTimeout(() => { window.open(currentTarget, '_blank'); }, 1000);
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
document.getElementById('adminPwd').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') checkLogin();
});
