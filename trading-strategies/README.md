# 📺 YouTube動画分析（トレード手法抽出）

Gemini APIを使用してYouTube動画からトレード手法を自動抽出します。

## 🚀 使い方

### 基本的な使い方
```bash
# 仮想環境を有効化
cd /root/clawd
source venv-trading/bin/activate

# YouTube動画を分析
python scripts/analyze-youtube-trading.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

### 例
```bash
python scripts/analyze-youtube-trading.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## 📊 出力形式

分析結果は以下の形式でJSON保存されます：

```json
{
  "strategy_name": "手法の名称",
  "timeframe": "推奨時間足（例: 1時間足、15分足）",
  "indicators": [
    {
      "name": "インジケーター名（例: 移動平均線、RSI）",
      "settings": "設定値（例: MA(20), RSI(14)）"
    }
  ],
  "entry_conditions": {
    "long": ["買いエントリー条件1", "買いエントリー条件2"],
    "short": ["売りエントリー条件1", "売りエントリー条件2"]
  },
  "exit_conditions": {
    "stop_loss": "損切り条件",
    "take_profit": "利確条件"
  },
  "risk_management": "リスク管理の方法",
  "notes": "その他の重要な注意点"
}
```

## 💰 コスト

Gemini 1.5 Pro APIの料金：
- 動画処理: $0.00025/秒
- 例: 10分動画 = 600秒 × $0.00025 = **$0.15**

## 📁 保存先

- 分析結果: `/root/clawd/trading-strategies/analysis-result.json`
- 一時ファイル: `/tmp/` （処理後自動削除）

## ⚙️ 環境変数

必要な環境変数：
```bash
export GEMINI_API_KEY="your-api-key-here"
```

すでに `~/.profile` に設定済みです。

## 🐥 Clawdbot経由で使う

Discordから直接実行できます：

```
andoさん: この動画を分析して https://www.youtube.com/watch?v=...
```

リッキーが自動で：
1. 動画をダウンロード
2. Gemini APIで分析
3. 結果を報告
4. JSONファイルに保存

## 🔄 次のステップ

分析結果をもとに：
1. 複数の手法を掛け合わせる
2. Bitget APIで自動トレードbotを作成
3. バックテストで検証
4. 本番運用

## ⚠️ 注意事項

- 動画は一時的にダウンロードされますが、処理後自動削除されます
- 長時間動画（1時間以上）はコストが高くなるため注意
- APIレート制限に注意（1分あたり60リクエストまで）
