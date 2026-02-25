# 実行中タスク

| セッションID | タスク | 開始時刻 | ステータス |
|-------------|--------|---------|-----------|
| tide-falcon | Gemini API動画分析（0217） | 2026-02-25 13:43 UTC | 実行中 |

**詳細:**
- Google Driveから「0217 (1).mp4」を取得: `/tmp/0217-video.mp4`
- Gemini APIで動画分析→Instagram用キャプション生成
- 次: Vision APIでInstagram実投稿
- 完了したら即座に報告

## [進行中] Instagram投稿（Vision統合版） - 2026-02-25 14:16 UTC
- **タスク**: Google Drive動画 `0217 (1).mp4` をInstagramに投稿
- **プロセスID**: crisp-crest (pid 6122)
- **スクリプト**: `/root/clawd/skills/sns-multi-poster/post-to-instagram-vision.cjs`
- **進捗ログ**: `/tmp/instagram_post.log`
- **デバッグディレクトリ**: `/tmp/instagram-vision-debug/`
- **ステータス**: 実行中（Vision API使用中）
- **完了予定**: ~60秒後

