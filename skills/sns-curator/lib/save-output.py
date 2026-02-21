#!/usr/bin/env python3
"""生成コンテンツをoutput_fileに保存"""
import sys, json
from datetime import datetime, timezone

output_file = sys.argv[1]
raw_posts_file = sys.argv[2]
generated_raw = sys.stdin.read()

try:
    generated = json.loads(generated_raw)
except Exception:
    generated = {'posts': []}

try:
    raw = json.load(open(raw_posts_file))
except Exception:
    raw = {'total': 0}

output = {
    'date': datetime.now().strftime('%Y-%m-%d'),
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'raw_posts_count': raw.get('total', 0),
    'generated_posts': generated.get('posts', []),
    'options': {}
}
with open(output_file, 'w') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
print(f"Saved {len(output['generated_posts'])} posts to {output_file}")
