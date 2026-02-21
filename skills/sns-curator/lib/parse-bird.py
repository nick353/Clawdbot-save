#!/usr/bin/env python3
"""bird JSON出力をパースしてaccumulate fileに追記（ツイートURL + メディアURL付き）"""
import sys, json, re
from datetime import datetime, timezone

username = sys.argv[1]
bird_tmp = sys.argv[2]
raw_in = sys.stdin.read().strip()

try:
    existing = json.load(open(bird_tmp))
except Exception:
    existing = []

def extract_urls(text):
    """テキストからURLを抽出"""
    return re.findall(r'https?://\S+', text)

def extract_media_url(item):
    """ツイートデータからメディアURL（画像/動画サムネイル）を取得"""
    # media フィールド
    for field in ['media', 'extended_entities']:
        media_list = item.get(field, [])
        if isinstance(media_list, list) and media_list:
            m = media_list[0]
            return m.get('media_url_https') or m.get('url') or m.get('media_url', '')
    # attachments
    attachments = item.get('attachments', {})
    if attachments:
        media_keys = attachments.get('media_keys', [])
        if media_keys:
            return f"https://pbs.twimg.com/media/{media_keys[0]}.jpg"
    return ''

try:
    data = json.loads(raw_in)
    posts = []
    items = data if isinstance(data, list) else data.get('data', [data])
    for item in items[:5]:
        text = item.get('text', item.get('full_text', ''))
        if len(text) < 30:
            continue
        tweet_id = item.get('id', item.get('id_str', ''))
        tweet_url = f'https://x.com/{username}/status/{tweet_id}' if tweet_id else f'https://x.com/{username}'
        
        # メディアURL抽出
        media_url = extract_media_url(item)
        
        # テキスト内のURLを抽出（元ネタリンクの可能性）
        inline_urls = extract_urls(text)
        # t.co以外のURLを優先
        source_urls = [u for u in inline_urls if 't.co' not in u and 'x.com' not in u]
        
        posts.append({
            'source': username,
            'platform': 'X',
            'text': text,
            'url': tweet_url,
            'tweet_id': str(tweet_id),
            'media_url': media_url,
            'source_urls': source_urls[:2],
            'collected_at': datetime.now(timezone.utc).isoformat()
        })
    existing.extend(posts)
    with open(bird_tmp, 'w') as f:
        json.dump(existing, f, ensure_ascii=False)
    print(f'+{len(posts)}件')
except Exception as e:
    print(f'parse error: {e}', file=sys.stderr)
