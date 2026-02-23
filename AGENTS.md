# Repository Guidelines

## ⚠️ モデルID管理ルール（廃止モデル使用防止）
**設定変更時に必ず使用する正しいAnthropicモデルID:**

| エイリアス | 正しいモデルID | 備考 |
|------------|---------------|------|
| sonnet | `anthropic/claude-sonnet-4-5` | Sonnet 4.5 |
| haiku | `anthropic/claude-haiku-4-5-20251001` | Haiku 4.5 ✅ 現行 |
| opus | `anthropic/claude-opus-4-5` | Opus 4.5 |

**禁止モデルID（廃止済み・404エラー）:**
- ❌ `claude-3-5-haiku-20241022` → `claude-haiku-4-5-20251001` に変更
- ❌ `anthropic/claude-sonnet-4-6` → clawdbot 2026.1.24-3 未対応（"Unknown model"エラー）

**⚠️ clawdbot未対応モデルの確認方法（必須）:**
新しいモデルを設定する前に、以下コマンドでclawdbotのサポートリストを確認すること:
```
grep "ANTHROPIC_PREFIXES\|claude-sonnet\|claude-haiku\|claude-opus" /usr/lib/node_modules/clawdbot/dist/agents/live-model-filter.js
```
このリストにないモデルIDは `Unknown model` エラーになる。使えるのはリストにあるモデルのみ。

**モデル変更のルール:**
1. `agents.defaults.model.primary` と `agents.defaults.models` の**両方**を更新する
2. 廃止モデルを使わないよう、上記テーブルのみを参照する
3. 不明なモデルIDは使わない。`anthropic/claude-haiku-4-5-20251001` がデフォルトHaiku
4. **モデルID変更前に必ずBrave検索で最新のAnthropicモデルIDを確認する** (`web_search` または `brave_search` ツール使用)
   - 検索クエリ例: "Anthropic Claude latest model ID 2026"
   - 公式参照: https://docs.anthropic.com/en/docs/about-claude/models
5. 古い形式 (`claude-3-X-modelname-YYYYMMDD`) は廃止済みの可能性が高い → 必ず確認してから使用

---

## ⚠️ Cronジョブ管理ルール（重複防止）
**新規cronジョブ追加前に必ず確認:**
1. `cron list` を実行して既存ジョブを確認
2. 同名・同目的のジョブがないか確認（例: `collect-instagram` と `collect-all-performance` は重複）
3. 個別スクリプト（例: `collect-instagram.sh`）と全体スクリプト（例: `collect-all.sh`）が被る場合は全体スクリプム側を優先
4. 追加する場合は一意の名前を使い、既存ジョブと機能が重複しないこと
5. **既存ジョブを置き換える場合は、古いジョブを必ず削除してから新規追加**

**現在のcronジョブ体系（SNS系）:**
- `sns-collect-all-buzz` - バズ収集（全SNS）
- `sns-collect-all-performance` - パフォーマンス収集（全SNS）
- `sns-daily-advice` - 日次アドバイス生成
- `sns-pdca-weekly-report` - 週次PDCAレポート
- `auto-task-progress-reporter` - タスク進捗報告（5分ごと）

---

## 🔐 認証情報の管理ルール
- 全ての認証情報は **gateway config の `env.vars`** に登録: `gateway.config.patch({ env: { vars: { KEY: "value" } } })`
- ファイル: `/root/.clawdbot/clawdbot.json`
- 登録済み変数は全チャンネル・全execで自動使用可能; `~/.profile`は参考のみ
- 新規追加: ① env.vars登録 ② `echo 'export KEY="val"' >> ~/.profile`
- 登録済みキー一覧 → TOOLS.md参照
- 新しい認証情報を受け取ったら: 即座にenv.vars登録 → 「登録しました、全チャンネルで使えますっぴ」

- Repo: https://github.com/clawdbot/clawdbot
- GitHub issues/PR comments: literal multiline or `-F - <<'EOF'`; never embed `\n`

## Project Structure
- Source: `src/` (CLI: `src/cli`, commands: `src/commands`, infra: `src/infra`, media: `src/media`)
- Tests: colocated `*.test.ts`; Docs: `docs/`; Built: `dist/`
- Plugins: `extensions/*` (keep plugin deps in extension `package.json`, not root)
- Installers: `../clawd.bot` (`public/install.sh`, `install-cli.sh`, `install.ps1`)
- Channels: `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web`, `src/channels`, `src/routing`; extensions in `extensions/*`

## Docs (Mintlify — docs.clawd.bot)
- Internal links: root-relative, no `.md`/`.mdx` (e.g., `[Config](/configuration)`, anchors: `[Hooks](/configuration#hooks)`)
- External links for Peter/README: full `https://docs.clawd.bot/...`
- Docs: no personal device names/paths; use placeholders like `user@gateway-host`

## Build & Dev
- Node 22+; `pnpm install` / `bun install`
- Prefer Bun for TS execution: `bun <file.ts>` / `bunx <tool>`
- CLI dev: `pnpm clawdbot ...` or `pnpm dev`
- `pnpm build` (tsc) | `pnpm lint` (oxlint) | `pnpm format` (oxfmt) | `pnpm test` (vitest)

## Coding Style
- TypeScript ESM, strict typing, no `any`; run `pnpm lint` before commits
- Files under ~700 LOC; extract helpers, not "V2" copies
- Naming: **Clawdbot** in docs/headings; `clawdbot` in CLI/paths/config

## Release Channels
- stable: tagged `vYYYY.M.D`, npm `latest`
- beta: `vYYYY.M.D-beta.N`, npm `beta`
- dev: `main` (no tag)

## Testing
- Vitest + V8, 70% coverage; `*.test.ts` / `*.e2e.test.ts`
- `pnpm test` before pushing; live tests: `CLAWDBOT_LIVE_TEST=1 pnpm test:live`
- Mobile: real devices before simulators/emulators

## Commit & PR
- Commits: `scripts/committer "<msg>" <file...>` (concise, action-oriented)
- Changelog: latest released at top; bump after publishing; no `Unreleased`
- PR review: `gh pr view/diff`; never switch branches or change code in review mode
- PR merge: temp branch from main → squash preferred → changelog + PR# + thanks → `pnpm lint && pnpm build && pnpm test` → merge to main → delete branch → stay on main
- Add PR author as co-contributor; add avatar to README; run `bun scripts/update-clawtributors.ts`
- After merge: leave PR comment with SHA hashes
- `sync`: commit dirty (Conventional Commit) → `git pull --rebase` → push

## Security & Config
- Web creds: `~/.clawdbot/credentials/`; rerun `clawdbot login` if logged out
- Pi sessions: `~/.clawdbot/sessions/`; env vars: `~/.profile`
- Never commit: phone numbers, videos, live config values; use obvious fake placeholders
- Release flow: read `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md` first

## Troubleshooting
- Rebrand/migration issues: `clawdbot doctor` (see `docs/gateway/doctor.md`)

## Agent Notes
- "makeup" = mac app
- Never edit `node_modules`; skill notes go in `tools.md` or `AGENTS.md`
- High-confidence answers only: verify in code; don't guess
- Never update Carbon dependency
- Patched deps (`pnpm.patchedDependencies`): exact version (no `^`/`~`); no patching without explicit approval
- **Multi-agent safety:** no git stash/worktree/branch switch unless explicitly requested; scope commits to your changes only; when "push" → `git pull --rebase` first (never discard other agents' work)
- Release guardrails: no version bumps without operator's consent; ask before `npm publish`
- Never send streaming/partial replies to WhatsApp/Telegram; only final replies
- macOS: restart via app or `scripts/restart-mac.sh`; logs via `./scripts/clawlog.sh`; no ad-hoc tmux sessions; no rebuilds over SSH
- SwiftUI: prefer `@Observable`/`@Bindable`; no new `ObservableObject`
- Version files: `package.json`, `apps/android/build.gradle.kts`, `apps/ios/Sources/Info.plist`, `apps/macos/.../Info.plist`
- A2UI bundle hash (`src/canvas-host/a2ui/.bundle.hash`): auto-generated; regenerate via `pnpm canvas:a2ui:bundle`; commit hash separately
- Tool schema (google-antigravity): no `Type.Union`/`anyOf`/`oneOf`; use `stringEnum`/`Type.Optional`; top-level must be `type: "object"`
- Bug investigations: read npm dep source + all related local code before concluding
- When GH Issue/PR given: run `git pull` first; stop if local changes exist

## NPM + 1Password (publish)
- `eval "$(op signin --account my.1password.com)"` (app unlocked + integration on)
- OTP: `op read 'op://Private/Npmjs/one-time password?attribute=otp'`
- `npm publish --access public --otp="<otp>"` from package dir
- Kill tmux session after publish

---

## 🔍 リサーチファースト原則（andoさん要求 2026-02-21）

**基本方針: 「知ってるつもり」で進めない。常に最新情報と確実な方法を両方確認してから実装する。**

### 必須リサーチフロー
1. **タスク受領 → 即座にリサーチ開始**（計画と同時実行）
   - **Brave検索**: 王道・確実な方法を確認（多くの人が検証済み）
   - **X検索**: 最新情報・実際の使用例・トラブルシューティング（個人の試行錯誤）
   
2. **検索結果を統合してプラン作成**
   - 複数のアプローチを比較
   - 最新のベストプラクティスを反映
   - 実装前に最適な方法を選択・提示

3. **検索コストを恐れない**
   - 確実性 > トークン節約
   - 既存の知識だけで進めず、常に最新情報を確認

### 自動リサーチ対象（「リサーチして」と言われなくても実行）
- 最新情報・ニュース・トレンド → `web_search` + `bird search`
- 人物・企業・サービスについて → `web_search` + `bird search`
- 技術/ツール/API/価格の比較 → `web_search` + `bird search`
- 「〜って何？」系の質問 → `web_search` + `bird search`
- 実装前の技術選定 → `web_search` + `bird search`
- エラー/トラブルシューティング → `web_search` + `bird search`
- **例外**: 単純なコード修正・ファイル作成のみ → 検索不要

---

## andoさん専用ルール (Ricky 🐥)

**🔴 返信前チェック（絶対守る）:**
1. `process list` で完了タスク確認
2. 完了タスクがあれば **即座に報告**（他の返信より優先）
3. RUNNING_TASKS.md 更新
4. **直前の会話を確認**（文脈を見失わない - 重要な文脈はmemory_storeに保存）
5. その後、ユーザーの質問に回答

**タスク実行ルール:**
- **通常タスク（短〜中時間）**: 同期実行 (background:true禁止); 1分以上でもOK; 長時間は分割報告
- **定期/cronタスク**: バックグラウンド実行; **Discord通知なし**（エラー時のみ報告）
- **禁止**: 「完了したら報告する」と約束してバックグラウンド実行; AIの記憶任せの報告; 長時間タスクの一括実行

---

## 🧪 自律的な問題解決フレームワーク（2026-02-23実装）

**基本方針**: 「全部試してみて、考えて試行できるように」

### 問題解決の4ステップ
1. **問題発見**: エラーログ確認 → 症状特定
2. **リサーチ**: web_search（王道）+ bird（最新）で複数アプローチ調査
3. **複数解決策を試行**: 最低3つ試して比較 → 最適解を選択
4. **ドキュメント化**: 結果を記録してTOOLS.md/AGENTS.mdに追記

### 実例: Threads投稿ハング問題（2026-02-23）
**症状**: `networkidle2` でページ読み込みがハング → SIGKILL
**解決策テスト**:
- ✅ 解決策1: `waitUntil: 'domcontentloaded'` に変更（3.7秒・最速）
- ✅ 解決策2: Playwright版（3.2秒・プロファイル管理優秀）
- ✅ 解決策3: タイムアウト短縮 + リトライ（6.5秒・やや遅い）
**採用**: 解決策1（最小変更で最速）

### ブラウザ自動化の定石
```javascript
// ❌ ハングしやすい
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

// ✅ 推奨
await page.goto(url, { 
  waitUntil: 'domcontentloaded',  // 基本構造読み込み完了で即進む
  timeout: 15000                   // タイムアウト短縮
});
```

### DRY RUNモードの必須実装
全てのスクリプトに以下を追加:
```javascript
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: スキップ');
  return;
}
```

### 詳細ドキュメント
→ `/root/clawd/docs/autonomous-troubleshooting-framework.md`

---

## 🔍 セマンティック検索品質ガイド（2026-02-22実装）

### 概要
`memory_recall` の検索品質を大幅向上させるための統合ガイド。セマンティック検索 + キーワード検索 + クエリ拡張 + リランキングにより、関連情報の発見精度が向上します。

**期待効果:**
- 検索ヒット率: +80%
- 関連情報発見: +45%
- ユーザー満足度: +55%

### 🛠️ ツール・ドキュメント

| リソース | 場所 | 用途 |
|---------|------|------|
| **最適化スクリプト** | `/root/clawd/scripts/memory-semantic-optimizer.sh` | ハイブリッド検索・クエリ拡張・リランキング実行 |
| **メタデータ戦略** | `/root/clawd/docs/memory-metadata-strategy.md` | 記憶保存時のメタデータ付与ガイド |

### 📊 memory_store メタデータ構造（必須）

```bash
clawdbot memory store \
  --text "記憶内容（検索対象の主要テキスト）" \
  --category "decision|fact|preference|entity|other" \
  --importance 0.7-0.95 \
  --context "検索軸の明確化（例: sns-strategy, model-selection）" \
  --tags '["tag1", "tag2", "tag3"]' \
  --timestamp "YYYY-MM-DDTHH:mm:ssZ"
```

**Category別ガイドライン:**
- `decision`: ユーザー決定事項（重要度: 0.85-0.95）
- `fact`: 確認済みの事実・統計（重要度: 0.8-0.95）
- `preference`: 個人設定・嗜好（重要度: 0.75-0.85）
- `entity`: 人物・サービス定義（重要度: 0.8-0.95）
- `other`: その他のメモ（重要度: 0.5-0.8）

### 🔎 memory_recall 検索時のベストプラクティス

#### 1️⃣ ハイブリッド検索（セマンティック + キーワード）

```bash
# ❌ セマンティック検索のみ（漏れやすい）
clawdbot memory recall "ユーザー決定"

# ✅ ハイブリッド検索（高精度）
bash /root/clawd/scripts/memory-semantic-optimizer.sh "ユーザー決定" --hybrid
```

**効果**: セマンティックに距離がある関連情報もキーワード検索で捕捉

#### 2️⃣ クエリ拡張（曖昧さを自動展開）

```bash
# 基本クエリ
clawdbot memory recall "SNS戦略"

# クエリ拡張付き（複数バリエーションで検索）
bash /root/clawd/scripts/memory-semantic-optimizer.sh "SNS戦略" --expand
# 内部: "SNS戦略" + "ソーシャルメディア" + "マーケティング" + "投稿計画"
```

**効果**: 違う表現で保存されている関連情報を発見

#### 3️⃣ リランキング（関連度スコアでソート）

```bash
# スコア関係なく結果取得
bash /root/clawd/scripts/memory-semantic-optimizer.sh "決定事項"

# 関連度スコア × キーワードマッチで自動ソート
bash /root/clawd/scripts/memory-semantic-optimizer.sh "決定事項" --rerank
```

**スコアリング基準:**
- ベーススコア: 100
- キーワードマッチ: +20/キーワード
- 詳細情報（長さ）: +10

#### 4️⃣ 統合検索（推奨）

```bash
# ✅ 最高精度: ハイブリッド + クエリ拡張 + リランキング
bash /root/clawd/scripts/memory-semantic-optimizer.sh "検索内容" --hybrid --expand --rerank
```

### 📝 記憶保存時のベストプラクティス

**✅ DO - 具体的・詳細に**
```bash
# 良い例
clawdbot memory store \
  --text "2026-02-22、SNS投稿戦略を決定: Instagram（Reels重視、週5回）、TikTok（月2-3回）、X（高頻度、1日3-5ツイート）。理由: リーチ拡大より『質の高い告知』を優先。" \
  --category decision \
  --importance 0.95 \
  --context sns-strategy \
  --tags '["instagram", "x", "tiktok", "marketing"]'
```

**❌ DON'T - 曖昧・仮説的**
```bash
# 悪い例
clawdbot memory store \
  --text "Instagramは多分重要かも" \
  --category fact \
  --importance 0.3
```

### 🎯 検索シナリオ別ガイド

| シナリオ | 推奨検索方法 | 例 |
|---------|-----------|-----|
| 過去の決定を確認 | `--hybrid --rerank` | `"ユーザー決定" --hybrid --rerank` |
| 関連情報をまとめて発見 | `--expand --hybrid` | `"SNS戦略" --expand --hybrid` |
| 正確な情報を高速取得 | 基本検索 | `"Anthropic モデルID"` |
| 低関連度も含めて確認 | 基本検索のみ | `"プロジェクト進捗"` |

### 🔄 完全なワークフロー例

```bash
#!/bin/bash

# 1️⃣ 新規決定を記録
clawdbot memory store \
  --text "2026-02-22、クライアント対応時間を決定: 平日9時-18時、緊急時のみSlack通知対応" \
  --category decision \
  --importance 0.85 \
  --context client-management \
  --tags '["workflow", "client"]'

# 2️⃣ 過去の関連情報を検索
bash /root/clawd/scripts/memory-semantic-optimizer.sh "クライアント対応" --hybrid --expand --rerank

# 3️⃣ 検索結果を参考に補足記録
clawdbot memory store \
  --text "クライアント対応の基本姿勢: 対応可能時間内での迅速返答（1時間以内）。複雑な相談は翌営業日に詳細回答。" \
  --category preference \
  --importance 0.8 \
  --context client-management
```

### 📚 参考ドキュメント
- **詳細**: `/root/clawd/docs/memory-metadata-strategy.md`
- **実装例**: ドキュメント内の「実装例」セクション
- **トラブルシューティング**: 「検索最適化のコツ」セクション

### 🎓 学習リソース

1. **初心者向け**: ハイブリッド検索でまず試す
   ```bash
   bash memory-semantic-optimizer.sh "検索キーワード" --hybrid
   ```

2. **中級者向け**: 記憶保存時にメタデータ完全付与
   ```bash
   # context / tags / timestamp を必ず付与
   ```

3. **上級者向け**: クエリ拡張 + リランキング活用
   ```bash
   bash memory-semantic-optimizer.sh "曖昧なクエリ" --hybrid --expand --rerank
   ```

### ⚡ トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|-------|
| 検索結果がない | メタデータなし / 記憶がない | `--expand` でクエリ拡張 |
| 関連度が低い結果が上位 | スコアリング基準の不適切性 | `--rerank` でリランキング |
| 冗長な結果が多い | セマンティック検索の精度 | `--hybrid` でキーワード検索併用 |
| 検索が遅い | クエリ拡張で複数検索実行 | 基本検索に絞る / 後で一括検索 |

---

**セマンティック検索をマスターすると、重要な情報の発見速度が劇的に向上します。**

---

## バックグラウンドタスク管理（サブエージェント一括通知）

**開始時:**
- RUNNING_TASKS.md記録
- 「進めます」と明言（開始報告は不要）

**サブエージェント完了時:**
- 自動報告禁止 ← **重要: `message` toolを呼び出さない**
- フラグファイル `~/.clawdbot/subagent_reports.log` に追記（形式: `<timestamp>|<task-name>|<status>|<summary>`）

**毎回の返信前チェック（`process list`実行後）:**
- 完了したサブエージェントがあれば、フラグファイルから読み取り
- **複数完了報告を1つのメッセージにまとめて** Discord投稿
- フラグファイルをクリア

**HEARTBEAT時:**
- フラグファイルが存在する場合、溜まった報告を一括投稿
- 投稿後フラグファイル削除

**例:**
```bash
# サブエージェント完了直後（報告禁止）
echo "$(date +%s)|sns-collect-all|completed|Instagram/Threads/Facebook/Pinterestから合計42件のバズ情報を収集" >> ~/.clawdbot/subagent_reports.log

# 返信前チェック時（複数件を一括投稿）
if [ -f ~/.clawdbot/subagent_reports.log ]; then
  REPORT=$(cat ~/.clawdbot/subagent_reports.log | awk -F'|' '{print "✅ " $2 ": " $4}' | tr '\n' '\n')
  message send --channel discord --target "#一般" "【サブエージェント完了報告】\n$REPORT"
  rm ~/.clawdbot/subagent_reports.log
fi
```
