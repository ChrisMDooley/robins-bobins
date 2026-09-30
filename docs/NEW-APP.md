# Making a new Robin's Bobins app

"Let's make another Robin's Bobins app for X" — here is the whole checklist.

1. **Copy the template:** `apps/_template/` → `apps/<id>/` (e.g. `apps/brueche/`).
2. **Register it** in `apps/registry.js`:
   ```js
   R.register({ id: 'brueche', title: 'Brüche', subject: 'Mathe', icon: '🍕',
                color: '#3E8A5E', path: 'apps/brueche/index.html', storagePrefix: 'rb-brueche:' });
   ```
   The `id` is stored in coin and activity records, so never rename it.
3. **Cache it offline:** add the app's files to `FILES` in the root `sw.js` and bump `VERSION`.
4. **Give it to a child:** Elternbereich → tick the app next to the child's name.
   Or add `grantTo: ['alex']` to the registry entry: the app is switched on for that child once, and
   Elternbereich decides from then on (un-ticking is respected).

## What the app gets from the platform

```js
var child = RB.requireChild();            // {id, name, color, ui}; sends to "Wer bist du?" if nobody picked
if (!child) return;

RB.nav.homeUrl(child.id)                  // link for "‹ Meine Apps" (always show one)
RB.coins.balance(child.id)                // the ONE Robin's Bobins balance
RB.coins.add(child.id, { amount: 3, reason: 'Runde geschafft', app: 'brueche' })
RB.activity.record(child.id, { app: 'brueche', kind: 'session',
                               startedAt, endedAt: Date.now(), summary: { tasks: 8 } })
RB.robin.el('happy', 96)                  // Robin: normal happy celebrating thinking encouraging sleeping coin glasses
child.ui === 'simple'                     // Liliana: bigger targets, fewer words
```

Link `../../shared/rb-theme.css` for the shared look (tokens `--rb-*`, `.rb-btn`, `.rb-coins`, `.rb-bubble`, `.bar`, `.shell`), or bring your own CSS.

## House rules

- **Own your learning data** under `storagePrefix + child.id`. Use your own structure; the platform only backs it up.
- **Reward effort, never punish.** Coins for practising, finishing, correcting, improving, keeping a streak. `RB.coins.add` refuses anything ≤ 0.
- **Record one activity per finished session** so streaks and "Übungen heute" count it.
- **Give each record an id** (`RB.uid('x')`) and never edit history in place — that keeps later multi-device sync easy.
- **Keep Robin quiet inside the app.** A short line at the start or end is plenty.
- **Show a line on the home card** (optional): a bridge global with `cardInfo(childId)` — see `apps/geo/js/rb-bridge.js`, loaded from the root `index.html`.
- **Test with a real flow** — see `tests/platform_e2e.py` for how to drive a whole session in headless Chromium.

## Apps in their own repository

A bigger app can live in its own repo and site (example: **Europa-Trainer**,
`github.com/ChrisMDooley/europa-trainer` → `chrismdooley.github.io/europa-trainer/`).
Both sites are on `chrismdooley.github.io`, so they share `localStorage` (children, coins, activity,
PIN unlock).

1. **Register it with `url`** instead of `path`:
   ```js
   R.register({ id: 'europa', title: 'Europa-Trainer', subject: 'Erdkunde', icon: '🌍', color: '#2F6DB5',
                url: '../europa-trainer/', storagePrefix: 'europa-trainer:',
                bridge: 'RBEuropa', grantTo: ['lukas'] });
   ```
   `url` is absolute or relative to the platform root; the child is passed as `?child=<id>`.
2. **In the app,** load `../robins-bobins/shared/rb.js` (and `robin.js`) *optionally* and talk to
   `RB` from one file only (Europa: `js/platform.js`). If `RB` is missing the app runs on its own.
3. **Card line (optional):** the app ships `rb-card.js`; the platform `index.html` loads it with
   `<script src="../europa-trainer/rb-card.js" onerror="this.remove()">`.
4. **Offline:** the app has its own `sw.js`; nothing goes into the platform `sw.js`.
5. **Publish order:** push and enable Pages for the app first, then push the registry change, so a
   child never sees a card pointing at a missing site.
6. The platform tests ignore a 404 for the optional card script only.
