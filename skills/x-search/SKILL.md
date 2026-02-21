# x-search

X (Twitter) の検索を自動化するスキル。Puppeteerを使ってブラウザ自動化で最新のツイートを取得します。

## 機能

- ✅ キーワード検索
- ✅ 最新順（Live）で取得
- ✅ ログイン状態を維持（cookie使用）
- ✅ JSON出力対応
- ✅ 全チャンネルで使用可能

## 使い方

### 基本的な検索
```bash
bash /root/clawd/skills/x-search/x-search.sh "検索キーワード"
```

### JSON出力
```bash
bash /root/clawd/skills/x-search/x-search.sh "検索キーワード" --json
```

### 例
```bash
# Soraウォーターマーク除去を検索
bash /root/clawd/skills/x-search/x-search.sh "Sora watermark removal"

# AI動画処理ツールを検索
bash /root/clawd/skills/x-search/x-search.sh "AI video enhancement tools 2025"

# JSON形式で取得
bash /root/clawd/skills/x-search/x-search.sh "video upscaling" --json
```

## 出力例

```
🔍 X検索開始: "Sora watermark removal"
📂 URL: https://twitter.com/search?q=Sora%20watermark%20removal&src=typed_query&f=live

✅ 5件のツイートを取得

--- ツイート 1 ---
👤 @username
📝 Just found an amazing tool for removing Sora watermarks...
🔗 https://twitter.com/username/status/123456789

--- ツイート 2 ---
👤 @another_user
📝 ProPainter works great for Sora video watermark removal...
🔗 https://twitter.com/another_user/status/987654321
```

## トリガーキーワード

リッキーが自動的に使うキーワード：
- "Xで調べて"
- "Twitterで検索"
- "Xで〜を探して"
- "最新情報を検索"

## 技術仕様

### 依存関係
- Node.js 14+
- Puppeteer 21.0.0+

### 環境変数
- `AUTH_TOKEN`: X認証トークン（オプション）
- `CT0`: X CSRFトークン（オプション）

認証情報は `~/.profile` に設定済み

### ファイル構成
```
/root/clawd/skills/x-search/
├── SKILL.md          # このファイル
├── x-search.sh       # シェルラッパー
├── search-x.js       # Puppeteerスクリプト
├── package.json      # npm設定
└── node_modules/     # 依存パッケージ（初回実行時に自動生成）
```

## トラブルシューティング

### Puppeteerインストールエラー
```bash
cd /root/clawd/skills/x-search
npm install --force
```

### ブラウザが起動しない
- VPS環境で必要なライブラリがない場合：
```bash
apt-get update
apt-get install -y chromium-browser
```

### 検索結果が取得できない
- Xの仕様変更の可能性
- セレクタを更新する必要がある
- `search-x.js` の `page.evaluate()` 部分を修正

## 今後の拡張

- [ ] フィルター機能（日付、いいね数など）
- [ ] 画像・動画付きツイートのみ抽出
- [ ] リプライ・引用ツイート取得
- [ ] スレッド展開
- [ ] ユーザープロファイル検索

## 使用例（リッキー用）

### andoさんからの依頼例
```
ユーザー: "Xで最新のAI動画ツールを調べて"

リッキー: 
1. bash /root/clawd/skills/x-search/x-search.sh "AI video tools 2025" を実行
2. 結果を要約して報告
3. 関連URLを提示
```

### 自動トリガー例
```javascript
// 会話から検索意図を検出
if (message.includes("Xで") && message.includes("調べて")) {
  const keyword = extractKeyword(message);
  execSync(`bash /root/clawd/skills/x-search/x-search.sh "${keyword}"`);
}
```

## 制約事項

- X APIの利用制限に準拠
- 1回の検索で最大10件まで
- レート制限を考慮して連続検索は間隔を空ける
- ログインなしでも動作するが、結果が制限される可能性あり

## ライセンス

MIT License

---

**作成日:** 2026-02-15
**作成者:** リッキー 🐥
**バージョン:** 1.0.0
