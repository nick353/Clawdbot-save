#!/usr/bin/env python3
import sys, json
from pathlib import Path
from camoufox.sync_api import Camoufox

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 3
COOKIES_PATH = Path('/root/clawd/skills/sns-multi-poster/cookies/pinterest.json')

cookies_data = json.loads(COOKIES_PATH.read_text())
pw_cookies = []
for c in cookies_data:
    cookie = {
        'name': c['name'], 'value': c['value'],
        'domain': c.get('domain', '.pinterest.com'),
        'path': c.get('path', '/'),
        'httpOnly': c.get('httpOnly', False),
        'secure': c.get('secure', True),
        'sameSite': 'Lax'
    }
    if 'expirationDate' in c:
        cookie['expires'] = int(c['expirationDate'])
    pw_cookies.append(cookie)

state = {'cookies': pw_cookies, 'origins': []}

with Camoufox(headless=True) as browser:
    ctx = browser.new_context(storage_state=state)
    page = ctx.new_page()
    page.goto('https://www.pinterest.com/nisenprints/', timeout=60000)
    page.wait_for_timeout(4000)
    
    # 投稿のURLを取得
    urls = page.evaluate(f'''() => {{
        const links = Array.from(document.querySelectorAll('a[href*="/pin/"]'));
        return links.slice(0, {LIMIT}).map(a => 'https://www.pinterest.com' + a.getAttribute('href').split('?')[0]);
    }}''')
    
    for url in urls:
        print(url)
    
    ctx.close()
