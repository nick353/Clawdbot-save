# Meta Developers 認可申請ガイド

Meta Graph API を使用して Instagram、Facebook、Threads に投稿・削除するための認可申請手順です。

## 📋 事前準備

- Meta ビジネスアカウント（必須）
- Meta ビジネスマネージャー へのアクセス権限
- Instagram ビジネスアカウント または Facebook ページ
- メールアドレス（2段階認証用）

## ✅ Step 1: Meta Developers に登録

1. https://developers.facebook.com へアクセス
2. **「はじめる」**をクリック
3. Meta アカウントでログイン（またはアカウント作成）
4. 氏名、メールアドレスを入力
5. 利用規約に同意して登録完了

## ✅ Step 2: アプリケーションを作成

1. **Meta アプリ ダッシュボード**へログイン
2. 左上の **「アプリを作成」** をクリック
3. **アプリ名**を入力（例：`SNS Auto Poster`）
4. **アプリタイプ**：「その他」を選択
5. **作成**をクリック

## ✅ Step 3: 必要なプロダクト追加

ダッシュボード左側の **「プロダクト」** → 以下を追加：

### 3.1 Instagram Graph API
- **「セットアップ」**をクリック
- 認可済みURLにアプリのリダイレクトURI を入力
- 保存

### 3.2 Facebook Graph API
- **「セットアップ」**をクリック
- Instagram Graph API と同様に設定

### 3.3 Marketing API（オプション）
- Facebook ページへのビジネスツール分析が必要な場合

## ✅ Step 4: トークン権限設定

**左側メニュー → 「アプリロール」**

### 4.1 必要な権限スコープ
以下の権限リクエストを有効化：

```
instagram_basic
instagram_graph_user_media
instagram_graph_user_profile
pages_read_engagement
pages_manage_metadata
pages_manage_posts
pages_read_user_content
public_profile
user_photos
publish_pages
```

### 4.2 ユーザーロール設定
- **テスト（開発段階）**：「テストユーザー」ロール追加
- **本番（認可申請後）**：アプリロールが自動的に昇格

## ✅ Step 5: アクセストークン取得

### 5.1 短期トークン取得（開発用）
```bash
curl -X GET "https://graph.instagram.com/me?fields=id&access_token=YOUR_TEMP_TOKEN"
```

### 5.2 長期トークン取得（本番用）
```bash
curl -X GET \
  "https://graph.instagram.com/oauth/access_token?client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&grant_type=client_credentials"
```

## ✅ Step 6: Meta App Review（認可申請）

**対象**: 本番環境での使用

### 6.1 申請前チェックリスト
- [ ] アプリが正常に動作している
- [ ] 権限スコープの説明（日本語）を準備
- [ ] プライバシーポリシー URL を準備
- [ ] データ使用ポリシー を準備
- [ ] テスト用 Instagram / Facebook アカウント確認

### 6.2 申請手順
1. **メニュー → 「App Review」**
2. **「My Submissions」タブ**
3. **「Request Submission」** をクリック
4. 各権限ごとに以下を記入：
   - **使用目的の説明**（日本語）
   - **スクリーンショット/動画**（機能デモ）
   - **テスト方法の説明**

### 6.3 承認期間
**通常 3〜7営業日**（ただし複雑な申請は2週間以上かかる場合あり）

## ✅ Step 7: 本番環境への昇格

認可申請が承認されたら：

1. **アプリ設定 → 「基本設定」**
2. **「App Mode」** を「開発」から「本番」に変更
3. **保存**

これで本番環境での使用が可能になります。

## 🔑 認可トークンの管理

### 環境変数設定（長期トークン）
```bash
# ~/.profile に追加
export META_APP_ID="YOUR_APP_ID"
export META_APP_SECRET="YOUR_APP_SECRET"
export META_ACCESS_TOKEN="YOUR_LONG_LIVED_TOKEN"
export IG_USER_ID="YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID"
export FB_PAGE_ID="YOUR_FACEBOOK_PAGE_ID"
```

### 環境変数の検証
```bash
# トークンが有効か確認
curl -X GET "https://graph.instagram.com/me?access_token=$META_ACCESS_TOKEN"
```

## 📚 主な API エンドポイント

### Instagram Graph API

**投稿作成**:
```
POST /v18.0/{ig-user-id}/media
Parameters: image_url, caption, media_type
```

**投稿削除**:
```
DELETE /v18.0/{ig-media-id}
```

**メディア情報取得**:
```
GET /v18.0/{ig-media-id}?fields=id,caption,timestamp
```

### Facebook Graph API

**ページへの投稿**:
```
POST /v18.0/{page-id}/feed
Parameters: message, picture, link, type
```

**投稿削除**:
```
DELETE /v18.0/{post-id}
```

### Threads API（プレビュー段階）

**スレッド投稿作成**:
```
POST /v18.0/{threads-user-id}/threads
Parameters: text, image_url, video_url
```

**スレッド投稿削除**:
```
DELETE /v18.0/{threads-post-id}
```

## ⚠️ よくある問題と対処法

### 「Invalid OAuth access token」エラー
- トークンの有効期限確認
- トークンのリフレッシュが必要な場合がある
- App Secret が正しいか確認

### 「(#100) Requires one of these permissions」エラー
- 申請した権限スコープが不足している
- Meta App Review で権限を追加申請

### 「Rate limit exceeded」エラー
- API呼び出し頻度が高すぎる
- 最小限のリトライ間隔を実装（例：5秒間隔）

### 投稿が反映されない
- ビジネスアカウントが正しく接続されているか確認
- メディアサイズの制限を確認（推奨: 1200x628px 以上）

## 🔗 参考リンク

- [Meta Developers Documentation](https://developers.facebook.com/)
- [Instagram Graph API Reference](https://developers.facebook.com/docs/instagram-graph-api)
- [Facebook Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [Meta App Review Process](https://developers.facebook.com/docs/app-review)

## 📞 サポート

申請に関する質問：
- Meta Community: https://developers.facebook.com/community
- サポートチケット: Meta Apps Dashboard → Help Center → Submit a Bug

---

**最終更新**: 2026年2月22日
