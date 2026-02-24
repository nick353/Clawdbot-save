# sns-intelligent-poster 実装詳細

## アーキテクチャ

### 従来の静的スクリプト
```
スクリプト → 固定セレクタ → クリック → エラー
```
**問題点:**
- セレクタ変更で即エラー
- デバッグが困難
- 柔軟性がない

### 新しい動的システム
```
Snapshot → Claude判断 → アクション → Snapshot → 判断 → ...
```
**利点:**
- セレクタ変更に自動対応
- エラー原因を即座に特定
- 代替戦略を自動選択

## ワークフロー（Instagram例）

1. **初期化**
   - Cookie読み込み
   - ブラウザ起動（Chrome extension profile）
   - Instagram投稿ページに遷移

2. **ファイルアップロード**
   - `browser snapshot` でページ状態取得
   - Claudeがファイル入力セレクタを判断
   - `browser act` でファイル選択

3. **キャプション入力**
   - Snapshot → キャプション入力欄を判断
   - テキスト入力

4. **投稿実行**
   - Snapshot → "Next"/"Share"ボタン判断
   - クリック
   - 投稿完了を確認

5. **エラーハンドリング**
   - 各ステップでエラー検出
   - 代替セレクタを自動試行
   - スクリーンショット保存

## 技術仕様

### 使用ツール
- `browser` tool (profile="chrome")
- `snapshot` (refs="aria") でDOM構造取得
- `act` でユーザーアクション実行

### エラー検出
- "An error occurred" などのエラーメッセージ検出
- タイムアウト検出
- セレクタ見つからない検出

### 成功パターン学習
- `/root/clawd/tasks/successes.md` に記録
- RAGシステムで過去の成功例を検索
- 精度向上

## 実装例

### Instagram投稿スクリプト
→ `/root/clawd/skills/sns-intelligent-poster/post-instagram-intelligent.sh`

### その他プラットフォーム
- `post-threads-intelligent.sh`
- `post-x-intelligent.sh`
- `post-facebook-intelligent.sh`
- `post-pinterest-intelligent.sh`

## テスト方法

```bash
# DRY_RUNモード
DRY_RUN=true bash post-instagram-intelligent.sh /tmp/test.jpg "Test caption"

# 期待される出力:
# ✅ Cookie読み込み成功
# ✅ ブラウザ起動
# ✅ Instagram投稿ページ遷移
# ✅ ファイル入力発見
# 🔄 DRY RUN: ファイルアップロードスキップ
# ✅ キャプション入力欄発見
# 🔄 DRY RUN: キャプション入力スキップ
# ✅ 投稿ボタン発見
# 🔄 DRY RUN: 投稿スキップ
```

## トラブルシューティング

### Cookie期限切れ
```bash
# ブラウザで再ログイン → Cookie再取得
# EditThisCookie拡張でエクスポート
# JSONファイルを上書き
```

### セレクタ見つからない
- スクリーンショット確認
- Claude判断ログ確認
- 代替セレクタ追加

### 投稿失敗
- DRY_RUNモードで動作確認
- エラーログ確認
- 手動投稿で問題再現
