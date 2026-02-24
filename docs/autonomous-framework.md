# 自律的マルチエージェントフレームワーク

## 概要

「XなどでClawdを自動でなんでもできるようにする」ための自律的マルチエージェントフレームワークを実装しました。

このフレームワークは、複雑なタスクを自動的に分解し、専門エージェントに委譲して並列実行することで、効率的なタスク処理を実現します。

## アーキテクチャ

```
┌─────────────────────────────────────────┐
│  オーケストレーター                      │
│  (autonomous-orchestrator.sh)           │
├─────────────────────────────────────────┤
│  1. タスク受領                          │
│  2. 複雑度判定 (simple/medium/complex)  │
│  3. タスク分解                          │
│  4. 専門エージェント起動                │
│  5. 進捗監視                            │
└─────────────────┬───────────────────────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
      ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Research │ │Implement│ │ Verify  │
│Agent    │ │Agent    │ │ Agent   │
├─────────┤ ├─────────┤ ├─────────┤
│Model:   │ │Model:   │ │Model:   │
│ haiku   │ │ sonnet  │ │ haiku   │
├─────────┤ ├─────────┤ ├─────────┤
│Tools:   │ │Tools:   │ │Tools:   │
│- web_   │ │- exec   │ │- exec   │
│  search │ │- edit   │ │- process│
│- bird   │ │- write  │ │- read   │
│- web_   │ │- read   │ │         │
│  fetch  │ │         │ │         │
└─────────┘ └─────────┘ └─────────┘
      │           │           │
      └───────────┼───────────┘
                  │
                  ▼
      ┌───────────────────────┐
      │  進捗監視システム      │
      │  (task-progress-      │
      │   monitor.sh)         │
      ├───────────────────────┤
      │- RUNNING_TASKS.md更新 │
      │- Discord通知          │
      │- 完了報告一括送信      │
      └───────────────────────┘
                  │
                  ▼
      ┌───────────────────────┐
      │  自動学習システム      │
      │  (auto-learning-      │
      │   system.sh)          │
      ├───────────────────────┤
      │- lessons.md記録       │
      │- AGENTS.mdルール追加  │
      │- Obsidian統合         │
      └───────────────────────┘
```

## 主要コンポーネント

### 1. オーケストレーター (`autonomous-orchestrator.sh`)

**役割**: タスクを受け取り、適切に分解して専門エージェントに委譲

**機能**:
- タスク複雑度判定（simple/medium/complex）
- タスク分解ロジック
- エージェント選択・起動
- 進捗監視
- 完了報告処理

**使用方法**:
```bash
bash /root/clawd/scripts/autonomous-orchestrator.sh "タスク説明"
```

**例**:
```bash
# 簡単なタスク
bash autonomous-orchestrator.sh "Xで最新のAIトレンドをリサーチ"

# 複雑なタスク
bash autonomous-orchestrator.sh "新しいSNS（Bluesky）への自動投稿機能を実装"
```

### 2. 専門エージェント設定 (`config/agents.yaml`)

**エージェント種類**:

| エージェント | モデル | ツール | 用途 |
|-------------|--------|--------|------|
| research | haiku | web_search, bird, web_fetch | 情報収集・調査 |
| implement | sonnet | exec, edit, write, read | 実装・開発 |
| verify | haiku | exec, process, read | 検証・テスト |

**設定内容**:
- モデル選択
- ツール権限
- コンテキストサイズ
- システムプロンプト

### 3. 進捗監視システム (`task-progress-monitor.sh`)

**役割**: サブエージェントの進捗を監視し、完了時に通知

**機能**:
- RUNNING_TASKS.md自動更新
- サブエージェント完了フラグ管理
- Discord通知（完了時のみ、エラー時即座）
- 一括報告送信

**使用方法**:
```bash
# 進捗確認
bash task-progress-monitor.sh monitor

# タスク更新
bash task-progress-monitor.sh update <label> <status> [message]

# 完了フラグ追加
bash task-progress-monitor.sh complete <name> <summary>

# 完了報告一括送信
bash task-progress-monitor.sh report

# エラー通知
bash task-progress-monitor.sh error <name> <message>
```

### 4. 自動学習システム (`auto-learning-system.sh`)

**役割**: 失敗パターンを自動記録し、ルール化

**機能**:
- lessons.md自動記録
- AGENTS.mdルール追加
- 検証完了マーク
- 失敗パターン検索
- 月次統計

**使用方法**:
```bash
# 失敗パターン記録
bash auto-learning-system.sh record <title> <symptom> <cause> <solution> [rule]

# AGENTS.mdにルール追加
bash auto-learning-system.sh rule <section> <rule>

# 検証完了マーク
bash auto-learning-system.sh verify <title>

# 失敗パターン検索
bash auto-learning-system.sh search <keyword>

# 今月の統計
bash auto-learning-system.sh stats
```

## ワークフロー例

### シンプルなタスク: 「Xで最新のAIトレンドをリサーチ」

1. **オーケストレーター起動**:
   ```bash
   bash autonomous-orchestrator.sh "Xで最新のAIトレンドをリサーチして記事化"
   ```

2. **複雑度判定**: `simple`

3. **タスク分解**: 単一タスク（分解なし）

4. **エージェント起動**: mainエージェント（sonnet、全ツール）

5. **進捗監視**: RUNNING_TASKS.md更新

6. **完了報告**: Discord通知

### 複雑なタスク: 「Bluesky自動投稿機能実装」

1. **オーケストレーター起動**:
   ```bash
   bash autonomous-orchestrator.sh "新しいSNS（Bluesky）への自動投稿機能を実装"
   ```

2. **複雑度判定**: `complex`

3. **タスク分解**:
   - [research] Bluesky API調査
   - [implement] 基本実装
   - [implement] 詳細実装
   - [verify] 検証とドキュメント化

4. **エージェント起動**: 
   - researchエージェント（haiku） → Brave + X検索
   - implementエージェント×2（sonnet） → コード実装
   - verifyエージェント（haiku） → テスト実行

5. **進捗監視**: 
   - RUNNING_TASKS.md逐次更新
   - サブエージェント完了フラグ蓄積

6. **完了報告**: 
   - 全エージェント完了後、一括Discord通知

## DRY RUNモード

全てのスクリプトはDRY_RUNモードをサポートしています。

```bash
DRY_RUN=true bash autonomous-orchestrator.sh "タスク"
```

**DRY_RUNモードでは**:
- サブエージェント起動をスキップ
- Discord通知をスキップ
- ファイル更新をスキップ
- ログ出力のみ実行

## エラーハンドリング

### 失敗時の自動学習

1. エラー発生 → `auto-learning-system.sh record` で記録
2. lessons.mdに失敗パターン追加
3. AGENTS.mdにルール追加
4. Obsidianに保存
5. 検証後、`auto-learning-system.sh verify` で✅マーク

### エラー通知

エラー発生時は即座にDiscord通知:
```bash
bash task-progress-monitor.sh error "task-name" "エラーメッセージ"
```

## Self-Check（Boris Cherny流）

### 実装前チェック
1. ✅ この変更で「何が」「なぜ」改善されるか説明できるか？
2. ✅ シニアエンジニアがこのPRを承認するか？
3. ✅ 「たぶん動く」「おそらく大丈夫」と思っていないか？
4. ✅ 過去の失敗パターン（lessons.md）に該当しないか？

### 実装後チェック
1. ✅ 動作確認を実施したか？（DRY RUNまたは本番相当環境）
2. ✅ エッジケースを考慮したか？
3. ✅ 既存機能を壊していないか？
4. ✅ ログ出力は適切か？

## 統合例

### Cronジョブで自動実行

```bash
# 毎日9時にAIトレンドリサーチ
0 9 * * * cd /root/clawd && bash scripts/autonomous-orchestrator.sh "Xで最新のAIトレンドをリサーチして記事化" >> /var/log/autonomous-research.log 2>&1

# 毎週日曜日に週次統計
0 10 * * 0 cd /root/clawd && bash scripts/auto-learning-system.sh stats | clawdbot message send --channel discord --target "channel:1464650064357232948"
```

### Discord連携

```bash
# Discord投稿をトリガーにタスク実行
# （#ai-tasks チャンネルに「!auto <タスク>」で起動）
clawdbot message read --channel discord --target "channel:1234567890" | \
  grep "^!auto " | \
  sed 's/^!auto //' | \
  xargs -I {} bash /root/clawd/scripts/autonomous-orchestrator.sh "{}"
```

## トラブルシューティング

### よくある問題

| 問題 | 原因 | 解決策 |
|------|------|-------|
| サブエージェント起動失敗 | clawdbotコマンド未実装 | 現在はログ出力のみ（実装予定） |
| Discord通知送信失敗 | 認証情報不足 | gateway config確認 |
| RUNNING_TASKS.md更新されない | ファイルパス誤り | `/root/clawd/tasks/RUNNING_TASKS.md` 確認 |
| 統計が0件 | lessons.mdに記録なし | `auto-learning-system.sh record` で記録追加 |

### デバッグ方法

```bash
# デバッグモードで実行
bash -x /root/clawd/scripts/autonomous-orchestrator.sh "タスク" 2>&1 | tee debug.log

# ログ確認
tail -f /var/log/autonomous-*.log

# 進捗確認
cat /root/clawd/tasks/RUNNING_TASKS.md

# 完了フラグ確認
cat ~/.clawdbot/subagent_reports.log
```

## 実装完了

### ✅ Phase 2: サブエージェント実装（2026-02-24完了）
- [x] clawdbot CLIでのサブエージェント起動実装
- [x] エージェント間通信プロトコル
- [x] 並列実行制御（maxConcurrent=3）
- [x] 完了待機ロジック（タイムアウト処理付き）
- [x] agents.yaml統合（設定・テンプレート読み込み）

## 今後の拡張予定

### Phase 3: 学習システム強化
- [ ] 成功パターンの自動抽出
- [ ] プロンプト自動最適化
- [ ] RAG統合（過去の実装例を参照）

### Phase 4: 運用自動化
- [ ] タスクキュー実装
- [ ] 優先度管理
- [ ] リソース管理（CPU/メモリ監視）

### Phase 5: UI/UX改善
- [ ] Web UIダッシュボード
- [ ] リアルタイム進捗表示
- [ ] タスク履歴・統計可視化

## 参考資料

- Boris Chernyワークフロー: https://paddo.dev/blog/how-boris-uses-claude-code/
- AGENTS.md: `/root/clawd/AGENTS.md`
- lessons.md: `/root/clawd/tasks/lessons.md`
- TOOLS.md: `/root/clawd/TOOLS.md`

## ライセンス

このフレームワークはClawdbotプロジェクトの一部として、MIT Licenseの下で公開されています。

---

**実装完了日**: 2026-02-24  
**実装者**: Ricky 🐥 (サブエージェント)  
**検証状況**: ✅ DRY_RUNテスト完了、本番テスト待ち
