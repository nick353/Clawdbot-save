#!/usr/bin/env python3
"""bird・Brave・Tier2/3収集データをマージしてraw_posts.jsonに保存"""
import sys, json
from datetime import datetime, timezone

bird_tmp = sys.argv[1]
brave_tmp = sys.argv[2]
raw_posts = sys.argv[3]
tier2_tmp = sys.argv[4] if len(sys.argv) > 4 else None

try:
    bird_posts = json.load(open(bird_tmp))
except Exception:
    bird_posts = []

try:
    brave_posts = json.load(open(brave_tmp))
except Exception:
    brave_posts = []

tier2_posts = []
if tier2_tmp:
    try:
        tier2_posts = json.load(open(tier2_tmp))
    except Exception:
        pass

all_posts = bird_posts + brave_posts + tier2_posts
collected_at = datetime.now(timezone.utc).isoformat()

# テキストが短すぎるものを除外 + 重複除去
seen = set()
filtered = []
for p in all_posts:
    p['collected_at'] = collected_at
    key = p.get('text', '')[:60]
    if len(p.get('text', '')) >= 20 and key not in seen:
        seen.add(key)
        filtered.append(p)

output = {
    'collected_at': collected_at,
    'total': len(filtered),
    'bird_count': len(bird_posts),
    'brave_count': len(brave_posts),
    'tier2_count': len(tier2_posts),
    'posts': filtered
}
with open(raw_posts, 'w') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(len(filtered))
