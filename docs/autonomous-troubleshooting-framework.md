# 自律的なトラブルシューティングフレームワーク

**目的**: AIエージェント（リッキー）が、andoさんに頼らずに自分で問題を解決できるようにする

---

## 📋 問題解決の基本フロー

### 1️⃣ 問題発見
- エラーログを確認（SIGKILL、timeout、connection refused など）
- 症状を特定（どこで止まっているか、どのコマンドが失敗しているか）

### 2️⃣ リサーチ（必須）
```bash
# Web検索（公式ドキュメント・Stack Overflow・GitHub Issues）
web_search "puppeteer networkidle2 hang"

# X検索（最新情報・実際の使用例）
bird search "puppeteer timeout fix"
```

**リサーチポリシー**:
- 「知ってるつもり」で進めない
- 王道の方法（Brave検索）+ 最新情報（X検索）を両方確認
- 複数のアプローチを比較してから実装

### 3️⃣ 複数の解決策を試行
- **最低3つの解決策**を考えて、全部試す
- テストスクリプトを作成して検証
- 結果を比較して最適解を選択

### 4️⃣ ドキュメント化
- テスト結果を記録
- 今後の参考になるようにTOOLS.md / AGENTS.md に追記

---

## 🔧 ブラウザ自動化のトラブルシューティング

### 症状: ページ読み込みがハングする

**原因候補**:
1. `waitUntil: 'networkidle2'` がバックグラウンド通信で完了しない
2. タイムアウト設定が長すぎる
3. ヘッドレスモードでレンダリングが遅い

**解決策テンプレート**:
```javascript
// 解決策1: waitUntilを変更
await page.goto(url, { 
  waitUntil: 'domcontentloaded',  // networkidle2 → domcontentloaded
  timeout: 15000 
});

// 解決策2: タイムアウトを短縮 + リトライ
page.setDefaultTimeout(10000);
for (let i = 0; i < 3; i++) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    break;
  } catch (e) {
    if (i === 2) throw e;
    await new Promise(r => setTimeout(r, 5000));
  }
}

// 解決策3: Playwright に切り替え
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
```

---

## 📡 API/ネットワークエラーのトラブルシューティング

### 症状: HTTP 429 (Too Many Requests)

**解決策**:
```bash
# 1. レート制限ログを確認
cat /root/clawd/data/sns-posts/rate-limit-log.json

# 2. 指数バックオフでリトライ
for i in 1 2 5; do
  if curl -s ...; then break; fi
  echo "リトライまで ${i}分待機"
  sleep $((i * 60))
done

# 3. 無料代替APIを検索
web_search "Brave Search API free alternative"
bird search "無料 検索API おすすめ"
```

---

## 🔍 デバッグツール活用

### ブラウザスクリーンショット
```javascript
// 失敗時のスクリーンショットを自動保存
try {
  // 処理
} catch (error) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `/tmp/error-${ts}.png`, fullPage: true });
  console.error(`スクリーンショット: /tmp/error-${ts}.png`);
  throw error;
}
```

### プロセス監視
```bash
# 実行中のプロセス確認
process list

# ハングしているプロセスを特定
ps aux | grep node | grep -v grep

# タイムアウトで自動終了
timeout 30 node script.js
```

---

## 🧪 テスト戦略

### DRY RUN モード
全てのスクリプトに `DRY_RUN=true` でスキップできる機能を実装:
```javascript
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: スキップ');
  return;
}
```

### 段階的テスト
1. **最小限のテスト**: ログインだけ確認
2. **部分テスト**: ページ読み込み + スクリーンショット
3. **完全テスト**: 実際の投稿（DRY RUN）
4. **本番実行**: DRY_RUN=false

---

## 📚 参考リソース

### 公式ドキュメント
- Puppeteer: https://pptr.dev/
- Playwright: https://playwright.dev/
- Clawdbot: /root/clawd/docs/

### トラブルシューティング記録
- **Threads投稿ハング問題** (2026-02-23):
  - 症状: `networkidle2` でハング
  - 解決: `domcontentloaded` に変更
  - 検証: 3つの解決策を全てテスト
  - 結果: 解決策1（waitUntil変更）が最適

---

## 🎯 自律的な問題解決の心構え

1. **「知ってるつもり」で進めない** → 必ずリサーチ
2. **複数の解決策を試す** → 1つで満足しない
3. **テストを徹底する** → DRY RUN → 段階的に本番
4. **ドキュメント化する** → 次回の参考になるように
5. **andoさんに報告する** → 完了後に結果を共有

---

**このフレームワークを守れば、andoさんに頼らずに自律的に問題解決できますっぴ！ 🐥**
