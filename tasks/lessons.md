# Lessons Learned - 失敗から学ぶルール集

**目的**: Claudeが犯した失敗を記録し、二度と同じ失敗をしないためのナレッジベース

**使い方**:
1. 失敗を発見 → このファイルに記録
2. 原因分析 → AGENTS.mdにルール追加
3. 検証 → 再発しないことを確認

---

## テンプレート

```markdown
## YYYY-MM-DD - <失敗内容の簡潔な説明>
**症状**: <何が起きたか>
**原因**: <なぜ起きたか>
**解決策**: <どう修正したか>
**今後のルール**: <AGENTS.mdに追加すべきルール>
**検証**: ⏳ 未検証 / ✅ YYYY-MM-DD 再現しないことを確認
```

---

## 既知の失敗例（初期登録）

### 2026-02-23 - Threads投稿ハング（networkidle2問題）
**症状**: `networkidle2` でページ読み込みがハング → SIGKILL
**原因**: Threadsのバックグラウンド通信でネットワークアイドルにならない
**解決策**: `waitUntil: 'domcontentloaded'` + タイムアウト15秒に変更
**今後のルール**: ブラウザ自動化では `domcontentloaded` を優先使用（AGENTS.mdに追記済み）
**検証**: ✅ 2026-02-23 3つのアプローチで検証完了

---

### 2026-02-22 - Facebook Graph API DRY RUN誤実装
**症状**: DRY_RUN環境変数でスキップされず、本番投稿が実行された
**原因**: `if (process.env.DRY_RUN === 'true')` の実装漏れ
**解決策**: 全てのSNS投稿スクリプトにDRY_RUNチェック追加
**今後のルール**: 外部API呼び出しスクリプトには必ずDRY_RUNモード実装（AGENTS.mdに追記済み）
**検証**: ✅ 2026-02-22 全SNS投稿スクリプトでDRY_RUN確認済み

---

### 2026-02-21 - Compaction頻発による会話履歴消失
**症状**: #一般チャンネルで会話履歴が頻繁に消失
**原因**: `contextTokens: 600,000` + `reserveTokensFloor: 300,000` が小さすぎた
**解決策**: `contextTokens: 1,000,000` + `reserveTokensFloor: 500,000` に増加 + Obsidian統合
**今後のルール**: 重要な情報はObsidian自動保存で永続化（TOOLS.mdに追記済み）
**検証**: ✅ 2026-02-21 compaction頻度が大幅減少を確認

---

### 2026-02-21 - Cronジョブ重複（collect-instagram vs collect-all-performance）
**症状**: 同じデータを2つのジョブが重複収集
**原因**: 個別ジョブと全体ジョブの管理不足
**解決策**: `cron list` で既存ジョブ確認を必須化
**今後のルール**: Cronジョブ追加前に必ず `cron list` 実行（AGENTS.mdに追記済み）
**検証**: ✅ 2026-02-21 重複ジョブ削除完了

---

### 2026-02-20 - 廃止モデルID使用（claude-3-5-haiku-20241022）
**症状**: "Unknown model" エラーでHaiku利用不可
**原因**: Anthropic公式モデルID変更を把握していなかった
**解決策**: `anthropic/claude-haiku-4-5-20251001` に変更
**今後のルール**: モデルID変更前に必ずBrave検索で最新情報確認（AGENTS.mdに追記済み）
**検証**: ✅ 2026-02-20 正しいモデルIDで動作確認

---

## 失敗カテゴリ別統計

| カテゴリ | 件数 | 主な原因 |
|---------|------|---------|
| ブラウザ自動化 | 1 | タイムアウト設定不適切 |
| API統合 | 1 | DRY RUN未実装 |
| 設定管理 | 2 | Gateway config最適化不足 |
| 運用管理 | 1 | Cronジョブ重複 |
| モデル管理 | 1 | 廃止モデルID使用 |

---

## 次のアクション

**推奨レビュー頻度**: 週次（毎週日曜日）
**レビューコマンド**:
```bash
# 今月の失敗を確認
cat /root/clawd/tasks/lessons.md | grep "$(date +%Y-%m)" -A 6

# キーワード検索
grep -i "browser\|api\|cron" /root/clawd/tasks/lessons.md -A 6
```

**記録時のベストプラクティス**:
1. 失敗を発見したら即座に記録（後回し禁止）
2. 原因分析は具体的に（「設定ミス」ではなく「どの設定がどう間違っていたか」）
3. 解決策は再現可能な形で記述（コマンド・コード例を含む）
4. AGENTS.mdへのルール追加を必ず実施

---

**Boris Cherny曰く**:
> "After every correction, end with: 'Update your AGENTS.md so you don't make that mistake again.'"

**実践方法**:
- 失敗発見 → lessons.md記録 → AGENTS.mdルール追加 → 検証 → ✅マーク
