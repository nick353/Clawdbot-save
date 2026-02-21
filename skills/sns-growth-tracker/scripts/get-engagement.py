#!/usr/bin/env python3
"""
SNSエンゲージメント自動取得スクリプト
Playwrightを使用してエンゲージメント数値をスクレイピング
"""

import os
import sys
import json
import asyncio
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, List

try:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext
except ImportError:
    print("❌ Playwrightがインストールされていません")
    print("インストール: pip install playwright && playwright install chromium")
    sys.exit(1)

class EngagementScraper:
    def __init__(self, cookies_dir=None, headless=True, max_retries=3):
        self.cookies_dir = cookies_dir or Path('/root/clawd/skills/sns-growth-tracker/data/cookies')
        self.cookies_dir.mkdir(parents=True, exist_ok=True)
        self.headless = headless
        self.max_retries = max_retries
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
    
    async def initialize(self):
        """ブラウザを初期化"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=self.headless)
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
    
    async def close(self):
        """ブラウザを閉じる"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
    
    def _get_cookie_file(self, platform: str) -> Path:
        """プラットフォームのクッキーファイルパスを取得"""
        return self.cookies_dir / f"{platform.lower()}_cookies.json"
    
    async def _load_cookies(self, platform: str):
        """クッキーを読み込み"""
        cookie_file = self._get_cookie_file(platform)
        if cookie_file.exists():
            try:
                with open(cookie_file, 'r') as f:
                    cookies = json.load(f)
                await self.context.add_cookies(cookies)
                print(f"✅ {platform} のクッキーを読み込みました")
                return True
            except Exception as e:
                print(f"⚠️ {platform} のクッキー読み込み失敗: {e}")
        return False
    
    async def _save_cookies(self, platform: str):
        """クッキーを保存"""
        cookie_file = self._get_cookie_file(platform)
        try:
            cookies = await self.context.cookies()
            with open(cookie_file, 'w') as f:
                json.dump(cookies, f, indent=2)
            print(f"✅ {platform} のクッキーを保存しました")
        except Exception as e:
            print(f"⚠️ {platform} のクッキー保存失敗: {e}")
    
    async def _wait_for_login(self, page: Page, platform: str, timeout=300000):
        """手動ログインを待機"""
        print(f"\n🔐 {platform} にログインしてください...")
        print("ログイン完了後、ブラウザを閉じないでそのままお待ちください\n")
        
        # ログイン完了の検出（プラットフォームごとに調整）
        login_indicators = {
            'Instagram': ['instagram.com/accounts/onetap', 'instagram.com/[^/]+/$'],
            'X': ['x.com/home', 'twitter.com/home'],
            'Threads': ['threads.net/@'],
            'Facebook': ['facebook.com/home', 'facebook.com/?sk=h_chr'],
            'Pinterest': ['pinterest.com/$', 'pinterest.com/[^/]+/$']
        }
        
        indicators = login_indicators.get(platform, [])
        
        # タイムアウトまで待機
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < timeout / 1000:
            current_url = page.url
            
            # ログイン完了の確認
            for indicator in indicators:
                if re.search(indicator, current_url):
                    print(f"✅ {platform} へのログインを検出しました")
                    await asyncio.sleep(2)  # クッキー保存のための待機
                    return True
            
            await asyncio.sleep(1)
        
        return False
    
    async def ensure_login(self, platform: str, login_url: str) -> bool:
        """ログイン状態を確認（必要に応じて手動ログイン）"""
        page = await self.context.new_page()
        
        # クッキーを読み込み
        cookies_loaded = await self._load_cookies(platform)
        
        # プラットフォームにアクセス
        await page.goto(login_url, wait_until='networkidle')
        await asyncio.sleep(3)
        
        # ログイン状態を確認
        current_url = page.url
        
        # ログインページにリダイレクトされた場合は手動ログイン
        login_pages = ['login', 'signin', 'accounts/login']
        if any(login_page in current_url for login_page in login_pages) or not cookies_loaded:
            print(f"\n⚠️ {platform} にログインが必要です")
            
            if not await self._wait_for_login(page, platform):
                print(f"❌ {platform} のログインがタイムアウトしました")
                await page.close()
                return False
            
            # クッキーを保存
            await self._save_cookies(platform)
        else:
            print(f"✅ {platform} は既にログイン済みです")
        
        await page.close()
        return True
    
    async def get_instagram_engagement(self, post_url: str) -> Optional[Dict]:
        """Instagramのエンゲージメントを取得"""
        page = await self.context.new_page()
        
        try:
            print(f"📸 Instagram投稿を取得: {post_url}")
            await page.goto(post_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            engagement = {
                'platform': 'Instagram',
                'url': post_url,
                'timestamp': datetime.now().isoformat(),
                'likes': 0,
                'comments': 0,
                'saves': None,  # プライベートメトリクス
                'shares': None,
                'reach': None
            }
            
            # いいね数
            try:
                likes_elem = await page.query_selector('a[href*="/liked_by/"] span, button span span')
                if likes_elem:
                    likes_text = await likes_elem.inner_text()
                    engagement['likes'] = self._parse_number(likes_text)
            except Exception as e:
                print(f"⚠️ いいね数の取得失敗: {e}")
            
            # コメント数
            try:
                comments_elem = await page.query_selector('span[class*="Comment"]')
                if comments_elem:
                    comments_text = await comments_elem.inner_text()
                    engagement['comments'] = self._parse_number(comments_text)
            except Exception as e:
                print(f"⚠️ コメント数の取得失敗: {e}")
            
            # インサイト（自分の投稿の場合）
            try:
                insights_button = await page.query_selector('button[aria-label*="インサイト"], button[aria-label*="Insights"]')
                if insights_button:
                    await insights_button.click()
                    await asyncio.sleep(2)
                    
                    # リーチ
                    reach_elem = await page.query_selector('div:has-text("リーチ") + div, div:has-text("Reach") + div')
                    if reach_elem:
                        reach_text = await reach_elem.inner_text()
                        engagement['reach'] = self._parse_number(reach_text)
                    
                    # 保存数
                    saves_elem = await page.query_selector('div:has-text("保存") + div, div:has-text("Saves") + div')
                    if saves_elem:
                        saves_text = await saves_elem.inner_text()
                        engagement['saves'] = self._parse_number(saves_text)
                    
                    # シェア数
                    shares_elem = await page.query_selector('div:has-text("シェア") + div, div:has-text("Shares") + div')
                    if shares_elem:
                        shares_text = await shares_elem.inner_text()
                        engagement['shares'] = self._parse_number(shares_text)
            except Exception as e:
                print(f"⚠️ インサイトの取得失敗: {e}")
            
            print(f"✅ Instagram: いいね {engagement['likes']}, コメント {engagement['comments']}")
            return engagement
        
        except Exception as e:
            print(f"❌ Instagram エンゲージメント取得エラー: {e}")
            return None
        
        finally:
            await page.close()
    
    async def get_x_engagement(self, post_url: str) -> Optional[Dict]:
        """X (Twitter) のエンゲージメントを取得"""
        page = await self.context.new_page()
        
        try:
            print(f"🐦 X投稿を取得: {post_url}")
            await page.goto(post_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            engagement = {
                'platform': 'X',
                'url': post_url,
                'timestamp': datetime.now().isoformat(),
                'likes': 0,
                'retweets': 0,
                'replies': 0,
                'impressions': None  # アナリティクス必要
            }
            
            # ツイートの統計を取得
            try:
                # いいね
                like_button = await page.query_selector('[data-testid="like"], button[aria-label*="いいね"]')
                if like_button:
                    like_text = await like_button.inner_text()
                    engagement['likes'] = self._parse_number(like_text)
                
                # リツイート
                retweet_button = await page.query_selector('[data-testid="retweet"], button[aria-label*="リツイート"]')
                if retweet_button:
                    retweet_text = await retweet_button.inner_text()
                    engagement['retweets'] = self._parse_number(retweet_text)
                
                # 返信
                reply_button = await page.query_selector('[data-testid="reply"], button[aria-label*="返信"]')
                if reply_button:
                    reply_text = await reply_button.inner_text()
                    engagement['replies'] = self._parse_number(reply_text)
                
                # インプレッション（アナリティクスボタン）
                analytics_button = await page.query_selector('a[href*="/analytics"], [aria-label*="アナリティクス"]')
                if analytics_button:
                    await analytics_button.click()
                    await asyncio.sleep(2)
                    
                    impressions_elem = await page.query_selector('div:has-text("インプレッション") span, div:has-text("impressions") span')
                    if impressions_elem:
                        impressions_text = await impressions_elem.inner_text()
                        engagement['impressions'] = self._parse_number(impressions_text)
            except Exception as e:
                print(f"⚠️ X統計の取得失敗: {e}")
            
            print(f"✅ X: いいね {engagement['likes']}, RT {engagement['retweets']}, 返信 {engagement['replies']}")
            return engagement
        
        except Exception as e:
            print(f"❌ X エンゲージメント取得エラー: {e}")
            return None
        
        finally:
            await page.close()
    
    async def get_threads_engagement(self, post_url: str) -> Optional[Dict]:
        """Threadsのエンゲージメントを取得"""
        page = await self.context.new_page()
        
        try:
            print(f"🧵 Threads投稿を取得: {post_url}")
            await page.goto(post_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            engagement = {
                'platform': 'Threads',
                'url': post_url,
                'timestamp': datetime.now().isoformat(),
                'likes': 0,
                'reposts': 0,
                'replies': 0,
                'views': None
            }
            
            # エンゲージメント統計
            try:
                # いいね
                like_button = await page.query_selector('div[role="button"][aria-label*="いいね"], div[role="button"][aria-label*="Like"]')
                if like_button:
                    like_text = await like_button.inner_text()
                    engagement['likes'] = self._parse_number(like_text)
                
                # リポスト
                repost_button = await page.query_selector('div[role="button"][aria-label*="リポスト"], div[role="button"][aria-label*="Repost"]')
                if repost_button:
                    repost_text = await repost_button.inner_text()
                    engagement['reposts'] = self._parse_number(repost_text)
                
                # 返信
                reply_button = await page.query_selector('div[role="button"][aria-label*="返信"], div[role="button"][aria-label*="Reply"]')
                if reply_button:
                    reply_text = await reply_button.inner_text()
                    engagement['replies'] = self._parse_number(reply_text)
                
                # 表示回数（インサイト）
                insights_link = await page.query_selector('a[href*="/insights"]')
                if insights_link:
                    await insights_link.click()
                    await asyncio.sleep(2)
                    
                    views_elem = await page.query_selector('div:has-text("表示") span, div:has-text("Views") span')
                    if views_elem:
                        views_text = await views_elem.inner_text()
                        engagement['views'] = self._parse_number(views_text)
            except Exception as e:
                print(f"⚠️ Threads統計の取得失敗: {e}")
            
            print(f"✅ Threads: いいね {engagement['likes']}, リポスト {engagement['reposts']}, 返信 {engagement['replies']}")
            return engagement
        
        except Exception as e:
            print(f"❌ Threads エンゲージメント取得エラー: {e}")
            return None
        
        finally:
            await page.close()
    
    async def get_facebook_engagement(self, post_url: str) -> Optional[Dict]:
        """Facebookのエンゲージメントを取得"""
        page = await self.context.new_page()
        
        try:
            print(f"📘 Facebook投稿を取得: {post_url}")
            await page.goto(post_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            engagement = {
                'platform': 'Facebook',
                'url': post_url,
                'timestamp': datetime.now().isoformat(),
                'likes': 0,
                'comments': 0,
                'shares': 0,
                'reach': None
            }
            
            # エンゲージメント統計
            try:
                # いいね数
                likes_elem = await page.query_selector('span[aria-label*="いいね"], span[aria-label*="Like"]')
                if likes_elem:
                    likes_text = await likes_elem.get_attribute('aria-label')
                    engagement['likes'] = self._parse_number(likes_text)
                
                # コメント数
                comments_elem = await page.query_selector('span:has-text("コメント"), span:has-text("comments")')
                if comments_elem:
                    comments_text = await comments_elem.inner_text()
                    engagement['comments'] = self._parse_number(comments_text)
                
                # シェア数
                shares_elem = await page.query_selector('span:has-text("シェア"), span:has-text("shares")')
                if shares_elem:
                    shares_text = await shares_elem.inner_text()
                    engagement['shares'] = self._parse_number(shares_text)
                
                # インサイト（ページの投稿のみ）
                insights_button = await page.query_selector('a[href*="/insights"]')
                if insights_button:
                    await insights_button.click()
                    await asyncio.sleep(2)
                    
                    reach_elem = await page.query_selector('div:has-text("リーチ") span, div:has-text("Reach") span')
                    if reach_elem:
                        reach_text = await reach_elem.inner_text()
                        engagement['reach'] = self._parse_number(reach_text)
            except Exception as e:
                print(f"⚠️ Facebook統計の取得失敗: {e}")
            
            print(f"✅ Facebook: いいね {engagement['likes']}, コメント {engagement['comments']}, シェア {engagement['shares']}")
            return engagement
        
        except Exception as e:
            print(f"❌ Facebook エンゲージメント取得エラー: {e}")
            return None
        
        finally:
            await page.close()
    
    async def get_pinterest_engagement(self, post_url: str) -> Optional[Dict]:
        """Pinterestのエンゲージメントを取得"""
        page = await self.context.new_page()
        
        try:
            print(f"📌 Pinterest投稿を取得: {post_url}")
            await page.goto(post_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            engagement = {
                'platform': 'Pinterest',
                'url': post_url,
                'timestamp': datetime.now().isoformat(),
                'saves': 0,
                'clicks': None,
                'impressions': None
            }
            
            # エンゲージメント統計
            try:
                # 保存数
                saves_elem = await page.query_selector('div[data-test-id="pin-save-count"]')
                if saves_elem:
                    saves_text = await saves_elem.inner_text()
                    engagement['saves'] = self._parse_number(saves_text)
                
                # アナリティクス（自分のピンのみ）
                analytics_button = await page.query_selector('button:has-text("アナリティクス"), button:has-text("Analytics")')
                if analytics_button:
                    await analytics_button.click()
                    await asyncio.sleep(2)
                    
                    # インプレッション
                    impressions_elem = await page.query_selector('div:has-text("インプレッション") span, div:has-text("Impressions") span')
                    if impressions_elem:
                        impressions_text = await impressions_elem.inner_text()
                        engagement['impressions'] = self._parse_number(impressions_text)
                    
                    # クリック数
                    clicks_elem = await page.query_selector('div:has-text("クリック") span, div:has-text("Clicks") span')
                    if clicks_elem:
                        clicks_text = await clicks_elem.inner_text()
                        engagement['clicks'] = self._parse_number(clicks_text)
            except Exception as e:
                print(f"⚠️ Pinterest統計の取得失敗: {e}")
            
            print(f"✅ Pinterest: 保存 {engagement['saves']}")
            return engagement
        
        except Exception as e:
            print(f"❌ Pinterest エンゲージメント取得エラー: {e}")
            return None
        
        finally:
            await page.close()
    
    def _parse_number(self, text: str) -> int:
        """テキストから数値を抽出（K, M対応）"""
        if not text:
            return 0
        
        # 数値部分を抽出
        match = re.search(r'([\d,\.]+)\s*([KMB万千百十億]?)', text.upper())
        if not match:
            return 0
        
        number_str = match.group(1).replace(',', '').replace('.', '')
        multiplier = match.group(2)
        
        try:
            number = float(number_str) if '.' in match.group(1) else int(number_str)
            
            # 倍率を適用
            if multiplier in ['K', '千']:
                number *= 1000
            elif multiplier in ['M', '万', '百万']:
                number *= 1000000
            elif multiplier in ['B', '億']:
                number *= 1000000000
            
            return int(number)
        except ValueError:
            return 0
    
    async def get_engagement_with_retry(self, platform: str, post_url: str) -> Optional[Dict]:
        """リトライ機能付きエンゲージメント取得"""
        for attempt in range(self.max_retries):
            try:
                if platform == 'Instagram':
                    result = await self.get_instagram_engagement(post_url)
                elif platform == 'X':
                    result = await self.get_x_engagement(post_url)
                elif platform == 'Threads':
                    result = await self.get_threads_engagement(post_url)
                elif platform == 'Facebook':
                    result = await self.get_facebook_engagement(post_url)
                elif platform == 'Pinterest':
                    result = await self.get_pinterest_engagement(post_url)
                else:
                    print(f"❌ 未対応のプラットフォーム: {platform}")
                    return None
                
                if result:
                    return result
                
                print(f"⚠️ リトライ {attempt + 1}/{self.max_retries}")
                await asyncio.sleep(5)
            
            except Exception as e:
                print(f"❌ エラー (試行 {attempt + 1}/{self.max_retries}): {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(5)
        
        return None

async def main():
    """メイン関数"""
    if len(sys.argv) < 3:
        print("使い方: python get-engagement.py <platform> <post_url> [--headless] [--login-only]")
        print("platform: Instagram, X, Threads, Facebook, Pinterest")
        print("post_url: 投稿URL")
        print("--headless: ヘッドレスモードで実行")
        print("--login-only: ログインのみ実行（エンゲージメント取得なし）")
        sys.exit(1)
    
    platform = sys.argv[1]
    post_url = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else None
    headless = '--headless' in sys.argv
    login_only = '--login-only' in sys.argv
    
    scraper = EngagementScraper(headless=headless)
    
    try:
        await scraper.initialize()
        
        # ログインURLマッピング
        login_urls = {
            'Instagram': 'https://www.instagram.com/',
            'X': 'https://x.com/home',
            'Threads': 'https://www.threads.net/',
            'Facebook': 'https://www.facebook.com/',
            'Pinterest': 'https://www.pinterest.com/'
        }
        
        login_url = login_urls.get(platform)
        if not login_url:
            print(f"❌ 未対応のプラットフォーム: {platform}")
            sys.exit(1)
        
        # ログイン確認
        if not await scraper.ensure_login(platform, login_url):
            print(f"❌ {platform} へのログインに失敗しました")
            sys.exit(1)
        
        if login_only:
            print(f"✅ {platform} へのログイン完了")
            sys.exit(0)
        
        if not post_url:
            print("❌ 投稿URLが必要です")
            sys.exit(1)
        
        # エンゲージメント取得
        engagement = await scraper.get_engagement_with_retry(platform, post_url)
        
        if engagement:
            print("\n" + "="*50)
            print(json.dumps(engagement, ensure_ascii=False, indent=2))
            print("="*50)
            
            # 結果をファイルに保存
            output_file = Path('/tmp/engagement_data.json')
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(engagement, f, ensure_ascii=False, indent=2)
            
            print(f"\n✅ エンゲージメントデータを保存: {output_file}")
        else:
            print(f"\n❌ {platform} のエンゲージメント取得に失敗しました")
            sys.exit(1)
    
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        await scraper.close()

if __name__ == '__main__':
    asyncio.run(main())
