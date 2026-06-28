const firebaseConfig = {
  apiKey: "AIzaSyAexUjhTx1iBiivwB8rUdK52ANleN1DFAg",
  authDomain: "eden54.firebaseapp.com",
  projectId: "eden54",
  storageBucket: "eden54.firebasestorage.app",
  messagingSenderId: "643222824531",
  appId: "1:643222824531:web:dc643654a672c1cd0d48a6"
};
firebase.initializeApp(firebaseConfig);
const db      = firebase.firestore();
const storage = firebase.storage();

/* ── Identity ── */
function getStaff() {
  try {
    const s = localStorage.getItem('eden54_staff');
    if (!s) { window.location.href = '/portal/'; return null; }
    return JSON.parse(s);
  } catch(e) { window.location.href = '/portal/'; return null; }
}
function setStaff(data) { localStorage.setItem('eden54_staff', JSON.stringify(data)); }
function switchProfile() { localStorage.removeItem('eden54_staff'); window.location.href = '/portal/'; }

/* ── Sidebar ── */
function populateSidebar(staff) {
  const el = document.getElementById('sidebarUser');
  if (el) el.innerHTML = `<strong>${staff.name}</strong><span>${staff.department}</span>`;
}

/**
 * Build role/dept-aware sidebar nav.
 * Call after getStaff() on every portal page.
 * @param {object} staff  — the staff object from localStorage
 * @param {string} active — page key: 'home','dashboard','updates','sales',
 *                          'bar','kitchen','barbing','pool',
 *                          'attendance','payroll','staff'
 */
function buildNav(staff, active) {
  const isManager = staff.role === 'manager';
  const dept      = (staff.department || '').toLowerCase();

  // What each department is allowed to see in the Reports section
  const canReport = {
    sales:   true,                                // everyone submits daily sales
    bar:     isManager || dept === 'bar',
    kitchen: isManager || dept === 'kitchen',
    barbing: isManager || dept === 'salon',
    pool:    isManager || dept === 'pool',
  };

  const a = (href, icon, label, page) => {
    const cls = 'sb-item' + (active === page ? ' active' : '');
    return `<a href="${href}" class="${cls}"><i class="sb-icon">${icon}</i> ${label}</a>`;
  };
  const sec = label => `<div class="sb-section">${label}</div>`;

  let html = sec('Main');
  html += a('/portal/home/',      '🏠', 'My Home',   'home');
  html += a('/portal/updates/',   '📸', 'Updates',   'updates');
  if (isManager) html += a('/portal/dashboard/', '📊', 'Dashboard', 'dashboard');

  // Reports — only show what's relevant to this person's role/dept
  const reportLinks = [
    canReport.sales   && a('/portal/sales/',   '💰', 'Daily Sales', 'sales'),
    canReport.bar     && a('/portal/bar/',     '🍺', 'Bar Stock',   'bar'),
    canReport.kitchen && a('/portal/kitchen/', '🍽️', 'Kitchen',     'kitchen'),
    canReport.barbing && a('/portal/barbing/', '💈', 'Barbing',     'barbing'),
    canReport.pool    && a('/portal/pool/',    '🏊', 'Pool',        'pool'),
  ].filter(Boolean);

  if (reportLinks.length) {
    html += sec('Reports');
    html += reportLinks.join('');
  }

  // HR + Admin — manager only
  if (isManager) {
    html += sec('HR');
    html += a('/portal/attendance/', '👥', 'Attendance',   'attendance');
    html += a('/portal/payroll/',    '💵', 'Payroll',      'payroll');
    html += sec('Admin');
    html += a('/portal/staff/',      '👤', 'Manage Staff', 'staff');
  }

  const nav = document.getElementById('sbNav');
  if (nav) nav.innerHTML = html;
}

/**
 * Redirect to home if the current staff member doesn't have access to a page.
 * Returns false and redirects if access is denied.
 */
function requireAccess(staff, page) {
  const isManager = staff.role === 'manager';
  const dept      = (staff.department || '').toLowerCase();
  const rules = {
    dashboard:  isManager,
    staff:      isManager,
    attendance: isManager,
    payroll:    isManager,
    bar:        isManager || dept === 'bar',
    kitchen:    isManager || dept === 'kitchen',
    barbing:    isManager || dept === 'salon',
    pool:       isManager || dept === 'pool',
    sales:      true,
    home:       true,
    updates:    true,
  };
  if (rules[page] === false) {
    window.location.href = '/portal/home/';
    return false;
  }
  return true;
}

/* ── UI helpers ── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtNaira(n) { return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 }); }
function showAlert(id, msg, type = 'alert-success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'alert ' + type;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4500);
}
function avatarInitials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
