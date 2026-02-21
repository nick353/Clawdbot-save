#!/usr/bin/env python3
"""
Tier2・Tier3 コンテンツソース収集スクリプト

Tier 2: ニュースレター・キュレーションサイト
  - tldr.tech/ai    → AI/Techまとめ
  - bensbites.beehiiv.com → AI特化ニュースレター
  - therundown.ai   → AI最新情報
  - indiehackers.com → インディーハッカー

Tier 3: YouTube / Podcast
  - Matt Wolfe (@MattVidPro) → AIツール解説
  - AI Explained (@aiexplained_) → AI解説
  - My First Million → 成功事例Podcast

Usage:
  python3 fetch-tier2-tier3.py [出力JSONファイル]

Output: JSON形式でposts配列に追記
"""

import sys, os, json, subprocess, re, urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_FILE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/curator/tier2_tier3.json"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

def log(msg): print(f"[Tier2/3] {msg}", file=sys.stderr)

def safe_fetch(url, timeout=10):
    """Webページのテキストを取得"""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(50000).decode("utf-8", errors="ignore")
    except Exception as e:
        log(f"Fetch失敗 {url}: {e}")
        return ""

def summarize_with_gemini(text, prompt_suffix=""):
    """Gemini APIでテキストを要約"""
    if not GEMINI_API_KEY:
        return ""
    
    prompt = f"""以下のウェブページの内容から、AIツール・個人開発・スタートアップ・起業に関する
重要なニュースやトピックを3件抽出して、JSON形式で返してください。

【コンテンツ】
{text[:3000]}

{prompt_suffix}

【出力形式（JSON）】
{{
  "items": [
    {{
      "title": "タイトル（英語OK）",
      "summary": "内容の要約（英語OK、100文字以内）",
      "url": "元のURL（あれば）",
      "type": "ai_tool/success_story/news/podcast/video のどれか"
    }}
  ]
}}"""

    try:
        data = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024,
                                  "responseMimeType": "application/json"}
        }).encode()
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
            data=data, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.load(r)
            text_out = result["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_out)
    except Exception as e:
        log(f"Gemini要約失敗: {e}")
        return {}

BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "")

def brave_search(query, count=5, freshness="pw"):
    """Brave Search APIで検索"""
    if not BRAVE_API_KEY:
        return []
    try:
        q = urllib.parse.quote(query) if hasattr(urllib, 'parse') else query.replace(' ', '+')
        url = f"https://api.search.brave.com/res/v1/web/search?q={q}&count={count}&freshness={freshness}"
        req = urllib.request.Request(url, headers={
            "Accept": "application/json",
            "X-Subscription-Token": BRAVE_API_KEY
        })
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.load(r)
            results = []
            for item in data.get("web", {}).get("results", []):
                results.append({
                    "title": item.get("title", ""),
                    "description": item.get("description", ""),
                    "url": item.get("url", "")
                })
            return results
    except Exception as e:
        log(f"Brave Search失敗: {e}")
        return []

import urllib.parse

def fetch_tldr_ai():
    """tldr.tech/ai から最新AI記事を取得（Brave Search経由）"""
    log("Fetching tldr.tech/ai via Brave...")
    results = brave_search("site:tldr.tech AI tool startup news", count=5, freshness="pw")
    items = []
    for r in results:
        text = f"{r['title']}: {r['description']}"
        if len(text) < 30:
            continue
        items.append({
            "source": "tldr.tech/ai",
            "platform": "newsletter",
            "text": text[:300],
            "url": r["url"] or "https://tldr.tech/ai",
            "collected_at": datetime.now(timezone.utc).isoformat()
        })
    log(f"tldr.tech: {len(items)}件")
    return items[:5]

def fetch_bensbites():
    """bensbites から最新ニュースを取得（Brave Search経由）"""
    log("Fetching bensbites via Brave...")
    results = brave_search("site:bensbites.beehiiv.com AI news", count=5, freshness="pw")
    items = []
    for r in results:
        text = f"{r['title']}: {r['description']}"
        if len(text) < 30:
            continue
        items.append({
            "source": "bensbites",
            "platform": "newsletter",
            "text": text[:300],
            "url": r["url"] or "https://bensbites.beehiiv.com",
            "collected_at": datetime.now(timezone.utc).isoformat()
        })
    log(f"bensbites: {len(items)}件")
    return items[:5]

def fetch_therundown():
    """therundown.ai から最新AI情報を取得（Brave Search経由）"""
    log("Fetching therundown.ai via Brave...")
    results = brave_search("site:therundown.ai AI tools news 2025", count=5, freshness="pw")
    items = []
    for r in results:
        text = f"{r['title']}: {r['description']}"
        if len(text) < 30:
            continue
        items.append({
            "source": "therundown.ai",
            "platform": "newsletter",
            "text": text[:300],
            "url": r["url"] or "https://www.therundown.ai",
            "collected_at": datetime.now(timezone.utc).isoformat()
        })
    log(f"therundown.ai: {len(items)}件")
    return items[:5]

def fetch_youtube_latest(channel_handle, channel_name, limit=3):
    """yt-dlp で YouTube チャンネルの最新動画を取得"""
    log(f"Fetching YouTube: {channel_handle}...")
    
    url = f"https://www.youtube.com/{channel_handle}/videos"
    try:
        result = subprocess.run(
            ["yt-dlp", "--flat-playlist", "-j", "--playlist-end", str(limit),
             "--no-warnings", url],
            capture_output=True, text=True, timeout=30
        )
        items = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            try:
                d = json.loads(line)
                video_id = d.get("id", "")
                title = d.get("title", "")
                if not title:
                    continue
                items.append({
                    "source": channel_name,
                    "platform": "youtube",
                    "text": title,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "video_id": video_id,
                    "collected_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception:
                pass
        log(f"YouTube {channel_name}: {len(items)}件")
        return items
    except Exception as e:
        log(f"YouTube {channel_name} 失敗: {e}")
        return []

def fetch_youtube_transcript(video_id, title):
    """YouTube動画のサマリーをGeminiで生成（動画URLから）"""
    if not GEMINI_API_KEY:
        return title
    
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Gemini APIでYouTube動画を直接分析（Gemini 1.5はYouTube URLを受け付ける）
    try:
        prompt = f"""YouTube動画「{title}」の内容を要約してください。
URL: {video_url}

AIツール・個人開発・スタートアップに関連する重要ポイントを100文字以内で説明してください。"""
        
        data = json.dumps({
            "contents": [{"parts": [
                {"text": prompt},
                {"fileData": {"mimeType": "video/*", "fileUri": video_url}}
            ]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512}
        }).encode()
        
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
            data=data, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.load(r)
            return result["candidates"][0]["content"]["parts"][0]["text"][:200]
    except Exception as e:
        log(f"Gemini動画分析失敗: {e}")
        return title

def fetch_indiehackers():
    """Indie Hackers から最新記事を取得（Brave Search経由）"""
    log("Fetching IndieHackers via Brave...")
    results = brave_search("site:indiehackers.com AI revenue solopreneur", count=5, freshness="pm")
    items = []
    for r in results:
        text = f"{r['title']}: {r['description']}"
        if len(text) < 30:
            continue
        items.append({
            "source": "indiehackers",
            "platform": "community",
            "text": text[:300],
            "url": r["url"] or "https://www.indiehackers.com",
            "collected_at": datetime.now(timezone.utc).isoformat()
        })
    log(f"IndieHackers: {len(items)}件")
    return items[:5]

def fetch_producthunt():
    """ProductHunt から最新AIツールを取得（Brave Search経由）"""
    log("Fetching ProductHunt AI tools...")
    today = datetime.now().strftime("%Y/%m/%d")
    results = brave_search(f"site:producthunt.com AI tool launched 2025", count=5, freshness="pw")
    items = []
    for r in results:
        text = f"{r['title']}: {r['description']}"
        if len(text) < 30:
            continue
        items.append({
            "source": "producthunt",
            "platform": "product_launch",
            "text": text[:300],
            "url": r["url"] or "https://www.producthunt.com",
            "collected_at": datetime.now(timezone.utc).isoformat()
        })
    log(f"ProductHunt: {len(items)}件")
    return items[:5]

def main():
    all_items = []
    
    # ---- Tier 2: ニュースレター ----
    print("[Tier2] ニュースレター収集開始...", file=sys.stderr)
    all_items.extend(fetch_tldr_ai())
    all_items.extend(fetch_bensbites())
    all_items.extend(fetch_therundown())
    all_items.extend(fetch_indiehackers())
    all_items.extend(fetch_producthunt())
    
    # ---- Tier 3: YouTube ----
    print("[Tier3] YouTube収集開始...", file=sys.stderr)
    youtube_channels = [
        ("@MattVidPro", "Matt Wolfe / AI Tools"),
        ("@TheAIExplainerChannel", "AI Explained"),
    ]
    for handle, name in youtube_channels:
        videos = fetch_youtube_latest(handle, name, limit=3)
        all_items.extend(videos)
    
    # 既存ファイルに追記
    existing = []
    if os.path.exists(OUTPUT_FILE):
        try:
            existing = json.load(open(OUTPUT_FILE))
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []
    
    existing.extend(all_items)
    
    # 重複除去（URLベース）
    seen_urls = set()
    unique = []
    for item in existing:
        url = item.get("url", "")
        text_key = item.get("text", "")[:50]
        key = url or text_key
        if key not in seen_urls and text_key:
            seen_urls.add(key)
            unique.append(item)
    
    with open(OUTPUT_FILE, "w") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    
    print(f"Tier2/3 収集完了: {len(all_items)}件 (合計: {len(unique)}件)")
    print(OUTPUT_FILE)

if __name__ == "__main__":
    main()
