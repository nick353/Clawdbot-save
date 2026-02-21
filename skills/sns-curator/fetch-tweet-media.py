#!/usr/bin/env python3
"""
ツイートから画像/動画を自動取得

Usage:
  python3 fetch-tweet-media.py "https://x.com/user/status/123" [出力ディレクトリ]

Output:
  取得したファイルパスを stdout に出力（複数行）
  失敗時は stderr にエラー、stdout は空

Methods:
  1. yt-dlp（動画/サムネイル取得）
  2. Twitter API v2 経由のメディアURL
  3. bird CLI の --json 出力から画像URLを抽出
"""

import sys
import os
import json
import subprocess
import urllib.request
import re
from pathlib import Path
from datetime import datetime

def log(msg, err=False):
    f = sys.stderr if err else sys.stderr
    print(f"[fetch-tweet-media] {msg}", file=f)

def extract_tweet_id(url):
    """URLからツイートIDを抽出"""
    m = re.search(r'/status/(\d+)', url)
    return m.group(1) if m else None

def fetch_via_ytdlp(url, output_dir, prefer_video=False):
    """yt-dlp で動画/サムネイルを取得
    
    prefer_video=True: 動画ファイルを優先取得
    prefer_video=False: まずサムネイル（高速）、なければ動画
    """
    date_str = datetime.now().strftime("%Y-%m-%d")
    output_template = str(output_dir / f"tweet-media-{date_str}-%(id)s.%(ext)s")
    
    # 1. 動画ファイルを取得（prefer_video=True またはデフォルト試行）
    cmd_video = [
        "yt-dlp",
        "--no-warnings",
        "-f", "mp4/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "--merge-output-format", "mp4",
        "-o", output_template,
        "--max-filesize", "50m",
        url
    ]
    try:
        log(f"yt-dlp 動画取得試行: {url}")
        result = subprocess.run(cmd_video, capture_output=True, text=True, timeout=90)
        files = sorted(output_dir.glob(f"tweet-media-{date_str}-*.mp4"))
        if files:
            # 最新ファイルを取得
            newest = max(files, key=lambda f: f.stat().st_mtime)
            size_mb = newest.stat().st_size / 1024 / 1024
            log(f"yt-dlp 動画取得成功: {newest} ({size_mb:.1f}MB)")
            return str(newest)
    except Exception as e:
        log(f"yt-dlp 動画失敗: {e}", err=True)
    
    # 2. フォールバック: サムネイル画像
    cmd_thumb = [
        "yt-dlp",
        "--no-warnings",
        "--write-thumbnail",
        "--skip-download",
        "-o", output_template,
        "--convert-thumbnails", "jpg",
        url
    ]
    try:
        result = subprocess.run(cmd_thumb, capture_output=True, text=True, timeout=30)
        files = sorted(
            list(output_dir.glob(f"tweet-media-{date_str}-*.jpg")) +
            list(output_dir.glob(f"tweet-media-{date_str}-*.png")),
            key=lambda f: f.stat().st_mtime
        )
        if files:
            newest = files[-1]
            log(f"yt-dlp サムネイル取得成功: {newest}")
            return str(newest)
    except Exception as e:
        log(f"yt-dlp サムネイル失敗: {e}", err=True)
    
    return None

def fetch_via_bird(tweet_url, output_dir):
    """bird CLI で画像URLを取得してダウンロード"""
    tweet_id = extract_tweet_id(tweet_url)
    if not tweet_id:
        return None
    
    # bird で特定ツイートを検索
    username_match = re.search(r'x\.com/([^/]+)/status/', tweet_url)
    if not username_match:
        return None
    username = username_match.group(1)
    
    try:
        cmd = ["bird", "search", f"from:{username}", "-n", "20", "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return None
        
        tweets = json.loads(result.stdout)
        # 対象ツイートを検索
        target = None
        for t in tweets:
            if str(t.get("id", "")) == tweet_id:
                target = t
                break
        
        if not target:
            log(f"ツイートID {tweet_id} が見つかりませんでした", err=True)
            return None
        
        # メディアURLを抽出
        media = target.get("media", [])
        if not media:
            # テキストからURLを探す
            text = target.get("text", "")
            urls = re.findall(r'https://pbs\.twimg\.com/\S+', text)
            if urls:
                media = [{"url": urls[0]}]
        
        if media:
            media_url = media[0].get("url") or media[0].get("media_url_https", "")
            if media_url:
                return download_image(media_url, output_dir)
        
    except Exception as e:
        log(f"bird 取得失敗: {e}", err=True)
    
    return None

def fetch_via_oembed(tweet_url, output_dir):
    """Twitter oEmbed API でサムネイルURL取得"""
    try:
        oembed_url = f"https://publish.twitter.com/oembed?url={tweet_url}&maxwidth=550"
        req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.load(r)
            html = data.get("html", "")
            # サムネイルURLを探す
            img_match = re.search(r'https://pbs\.twimg\.com/[^"\']+\.(jpg|png|gif|webp)', html)
            if img_match:
                return download_image(img_match.group(0), output_dir)
    except Exception as e:
        log(f"oEmbed 失敗: {e}", err=True)
    return None

def download_image(url, output_dir):
    """画像URLをダウンロード"""
    try:
        ext = "jpg" if ".jpg" in url else "png" if ".png" in url else "jpg"
        date_str = datetime.now().strftime("%Y-%m-%d")
        n = 1
        while True:
            path = output_dir / f"tweet-img-{date_str}-{n}.{ext}"
            if not path.exists():
                break
            n += 1
        
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        
        if len(data) < 1000:  # 1KB未満はスキップ
            log("画像が小さすぎます", err=True)
            return None
        
        with open(path, "wb") as f:
            f.write(data)
        log(f"画像ダウンロード完了: {path} ({len(data)//1024}KB)")
        return str(path)
    except Exception as e:
        log(f"画像ダウンロード失敗: {e}", err=True)
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fetch-tweet-media.py <tweet_url> [output_dir]", file=sys.stderr)
        sys.exit(1)
    
    tweet_url = sys.argv[1]
    output_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/curator/tweet-media")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    log(f"取得開始: {tweet_url}")
    
    # 方法1: yt-dlp（動画優先、フォールバックでサムネイル）
    result = fetch_via_ytdlp(tweet_url, output_dir, prefer_video=True)
    if result:
        print(result)
        return
    
    # 方法2: bird CLI
    result = fetch_via_bird(tweet_url, output_dir)
    if result:
        print(result)
        return
    
    # 方法3: oEmbed
    result = fetch_via_oembed(tweet_url, output_dir)
    if result:
        print(result)
        return
    
    log("全ての方法で取得失敗", err=True)
    sys.exit(1)

if __name__ == "__main__":
    main()
