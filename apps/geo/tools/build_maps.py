"""Build the SVG map data for the Geo app (apps/geo/data/maps.js).

    python3 apps/geo/tools/build_maps.py

Inputs (all in tools/raw/, fetched once, kept so the maps can be rebuilt offline):
  ne_10m_admin1_deu.json.gz        Natural Earth 1:10m states of Germany       (public domain)
  ne_50m_admin0_europe.json.gz     Natural Earth 1:50m countries of Europe     (public domain)
  osm_hessen_areas_places.json.gz  OpenStreetMap: Hessen border, the six Mittelgebirge areas,
                                   towns and peaks                             (© OSM contributors, ODbL)
  osm_hessen_rivers.json.gz        OpenStreetMap: river centre lines in and around Hessen (ODbL)

Output: one classic script that defines window.GEO_MAPS = { germany, europe, hessen }.
Every shape keeps a stable id (state-hessen, country-polen, river-nidder, region-taunus …)
so questions, highlights and click tests can be generated from data.

The script also CHECKS the educational data in data/content.js against the geometry:
capitals must lie inside their state, Hessen towns inside Hessen (or where declared),
"river flows through town" claims must be within 2.5 km of the river line,
"town lies in mountain range" claims must be inside the range polygon.
"""
import gzip, json, math, os, re, subprocess, sys
from shapely.geometry import shape, box, LineString, MultiLineString, Point, Polygon, MultiPolygon
from shapely.ops import unary_union, polygonize, linemerge

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
RAW = os.path.join(HERE, 'raw')

def raw(name):
    with gzip.open(os.path.join(RAW, name), 'rt') as f:
        return json.load(f)

# ---------------------------------------------------------------- projection
class Proj:
    """Equirectangular with a cos(lat0) squeeze — plenty for maps of this size."""
    def __init__(self, lon_min, lon_max, lat_min, lat_max, width, lat0):
        self.k = math.cos(math.radians(lat0))
        self.lon_min, self.lat_max = lon_min, lat_max
        self.s = width / ((lon_max - lon_min) * self.k)
        self.w = width
        self.h = (lat_max - lat_min) * self.s
    def xy(self, lon, lat):
        return ((lon - self.lon_min) * self.k * self.s, (self.lat_max - lat) * self.s)
    def params(self):
        return {'lonMin': self.lon_min, 'latMax': self.lat_max, 'k': round(self.k, 6), 's': round(self.s, 4),
                'w': round(self.w), 'h': round(self.h)}

def fmt(v):
    s = ('%.1f' % v)
    return s[:-2] if s.endswith('.0') else s

def ring_path(coords, P):
    pts = [P.xy(x, y) for x, y in coords]
    out, last = [], None
    for x, y in pts:
        t = (fmt(x), fmt(y))
        if t != last: out.append(t); last = t
    if len(out) < 3: return ''
    return 'M' + 'L'.join(a + ' ' + b for a, b in out) + 'Z'

def poly_path(geom, P):
    polys = [geom] if isinstance(geom, Polygon) else list(getattr(geom, 'geoms', []))
    d = []
    for p in polys:
        if not isinstance(p, Polygon) or p.is_empty: continue
        d.append(ring_path(p.exterior.coords, P))
        for r in p.interiors: d.append(ring_path(r.coords, P))
    return ''.join(d)

def line_path(geom, P):
    lines = [geom] if isinstance(geom, LineString) else list(getattr(geom, 'geoms', []))
    d = []
    for l in lines:
        if not isinstance(l, LineString) or l.length == 0: continue
        pts = [P.xy(x, y) for x, y in l.coords]
        seg, last = [], None
        for x, y in pts:
            t = (fmt(x), fmt(y))
            if t != last: seg.append(t); last = t
        if len(seg) >= 2: d.append('M' + 'L'.join(a + ' ' + b for a, b in seg))
    return ''.join(d)

def label_point(geom, P):
    p = geom.representative_point() if not isinstance(geom, Point) else geom
    x, y = P.xy(p.x, p.y)
    return [round(x, 1), round(y, 1)]

def slug(name):
    s = name.lower()
    for a, b in (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss')):
        s = s.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

# ---------------------------------------------------------------- content (for ids + checks)
def load_content():
    """Evaluate data/content.js with node and return window.GEO_CONTENT as JSON."""
    js = ("global.window=global;require(%r);process.stdout.write(JSON.stringify(window.GEO_CONTENT))"
          % os.path.join(APP, 'data', 'content.js'))
    return json.loads(subprocess.check_output(['node', '-e', js]))

C = load_content()
problems = []

# ---------------------------------------------------------------- Germany (16 states)
ne1 = raw('ne_10m_admin1_deu.json.gz')
state_by_name = {s['name']: s for s in C['states']}
ne_alias = {'Bremen': 'Bremen'}
PG = Proj(5.8, 15.1, 47.2, 55.1, 560, 51.2)
germany = {'proj': PG.params(), 'states': [], 'outline': ''}
state_geoms = {}
for f in ne1['features']:
    name = f['properties']['name']
    st = state_by_name.get(name)
    if not st: problems.append('NE state without content: ' + name); continue
    g = shape(f['geometry']).buffer(0)
    state_geoms[st['id']] = g
    gs = g.simplify(0.012, preserve_topology=True)
    germany['states'].append({'id': 'state-' + st['id'], 'key': st['id'], 'd': poly_path(gs, PG),
                              'label': label_point(g, PG), 'area': round(g.area, 3)})
de_union = unary_union(list(state_geoms.values()))
germany['outline'] = poly_path(de_union.simplify(0.012), PG)
for st in C['states']:
    lon, lat = st['capitalLonLat']
    if not state_geoms[st['id']].buffer(0.03).contains(Point(lon, lat)):
        problems.append('capital %s not inside %s' % (st['capital'], st['name']))

# ---------------------------------------------------------------- Europe / neighbours
ne0 = raw('ne_50m_admin0_europe.json.gz')
PE = Proj(-0.5, 21.5, 44.8, 57.9, 560, 51.0)
win = box(-0.5, 44.8, 21.5, 57.9).buffer(0.5)
by_a3 = {c['a3']: c for c in C['countries']}
europe = {'proj': PE.params(), 'countries': []}
country_geoms = {}
for f in ne0['features']:
    a3 = f['properties']['ADM0_A3']
    g = shape(f['geometry']).buffer(0).intersection(win)
    if g.is_empty: continue
    c = by_a3.get(a3)
    cid = c['id'] if c else 'other-' + a3.lower()
    country_geoms[a3] = shape(f['geometry']).buffer(0)
    gs = g.simplify(0.03, preserve_topology=True)
    europe['countries'].append({'id': ('country-' + cid) if c else cid, 'key': c['id'] if c else None,
                                'd': poly_path(gs, PE), 'label': label_point(g, PE) if c else None})
# check: neighbours really touch Germany; distractors really do not
deu = country_geoms['DEU']
for c in C['countries']:
    if c['a3'] == 'DEU': continue
    touches = country_geoms[c['a3']].buffer(0.02).intersects(deu)
    if touches != bool(c.get('neighbour')):
        problems.append('neighbour flag wrong for %s (touches=%s)' % (c['name'], touches))

# ---------------------------------------------------------------- Hessen
osm = raw('osm_hessen_areas_places.json.gz')
def osm_area(el):
    outer = [LineString(w['g']) for w in el['ways'] if w['role'] in ('outer', '') and len(w['g']) > 1]
    inner = [LineString(w['g']) for w in el['ways'] if w['role'] == 'inner' and len(w['g']) > 1]
    o = unary_union(list(polygonize(unary_union(outer)))) if outer else Polygon()
    i = unary_union(list(polygonize(unary_union(inner)))) if inner else Polygon()
    return o.difference(i).buffer(0)

areas = {el['name']: osm_area(el) for el in osm['geo']}
hessen = areas.pop('Hessen')
if abs(hessen.area * 111 * 111 * math.cos(math.radians(50.5)) - 21115) > 400:
    problems.append('Hessen area off: %.0f km²' % (hessen.area * 111 * 111 * math.cos(math.radians(50.5))))

PH = Proj(7.55, 10.45, 49.33, 51.72, 500, 50.5)
hwin = box(7.55, 49.33, 10.45, 51.72)
H = {'proj': PH.params(), 'hessen': poly_path(hessen.simplify(0.002, preserve_topology=True), PH),
     'neighbours': [], 'regions': [], 'rivers': []}
for sid, g in state_geoms.items():
    if sid == 'hessen': continue
    gi = g.intersection(hwin)
    if gi.is_empty: continue
    H['neighbours'].append({'id': 'nstate-' + sid, 'key': sid, 'd': poly_path(gi.simplify(0.006, preserve_topology=True), PH),
                            'label': label_point(gi, PH)})

region_geoms = {}
for m in C['mountains']:
    g = areas.get(m['osmName'])
    if g is None or g.is_empty: problems.append('no OSM area for ' + m['name']); continue
    region_geoms[m['id']] = g
    gi = g.intersection(hwin).simplify(0.006, preserve_topology=True)
    # label: inside the Hessian part if there is one
    gh = g.intersection(hessen)
    lab = m.get('labelLonLat')
    H['regions'].append({'id': 'region-' + m['id'], 'key': m['id'], 'd': poly_path(gi, PH),
                         'label': [round(v, 1) for v in PH.xy(*lab)] if lab else label_point(gh if not gh.is_empty else gi, PH)})

rivers_raw = raw('osm_hessen_rivers.json.gz')
from collections import defaultdict
segs = defaultdict(list)
for w in rivers_raw: segs[w['n']].append(LineString(w['g']))
river_geoms = {}
for r in C['rivers']:
    lines = segs.get(r['osmName'])
    if not lines: problems.append('no OSM line for ' + r['name']); continue
    g = linemerge(unary_union(lines))
    # drop tiny side-arms: keep parts longer than ~1.5 km
    parts = [l for l in (g.geoms if hasattr(g, 'geoms') else [g]) if l.length > 0.015]
    g = MultiLineString(parts)
    river_geoms[r['id']] = g
    gi = g.intersection(hwin).simplify(0.0025, preserve_topology=False)
    H['rivers'].append({'id': 'river-' + r['id'], 'key': r['id'], 'd': line_path(gi, PH),
                        'width': r.get('width', 2)})

# ---------------------------------------------------------------- checks on Hessen content
KM = 111.2
from shapely.ops import transform
def km(g):
    return transform(lambda x, y, z=None: (x * KM * math.cos(math.radians(50.5)), y * KM), g)
def dist_km(geom, lon, lat):
    return km(geom).distance(km(Point(lon, lat)))
for t in C['towns']:
    lon, lat = t['lonLat']
    inside = hessen.contains(Point(lon, lat))
    if inside != (t.get('inHessen', True)):
        problems.append('town %s inHessen=%s but geometry says %s' % (t['name'], t.get('inHessen', True), inside))
    for rid in t.get('rivers', []):
        g = river_geoms.get(rid)
        if g is None: continue
        d = dist_km(g, lon, lat)
        if d > t.get('riverTolKm', 2.5): problems.append('town %s: river %s is %.1f km away' % (t['name'], rid, d))
    for mid in t.get('mountains', []):
        g = region_geoms.get(mid)
        if g is not None and not g.buffer(0.01).contains(Point(lon, lat)):
            problems.append('town %s not inside %s' % (t['name'], mid))
for r in C['rivers']:
    into = r.get('into')
    jw = r.get('joinsWith')
    if jw and jw in river_geoms and r['id'] in river_geoms:
        d = km(river_geoms[r['id']]).distance(km(river_geoms[jw]))
        if d > 1.5: problems.append('river %s + %s: lines %.1f km apart' % (r['id'], jw, d))
        if r.get('becomes') in river_geoms and km(river_geoms[r['id']]).distance(km(river_geoms[r['becomes']])) > 1.5:
            problems.append('river %s does not reach %s' % (r['id'], r['becomes']))
    if into and into in river_geoms and r['id'] in river_geoms:
        d = km(river_geoms[r['id']]).distance(km(river_geoms[into]))
        if d > 1.5: problems.append('river %s → %s: lines %.1f km apart' % (r['id'], into, d))
    if r.get('inHessen', True) and r['id'] in river_geoms and not river_geoms[r['id']].intersects(hessen):
        problems.append('river %s does not touch Hessen' % r['id'])
for m in C['mountains']:
    g = region_geoms.get(m['id'])
    if g is not None and m.get('inHessen', True) and g.intersection(hessen).area < 0.01:
        problems.append('mountain %s hardly in Hessen' % m['id'])
    for pk in m.get('peaks', []):
        if g is not None and not g.buffer(0.02).contains(Point(*pk['lonLat'])):
            problems.append('peak %s outside %s' % (pk['name'], m['name']))

out = {'germany': germany, 'europe': europe, 'hessen': H,
       'sources': 'Natural Earth (public domain); © OpenStreetMap-Mitwirkende (ODbL) für Hessen: Grenze, Flüsse, Mittelgebirge'}
js = ('/* GENERATED by tools/build_maps.py — do not edit by hand.\n'
      '   Sources: Natural Earth (public domain) · Hessen border, rivers, Mittelgebirge: © OpenStreetMap contributors (ODbL). */\n'
      'window.GEO_MAPS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(APP, 'data', 'maps.js'), 'w').write(js)
print('maps.js: %.0f KB' % (len(js) / 1024))
if problems:
    print('\nCONTENT CHECKS FAILED:'); [print('  -', p) for p in problems]; sys.exit(1)
print('content checks: all passed')
