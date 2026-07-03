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
/**
 * Eden 54 facility coordinates.
 * UPDATE these to the actual GPS coordinates of the property.
 * Tip: open Google Maps, long-press on the building → copy coordinates.
 */
const FACILITY = { lat: 7.6284, lng: 4.7407 }; // Ilesa, Osun — update to exact Eden 54 pin
const CLOCK_RADIUS_METERS = 300; // staff must be within this distance to clock in/out

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function captureLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        lat:      p.coords.latitude,
        lng:      p.coords.longitude,
        accuracy: Math.round(p.coords.accuracy)
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function buildNav(staff, active) {
  const isManager    = staff.role === 'manager' || staff.role === 'superadmin';
  const isSuperAdmin = staff.role === 'superadmin';
  const dept         = (staff.department || '').toLowerCase();

  // What each department is allowed to see in the Reports section
  const canReport = {
    sales:   true,
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

  if (isManager) {
    // Managers & HR see the collated overview — not individual submission pages
    html += sec('Reports');
    html += a('/portal/reports/', '📋', 'All Reports', 'reports');
    html += sec('HR');
    html += a('/portal/attendance/', '👥', 'Attendance',   'attendance');
    html += a('/portal/payroll/',    '💵', 'Payroll',      'payroll');
    html += a('/portal/activity/',   '🕵️', 'Staff Activity', 'activity');
    html += a('/portal/expenses/',   '🧾', 'Expenses',     'expenses');
    html += sec('Admin');
    html += a('/portal/staff/',      '👤', 'Manage Staff', 'staff');
  } else {
    // Regular staff see only their own department submission pages
    const reportLinks = [
      canReport.sales   && a('/portal/sales/',   '💰', 'Daily Sales', 'sales'),
      canReport.bar     && a('/portal/bar/',     '🍺', 'Bar Stock',   'bar'),
      canReport.kitchen && a('/portal/kitchen/', '🍽️', 'Kitchen',     'kitchen'),
      canReport.barbing && a('/portal/barbing/', '💈', 'Barbing',     'barbing'),
      canReport.pool    && a('/portal/pool/',    '🏊', 'Pool',        'pool'),
      a('/portal/expenses/', '🧾', 'Expenses', 'expenses'),
    ].filter(Boolean);
    if (reportLinks.length) {
      html += sec('Reports');
      html += reportLinks.join('');
    }
  }

  const nav = document.getElementById('sbNav');
  if (nav) nav.innerHTML = html;

  // Only managers can switch profiles — regular staff stay locked to their own portal
  const switchBtn = document.querySelector('.sb-foot a[onclick]');
  if (switchBtn) switchBtn.style.display = isManager ? '' : 'none';
}

/**
 * Redirect to home if the current staff member doesn't have access to a page.
 * Returns false and redirects if access is denied.
 */
function requireAccess(staff, page) {
  const isManager    = staff.role === 'manager' || staff.role === 'superadmin';
  const isSuperAdmin = staff.role === 'superadmin';
  const dept         = (staff.department || '').toLowerCase();
  const rules = {
    dashboard:  isManager,
    staff:      isManager,
    attendance: isManager,
    payroll:    isManager,
    reports:    isManager,
    activity:   isManager,
    expenses:   true,
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
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
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
