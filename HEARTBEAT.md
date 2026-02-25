# HEARTBEAT.md - 自動タスク

**常にHaikuモデルを使用（軽量タスク専用セッション）**

---

## 0️⃣ 会話文脈保護（最優先・軽量版）
```bash
# 軽量版：非同期処理 + Clawdbotコマンド呼び出しなし
# これで「スクリプト自体がハング」するのを防ぐ
bash /root/clawd/scripts/conversation-continuity-enforcer-lite.sh &

# 会話要点を Obsidian + Git に保存（background）
# 【重要】直前の会話を記録するために必須
RECENT_CONTEXT=$(git -C /root/clawd log --oneline -1 --pretty=format:"%s" 2>/dev/null || echo "no recent context")
bash /root/clawd/scripts/conversation-context-saver.sh note "【HEARTBEAT】直前の文脈: $RECENT_CONTEXT" &

# Git自動commit（background）
bash /root/clawd/scripts/git-auto-commit.sh auto &
```
**効果**: 
- Memory plugin + Obsidian + Git の3層で文脈を保護
- 会話の要点を自動保存（compaction後も復元可能）
- ハング中タスクの自動検出
- **スクリプト自体のハングを防止**（全て非同期実行）

---

## 1️⃣ 実行中タスクチェック（最優先）
```bash
# process listで確認 → 完了タスクがあれば即座にDiscordに報告
```
**絶対守るルール:** 「完了したら報告する」と言ったら必ず報告する。andoさんから聞かれる前に自分から報告。

---

## 1. Discord投稿待ちチェック
フラグファイル `/root/clawd/.discord_post_pending` が存在する場合:
1. ファイルから読み取り: `1行目=日付, 2行目=レポートパス, 3行目=チャンネルID`
2. レポート内容を `message` tool でDiscord投稿
3. フラグファイル削除（失敗時はフラグ保持してリトライ）

---

## 2. 毎朝リサーチ（日本時間9:00 = UTC 0:00）
```bash
TODAY=$(date +%Y-%m-%d)
LAST_RUN=$(cat /root/clawd/.last_research_date 2>/dev/null || echo "1970-01-01")
CURRENT_HOUR=$(date +%H)
if [ "$TODAY" != "$LAST_RUN" ] && [ "$CURRENT_HOUR" = "00" -o "$CURRENT_HOUR" = "01" ]; then
    bash /root/clawd/scripts/daily-research.sh
    echo "$TODAY" > /root/clawd/.last_research_date
fi
```

---

## 3. 動画ファイルの自動検出＆処理
```bash
bash /root/clawd/scripts/auto-video-processor.sh
```
`/root/.clawdbot/media/inbound/` の新動画を検出 → 処理 → Google Drive → Discord通知

---

## 4. Bitget状況メモリ保存
```bash
python3 /root/clawd/scripts/heartbeat-bitget-status.py
```

---

## 5. 自動バックアップ
```bash
bash /root/clawd/scripts/backup-with-retry.sh
```
**Note**: 成功時は通知なし。エラー時のみ報告。

---

## 6. セッション最適化（トークン節約）
**Note**: Compactionは `agents.defaults.compaction.mode=safeguard` 設定で自動動作（手動実行不要）
- ~~session-optimizer.sh~~ - 削除（clawdbot CLI呼び出しでハング）
- ~~aggressive-memory-saver.sh~~ - 削除（clawdbot CLI呼び出しでハング）

---

## 通知ポリシー（2026-02-23）
**定期タスクは通知しない** — エラー・問題発生時のみ報告
- ✅ 重大問題: 即座に #一般 に報告
- ❌ 定期タスク開始: 通知なし
- ❌ 定期タスク完了: 通知なし
- ❌ 進捗報告: 不要
