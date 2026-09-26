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
