# Robin's Bobins

Our family's little learning world, with Robin the whippet.
**One family space → three children → many small learning tools.**

The platform handles who is practising, navigation, Robin, one coin balance per child, streaks, the parent area and backups. Each app in `apps/` teaches one thing well. The first one is the **Diktat Trainer**.

## Running it

- **Locally:** `python3 -m http.server` in this folder, then open http://localhost:8000. (Double-clicking `index.html` works too in Chrome; Safari keeps `file://` storage per file, so use a server there.)
- **As an app with its own icon:** push to GitHub and enable Pages (Settings → Pages → branch `main`, folder `/`). Then *Safari → File → Add to Dock*, *Share → Add to Home Screen* on iPad/iPhone, or Chrome's install icon.
- **Tests:** `python3 tests/platform_e2e.py` (whole flow in headless Chromium). Diktat's own tests: `cd apps/diktat && node tests/compare.test.js && python3 tests/e2e_test.py`.

## Privacy

Local-first: everything stays in the browser on the device. No accounts, analytics, trackers, ads or third-party requests (fonts are bundled). Backups: *Eltern → Sicherung herunterladen*.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it fits together, data model, decisions
- [`docs/NEW-APP.md`](docs/NEW-APP.md) — making the next app

## Roadmap

- **Milestone 1 (done):** branding and Robin, child picker, child homes, per-child apps, Diktat integrated, shared coin ledger and activity log, parent PIN, full backup, PWA.
- **Milestone 2:** Robin's Shop (parent-defined rewards, redemption with PIN), coin corrections, practice goals, per-app stats in Elternbereich, editing children's names/colours/avatars, Diktat's parent settings behind the platform PIN.
- **Later:** second learning app, optional sync between devices, real pictures of Robin.
