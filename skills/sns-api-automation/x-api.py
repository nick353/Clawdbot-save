#!/usr/bin/env python3
"""
X API v2 SDK - Tweet Management
提供機能: ツイート投稿、削除、検索、バズ分析
"""

import os
import requests
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import time

class XApi:
    """X API v2 ラッパークラス"""
    
    def __init__(
        self,
        bearer_token: str = None,
        api_key: str = None,
        api_secret: str = None,
        user_id: str = None
    ):
        """
        初期化
        
        Args:
            bearer_token: OAuth 2.0 Bearer Token
            api_key: API Key (Consumer Key)
            api_secret: API Secret (Consumer Secret)
            user_id: ユーザー ID
        """
        self.bearer_token = bearer_token or os.getenv("X_BEARER_TOKEN")
        self.api_key = api_key or os.getenv("X_API_KEY")
        self.api_secret = api_secret or os.getenv("X_API_SECRET")
        self.user_id = user_id or os.getenv("X_USER_ID")
        
        self.base_url = "https://api.twitter.com/2"
        
        # 検証
        if not self.bearer_token:
            raise ValueError("X_BEARER_TOKEN is required")
    
    def _get_headers(self) -> Dict:
        """
        API リクエストヘッダーを作成
        
        Returns:
            ヘッダーディクショナリ
        """
        return {
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json",
            "User-Agent": "SNS-Auto-Poster/1.0"
        }
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None
    ) -> Dict:
        """
        API リクエスト実行
        
        Args:
            method: HTTP メソッド (GET, POST, DELETE)
            endpoint: API エンドポイント
            data: POST データ
            params: クエリパラメータ
        
        Returns:
            API レスポンス（JSON）
        
        Raises:
            Exception: API エラー時
        """
        url = f"{self.base_url}/{endpoint}"
        headers = self._get_headers()
        
        try:
            if method == "GET":
                response = requests.get(url, params=params, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, params=params, headers=headers, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, params=params, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # ステータスコード確認
            if response.status_code == 429:
                raise Exception("Rate limit exceeded - wait before retrying")
            elif response.status_code >= 400:
                error_data = response.json()
                error_msg = error_data.get("detail", response.text)
                raise Exception(f"API Error ({response.status_code}): {error_msg}")
            
            return response.json() if response.text else {}
        
        except requests.exceptions.Timeout:
            raise Exception("Request timeout - API server not responding")
        except requests.exceptions.ConnectionError:
            raise Exception("Connection error - check network connectivity")
        except json.JSONDecodeError:
            raise Exception(f"Invalid JSON response: {response.text}")
    
    # ============ Tweet Management ============
    
    def create_tweet(
        self,
        text: str,
        media_ids: List[str] = None,
        reply_to_tweet_id: str = None,
        quote_tweet_id: str = None
    ) -> Dict:
        """
        ツイートを投稿
        
        Args:
            text: ツイートテキスト（最大 280 文字）
            media_ids: メディア ID リスト（オプション）
            reply_to_tweet_id: リプライ先ツイート ID
            quote_tweet_id: 引用元ツイート ID
        
        Returns:
            投稿されたツイート情報
        
        Example:
            result = api.create_tweet(text="Hello World!")
            print(result["data"]["id"])
        
        Raises:
            Exception: テキスト長が 280 文字を超える場合
        """
        # バリデーション
        if len(text) > 280:
            raise ValueError(f"Tweet text exceeds 280 characters (got {len(text)})")
        
        data = {"text": text}
        
        # オプションパラメータ
        if media_ids:
            data["media"] = {
                "media_ids": media_ids
            }
        
        if reply_to_tweet_id:
            data["reply"] = {
                "in_reply_to_tweet_id": reply_to_tweet_id
            }
        
        if quote_tweet_id:
            data["quote_tweet_id"] = quote_tweet_id
        
        response = self._make_request(
            "POST",
            "tweets",
            data=data
        )
        
        tweet_id = response.get("data", {}).get("id")
        print(f"[INFO] ツイート投稿: {tweet_id}")
        
        return response
    
    def delete_tweet(self, tweet_id: str) -> bool:
        """
        ツイートを削除
        
        Args:
            tweet_id: ツイート ID
        
        Returns:
            成功: True
        
        Example:
            success = api.delete_tweet("1234567890")
        """
        response = self._make_request(
            "DELETE",
            f"tweets/{tweet_id}"
        )
        
        if response.get("data", {}).get("deleted", False):
            print(f"[INFO] ツイート削除: {tweet_id}")
            return True
        else:
            raise Exception(f"Delete failed: {response}")
    
    def get_tweet(self, tweet_id: str) -> Dict:
        """
        ツイート情報を取得
        
        Args:
            tweet_id: ツイート ID
        
        Returns:
            ツイート情報
        """
        response = self._make_request(
            "GET",
            f"tweets/{tweet_id}",
            params={
                "tweet.fields": "created_at,author_id,public_metrics,conversation_id",
                "expansions": "author_id",
                "user.fields": "username,created_at,public_metrics"
            }
        )
        return response
    
    # ============ Media Upload ============
    
    def upload_media(
        self,
        file_path: str,
        media_type: str = "image"
    ) -> Dict:
        """
        メディア（画像/動画）をアップロード
        
        Args:
            file_path: ファイルパス
            media_type: メディアタイプ ("image" or "video")
        
        Returns:
            メディア ID を含むレスポンス
        
        Note:
            X API v2 は media/upload エンドポイントを使用します
        """
        with open(file_path, "rb") as f:
            files = {"media": f}
            
            # メディアアップロード用 URL（v1.1）
            media_upload_url = "https://upload.twitter.com/1.1/media/upload.json"
            
            response = requests.post(
                media_upload_url,
                files=files,
                headers={"Authorization": f"Bearer {self.bearer_token}"},
                timeout=60
            )
            
            if response.status_code >= 400:
                raise Exception(f"Media upload failed: {response.text}")
            
            media_data = response.json()
            media_id = media_data.get("media_id_string")
            print(f"[INFO] メディアアップロード: {media_id}")
            
            return {
                "media_id": media_id,
                "media_key": media_data.get("media_key"),
                "type": media_type
            }
    
    # ============ Tweet Search (Buzz Analysis) ============
    
    def search_recent_tweets(
        self,
        query: str,
        max_results: int = 100,
        start_time: str = None,
        end_time: str = None
    ) -> Dict:
        """
        過去 7 日間のツイートを検索（バズ分析用）
        
        Args:
            query: 検索クエリ
            max_results: 最大結果数（1-100、デフォルト: 100）
            start_time: 開始時刻（ISO 8601 形式）
            end_time: 終了時刻（ISO 8601 形式）
        
        Returns:
            検索結果
        
        Example:
            results = api.search_recent_tweets(
                query="python OR #python",
                max_results=50
            )
            print(f"Found {len(results['data'])} tweets")
        """
        params = {
            "query": query,
            "max_results": min(max_results, 100),
            "tweet.fields": "created_at,author_id,public_metrics,language",
            "expansions": "author_id",
            "user.fields": "username,followers_count,verified",
            "sort_order": "recency"
        }
        
        if start_time:
            params["start_time"] = start_time
        if end_time:
            params["end_time"] = end_time
        
        response = self._make_request(
            "GET",
            "tweets/search/recent",
            params=params
        )
        
        return response
    
    def search_tweets_by_keyword(
        self,
        keyword: str,
        min_likes: int = 0,
        min_retweets: int = 0,
        max_results: int = 100
    ) -> List[Dict]:
        """
        キーワード検索してバズツイートを抽出
        
        Args:
            keyword: 検索キーワード
            min_likes: 最小いいね数フィルター
            min_retweets: 最小リツイート数フィルター
            max_results: 最大結果数
        
        Returns:
            バズツイート一覧
        
        Example:
            buzz_tweets = api.search_tweets_by_keyword(
                "AI",
                min_likes=1000,
                min_retweets=500
            )
            for tweet in buzz_tweets:
                print(f"{tweet['username']}: {tweet['text']}")
        """
        response = self.search_recent_tweets(query=keyword, max_results=max_results)
        
        tweets = response.get("data", [])
        users = {u["id"]: u for u in response.get("includes", {}).get("users", [])}
        
        # フィルタリング
        buzz_tweets = []
        for tweet in tweets:
            metrics = tweet.get("public_metrics", {})
            if (metrics.get("like_count", 0) >= min_likes and 
                metrics.get("retweet_count", 0) >= min_retweets):
                
                user_info = users.get(tweet.get("author_id"), {})
                buzz_tweets.append({
                    "id": tweet["id"],
                    "text": tweet["text"],
                    "username": user_info.get("username", "unknown"),
                    "likes": metrics.get("like_count", 0),
                    "retweets": metrics.get("retweet_count", 0),
                    "replies": metrics.get("reply_count", 0),
                    "created_at": tweet.get("created_at")
                })
        
        print(f"[INFO] バズツイート発見: {len(buzz_tweets)} 件")
        
        return buzz_tweets
    
    def get_trending_tweets(
        self,
        max_results: int = 50,
        hours: int = 24
    ) -> List[Dict]:
        """
        直近のトレンドツイートを取得
        
        Args:
            max_results: 最大結果数
            hours: 過去 N 時間のツイート
        
        Returns:
            トレンドツイート一覧
        """
        start_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"
        
        response = self.search_recent_tweets(
            query="has:engagement",
            max_results=max_results,
            start_time=start_time
        )
        
        tweets = response.get("data", [])
        users = {u["id"]: u for u in response.get("includes", {}).get("users", [])}
        
        # エンゲージメント順でソート
        trending = []
        for tweet in tweets:
            metrics = tweet.get("public_metrics", {})
            engagement = (
                metrics.get("like_count", 0) * 1 +
                metrics.get("retweet_count", 0) * 2 +
                metrics.get("reply_count", 0) * 3
            )
            
            user_info = users.get(tweet.get("author_id"), {})
            trending.append({
                "id": tweet["id"],
                "text": tweet["text"],
                "username": user_info.get("username", "unknown"),
                "engagement_score": engagement,
                "likes": metrics.get("like_count", 0),
                "retweets": metrics.get("retweet_count", 0),
                "created_at": tweet.get("created_at")
            })
        
        # エンゲージメントスコア降順でソート
        trending.sort(key=lambda x: x["engagement_score"], reverse=True)
        
        return trending
    
    # ============ Authentication ============
    
    def validate_token(self) -> Tuple[bool, str]:
        """
        ベアラートークンの有効性を検証
        
        Returns:
            (有効性, メッセージ)
        """
        try:
            response = self._make_request(
                "GET",
                "users/me"
            )
            if "data" in response:
                username = response["data"].get("username")
                return True, f"Token is valid (@{username})"
            else:
                return False, "Invalid token response"
        except Exception as e:
            return False, str(e)
    
    def get_user_info(self, user_id: str = None) -> Dict:
        """
        ユーザー情報を取得
        
        Args:
            user_id: ユーザー ID（デフォルト: self.user_id）
        
        Returns:
            ユーザー情報
        """
        user_id = user_id or self.user_id
        if not user_id:
            raise ValueError("user_id is required")
        
        response = self._make_request(
            "GET",
            f"users/{user_id}",
            params={
                "user.fields": "created_at,verified,public_metrics"
            }
        )
        return response


# ============ ユーティリティ関数 ============

def load_config_from_env() -> XApi:
    """
    環境変数から XApi インスタンスを作成
    
    Returns:
        XApi インスタンス
    """
    return XApi(
        bearer_token=os.getenv("X_BEARER_TOKEN"),
        api_key=os.getenv("X_API_KEY"),
        api_secret=os.getenv("X_API_SECRET"),
        user_id=os.getenv("X_USER_ID")
    )


# ============ テスト ============

if __name__ == "__main__":
    try:
        api = load_config_from_env()
        print("✓ X API インスタンス作成完了")
        
        # トークン検証
        valid, msg = api.validate_token()
        if valid:
            print(f"✓ トークン検証: {msg}")
        else:
            print(f"✗ トークン検証失敗: {msg}")
    
    except Exception as e:
        print(f"✗ エラー: {e}")
