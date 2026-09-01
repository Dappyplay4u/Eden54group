# Eden 54 Group

Website and staff operations portal for **Eden 54** — luxury service apartments, a steakhouse & bar, a game lounge, a barbing salon, car rental and a pool, located in Ilesa, Osun State, Nigeria.

The repository is a single static site (no build step) with a Firebase backend. It has two halves:

| Area | Path | Audience |
|------|------|----------|
| Public marketing site | `/` and top-level folders | Guests / customers |
| Staff portal (PWA) | `/portal/` | Eden 54 staff |

---

## Tech stack

- **Frontend:** hand-written HTML/CSS/JS. Each page is a self-contained `index.html` (styles and scripts inline). No framework, no bundler.
- **Backend:** [Firebase](https://firebase.google.com/) project `eden54`
  - **Firestore** — all data (staff, sales, tabs, bookings, expenses, attendance, …)
  - **Firebase Auth** — staff login (Email/Password; synthetic emails, see below)
  - **Cloud Functions** (`functions/`, Node 20) — push notification on tab-ready
  - **Cloud Messaging (FCM)** — push notifications to the POS terminal
- **Hosting:** static deploy (Cloudflare Pages / Netlify style). `_redirects` and `_headers` control routing and caching.
- **Offline / installable:** service workers (`sw.js`, `firebase-messaging-sw.js`) + `manifest.json` make the portal an installable PWA with offline persistence.
- **Fonts:** Google Fonts (Cormorant Garamond, Marcellus, Jost).

---

## Repository layout

```
index.html                Public homepage (apartments · steakhouse · games)
apartments/               Apartment marketing page
apartmentandlounge/       Apartments + lounge landing
barbing/                  Barbing salon page + booking form
drinks/                   "Ruby Sunrise Juice" product landing page
games/                    Game lounge page + session booking
car-rental/               Car rental page + booking
careers/                  Careers listing
  apply/                  Job application forms (+ thank-you pages)
background-check/          Public pre-employment background-check form
menu/ hairstyles/ drinks/ pool/ venue/ explore/ cars/ birthday/ logo/   Image assets
videos/                   Marketing videos (large originals are gitignored)

portal/                   Staff portal (PWA)
  index.html              Login (staff picker + password)
  firebase-init.js        Shared Firebase config, auth/session, sidebar nav, helpers
  portal.css              Shared portal styles
  home/ updates/ dashboard/ activity/
  sales/ reports/ occupancy/
  bar/ bar/reconciliation/ procurement/
  kitchen/ barbing/ pool/
  pos/ tabs/ payment-log/ open-tabs/
  attendance/ payroll/ expenses/ customers/ background-check/
  staff/ training/ sops/ apartments/

functions/                Firebase Cloud Functions
firestore.rules           Firestore security rules
firebase.json / .firebaserc   Firebase project config
_redirects / _headers     Host routing + cache headers
manifest.json             PWA manifest
sw.js                     Portal service worker (offline caching)
firebase-messaging-sw.js  FCM background push handler
```

---

## The staff portal

### Authentication

Staff sign in with a **username + password**, not an email. Firebase Auth requires an
email, so a synthetic one is used: `{username}@eden54.pos`. HR only ever works with
usernames. On every login `portal/index.html` writes a `staffByAuth/{uid}` document
(`{ staffId, accessLevel, department, active }`) which the Firestore rules read to
resolve the user's role.

Session is cached in `localStorage` (`eden54_staff`) with a 14-hour timeout; role is
re-verified against Firestore on each page load and cached for 1 hour.

### Role-based access

`buildNav()` / `requireAccess()` in `portal/firebase-init.js` build the sidebar and
gate each page by **access level** (`ceo` / `superadmin` / `manager` / `hr`) and
**department** (bar, games, kitchen, front desk, salon, housekeeping, …). Examples:

- **Manager / CEO** — everything, plus menu management in the POS
- **HR** — staff, attendance, payroll, reports, procurement, background checks
- **Bar / Lounge / Games** — Bar Stock, Table Tabs, POS
- **Front Desk / Receptionist** — Apartments, POS
- **Salon** — POS only
- All staff — My Home, Updates, SOPs, Training, Expenses, own reports

### POS & Table Tabs

- **POS Terminal** (`portal/pos/`) — sells games time, food, drinks, apartment nights
  and events. Menu/prices come from Firestore (`menuItems`, `gamePrices`, `aptRates`).
  Category tabs shown depend on the operator's department.
- **Table Tabs** (`portal/tabs/`) — lounge/bar staff open a tab per table, add items
  during service, then send it to the POS for payment. When a tab flips to
  `awaiting-pos`, the `notifyPOSOnTabReady` Cloud Function pushes a notification to
  every registered POS device.

### Other modules

Game session timers & time-based pricing, PIN lock for reductions/voids, bar stock
lead system and reconciliation reports, procurement with received status, Quick Pay
cash tracking, Payment Collection Log, Open Tabs overview, attendance with
geofenced clock-in, payroll, daily expenses, apartment rentals + website booking
notifications, staff management, training module, SOPs, and an append-only audit log.

---

## Firestore collections (main)

`staff`, `staffByAuth`, `sales`, `tabs`, `menuItems`, `gamePrices`, `aptRates`,
`apartmentBookings`, `expenses`, `attendance` / clockings, `payroll`,
`barbing_reports`, `bar_reports`, `kitchen_reports`, `pool_reports`, `procurement`,
`backgroundChecks`, `notices` / updates, `fcmTokens`, `auditLog`.

Rules live in `firestore.rules` — most collections require an authenticated staff
session; `staff` is publicly readable (login page photo picker) and
`apartmentBookings` is publicly creatable (guest booking form).

---

## Local development

Everything is static, so serve the folder with any static server:

```bash
# from the repo root
npx serve .
#   or
python -m http.server 8000
```

Open `http://localhost:8000/` for the public site or `http://localhost:8000/portal/`
for the portal. The portal talks to the **live** Firebase project `eden54` — there is
no local emulator setup, so be mindful that writes hit production data.

> The `_redirects` rule maps `/portal/*` to `/portal/:splat`; with a plain static
> server you may need to include the trailing `index.html` in URLs.

### Cloud Functions

```bash
cd functions
npm install
npm run deploy          # firebase deploy --only functions
```

### Deploying

- **Static site:** push to the deployment branch / connect the repo to Cloudflare
  Pages or Netlify. Output directory is the repo root.
- **Firestore rules:** `firebase deploy --only firestore:rules`
- **Functions:** `firebase deploy --only functions`

---

## Configuration notes

- Firebase web config is in `portal/firebase-init.js` and `firebase-messaging-sw.js`
  (public API key — safe to expose; access is controlled by Firestore rules).
- **FCM push** needs a VAPID key: set `VAPID_KEY` in `portal/pos/index.html`
  (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates).
  Until set, push registration is skipped silently.
- Facility geofence for attendance clock-in: `FACILITY` coords and
  `CLOCK_RADIUS_METERS` in `portal/firebase-init.js`.
- **Resetting a POS password** must be done from Firebase Console → Authentication
  (client-side re-creation fails with `auth/email-already-in-use`).
- Large apartment videos are intentionally gitignored (host size limits).

---

## Conventions

- One page = one `index.html` with inline `<style>` and `<script>`.
- Shared portal logic goes in `portal/firebase-init.js`; shared styles in
  `portal/portal.css`.
- Always HTML-escape interpolated values with `esc()` before `innerHTML`.
- Currency is Nigerian Naira — format with `fmtNaira()`.
- Bump the `CACHE` / `CACHE_VER` string in the service workers when shipping changes
  that must invalidate cached assets.
