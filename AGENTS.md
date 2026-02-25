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

**🚨 全Web自動化で必須実装（2026-02-24決定・強化版）:**
1. **全ステップでスクリーンショット撮影**: エラー時だけでなく、各アクション前後に必ず撮影
2. **ステップごとの確認**: 各ステップで状態を可視化し、問題を早期発見
3. **デバッグディレクトリ**: `/tmp/<platform>-visual-debug/` に統一
4. **ファイル命名規則**: `01-page-loaded.png`, `02-before-click.png`, `03-after-click.png`, ..., `error-*.png`
5. **ログ出力**: 各スクリーンショット撮影時に「📸 スクリーンショット: <ファイルパス>」とログ出力

**実装パターン（テンプレート）:**
```javascript
const DEBUG_DIR = '/tmp/<platform>-visual-debug';
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// ステップカウンター
let stepCounter = 1;

// スクリーンショット撮影ヘルパー関数
async function takeScreenshot(page, description) {
  const filename = `${String(stepCounter).padStart(2, '0')}-${description}.png`;
  const filepath = path.join(DEBUG_DIR, filename);
  console.log(`📸 スクリーンショット: ${filepath}`);
  await page.screenshot({ path: filepath });
  stepCounter++;
}

// 使用例（各アクション前後に撮影）
await takeScreenshot(page, 'page-loaded');

// クリック前
await takeScreenshot(page, 'before-button-click');
await button.click();
// クリック後
await takeScreenshot(page, 'after-button-click');

// テキスト入力前
await takeScreenshot(page, 'before-text-input');
await input.type('text');
// テキスト入力後
await takeScreenshot(page, 'after-text-input');

// エラー時も必ず撮影
if (!element) {
  const errorFile = path.join(DEBUG_DIR, `error-${Date.now()}.png`);
  await page.screenshot({ path: errorFile });
  console.log(`📸 エラースクリーンショット: ${errorFile}`);
  throw new Error('要素が見つかりません');
}
```

**撮影タイミング（必須）:**
1. ページ読み込み完了後
2. **各ボタンクリック前後**
3. **各テキスト入力前後**
4. **各ファイルアップロード前後**
5. **各セレクタ検索前後**（要素が見つからない場合）
6. エラー発生時

**ファイル命名規則（統一）:**
- `01-page-loaded.png` - ページ読み込み完了
- `02-before-button-click.png` - ボタンクリック前
- `03-after-button-click.png` - ボタンクリック後
- `04-before-file-upload.png` - ファイルアップロード前
- `05-after-file-upload.png` - ファイルアップロード後
- `06-before-text-input.png` - テキスト入力前
- `07-after-text-input.png` - テキスト入力後
- `error-<timestamp>.png` - エラー時のスクリーンショット

**参考実装:**
- Instagram: `/root/clawd/skills/sns-multi-poster/post-to-instagram-with-screenshots.cjs`
- X (Twitter): `/root/clawd/skills/sns-multi-poster/post-to-x-with-screenshots.cjs`
- Threads: `/root/clawd/skills/sns-multi-poster/post-to-threads-with-screenshots.cjs`

#### ページ読み込み戦略（プラットフォーム別）

**一般的なサイト（推奨）:**
```javascript
// ✅ 軽量サイト・静的コンテンツ
await page.goto(url, { 
  waitUntil: 'domcontentloaded',  // 基本構造読み込み完了で即進む
  timeout: 15000                   // タイムアウト短縮
});
```

**X (Twitter)・重いSPA（特殊ケース）:**
```javascript
// ✅ バックグラウンド通信が多いサイト
await page.goto(url, { 
  waitUntil: 'networkidle2',      // ネットワークアクティビティが落ち着くまで待機
  timeout: 60000                   // タイムアウト延長
});
await randomDelay(8000, 12000);   // 追加待機（ローディング画面対策）
```

**判断基準:**
- ❌ `domcontentloaded` でローディング画面のまま → `networkidle2` に変更
- ❌ `networkidle2` でハング（Threads等） → `domcontentloaded` に変更
- ✅ エラー時はスクリーンショット撮影で状態確認

#### Cookie管理（sameSite正規化）

```javascript
// ✅ Cookie読み込み時は必ず正規化
const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')).map(c => ({
  name: c.name,
  value: decodeURIComponent(c.value),
  domain: c.domain || '.example.com',
  path: c.path || '/',
  secure: c.secure !== false,
  httpOnly: c.httpOnly === true,
  sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
  expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
}));
await page.setCookie(...cookies);
```

#### セレクタ戦略（複数フォールバック）

```javascript
// ✅ 複数セレクタを順番に試す
const selectors = [
  'input[type="file"]#main-upload',
  'input[type="file"][data-testid="file-input"]',
  'input[type="file"]',
  'input[accept*="image"]',
];

let fileInput = null;
for (const selector of selectors) {
  fileInput = await page.$(selector);
  if (fileInput) {
    console.log(`✅ ファイル入力を発見: ${selector}`);
    break;
  }
  await page.waitForTimeout(2000); // 2秒待機してから次を試す
}

if (!fileInput) {
  // 最終手段: JavaScript evaluate
  fileInput = await page.evaluateHandle(() => document.querySelector('input[type="file"]'));
}
```

#### Playwright → Puppeteer 構文変換

| Playwright | Puppeteer (XPath) |
|-----------|------------------|
| `button:has-text("Post")` | `//button[contains(text(), "Post")]` |
| `div >> text=Hello` | `//div[contains(text(), "Hello")]` |
| `div:has(> button)` | `//div[button]` |

**ルール**: Playwright構文は必ずXPathに変換してからPuppeteerで使用

#### Vision API統合方式（2026-02-25標準化 ✅ 正式版）

**目的**: セレクタ依存を減らし、UI変更に強い自動化を実現

**ハイブリッド方式（Vision API → セレクタフォールバック）:**
1. Vision API（Claude Messages API）でスクリーンショットからUI要素座標を検出
2. Vision失敗時はセレクタ方式にフォールバック
3. 全ステップでスクリーンショット撮影（デバッグ用）

**実装パターン:**
```javascript
const visionHelper = require('./vision-helper.cjs');

// ハイブリッドクリック関数
async function hybridClick(page, targetText, fallbackSelectors = [], timeout = 30000) {
  console.log(`\n🎯 "${targetText}" をクリック試行（ハイブリッド方式）`);
  
  // スクリーンショット撮影
  const screenshotPath = await takeScreenshot(page, `before-${targetText.toLowerCase().replace(/\s+/g, '-')}`);
  
  // Vision API試行
  const visionResult = await visionHelper.detectUIElement(screenshotPath, targetText, {
    debug: true,
    maxRetries: 2
  });
  
  if (visionResult && visionResult.confidence > 0.6) {
    console.log(`✅ Vision検出成功: (${visionResult.x}, ${visionResult.y})`);
    
    // デバッグオーバーレイ作成
    const overlayPath = path.join(DEBUG_DIR, `overlay-${targetText.toLowerCase().replace(/\s+/g, '-')}.png`);
    await visionHelper.drawDebugOverlay(screenshotPath, [visionResult], overlayPath);
    
    // 座標クリック
    try {
      await page.mouse.click(visionResult.x, visionResult.y);
      console.log(`✅ Vision座標でクリック成功`);
      await randomDelay(1000, 2000);
      await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-vision`);
      return true;
    } catch (err) {
      console.error(`❌ Vision座標クリック失敗: ${err.message}`);
    }
  }
  
  // フォールバック: セレクタ方式
  console.log(`⚠️  Vision失敗 → セレクタフォールバック`);
  
  for (const selector of fallbackSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, element);
        
        if (isVisible) {
          console.log(`✅ セレクタ検出: ${selector}`);
          await element.click();
          console.log(`✅ セレクタでクリック成功`);
          await randomDelay(1000, 2000);
          await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-selector`);
          return true;
        }
      }
    } catch (err) {
      // 次のセレクタを試行
    }
  }
  
  console.error(`❌ タイムアウト: "${targetText}" が見つかりません`);
  return false;
}

// 使用例
await hybridClick(page, 'Create', [
  'svg[aria-label="New post"]',
  '[aria-label="Create"]',
]);
```

**Vision統合版スクリプト（正式版）:**
- ✅ Instagram: `post-to-instagram-vision.cjs` → `post-to-instagram.cjs`（シンボリックリンク）
- ✅ X (Twitter): `post-to-x-vision.cjs` → `post-to-x.cjs`（シンボリックリンク）
- ✅ Threads: `post-to-threads-vision.cjs` → `post-to-threads.cjs`（シンボリックリンク）
- ✅ Facebook: `post-to-facebook-vision.cjs` → `post-to-facebook.cjs`（シンボリックリンク）
- ✅ Pinterest: `post-to-pinterest-vision.cjs` → `post-to-pinterest.cjs`（シンボリックリンク）

**Vision Helper (`vision-helper.cjs`):**
- Claude Messages API統合
- Base64エンコーディング
- リトライロジック（最大3回）
- デバッグオーバーレイ（座標確認用）

**メリット:**
1. UI変更に強い（セレクタが変わっても動作）
2. テキストベースで直感的（"Create", "Post", "Share"等）
3. デバッグ容易（スクリーンショット + オーバーレイ）
4. フォールバック機能（Vision失敗時もセレクタで動作）

**必須環境変数:**
- `ANTHROPIC_API_KEY` - Claude Messages API認証（未設定時はセレクタモードのみ）

**参考実装:**
- `/root/clawd/skills/sns-multi-poster/post-to-instagram-vision.cjs`
- `/root/clawd/skills/sns-multi-poster/vision-helper.cjs`

#### スクリーンショット確認方式（2026-02-24標準化）

**目的**: 投稿フローの各ステップをビジュアル確認し、UI変更・セレクタ問題を早期発見

**実装パターン（全SNSスクリプトで標準化）**:

```javascript
const DEBUG_DIR = '/tmp/<platform>-visual-debug';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// 各ステップでスクリーンショット撮影
console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/01-page-loaded.png');
await page.screenshot({ path: DEBUG_DIR + '/01-page-loaded.png' });

// エラー時も必ず撮影
if (!element) {
  await page.screenshot({ path: DEBUG_DIR + '/error-element-not-found.png' });
  console.log('📸 エラースクリーンショット: ' + DEBUG_DIR + '/error-element-not-found.png');
  throw new Error('要素が見つかりません');
}
```

**ファイル命名規則**:
- `01-page-loaded.png` - ページ読み込み完了
- `02-before-upload.png` - ファイルアップロード前
- `03-after-upload.png` - ファイルアップロード後
- `04-before-caption.png` - キャプション入力前
- `05-after-caption.png` - キャプション入力後
- `06-before-post.png` - 投稿ボタンクリック前
- `07-dry-run-final.png` - DRY RUN最終確認
- `error-*.png` - エラー時のスクリーンショット

**実装済みスクリプト**:
- Instagram: `post-to-instagram-v13-with-screenshots.cjs`
- X (Twitter): `post-to-x-v3-with-screenshots.cjs`
- Threads: `post-to-threads-v3-with-screenshots.cjs`

**参考**: `/root/clawd/skills/sns-multi-poster/post-to-instagram-v13-with-screenshots.cjs`

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

---

## 🔄 自己改善ループ（Boris Cherny流・失敗駆動学習）

**基本方針**: "Claudeが間違えたら、AGENTS.mdとlessons.mdに追記して二度と同じ失敗をしない"

### 失敗→学習→ルール追加の3ステップ

#### 1️⃣ 失敗を記録（tasks/lessons.md）
```bash
# エラー発生時、即座に記録
echo "## $(date +%Y-%m-%d) - <失敗内容の簡潔な説明>" >> /root/clawd/tasks/lessons.md
echo "**症状**: <何が起きたか>" >> /root/clawd/tasks/lessons.md
echo "**原因**: <なぜ起きたか>" >> /root/clawd/tasks/lessons.md
echo "**解決策**: <どう修正したか>" >> /root/clawd/tasks/lessons.md
echo "**今後のルール**: <AGENTS.mdに追加すべきルール>" >> /root/clawd/tasks/lessons.md
echo "" >> /root/clawd/tasks/lessons.md
```

#### 2️⃣ ルール化（AGENTS.md）
失敗パターンをルールに変換して、このファイルの適切なセクションに追加:
- **技術的な失敗** → 「Coding Style」「Build & Dev」セクション
- **運用上の失敗** → 「Agent Notes」「andoさん専用ルール」セクション
- **アーキテクチャの失敗** → 「Project Structure」セクション

#### 3️⃣ 検証（必須）
ルール追加後、必ず以下を実行:
```bash
# 1. 同じ失敗が起きないか再現テスト
# 2. lessons.mdに「検証完了」マーク追加
echo "**検証**: ✅ $(date +%Y-%m-%d) 再現しないことを確認" >> /root/clawd/tasks/lessons.md
```

### Self-Check必須項目（Boris流・厳格版）

**コード変更前の自問:**
1. ✅ この変更で「何が」「なぜ」改善されるか説明できるか？
2. ✅ シニアエンジニアがこのPRを承認するか？
3. ✅ 「たぶん動く」「おそらく大丈夫」と思っていないか？ ← **絶対禁止**
4. ✅ 過去の失敗パターン（lessons.md）に該当しないか？

**コード変更後の検証（必須）:**
1. ✅ 動作確認を実施したか？（DRY RUNまたは本番相当環境）
2. ✅ エッジケースを考慮したか？（空文字列、null、巨大ファイル等）
3. ✅ 既存機能を壊していないか？（関連するスクリプト・設定を確認）
4. ✅ ログ出力は適切か？（成功時は最小限、エラー時は詳細）

**失敗時の対応（Boris流）:**
> "After every correction, end with: 'Update your AGENTS.md so you don't make that mistake again.'"

失敗を見つけたら：
1. lessons.mdに記録
2. AGENTS.mdにルール追加
3. 関連するスクリプト/コードを修正
4. 検証して再発防止を確認

### Challenge Mode（Boris推奨）

**実装前:**
- 「この実装の欠点を3つ挙げて」と自問
- 「もっとエレガントな方法はないか？」と検討
- 複数アプローチを比較してから実装

**実装後:**
- 「このコードは保守しやすいか？」と自問
- 「6ヶ月後の自分が理解できるか？」と確認
- 「他のエンジニアがこのコードをレビューしたら何を指摘するか？」を想像

### 実践例

**悪い例（Boris NG）:**
```bash
# ❌ 「たぶん動く」で実装
echo "処理中..." > /tmp/status.txt
# → ファイルパスのtypo・権限エラー・ディスク容量不足を考慮していない
```

**良い例（Boris OK）:**
```bash
# ✅ エラーハンドリング・検証・ログ完備
STATUS_FILE="/tmp/status.txt"
if ! touch "$STATUS_FILE" 2>/dev/null; then
  echo "ERROR: Cannot write to $STATUS_FILE" >&2
  exit 1
fi
echo "処理中..." > "$STATUS_FILE"
[ -f "$STATUS_FILE" ] && echo "✅ Status file created successfully" || echo "❌ Status file creation failed" >&2
```

### lessons.md活用方法

**定期レビュー（週次推奨）:**
```bash
# 過去の失敗パターンを確認
cat /root/clawd/tasks/lessons.md | grep "$(date +%Y-%m)" -A 5
```

**新規タスク開始前:**
```bash
# 関連する失敗事例を検索
grep -i "<キーワード>" /root/clawd/tasks/lessons.md
```

**参考**: [Boris Chernyのワークフロー](https://paddo.dev/blog/how-boris-uses-claude-code/)

---

## 🚀 Phase 3: RAG統合による学習強化（2026-02-24実装完了 ✅）

**基本方針**: 失敗だけでなく、成功パターンも学習し、過去の実装例を参照できるようにする

**実装状況**: ✅ 完了（2026-02-24 15:40 UTC）
- ✅ 成功パターン記録システム (`success-pattern-extractor.sh`)
- ✅ プロンプト最適化システム (`prompt-optimizer.sh`)
- ✅ RAG検索システム (`rag-search.sh`, `rag-index.py`)
- ✅ インデックス作成完了（12ファイル、90チャンク）
- ✅ 動作テスト完了（セマンティック検索正常動作）

### 3つの柱

#### 1️⃣ 成功パターン記録（successes.md）

**記録内容:**
- 成功した実装・調査・修正のパターン
- アプローチと成功要因
- 再利用可能なテクニック

**記録方法:**
```bash
bash /root/clawd/scripts/success-pattern-extractor.sh record \
  "タスク名" \
  "実装内容" \
  "アプローチ" \
  "成功要因" \
  "関連スキル"
```

**例:**
```bash
bash success-pattern-extractor.sh record \
  "Discord BOT実装" \
  "メッセージ送信・リアクション機能" \
  "Discord.js + Webhooks" \
  "API仕様を最初に確認・段階的実装" \
  "discord, nodejs"
```

#### 2️⃣ RAG検索システム（rag-search.sh）

**目的**: 過去の実装例・成功パターン・失敗事例を検索して参照

**使い方:**
```bash
# 初回: インデックス作成
bash /root/clawd/scripts/rag-search.sh index

# 検索
bash /root/clawd/scripts/rag-search.sh search "Discord BOT実装"
```

**検索対象:**
- `lessons.md` - 失敗パターン
- `successes.md` - 成功パターン
- `skills/*/SKILL.md` - スキル定義

**検索エンジン:**
- sentence-transformers（all-MiniLM-L6-v2）でベクトル化
- FAISSで高速セマンティック検索
- Top-K結果を距離スコア付きで返す

#### 3️⃣ プロンプト最適化（prompt-optimizer.sh）

**目的**: タスクカテゴリ別に最適なプロンプトテンプレートを管理

**使い方:**
```bash
# 初期化（テンプレート作成）
bash /root/clawd/scripts/prompt-optimizer.sh init

# テンプレート取得
bash prompt-optimizer.sh get research "Brave検索の代替"

# 成功/失敗を記録（成功率トラッキング）
bash prompt-optimizer.sh update research success

# ベストテンプレート選択
bash prompt-optimizer.sh best
```

**テンプレートカテゴリ:**
- `research` - 調査タスク
- `implementation` - 実装タスク
- `verification` - 検証タスク

### タスク開始時のワークフロー（Phase 3統合版）

1. **過去の事例を検索**
   ```bash
   bash rag-search.sh search "<タスク名>"
   ```

2. **最適なプロンプトテンプレート取得**
   ```bash
   bash prompt-optimizer.sh get <category> "<タスク概要>"
   ```

3. **実装実行**（通常通り）

4. **成功パターン記録**
   ```bash
   bash success-pattern-extractor.sh record "<タスク名>" "..." "..." "..." "..."
   ```

5. **プロンプト統計更新**
   ```bash
   bash prompt-optimizer.sh update <category> success
   ```

6. **RAGインデックス更新**
   ```bash
   bash rag-search.sh index
   ```

### 期待効果

- **成功率向上**: 過去の成功パターン参照で初回成功率+30%
- **実装時間短縮**: 類似タスクの実装例参照で-40%
- **品質向上**: ベストプラクティスの自動適用

### ファイル構成

| ファイル | 用途 |
|---------|------|
| `/root/clawd/tasks/successes.md` | 成功パターン記録 |
| `/root/clawd/knowledge/embeddings.index` | FAISSインデックス |
| `/root/clawd/knowledge/metadata.json` | メタデータ |
| `/root/clawd/config/prompt-templates/*.txt` | プロンプトテンプレート |
| `/root/clawd/config/prompt-stats.json` | 成功率統計 |
| `/root/clawd/scripts/rag-search.sh` | RAG検索スクリプト |
| `/root/clawd/scripts/rag-index.py` | RAGインデックス作成 |
| `/root/clawd/scripts/success-pattern-extractor.sh` | 成功パターン記録 |
| `/root/clawd/scripts/prompt-optimizer.sh` | プロンプト最適化 |

---

## 📋 プランモード（Plan Mode）必須ルール

**基本方針**: Boris Cherny流「3ステップ以上または設計判断が必要な場合は必ずプラン作成→承認→実行」

### プランモード発動条件（いずれか該当で必須）
1. ✅ **3ステップ以上**の実装が必要
2. ✅ **設計判断**が必要（アーキテクチャ・データ構造・API設計等）
3. ✅ **複数ファイル**の変更が必要
4. ✅ **既存機能の大幅変更**（破壊的変更のリスク）
5. ✅ **外部サービス統合**（新規API・認証情報追加等）

### プランモードの3ステップ

**Step 1: プラン作成**
```markdown
## 実装プラン

### 概要
<何を実装するか・なぜ必要か>

### アプローチ
<どのように実装するか・代替案との比較>

### ステップ
1. <ステップ1の詳細>
2. <ステップ2の詳細>
3. <ステップ3の詳細>
...

### リスク・注意点
- <リスク1>
- <リスク2>

### 検証方法
<動作確認の具体的な方法>
```

**Step 2: 承認待ち**
- プラン提示 → ユーザー承認 → 実装開始
- 承認前に実装開始しない（Boris厳守ルール）

**Step 3: 実装 + 検証**
- プラン通りに実装
- 各ステップ完了後に中間報告（長時間タスクの場合）
- 最終検証 → lessons.md記録

### プランモード実例

**❌ NG例（プランなし・いきなり実装）:**
```
ユーザー: 「SNS自動投稿機能を作って」
Claude: 「わかりました、実装します」← プラン提示なし
→ 後で仕様変更・手戻り発生
```

**✅ OK例（プラン作成→承認→実行）:**
```
ユーザー: 「SNS自動投稿機能を作って」
Claude: 「以下のプランで実装します：
1. Instagram Graph API統合
2. Threads API統合
3. 認証情報をgateway configに追加
4. DRY_RUNモード実装
5. Cronジョブ設定

このプランでよろしいですか？」
ユーザー: 「OK」
Claude: 「実装を開始します」
→ 手戻りなし・効率的
```

### サブエージェント起動時のプランモード

サブエージェント起動前に、以下を必ず提示:
1. **何をするか**（タスクの目的・ゴール）
2. **どうやるか**（実装アプローチ・ステップ）
3. **所要時間見込み**（短時間/中時間/長時間）
4. **リスク**（既存機能への影響等）

承認後、サブエージェント起動（`process list` で進捗確認可能）

**参考**: [Boris Chernyのプランモード解説](https://paddo.dev/blog/how-boris-uses-claude-code/)

---
