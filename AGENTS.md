# Repository Guidelines

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
- **定期/cronタスク**: バックグラウンド + スクリプト最後に `clawdbot message send` で強制Discord通知
- **禁止**: 「完了したら報告する」と約束してバックグラウンド実行; AIの記憶任せの報告; 長時間タスクの一括実行
