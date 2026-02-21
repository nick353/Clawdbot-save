# SNS Growth Tracker Skill

完全自立型SNS成長システム

## 概要

このスキルは、andoさんが画像・動画を投稿するだけで、以下を自動実行します：
1. Gemini分析（内容認識）
2. 各SNS向けキャプション自動生成
3. 5つのSNSに自動投稿（Instagram, Threads, Facebook, Pinterest, X）
4. Google Sheetsに自動記録
5. **エンゲージメント自動取得**（24h, 48h, 7d後）**【NEW!】**
6. トレンド監視（毎日）
7. 実験計画・実施・評価
8. 週次分析レポート

## トリガー

- **画像・動画投稿時**: 自動的に全処理を実行（完全自動検知）
- **ハートビート毎** (30分): Discord投稿自動検知（リアルタイム監視）
- **ハートビート毎** (30分): **エンゲージメント自動取得チェック【NEW!】**
- **毎日09:00 UTC**: トレンド監視
- **毎週月曜08:00 UTC**: 週次分析レポート

## 使い方

### 投稿（andoさん）
```
# Discordの#sns-投稿チャンネルに画像/動画を投稿
→ リッキーが自動検知（ハートビート時）
→ ダウンロード → Gemini分析 → キャプション生成
→ 5つのSNSに自動投稿（Instagram, Threads, Facebook, Pinterest, X）
→ Google Sheetsに自動記録
→ 完了通知
```

**完全自動化:**
- andoさんは画像/動画をDiscordに投稿するだけ
- 処理状況・エラーもDiscordに自動通知
- 全ログは `/root/clawd/skills/sns-growth-tracker/data/logs/` に保存

### エンゲージメント自動取得 **【NEW!】**
```
投稿から24時間、48時間、7日後に自動取得
→ Playwrightでブラウザ自動化
→ 各SNSにログインしてスクレイピング
→ Google Sheetsに自動記録
→ 完全自動化（手動記入不要！）
```

**取得データ:**
- Instagram: いいね、コメント、保存、シェア、リーチ
- X: いいね、リツイート、返信、インプレッション
- Threads: いいね、リポスト、返信、表示回数
- Facebook: いいね、コメント、シェア、リーチ
- Pinterest: 保存、クリック、インプレッション

### 初回セットアップ（ログイン）
```bash
# 各SNSへの初回ログイン（クッキー保存）
/root/clawd/skills/sns-growth-tracker/setup-login.sh
```

### ~~手動記入（andoさん）~~【不要になりました！】
```
~~1. 24時間後くらいに各SNSを確認~~
~~2. Google Sheetsを開く~~
~~3. 数字だけ記入（いいね、コメント、シェアなど）~~

→ 全て自動化されました！
```

### 週次レポート（自動）
```
毎週月曜朝8時にDiscordに投稿される
```

## ファイル構成

```
/root/clawd/skills/sns-growth-tracker/
├── SKILL.md                           # このファイル
├── README-ENGAGEMENT.md               # エンゲージメント自動取得詳細ドキュメント【NEW!】
├── scripts/
│   ├── watch-discord-posts.py         # Discord投稿自動検知
│   ├── main-workflow.py               # メインワークフロー統合
│   ├── analyze-image.py               # Gemini画像分析
│   ├── generate-captions.py           # キャプション生成
│   ├── post-to-sns.py                 # SNS投稿
│   ├── record-to-sheets.py            # Google Sheets記録
│   ├── get-engagement.py              # エンゲージメント自動取得【NEW!】
│   ├── schedule-engagement-tracking.py # エンゲージメント追跡スケジューラー【NEW!】
│   ├── trend-monitor.py               # トレンド監視
│   ├── experiment-planner.py          # 実験計画
│   ├── learning-engine.py             # 学習エンジン
│   └── weekly-analysis.py             # 週次分析
├── run-trend-monitor.sh               # トレンド監視実行
├── run-weekly-analysis.sh             # 週次分析実行
├── run-engagement-check.sh            # エンゲージメント自動チェック【NEW!】
├── setup-login.sh                     # SNSログインセットアップ【NEW!】
├── venv/                              # Python仮想環境（Playwright用）【NEW!】
├── templates/
│   └── sheets-structure.json       # Google Sheets構造
└── data/
    ├── trends/                     # トレンドデータ
    ├── experiments/                # 実験ログ
    ├── media/                      # 投稿画像バックアップ
    ├── cookies/                    # SNSログインクッキー【NEW!】
    ├── logs/                       # 実行ログ
    └── engagement_schedule.json    # エンゲージメント追跡スケジュール【NEW!】
```

## 依存関係

- Python 3.12+
- google-auth, google-auth-oauthlib, google-auth-httplib2
- google-api-python-client
- **Playwright + Chromium**（エンゲージメント自動取得用）**【NEW!】**
- Gemini API（GEMINI_API_KEY環境変数）
- sns-multi-poster skill（既存）

## 設定

### Google Sheets認証
```bash
# サービスアカウントキーを配置
cp /path/to/service-account.json /root/clawd/skills/sns-growth-tracker/google-credentials.json
```

### 環境変数
```bash
# ~/.profile に追加
export GEMINI_API_KEY="your-api-key"
export SNS_SHEETS_ID="your-google-sheets-id"
```

## Google Sheets構造

### シート1: 投稿マスター
投稿の基本情報とGemini分析結果を記録

### シート2-6: SNS別エンゲージメント
X, Threads, Instagram, Facebook, Pinterestの数値を記録

### シート7: 週次レポート
週ごとの分析結果を自動生成

### シート8: トレンド分析
バズってる投稿の分析結果を記録

### シート9: 実験ログ
テストした戦略と結果を記録

## 実行例

### 投稿フロー
```bash
# andoさんがDiscordに画像投稿
→ リッキーが検知
→ Gemini分析: 30秒
→ キャプション生成: 10秒
→ SNS投稿: 60秒
→ シート記録: 5秒
→ 「投稿完了っぴ！📊」
```

### トレンド監視
```bash
# 毎日09:00に自動実行
/root/clawd/scripts/run-trend-monitor.sh
```

### 週次分析
```bash
# 毎週月曜08:00に自動実行
/root/clawd/scripts/run-weekly-analysis.sh
```

### エンゲージメント自動取得 **【NEW!】**
```bash
# ハートビート毎（30分）に自動実行
/root/clawd/skills/sns-growth-tracker/run-engagement-check.sh

# 手動チェック
cd /root/clawd/skills/sns-growth-tracker
source venv/bin/activate
python3 scripts/schedule-engagement-tracking.py list

# 手動でエンゲージメント取得
python3 scripts/get-engagement.py Instagram "https://instagram.com/p/ABC123/" --headless
```

## トラブルシューティング

### Gemini APIエラー
```bash
# APIキーを確認
echo $GEMINI_API_KEY
```

### Google Sheets接続エラー
```bash
# 認証情報を確認
ls -la /root/clawd/skills/sns-growth-tracker/google-credentials.json
```

### SNS投稿失敗
```bash
# sns-multi-posterスキルを確認
cd /root/clawd/skills/sns-multi-poster
./test.sh
```

## 今後の拡張

- [x] **エンゲージメント自動取得** **【完了！2026-02-15】**
- [ ] A/Bテスト機能
- [ ] 投稿タイミング最適化
- [ ] 競合分析機能
- [ ] 自動ハッシュタグ生成
- [ ] エンゲージメントデータの機械学習分析

## 詳細ドキュメント

- **[README-ENGAGEMENT.md](README-ENGAGEMENT.md)** - エンゲージメント自動取得システムの詳細ドキュメント

---

**作成日**: 2026-02-15  
**作成者**: リッキー 🐥  
**バージョン**: 1.1.0（エンゲージメント自動取得追加）
