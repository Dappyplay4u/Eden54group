# Eden 54 — Marketing Site

Public website for **Eden 54**, a hospitality venue in Ilesa, Osun State, Nigeria —
luxury service apartments, a steakhouse & bar, a game lounge, a barbing salon, car
rental and a pool. Live at **eden54group.com**.

> **Staff portal & POS moved off this repo.** Eden 54's operations now run on the
> Edendox SaaS at **`eden54group.edendox.com/portal/`** (separate repo:
> `Dappyplay4u/edendox`). This repo is the customer-facing website only.

---

## Tech

- Hand-written static HTML/CSS/JS — one self-contained `index.html` per page, styles
  and scripts inline. No framework, no build step.
- **Hosting:** static deploy (Cloudflare Pages / Netlify style). `_redirects` and
  `_headers` control routing and cache headers.
- **Firebase (`edendox-780bc`, client SDK only — nothing is deployed from this repo):**
  the reservation form and the background-check form write into the Edendox workspace
  `companies/eden54group/…` so they appear in the staff portal. Config is inline in
  `index.html` and `background-check/index.html`; `EDX_TENANT = 'eden54group'`.
  Firestore/Storage rules for that project live in the Edendox repo.
- **Fonts:** Google Fonts (Cormorant Garamond, Marcellus, Jost).

---

## Repository layout

```
index.html                Homepage — apartments · steakhouse · game lounge
                          + the reservation form (#contact)
apartment.html            Standalone apartment page
apartments/               Apartment marketing page
apartmentandlounge/       Apartments + lounge landing (→ redirects to /)
barbing/                  Barbing salon page + booking
drinks/                   "Ruby Sunrise Juice" product landing page
games/                    Game lounge page + session booking
car-rental/               Car rental page + booking
careers/                  Careers listing
  apply/                  Job application forms (+ thank-you pages)
background-check/          Public pre-employment background-check form
                          (feeds the Edendox HR portal)
menu/ hairstyles/ drinks/ pool/ venue/ explore/ logo/   Image assets
videos/                   Marketing videos (large originals gitignored)

_redirects / _headers     Host routing + cache headers
```

---

## Reservation & background-check intake

Both public forms feed the Edendox portal (`companies/eden54group`):

| Form | Writes | Lands in |
|---|---|---|
| Reservation (`index.html` `#contact`) | `apartmentBookings` (`status:'new'`, `source:'website'`) | `/portal/apartments/` → Website Reservations |
| Background check (`background-check/`) | `backgroundChecks` (`status:'pending'`, no HR keys) + files under `intake/background-check/` | `/portal/background-check/` |

Requirements on the Edendox side (one-time, in `/admin/` and the Firebase console):
- `companies/eden54group.intake.reservations` and `.backgroundCheck` set to `true`
- **Anonymous** auth enabled on `edendox-780bc` (needed for the background-check file
  uploads)

Console helper: run `edxTestReservation()` on the live site to verify the write path.

Both forms also send an email via FormSubmit and (reservation only) a Google Form —
those are independent of Firebase.

---

## Local development

```bash
npx serve .          # or: python -m http.server 8000
```

The forms point at the live `edendox-780bc` project. On `localhost` they route to the
Firebase emulator suite (`127.0.0.1:8080/9099/9199`) if one is running — otherwise the
writes just fail quietly and the rest of the page works.

## Deploying

Static — connect the repo to Cloudflare Pages / Netlify; output directory is the repo
root. No Firebase CLI deploy from this repo.

---

## Conventions

- One page = one `index.html` with inline `<style>` and `<script>`.
- Colour palette and fonts are defined as CSS variables at the top of each page.
- Large apartment videos are gitignored (host size limits).
