"""Take the dossier screenshots of the Sky Rings flight game.

Loads each ?shot= scene from the local static server (node serve.ts), waits for
window.__shotReady, and shoots 1280x720 JPEGs into screenshots/. Also records
every network request the page makes: only the local server may appear.
"""
import json
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path('/home/hatch/workspace/competitions/makefun-flight-game')
OUT = ROOT / 'screenshots'
OUT.mkdir(exist_ok=True)

SHOTS = [
    ('1-start.jpg', '?shot=start&seed=1'),
    ('2-play.jpg', '?shot=play&seed=1'),
    ('3-end.jpg', '?shot=end&seed=1'),
]

requests = []
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
        args=['--no-sandbox'],
    )
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.on('request', lambda r: requests.append(r.url))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    for name, query in SHOTS:
        page.goto(f'http://localhost:8080/{query}')
        page.wait_for_function('window.__shotReady === true', timeout=30000)
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / name), type='jpeg', quality=82)
    browser.close()

print('requests made by the page:', json.dumps(requests, indent=1))
print('console/page errors:', json.dumps(errors, indent=1))
ok = True
for f in sorted(OUT.glob('*.jpg')):
    im = Image.open(f)
    print(f.name, f.stat().st_size, 'bytes', im.size)
    if f.stat().st_size > 262144:
        print('  OVER 256 KiB cap!')
        ok = False
sys.exit(0 if ok and not errors else 1)
