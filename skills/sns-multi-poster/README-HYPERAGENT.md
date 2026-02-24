# HyperAgent統合ガイド

## 概要
HyperAgentを使ってSNS自動投稿のログインフローをAI自動化します。

### メリット
- ✅ AIがログインフォームを自動判断（「どこを押せばいい？」解決）
- ✅ Action Cache: 一度記録したら次回からLLM不要（コスト$0）
- ✅ XPathフォールバック: ページ変更時も自動対応
- ✅ 既存のPlaywrightと統合可能

## セットアップ

```bash
# HyperAgentインストール
cd /root/clawd/skills/sns-multi-poster
npm install @hyperbrowser/agent zod

# 認証情報確認（既に登録済み）
echo $ANTHROPIC_API_KEY
echo $IG_PASSWORD
```

## テストフロー

### Step 1: 初回ログイン（AI判断）

```bash
# Instagram自動ログイン
node test-hyperagent-instagram.cjs

# 期待される結果:
# ✅ ログイン成功
# 💾 Action Cache保存: action-cache/instagram-login.json
# 📸 スクリーンショット: test-screenshots/instagram-logged-in.png
```

### Step 2: キャッシュリプレイ（LLM不要）

```bash
# 保存したAction Cacheからリプレイ
node test-hyperagent-replay.cjs

# 期待される結果:
# 🚀 XPathベース実行（LLMコスト: $0）
# ⏱️ 実行時間: 3-5秒
# ✅ XPath成功率: 100%
```

## 実装例

### 基本的な使い方

```javascript
const { HyperAgent } = require("@hyperbrowser/agent");

const agent = new HyperAgent({
  llm: {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    apiKey: process.env.ANTHROPIC_API_KEY
  }
});

const page = await agent.newPage();
await page.goto("https://www.instagram.com/accounts/login/");

// 🤖 AIが自動判断してログイン
await page.ai("ログインフォームにユーザー名とパスワードを入力してログイン");

// または細かく制御
await page.perform("fill email with ando@example.com");
await page.perform("fill password with mypassword");
await page.perform("click the login button");
```

### Action Cache統合

```javascript
const fs = require("fs");

// 初回: AI判断でログイン
const { actionCache } = await page.ai("ログイン処理");

// Cache保存
fs.writeFileSync("login-cache.json", JSON.stringify(actionCache, null, 2));

// 次回: Cacheからリプレイ（LLM不要）
const loginCache = JSON.parse(fs.readFileSync("login-cache.json"));
await page.runFromActionCache(loginCache, {
  maxXPathRetries: 3,
  debug: true
});
```

## トラブルシューティング

### ログインフォームが変わった場合

HyperAgentは自動的にLLMフォールバックを実行します:

1. XPath実行を3回リトライ
2. 失敗したらLLMで再度要素検出
3. 新しいXPathでAction Cache更新

### エラー時のデバッグ

```bash
# スクリーンショット確認
ls -lh test-screenshots/

# Action Cache確認
cat action-cache/instagram-login.json | jq '.steps[] | {instruction, xpath, success}'
```

## コスト比較

| 方法 | 初回 | 2回目以降 | 月間100回 |
|------|------|----------|----------|
| **現在（Cookie JSON）** | 手動 | 手動 | 0円 |
| **HyperAgent** | $0.05 | **$0** | $0.05 |
| **手動Playwright** | 開発コスト高 | 0円 | メンテコスト高 |

## 次のステップ

1. ✅ Instagram自動ログイン確認
2. ⏭️ Threads/X/Facebook対応
3. ⏭️ 既存スクリプトに統合
4. ⏭️ Cronジョブ設定

## 参考リンク

- HyperAgent公式: https://github.com/hyperbrowserai/HyperAgent
- ドキュメント: https://www.hyperbrowser.ai/docs/hyperagent/introduction
