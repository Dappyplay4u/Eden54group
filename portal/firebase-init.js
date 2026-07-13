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

// Enable offline persistence so the app survives brief connectivity loss
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  // failed-precondition: multiple tabs open (only one can hold persistence at a time)
  // unimplemented: browser doesn't support IndexedDB (e.g. private mode on some browsers)
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.warn('Firestore persistence error:', err);
  }
});

let storage = null;
try { storage = firebase.storage(); } catch(e) {}

/* ── Identity ── */
const SESSION_TIMEOUT_MS = 14 * 60 * 60 * 1000; // 14 hours

function getStaff() {
  try {
    const s = localStorage.getItem('eden54_staff');
    if (!s) {
      sessionStorage.setItem('eden54_redirect', window.location.href);
      window.location.href = '/portal/';
      return null;
    }
    // Auto-logout after 14 hours of inactivity
    const loginAt = parseInt(localStorage.getItem('eden54_login_at') || '0', 10);
    if (loginAt && Date.now() - loginAt > SESSION_TIMEOUT_MS) {
      localStorage.removeItem('eden54_staff');
      localStorage.removeItem('eden54_login_at');
      sessionStorage.setItem('eden54_redirect', window.location.href);
      window.location.href = '/portal/?expired=1';
      return null;
    }
    // Stamp loginAt for sessions that pre-date this feature
    if (!loginAt) localStorage.setItem('eden54_login_at', Date.now());

    // Background: verify Firebase Auth session is still alive.
    // Fires once when Firebase initialises from its local cache (near-instant).
    // Guards against: revoked sessions, password changes, manual token expiry.
    // Ignores errors so offline staff aren't kicked out on a bad network.
    firebase.auth().onAuthStateChanged(function(user) {
      if (!localStorage.getItem('eden54_staff')) return; // already signed out — skip
      if (!user) {
        localStorage.removeItem('eden54_staff');
        localStorage.removeItem('eden54_login_at');
        window.location.href = '/portal/?expired=1';
      }
    }, function() {});

    return JSON.parse(s);
  } catch(e) {
    sessionStorage.setItem('eden54_redirect', window.location.href);
    window.location.href = '/portal/';
    return null;
  }
}
function setStaff(data) { localStorage.setItem('eden54_staff', JSON.stringify(data)); }
function switchProfile() {
  localStorage.removeItem('eden54_staff');
  localStorage.removeItem('eden54_login_at');
  try { firebase.auth().signOut(); } catch(e) {}
  window.location.href = '/portal/';
}

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
  const isManager = isCEO || _raw === 'manager' || _raw.includes('manager');
  const dept      = (staff.department || '').toLowerCase();
  const isHR      = !isManager && (_raw === 'hr' || dept === 'hr' || dept.includes('human resource'));
  const isFrontDesk = dept === 'front desk' || dept === 'receptionist' || dept === 'lounge' || dept === 'apartments';

  const canReport = {
    sales:      true,
    bar:        isManager || dept === 'bar',
    kitchen:    isManager || dept === 'kitchen',
    barbing:    isManager,   // salon staff use POS — only managers submit barbing reports
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
    html += a('/portal/attendance/',        '👥', 'Attendance',        'attendance');
    html += a('/portal/payroll/',           '💵', 'Payroll',            'payroll');
    html += a('/portal/activity/',          '🕵️', 'Staff Activity',     'activity');
    html += a('/portal/expenses/',          '🧾', 'Expenses',           'expenses');
    html += a('/portal/background-check/', '🔍', 'Background Checks',  'background-check');
    html += sec('Admin');
    html += a('/portal/staff/',      '👤', 'Manage Staff',   'staff');
    html += sec('Apartments');
    html += a('/portal/apartments/', '🏨', 'Apartment Rentals', 'apartments');
  } else if (isHR) {
    html += sec('Reports');
    html += a('/portal/reports/',    '📋', 'All Reports',    'reports');
    html += sec('HR');
    html += a('/portal/attendance/',        '👥', 'Attendance',        'attendance');
    html += a('/portal/payroll/',           '💵', 'Payroll',            'payroll');
    html += a('/portal/expenses/',          '🧾', 'Expenses',           'expenses');
    html += a('/portal/background-check/', '🔍', 'Background Checks',  'background-check');
    html += sec('Admin');
    html += a('/portal/staff/',             '👤', 'Manage Staff',       'staff');
    html += sec('Apartments');
    html += a('/portal/apartments/', '🏨', 'Apartment Rentals', 'apartments');
  } else {
    const reportLinks = [
      canReport.sales      && a('/portal/sales/',      '📋', 'Report',      'sales'),
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
  const isTabsStaff = isManager || dept.includes('bar') || dept.includes('bartend') || dept.includes('lounge');
  if (isPOSStaff) {
    html += sec('POS');
    html += a('/portal/pos/', '🖥️', 'POS Terminal', 'pos');
    if (isTabsStaff) html += a('/portal/tabs/', '🍽️', 'Table Tabs', 'tabs');
  }

  const nav = document.getElementById('sbNav');
  if (nav) nav.innerHTML = html;

  // Booking popup notification bell for manager/CEO/HR
  if (!document.getElementById('aptNotifBtn')) initBookingNotifications(staff);

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
  if (switchBtn) {
    switchBtn.innerHTML = '<i class="sb-icon">🚪</i> Sign Out';
    switchBtn.style.display = '';
  }

  // Always fetch live Firestore data once per page load so nav reflects real access level
  if (!_navFetched && staff && staff.id && typeof db !== 'undefined') {
    _navFetched = true;
    db.collection('staff').doc(staff.id).get().then(doc => {
      // Staff deleted or deactivated — end the session immediately
      if (!doc.exists || doc.data().active === false) {
        firebase.auth().signOut().catch(() => {});
        localStorage.removeItem('eden54_staff');
        localStorage.removeItem('eden54_login_at');
        window.location.href = '/portal/';
        return;
      }
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
  const isManager = _raw === 'manager' || _raw.includes('manager');
  const dept      = (staff.department || '').toLowerCase();
  const isHR      = _raw === 'hr' || dept === 'hr' || dept.includes('human resource');
  const rules = {
    dashboard:          isManager,
    staff:              isManager || isHR,
    attendance:         isManager || isHR,
    payroll:            isManager || isHR,
    reports:            isManager || isHR,
    activity:           isManager,
    'background-check': isManager || isHR,
    expenses:   true,
    bar:        isManager || dept === 'bar',
    kitchen:    isManager || dept === 'kitchen',
    barbing:    isManager,   // salon staff use POS only
    pool:       isManager || dept === 'pool',
    apartments: isManager || isHR || dept === 'front desk' || dept === 'receptionist' || dept === 'lounge' || dept === 'apartments',
    tabs:       isManager || dept.includes('bar') || dept.includes('bartend') || dept.includes('lounge'),
    pos:        true,
    sales:      true,
    home:       true,
    updates:    true,
  };
  // Deny-by-default: unknown page key or explicit false both redirect
  if (!rules[page]) {
    window.location.href = '/portal/home/';
    return false;
  }
  return true;
}

/* ── Apartment booking notifications (portal + POS) ── */
function initBookingNotifications(staff) {
  const _raw = (staff.accessLevel || staff.role || '').toLowerCase().replace(/\s+/g,'');
  const isCEO     = _raw === 'ceo' || _raw === 'superadmin';
  const isManager = isCEO || _raw === 'manager';
  const dept      = (staff.department || '').toLowerCase();
  const isHR      = _raw === 'hr' || dept.includes('hr') || dept.includes('human resource');
  if (!isManager && !isHR) return;

  // Inject styles once
  if (!document.getElementById('aptNotifStyles')) {
    const s = document.createElement('style');
    s.id = 'aptNotifStyles';
    s.textContent = `
      #aptNotifBtn{position:relative;background:none;border:1px solid rgba(201,169,110,0.35);border-radius:6px;padding:6px 11px;cursor:pointer;font-size:1rem;color:#C9A96E;display:inline-flex;align-items:center;gap:5px;transition:background .2s;white-space:nowrap;font-family:'Jost',sans-serif;font-size:0.78rem;letter-spacing:0.04em}
      #aptNotifBtn:hover{background:rgba(201,169,110,0.1)}
      #aptNotifBadge{background:#dc2626;color:#fff;border-radius:50%;min-width:18px;height:18px;font-size:0.6rem;font-weight:600;display:none;align-items:center;justify-content:center;padding:0 3px}
      #aptNotifPanel{position:fixed;top:58px;right:16px;width:320px;max-width:calc(100vw - 32px);background:#fff;border:1px solid #e5e5e0;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:9000;display:none;overflow:hidden}
      #aptNotifPanel .np-head{padding:13px 16px;border-bottom:1px solid #e5e5e0;display:flex;align-items:center;justify-content:space-between}
      #aptNotifPanel .np-title{font-size:0.8rem;font-weight:500;color:#1a2415}
      #aptNotifPanel .np-link{font-size:0.72rem;color:#9A7A3A;text-decoration:none}
      #aptNotifPanel .np-link:hover{text-decoration:underline}
      #aptNotifPanel .np-body{max-height:300px;overflow-y:auto}
      #aptNotifPanel .np-row{padding:11px 16px;border-bottom:1px solid #f0ede8;display:flex;gap:10px;align-items:flex-start}
      #aptNotifPanel .np-row:last-child{border-bottom:none}
      #aptNotifPanel .np-dot{width:8px;height:8px;border-radius:50%;background:#dc2626;margin-top:5px;flex-shrink:0}
      #aptNotifPanel .np-name{font-size:0.82rem;font-weight:400;color:#1a2415}
      #aptNotifPanel .np-meta{font-size:0.7rem;color:#6a6b62;line-height:1.65;margin-top:2px}
      #aptNotifPanel .np-empty{padding:22px 16px;text-align:center;color:#6a6b62;font-size:0.8rem}
      #aptNotifToast{position:fixed;bottom:24px;right:24px;background:#1a2415;color:#C9A96E;padding:14px 18px;border-radius:8px;font-size:0.8rem;box-shadow:0 4px 20px rgba(0,0,0,.35);z-index:9999;display:none;cursor:pointer;max-width:290px;border-left:3px solid #C9A96E;line-height:1.5}
      #aptNotifToast strong{display:block;margin-bottom:3px;font-weight:500;font-size:0.85rem}
    `;
    document.head.appendChild(s);
  }

  // Bell button
  const bell = document.createElement('button');
  bell.id = 'aptNotifBtn';
  bell.title = 'Apartment Reservations';
  bell.setAttribute('aria-label', 'Apartment Reservations');
  bell.innerHTML = `🔔 Reservations <span id="aptNotifBadge"></span>`;

  // Dropdown panel
  const panel = document.createElement('div');
  panel.id = 'aptNotifPanel';
  panel.innerHTML = `
    <div class="np-head">
      <span class="np-title">🏨 New Reservations</span>
      <div style="display:flex;align-items:center;gap:10px">
        <a href="/portal/apartments/" class="np-link">View All →</a>
        <button onclick="document.getElementById('aptNotifPanel').style.display='none'" aria-label="Close notifications" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#6a6b62;line-height:1;padding:0">×</button>
      </div>
    </div>
    <div class="np-body" id="aptNotifBody"><div class="np-empty">No new reservations</div></div>`;

  // Toast
  const toast = document.createElement('div');
  toast.id = 'aptNotifToast';
  toast.onclick = () => window.location.href = '/portal/apartments/';

  document.body.appendChild(panel);
  document.body.appendChild(toast);

  // Insert bell — POS uses .hdr-btns; portal uses .topbar
  const hdrBtns = document.querySelector('.hdr-btns');
  const topbarDate = document.getElementById('topDate');
  if (hdrBtns) {
    hdrBtns.insertBefore(bell, hdrBtns.firstChild);
  } else if (topbarDate) {
    bell.style.marginLeft = 'auto';
    topbarDate.parentNode.insertBefore(bell, topbarDate);
  }

  // Toggle panel on bell click
  bell.addEventListener('click', e => {
    e.stopPropagation();
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', () => { panel.style.display = 'none'; });

  // Live listener
  let prevCount = null;
  db.collection('apartmentBookings')
    .where('status', 'in', ['new', 'confirmed'])
    .onSnapshot(snap => {
      const newCount = snap.docs.filter(d => d.data().status === 'new').length;
      const badge = document.getElementById('aptNotifBadge');
      if (badge) {
        badge.textContent = newCount;
        badge.style.display = newCount > 0 ? 'inline-flex' : 'none';
      }
      const count = snap.size;

      // Populate dropdown
      const body = document.getElementById('aptNotifBody');
      if (body) {
        if (!count) {
          body.innerHTML = '<div class="np-empty">No new reservations</div>';
        } else {
          const docs = snap.docs.map(d => ({id:d.id,...d.data()}))
            .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
          body.innerHTML = docs.map(b => `
            <div class="np-row" id="nprow-${esc(b.id)}">
              <div class="np-dot"></div>
              <div style="flex:1;min-width:0">
                <div class="np-name">${esc(b.firstName)} ${esc(b.lastName)}</div>
                <div class="np-meta">
                  🏨 ${esc(b.unit||'—')}<br>
                  📅 ${esc(b.checkin||'—')} → ${esc(b.checkout||'—')}<br>
                  👥 ${esc(String(b.guests||'—'))} guest(s) &nbsp;·&nbsp; 📱 ${esc(b.phone||'—')}
                </div>
                <div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap">
                  <a href="/portal/apartments/" style="font-size:0.68rem;color:#9A7A3A;text-decoration:underline">View</a>
                  <button onclick="npDecline('${esc(b.id)}','nprow-${esc(b.id)}','${esc(b.status||'new')}')" style="font-size:0.68rem;color:#dc2626;background:none;border:1px solid #dc2626;border-radius:4px;padding:2px 8px;cursor:pointer;font-family:inherit">✕ Delete</button>
                </div>
              </div>
            </div>`).join('');
        }
      }

      // Toast only when a truly NEW booking arrives after page load
      if (prevCount !== null && newCount > prevCount) {
        const n = newCount - prevCount;
        toast.innerHTML = `<strong>🔔 New Reservation${n>1?'s':''}</strong>${n} new apartment booking${n>1?'s':''} — tap to view.`;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 7000);
      }
      prevCount = newCount;
    }, () => {});
}

/* Called from the notification dropdown on any portal page or POS */
async function npDecline(id, rowId, status) {
  // Fetch the name fresh from Firestore — never trust data passed through onclick attributes
  let guestName = 'this guest';
  try {
    const snap = await db.collection('apartmentBookings').doc(id).get();
    if (snap.exists) {
      const d = snap.data();
      guestName = ((d.firstName||'') + ' ' + (d.lastName||'')).trim() || 'this guest';
    }
  } catch(_) {}
  const msg = status === 'confirmed'
    ? `Delete confirmed booking for ${guestName}?\n\nUse this for cancellations, refund requests, or non-payment after confirmation.`
    : `Delete reservation for ${guestName}?\n\nUse this when no payment or deposit has been made.`;
  if (!confirm(msg)) return;
  try {
    await db.collection('apartmentBookings').doc(id).delete();
    const row = document.getElementById(rowId);
    if (row) row.remove();
  } catch(e) {
    alert('Could not delete booking: ' + e.message);
  }
}

/* ── Shared utilities ── */

// HTML-escape for safe innerHTML interpolation
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Append-only audit log — records who deleted/changed what and when
function writeAuditLog(staff, action, details) {
  if (typeof db === 'undefined') return;
  db.collection('auditLog').add({
    action,
    staffId:   staff && staff.id   ? staff.id   : 'unknown',
    staffName: staff && staff.name ? staff.name : 'unknown',
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    ...details,
  }).catch(() => {});
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

// Unified sale schema helpers — works with both POS records (amount field) and
// manual/Quick-Pay records (totalSales/cashSales/transferSales/posSales fields).
// New POS writes include all fields, so the fallback only applies to legacy records.
function saleTotal(s)    { return s.totalSales    != null ? (s.totalSales    || 0) : (s.amount || 0); }
function saleCash(s)     { return s.cashSales     != null ? (s.cashSales     || 0) : (s.paymentMethod === 'cash'     ? (s.amount || 0) : 0); }
function saleTransfer(s) { return s.transferSales != null ? (s.transferSales || 0) : (s.paymentMethod === 'transfer' ? (s.amount || 0) : 0); }
function salePOS(s)      { return s.posSales      != null ? (s.posSales      || 0) : (s.paymentMethod === 'pos'      ? (s.amount || 0) : 0); }
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
