# 実行中タスク

## 1. Vision統合方式 全SNS実装（改訂版）
**開始**: 2026-02-25 04:25 UTC  
**セッション**: agent:main:subagent:dfe1d542-07ef-4c9e-8c5d-3c5597f984ab  
**所要時間見込み**: 約3.5時間（〜07:55 UTC）  
**タイムアウト**: 4時間  
**状況**: サブエージェントで実装中（完了したら #sns-投稿 に報告します）

**実装範囲:**
1. ✅ Instagram（完了済み - Vision版が正式版）
2. 🔄 X (Twitter) - Vision統合版作成 + 古いスクリプト整理
3. 🔄 Threads - Vision統合版作成 + 古いスクリプト整理
4. 🔄 Facebook - Vision統合版作成 + 古いスクリプト整理
5. 🔄 Pinterest - Vision統合版作成 + 古いスクリプト整理

**実装ステップ（各SNS共通）:**
1. 既存スクリプトをベースにVision統合版作成
2. タイプセレクタをVision APIで置換
3. 古いスクリプトをarchive/に移動
4. エントリーポイントを必ずVision版に統一
5. DRY_RUNテスト

**ファイル整理方針:**
- `post-to-instagram.cjs` → `post-to-instagram-vision.cjs`（正式版）
- `post-to-x.cjs` → `post-to-x-vision.cjs`（正式版）
- `post-to-threads.cjs` → `post-to-threads-vision.cjs`（正式版）
- `post-to-facebook.cjs` → `post-to-facebook-vision.cjs`（正式版）
- `post-to-pinterest.cjs` → `post-to-pinterest-vision.cjs`（正式版）
- archive/に旧バージョン移動

**標準化ドキュメント更新:**
- AGENTS.md - Vision統合方式を標準ルールに追加
- TOOLS.md - トラブルシューティングセクション更新
- web-automation-standard.md - Vision統合パターンを正式版として記載
