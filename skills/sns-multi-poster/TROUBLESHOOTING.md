# SNS自動投稿トラブルシューティングガイド

## 基本方針

**「Cookie方式優先 + 問題発生時はリサーチ→スクショ→HTML解析で解決」**

---

## トラブルシューティングフロー（5ステップ）

### 1️⃣ 問題検出
- エラーログ確認
- スクリーンショット確認（`screenshots/` ディレクトリ）
- ブラウザコンソールログ確認

### 2️⃣ リサーチ（Brave + X検索）
```bash
# Brave検索
web_search "Instagram API エラー [エラーメッセージ]"
web_search "Instagram Cookie 期限切れ 対処法"

# X検索
bird search "Instagram automation cookie expired"
bird search "Instagram login 429 error"
```

### 3️⃣ スクリーンショット確認
```bash
# 最新のスクリーンショットを確認
ls -lhtr /tmp/instagram-visual-debug/ | tail -10
ls -lhtr /tmp/x-visual-debug/ | tail -10
ls -lhtr /tmp/threads-visual-debug/ | tail -10

# スクリーンショット自動撮影版スクリプト（2026-02-24実装）
# Instagram: post-to-instagram-v13-with-screenshots.cjs
# X: post-to-x-v3-with-screenshots.cjs
# Threads: post-to-threads-v3-with-screenshots.cjs
```

**確認ポイント:**
- ログインページが表示されているか？
- エラーメッセージが表示されているか？
- Cookie期限切れの警告が出ているか？
- レート制限（429）の警告が出ているか？

**スクリーンショット自動撮影機能（2026-02-24）**:

各SNSスクリプトは投稿フローの各ステップで自動的にスクリーンショットを撮影します。

**保存先:**
- Instagram: `/tmp/instagram-visual-debug/01-page-loaded.png` ～ `07-dry-run-final.png`
- X (Twitter): `/tmp/x-visual-debug/01-page-loaded.png` ～ `06-after-post.png`
- Threads: `/tmp/threads-visual-debug/01-page-loaded.png` ～ `08-after-post.png`

**ファイル命名規則:**
1. `01-page-loaded.png` - ページ読み込み完了
2. `02-before-upload.png` - ファイルアップロード前
3. `03-after-upload.png` - ファイルアップロード後
4. `04-before-caption.png` - キャプション入力前
5. `05-after-caption.png` - キャプション入力後
6. `06-before-post.png` - 投稿ボタンクリック前
7. `07-dry-run-final.png` - DRY RUN最終確認（Instagram）
8. `error-*.png` - エラー時のスクリーンショット

**トラブルシューティング手順:**
1. エラー発生 → `/tmp/<platform>-visual-debug/error-*.png` を確認
2. UI変更検出 → セレクタを更新
3. 新バージョンスクリプト作成 → DRY_RUNテスト → 本番実行

### 4️⃣ HTML解析
```javascript
// Puppeteer/Playwright で HTML を取得
const html = await page.content();
console.log(html);

// セレクタが正しいか確認
const usernameInput = await page.$('input[name="username"]');
console.log('Username input found:', !!usernameInput);
```

**確認ポイント:**
- セレクタが変更されていないか？
- 新しい認証要素が追加されていないか？
- ページ構造が変わっていないか？

### 5️⃣ 修正実装
- 問題の原因を特定
- 最小限の変更で修正
- DRY_RUNモードでテスト
- 本番実行

---

## よくある問題と解決策

### ❌ 問題1: Cookie期限切れ

**症状:**
- ログインページにリダイレクトされる
- "Please log in to continue" などのメッセージ

**解決策:**
```bash
# 1. ブラウザでログイン
# 2. Cookie取得（EditThisCookie拡張機能等）
# 3. cookies/instagram.json に保存

# Cookie有効期限確認
node -e "const fs = require('fs'); const cookies = JSON.parse(fs.readFileSync('cookies/instagram.json')); const expiry = cookies.find(c => c.name === 'sessionid')?.expirationDate; if (expiry) { const days = Math.floor((expiry - Date.now()/1000) / 86400); console.log('sessionid有効期限:', days > 0 ? days + '日後' : '期限切れ'); }"
```

---

### ❌ 問題2: レート制限（429 Too Many Requests）

**症状:**
- HTTP 429エラー
- "Try again later" などのメッセージ

**解決策:**
```bash
# 1. 待機（1時間～1日）
# 2. プロキシ経由で実行（有料オプション）
# 3. リクエスト間隔を長くする

# リクエスト間隔調整例
await page.waitForTimeout(5000); # 5秒待機
```

---

### ❌ 問題3: セレクタ変更

**症状:**
- "Element not found" エラー
- タイムアウトエラー

**解決策:**
```bash
# 1. スクリーンショット確認
# 2. HTML解析で新しいセレクタ確認
# 3. スクリプト内のセレクタ更新

# セレクタ確認例
await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input'));
  inputs.forEach(input => {
    console.log('Name:', input.name, 'Type:', input.type, 'Placeholder:', input.placeholder);
  });
});
```

---

### ❌ 問題4: 二段階認証

**症状:**
- "Enter confirmation code" などのメッセージ
- SMS/メール認証要求

**解決策:**
```bash
# 1. ブラウザで手動ログイン
# 2. "Trust this device" をチェック
# 3. Cookie再取得
# 4. 信頼されたデバイスとして保存
```

---

## 自動化されたトラブルシューティング

### 自動スクリーンショット保存
すべてのスクリプトで以下を実装:
```javascript
// エラー発生時に自動スクリーンショット
try {
  // 投稿処理
} catch (error) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `screenshots/error-${timestamp}.png` });
  throw error;
}
```

### 自動リトライ
```javascript
async function postWithRetry(platform, content, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await post(platform, content);
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries}...`);
      await sleep(60000); // 1分待機
    }
  }
}
```

---

## デバッグモード

### 詳細ログ出力
```bash
# DRY_RUNモード
DRY_RUN=true node post-to-instagram-v12-final.cjs test.jpg "テスト投稿"

# デバッグモード
DEBUG=true node post-to-instagram-v12-final.cjs test.jpg "テスト投稿"
```

### ヘッドレスモード無効化（ローカルのみ）
```javascript
const browser = await puppeteer.launch({
  headless: false, // ブラウザを表示
  slowMo: 100 // 操作を遅くする
});
```

---

## リソース

- **Brave検索**: 最新情報・公式ドキュメント
- **X検索**: 実際のユーザー体験・トラブルシューティング事例
- **Instagram Graph API**: 公式API（将来的な移行候補）
- **スクリーンショット**: `screenshots/` ディレクトリ

---

---

## 最新の修正（2026-02-24）

### ✅ "Next" ボタンを2回クリックする必要がある

**症状:**
- "Share" ボタンが表示されない
- ページ遷移が発生しない

**原因:**
- Instagramの投稿フローが変更された
- 1回目: 画像編集→キャプション画面
- 2回目: キャプション→投稿確認画面

**解決策:**
```javascript
// 1回目の "Next" クリック
await nextBtn.click();
await page.waitForTimeout(3000);

// ページ遷移確認
const buttonsAfterFirst = await page.locator('button').all();

// まだ "Next" が表示されていれば、2回目のクリック
if (buttonsAfterFirst.some(btn => /next/i.test(btn.textContent()))) {
  await nextBtn.click();
  await page.waitForTimeout(3000);
}
```

---

### ✅ Cookie sameSite属性の正規化

**症状:**
- `cookies[0].sameSite: expected one of (Strict|Lax|None)` エラー

**原因:**
- ブラウザからエクスポートしたCookieの属性が不正な値
- `no_restriction` / `null` などの値が含まれている

**解決策:**
```javascript
// Cookie正規化スクリプト
const cookies = JSON.parse(fs.readFileSync('cookies/instagram.json'));
cookies.forEach(c => {
  if (c.sameSite === 'no_restriction') c.sameSite = 'None';
  else if (c.sameSite === 'lax' || c.sameSite === null) c.sameSite = 'Lax';
  else if (c.sameSite === 'strict') c.sameSite = 'Strict';
  else if (!['Strict', 'Lax', 'None'].includes(c.sameSite)) c.sameSite = 'Lax';
});
fs.writeFileSync('cookies/instagram.json', JSON.stringify(cookies, null, 2));
```

---

### ✅ ボタン検出ロジックの改善

**症状:**
- `has-text("Next")` セレクタが機能しない

**原因:**
- Playwrightの `has-text()` が期待通りに動作しない場合がある

**解決策:**
```javascript
// 柔軟なボタン検出
const buttons = await page.locator('button').all();
for (const btn of buttons) {
  const text = (await btn.textContent() || '').trim();
  if (/next/i.test(text)) { // 正規表現で柔軟にマッチ
    const isVisible = await btn.isVisible();
    if (isVisible) {
      await btn.click();
      break;
    }
  }
}
```

---

## 🔍 Vision API関連（v6.0 - 2026-02-24追加）

### Vision API未設定エラー

**症状:**
```
⚠️  ANTHROPIC_API_KEY が設定されていません（Vision機能無効）
⚠️  Vision API無効: ANTHROPIC_API_KEY未設定
```

**原因:**
- `ANTHROPIC_API_KEY` 環境変数が設定されていない
- Vision機能が無効化されている

**解決策:**
```bash
# 環境変数設定
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# gateway configに追加（全スクリプトで自動使用）
gateway.config.patch({ 
  env: { 
    vars: { 
      ANTHROPIC_API_KEY: "sk-ant-api03-..." 
    } 
  } 
})

# またはスクリプト実行時に直接指定
ANTHROPIC_API_KEY=xxx node post-to-instagram-vision.cjs /path/to/video.mp4 "キャプション"
```

**注意:**
- Vision機能が無効でも、セレクタフォールバックで動作します
- Vision APIはオプション機能（コスト削減のため）

---

### Vision API検出失敗

**症状:**
```
⚠️  Vision API: "Create" が見つかりませんでした（UI element not found in image）
⚠️  Vision失敗 → セレクタフォールバック
```

**原因:**
- UI要素が画像内に存在しない
- UI要素のテキストが異なる（多言語・表記ゆれ）
- 画像の解像度が低い
- UI要素が隠れている（オーバーレイ・ポップアップ）

**解決策:**

1. **デバッグオーバーレイを確認:**
```bash
# デバッグディレクトリ確認
ls -lhtr /tmp/instagram-vision-debug/

# オーバーレイ画像確認（座標マーカー付き）
open /tmp/instagram-vision-debug/overlay-create.png
```

2. **スクリーンショット確認:**
- UI要素が画面内に表示されているか？
- テキストが正しく表示されているか？
- オーバーレイ・ポップアップで隠れていないか？

3. **フォールバックセレクタ追加:**
```javascript
// post-to-instagram-vision.cjs
const createSuccess = await hybridClick(page, 'Create', [
  'svg[aria-label="New post"]',
  'svg[aria-label="新規投稿"]',
  '[aria-label="Create"]',  // ← 追加
  'button[data-testid="create-button"]',  // ← 追加
]);
```

4. **Vision検出のリトライ:**
- 自動的に最大3回リトライされます
- リトライ間隔: 2秒 → 4秒 → 6秒

**回避策:**
- ハイブリッド方式により、Vision失敗時は自動的にセレクタ方式にフォールバック
- コスト削減のため、Vision失敗は許容範囲

---

### Vision API レート制限エラー

**症状:**
```
❌ Vision API エラー (試行 1/3): rate_limit_exceeded
⏳ 2秒待機してリトライ...
```

**原因:**
- Anthropic APIのレート制限に到達
- 短時間に大量のリクエストを送信

**解決策:**

1. **リトライロジック（自動対応）:**
- 自動的に2秒 → 4秒 → 6秒待機してリトライ
- 最大3回まで試行

2. **並列実行を制限:**
```bash
# 並列実行数を制限（5 → 2に変更）
# post-to-all-sns.sh
MAX_PARALLEL=2  # ← 変更
```

3. **レート制限を確認:**
```bash
# Anthropic APIダッシュボードでレート制限確認
# https://console.anthropic.com/settings/limits
```

---

### Vision API コスト最適化

**コスト目安:**
- Vision API: 1回のUI検出で約$0.01〜$0.05（画像サイズによる）
- Instagram投稿（6要素検出）: 約$0.06〜$0.30
- 月100回投稿: 約$6〜$30

**コスト削減策:**

1. **ハイブリッド方式を活用:**
- Vision失敗時にセレクタフォールバック（追加コストなし）
- セレクタで検出可能な要素は Vision を使わない

2. **リトライ回数を減らす:**
```javascript
// vision-helper.cjs
const visionResult = await detectUIElement(screenshotPath, targetText, { 
  maxRetries: 1  // 3 → 1に変更（コスト削減）
});
```

3. **画像サイズを最適化:**
```javascript
// post-to-instagram-vision.cjs
await page.screenshot({ 
  path: screenshotPath,
  quality: 80,  // 画質を下げる（コスト削減）
});
```

4. **Vision使用を限定:**
```javascript
// 複雑なUI要素のみVisionを使用
// 例: "Create" ボタンはセレクタ、"Share" ボタンのみVision
if (targetText === 'Share') {
  // Vision使用
} else {
  // セレクタ方式
}
```

---

### デバッグオーバーレイが表示されない

**症状:**
- `/tmp/instagram-vision-debug/overlay-*.png` が生成されない
- Vision検出成功後もオーバーレイ画像がない

**原因:**
- `canvas` パッケージがインストールされていない
- ファイル書き込み権限がない

**解決策:**

1. **canvasパッケージ確認:**
```bash
cd /root/clawd/skills/sns-multi-poster
npm list canvas

# インストールされていない場合
npm install canvas
```

2. **ディレクトリ権限確認:**
```bash
ls -ld /tmp/instagram-vision-debug/
# drwxr-xr-x ... のような権限が必要

# 権限がない場合
sudo chmod 755 /tmp/instagram-vision-debug/
```

3. **手動テスト:**
```bash
# Vision Helper単体テスト
ANTHROPIC_API_KEY=xxx node test-vision-helper.cjs /tmp/screenshot.png "Create"

# オーバーレイが生成されるか確認
ls /tmp/screenshot-overlay.png
```

---

**最終更新**: 2026-02-24 15:00 UTC
