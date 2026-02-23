# SNS ブラウザログイン汎用テンプレート ガイド

## 概要

複数のSNS（Instagram、Facebook、TikTok、Pinterest、X）に対応した、自動ブラウザログインフロー。Playwrightを使用して、Cookie認証を自動化・保存します。

**特徴:**
- ✅ 統一テンプレート化で、複数SNSに対応
- ✅ VNC環境対応
- ✅ Cookie自動保存
- ✅ 環境変数による認証情報管理
- ✅ JSON設定ファイルでパラメータ化

---

## ディレクトリ構成

```
/root/clawd/
├── config/
│   └── sns-login-config.json          # SNS設定ファイル（URL、Cookie保存先etc）
├── scripts/
│   ├── sns-browser-login-template.sh  # 汎用テンプレート（Bash）
│   ├── sns-browser-login-runner.js    # ロジック実装（Node.js）
│   ├── login-instagram.sh             # Instagram専用スクリプト
│   ├── login-facebook.sh              # Facebook専用スクリプト
│   ├── login-tiktok.sh                # TikTok専用スクリプト
│   ├── login-pinterest.sh             # Pinterest専用スクリプト
│   └── login-x.sh                     # X (Twitter) 専用スクリプト
├── cookies/
│   ├── instagram.json                 # Instagram Cookies
│   ├── facebook.json                  # Facebook Cookies
│   ├── tiktok.json                    # TikTok Cookies
│   ├── pinterest.json                 # Pinterest Cookies
│   └── x.json                         # X Cookies
├── profiles/
│   ├── instagram/                     # Chromium プロファイル
│   ├── facebook/
│   ├── tiktok/
│   ├── pinterest/
│   └── x/
└── docs/
    └── sns-browser-login-guide.md     # このドキュメント
```

---

## 使用方法

### 1. 環境変数設定

各SNSのログイン認証情報を環境変数に登録します。

#### Instagram

```bash
export IG_USERNAME="your_username"
export IG_PASSWORD="your_password"
```

または、gateway configに登録（推奨）:

```bash
gateway.config.patch({
  env: {
    vars: {
      IG_USERNAME: "your_username",
      IG_PASSWORD: "your_password"
    }
  }
})
```

#### Facebook

```bash
export FB_EMAIL="your_email@example.com"
export FB_PASSWORD="your_password"
```

#### TikTok

```bash
export TT_USERNAME="your_username"
export TT_PASSWORD="your_password"
```

#### Pinterest

```bash
export PINTEREST_EMAIL="your_email@example.com"
export PINTEREST_PASSWORD="your_password"
```

#### X (Twitter)

```bash
export X_USERNAME="your_username"
export X_PASSWORD="your_password"
```

### 2. ログインスクリプト実行

#### Instagram（最も簡単）

```bash
bash /root/clawd/scripts/login-instagram.sh
```

#### Facebook

```bash
bash /root/clawd/scripts/login-facebook.sh
```

#### TikTok

```bash
bash /root/clawd/scripts/login-tiktok.sh
```

#### Pinterest

```bash
bash /root/clawd/scripts/login-pinterest.sh
```

#### X (Twitter)

```bash
bash /root/clawd/scripts/login-x.sh
```

### 3. 対話モード（認証情報を手動入力）

環境変数が設定されていない場合、対話モードで入力できます：

```bash
bash /root/clawd/scripts/login-instagram.sh
# 以下のプロンプトが表示されます:
# IG_USERNAME: nisen_prints
# IG_PASSWORD: (password input)
```

### 4. Headful モード（ブラウザを表示）

デフォルトはHeadlessモード（ブラウザを表示しない）ですが、Headfulモードで実行することもできます：

```bash
bash /root/clawd/scripts/login-instagram.sh true
```

---

## 設定ファイル詳細

### `sns-login-config.json`

各SNSの設定パラメータを定義しています。

```json
{
  "instagram": {
    "name": "Instagram",
    "login_url": "https://www.instagram.com/",
    "cookies_path": "/root/clawd/cookies/instagram.json",
    "profile_path": "/root/clawd/profiles/instagram",
    "vnc_port": 5901,
    "login_timeout_ms": 30000,
    "wait_after_login_ms": 2000,
    "username_selector": "input[name=\"username\"]",
    "password_selector": "input[name=\"password\"]",
    "submit_button": "button[type=\"submit\"]",
    "logged_in_indicators": ["a[href*=\"/direct/\"]", "svg[aria-label*=\"Home\"]"],
    "env_vars": {
      "username": "IG_USERNAME",
      "password": "IG_PASSWORD"
    },
    "dismissable_dialogs": [
      { "selector": "button:has-text('Not now')", "label": "Save info dialog" },
      { "selector": "button:has-text('Not Now')", "label": "Notification dialog" }
    ]
  }
}
```

**パラメータ説明:**

| パラメータ | 説明 |
|-----------|------|
| `name` | SNSの表示名 |
| `login_url` | ログインページのURL |
| `cookies_path` | Cookie保存先パス |
| `profile_path` | Chromiumプロファイル保存先 |
| `vnc_port` | VNCポート番号 |
| `login_timeout_ms` | ログイン完了待機時間（ミリ秒） |
| `wait_after_login_ms` | ログイン後の待機時間 |
| `username_selector` | ユーザー名入力フィールドのセレクタ |
| `password_selector` | パスワード入力フィールドのセレクタ |
| `submit_button` | ログインボタンのセレクタ |
| `logged_in_indicators` | ログイン完了判定用のセレクタ配列 |
| `env_vars` | 使用する環境変数キー |
| `dismissable_dialogs` | 自動で閉じるダイアログ（オプション） |

---

## トラブルシューティング

### ログインに失敗する

**原因1: セレクタが合致していない**

ページの構造が変更された場合、セレクタの更新が必要です。Headfulモードで実行して、ブラウザで確認：

```bash
bash /root/clawd/scripts/login-instagram.sh true
```

ブラウザのDevToolsでセレクタを確認し、`sns-login-config.json`を更新してください。

**原因2: 2段階認証**

2段階認証が有効な場合、自動ログインに失敗します。その場合：

```bash
# Headfulモードで実行
bash /root/clawd/scripts/login-instagram.sh true

# ブラウザ内で手動で2段階認証を完了
# その後、Cookieが自動保存されます
```

**原因3: 環境変数が設定されていない**

ログを確認：

```bash
bash /root/clawd/scripts/login-instagram.sh
# 環境変数が不足している旨のメッセージが表示されます
```

### Cookie保存エラー

Cookie保存先ディレクトリの権限を確認：

```bash
ls -la /root/clawd/cookies/
```

必要に応じてディレクトリを作成：

```bash
mkdir -p /root/clawd/cookies
```

---

## アドバンス：新しいSNSを追加する

### Step 1: `sns-login-config.json`に設定を追加

```json
{
  "linkedin": {
    "name": "LinkedIn",
    "login_url": "https://www.linkedin.com/",
    "cookies_path": "/root/clawd/cookies/linkedin.json",
    "profile_path": "/root/clawd/profiles/linkedin",
    "vnc_port": 5906,
    "login_timeout_ms": 30000,
    "wait_after_login_ms": 2000,
    "username_selector": "input[name=\"session_key\"]",
    "password_selector": "input[name=\"session_password\"]",
    "submit_button": "button[type=\"submit\"]",
    "logged_in_indicators": ["a[href*=\"/feed\"]"],
    "env_vars": {
      "username": "LINKEDIN_EMAIL",
      "password": "LINKEDIN_PASSWORD"
    },
    "dismissable_dialogs": []
  }
}
```

### Step 2: 環境変数を設定

```bash
export LINKEDIN_EMAIL="your_email@example.com"
export LINKEDIN_PASSWORD="your_password"
```

### Step 3: テンプレートで実行

```bash
bash /root/clawd/scripts/sns-browser-login-template.sh linkedin
```

または、専用スクリプトを作成：

```bash
cat > /root/clawd/scripts/login-linkedin.sh << 'EOF'
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/sns-browser-login-template.sh" "linkedin" "$@"
EOF
chmod +x /root/clawd/scripts/login-linkedin.sh
```

---

## セレクタの取得方法

Headfulモードでブラウザを開いて、DevToolsで確認：

```bash
# 1. Headfulモードで実行
bash /root/clawd/scripts/login-instagram.sh true

# 2. ブラウザが開いたら、F12でDevToolsを開く

# 3. ユーザー名フィールドを右クリック → "Inspect Element"
# 例：<input name="username" type="text" ... />

# 4. セレクタをコピー：
# input[name="username"]
```

---

## Gateway 統合（推奨）

環境変数をGateway configに登録すると、全チャンネルから自動的に使用可能：

```bash
gateway.config.patch({
  env: {
    vars: {
      IG_USERNAME: "nisen_prints",
      IG_PASSWORD: "***",
      FB_EMAIL: "your_email@example.com",
      FB_PASSWORD: "***",
      TT_USERNAME: "your_tiktok_handle",
      TT_PASSWORD: "***",
      PINTEREST_EMAIL: "your_email@example.com",
      PINTEREST_PASSWORD: "***",
      X_USERNAME: "your_x_handle",
      X_PASSWORD: "***"
    }
  }
})
```

---

## ファイル一覧

| ファイル | 説明 | 実行可能 |
|---------|------|--------|
| `sns-browser-login-template.sh` | 汎用テンプレート | ✅ |
| `sns-browser-login-runner.js` | Node.js実装 | - |
| `login-instagram.sh` | Instagram専用 | ✅ |
| `login-facebook.sh` | Facebook専用 | ✅ |
| `login-tiktok.sh` | TikTok専用 | ✅ |
| `login-pinterest.sh` | Pinterest専用 | ✅ |
| `login-x.sh` | X専用 | ✅ |

---

## 参考リンク

- Playwright ドキュメント: https://playwright.dev/
- Instagram ログイン: https://www.instagram.com/
- Facebook ログイン: https://www.facebook.com/
- TikTok ログイン: https://www.tiktok.com/
- Pinterest ログイン: https://www.pinterest.com/login/
- X ログイン: https://x.com/

---

## 更新履歴

- **2026-02-24**: 初期版作成
  - テンプレート化完了
  - 5つのSNS対応
  - ドキュメント作成完了
