#!/usr/bin/env python3
import sys, json
from pathlib import Path
from camoufox.sync_api import Camoufox

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 3
COOKIES_PATH = Path('/root/clawd/skills/sns-multi-poster/cookies/instagram.json')

cookies_data = json.loads(COOKIES_PATH.read_text())
pw_cookies = []
for c in cookies_data:
    cookie = {
        'name': c['name'], 'value': c['value'],
        'domain': c.get('domain', '.instagram.com'),
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
    page.goto('https://www.instagram.com/nisen_prints/', timeout=60000)
    
    # より長く待機
    page.wait_for_timeout(10000)
    
    # スクロールしてコンテンツをロード
    page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    page.wait_for_timeout(3000)
    
    # 投稿のURLを取得
    urls = page.evaluate(f'''() => {{
        const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
        const unique = [...new Set(links.map(a => a.getAttribute('href')))];
        return unique.slice(0, {LIMIT}).map(href => {{
            const clean = href.split('?')[0];
            return clean.startsWith('http') ? clean : 'https://www.instagram.com' + clean;
        }});
    }}''')
    
    for url in urls:
        print(url)
    
    ctx.close()
