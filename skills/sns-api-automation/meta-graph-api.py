#!/usr/bin/env python3
"""
Meta Graph API SDK - Instagram, Facebook, Threads
提供機能: 投稿作成、削除、メディア管理
"""

import os
import requests
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import time
from urllib.parse import urlencode

class MetaGraphAPI:
    """Meta Graph API ラッパークラス"""
    
    def __init__(
        self,
        app_id: str = None,
        app_secret: str = None,
        access_token: str = None,
        ig_user_id: str = None,
        fb_page_id: str = None,
        api_version: str = "v18.0"
    ):
        """
        初期化
        
        Args:
            app_id: Meta App ID
            app_secret: Meta App Secret
            access_token: 長期アクセストークン
            ig_user_id: Instagram ビジネスアカウント ID
            fb_page_id: Facebook ページ ID
            api_version: Graph API バージョン（デフォルト: v18.0）
        """
        self.app_id = app_id or os.getenv("META_APP_ID")
        self.app_secret = app_secret or os.getenv("META_APP_SECRET")
        self.access_token = access_token or os.getenv("META_ACCESS_TOKEN")
        self.ig_user_id = ig_user_id or os.getenv("IG_USER_ID")
        self.fb_page_id = fb_page_id or os.getenv("FB_PAGE_ID")
        self.api_version = api_version
        self.base_url = f"https://graph.instagram.com/{api_version}"
        self.fb_base_url = f"https://graph.facebook.com/{api_version}"
        
        # 検証
        if not self.access_token:
            raise ValueError("META_ACCESS_TOKEN is required")
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None,
        base_url: str = None
    ) -> Dict:
        """
        API リクエスト実行
        
        Args:
            method: HTTP メソッド (GET, POST, DELETE)
            endpoint: API エンドポイント
            data: POST データ
            params: クエリパラメータ
            base_url: ベース URL (デフォルト: Instagram)
        
        Returns:
            API レスポンス（JSON）
        
        Raises:
            Exception: API エラー時
        """
        url_base = base_url or self.base_url
        url = f"{url_base}/{endpoint}"
        
        # パラメータにトークンを追加
        if params is None:
            params = {}
        params["access_token"] = self.access_token
        
        headers = {"Content-Type": "application/json"}
        
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
            if response.status_code >= 400:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", response.text)
                raise Exception(f"API Error ({response.status_code}): {error_msg}")
            
            return response.json() if response.text else {}
        
        except requests.exceptions.Timeout:
            raise Exception("Request timeout - API server not responding")
        except requests.exceptions.ConnectionError:
            raise Exception("Connection error - check network connectivity")
        except json.JSONDecodeError:
            raise Exception(f"Invalid JSON response: {response.text}")
    
    # ============ Instagram API ============
    
    def create_instagram_post(
        self,
        caption: str,
        image_url: str,
        ig_user_id: str = None,
        media_type: str = "IMAGE"
    ) -> Dict:
        """
        Instagram に投稿を作成
        
        Args:
            caption: 投稿テキスト
            image_url: 画像 URL
            ig_user_id: Instagram ユーザー ID（デフォルト: self.ig_user_id）
            media_type: メディアタイプ ("IMAGE" or "VIDEO")
        
        Returns:
            投稿 ID を含むレスポンス
        
        Example:
            result = api.create_instagram_post(
                caption="Hello World!",
                image_url="https://example.com/image.jpg"
            )
            print(result["id"])
        """
        ig_user_id = ig_user_id or self.ig_user_id
        if not ig_user_id:
            raise ValueError("ig_user_id is required")
        
        # ステップ1: メディアオブジェクト作成
        media_data = {
            "image_url": image_url,
            "caption": caption,
            "media_type": media_type
        }
        
        media_response = self._make_request(
            "POST",
            f"{ig_user_id}/media",
            data=media_data
        )
        
        if "error" in media_response:
            raise Exception(f"Media creation failed: {media_response['error']}")
        
        media_id = media_response.get("id")
        print(f"[INFO] メディアオブジェクト作成: {media_id}")
        
        # ステップ2: メディアを公開
        time.sleep(2)  # Instagram の API 処理待機
        
        publish_response = self._make_request(
            "POST",
            f"{ig_user_id}/media_publish",
            data={"creation_id": media_id}
        )
        
        if "error" in publish_response:
            raise Exception(f"Media publish failed: {publish_response['error']}")
        
        post_id = publish_response.get("id")
        print(f"[INFO] 投稿公開完了: {post_id}")
        
        return {
            "id": post_id,
            "media_id": media_id,
            "timestamp": datetime.now().isoformat()
        }
    
    def delete_instagram_post(self, media_id: str) -> bool:
        """
        Instagram の投稿を削除
        
        Args:
            media_id: メディア ID
        
        Returns:
            成功: True
        
        Example:
            success = api.delete_instagram_post("18000000000000001")
        """
        response = self._make_request(
            "DELETE",
            f"{media_id}"
        )
        
        if response.get("success", False):
            print(f"[INFO] 投稿削除完了: {media_id}")
            return True
        else:
            raise Exception(f"Delete failed: {response}")
    
    def get_instagram_post(self, media_id: str) -> Dict:
        """
        Instagram の投稿情報を取得
        
        Args:
            media_id: メディア ID
        
        Returns:
            投稿情報
        """
        response = self._make_request(
            "GET",
            f"{media_id}",
            params={
                "fields": "id,caption,timestamp,media_type,media_url,like_count,comments_count"
            }
        )
        return response
    
    # ============ Facebook API ============
    
    def create_facebook_post(
        self,
        message: str,
        picture_url: str = None,
        link_url: str = None,
        page_id: str = None
    ) -> Dict:
        """
        Facebook ページに投稿を作成
        
        Args:
            message: 投稿テキスト
            picture_url: 画像 URL
            link_url: リンク URL
            page_id: Facebook ページ ID（デフォルト: self.fb_page_id）
        
        Returns:
            投稿 ID を含むレスポンス
        """
        page_id = page_id or self.fb_page_id
        if not page_id:
            raise ValueError("page_id is required")
        
        data = {"message": message}
        if picture_url:
            data["picture"] = picture_url
        if link_url:
            data["link"] = link_url
        
        response = self._make_request(
            "POST",
            f"{page_id}/feed",
            data=data,
            base_url=self.fb_base_url
        )
        
        post_id = response.get("id")
        print(f"[INFO] Facebook 投稿作成: {post_id}")
        
        return {
            "id": post_id,
            "timestamp": datetime.now().isoformat()
        }
    
    def delete_facebook_post(self, post_id: str) -> bool:
        """
        Facebook の投稿を削除
        
        Args:
            post_id: 投稿 ID
        
        Returns:
            成功: True
        """
        response = self._make_request(
            "DELETE",
            f"{post_id}",
            base_url=self.fb_base_url
        )
        
        if response.get("success", False):
            print(f"[INFO] Facebook 投稿削除: {post_id}")
            return True
        else:
            raise Exception(f"Delete failed: {response}")
    
    def get_facebook_post(self, post_id: str) -> Dict:
        """
        Facebook の投稿情報を取得
        
        Args:
            post_id: 投稿 ID
        
        Returns:
            投稿情報
        """
        response = self._make_request(
            "GET",
            f"{post_id}",
            params={
                "fields": "id,message,created_time,type,link,picture,shares,likes.summary(true)"
            },
            base_url=self.fb_base_url
        )
        return response
    
    # ============ Threads API (プレビュー段階) ============
    
    def create_threads_post(
        self,
        text: str,
        image_url: str = None,
        ig_user_id: str = None
    ) -> Dict:
        """
        Threads に投稿を作成（プレビュー段階）
        
        Args:
            text: 投稿テキスト
            image_url: 画像 URL（オプション）
            ig_user_id: Instagram ユーザー ID
        
        Returns:
            投稿 ID を含むレスポンス
        
        Note:
            Threads API は現在プレビュー段階です。
            変更される可能性があります。
        """
        ig_user_id = ig_user_id or self.ig_user_id
        if not ig_user_id:
            raise ValueError("ig_user_id is required")
        
        data = {"text": text}
        if image_url:
            data["image_url"] = image_url
        
        try:
            response = self._make_request(
                "POST",
                f"{ig_user_id}/threads",
                data=data
            )
            
            post_id = response.get("id")
            print(f"[INFO] Threads 投稿作成: {post_id}")
            
            return {
                "id": post_id,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            print(f"[WARNING] Threads API はプレビュー段階です: {e}")
            raise
    
    def delete_threads_post(self, threads_post_id: str) -> bool:
        """
        Threads の投稿を削除
        
        Args:
            threads_post_id: Threads 投稿 ID
        
        Returns:
            成功: True
        """
        response = self._make_request(
            "DELETE",
            f"{threads_post_id}"
        )
        
        if response.get("success", False):
            print(f"[INFO] Threads 投稿削除: {threads_post_id}")
            return True
        else:
            raise Exception(f"Delete failed: {response}")
    
    # ============ Token Management ============
    
    def get_token_info(self) -> Dict:
        """
        現在のアクセストークン情報を取得
        
        Returns:
            トークン情報（有効期限など）
        """
        response = self._make_request(
            "GET",
            "me",
            params={"fields": "id,name"}
        )
        return response
    
    def validate_token(self) -> Tuple[bool, str]:
        """
        アクセストークンの有効性を検証
        
        Returns:
            (有効性, メッセージ)
        """
        try:
            response = self._make_request(
                "GET",
                "me",
                params={"fields": "id"}
            )
            if "id" in response:
                return True, "Token is valid"
            else:
                return False, "Invalid token response"
        except Exception as e:
            return False, str(e)


# ============ ユーティリティ関数 ============

def load_config_from_env() -> MetaGraphAPI:
    """
    環境変数から MetaGraphAPI インスタンスを作成
    
    Returns:
        MetaGraphAPI インスタンス
    """
    return MetaGraphAPI(
        app_id=os.getenv("META_APP_ID"),
        app_secret=os.getenv("META_APP_SECRET"),
        access_token=os.getenv("META_ACCESS_TOKEN"),
        ig_user_id=os.getenv("IG_USER_ID"),
        fb_page_id=os.getenv("FB_PAGE_ID")
    )


# ============ テスト ============

if __name__ == "__main__":
    # 環境変数から API インスタンスを作成
    try:
        api = load_config_from_env()
        print("✓ MetaGraphAPI インスタンス作成完了")
        
        # トークン検証
        valid, msg = api.validate_token()
        if valid:
            print(f"✓ トークン検証: {msg}")
        else:
            print(f"✗ トークン検証失敗: {msg}")
    
    except Exception as e:
        print(f"✗ エラー: {e}")
