const firebaseConfig = {
  apiKey: "AIzaSyAexUjhTx1iBiivwB8rUdK52ANleN1DFAg",
  authDomain: "eden54.firebaseapp.com",
  projectId: "eden54",
  storageBucket: "eden54.firebasestorage.app",
  messagingSenderId: "643222824531",
  appId: "1:643222824531:web:dc643654a672c1cd0d48a6"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let storage = null;
try { storage = firebase.storage(); } catch(e) {}

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

let _navActive  = '';
let _navFetched = false;

function buildNav(staff, active) {
  _navActive = active;
  const _raw      = (staff.accessLevel || staff.role || 'staff').toLowerCase().replace(/\s+/g,'');
  const isCEO     = _raw === 'ceo' || _raw === 'superadmin';
  const isManager = isCEO || _raw === 'manager';
  const dept      = (staff.department || '').toLowerCase();
  const isHR      = !isManager && (_raw === 'hr' || dept === 'hr' || dept.includes('human resource'));
  const isFrontDesk = dept === 'front desk' || dept === 'receptionist' || dept === 'lounge' || dept === 'apartments';

  const canReport = {
    sales:      true,
    bar:        isManager || dept === 'bar',
    kitchen:    isManager || dept === 'kitchen',
    barbing:    isManager || dept === 'salon',
    pool:       isManager || dept === 'pool',
    apartments: isManager || isHR || isFrontDesk,
  };

  const a = (href, icon, label, page) => {
    const cls = 'sb-item' + (active === page ? ' active' : '');
    return `<a href="${href}" class="${cls}"><i class="sb-icon">${icon}</i> ${label}</a>`;
  };
  const sec = label => `<div class="sb-section">${label}</div>`;

  let html = sec('Main');
  html += a('/portal/home/',    '🏠', 'My Home',   'home');
  html += a('/portal/updates/', '📸', 'Updates',   'updates');
  if (isManager) html += a('/portal/dashboard/', '📊', 'Dashboard', 'dashboard');

  if (isManager) {
    html += sec('Reports');
    html += a('/portal/reports/',    '📋', 'All Reports',    'reports');
    html += sec('HR & Operations');
    html += a('/portal/attendance/', '👥', 'Attendance',     'attendance');
    html += a('/portal/payroll/',    '💵', 'Payroll',        'payroll');
    html += a('/portal/activity/',   '🕵️', 'Staff Activity', 'activity');
    html += a('/portal/expenses/',   '🧾', 'Expenses',       'expenses');
    html += sec('Admin');
    html += a('/portal/staff/',      '👤', 'Manage Staff',   'staff');
    html += sec('Apartments');
    html += a('/portal/apartments/', '🏨', 'Apartment Rentals', 'apartments');
  } else if (isHR) {
    html += sec('Reports');
    html += a('/portal/reports/',    '📋', 'All Reports',    'reports');
    html += sec('HR');
    html += a('/portal/attendance/', '👥', 'Attendance',     'attendance');
    html += a('/portal/payroll/',    '💵', 'Payroll',        'payroll');
    html += a('/portal/expenses/',   '🧾', 'Expenses',       'expenses');
    html += sec('Admin');
    html += a('/portal/staff/',      '👤', 'Manage Staff',   'staff');
    html += sec('Apartments');
    html += a('/portal/apartments/', '🏨', 'Apartment Rentals', 'apartments');
  } else {
    const reportLinks = [
      canReport.sales      && a('/portal/sales/',      '💰', 'Daily Sales', 'sales'),
      canReport.bar        && a('/portal/bar/',        '🍺', 'Bar Stock',   'bar'),
      canReport.kitchen    && a('/portal/kitchen/',    '🍽️', 'Kitchen',     'kitchen'),
      canReport.barbing    && a('/portal/barbing/',    '💈', 'Barbing',     'barbing'),
      canReport.pool       && a('/portal/pool/',       '🏊', 'Pool',        'pool'),
      canReport.apartments && a('/portal/apartments/', '🏨', 'Apartments',  'apartments'),
      a('/portal/expenses/', '🧾', 'Expenses', 'expenses'),
    ].filter(Boolean);
    if (reportLinks.length) {
      html += sec('Reports');
      html += reportLinks.join('');
    }
  }

  const isPOSStaff = isManager || isHR || isFrontDesk
    || dept.includes('game') || dept.includes('bar') || dept.includes('bartend') || dept.includes('lounge')
    || dept.includes('salon') || dept.includes('barbing');
  if (isPOSStaff) {
    html += sec('POS');
    html += a('/portal/pos/', '🖥️', 'POS Terminal', 'pos');
  }

  const nav = document.getElementById('sbNav');
  if (nav) nav.innerHTML = html;

  const canSeeApts = isManager || isHR || isFrontDesk;
  if (canSeeApts && typeof db !== 'undefined') {
    db.collection('apartmentBookings')
      .where('status', '==', 'new')
      .onSnapshot(snap => {
        const count = snap.size;
        const aptLink = document.querySelector('#sbNav a[href="/portal/apartments/"]');
        if (!aptLink) return;
        let badge = aptLink.querySelector('.sb-notif-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'sb-notif-badge';
          badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;background:#dc2626;color:#fff;border-radius:50%;width:18px;height:18px;font-size:0.6rem;font-weight:600;margin-left:auto;flex-shrink:0';
          aptLink.style.display = 'flex';
          aptLink.style.alignItems = 'center';
          aptLink.appendChild(badge);
        }
        badge.textContent  = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      }, () => {});
  }

  const switchBtn = document.querySelector('.sb-foot a[onclick]');
  if (switchBtn) switchBtn.style.display = (isManager || isHR) ? '' : 'none';

  // Always fetch live Firestore data once per page load so nav reflects real access level
  if (!_navFetched && staff && staff.id && typeof db !== 'undefined') {
    _navFetched = true;
    db.collection('staff').doc(staff.id).get().then(doc => {
      if (!doc.exists) return;
      const fresh = { id: doc.id, ...doc.data() };
      setStaff(fresh);
      const oldKey = (staff.accessLevel || staff.role || '') + '|' + (staff.department || '');
      const newKey = (fresh.accessLevel || fresh.role || '') + '|' + (fresh.department || '');
      if (oldKey !== newKey) {
        buildNav(fresh, _navActive);
        populateSidebar(fresh);
      }
    }).catch(() => {});
  }
}

/**
 * Redirect to home if the current staff member doesn't have access to a page.
 * Returns false and redirects if access is denied.
 */
function requireAccess(staff, page) {
  const _raw      = (staff.accessLevel || staff.role || 'staff').toLowerCase().replace(/\s+/g,'');
  const isCEO     = _raw === 'ceo' || _raw === 'superadmin';
  if (isCEO) return true; // CEO has unrestricted access to all pages
  const isManager = _raw === 'manager';
  const dept      = (staff.department || '').toLowerCase();
  const isHR      = _raw === 'hr' || dept === 'hr' || dept.includes('human resource');
  const rules = {
    dashboard:  isManager,
    staff:      isManager || isHR,
    attendance: isManager || isHR,
    payroll:    isManager || isHR,
    reports:    isManager || isHR,
    activity:   isManager,
    expenses:   true,
    bar:        isManager || dept === 'bar',
    kitchen:    isManager || dept === 'kitchen',
    barbing:    isManager || dept === 'salon',
    pool:       isManager || dept === 'pool',
    apartments: isManager || isHR || dept === 'front desk' || dept === 'receptionist' || dept === 'lounge' || dept === 'apartments',
    pos:        true,
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
