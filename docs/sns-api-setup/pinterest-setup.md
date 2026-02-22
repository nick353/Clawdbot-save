# Pinterest Developers 認可申請ガイド

Pinterest API を使用してピン（Pin）を作成・削除するための認可申請手順です。

## 📋 事前準備

- Pinterest ビジネスアカウント（必須）
- Pinterest 認証済みウェブサイト URL（推奨）
- メールアドレス
- 開発用途の説明（300文字以上）

## ✅ Step 1: Pinterest Developers に登録

1. https://developers.pinterest.com へアクセス
2. **「ログイン」**をクリック
3. Pinterest アカウントでログイン（ビジネスアカウント推奨）
   - 個人アカウントの場合は、あらかじめビジネスアカウントに変更
4. メールアドレス確認

## ✅ Step 2: ビジネスアカウントの設定

### 2.1 Business Account 確認
1. **Pinterest ホーム → 設定 → アカウント**
2. **「ビジネスアカウント」** に変更（個人アカウントの場合）
3. **カテゴリ**: 「ビジネスサービス」 または 「テクノロジー」を選択

### 2.2 ウェブサイト認証（オプション）
API利用には必須ではありませんが、信頼性向上のため推奨：

1. **Pinterest.com → 設定 → ビジネス**
2. **「ウェブサイトを確認」**
3. HTML メタタグをサイトの `<head>` に挿入
4. 確認完了

## ✅ Step 3: Pinterest Developers で App 登録

### 3.1 アプリケーション作成
1. **Pinterest Developers Portal へログイン**
2. **「My Apps」** → **「Create App」**
3. **App Name**: `SNS Auto Poster`
4. **Description**: 
   ```
   Pinterest に自動でピンを投稿・削除するアプリケーション
   ```
5. **Website URL**: （オプション）
6. **Create** をクリック

### 3.2 認可トークン取得
アプリ作成後、以下の認証情報が表示されます：

```
App ID (Client ID):     YOUR_APP_ID
App Secret:             YOUR_APP_SECRET
```

⚠️ **Critical**: App Secret は再度表示されないため、必ずコピーして保存！

## ✅ Step 4: OAuth 2.0 設定

### 4.1 Redirect URI 登録
1. **App Settings → Authorized redirect URIs**
2. 以下の URI を登録：

```
https://api.pinterest.com/oauth/ (本番用)
http://localhost:8080/callback   (開発用)
http://localhost:3000/callback   (開発用 - Node.js)
```

### 4.2 スコープ権限
必要なスコープ：

```
boards:read           # ボード読み込み
pins:read             # ピン読み込み
pins:write            # ピン作成・削除
user_accounts:read    # ユーザーアカウント読み込み
```

## ✅ Step 5: Access Token 取得

### 5.1 OAuth 2.0 フロー

**ステップ 1: Authorization Code 取得**
```bash
curl -X GET "https://api.pinterest.com/oauth/?client_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=boards:read,pins:read,pins:write,user_accounts:read"
```

ユーザーが Pinterest にログインして認可後、`code` パラメータを受け取ります。

**ステップ 2: Access Token 交換**
```bash
curl -X POST "https://api.pinterest.com/v1/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=YOUR_AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET"
```

**応答例**:
```json
{
  "access_token": "YOUR_ACCESS_TOKEN",
  "token_type": "bearer",
  "expires_in": 2592000,
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "scope": "boards:read,pins:read,pins:write,user_accounts:read"
}
```

### 5.2 Access Token のリフレッシュ
有効期限（30日）が近づいたら：

```bash
curl -X POST "https://api.pinterest.com/v1/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET"
```

## ✅ Step 6: API テスト

### テストコマンド
```bash
ACCESS_TOKEN="YOUR_ACCESS_TOKEN"

# ユーザー情報取得
curl -X GET "https://api.pinterest.com/v1/me?access_token=$ACCESS_TOKEN"

# 期待される応答
{
  "id": "YOUR_PIN_USER_ID",
  "username": "your_username",
  "first_name": "Your Name",
  "image": { "medium": "..." }
}
```

## ✅ Step 7: Pinterest App Review（認可申請）

**オプション**: 他のユーザーのアカウントにアクセスする場合

### 7.1 申請前チェックリスト
- [ ] アプリが正常に動作している
- [ ] プライバシーポリシー URL を準備
- [ ] アプリのデモ動画または説明 を準備
- [ ] ボードとピンの作成・削除テストが完了

### 7.2 申請手順
1. **Pinterest Developers → My Apps → App Settings**
2. **「Request Access」**（App Review タブ）
3. **ユースケース説明** を記入：
   ```
   ユーザーのボードに自動でピンを投稿・削除するアプリケーションです。
   - ユーザーが事前に認可した URL のピンを作成
   - ユーザーが削除を要求したピンを削除
   ```
4. **提出**

### 申請承認期間
**通常 2〜3営業日**

## 🔑 認可トークンの管理

### 環境変数設定
```bash
# ~/.profile に追加
export PINTEREST_APP_ID="YOUR_APP_ID"
export PINTEREST_APP_SECRET="YOUR_APP_SECRET"
export PINTEREST_ACCESS_TOKEN="YOUR_ACCESS_TOKEN"
export PINTEREST_REFRESH_TOKEN="YOUR_REFRESH_TOKEN"
export PINTEREST_USER_ID="YOUR_PIN_USER_ID"
```

### Token 有効期限管理
- **Access Token**: 30日
- **Refresh Token**: 365日
- スクリプトで自動リフレッシュを実装推奨

## 📚 主な API エンドポイント

### ピン作成
```
POST /v1/pins
Headers: Authorization: Bearer YOUR_ACCESS_TOKEN
Body: {
  "board_id": "BOARD_ID",
  "note": "Pin description",
  "image_url": "https://example.com/image.jpg",
  "link": "https://example.com"（オプション）
}
```

### ピン削除
```
DELETE /v1/pins/{pin_id}
Headers: Authorization: Bearer YOUR_ACCESS_TOKEN
```

### ピン情報取得
```
GET /v1/pins/{pin_id}
Headers: Authorization: Bearer YOUR_ACCESS_TOKEN
Fields: id,note,image,link,board
```

### ボード取得
```
GET /v1/me/boards
Headers: Authorization: Bearer YOUR_ACCESS_TOKEN
```

### ピン検索
```
GET /v1/pins/search?query=SEARCH_QUERY
Headers: Authorization: Bearer YOUR_ACCESS_TOKEN
Parameters:
  - query: 検索クエリ
  - limit: 1-250（デフォルト: 25）
```

## ⚠️ よくある問題と対処法

### 「401 Unauthorized」エラー
- Access Token が無効または期限切れ
- Refresh Token で新しい Token を取得
- Authorization ヘッダー形式確認: `Authorization: Bearer <TOKEN>`

### 「403 Forbidden」エラー
- スコープ権限不足（`pins:write` を確認）
- ユーザーが App を認可していない
- App Review 承認待ち（他のユーザーアカウントアクセス）

### 「404 Not Found」エラー
- `board_id` または `pin_id` が無効
- ボード/ピン所有者が削除したか確認

### 「Rate Limit Exceeded」エラー
- **API レート制限**: 1000リクエスト/時間
- **推奨実装**: 最小 4秒の遅延

### ピン作成に失敗（image_url）
- URL は HTTPS（SSL証明書）である必要あり
- 画像サイズ: 最小 100x100px、最大 10MB
- 推奨: 1000x1500px（縦長フォーマット）

## 🔗 参考リンク

- [Pinterest Developers Documentation](https://developers.pinterest.com/)
- [Pinterest API Reference](https://developers.pinterest.com/docs/api/overview)
- [OAuth 2.0 Guide](https://developers.pinterest.com/docs/getting-started/authentication/)
- [Pins API](https://developers.pinterest.com/docs/api/pins/)
- [Rate Limits](https://developers.pinterest.com/docs/getting-started/rate-limits/)

## 📞 サポート

- Pinterest Developer Community: https://community.pinterest.biz/t5/developer-corner/gh-p/developers-api
- Support: Pinterest Help Center → Contact Us
- Status Page: https://www.pintereststatus.com/

---

**最終更新**: 2026年2月22日
