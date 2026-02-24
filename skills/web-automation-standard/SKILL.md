# web-automation-standard

**全Web自動化で必須実装のスクリーンショット確認方式（2026-02-24決定・強化版）**

## Trigger
- "ブラウザ自動化"
- "Web自動化"
- "Puppeteer"
- "Playwright"
- "スクレイピング"
- "自動投稿"
- "自動ログイン"
- 新規Web自動化スクリプトの作成時

## What
全てのWeb自動化（ブラウザ自動化）タスクで、**各アクション前後に**スクリーンショットを自動撮影する「スクリーンショット確認方式」を必須実装する。

**強化版の特徴:**
- ✅ エラー時だけでなく、各アクション前後に必ず撮影
- ✅ ヘルパー関数 `takeScreenshot()` で自動採番
- ✅ ステップごとの状態確認で問題を早期発見

## Why
- **トラブルシューティング効率化**: エラー発生時に何が起きているか視覚的に確認可能
- **UI変更の早期発見**: プラットフォームのインターフェース変更を即座に検出
- **デバッグ時間短縮**: エラー原因の特定が高速化（画面を見れば一目瞭然）
- **再現性の向上**: 過去のスクリーンショットを参照して問題を再現
- **ステップごとの確認**: 各アクション前後の比較で変化を追跡

## How

### 1️⃣ デバッグディレクトリ作成 + ヘルパー関数

```javascript
const path = require('path');
const DEBUG_DIR = '/tmp/<platform>-visual-debug';

// デバッグディレクトリ作成
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
```

### 2️⃣ 各ステップでスクリーンショット撮影（アクション前後）

```javascript
// ページ読み込み完了
console.log('🔄 Step 1: Navigate to page');
await page.goto(url, { waitUntil: 'domcontentloaded' });
await takeScreenshot(page, 'page-loaded');

// ボタンクリック前後
console.log('🔄 Step 2: Click create button');
await takeScreenshot(page, 'before-create-button-click');
await createButton.click();
await page.waitForTimeout(2000); // 画面遷移を待機
await takeScreenshot(page, 'after-create-button-click');

// ファイルアップロード前後
console.log('🔄 Step 3: Upload file');
await takeScreenshot(page, 'before-file-upload');
await fileInput.uploadFile(imagePath);
await page.waitForTimeout(3000); // アップロード完了を待機
await takeScreenshot(page, 'after-file-upload');

// テキスト入力前後
console.log('🔄 Step 4: Enter caption');
await takeScreenshot(page, 'before-caption-input');
await captionInput.type(caption);
await takeScreenshot(page, 'after-caption-input');

// 投稿ボタンクリック前後
console.log('🔄 Step 5: Click post button');
await takeScreenshot(page, 'before-post-button-click');
if (process.env.DRY_RUN === 'true') {
  await takeScreenshot(page, 'dry-run-final');
  console.log('🔄 DRY RUN: 投稿をスキップ');
  return;
}
await postButton.click();
await page.waitForTimeout(5000); // 投稿処理を待機
await takeScreenshot(page, 'after-post-button-click');
```

### 3️⃣ エラー時の視覚的デバッグ

```javascript
// セレクタが見つからない場合
try {
  element = await page.waitForSelector(selector, { timeout: 10000 });
} catch (error) {
  const errorFile = path.join(DEBUG_DIR, `error-element-not-found-${Date.now()}.png`);
  await page.screenshot({ path: errorFile });
  console.log(`📸 エラースクリーンショット: ${errorFile}`);
  throw new Error(`要素が見つかりません: ${selector}`);
}

// ログイン失敗の場合
const currentUrl = page.url();
if (currentUrl.includes('/login') || currentUrl.includes('/accounts/login')) {
  const errorFile = path.join(DEBUG_DIR, `error-login-failed-${Date.now()}.png`);
  await page.screenshot({ path: errorFile });
  console.log(`📸 エラースクリーンショット: ${errorFile}`);
  throw new Error('ログイン失敗 - Cookie期限切れの可能性');
}

// 一般的なエラーハンドリング
try {
  // ... 処理 ...
} catch (error) {
  const errorFile = path.join(DEBUG_DIR, `error-${Date.now()}.png`);
  await page.screenshot({ path: errorFile });
  console.log(`📸 エラースクリーンショット: ${errorFile}`);
  throw error;
}
```

## 撮影タイミング（必須）

**全てのアクション前後に撮影:**

1. ✅ **ページ読み込み完了後**
2. ✅ **各ボタンクリック前後**
3. ✅ **各テキスト入力前後**
4. ✅ **各ファイルアップロード前後**
5. ✅ **各セレクタ検索前後**（要素が見つからない場合）
6. ✅ **モーダル/ダイアログ表示前後**
7. ✅ **DRY RUN最終確認**
8. ✅ **エラー発生時**

## Files

- **標準パターン**: `/root/clawd/docs/web-automation-standard.md`
- **参考実装**:
  - Instagram: `/root/clawd/skills/sns-multi-poster/post-to-instagram-with-screenshots.cjs`
  - X (Twitter): `/root/clawd/skills/sns-multi-poster/post-to-x-with-screenshots.cjs`
  - Threads: `/root/clawd/skills/sns-multi-poster/post-to-threads-with-screenshots.cjs`

## ファイル命名規則

| ファイル名 | 説明 |
|-----------|------|
| `01-page-loaded.png` | ページ読み込み完了 |
| `02-before-create-button-click.png` | 作成ボタンクリック前 |
| `03-after-create-button-click.png` | 作成ボタンクリック後 |
| `04-before-file-upload.png` | ファイルアップロード前 |
| `05-after-file-upload.png` | ファイルアップロード後 |
| `06-before-caption-input.png` | キャプション入力前 |
| `07-after-caption-input.png` | キャプション入力後 |
| `08-before-post-button-click.png` | 投稿ボタンクリック前 |
| `09-after-post-button-click.png` | 投稿ボタンクリック後 |
| `10-dry-run-final.png` | DRY RUN最終確認 |
| `error-<timestamp>.png` | エラー時のスクリーンショット |

**注意:**
- ステップカウンターで自動採番（`01`, `02`, `03`, ...）
- エラースクリーンショットは `error-<timestamp>.png` 形式で保存
- タイムスタンプ使用でエラー発生順序が追跡可能

## Notes

**新規Web自動化スクリプト作成時:**
1. `/root/clawd/docs/web-automation-standard.md` を参照
2. ヘルパー関数 `takeScreenshot()` を必ず使用
3. 各アクション前後にスクリーンショット撮影
4. エラー時の視覚的デバッグを実装

**既存スクリプト更新時:**
1. スクリーンショット強化版を作成（例: `-with-screenshots.cjs`）
2. ヘルパー関数を追加
3. 各アクション前後にスクリーンショット追加
4. エントリーポイントを更新
5. TOOLS.md/AGENTS.mdにドキュメント化

**トラブルシューティング時:**
1. `/tmp/<platform>-visual-debug/` のスクリーンショットを確認
2. **アクション前後のスクリーンショットを比較**
3. UI変更を検出 → セレクタを更新
4. DRY_RUNテストで動作確認
5. 本番実行

---

**決定日**: 2026-02-24  
**決定者**: andoさん  
**実装者**: リッキー（Claude）🐥  
**強化版実装日**: 2026-02-24 17:10 UTC
