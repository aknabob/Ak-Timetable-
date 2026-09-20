# Akeem's Timetable Generator (multi-page)

School timetable · Exam/CA · Personal reading/study plan.

This is the **split-page** version. Keep your **old single-file repo** as it is; use a **new repository** for this version.

## Pages

| File | Purpose |
|------|---------|
| `index.html` | School / Class / Teacher / Side by Side |
| `exam.html` | Exam / CA |
| `study.html` | Personal Reading / Study |
| `css/app.css` | Styles |
| `js/app.js` | App logic |
| `manifest.json` | Chrome / PWA install |
| `sw.js` | Offline + install support |

## Create a new GitHub repo

1. GitHub → **New repository** (example: `akeem-timetable-app`).
2. Do **not** overwrite your old `Aktimetable` repo.
3. Upload these files (from this package):
   - `index.html`, `exam.html`, `study.html`
   - `css/app.css`, `js/app.js`
   - `manifest.json`, `sw.js`, `README.md`
4. Copy **icons** from the old repo into the **root** of the new repo:
   - `icon-192x192.png`, `icon-512x512.png`
   - `icon-192x192-maskable.png`, `icon-512x512-maskable.png`
   - `icon-180x180.png`
5. **Do not** upload `timetable.html` here (that stays in the old repo).
6. Settings → **Pages** → Deploy from branch `main` → folder `/ (root)`.
7. Open: `https://YOUR_USERNAME.github.io/akeem-timetable-app/`

## Install on Chrome

1. Open the new site in **Chrome**.
2. Menu → **Install app** / **Add to Home screen**.
3. You should see your app icon (not a generic letter).

If Install is missing: hard-refresh, check icons are not 404, confirm `manifest.json` and `sw.js` are in the repo root.

## Old repo vs new repo

| | Old repo | New repo |
|--|----------|----------|
| Files | Single `index.html` / timetable | Multi-page split |
| Chrome install | Yes (if PWA set) | Yes |
| Your data | Saved for that URL | Separate for the new URL |

To move data: **Export JSON** on the old site → **Import** on the new site.

## Author

Olaniyan Akeem
