#!/usr/bin/env python3
import sys, json
from pathlib import Path
from camoufox.sync_api import Camoufox

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 3
COOKIES_PATH = Path('/root/clawd/skills/sns-multi-poster/cookies/facebook.json')

cookies_data = json.loads(COOKIES_PATH.read_text())
pw_cookies = []
for c in cookies_data:
    cookie = {
        'name': c['name'], 'value': c['value'],
        'domain': c.get('domain', '.facebook.com'),
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
    # Facebookページまたはプロフィールに移動
    page.goto('https://www.facebook.com/profile.php?id=61572333736612', timeout=60000)
    page.wait_for_timeout(4000)
    
    # 投稿のURLを取得
    urls = page.evaluate(f'''() => {{
        const links = Array.from(document.querySelectorAll('a[href*="/posts/"], a[href*="/photo/"]'));
        const seen = new Set();
        const unique = [];
        for (const link of links) {{
            const href = link.getAttribute('href');
            if (href && !seen.has(href)) {{
                seen.add(href);
                const fullUrl = href.startsWith('http') ? href : 'https://www.facebook.com' + href;
                unique.push(fullUrl.split('?')[0]);
            }}
            if (unique.length >= {LIMIT}) break;
        }}
        return unique;
    }}''')
    
    for url in urls:
        print(url)
    
    ctx.close()
