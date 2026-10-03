# Robin's Bobins

Our family's little learning world, with Robin the whippet.
**One family space → three children → many small learning tools.**

The platform handles who is practising, navigation, Robin, one coin balance per child, streaks, the parent area and backups. Each app in `apps/` teaches one thing well:

- **Diktat Trainer** (`apps/diktat/`) — German dictation, for Lukas.
- **Europa-Trainer** (own repo: [europa-trainer](https://github.com/ChrisMDooley/europa-trainer)) — European countries, capitals, seas, rivers, mountains, borders for Lukas's Europa-Arbeit; geography and spelling tracked separately; earns Robin-Münzen.
- **Bruch-Bobins** (own repo: [bruch-bobins](https://github.com/ChrisMDooley/bruch-bobins)) — fractions for Lukas (Klasse 6): Bruch als Anteil, echte/unechte Brüche, gemischte Zahlen, Bruch als Division, gerecht verteilen, Größen; earns Robin-Münzen.
- **Guests** (a classmate): own start page `gast/?name=<Name>` without the family PIN or family data — see `docs/NEW-APP.md` → Guests.
- **Deutschland & Hessen** (`apps/geo/`) — Sachunterricht Klasse 4: Bundesländer, Hauptstädte, Wappen, Nachbarländer, Hessen (Städte, Flüsse, Gebirge, with Wehrheim as home anchor), Kartenkunde. For Alex. See [`apps/geo/README.md`](apps/geo/README.md).

## Running it

- **Locally:** `python3 -m http.server` in this folder, then open http://localhost:8000. (Double-clicking `index.html` works too in Chrome; Safari keeps `file://` storage per file, so use a server there.)
- **As an app with its own icon:** push to GitHub and enable Pages (Settings → Pages → branch `main`, folder `/`). Then *Safari → File → Add to Dock*, *Share → Add to Home Screen* on iPad/iPhone, or Chrome's install icon.
- **Tests:** `python3 tests/platform_e2e.py` (whole flow in headless Chromium). Diktat's own tests: `cd apps/diktat && node tests/compare.test.js && python3 tests/e2e_test.py`. Geo: `node apps/geo/tests/logic.test.js && python3 tests/geo_e2e.py`.

## Privacy

**Family PIN:** every page (platform and apps) opens behind a family PIN screen (`shared/rb.js`). Only a salted SHA-256 hash is in the code; once entered, a device stays unlocked until *Elternbereich → Dieses Gerät abmelden*. To change the PIN, replace `GATE_HASH` (and ideally `GATE_SALT`) in `shared/rb.js`. This is a door, not a safe: the site and repo are public, so anything written in the code (e.g. children's names) can still be read there.

Local-first: everything stays in the browser on the device. No accounts, analytics, trackers, ads or third-party requests (fonts are bundled). Backups: *Eltern → Sicherung herunterladen*.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it fits together, data model, decisions
- [`docs/NEW-APP.md`](docs/NEW-APP.md) — making the next app

## Roadmap

- **Milestone 1 (done):** branding and Robin, child picker, child homes, per-child apps, Diktat integrated, shared coin ledger and activity log, parent PIN, full backup, PWA.
- **Milestone 2:** Robin's Shop (parent-defined rewards, redemption with PIN), coin corrections, practice goals, per-app stats in Elternbereich, editing children's names/colours/avatars, Diktat's parent settings behind the platform PIN.
- **Second app (done):** Deutschland & Hessen for Alex.
- **Later:** optional sync between devices, real pictures of Robin.
