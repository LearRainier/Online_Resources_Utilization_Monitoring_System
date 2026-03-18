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
    var wbt = document.getElementById('wb-total'); if(wbt) wbt.textContent = all.length;
    var wbd = document.getElementById('wb-today'); if(wbd) wbd.textContent = todayC;
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
    setTimeout(() => renderAllCharts(), 100);
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
      <td style="font-size:12px;">${e.course || '—'}</td>      <td><span class="badge b-green">${e.purpose || '—'}</span></td>
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

async function saveConfig() {
  let url = document.getElementById('cfgUrl').value.trim().replace(/\/$/, '');
  let key = document.getElementById('cfgKey').value.trim();
  let st = document.getElementById('cfgStatus');
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

function closeModal() {
  document.getElementById('overlay').classList.remove('active');
  ['fLastName', 'fFirstName', 'fID'].forEach(id => document.getElementById(id).value = '');
  ['fCourse', 'fPurpose'].forEach(id => document.getElementById(id).value = '');
}

async function submitForm() {
  let ln = document.getElementById('fLastName').value.trim();
  let fn = document.getElementById('fFirstName').value.trim();
  let id = document.getElementById('fID').value.trim();
  let course = document.getElementById('fCourse').value;
  let purpose = document.getElementById('fPurpose').value;
  if (!ln || !fn || !course) {
    showToast('Please fill in Last Name, First Name, and Course.');
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
/* ═══════════════════════════════════════════════════
   ANALYTICS ENGINE  —  no function wrapping, no recursion
═══════════════════════════════════════════════════ */

let _chartRes = null, _chartDaily = null, _chartDept = null,
    _chartPurpose = null;

const PALETTE_BAR = ['#B91C1C','#1E3A5F','#166534','#C9952A','#7C2D12','#1E40AF','#065F46','#6B21A8'];
const PALETTE_PIE = ['#B91C1C','#1E3A5F','#C9952A','#166534','#7C2D12','#6B21A8','#0369A1','#9F1239'];

function getFilteredVisits() {
  const period = (document.getElementById('reportPeriod') || {}).value || 'all';
  const now = new Date();
  return allVisits.filter(e => {
    if (!e.visited_at) return false;
    const d = new Date(e.visited_at);
    if (period === 'today') return d.toDateString() === now.toDateString();
    if (period === 'week')  { const w = new Date(now); w.setDate(w.getDate()-7); return d >= w; }
    if (period === 'month') { const m = new Date(now); m.setDate(1); m.setHours(0,0,0,0); return d >= m; }
    return true;
  });
}

function countBy(arr, key) {
  const map = {};
  arr.forEach(e => { const v = (e[key] || 'Unknown').trim(); map[v] = (map[v]||0)+1; });
  return Object.entries(map).sort((a,b) => b[1]-a[1]);
}

function destroyChart(ref) { try { if (ref) ref.destroy(); } catch(e) {} return null; }

function renderAllCharts() {
  const data = getFilteredVisits();
  const emptyEl = document.getElementById('analyticsEmpty');
  if (!data.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  updateKPIs(data);
  renderResourceChart(data);
  renderDailyChart(data);
  renderDeptChart(data);
  renderPurposeChart(data);
  renderRankingTable('rankCourse',   countBy(data,'course'),   'course');
  renderRankingTable('rankResource', countBy(data,'resource'), 'resource');
}

function updateKPIs(data) {
  const safe = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  safe('kpi-total', data.length);
  safe('kpi-days',  new Set(data.map(e=>e.visited_at.slice(0,10))).size);
  safe('kpi-courses', new Set(data.map(e=>e.course).filter(Boolean)).size);
  const top = countBy(data,'resource')[0];
  safe('kpi-top-res', top ? top[0].split(' ').slice(0,2).join(' ') : '—');
}

function renderResourceChart(data) {
  const ctx = document.getElementById('chartResource'); if(!ctx) return;
  _chartRes = destroyChart(_chartRes);
  const SHORT = {'ProQuest Ebook Central':'PQ Ebook','ProQuest Research Library':'PQ Research','World Book Online':'World Book','3G E-Learning':'3G Learn','Kite Academy':'Kite','Encleare (GEAP)':'Encleare','Library and AVRC Utilization Guide':'AVRC Guide'};
  const entries = countBy(data,'resource').slice(0,7);
  _chartRes = new Chart(ctx, {
    type:'bar',
    data:{ labels:entries.map(([k])=>SHORT[k]||k.split(' ').slice(0,2).join(' ')), datasets:[{label:'Visits',data:entries.map(([,v])=>v),backgroundColor:PALETTE_BAR,borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw} visits`}}},scales:{x:{grid:{display:false},ticks:{font:{size:11}}},y:{beginAtZero:true,ticks:{stepSize:1,font:{size:11}},grid:{color:'rgba(0,0,0,0.04)'}}}}
  });
}

function renderDailyChart(data) {
  const ctx = document.getElementById('chartDaily'); if(!ctx) return;
  _chartDaily = destroyChart(_chartDaily);
  const dayMap = {};
  data.forEach(e => { const d=e.visited_at.slice(0,10); dayMap[d]=(dayMap[d]||0)+1; });
  const sorted = Object.entries(dayMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-30);
  _chartDaily = new Chart(ctx, {
    type:'line',
    data:{ labels:sorted.map(([d])=>{ const dt=new Date(d); return (dt.getMonth()+1)+'/'+(dt.getDate()); }), datasets:[{label:'Visits',data:sorted.map(([,v])=>v),borderColor:'#B91C1C',backgroundColor:'rgba(185,28,28,0.08)',fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:'#B91C1C'}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:10},maxTicksLimit:8}},y:{beginAtZero:true,ticks:{stepSize:1,font:{size:11}},grid:{color:'rgba(0,0,0,0.04)'}}}}
  });
}

function renderDeptChart(data) {
  const ctx = document.getElementById('chartDept'); if(!ctx) return;
  _chartDept = destroyChart(_chartDept);
  const ABBR = {'Bachelor of Arts':'BA','Bachelor of Science in Nursing':'BSN','Bachelor of Science in Education':'BSEd','Bachelor of Science in Accountancy':'BSA','Bachelor of Science in Business Administration':'BSBA','Bachelor of Science in Computer Science':'BSCS','Bachelor of Science in Information Technology':'BSIT','Bachelor of Science in Social Work':'BSSW','Senior High School':'SHS','Faculty / Staff':'Faculty','Graduate School':'Grad School'};
  const entries = countBy(data,'course').slice(0,8);
  _chartDept = new Chart(ctx, {
    type:'bar',
    data:{ labels:entries.map(([k])=>ABBR[k]||k.split(' ').slice(0,3).join(' ')), datasets:[{label:'Visits',data:entries.map(([,v])=>v),backgroundColor:PALETTE_BAR,borderRadius:5,borderSkipped:false}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw} visits`}}},scales:{x:{beginAtZero:true,ticks:{font:{size:11}},grid:{color:'rgba(0,0,0,0.04)'}},y:{grid:{display:false},ticks:{font:{size:11}}}}}
  });
}

function renderPurposeChart(data) {
  const ctx = document.getElementById('chartPurpose'); if(!ctx) return;
  _chartPurpose = destroyChart(_chartPurpose);
  const entries = countBy(data,'purpose').slice(0,6);
  _chartPurpose = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:entries.map(([k])=>k||'Unknown'), datasets:[{data:entries.map(([,v])=>v),backgroundColor:['#1E3A5F','#B91C1C','#C9952A','#166534','#7C2D12','#6B21A8'],borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:true,cutout:'58%',plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:10,boxWidth:12}},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw}`}}}}
  });
}

function renderRankingTable(containerId, entries, type) {
  const el = document.getElementById(containerId); if(!el) return;
  if(!entries.length){ el.innerHTML='<div style="padding:20px;text-align:center;font-size:13px;color:var(--tx-xs);">No data</div>'; return; }
  const max = entries[0][1];
  const ABBR_C = {'Bachelor of Arts':'BA','Bachelor of Science in Nursing':'BSN','Bachelor of Science in Education':'BSEd','Bachelor of Science in Accountancy':'BSA','Bachelor of Science in Business Administration':'BSBA','Bachelor of Science in Computer Science':'BSCS','Bachelor of Science in Information Technology':'BSIT','Bachelor of Science in Social Work':'BSSW','Senior High School':'SHS','Faculty / Staff':'Faculty','Graduate School':'Grad School'};
  const ABBR_R = {'Library and AVRC Utilization Guide':'AVRC Guide'};
  const posClass = i => i===0?'gold':i===1?'silver':i===2?'bronze':'';
  el.innerHTML = entries.slice(0,8).map(([name,count],i) => {
    const display = type==='course' ? (ABBR_C[name]||name) : (ABBR_R[name]||name);
    const pct = Math.round((count/max)*100);
    return `<div class="rank-row">
      <div class="rank-pos ${posClass(i)}">${i+1}</div>
      <div class="rank-name" title="${name}">${display}</div>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
      <div class="rank-count">${count}</div>
    </div>`;
  }).join('');
}

/* ── Export CSV ── */
function downloadReportCSV() {
  const data = getFilteredVisits();
  if(!data.length){ showToast('No data for the selected period.'); return; }
  const period = document.getElementById('reportPeriod').value;
  const headers = ['#','Name','ID Number','Course / Department','Purpose','Resource Accessed','Date & Time'];
  const rows = data.map((e,i)=>[i+1,e.name||'',e.id_number||'',e.course||'',e.purpose||'',e.resource||'',e.visited_at?new Date(e.visited_at).toLocaleString():'']);
  const csv = [headers,...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`SHC_Library_Report_${period}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast(`CSV exported — ${data.length} records.`);
}

/* ── Download PDF Report ── */
function downloadReportPDF() {
  const data = getFilteredVisits();
  if(!data.length){ showToast('No data for the selected period.'); return; }
  const period = document.getElementById('reportPeriod').value;
  const periodLabel = {all:'All Time',month:'This Month',week:'This Week',today:'Today'}[period]||'All Time';
  const now = new Date();
  const resCounts  = countBy(data,'resource');
  const crseCounts = countBy(data,'course');
  const purpCounts = countBy(data,'purpose');
  const uniqueDays = new Set(data.map(e=>e.visited_at.slice(0,10))).size;
  const uniqueCrs  = new Set(data.map(e=>e.course).filter(Boolean)).size;
  const topRes = resCounts[0];
  const tblRows = data.slice(0,200).map((e,i)=>`<tr style="background:${i%2===0?'#fff':'#f9f8f6'}"><td>${i+1}</td><td><strong>${e.name||'—'}</strong></td><td style="font-family:monospace;font-size:11px;">${e.id_number||'—'}</td><td>${e.course||'—'}</td><td>${e.purpose||'—'}</td><td>${e.resource||'—'}</td><td style="font-size:11px;">${e.visited_at?new Date(e.visited_at).toLocaleString():'—'}</td></tr>`).join('');
  const mkRank = (arr,limit=10) => arr.slice(0,limit).map(([n,c],i)=>`<tr><td style="width:28px;font-weight:700;color:#B91C1C;">${i+1}</td><td>${n}</td><td style="text-align:right;font-weight:700;color:#1E3A5F;">${c}</td></tr>`).join('');
  const mkSplit = (arr) => arr.map(([n,c])=>`<tr><td>${n||'Unknown'}</td><td style="text-align:right;font-weight:700;">${c}</td><td style="text-align:right;color:#78716C;">${Math.round(c/data.length*100)}%</td></tr>`).join('');

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SHC Library Report</title>
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
  .sec{margin-bottom:36px;}
  .sec-title{font-size:15px;font-weight:700;color:#1E3A5F;border-bottom:2px solid #B91C1C;padding-bottom:6px;margin-bottom:16px;}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
  .kpi{background:#F7F6F3;border-radius:8px;padding:16px 18px;border:1px solid #E2DDD8;}
  .kpi .v{font-size:28px;font-weight:700;color:#1E3A5F;line-height:1;}
  .kpi .l{font-size:10px;color:#78716C;text-transform:uppercase;letter-spacing:.6px;margin-top:3px;}
  .summary{font-size:13px;color:#44403C;line-height:1.75;background:#FEF2F2;border-left:4px solid #B91C1C;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:8px;}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:#1E3A5F;color:#fff;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.6px;}
  td{padding:8px 12px;border-bottom:1px solid #EDE9E4;vertical-align:top;}
  tr:last-child td{border-bottom:none;}
  .ft{background:#152A47;color:rgba(255,255,255,.45);padding:14px 48px;font-size:11px;display:flex;justify-content:space-between;}
  @media print{.cover,.kpi,.summary{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>
  <div class="cover">
    <div class="logo">SHC<br>LCI</div>
    <h1>Library Resource Center<br>Usage Analytics Report</h1>
    <h2>Sacred Heart College — Lucena City, Inc.</h2>
    <div class="meta">
      <div class="meta-item"><div class="lbl">Period</div><div class="val">${periodLabel}</div></div>
      <div class="meta-item"><div class="lbl">Generated</div><div class="val">${now.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})}</div></div>
      <div class="meta-item"><div class="lbl">Time</div><div class="val">${now.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</div></div>
      <div class="meta-item"><div class="lbl">Prepared By</div><div class="val">SHC Library System</div></div>
    </div>
  </div>
  <div class="body">
    <div class="sec">
      <div class="sec-title">Executive Summary</div>
      <div class="kpis">
        <div class="kpi"><div class="v">${data.length}</div><div class="l">Total Visitors</div></div>
        <div class="kpi"><div class="v">${uniqueDays}</div><div class="l">Active Days</div></div>
        <div class="kpi"><div class="v">${uniqueCrs}</div><div class="l">Courses Served</div></div>
        <div class="kpi"><div class="v">${topRes?topRes[1]:0}</div><div class="l">Top Resource Hits</div></div>
      </div>
      <div class="summary">During the period of <strong>${periodLabel}</strong>, the SHC Library Resource Center recorded <strong>${data.length} visitor transactions</strong> across all digital e-resource platforms. The system served students and faculty from <strong>${uniqueCrs} academic courses/departments</strong> over <strong>${uniqueDays} active days</strong>.${topRes?` The most accessed resource was <strong>${topRes[0]}</strong> with <strong>${topRes[1]} visits</strong>.`:''}</div>
    </div>
    <div class="sec">
      <div class="sec-title">Resource Utilization &amp; Visit Purpose</div>
      <div class="two">
        <table><thead><tr><th>#</th><th>Resource</th><th style="text-align:right">Visits</th></tr></thead><tbody>${mkRank(resCounts)}</tbody></table>
        <table><thead><tr><th>Purpose</th><th style="text-align:right">Count</th><th style="text-align:right">%</th></tr></thead><tbody>${mkSplit(purpCounts)}</tbody></table>
      </div>
    </div>
    <div class="sec">
      <div class="sec-title">Visitor Demographics</div>
      <div class="two">
        <table><thead><tr><th>#</th><th>Course / Department</th><th style="text-align:right">Visits</th></tr></thead><tbody>${mkRank(crseCounts)}</tbody></table>

      </div>
    </div>
    <div class="sec">
      <div class="sec-title">Visitor Log — ${Math.min(data.length,200)} of ${data.length} records</div>
      <table><thead><tr><th>#</th><th>Name</th><th>ID No.</th><th>Course</th><th>Purpose</th><th>Resource</th><th>Date &amp; Time</th></tr></thead><tbody>${tblRows}</tbody></table>
      ${data.length>200?'<p style="text-align:center;font-size:11px;color:#78716C;margin-top:10px;">Showing first 200 records. Use Export CSV for full data.</p>':''}
    </div>
  </div>
  <div class="ft"><span>Sacred Heart College Lucena City, Inc. — Library Resource Center</span><span>Generated ${now.toLocaleString('en-PH')}</span></div>
  </body></html>`;

  const blob = new Blob([html],{type:'text/html'});
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url,'_blank');
  if(win) win.onload = () => setTimeout(()=>win.print(), 500);
  showToast("Report opened — Print → Save as PDF.");
}