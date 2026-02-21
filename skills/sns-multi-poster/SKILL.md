---
name: sns-multi-poster
description: 5つのSNS（Instagram, Threads, Facebook, Pinterest, X）に画像・動画を自動投稿。AIキャプション生成・パフォーマンス収集・PDCA分析まで完全自動化。「SNS投稿」「マルチ投稿」でトリガー。
---

# SNS Multi Poster - 完全自動化システム (v4.0 - 動画対応版)

**最終更新:** 2026-02-21

## 🎥 動画投稿対応 (v4.0)

**対応形式:** .mp4, .mov, .avi, .mkv, .webm, .m4v

**投稿先:**
- 📷 **画像** (.jpg, .png, .jpeg, .gif, .webp, .bmp) → Instagram, Threads, X, Facebook, Pinterest **(5SNS)**
- 🎥 **動画** (.mp4, .mov, .avi, .mkv, .webm, .m4v) → Instagram Reels, Threads, X, Facebook **(4SNS - Pinterest除外)**

**制限:**
- Instagram Reels: 最大90秒
- X (Twitter): 最大2分20秒（鳥無料プラン）
- Threads: 最大5分
- Facebook: 長時間OK

---

## 🚀 クイックスタート

```bash
cd /root/clawd/skills/sns-multi-poster

# 画像を5SNSに一括投稿
bash post-to-all-sns.sh /path/to/image.jpg "キャプション" Animal

# 動画を4SNSに一括投稿（Pinterest除外）
bash post-to-all-sns.sh /path/to/video.mp4 "動画キャプション 🎥" Animal

# テストモード（実際には投稿しない）
DRY_RUN=true bash post-to-all-sns.sh /tmp/test.mp4 "テスト動画 #test" Animal
```

---

## 📋 スクリプト一覧（v4.0）

| スクリプト | 対応メディア | 認証方式 | DRY_RUN |
|-----------|------------|---------|---------|
| `post-to-instagram-v5.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-instagram-reels.cjs` | 🎥 動画 | Cookie JSON | ✅ 対応 |
| `post-to-threads.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-threads-video.cjs` | 🎥 動画 | Cookie JSON | ✅ 対応 |
| `post-to-facebook.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-facebook-video.cjs` | 🎥 動画 | Cookie JSON | ✅ 対応 |
| `post-to-pinterest.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-x.cjs` | 📷🎥 両対応 | Cookie JSON | ✅ 対応 |
| `post-to-all-sns.sh` | 📷🎥 自動判別 | - | ✅ 対応 |

### DRY_RUN の動作
- 全スクリプトに**早期終了**チェックを追加（ブラウザ起動不要）
- `DRY_RUN=true` → 即座に「スキップ」メッセージを出力して終了
- タイムアウト：各プラットフォーム180秒以内（動画対応で延長）

---

## 🔐 Cookie管理

```bash
# Cookieファイル一覧
ls /root/clawd/skills/sns-multi-poster/cookies/
# instagram.json  threads.json  facebook.json  pinterest.json  x.json
```

### Cookie更新方法
1. 対象SNSにブラウザでログイン
2. Chrome拡張「Cookie-Editor」などでJSON形式でコピー
3. `cookies/<platform>.json` に保存

---

## 📊 自動化システム

### Phase 2: パフォーマンス収集 (毎日09:00 JST自動実行)
- **`collect-all-performance.sh`**: 全SNSパフォーマンス収集

### Phase 3: PDCA分析 (毎週月曜09:00 JST自動実行)
- **`analyze-sns-performance.sh`**: 週次レポート生成・Discord送信

### データ保存先
- 投稿記録: `/root/clawd/data/sns-posts/`
- パフォーマンス: `/root/clawd/data/sns-performance/`
- 週次レポート: `/root/clawd/data/reports/`

---

## トリガーワード

- `SNS投稿`
- `マルチ投稿`
- `5つのSNSに投稿`
- `/sns-multi-poster`

---

## 🔧 トラブルシューティング

| 症状 | 対処法 |
|------|--------|
| Cookie期限切れ | `cookies/<platform>.json` を更新 |
| タイムアウト | 90秒制限内に完了しない場合、Cookieを確認 |
| ブラウザハング | 各スクリプトに `DRY_RUN=true` で早期終了確認 |
| Facebookポストボタン見つからない | Cookieが期限切れの可能性、再取得 |

---

## 更新履歴

- 2026-02-17 v3.0: 全スクリプトにDRY_RUN早期終了追加、post-to-all-sns.sh修正（5SNS対応、タイムアウト管理）
- 2026-02-17 v2.0: post-to-instagram-v5.cjs完成（Cookie認証方式）
- 2026-02-08: Clawdbot標準browserツール版に変換（VPS対応）
- 2026-02-01: Playwright MCP版作成（ローカル開発用）
