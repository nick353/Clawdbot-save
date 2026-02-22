#!/usr/bin/env python3
"""
Pinterest API SDK
提供機能: ピン作成、削除、ボード管理、検索
"""

import os
import requests
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import time

class PinterestApi:
    """Pinterest API ラッパークラス"""
    
    def __init__(
        self,
        app_id: str = None,
        app_secret: str = None,
        access_token: str = None,
        refresh_token: str = None,
        user_id: str = None,
        api_version: str = "v1"
    ):
        """
        初期化
        
        Args:
            app_id: Pinterest App ID
            app_secret: Pinterest App Secret
            access_token: Access Token
            refresh_token: Refresh Token
            user_id: Pinterest User ID
            api_version: API バージョン（デフォルト: v1）
        """
        self.app_id = app_id or os.getenv("PINTEREST_APP_ID")
        self.app_secret = app_secret or os.getenv("PINTEREST_APP_SECRET")
        self.access_token = access_token or os.getenv("PINTEREST_ACCESS_TOKEN")
        self.refresh_token = refresh_token or os.getenv("PINTEREST_REFRESH_TOKEN")
        self.user_id = user_id or os.getenv("PINTEREST_USER_ID")
        self.api_version = api_version
        
        self.base_url = f"https://api.pinterest.com/{api_version}"
        self.oauth_url = "https://api.pinterest.com/oauth"
        
        # 検証
        if not self.access_token:
            raise ValueError("PINTEREST_ACCESS_TOKEN is required")
    
    def _get_headers(self) -> Dict:
        """
        API リクエストヘッダーを作成
        
        Returns:
            ヘッダーディクショナリ
        """
        return {
            "Authorization": f"Bearer {self.access_token}",
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
                raise Exception("Rate limit exceeded - wait 4+ seconds before retrying")
            elif response.status_code >= 400:
                error_data = response.json()
                error_msg = error_data.get("message", response.text)
                raise Exception(f"API Error ({response.status_code}): {error_msg}")
            
            return response.json() if response.text else {}
        
        except requests.exceptions.Timeout:
            raise Exception("Request timeout - API server not responding")
        except requests.exceptions.ConnectionError:
            raise Exception("Connection error - check network connectivity")
        except json.JSONDecodeError:
            raise Exception(f"Invalid JSON response: {response.text}")
    
    # ============ Pin Management ============
    
    def create_pin(
        self,
        board_id: str,
        note: str,
        image_url: str,
        link_url: str = None
    ) -> Dict:
        """
        ピンを作成
        
        Args:
            board_id: ボード ID
            note: ピンの説明テキスト
            image_url: 画像 URL（HTTPS、最小 100x100px）
            link_url: リンク URL（オプション）
        
        Returns:
            作成されたピン情報
        
        Example:
            result = api.create_pin(
                board_id="123456789",
                note="Beautiful sunset",
                image_url="https://example.com/image.jpg",
                link_url="https://example.com"
            )
            print(result["id"])
        
        Raises:
            ValueError: image_url が HTTPS でない場合
        """
        # バリデーション
        if not image_url.startswith("https://"):
            raise ValueError("image_url must be HTTPS")
        
        data = {
            "board_id": board_id,
            "note": note,
            "image_url": image_url
        }
        
        if link_url:
            data["link"] = link_url
        
        response = self._make_request(
            "POST",
            "pins",
            data=data
        )
        
        pin_id = response.get("id")
        print(f"[INFO] ピン作成: {pin_id}")
        
        # Rate limit 対策
        time.sleep(4)
        
        return response
    
    def delete_pin(self, pin_id: str) -> bool:
        """
        ピンを削除
        
        Args:
            pin_id: ピン ID
        
        Returns:
            成功: True
        
        Example:
            success = api.delete_pin("1234567890")
        """
        response = self._make_request(
            "DELETE",
            f"pins/{pin_id}"
        )
        
        # Pinterest API は DELETE 成功時に空レスポンスを返す
        # または {"success": true} を返す
        if response.get("success", True):
            print(f"[INFO] ピン削除: {pin_id}")
            
            # Rate limit 対策
            time.sleep(4)
            
            return True
        else:
            raise Exception(f"Delete failed: {response}")
    
    def get_pin(self, pin_id: str) -> Dict:
        """
        ピン情報を取得
        
        Args:
            pin_id: ピン ID
        
        Returns:
            ピン情報
        """
        response = self._make_request(
            "GET",
            f"pins/{pin_id}",
            params={
                "fields": "id,note,image,link,board,created_at,dominant_color"
            }
        )
        return response
    
    # ============ Board Management ============
    
    def get_user_boards(self) -> List[Dict]:
        """
        ユーザーの全ボードを取得
        
        Returns:
            ボード一覧
        
        Example:
            boards = api.get_user_boards()
            for board in boards:
                print(f"{board['name']} ({board['id']})")
        """
        response = self._make_request(
            "GET",
            "me/boards",
            params={
                "fields": "id,name,description,image,privacy,created_at"
            }
        )
        
        boards = response.get("data", [])
        print(f"[INFO] ボード取得: {len(boards)} 件")
        
        return boards
    
    def get_board_by_name(self, board_name: str) -> Optional[Dict]:
        """
        ボード名からボード情報を取得
        
        Args:
            board_name: ボード名
        
        Returns:
            ボード情報（見つからない場合は None）
        """
        boards = self.get_user_boards()
        
        for board in boards:
            if board.get("name", "").lower() == board_name.lower():
                return board
        
        return None
    
    def create_board(
        self,
        name: str,
        description: str = None,
        privacy: str = "PUBLIC"
    ) -> Dict:
        """
        ボードを作成
        
        Args:
            name: ボード名
            description: 説明（オプション）
            privacy: プライバシー設定（PUBLIC or SECRET）
        
        Returns:
            作成されたボード情報
        """
        data = {
            "name": name,
            "privacy": privacy
        }
        
        if description:
            data["description"] = description
        
        response = self._make_request(
            "POST",
            "boards",
            data=data
        )
        
        board_id = response.get("id")
        print(f"[INFO] ボード作成: {board_id}")
        
        return response
    
    # ============ Pin Search ============
    
    def search_pins(
        self,
        query: str,
        limit: int = 25
    ) -> List[Dict]:
        """
        ピンを検索
        
        Args:
            query: 検索クエリ
            limit: 最大結果数（1-250、デフォルト: 25）
        
        Returns:
            検索結果（ピン一覧）
        
        Example:
            results = api.search_pins("sunset", limit=50)
            print(f"Found {len(results)} pins")
        """
        response = self._make_request(
            "GET",
            "pins/search",
            params={
                "query": query,
                "limit": min(limit, 250),
                "fields": "id,note,image,link,board"
            }
        )
        
        pins = response.get("data", [])
        print(f"[INFO] ピン検索結果: {len(pins)} 件")
        
        return pins
    
    def get_trending_pins(
        self,
        limit: int = 50
    ) -> List[Dict]:
        """
        トレンドピンを取得
        
        Args:
            limit: 最大結果数
        
        Returns:
            トレンドピン一覧
        
        Note:
            このエンドポイントは Pinterest API v1 では提供されていません。
            search_pins() を使用してトレンドクエリで検索してください。
        """
        # Pinterest API ではトレンド直接取得はできないため、
        # 一般的なトレンドキーワードで検索
        trending_keywords = [
            "trending",
            "popular",
            "best",
            "new",
            "viral"
        ]
        
        all_pins = []
        for keyword in trending_keywords:
            try:
                pins = self.search_pins(keyword, limit=10)
                all_pins.extend(pins)
            except:
                pass
        
        # 重複排除
        seen = set()
        unique_pins = []
        for pin in all_pins:
            pin_id = pin.get("id")
            if pin_id not in seen:
                seen.add(pin_id)
                unique_pins.append(pin)
        
        return unique_pins[:limit]
    
    # ============ Token Management ============
    
    def refresh_access_token(self) -> Dict:
        """
        Access Token をリフレッシュ
        
        Returns:
            新しい Access Token 情報
        
        Raises:
            ValueError: refresh_token が存在しない場合
        """
        if not self.refresh_token:
            raise ValueError("refresh_token is required for token refresh")
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.app_id,
            "client_secret": self.app_secret
        }
        
        response = requests.post(
            f"{self.oauth_url}/token",
            json=data,
            timeout=30
        )
        
        if response.status_code >= 400:
            raise Exception(f"Token refresh failed: {response.text}")
        
        token_data = response.json()
        
        # 新しい Token を保存
        self.access_token = token_data.get("access_token")
        self.refresh_token = token_data.get("refresh_token")
        
        print(f"[INFO] Token リフレッシュ完了")
        
        return token_data
    
    def validate_token(self) -> Tuple[bool, str]:
        """
        Access Token の有効性を検証
        
        Returns:
            (有効性, メッセージ)
        """
        try:
            response = self._make_request(
                "GET",
                "me",
                params={"fields": "id,username"}
            )
            if "id" in response:
                username = response.get("username")
                return True, f"Token is valid (@{username})"
            else:
                return False, "Invalid token response"
        except Exception as e:
            return False, str(e)
    
    def get_user_info(self) -> Dict:
        """
        ユーザー情報を取得
        
        Returns:
            ユーザー情報
        """
        response = self._make_request(
            "GET",
            "me",
            params={
                "fields": "id,username,first_name,last_name,image,bio"
            }
        )
        return response


# ============ ユーティリティ関数 ============

def load_config_from_env() -> PinterestApi:
    """
    環境変数から PinterestApi インスタンスを作成
    
    Returns:
        PinterestApi インスタンス
    """
    return PinterestApi(
        app_id=os.getenv("PINTEREST_APP_ID"),
        app_secret=os.getenv("PINTEREST_APP_SECRET"),
        access_token=os.getenv("PINTEREST_ACCESS_TOKEN"),
        refresh_token=os.getenv("PINTEREST_REFRESH_TOKEN"),
        user_id=os.getenv("PINTEREST_USER_ID")
    )


# ============ テスト ============

if __name__ == "__main__":
    try:
        api = load_config_from_env()
        print("✓ Pinterest API インスタンス作成完了")
        
        # トークン検証
        valid, msg = api.validate_token()
        if valid:
            print(f"✓ トークン検証: {msg}")
        else:
            print(f"✗ トークン検証失敗: {msg}")
    
    except Exception as e:
        print(f"✗ エラー: {e}")
