# Vision-based UI検出システム - 統合ガイド

**実装日:** 2026-02-24  
**バージョン:** v6.0  
**ステータス:** Instagram実装完了、他SNS準備中

---

## 📖 概要

Claude Messages API（Vision）を使って、スクリーンショットからUI要素を自動検出し、座標ベースでクリックするシステム。従来のセレクタ方式と組み合わせた「ハイブリッド方式」により、UI変更に強く、コストも最適化されています。

---

## 🎯 機能

### 1. Vision API統合
- スクリーンショット → Base64エンコード → Vision API → 座標抽出
- Claude Sonnet 4.5使用（高精度）
- リトライロジック（最大3回）
- エラーハンドリング（タイムアウト・レート制限対応）

### 2. ハイブリッド方式
```
Vision API試行
  ↓
成功 → 座標クリック
  ↓
失敗 → セレクタフォールバック
  ↓
失敗 → テキストベース検索
  ↓
失敗 → エラー
```

**メリット:**
- UI変更に強い（セレクタが壊れてもVisionで検出可能）
- コスト最適化（Vision失敗時にセレクタで回避）
- デバッグ容易（オーバーレイ画像で視覚的確認）

### 3. デバッグオーバーレイ
- 検出された座標に十字マーカー・円・ラベルを描画
- 確信度（confidence）をパーセンテージで表示
- 複数要素の同時検出に対応

---

## 📦 ファイル構成

```
/root/clawd/skills/sns-multi-poster/
├── vision-helper.cjs              # Vision API統合ヘルパー（汎用）
├── test-vision-helper.cjs         # Vision Helper単体テスト
├── post-to-instagram-vision.cjs   # Instagram Vision統合版
└── /tmp/instagram-vision-debug/   # デバッグ出力ディレクトリ
    ├── 01-page-loaded.png         # ステップごとのスクリーンショット
    ├── 02-before-create.png
    ├── overlay-create.png         # デバッグオーバーレイ
    └── ...
```

---

## 🚀 使い方

### 基本的な使い方

```bash
cd /root/clawd/skills/sns-multi-poster

# Instagram投稿（Vision統合版）
ANTHROPIC_API_KEY=xxx node post-to-instagram-vision.cjs /path/to/video.mp4 "キャプション"

# DRY_RUNテスト
DRY_RUN=true node post-to-instagram-vision.cjs /path/to/video.mp4 "テスト"
```

### Vision Helper単体テスト

```bash
# スクリーンショットからUI要素を検出
ANTHROPIC_API_KEY=xxx node test-vision-helper.cjs /tmp/screenshot.png "Create"

# デバッグオーバーレイが生成される
ls /tmp/screenshot-overlay.png
```

### デバッグモード

```bash
# デバッグ出力ディレクトリ確認
ls -lhtr /tmp/instagram-vision-debug/

# オーバーレイ画像確認（座標マーカー付き）
open /tmp/instagram-vision-debug/overlay-create.png
```

---

## 🔧 実装方法（他SNSへの展開）

### 1. vision-helper.cjs を利用

```javascript
const visionHelper = require('./vision-helper.cjs');

// UI要素を検出
const result = await visionHelper.detectUIElement(
  screenshotPath,  // スクリーンショットのパス
  'Create',        // 検出したいテキスト
  {
    debug: true,   // デバッグモード
    maxRetries: 3  // リトライ回数
  }
);

if (result) {
  // 座標クリック
  await page.mouse.click(result.x, result.y);
  
  // デバッグオーバーレイ作成
  await visionHelper.drawDebugOverlay(
    screenshotPath,
    [result],
    '/tmp/overlay.png'
  );
}
```

### 2. ハイブリッドクリック関数

```javascript
async function hybridClick(page, targetText, fallbackSelectors = [], timeout = 30000) {
  // スクリーンショット撮影
  const screenshotPath = `/tmp/screenshot-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath });
  
  // Vision API試行
  const visionResult = await visionHelper.detectUIElement(
    screenshotPath,
    targetText,
    { debug: true, maxRetries: 2 }
  );
  
  if (visionResult && visionResult.confidence > 0.6) {
    // Vision成功 → 座標クリック
    await page.mouse.click(visionResult.x, visionResult.y);
    return true;
  }
  
  // Vision失敗 → セレクタフォールバック
  for (const selector of fallbackSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        return true;
      }
    } catch (err) {
      // 次のセレクタを試行
    }
  }
  
  // セレクタ失敗 → テキストベース検索
  const clicked = await page.evaluate((text) => {
    const elements = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (const el of elements) {
      if (el.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
        el.click();
        return true;
      }
    }
    return false;
  }, targetText);
  
  return clicked;
}
```

### 3. 使用例

```javascript
// Instagram Create ボタン
const createSuccess = await hybridClick(page, 'Create', [
  'svg[aria-label="New post"]',
  'svg[aria-label="新規投稿"]',
  '[aria-label="Create"]',
]);

// Next ボタン
const nextSuccess = await hybridClick(page, 'Next', [
  'button:has-text("Next")',
  'button:has-text("次へ")',
]);

// Share ボタン
const shareSuccess = await hybridClick(page, 'Share', [
  'button:has-text("Share")',
  'button:has-text("シェア")',
]);
```

---

## 💰 コスト試算

### Vision APIコスト

- **1回のUI検出:** 約$0.01〜$0.05（画像サイズによる）
- **Instagram投稿（6要素検出）:** 約$0.06〜$0.30
  - Create: $0.01〜$0.05
  - Post: $0.01〜$0.05
  - Upload: $0.01〜$0.05（スキップ可能）
  - Next × 2: $0.02〜$0.10
  - Share: $0.01〜$0.05
- **月100回投稿:** 約$6〜$30

### コスト削減策

1. **ハイブリッド方式:**
   - Vision失敗時にセレクタフォールバック（追加コストなし）
   - セレクタで検出可能な要素はVisionを使わない

2. **リトライ回数を制限:**
   ```javascript
   maxRetries: 1  // 3 → 1に変更
   ```

3. **画質を下げる:**
   ```javascript
   await page.screenshot({ 
     path: screenshotPath,
     quality: 80  // 画質を下げる
   });
   ```

4. **Vision使用を限定:**
   - 複雑なUI要素のみVisionを使用
   - 固定セレクタで検出可能な要素はセレクタ優先

---

## 🐛 トラブルシューティング

### Vision API未設定

**症状:**
```
⚠️  ANTHROPIC_API_KEY が設定されていません（Vision機能無効）
```

**解決策:**
```bash
# 環境変数設定
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# またはスクリプト実行時に指定
ANTHROPIC_API_KEY=xxx node post-to-instagram-vision.cjs /path/to/video.mp4 "キャプション"
```

### Vision検出失敗

**症状:**
```
⚠️  Vision API: "Create" が見つかりませんでした
⚠️  Vision失敗 → セレクタフォールバック
```

**確認:**
1. デバッグオーバーレイを確認: `/tmp/instagram-vision-debug/overlay-*.png`
2. スクリーンショットを確認: `/tmp/instagram-vision-debug/*.png`
3. UI要素が画面内に表示されているか？
4. テキストが正しく表示されているか？

**対策:**
- フォールバックセレクタを追加
- リトライ回数を増やす
- 画面解像度を上げる

### レート制限エラー

**症状:**
```
❌ Vision API エラー: rate_limit_exceeded
```

**対策:**
- リトライロジックが自動的に対応（2秒 → 4秒 → 6秒待機）
- 並列実行数を制限
- Anthropic APIダッシュボードでレート制限確認

---

## 📊 実装ステータス

| SNS | ステータス | Vision統合 | ハイブリッド方式 | デバッグオーバーレイ |
|-----|-----------|-----------|----------------|-------------------|
| Instagram | ✅ 完了 | ✅ | ✅ | ✅ |
| Threads | 🔄 準備中 | - | - | - |
| Facebook | 🔄 準備中 | - | - | - |
| X (Twitter) | 🔄 準備中 | - | - | - |
| Pinterest | 🔄 準備中 | - | - | - |

---

## 🔄 今後の展開

### Phase 1: テンプレート作成（完了 ✅）
- Claude Messages API統合テンプレート作成
- スクリーンショット → base64 → Vision API → 座標抽出
- リトライロジック + デバッグオーバーレイ機能

### Phase 2: Instagram実装（完了 ✅）
- `post-to-instagram-reels-v2-wait-completion.cjs` ベースに改造
- Vision検出: "Create"/"Next"(×2)/キャプション/"Share"
- ハイブリッド方式: Vision失敗時セレクタフォールバック

### Phase 3: 動作検証（完了 ✅）
- DRY_RUNテスト
- スクリーンショット確認
- エラーケーステスト

### Phase 4: ドキュメント更新（完了 ✅）
- SKILL.md更新
- TROUBLESHOOTING.md追記
- VISION_INTEGRATION.md作成

### Phase 5: 他SNS展開（準備中 🔄）
- Threads Vision統合
- Facebook Vision統合
- X (Twitter) Vision統合
- Pinterest Vision統合

---

## 📚 参考資料

- **Anthropic Messages API:** https://docs.anthropic.com/en/api/messages
- **Claude Vision:** https://docs.anthropic.com/en/docs/vision
- **Puppeteer:** https://pptr.dev/
- **canvas (Node.js):** https://www.npmjs.com/package/canvas

---

**作成者:** Ricky 🐥  
**作成日:** 2026-02-24  
**最終更新:** 2026-02-24 15:00 UTC
