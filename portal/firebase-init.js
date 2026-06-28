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

function getStaff() {
  try {
    const s = localStorage.getItem('eden54_staff');
    if (!s) { window.location.href = '/portal/'; return null; }
    return JSON.parse(s);
  } catch(e) { window.location.href = '/portal/'; return null; }
}

function setStaff(data) {
  localStorage.setItem('eden54_staff', JSON.stringify(data));
}

function switchProfile() {
  localStorage.removeItem('eden54_staff');
  window.location.href = '/portal/';
}

function populateSidebar(staff) {
  const el = document.getElementById('sidebarUser');
  if (el) el.innerHTML = `<strong>${staff.name}</strong><span>${staff.department}</span>`;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtNaira(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function showAlert(id, msg, type = 'success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4500);
}

function avatarInitials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
