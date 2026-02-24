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

**最終更新**: 2026-02-24 10:18 UTC
