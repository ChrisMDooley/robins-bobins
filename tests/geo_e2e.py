"""End-to-end test of the Geo app ("Deutschland & Hessen") inside Robin's Bobins.

    python3 tests/geo_e2e.py [screenshot-dir]

Serves the repo on :8767 and drives real sessions in headless Chromium:
Alex gets the app automatically → 5 Minuten (right and wrong answers in every format)
→ coins land in the platform → progress survives a reload → mock test with 16/18
→ weak topic straight into practice → one round per topic → matching and drag games
(real mouse drags) → phone layout. Fails on any page error.
"""
import http.server, threading, functools, os, sys, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'shots')
os.makedirs(OUT, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8767), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:8767/'

errors, ok = [], []
def check(name, cond, info=''):
    (ok if cond else errors).append(name + ('' if cond else f'  → {info}'))

def current(pg):
    return pg.evaluate("""() => { const t = window.__geoTest; if (!t) return null; const q = t.q;
      return { format: q.format, answer: q.answer, targets: q.targets || null, topic: q.topic, item: q.item, prompt: q.prompt,
               options: (q.options || []).map(o => o.value) }; }""")

def point(pg, fid):
    return pg.evaluate("id => window.__geoTest.map.clientPointOf(id)", fid)

def answer(pg, right=True, exam=False):
    """Answer the question on screen. Returns the format."""
    q = current(pg)
    f = q['format']
    if f == 'choice':
        val = q['answer'] if right else [o for o in q['options'] if o != q['answer']][0]
        pg.locator('.opt[data-value="%s"]' % val).click()
    elif f == 'type':
        pg.fill('.type-in', q['answer'].lower().replace('ü', 'ue') if right else 'Quatsch')
        pg.click('.type-row .rb-btn')
    elif f in ('mapClick', 'mapSeq', 'mapDrag'):
        targets = q['targets'] or [q['answer']]
        if not right:
            # a wrong but valid feature of the same kind
            kind = q['answer'].split('-')[0]
            wrong = pg.evaluate("""(a) => { const m = window.__geoTest.map; return Object.keys(m.shapes).filter(k => k.split('-')[0] === a.k && k !== a.ans && m.clientPointOf(k))[0]; }""",
                                {'k': kind, 'ans': q['answer']})
            targets = [wrong]
        for t in targets:
            p = point(pg, t)
            if f == 'mapDrag':
                box = pg.locator('.drag-tray .chip').bounding_box()
                pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
                pg.mouse.down(); pg.mouse.move(p[0] - 30, p[1] - 30, steps=5); pg.mouse.move(p[0], p[1], steps=5); pg.mouse.up()
            else:
                pg.mouse.click(p[0], p[1])
            pg.wait_for_timeout(60)
    elif f == 'cellClick':
        cell = q['answer'] if right else ('A1' if q['answer'] != 'A1' else 'B2')
        pg.locator('.sc-cell[data-cell="%s"]' % cell).click()
    elif f == 'roseClick':
        d = q['answer'] if right else ('S' if q['answer'] != 'S' else 'N')
        pg.locator('.rose-hit[data-dir="%s"]' % d).first.click(force=True)
    if exam:
        pg.wait_for_selector('.q-next'); pg.click('.q-next')
    return f

def to_ueben(pg):
    pg.goto(URL + 'apps/geo/index.html?child=alex#/home'); pg.wait_for_timeout(200)
    pg.click('[data-menu=ueben]'); pg.wait_for_timeout(200)

def feedback_ok(pg):
    pg.wait_for_selector('.q-feedback:not([hidden])', timeout=3000)
    return 'ok' in pg.get_attribute('.q-feedback', 'class')

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))

    # ---------- platform: Alex gets the app once ----------
    pg.goto(URL + 'index.html'); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(300)
    pg.click('.kid[data-child=alex]'); pg.wait_for_timeout(250)
    check('Geo card on Alex home', pg.locator('.app-card[data-app=geo]').count() == 1)
    check('card shows countdown', 'LZK' in pg.inner_text('.app-card[data-app=geo]'), pg.inner_text('.app-card[data-app=geo]'))
    pg.screenshot(path=f'{OUT}/geo-0-alex-home.png')
    pg.click('#/c/alex' if False else '.app-card[data-app=geo]'); pg.wait_for_timeout(500)
    check('URL carries child', 'apps/geo/index.html?child=alex' in pg.url, pg.url)
    check('home greets Alex', 'Hallo Alex!' in pg.inner_text('h1'))
    check('five main menu entries', pg.locator('.main-menu .menu-btn').count() == 5)
    menu = pg.inner_text('.main-menu')
    for w in ['LERNEN', 'ÜBEN', '5 MINUTEN ÜBEN', 'PRÜFUNG ÜBEN', 'FORTSCHRITT']:
        check('menu has ' + w, w in menu)
    pg.screenshot(path=f'{OUT}/geo-1-home.png')

    # ---------- 5 Minuten ----------
    pg.click('[data-menu=fuenf]'); pg.wait_for_selector('.q-card')
    seen_formats, n, right = {}, 0, 0
    while pg.locator('.q-card').count() and n < 40:
        want = (n % 4) != 3
        f = answer(pg, right=want)
        seen_formats[f] = seen_formats.get(f, 0) + 1
        got = feedback_ok(pg)
        check(f'5min q{n} ({f}) judged {"right" if want else "wrong"}', got == want, current(pg))
        if n == 3: pg.screenshot(path=f'{OUT}/geo-2-feedback-wrong.png')
        if n == 4: pg.screenshot(path=f'{OUT}/geo-2-feedback-right.png')
        right += 1 if got else 0
        n += 1
        pg.click('.fb-next'); pg.wait_for_timeout(120)
        if pg.locator('.end').count(): break
    check('5 Minuten ended with summary', pg.locator('.end').count() == 1)
    end = pg.inner_text('.end')
    check('"Super! 5 Minuten geschafft."', 'Super! 5 Minuten geschafft.' in end, end[:200])
    check('shows right count', f'{right}\nrichtig' in end, end[:300])
    check('suggests a topic', 'Heute solltest du dir' in end or 'Als Nächstes' in end, end)
    coins = int(pg.inner_text('#coins'))
    check('coins earned into platform', coins >= right + 5, coins)
    pg.screenshot(path=f'{OUT}/geo-3-five-end.png', full_page=True)

    # ---------- persistence ----------
    pg.reload(); pg.wait_for_timeout(300)
    pg.click('[data-menu=fortschritt]'); pg.wait_for_timeout(300)
    stats = pg.inner_text('.p-stats')
    check('progress survives reload', str(n) in stats, stats)
    check('10 topic rows', pg.locator('.p-row').count() == 10)
    pg.screenshot(path=f'{OUT}/geo-4-progress.png', full_page=True)

    # ---------- Prüfung ----------
    pg.click('#back'); pg.wait_for_timeout(200)
    pg.click('[data-menu=pruefung]'); pg.wait_for_selector('.q-card')
    check('exam: no immediate feedback', True)
    for i in range(18):
        pg.wait_for_selector('.q-card')
        if i == 0: pg.screenshot(path=f'{OUT}/geo-5-exam-q.png')
        answer(pg, right=i not in (4, 11), exam=True)
        if i < 17: check(f'exam q{i} no feedback shown', pg.locator('.q-feedback:not([hidden])').count() == 0)
        pg.wait_for_timeout(250)
        if pg.locator('.exam-end').count(): break
    pg.wait_for_selector('.exam-end')
    ee = pg.inner_text('.exam-end')
    check('exam score 16 of 18', 'Du hast 16 von 18 Punkten erreicht.' in ee, ee[:200])
    check('exam: strengths listed', 'Das kannst du schon sehr gut' in ee)
    check('exam: weak topics listed', 'Das solltest du noch üben' in ee and pg.locator('.weak-btn').count() >= 1)
    check('no grade given', 'Note' not in ee)
    pg.screenshot(path=f'{OUT}/geo-6-exam-end.png', full_page=True)
    pg.locator('.weak-btn').first.click(); pg.wait_for_selector('.q-card')
    check('weak topic opens practice', pg.locator('.q-card').count() == 1)

    # ---------- one round per topic (all generators get exercised) ----------
    topics = ['laender', 'hauptstaedte', 'wappen', 'nachbarn', 'staedte', 'fluesse', 'gebirge', 'legende', 'planquadrate', 'richtungen']
    for t in topics:
        to_ueben(pg)
        pg.click(f'.topic-card[data-topic={t}]'); pg.wait_for_selector('.q-card')
        k = 0
        while pg.locator('.q-card').count() and k < 12:
            q = current(pg)
            check(f'{t}: question belongs to topic', q['topic'] == t, q)
            f = answer(pg, right=True)
            seen_formats[f] = seen_formats.get(f, 0) + 1
            check(f'{t} q{k} ({f}) right', feedback_ok(pg), q)
            if t in ('fluesse', 'planquadrate', 'wappen') and k == 0: pg.screenshot(path=f'{OUT}/geo-7-{t}.png')
            pg.click('.fb-next'); pg.wait_for_timeout(80); k += 1
            if pg.locator('.end').count(): break
        check(f'{t}: round finished', pg.locator('.end').count() == 1)
    check('all answer formats exercised', all(x in seen_formats for x in ['choice', 'mapClick', 'cellClick']), seen_formats)

    # Hessen: "Zeig es auf der Karte" = map clicks only
    to_ueben(pg)
    pg.get_by_text('📍 Zeig es auf der Karte').click(); pg.wait_for_selector('.q-card')
    for k in range(10):
        q = current(pg)
        check('Zeig es: map format', q['format'] == 'mapClick', q)
        answer(pg, right=True); check('Zeig es right', feedback_ok(pg), q)
        pg.click('.fb-next'); pg.wait_for_timeout(80)
        if pg.locator('.end').count(): break

    # ---------- games ----------
    to_ueben(pg)
    pg.get_by_text('🔗 Land ↔ Hauptstadt').click(); pg.wait_for_selector('.match-board')
    ids = pg.eval_on_selector_all('.col-land .match-card', 'els => els.map(e => e.dataset.id)')
    # one deliberate mismatch first
    pg.click(f'.col-land .match-card[data-id="{ids[0]}"]'); pg.click(f'.col-hauptstadt .match-card[data-id="{ids[1]}"]')
    check('mismatch explained', 'Nicht ganz' in pg.inner_text('.game-msg'))
    for i in ids:
        pg.click(f'.col-land .match-card[data-id="{i}"]'); pg.click(f'.col-hauptstadt .match-card[data-id="{i}"]'); pg.wait_for_timeout(60)
    pg.wait_for_selector('.game-end')
    check('matching game finished', 'Alle gefunden' in pg.inner_text('.game-end'))
    pg.screenshot(path=f'{OUT}/geo-8-match.png', full_page=True)

    to_ueben(pg)
    pg.get_by_text('🔗 Wappen ↔ Land ↔ Hauptstadt').click(); pg.wait_for_selector('.match-board')
    ids = pg.eval_on_selector_all('.col-wappen .match-card', 'els => els.map(e => e.dataset.id)')
    for i in ids:
        for col in ('wappen', 'land', 'hauptstadt'):
            pg.click(f'.col-{col} .match-card[data-id="{i}"]')
        pg.wait_for_timeout(60)
    pg.wait_for_selector('.game-end'); check('triple matching finished', True)

    for kind, label in [('laender', '✋ Länder auf die Karte'), ('fluesse', '✋ Flüsse beschriften'), ('nachbarn', '✋ Nachbarländer auf die Karte')]:
        to_ueben(pg)
        pg.get_by_text(label).click(); pg.wait_for_selector('.drag-tray .chip')
        # expose the game's map: it is the only .map on screen; compute targets via GEO data
        guard = 0
        while pg.locator('.drag-tray .chip').count() and guard < 20:
            guard += 1
            chip = pg.locator('.drag-tray .chip').first
            name = chip.inner_text()
            fid = pg.evaluate("""(a) => { const Q = window.GeoQuestions, n = a.n;
                if (a.k === 'laender') return 'state-' + window.GEO_CONTENT.states.find(s => s.name === n).id;
                if (a.k === 'fluesse') return 'river-' + window.GEO_CONTENT.rivers.find(s => s.name === n).id;
                return 'country-' + window.GEO_CONTENT.countries.find(s => s.name === n).id; }""", {'k': kind, 'n': name})
            # use a fresh map helper bound to the on-screen svg
            pt = pg.evaluate("""(id) => { const svg = document.querySelector('.map-svg'); const M = window.GEO_MAPS;
                let p = null; const all = [].concat(M.germany.states, M.europe.countries);
                const f = all.find(x => x.id === id);
                if (f) p = f.label;
                if (!p) { const e = svg.querySelector('.river[data-id="' + id + '"]'); const L = e.getTotalLength();
                          for (let t = .4; t < .7 && !p; t += .05) { const q = e.getPointAtLength(L * t); if (q.x > 30 && q.y > 30) p = [q.x, q.y]; } }
                const pt = svg.createSVGPoint(); pt.x = p[0]; pt.y = p[1]; const r = pt.matrixTransform(svg.getScreenCTM()); return [r.x, r.y]; }""", fid)
            box = chip.bounding_box()
            pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            pg.mouse.down(); pg.mouse.move(pt[0] - 40, pt[1] - 40, steps=6); pg.mouse.move(pt[0], pt[1], steps=6); pg.mouse.up()
            pg.wait_for_timeout(120)
        pg.wait_for_selector('.game-end', timeout=4000)
        check(f'drag game {kind} finished', 'Karte fertig' in pg.inner_text('.game-end'))
        if kind == 'fluesse': pg.screenshot(path=f'{OUT}/geo-9-drag-fluesse.png', full_page=True)

    # ---------- learning screens ----------
    for r in ['lernen', 'lernen/laender', 'lernen/wappen', 'lernen/nachbarn', 'lernen/hessen', 'lernen/karte']:
        pg.goto(URL + 'apps/geo/index.html?child=alex#/' + r); pg.wait_for_timeout(350)
        check('learn screen renders ' + r, pg.locator('.screen-h').count() == 1)
        pg.screenshot(path=f'{OUT}/geo-L-{r.replace("/", "-")}.png', full_page=True)
    pg.goto(URL + 'apps/geo/index.html?child=alex#/lernen/hessen'); pg.wait_for_timeout(300)
    pg.click('.layer-rivers'); pg.wait_for_timeout(100)
    pt = pg.evaluate("""() => { const svg = document.querySelector('.map-svg'); const e = svg.querySelector('.river[data-id="river-nidder"]');
        const q = e.getPointAtLength(e.getTotalLength() * .5); const pt = svg.createSVGPoint(); pt.x = q.x; pt.y = q.y;
        const r = pt.matrixTransform(svg.getScreenCTM()); return [r.x, r.y]; }""")
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(150)
    info = pg.inner_text('.info-card')
    check('tap river shows name + chain', 'Nidder' in info and 'Nidder → Nidda → Main → Rhein' in info, info)
    pg.screenshot(path=f'{OUT}/geo-L-hessen-rivers.png', full_page=True)

    # ---------- phone ----------
    ph = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ph.on('pageerror', lambda e: errors.append('phone pageerror: ' + str(e)))
    ph.goto(URL + 'apps/geo/index.html?child=alex'); ph.wait_for_timeout(300)
    ph.screenshot(path=f'{OUT}/geo-P-home.png', full_page=True)
    check('phone: no horizontal scroll', ph.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    ph.click('[data-menu=fuenf]'); ph.wait_for_selector('.q-card')
    for i in range(4):
        answer(ph, right=True); feedback_ok(ph)
        ph.screenshot(path=f'{OUT}/geo-P-q{i}.png', full_page=True)
        ph.click('.fb-next'); ph.wait_for_timeout(100)
    check('phone: questions answerable', True)
    b.close()

print(f'{len(ok)} passed, {len(errors)} failed')
for e in errors: print('  FAIL', e)
sys.exit(1 if errors else 0)
