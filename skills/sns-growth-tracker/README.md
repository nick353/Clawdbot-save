# SNS Growth Tracker 🚀

完全自立型SNS成長システム - 画像・動画を投稿するだけで、自動分析・投稿・学習・改善を実行

## 🎯 機能

### 自動実行
- ✅ Gemini画像・動画分析
- ✅ 各SNS向けキャプション自動生成
- ✅ 5つのSNSに自動投稿（X, Threads, Instagram, Facebook, Pinterest）
- ✅ Google Sheetsに自動記録
- ✅ トレンド監視（毎日09:00）
- ✅ 実験計画・実施・評価
- ✅ 学習エンジン（過去データから最適化）
- ✅ 週次分析レポート（毎週月曜08:00）

### 手動操作
- 📝 エンゲージメント数値の記入（andoさん）
  - 各SNSを確認してGoogle Sheetsに数字を記入

## 📋 セットアップ

### 1. 依存パッケージインストール
```bash
cd /root/clawd/skills/sns-growth-tracker
./install-dependencies.sh
```

### 2. Google Cloud設定
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクト作成
3. Google Sheets APIを有効化
4. サービスアカウント作成
   - 役割: 編集者
5. JSONキーをダウンロード
6. 配置:
```bash
cp ~/Downloads/service-account-key.json /root/clawd/skills/sns-growth-tracker/google-credentials.json
```

### 3. 環境変数設定
```bash
# ~/.profile に追加
echo 'export GEMINI_API_KEY="your-gemini-api-key"' >> ~/.profile
echo 'export SNS_SHEETS_ID=""' >> ~/.profile  # 後で設定
source ~/.profile
```

### 4. Google Sheetsセットアップ
```bash
cd /root/clawd/skills/sns-growth-tracker/scripts
python3 setup-sheets.py
```

実行後、表示されたスプレッドシートIDを環境変数に設定：
```bash
export SNS_SHEETS_ID="表示されたID"
echo 'export SNS_SHEETS_ID="表示されたID"' >> ~/.profile
```

### 5. Cronジョブ設定（HEARTBEAT.mdで自動実行）
```bash
# /root/clawd/HEARTBEAT.md に追加

## トレンド監視（毎日09:00 UTC）
CURRENT_HOUR=$(date +%H)
if [ "$CURRENT_HOUR" = "09" ]; then
    /root/clawd/skills/sns-growth-tracker/run-trend-monitor.sh
fi

## 週次分析（毎週月曜08:00 UTC）
DAY_OF_WEEK=$(date +%u)  # 1=月曜
if [ "$DAY_OF_WEEK" = "1" ] && [ "$CURRENT_HOUR" = "08" ]; then
    /root/clawd/skills/sns-growth-tracker/run-weekly-analysis.sh
fi
```

## 🚀 使い方

### 投稿フロー

1. **andoさん**: Discordの#sns-投稿に画像・動画を投稿
2. **リッキー**: 自動処理
   - Gemini分析（30秒）
   - キャプション生成（10秒）
   - 5つのSNSに投稿（60秒）
   - Google Sheetsに記録（5秒）
   - 「投稿完了っぴ！📊」と通知
3. **andoさん**: 24時間後に各SNSを確認してGoogle Sheetsに数字を記入
4. **リッキー**: 週次分析で成長レポート生成

### 手動実行

#### 画像分析のみ
```bash
cd /root/clawd/skills/sns-growth-tracker/scripts
python3 analyze-image.py /path/to/image.jpg
```

#### キャプション生成のみ
```bash
python3 generate-captions.py /path/to/image.jpg
```

#### トレンド監視
```bash
cd /root/clawd/skills/sns-growth-tracker
./run-trend-monitor.sh
```

#### 週次分析
```bash
./run-weekly-analysis.sh
```

## 📊 Google Sheets構造

### シート1: 投稿マスター
投稿の基本情報とGemini分析結果

### シート2-6: SNS別エンゲージメント
- X (Twitter)
- Threads
- Instagram
- Facebook
- Pinterest

各シートで数値を手動記入（いいね、コメント、シェアなど）

### シート7: 週次レポート
自動生成される分析結果

### シート8: トレンド分析
バズっている投稿の分析結果

### シート9: 実験ログ
テストした戦略と結果

## 🧪 実験システム

システムが自動的に：
1. トレンドを分析
2. 新しい戦略を考案
3. 次回投稿でテスト
4. 結果を評価
5. 成功した戦略を継続

## 📈 週次レポート例

毎週月曜朝8時にDiscordに投稿されます：
- 今週の投稿数
- SNS別パフォーマンス
- ベスト/ワースト投稿
- トレンド分析
- 実験結果
- 来週の戦略

## 🔧 トラブルシューティング

### Gemini APIエラー
```bash
# APIキー確認
echo $GEMINI_API_KEY

# 再設定
export GEMINI_API_KEY="your-api-key"
```

### Google Sheets接続エラー
```bash
# 認証情報確認
ls -la /root/clawd/skills/sns-growth-tracker/google-credentials.json

# 権限確認
chmod 600 /root/clawd/skills/sns-growth-tracker/google-credentials.json
```

### SNS投稿失敗
```bash
# sns-multi-posterスキル確認
cd /root/clawd/skills/sns-multi-poster
./test.sh
```

### ログ確認
```bash
# 最新ログ
tail -50 /root/clawd/skills/sns-growth-tracker/data/logs/*.log

# トレンド監視ログ
tail -50 /root/clawd/skills/sns-growth-tracker/data/logs/trend-monitor-*.log

# 週次分析ログ
tail -50 /root/clawd/skills/sns-growth-tracker/data/logs/weekly-analysis-*.log
```

## 📁 ファイル構成

```
/root/clawd/skills/sns-growth-tracker/
├── README.md                       # このファイル
├── SKILL.md                        # スキル定義
├── config.json                     # 設定
├── install-dependencies.sh         # 依存パッケージインストール
├── run-trend-monitor.sh            # トレンド監視実行
├── run-weekly-analysis.sh          # 週次分析実行
├── google-credentials.json         # Google認証情報（要手動配置）
├── scripts/
│   ├── analyze-image.py            # Gemini画像分析
│   ├── generate-captions.py        # キャプション生成
│   ├── record-to-sheets.py         # Google Sheets記録
│   ├── trend-monitor.py            # トレンド監視
│   ├── experiment-planner.py       # 実験計画
│   ├── learning-engine.py          # 学習エンジン
│   ├── weekly-analysis.py          # 週次分析
│   ├── main-workflow.py            # メインワークフロー
│   └── setup-sheets.py             # Google Sheetsセットアップ
├── templates/
│   └── sheets-structure.json       # Google Sheets構造定義
└── data/
    ├── trends/                     # トレンドデータ
    ├── experiments/                # 実験ログ
    ├── media/                      # 投稿画像バックアップ
    ├── reports/                    # 週次レポート
    └── logs/                       # 実行ログ
```

## 🎯 各SNSの最適化戦略

### X (Twitter)
- スレッド形式
- 質問型キャプション
- データ・数字引用
- リプライで会話継続

### Threads
- 会話誘発型
- 質問・意見・ユーモア
- IG連携

### Instagram
- カルーセル（複数画像）
- 1枚目は引き
- DM送信誘発
- 視聴時間重視

### Facebook
- Reels形式
- ストーリー性
- 会話型キャプション
- コメント・シェア誘発

### Pinterest
- 縦型画像（2:3）
- SEOキーワード5個以上
- テキストオーバーレイ
- 新鮮ピン（毎日投稿）

## 📚 参考資料

各SNSのアルゴリズム情報は `/root/.clawdbot/media/inbound/0b331986-4072-4ed1-98b5-4f6b70355864.txt` を参照

---

**作成日**: 2026-02-15  
**作成者**: リッキー 🐥  
**バージョン**: 1.0.0
