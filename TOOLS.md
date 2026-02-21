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
| OPENAI_API_KEY | OpenAI (memory-lancedb embedding) |
| BRAVE_API_KEY | Brave Search |
| SNS_SHEETS_ID | Google Sheets |

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
| 8 | sns-multi-poster | `/root/clawd/skills/sns-multi-poster/` | "SNS投稿"/"マルチ投稿" | `node post-to-instagram-v5.cjs <画像> "キャプション"` |
| 9 | ffmpeg-video-processor | `/root/clawd/skills/ffmpeg-video-processor/` | #ai動画処理チャンネル動画投稿 | `process-with-deepfilternet.sh <動画>` |
| 10 | web+X research | web_search + bird | "リサーチして"/"調べて" | web_search + bird 統合 |
| 11 | web-search | `/root/clawd/skills/web-search/` | "検索して" | `web-search.sh "<query>"` |
| 12 | x-search | `/root/clawd/skills/x-search/` | "Xで〜" | x-search skill |

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
- Instagram: Cookie認証 `cookies/instagram.json`（期限切れ時ブラウザから再取得）
- 接続制限時: 30分待機して再試行

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
