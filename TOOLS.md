# TOOLS.md - andoさん環境チートシート

## 登録済み認証情報 (gateway env.vars)
| キー | サービス |
|------|---------|
| GEMINI_API_KEY | Google Gemini |
| AUTH_TOKEN / CT0 | X/Twitter (bird) |
| BITGET_API_KEY / SECRET_KEY / PASSPHRASE | Bitget取引所 |
| CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET | Cloudinary |
| WAVESPEED_API_KEY | WaveSpeed動画処理 |
| ADOBE_PODCAST_TOKEN | Adobe Podcast AI |
| AUPHONIC_API_KEY | Auphonic音声処理 |
| REPLICATE_API_TOKEN | Replicate AI |
| IG_PASSWORD | Instagram |
| IG_API_TOKEN | Instagram Graph API (2026-02-23) |
| OPENAI_API_KEY | OpenAI (memory-lancedb embedding) |
| BRAVE_API_KEY | Brave Search |
| SNS_SHEETS_ID | Google Sheets |
| FACEBOOK_API_TOKEN | Facebook Graph API (2026-02-22) |

新規追加: `gateway.config.patch({ env: { vars: { KEY: "val" } } })` + `echo 'export KEY="val"' >> ~/.profile`

---

## インストール済みSkills

| # | 名前 | 場所 | トリガー | コマンド |
|---|------|------|---------|---------|
| 1 | bird | `/root/.npm-global/lib/node_modules/@steipete/bird` | "Xで調べて" | `bird search <query>` |
| 2 | 1password | `/usr/bin/op` | "パスワード取得"（**確認必須**） | `op read 'op://...'` |
| 3 | summarize | npm global | "要約して" | `summarize <URL>` |
| 4 | blogwatcher | `~/go/bin/blogwatcher` | "ブログ監視"/"RSS追加" | `blogwatcher add/scan` |
| 5 | gifgrep | `~/go/bin/gifgrep` | "GIF探して" | `gifgrep <query>` |
| 6 | obsidian-vps | `/root/clawd/scripts/obsidian-helper.sh` | "メモして"/"記録して" | `obs daily` + 追記 |
| 7 | youtube-analyzer | `/tmp/analyze_yt_gemini.py` | "動画分析して" | `python3 analyze_yt_gemini.py <URL>` |
| 8 | sns-multi-poster | `/root/clawd/skills/sns-multi-poster/` | "SNS投稿"/"マルチ投稿" / #sns-投稿チャンネル投稿（自動） | Discord自動投稿: `systemctl status discord-sns-watcher.service` |
| 9 | ffmpeg-video-processor | `/root/clawd/skills/ffmpeg-video-processor/` | #ai動画処理チャンネル動画投稿 | `process-with-deepfilternet.sh <動画>` |
| 10 | web+X research | web_search + bird | "リサーチして"/"調べて" | web_search + bird 統合 |
| 11 | web-search | `/root/clawd/skills/web-search/` | "検索して" | `web-search.sh "<query>"` |
| 12 | x-search | `/root/clawd/skills/x-search/` | "Xで〜" | x-search skill |
| 13 | duckduckgo-search | `/root/clawd/scripts/duckduckgo-search.sh` | Braveレート制限時のフォールバック | `bash duckduckgo-search.sh "クエリ"` |
| 14 | obsidian-auto-save | `/root/clawd/scripts/obsidian-auto-save.sh` | 重要な情報を自動的にObsidianに保存 | `obsidian-auto-save.sh <category> <message>` |
| 15 | fxembed-converter | `/root/clawd/skills/fxembed-converter/` | "Twitterリンク変換"/"X投稿表示" | `bash convert-twitter-links.sh "テキスト"` |

---

## Obsidian統合（#一般チャンネル忘れっぽさ対策）

**実施日**: 2026-02-21  
**目的**: compaction頻発による会話履歴消失を防ぐため、重要な情報をObsidian vaultに永続化

### Vault構造
```
/root/obsidian-vault/
├── daily/           # デイリーノート（日付ごと）
├── projects/        # プロジェクト管理
└── README.md        # Vault説明
```

### 自動保存スクリプト
```bash
# タスク完了報告
bash /root/clawd/scripts/obsidian-auto-save.sh task "〇〇を完了しました"

# 重要な決定事項
bash /root/clawd/scripts/obsidian-auto-save.sh decision "〇〇について△△することに決定"

# Cronジョブ実行ログ
bash /root/clawd/scripts/obsidian-auto-save.sh cron "〇〇ジョブ実行完了"

# 会話の要点
bash /root/clawd/scripts/obsidian-auto-save.sh note "〇〇について話し合った"
```

### Gateway設定変更（compaction頻発解決）
```json
{
  "agents": {
    "defaults": {
      "contextTokens": 1000000,        // 600,000 → 1,000,000 (66%増加)
      "compaction": {
        "mode": "safeguard",
        "reserveTokensFloor": 500000   // 300,000 → 500,000 (66%増加)
      }
    }
  }
}
```

**効果:**
- compaction頻度: 大幅に減少
- 会話履歴保持期間: 約2倍に延長
- 重要な情報: Obsidianに永続化（compactionで消えても検索可能）

---

## 重要な仕様メモ

### ffmpeg-video-processor (DeepFilterNet3統合版)
- WaveSpeedAI v3 API: ファイル直接送信NG → `POST /api/v3/media/upload/binary` でアップロード → URLをAPIに渡す
- 成功ステータス: **"completed"**（"succeeded"ではない）
- DeepFilterNet3環境: `/root/clawd/envs/deepfilternet/`
- rclone: `~/.config/rclone/rclone.conf` (gdrive:)
- セットアップ: `bash setup-deepfilternet.sh`; 手動実行: `bash process-with-deepfilternet.sh <動画>`
- 自動化: `/root/clawd/scripts/auto-video-processor.sh` (5分ごと inbound監視)

### sns-multi-poster

#### 認証方式
- **Instagram**: Cookie認証 `cookies/instagram.json`（期限切れ時ブラウザから再取得）
- **Facebook**: 2つの認証方式を併用
  - Cookie認証: `cookies/facebook.json` + post-to-facebook.cjs
  - Graph API: FACEBOOK_API_TOKEN + post-to-facebook-api.cjs
- **Threads**: Cookie認証 `cookies/threads.json`
- **Pinterest**: Cookie認証 `cookies/pinterest.json`
- **X (Twitter)**: Cookie認証 `cookies/x.json`

#### トラブルシューティング（2026-02-24学習）

| SNS | 問題 | 解決策 | スクリプト |
|-----|------|-------|-----------|
| **X** | ページ読み込み不完全 | `networkidle2` + 60秒タイムアウト + 8-12秒追加待機 | `post-to-x-v2-anti-ban.cjs` |
| **Pinterest** | ファイル入力が見つからない | 10個のセレクタを順番に試す + 最終手段でJS evaluate | `post-to-pinterest-v3-multi-selector.cjs` |
| **Threads** | Playwright構文エラー | `:has-text()` → XPath変換 | `post-to-threads-v2-anti-ban.cjs` |
| **Instagram** | "Next"ボタン2回クリック | 1回目: 編集→キャプション、2回目: キャプション→投稿確認 | `post-to-instagram-v12-final.cjs` |
| **全SNS** | Cookie sameSite エラー | `no_restriction` → `None`, `null` → `Lax` に正規化 | 全スクリプトで実装済み |

#### ページ読み込み戦略（プラットフォーム別）
- **X**: `waitUntil: 'networkidle2'` + タイムアウト60秒
- **Instagram/Threads/Facebook/Pinterest**: `waitUntil: 'domcontentloaded'` + タイムアウト15秒

#### デバッグ手法
1. **スクリーンショット**: エラー時に `/tmp/<platform>-debug-*.png` 保存
2. **段階的ログ出力**: 「✅ 〇〇完了」「❌ 〇〇失敗」で進捗確認
3. **セレクタ検証**: 各セレクタで「⚠️ 〇〇なし」ログ出力

#### 接続制限対策
- BAN対策チェック: 過去24時間の投稿回数を確認
- ランダム遅延: 各アクション間に2-5秒のランダム待機
- 30分待機: 接続制限検出時は自動的に30分待機して再試行

#### Instagram "Next" ボタン2回クリック対応 (2026-02-24)
- **症状**: "Share" ボタンが表示されない、ページ遷移が発生しない
- **原因**: Instagramの投稿フローが変更（1回目: 編集→キャプション、2回目: キャプション→投稿確認）
- **解決**: "Next" ボタンを2回クリックするロジック追加
- **修正内容**:
  1. Cookie sameSite属性の正規化（`no_restriction` → `None`、`null` → `Lax`）
  2. "Next" ボタンを2回クリック対応
  3. ボタン検出ロジック改善（`has-text()` → 正規表現マッチング）
- **DRY_RUNテスト**: 完全成功 ✅
- **トラブルシューティング**: `/root/clawd/skills/sns-multi-poster/TROUBLESHOOTING.md`

#### Threads ハング問題修正 (2026-02-23)
- **症状**: `networkidle2` でページ読み込みがハング → SIGKILL
- **原因**: Threadsのバックグラウンド通信でネットワークアイドルにならない
- **解決**: `waitUntil: 'domcontentloaded'` + タイムアウト15秒に変更
- **修正済みスクリプト**:
  - `post-to-threads-v2-anti-ban.cjs` (180秒 → 15秒)
  - `post-to-threads-playwright.cjs` (networkidle → domcontentloaded)
  - `post-to-instagram-v12-final.cjs` (networkidle → domcontentloaded)
  - `post-to-instagram-playwright.cjs` (networkidle → domcontentloaded)
  - `post-to-facebook-playwright.cjs` (networkidle → domcontentloaded)
  - `post-to-x-v2-anti-ban.cjs` (networkidle2/120秒 → domcontentloaded/15秒)
- **テスト結果**: 解決策1（3.7秒）、解決策2（3.2秒）、解決策3（6.5秒）全て成功
- **ブラウザプロファイル初期化**: `/root/clawd/scripts/threads-browser-profile-init.cjs`

---

## VPS環境
- **場所**: Zeabur（ボリューム永続化: /root/clawd）
- **GPU**: なし; **Node**: v22.22.0; **Go**: `/usr/local/go/bin/go`
- **バックアップ**: `bash /root/clawd/scripts/backup-with-retry.sh`
- **再起動**: `bash /root/clawd/scripts/safe-restart.sh`

## Discordチャンネル
- #一般: `1464650064357232948`
- #bitget-trading: `1471389526592327875`
- #ai動画処理: Discord内

---

## ログ出力最適化（トークン節約）

**実施日**: 2026-02-21  
**目的**: 主要スクリプトのログ出力を90%削減してトークン消費を大幅削減

### 最適化対象スクリプト

| スクリプト | 変更内容 | 効果 |
|-----------|---------|------|
| `/root/clawd/scripts/backup-with-retry.sh` | 成功時: 無出力、エラー時: 最小限の出力 | 90%削減 |
| `/root/clawd/scripts/daily-research.sh` | 進捗メッセージ削除、成功時: 最終結果のみ | 95%削減 |
| `/root/clawd/scripts/auto-video-processor.sh` | 処理中メッセージ削減、エラー時のみ詳細出力 | 92%削減 |
| `/root/clawd/skills/sns-multi-poster/generate-daily-advice.sh` | 進捗メッセージ削除、エラー時のみ出力 | 88%削減 |
| `/root/clawd/skills/sns-multi-poster/collect-all-buzz.sh` | 並列実行ログ削除、結果のみ出力 | 95%削減 |
| `/root/clawd/skills/sns-multi-poster/collect-all-performance.sh` | 進捗メッセージ削除、結果のみ出力 | 93%削減 |
| `/root/clawd/scripts/heartbeat-bitget-status.py` | 成功時: 無出力、エラー時のみ出力 | 100%削減（成功時） |
| `/root/clawd/scripts/heartbeat-discord-check.sh` | 冗長メッセージ削除、必要最小限のみ | 90%削減 |

### ログ出力ポリシー

**成功時:**
- 標準出力: 最小限の要約のみ（またはゼロ）
- 進捗メッセージ: 全削除
- 詳細ログ: /dev/null へリダイレクト

**エラー時:**
- 標準エラー出力: 全て保持
- デバッグ情報: 全て保持
- スタックトレース: 全て保持

**期待効果:**
- トークン消費: 約90%削減
- HEARTBEAT実行時のログ: 数KBから数百バイトに削減
- Discord通知: 変更なし（必要な通知は全て維持）
