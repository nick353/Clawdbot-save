#!/usr/bin/env python3
"""Brave Search JSON出力をパースしてaccumulate fileに追記"""
import sys, json

brave_tmp = sys.argv[1]
raw_in = sys.stdin.read().strip()

try:
    existing = json.load(open(brave_tmp))
except Exception:
    existing = []

try:
    data = json.loads(raw_in)
    results = []
    seen_urls = {r.get('url', '') for r in existing}
    for item in data.get('web', {}).get('results', [])[:5]:
        url = item.get('url', '')
        if url not in seen_urls:
            title = item.get('title', '')
            desc = item.get('description', '')
            text = f"{title}: {desc}".strip(': ')
            if len(text) > 30:
                results.append({
                    'source': 'brave_search',
                    'platform': 'web',
                    'text': text,
                    'url': url,
                    'collected_at': ''
                })
                seen_urls.add(url)
    existing.extend(results)
    with open(brave_tmp, 'w') as f:
        json.dump(existing, f, ensure_ascii=False)
    print(f'+{len(results)}件')
except Exception as e:
    print(f'parse error: {e}', file=sys.stderr)
