# X Developer Portal 認可申請ガイド

X API v2 を使用してツイート投稿・削除するための認可申請手順です。

## 📋 事前準備

- X（旧 Twitter）アカウント（必須）
- 携帯電話番号（本人確認用）
- メールアドレス
- 開発用途の説明文（500文字以上推奨）

## ✅ Step 1: X Developer Portal に登録

1. https://developer.twitter.com へアクセス
2. **「Sign up」**をクリック
3. X アカウントでログイン（またはアカウント作成）
4. 携帯電話番号で本人確認
5. メールアドレスで認証

## ✅ Step 2: 開発用途を申請

**Developer Portal** にログイン後：

1. **「Elevated」認可レベル**へのアップグレードを申請
   - 「Standard」はリード専用のため、投稿機能が必要な場合は「Elevated」以上が必須

2. **申請フォーム記入**（日本語可）:
   - **Development Purpose**: 
     ```
     SNS自動投稿・削除機能を実装するため、
     X API v2 の Tweets API（POST/DELETE）を使用します。
     ```
   - **Intended Use Cases**: 
     - Tweeting on behalf of an account（ツイート投稿）
     - Delete Tweets（ツイート削除）

3. **「Apply」** → メール確認

### 申請承認期間
**通常 1〜3営業日**（多くの場合、即座に承認）

## ✅ Step 3: プロジェクトとアプリケーション作成

### 3.1 プロジェクト作成
1. **Developer Portal → Projects & Apps**
2. **「+ Create Project」** をクリック
3. **プロジェクト名**: `SNS Auto Poster`
4. **用途**:
   - [ ] Analyzing Tweets
   - [x] Publishing Tweets
   - [x] Engaging with Tweets
5. **説明**: SNS自動投稿・削除機能
6. **Create** をクリック

### 3.2 アプリケーション作成
1. **「Create an app」** をクリック
2. **App Type**: 「Native App」 または 「Confidential Client」を選択
   - サーバーサイド実装の場合は「Confidential Client」推奨
3. **App Name**: `SNS Auto Poster API`
4. **Create** をクリック

## ✅ Step 4: API キー・トークン取得

### 4.1 API Keys and Tokens タブ
アプリ作成後、以下の情報を保存：

```
API Key (Consumer Key):        [画面に表示]
API Key Secret (Consumer Secret): [クリックして表示]
```

⚠️ **Critical**: Secret キーは再度表示されないため、必ずコピーして保存！

### 4.2 Access Token & Secret 生成
1. **「Generate」** ボタンをクリック
2. **Token Type**: 「OAuth 2.0 Bearer Token」 または 「OAuth 1.0a」
   - 推奨: OAuth 2.0 Bearer Token（よりシンプル）
3. **Access Token** と **Refresh Token** を保存

## ✅ Step 5: 権限スコープ設定

**App Settings → User authentication settings** で以下を有効化：

### 必須スコープ
```
tweet.read          # ツイート読み込み
tweet.write         # ツイート投稿・削除
tweet.moderate.write # ツイート削除
users.read          # ユーザー情報読み込み
offline.access      # オフラインアクセス（リフレッシュトークン用）
```

### Callback URI 設定（Web App の場合）
```
https://your-app-domain.com/callback
http://localhost:8080/callback（開発用）
```

## ✅ Step 6: Bearer Token 認証テスト

### テストコマンド
```bash
BEARER_TOKEN="YOUR_BEARER_TOKEN"

# API接続テスト
curl -X GET "https://api.twitter.com/2/users/me" \
  -H "Authorization: Bearer $BEARER_TOKEN"

# 期待される応答
{
  "data": {
    "id": "YOUR_USER_ID",
    "name": "Your Name",
    "username": "your_username"
  }
}
```

## ✅ Step 7: 本番環境への昇格（オプション）

「Standard」から「Elevated」へのアップグレード後：

1. **Dev Environment**: テスト環境として使用
2. **Production Environment**: 本番環境として登録

申請は **Free Tier** で即座に承認されます。

## 🔑 認可トークンの管理

### 環境変数設定
```bash
# ~/.profile に追加
export X_API_KEY="YOUR_API_KEY"
export X_API_SECRET="YOUR_API_SECRET"
export X_BEARER_TOKEN="YOUR_BEARER_TOKEN"
export X_USER_ID="YOUR_USER_ID"
export X_REFRESH_TOKEN="YOUR_REFRESH_TOKEN（オプション）"
```

### Bearer Token の有効期限
- **最初の Bearer Token**: 2時間
- **Refresh Token を使用**: 最大 2年

トークンリフレッシュコマンド：
```bash
curl -X POST "https://api.twitter.com/2/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=$X_REFRESH_TOKEN&client_id=$X_API_KEY&client_secret=$X_API_SECRET"
```

## 📚 主な API エンドポイント

### ツイート投稿
```
POST /2/tweets
Body: {
  "text": "Your tweet text",
  "media": {
    "media_ids": ["media_id_1"]
  },
  "reply": {
    "in_reply_to_tweet_id": "optional"
  }
}
```

### ツイート削除
```
DELETE /2/tweets/{id}
```

### メディアアップロード
```
POST /2/tweets/search/recent
GET  /2/tweets/{id}/liking_users
```

### 検索（バズリサーチ）
```
GET /2/tweets/search/recent?query=SEARCH_QUERY
Parameters:
  - query: 検索クエリ
  - max_results: 1-100
  - tweet.fields: created_at,author_id,public_metrics
```

## ⚠️ よくある問題と対処法

### 「401 Unauthorized」エラー
- Bearer Token が無効または期限切れ
- Token を再生成するか、Refresh Token で更新
- Authorization ヘッダーの形式確認: `Authorization: Bearer <TOKEN>`

### 「403 Forbidden」エラー
- API権限不足（スコープ確認）
- アプリレベルが「Elevated」か確認
- プロジェクト設定で「Publishing Tweets」が有効か確認

### 「Rate Limit Exceeded」エラー
- **投稿**: 300リクエスト/15分
- **削除**: 300リクエスト/15分
- 対処: 最小 3秒の遅延を実装

### 「Invalid parameters」エラー
- テキスト長が 280 文字以上でないか確認
- JSON フォーマットが正しいか確認
- メディア ID が有効か確認

## 🔗 参考リンク

- [X API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [Tweets Manage API](https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference)
- [OAuth 2.0 Bearer Token](https://developer.twitter.com/en/docs/authentication/oauth-2-0/bearer-tokens)
- [Rate Limits](https://developer.twitter.com/en/docs/projects/overview#rate-limits)

## 📞 サポート

- X Developer Community: https://twittercommunity.com/
- API Status: https://api.statuspage.io/
- Support: X Developer Portal → Help

---

**最終更新**: 2026年2月22日
