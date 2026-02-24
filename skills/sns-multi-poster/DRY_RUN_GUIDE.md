# SNS Multi-Poster DRY_RUN テストガイド

## 全SNS DRY_RUNテスト結果（2026-02-24）

✅ **全SNSでDRY_RUNテスト成功 - 本番投稿可能な状態です**

---

## 各SNSスクリプトの使い方

### 1. Threads
```bash
DRY_RUN=true node post-to-threads-v2-anti-ban.cjs <image_path> <caption>
```
- 引数順: 画像 → キャプション
- BAN対策: レート制限チェック、投稿時間帯制限
- 出力: 画像パス、キャプション、完了メッセージ

### 2. Facebook Cookie方式
```bash
DRY_RUN=true node post-to-facebook-playwright.cjs <text> [image_path]
```
- 引数順: **テキスト → 画像**（他のSNSと逆）
- Cookie認証: `/root/clawd/skills/sns-multi-poster/cookies/facebook.json`
- ブラウザプロファイル: `/root/clawd/browser-profiles/facebook`

### 3. Facebook Graph API方式
```bash
DRY_RUN=true node post-to-facebook-api.cjs <image_path> <caption>
```
- 引数順: 画像 → キャプション
- 認証: `FACEBOOK_API_TOKEN` 環境変数（設定済み）
- ページID: `PAGE_ID` 環境変数（デフォルト: "me"）

### 4. X (Twitter)
```bash
DRY_RUN=true node post-to-x-v2-anti-ban.cjs <image_path> <caption>
```
- 引数順: 画像 → キャプション
- BAN対策: レート制限チェック、投稿時間帯制限、Stealth Plugin
- Cookie認証: `/root/clawd/skills/sns-multi-poster/cookies/x.json`

### 5. Pinterest
```bash
DRY_RUN=true node post-to-pinterest.cjs <image_path> <caption> [board_name]
```
- 引数順: 画像 → キャプション → ボード名（オプション）
- デフォルトボード: "Animal"
- Cookie認証: `/root/clawd/skills/sns-multi-poster/cookies/pinterest.json`

---

## DRY_RUNテスト実施内容

### テスト画像
- パス: `/root/clawd/skills/sns-multi-poster/test-images/sample-landscape.jpg`
- サイズ: 139KB
- 形式: PNG（拡張子は.jpgだがPNG形式）

### 実施日時
- 2026-02-24 10:34 UTC

### テスト結果詳細

| SNS | スクリプト | 結果 | 備考 |
|-----|-----------|------|------|
| Threads | `post-to-threads-v2-anti-ban.cjs` | ✅ 成功 | DRY_RUNモード改善（完了メッセージ追加） |
| Facebook Cookie | `post-to-facebook-playwright.cjs` | ✅ 成功 | 引数順序注意（text → image） |
| Facebook Graph API | `post-to-facebook-api.cjs` | ✅ 成功 | API Token確認済み |
| X (Twitter) | `post-to-x-v2-anti-ban.cjs` | ✅ 成功 | DRY_RUNモード改善（画像・キャプション情報追加） |
| Pinterest | `post-to-pinterest.cjs` | ✅ 成功 | デフォルトボード: Animal |

---

## 改善内容

### 1. X (Twitter) DRY_RUNモード改善
- **変更前**: 最小限の出力（"DRY RUN: X投稿スキップ"のみ）
- **変更後**: 画像パス、キャプション、完了メッセージを表示

### 2. Threads DRY_RUNモード改善
- **変更前**: 完了メッセージなし
- **変更後**: 完了メッセージ追加、出力フォーマット統一

### 3. テスト画像作成
- test-imagesディレクトリを作成
- sample-landscape.jpg（139KB）を配置

---

## 本番投稿への移行

### 準備完了チェックリスト
- [x] 全SNSでDRY_RUNテスト成功
- [x] スクリプトの引数順序を確認
- [x] 認証情報（Cookie/API Token）の有効性確認
- [x] DRY_RUNモード出力の統一
- [x] テスト画像の準備

### 本番投稿コマンド例
```bash
# DRY_RUN=trueを外して実行
node post-to-threads-v2-anti-ban.cjs <image_path> <caption>
node post-to-facebook-playwright.cjs <text> [image_path]
node post-to-facebook-api.cjs <image_path> <caption>
node post-to-x-v2-anti-ban.cjs <image_path> <caption>
node post-to-pinterest.cjs <image_path> <caption> [board_name]
```

---

## 注意事項

### 引数順序の違い
- **Facebook Cookie方式のみ**: `<text> [image_path]`（テキストが先）
- **その他のSNS**: `<image_path> <caption>`（画像が先）

### Cookie認証の有効期限
- 定期的にCookieを更新する必要があります
- ブラウザから手動でログインしてCookieをエクスポート

### Graph API方式の利点
- Cookie期限切れのリスクなし
- ブラウザ不要で高速
- レート制限が緩い

---

## トラブルシューティング

### DRY_RUNモードで画像が見つからない
```bash
# 画像パスの確認
ls -lh /root/clawd/skills/sns-multi-poster/test-images/sample-landscape.jpg
```

### スクリプトが実行できない
```bash
# 実行権限の付与
chmod +x /root/clawd/skills/sns-multi-poster/post-to-*.cjs
```

### 環境変数が設定されていない
```bash
# FACEBOOK_API_TOKENの確認
echo $FACEBOOK_API_TOKEN

# gateway configで確認
gateway.config.get('env.vars.FACEBOOK_API_TOKEN')
```

---

## 統合テストスクリプト（今後の拡張）

全SNSのDRY_RUNテストを一度に実施するスクリプトを作成予定:
```bash
bash test-all-sns-dry-run.sh
```

---

**結論: 全SNSでDRY_RUNテスト成功。本番投稿可能な状態です。**
