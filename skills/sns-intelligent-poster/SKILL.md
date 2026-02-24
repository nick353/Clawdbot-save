# sns-intelligent-poster - AI駆動SNS投稿システム

## 概要
静的スクリプトではなく、**Claudeが状況を判断しながら投稿する**動的システム。

## 特徴
- `browser snapshot` でページ状態をリアルタイム取得
- セレクタ・次のアクションをClaudeが動的判断
- エラー時は代替戦略を自動選択
- 成功パターンを学習して精度向上

## 対応プラットフォーム
- Instagram
- Threads
- X (Twitter)
- Facebook
- Pinterest

## 使い方
```bash
# DRY_RUNモード（投稿なし・動作確認のみ）
DRY_RUN=true bash /root/clawd/skills/sns-intelligent-poster/post-instagram-intelligent.sh <画像パス> "キャプション"

# 本番投稿
bash /root/clawd/skills/sns-intelligent-poster/post-instagram-intelligent.sh <画像パス> "キャプション"
```

## トリガー
- Discord: #sns-投稿チャンネルに画像+テキスト投稿
- コマンド: `bash post-<platform>-intelligent.sh`

## 認証
Cookie認証（既存のCookieファイルを使用）:
- `/root/clawd/skills/sns-multi-poster/cookies/instagram.json`
- `/root/clawd/skills/sns-multi-poster/cookies/threads.json`
- `/root/clawd/skills/sns-multi-poster/cookies/x.json`
- `/root/clawd/skills/sns-multi-poster/cookies/facebook.json`
- `/root/clawd/skills/sns-multi-poster/cookies/pinterest.json`

## 実装詳細
→ `/root/clawd/skills/sns-intelligent-poster/README.md`
