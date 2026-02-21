# web-search

統合Web検索スキル - Brave Search API（Google代替） + X (Twitter) 検索

## 🎯 特徴

- ✅ **自動判定** - 会話から自動的にBrave/X検索を選択
- ✅ **Brave Search API** - Googleと同等の検索品質（月2000回無料）
- ✅ **X (Twitter) 検索** - 最新のツイートを取得
- ✅ **全チャンネル対応** - どこからでも使える
- ✅ **自然な会話** - 明示的なコマンド不要

## 使い方

### 基本的な検索（自動判定）
```bash
bash /root/clawd/skills/web-search/unified-search.sh "検索キーワード"
```

### Web検索（Brave Search）
```bash
bash /root/clawd/skills/web-search/unified-search.sh "Sora watermark removal"
```

### X検索
```bash
bash /root/clawd/skills/web-search/unified-search.sh --x "AI video tools"
```

## 自動トリガー（リッキー用）

### Web検索トリガー
- "〜を検索して"
- "〜について調べて"
- "〜の情報を探して"
- "〜のツールを見つけて"

### X検索トリガー
- "Xで〜を調べて"
- "Twitterで〜を検索"
- "〜の評判をXで"
- "〜についてのツイート"

### 自動判定ロジック
```
会話内容を分析:
  - 「Xで」「Twitterで」「ツイート」含む → X検索
  - それ以外 → Brave Search（Web検索）
```

## 使用例

### 例1: Soraウォーターマーク除去を調査
```
ユーザー: "Soraのウォーターマーク除去方法を調べて"

リッキー:
1. unified-search.sh "Sora watermark removal" を実行
2. 上位5件の結果を要約
3. ツール・手法を提案
```

**実行結果:**
```
🔍 Web検索中（Brave Search API）...

✅ 10件の検索結果を取得

--- 検索結果 1 ---
📌 Free Sora Watermark Remover – One-Click, No Watermark Videos
🔗 https://ezremove.ai/sora-watermark-remover/
📝 Remove Sora watermarks instantly with AI precision...
```

### 例2: X検索で評判調査
```
ユーザー: "Xで最新のAI動画ツールを調べて"

リッキー:
1. unified-search.sh --x "AI video tools 2025" を実行
2. ツイートを要約
3. 話題のツールを抽出
```

### 例3: 両方実行
```
ユーザー: "ProPainterについて詳しく調べて"

リッキー:
1. Brave Search → 公式情報・ドキュメント
2. X検索 → ユーザーの評判
3. 両方を統合して報告
```

## 出力例

### Brave Search（Web検索）
```
🔍 Web検索中（Brave Search API）...

✅ 10件の検索結果を取得

--- 検索結果 1 ---
📌 ProPainter: Video Inpainting with Diffusion Models
🔗 https://github.com/sczhou/ProPainter
📝 A powerful tool for video inpainting, object removal...

--- 検索結果 2 ---
📌 How to Remove Watermarks from Sora Videos
🔗 https://example.com/guide
📝 Complete guide to removing watermarks from AI-generated videos...
```

### X (Twitter) 検索
```
🐦 X (Twitter) 検索中...

✅ 5件のツイートを取得

--- ツイート 1 ---
👤 @ai_enthusiast
📝 Just discovered ProPainter for removing Sora watermarks. Works like a charm!
🔗 https://twitter.com/ai_enthusiast/status/123456789
```

## 技術仕様

### 依存関係
- **Brave Search API**: 月2000回無料、環境変数 `BRAVE_API_KEY`
- **Puppeteer**: X検索用（Node.js 14+）

### 環境変数
```bash
# ~/.profile に設定済み
export BRAVE_API_KEY="..."
export AUTH_TOKEN="..."  # X用（オプション）
export CT0="..."         # X用（オプション）
```

### ファイル構成
```
/root/clawd/skills/web-search/
├── SKILL.md              # このファイル
├── unified-search.sh     # 統合検索スクリプト（推奨）
├── web-search.sh         # 旧版（非推奨）
└── search-google.js      # 旧版（非推奨）

/root/clawd/skills/x-search/
├── search-x.js           # X検索スクリプト
└── node_modules/         # Puppeteer
```

## リッキーの使い方

### 会話から自動判断
```javascript
// リッキーの内部ロジック
if (message.includes("Xで") || message.includes("Twitterで")) {
  // X検索
  execSync(`unified-search.sh --x "${keyword}"`);
  
} else if (message.includes("調べて") || message.includes("検索")) {
  // Brave Search
  execSync(`unified-search.sh "${keyword}"`);
  
} else if (message.includes("評判") || message.includes("詳しく")) {
  // 両方実行
  const braveResults = execSync(`unified-search.sh "${keyword}"`);
  const xResults = execSync(`unified-search.sh --x "${keyword}"`);
  // 統合して報告
}
```

### 結果の要約
- 検索結果は上位5件を要約
- URLは必ず提示
- 関連ツール・手法を抽出
- **生データを垂れ流さない**

## コスト

| 検索タイプ | コスト | 制限 |
|-----------|--------|------|
| Brave Search | 無料 | 月2000回 |
| X検索 | 無料 | レート制限あり |

## トラブルシューティング

### Brave Search APIエラー
```bash
# APIキー確認
echo $BRAVE_API_KEY

# APIキー再設定
echo 'export BRAVE_API_KEY="..."' >> ~/.profile
source ~/.profile
```

### X検索エラー
```bash
# Puppeteer再インストール
cd /root/clawd/skills/x-search
npm install --force
```

### レート制限
- Brave: 月2000回制限（超過したら翌月まで待つ）
- X: 連続検索時は5秒間隔を空ける

## 今後の拡張

- [ ] YouTube動画検索
- [ ] GitHub検索
- [ ] 学術論文検索（Google Scholar代替）
- [ ] 画像検索
- [ ] ニュース検索
- [ ] 期間指定フィルター

## ライセンス

MIT License

---

**作成日:** 2026-02-15
**作成者:** リッキー 🐥
**バージョン:** 2.0.0（Brave Search統合版）
