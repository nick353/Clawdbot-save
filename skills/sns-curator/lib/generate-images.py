#!/usr/bin/env python3
"""
生成された投稿のアイキャッチ画像を一括生成
優先順位：
1. 元ツイートの画像を取得（fetch-tweet-media.py）
2. 自前インフォグラフィック（generate-eyecatch.py）
"""
import sys, json, subprocess, os
from pathlib import Path

output_file = sys.argv[1]
eyecatch_script = sys.argv[2]
paths_file = sys.argv[3]

SCRIPT_DIR = Path(eyecatch_script).parent
FETCH_SCRIPT = SCRIPT_DIR / "fetch-tweet-media.py"

try:
    d = json.load(open(output_file))
    posts = d.get('generated_posts', [])
except Exception as e:
    print(f'投稿データ読み込みエラー: {e}', file=sys.stderr)
    posts = []

def try_fetch_tweet_media(tweet_url):
    """元ツイートから画像/動画を取得"""
    if not tweet_url or not os.path.exists(str(FETCH_SCRIPT)):
        return None
    if 'x.com' not in tweet_url and 'twitter.com' not in tweet_url:
        return None
    try:
        result = subprocess.run(
            ['python3', str(FETCH_SCRIPT), tweet_url],
            capture_output=True, text=True, timeout=45
        )
        if result.returncode == 0:
            path = result.stdout.strip()
            if path and os.path.exists(path):
                print(f'✅ 元ツイート画像取得: {path}')
                return path
    except Exception as e:
        print(f'⚠️  元ツイート画像取得失敗: {e}', file=sys.stderr)
    return None

def generate_eyecatch(post, idx):
    """インフォグラフィック画像を生成"""
    title = post.get('title', post.get('source', f'投稿{idx+1}'))[:25]
    points = post.get('points', ['AIツールで効率化', '個人開発で収益化', '実践してみよう'])[:3]
    cmd = ['python3', eyecatch_script, title] + points
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            path = result.stdout.strip()
            if path and os.path.exists(path):
                print(f'✅ インフォグラフィック生成: {path}')
                return path
    except Exception as e:
        print(f'⚠️  インフォグラフィック生成例外: {e}', file=sys.stderr)
    return None

results = []
for i, post in enumerate(posts):
    image_path = None
    
    # 1. 元ツイートURL から画像取得を試みる
    tweet_url = post.get('url', '') or post.get('source_url', '')
    if 'x.com' in str(tweet_url) and '/status/' in str(tweet_url):
        image_path = try_fetch_tweet_media(tweet_url)
    
    # 2. メタデータ内のソースURLからも試みる
    if not image_path:
        for src_url in post.get('source_urls', []):
            if 'x.com' in src_url and '/status/' in src_url:
                image_path = try_fetch_tweet_media(src_url)
                if image_path:
                    break
    
    # 3. フォールバック: インフォグラフィック自動生成
    if not image_path:
        image_path = generate_eyecatch(post, i)
    
    if image_path:
        results.append(image_path)
    else:
        results.append(None)  # Noneでも投稿はテキストのみで続行
        print(f'⚠️  投稿{i+1}: 画像なし（テキストのみで投稿）', file=sys.stderr)

# Noneを除いたパスリストを保存
valid_results = [p for p in results if p]
with open(paths_file, 'w') as f:
    # インデックス対応のリスト（Noneも含む）
    json.dump(results, f)
print(f'生成画像数: {len(valid_results)}')
