"""Bundle the app into single self-contained HTML files (fonts, CSS, JS inlined).

    python3 build.py

dist/diktat-trainer-einzeldatei.html  full page, open anywhere (no PWA/offline cache)
dist/artifact.html                    body-only variant for publishing as a Claude artifact
The normal multi-file version (index.html + folders) is what goes on GitHub Pages.
"""
import base64, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

css = read('styles.css')
def inline_font(m):
    path, fmt = m.group(1), m.group(2)
    data = base64.b64encode(open(os.path.join(ROOT, path), 'rb').read()).decode()
    mime = 'font/woff2' if fmt == 'woff2' else 'font/woff'
    return f"url('data:{mime};base64,{data}') format('{fmt}')"
css = re.sub(r"url\('([^']+)'\) format\('(woff2?)'\)", inline_font, css)

html = read('index.html')
body = html.split('<!--APP-START-->')[1].split('<!--APP-END-->')[0]
# Platform scripts (../../shared/…) stay out: the single file runs standalone, as before.
scripts = [s for s in re.findall(r'<script src="([^"]+)"></script>', html) if not s.startswith('../')]
js = '\n'.join(read(s) for s in scripts)
icon = 'data:image/svg+xml;base64,' + base64.b64encode(open(os.path.join(ROOT, 'icons/icon.svg'), 'rb').read()).decode()
title = "<title>Lukas' Diktat-Trainer</title>"

art_body = re.sub(r'\s*<button id="btn-download"[^>]*>[^<]*</button>', '', body)
inner = f"{title}\n<style>\n{css}\n</style>\n{art_body}\n<script>\n{js}\n</script>\n"
open(os.path.join(ROOT, 'dist/artifact.html'), 'w', encoding='utf-8').write(inner)

full = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="{icon}">
{title}
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
"""
open(os.path.join(ROOT, 'dist/diktat-trainer-einzeldatei.html'), 'w', encoding='utf-8').write(full)
print('built', len(full) // 1024, 'KB')
