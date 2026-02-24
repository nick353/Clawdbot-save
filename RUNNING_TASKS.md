# RUNNING_TASKS.md - 実行中タスク

## 2026-02-24 14:33 UTC - Google Drive動画の自動投稿
- **開始時刻**: 2026-02-24 14:33 UTC
- **セッション**: tidal-meadow (PID 151706)
- **内容**: andoさんがGoogle Driveフォルダに追加した動画を5つのSNSに投稿
- **処理フロー**:
  1. Google Driveフォルダから新規動画を検出
  2. ダウンロード
  3. Gemini AIでキャプション生成（5つのSNS）
  4. 5つのSNSに並列投稿（Instagram/Facebook/Threads/X/Pinterest）
  5. 結果をDiscord #sns-投稿に報告
- **所要時間**: 5-10分程度
- **完了予定**: 2026-02-24 14:40 UTC

## 2026-02-24 14:48 - SNS本番投稿（Google Drive動画）
- **タスク**: ProcessedVideos/0217 (1).mp4 を4つのSNSに本番投稿（Pinterest除外）
- **セッション**: young-pine (pid 153046)
- **開始**: 2026-02-24 14:48 UTC
- **キャプション**: Gemini自動生成
- **投稿先**: Instagram, Threads, Facebook, X (Twitter)
- **状態**: 実行中 🚀
