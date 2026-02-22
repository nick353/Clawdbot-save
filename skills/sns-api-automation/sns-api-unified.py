#!/usr/bin/env python3
"""
SNS API 統合インターフェース
- Meta Graph API（Instagram/Facebook/Threads）
- X API（Tweet）
- Pinterest API
- スケジューラー、エラーハンドリング、リトライロジック
"""

import os
import sys
import json
import time
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import schedule

# ローカルモジュールをインポート
from meta_graph_api import MetaGraphAPI, load_config_from_env as load_meta
from x_api import XApi, load_config_from_env as load_x
from pinterest_api import PinterestApi, load_config_from_env as load_pinterest


# ============ ログ設定 ============

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/root/clawd/logs/sns-api.log")
    ]
)
logger = logging.getLogger(__name__)


# ============ Enums ============

class SNSPlatform(Enum):
    """SNS プラットフォーム"""
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    THREADS = "threads"
    X = "x"
    PINTEREST = "pinterest"


class RetryStrategy(Enum):
    """リトライ戦略"""
    EXPONENTIAL = "exponential"  # 指数バックオフ
    LINEAR = "linear"             # 線形バックオフ
    FIXED = "fixed"               # 固定間隔


# ============ 設定クラス ============

class SNSConfig:
    """SNS API 設定"""
    
    def __init__(self):
        self.meta = None
        self.x = None
        self.pinterest = None
        self._load_apis()
    
    def _load_apis(self):
        """環境変数から API インスタンスをロード"""
        try:
            self.meta = load_meta()
            logger.info("✓ Meta Graph API ロード完了")
        except Exception as e:
            logger.warning(f"✗ Meta API ロード失敗: {e}")
        
        try:
            self.x = load_x()
            logger.info("✓ X API ロード完了")
        except Exception as e:
            logger.warning(f"✗ X API ロード失敗: {e}")
        
        try:
            self.pinterest = load_pinterest()
            logger.info("✓ Pinterest API ロード完了")
        except Exception as e:
            logger.warning(f"✗ Pinterest API ロード失敗: {e}")


# ============ リトライロジック ============

class RetryHandler:
    """リトライ処理ハンドラー"""
    
    def __init__(
        self,
        max_retries: int = 3,
        strategy: RetryStrategy = RetryStrategy.EXPONENTIAL,
        base_delay: int = 2
    ):
        """
        初期化
        
        Args:
            max_retries: 最大リトライ回数
            strategy: リトライ戦略
            base_delay: 基本遅延時間（秒）
        """
        self.max_retries = max_retries
        self.strategy = strategy
        self.base_delay = base_delay
    
    def get_delay(self, retry_count: int) -> float:
        """
        リトライ待機時間を取得
        
        Args:
            retry_count: リトライ回数（0 から始まる）
        
        Returns:
            待機時間（秒）
        """
        if self.strategy == RetryStrategy.EXPONENTIAL:
            return self.base_delay * (2 ** retry_count)
        elif self.strategy == RetryStrategy.LINEAR:
            return self.base_delay * (retry_count + 1)
        else:  # FIXED
            return self.base_delay
    
    def execute(self, func, *args, **kwargs):
        """
        関数を実行し、失敗時にリトライ
        
        Args:
            func: 実行する関数
            *args: 位置引数
            **kwargs: キーワード引数
        
        Returns:
            関数の戻り値
        
        Raises:
            Exception: 最大リトライ回数に達した場合
        """
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                
                if attempt < self.max_retries:
                    delay = self.get_delay(attempt)
                    logger.warning(
                        f"リトライ {attempt + 1}/{self.max_retries} "
                        f"({delay}秒後): {str(e)}"
                    )
                    time.sleep(delay)
                else:
                    logger.error(f"最大リトライ回数到達: {str(e)}")
        
        raise last_exception


# ============ 統合インターフェース ============

class SNSUnifiedAPI:
    """SNS 統合API インターフェース"""
    
    def __init__(
        self,
        config: SNSConfig = None,
        retry_handler: RetryHandler = None
    ):
        """
        初期化
        
        Args:
            config: SNS 設定
            retry_handler: リトライハンドラー
        """
        self.config = config or SNSConfig()
        self.retry_handler = retry_handler or RetryHandler()
        self.post_history = []  # 投稿履歴（スケジューラー用）
    
    # ============ 投稿作成 ============
    
    def post(
        self,
        platforms: List[SNSPlatform],
        text: str,
        image_url: str = None,
        video_url: str = None,
        link_url: str = None,
        schedule_time: datetime = None
    ) -> Dict[str, Dict]:
        """
        複数の SNS に同時投稿
        
        Args:
            platforms: 投稿先プラットフォーム一覧
            text: 投稿テキスト
            image_url: 画像 URL
            video_url: 動画 URL
            link_url: リンク URL
            schedule_time: スケジュール時刻（None = 即座投稿）
        
        Returns:
            プラットフォーム別投稿結果
        
        Example:
            results = api.post(
                platforms=[SNSPlatform.INSTAGRAM, SNSPlatform.X],
                text="Hello World!",
                image_url="https://example.com/image.jpg"
            )
            print(results["instagram"]["id"])
        """
        if schedule_time:
            return self._schedule_post(
                platforms=platforms,
                text=text,
                image_url=image_url,
                video_url=video_url,
                link_url=link_url,
                schedule_time=schedule_time
            )
        
        results = {}
        
        for platform in platforms:
            try:
                logger.info(f"投稿開始: {platform.value}")
                
                if platform == SNSPlatform.INSTAGRAM:
                    result = self.retry_handler.execute(
                        self._post_instagram,
                        text, image_url
                    )
                elif platform == SNSPlatform.FACEBOOK:
                    result = self.retry_handler.execute(
                        self._post_facebook,
                        text, image_url, link_url
                    )
                elif platform == SNSPlatform.THREADS:
                    result = self.retry_handler.execute(
                        self._post_threads,
                        text, image_url
                    )
                elif platform == SNSPlatform.X:
                    result = self.retry_handler.execute(
                        self._post_x,
                        text, image_url
                    )
                elif platform == SNSPlatform.PINTEREST:
                    result = self.retry_handler.execute(
                        self._post_pinterest,
                        text, image_url, link_url
                    )
                else:
                    raise ValueError(f"Unknown platform: {platform}")
                
                results[platform.value] = {
                    "success": True,
                    "data": result
                }
                logger.info(f"✓ {platform.value} 投稿成功")
            
            except Exception as e:
                results[platform.value] = {
                    "success": False,
                    "error": str(e)
                }
                logger.error(f"✗ {platform.value} 投稿失敗: {str(e)}")
        
        # 投稿履歴に記録
        self.post_history.append({
            "timestamp": datetime.now(),
            "platforms": [p.value for p in platforms],
            "results": results
        })
        
        return results
    
    # ============ 個別プラットフォーム投稿 ============
    
    def _post_instagram(self, caption: str, image_url: str) -> Dict:
        """Instagram に投稿"""
        if not self.config.meta:
            raise Exception("Meta API not configured")
        return self.config.meta.create_instagram_post(caption, image_url)
    
    def _post_facebook(self, message: str, picture_url: str, link_url: str) -> Dict:
        """Facebook に投稿"""
        if not self.config.meta:
            raise Exception("Meta API not configured")
        return self.config.meta.create_facebook_post(message, picture_url, link_url)
    
    def _post_threads(self, text: str, image_url: str) -> Dict:
        """Threads に投稿"""
        if not self.config.meta:
            raise Exception("Meta API not configured")
        return self.config.meta.create_threads_post(text, image_url)
    
    def _post_x(self, text: str, image_url: str = None) -> Dict:
        """X に投稿"""
        if not self.config.x:
            raise Exception("X API not configured")
        return self.config.x.create_tweet(text)
    
    def _post_pinterest(self, note: str, image_url: str, link_url: str = None) -> Dict:
        """Pinterest に投稿"""
        if not self.config.pinterest:
            raise Exception("Pinterest API not configured")
        
        # ボード取得
        boards = self.config.pinterest.get_user_boards()
        if not boards:
            raise Exception("No Pinterest boards found")
        
        board_id = boards[0]["id"]  # 最初のボード使用
        return self.config.pinterest.create_pin(board_id, note, image_url, link_url)
    
    # ============ 削除機能 ============
    
    def delete(
        self,
        platform: SNSPlatform,
        post_id: str
    ) -> bool:
        """
        投稿を削除
        
        Args:
            platform: プラットフォーム
            post_id: 投稿 ID
        
        Returns:
            成功: True
        
        Example:
            success = api.delete(SNSPlatform.INSTAGRAM, "18000000000000001")
        """
        try:
            logger.info(f"削除開始: {platform.value} (ID: {post_id})")
            
            if platform == SNSPlatform.INSTAGRAM:
                result = self.retry_handler.execute(
                    self.config.meta.delete_instagram_post, post_id
                )
            elif platform == SNSPlatform.FACEBOOK:
                result = self.retry_handler.execute(
                    self.config.meta.delete_facebook_post, post_id
                )
            elif platform == SNSPlatform.THREADS:
                result = self.retry_handler.execute(
                    self.config.meta.delete_threads_post, post_id
                )
            elif platform == SNSPlatform.X:
                result = self.retry_handler.execute(
                    self.config.x.delete_tweet, post_id
                )
            elif platform == SNSPlatform.PINTEREST:
                result = self.retry_handler.execute(
                    self.config.pinterest.delete_pin, post_id
                )
            else:
                raise ValueError(f"Unknown platform: {platform}")
            
            logger.info(f"✓ {platform.value} 削除成功")
            return result
        
        except Exception as e:
            logger.error(f"✗ {platform.value} 削除失敗: {str(e)}")
            raise
    
    # ============ スケジューラー ============
    
    def _schedule_post(
        self,
        platforms: List[SNSPlatform],
        text: str,
        image_url: str = None,
        video_url: str = None,
        link_url: str = None,
        schedule_time: datetime = None
    ) -> Dict:
        """
        投稿をスケジュール
        
        Args:
            schedule_time: スケジュール時刻
        
        Returns:
            スケジュール情報
        """
        delay_seconds = (schedule_time - datetime.now()).total_seconds()
        
        if delay_seconds <= 0:
            raise ValueError("schedule_time must be in the future")
        
        logger.info(
            f"投稿スケジュール: {delay_seconds}秒後 "
            f"({', '.join([p.value for p in platforms])})"
        )
        
        job_id = f"post_{int(datetime.now().timestamp())}_{len(self.post_history)}"
        
        # スケジュール登録
        schedule.at(schedule_time.strftime("%H:%M")).do(
            self.post,
            platforms=platforms,
            text=text,
            image_url=image_url,
            video_url=video_url,
            link_url=link_url
        )
        
        return {
            "job_id": job_id,
            "platforms": [p.value for p in platforms],
            "scheduled_time": schedule_time.isoformat(),
            "delay_seconds": delay_seconds
        }
    
    def run_scheduler(self):
        """スケジューラーを実行（バックグラウンドで継続実行）"""
        logger.info("SNS スケジューラー開始")
        while True:
            schedule.run_pending()
            time.sleep(60)  # 1 分ごとにチェック
    
    # ============ 検索・分析 ============
    
    def search_buzz(
        self,
        platform: SNSPlatform,
        query: str,
        min_engagement: int = 100
    ) -> List[Dict]:
        """
        バズツイート・ピンを検索
        
        Args:
            platform: プラットフォーム
            query: 検索クエリ
            min_engagement: 最小エンゲージメント数
        
        Returns:
            バズコンテンツ一覧
        """
        try:
            if platform == SNSPlatform.X:
                return self.config.x.search_tweets_by_keyword(
                    query,
                    min_likes=min_engagement // 2,
                    min_retweets=min_engagement // 4
                )
            elif platform == SNSPlatform.PINTEREST:
                return self.config.pinterest.search_pins(query, limit=50)
            else:
                raise ValueError(f"Buzz search not supported for {platform.value}")
        
        except Exception as e:
            logger.error(f"バズ検索失敗: {str(e)}")
            raise
    
    def get_trending(self, platform: SNSPlatform) -> List[Dict]:
        """
        トレンドコンテンツを取得
        
        Args:
            platform: プラットフォーム
        
        Returns:
            トレンドコンテンツ一覧
        """
        try:
            if platform == SNSPlatform.X:
                return self.config.x.get_trending_tweets(max_results=50)
            else:
                raise ValueError(f"Trending not supported for {platform.value}")
        
        except Exception as e:
            logger.error(f"トレンド取得失敗: {str(e)}")
            raise
    
    # ============ 統計情報 ============
    
    def get_post_history(self) -> List[Dict]:
        """
        投稿履歴を取得
        
        Returns:
            投稿履歴
        """
        return self.post_history
    
    def get_stats(self) -> Dict:
        """
        投稿統計を取得
        
        Returns:
            統計情報
        """
        total_posts = len(self.post_history)
        successful = sum(
            1 for h in self.post_history
            if all(r["success"] for r in h["results"].values())
        )
        
        platform_stats = {}
        for history in self.post_history:
            for platform, result in history["results"].items():
                if platform not in platform_stats:
                    platform_stats[platform] = {"success": 0, "failed": 0}
                
                if result["success"]:
                    platform_stats[platform]["success"] += 1
                else:
                    platform_stats[platform]["failed"] += 1
        
        return {
            "total_posts": total_posts,
            "successful": successful,
            "failed": total_posts - successful,
            "success_rate": (successful / total_posts * 100) if total_posts > 0 else 0,
            "platform_stats": platform_stats
        }


# ============ ユーティリティ関数 ============

def create_api() -> SNSUnifiedAPI:
    """SNS 統合API インスタンスを作成"""
    return SNSUnifiedAPI()


# ============ テスト ============

if __name__ == "__main__":
    api = create_api()
    print("✓ SNS 統合API インスタンス作成完了")
    
    # 設定確認
    print("\n=== API 設定確認 ===")
    if api.config.meta:
        print("✓ Meta API 使用可能")
    if api.config.x:
        print("✓ X API 使用可能")
    if api.config.pinterest:
        print("✓ Pinterest API 使用可能")
