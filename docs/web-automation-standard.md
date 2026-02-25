# Web自動化標準パターン（2026-02-25更新 - Vision統合版）

## 🎯 基本方針

**全てのWeb自動化（ブラウザ自動化）タスクで以下を必須実装:**

1. **Vision API統合（推奨）**: Claude Messages APIでUI要素座標検出 + セレクタフォールバック
2. **全ステップでスクリーンショット撮影**: エラー時だけでなく、各アクション前後に必ず撮影
3. **ステップごとの確認**: 各ステップで状態を可視化し、問題を早期発見
4. **デバッグディレクトリ**: `/tmp/<platform>-vision-debug/` に統一（Vision統合版）
5. **ファイル命名規則**: `01-page-loaded.png`, `02-before-click.png`, `03-after-click.png`, ..., `error-*.png`
6. **ログ出力**: 各スクリーンショット撮影時に「📸 スクリーンショット: <ファイルパス>」とログ出力

---

## 🔍 Vision統合パターン（2026-02-25標準化 ✅ 正式版）

### ハイブリッド方式（Vision API → セレクタフォールバック）

**目的:** セレクタ依存を減らし、UI変更に強い自動化を実現

**仕組み:**
1. Vision API（Claude Messages API）でスクリーンショットからUI要素座標を検出
2. Vision失敗時は従来のセレクタ方式にフォールバック
3. 全ステップでスクリーンショット撮影（デバッグ用）

**実装例:**

```javascript
const visionHelper = require('./vision-helper.cjs');
const DEBUG_DIR = '/tmp/<platform>-vision-debug';

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

await hybridClick(page, 'Post', [
  'button:has-text("Post")',
  '[role="button"]:has-text("Post")',
]);
```

**メリット:**
- ✅ UI変更に強い（セレクタが変わっても動作）
- ✅ テキストベースで直感的（"Create", "Post", "Share"等）
- ✅ デバッグ容易（スクリーンショット + オーバーレイ）
- ✅ フォールバック機能（Vision失敗時もセレクタで動作）

**必須環境変数:**
- `ANTHROPIC_API_KEY` - Claude Messages API認証（未設定時はセレクタモードのみ）

**Vision Helper (`vision-helper.cjs`):**
- Claude Messages API統合
- Base64エンコーディング
- リトライロジック（最大3回）
- デバッグオーバーレイ（座標確認用）

**実装済みスクリプト（正式版）:**
- Instagram: `/root/clawd/skills/sns-multi-poster/post-to-instagram-vision.cjs`
- X (Twitter): `/root/clawd/skills/sns-multi-poster/post-to-x-vision.cjs`
- Threads: `/root/clawd/skills/sns-multi-poster/post-to-threads-vision.cjs`
- Facebook: `/root/clawd/skills/sns-multi-poster/post-to-facebook-vision.cjs`
- Pinterest: `/root/clawd/skills/sns-multi-poster/post-to-pinterest-vision.cjs`

---

## 📸 実装テンプレート

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

---

## 📋 撮影タイミング（必須）

**全てのアクション前後に撮影:**

1. ✅ **ページ読み込み完了後**
2. ✅ **各ボタンクリック前後**
3. ✅ **各テキスト入力前後**
4. ✅ **各ファイルアップロード前後**
5. ✅ **各セレクタ検索前後**（要素が見つからない場合）
6. ✅ **モーダル/ダイアログ表示前後**
7. ✅ **DRY RUN最終確認**
8. ✅ **エラー発生時**

---

## 📋 ファイル命名規則

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

---

## 🎯 メリット

**トラブルシューティング効率化:**
- エラー発生 → スクリーンショット確認 → UI変更検出 → セレクタ修正
- 「何が起きているか分からない」問題を解消
- **各ステップの実行状態を可視化**

**UI変更の早期発見:**
- プラットフォームのインターフェース変更を即座に検出
- スクリーンショットで視覚的に確認可能
- **アクション前後の比較で変化を追跡**

**デバッグ時間短縮:**
- エラー原因の特定が高速化（画面を見れば一目瞭然）
- セレクタ問題の修正が迅速化
- **複数ステップの実行状態を一覧で確認可能**

**再現性の向上:**
- 過去のスクリーンショットを参照して問題を再現
- トラブルシューティングの記録として活用
- **ステップごとの状態確認で問題箇所を特定**

---

## 📚 参考実装

**実装済みスクリプト:**
- Instagram: `/root/clawd/skills/sns-multi-poster/post-to-instagram-with-screenshots.cjs`
- X (Twitter): `/root/clawd/skills/sns-multi-poster/post-to-x-with-screenshots.cjs`
- Threads: `/root/clawd/skills/sns-multi-poster/post-to-threads-with-screenshots.cjs`

**スクリーンショット保存先:**
- Instagram: `/tmp/instagram-visual-debug/`
- X (Twitter): `/tmp/x-visual-debug/`
- Threads: `/tmp/threads-visual-debug/`

---

## 🚀 今後の全Web自動化で適用

**新規スクリプト作成時:**
1. このテンプレートを参考に実装
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

## 🔍 スクリーンショット確認フロー

```
1. エラー発生
   ↓
2. `/tmp/<platform>-visual-debug/` を確認
   ↓
3. 最新のスクリーンショットを開く
   ↓
4. アクション前後のスクリーンショットを比較
   ↓
5. UI変更 or セレクタ問題を検出
   ↓
6. セレクタを修正 or アプローチを変更
   ↓
7. DRY_RUNテストで動作確認
   ↓
8. 本番実行
```

---

**決定日**: 2026-02-24  
**決定者**: andoさん  
**実装者**: リッキー（Claude）🐥  
**強化版実装日**: 2026-02-24 17:10 UTC
