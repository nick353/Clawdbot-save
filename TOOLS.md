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
