# VNC 経由 Instagram ブラウザログインセットアップガイド

## 概要
このガイドは、VPS 上で VNC (Virtual Network Computing) を使用して、Instagram へのブラウザログインをリモート操作する手順を説明します。

### 特徴
- ✅ Xvfb による仮想ディスプレイ
- ✅ TightVNCServer によるリモートアクセス
- ✅ Playwright headful モードでの GUI ブラウザ操作
- ✅ OTP/2FA 対応（手動入力可）
- ✅ Cookies 自動保存と復元

---

## システム要件

- **OS**: Linux (Ubuntu 20.04 LTS 以上推奨)
- **Node.js**: v18+ 以上
- **インストール済みパッケージ**:
  - `Xvfb` (Virtual Framebuffer)
  - `tightvncserver` または `vncserver`
  - `x11-utils`, `x11-xserver-utils`
- **ネットワーク**: VPS へのポート 5999 へのアクセス

---

## インストール手順

### 1️⃣ VPS 側のセットアップ

#### Step 1: 必要なパッケージをインストール
```bash
sudo apt-get update
sudo apt-get install -y tightvncserver x11-utils x11-xserver-utils xvfb
```

#### Step 2: Playwright をインストール（Node.js プロジェクト内）
```bash
cd /root/clawd
npm install --save-dev playwright
```

#### Step 3: セットアップスクリプトを実行
```bash
bash /root/clawd/scripts/setup-vnc-instagram-login.sh start
```

**出力例:**
```
[2026-02-23 12:34:56] ℹ️  Xvfb 仮想ディスプレイを起動中...
[2026-02-23 12:34:56] ✅ Xvfb (PID: 12345) が起動しました
[2026-02-23 12:34:56] ℹ️  DISPLAY=:99
[2026-02-23 12:34:58] ✅ VNC サーバーが起動しました
[2026-02-23 12:34:58] ℹ️  接続先: <VPS_IP>:5999
```

#### Step 4: VNC パスワード設定（初回のみ）
セットアップスクリプト実行時に対話的にパスワードを設定します：
```bash
VNC password: ****
Verify: ****
```

> ⚠️ パスワードは重要です。忘れずに記録しておいてください。

---

### 2️⃣ 手元からの VNC 接続設定

#### Windows / macOS / Linux VNC Viewer インストール

**TigerVNC Viewer** (推奨) のダウンロード：
- https://github.com/TigerVNC/tigervnc/releases
- または `vncviewer` コマンドラインツール

#### 接続方法（GUI）

1. **VNC Viewer を起動**
2. **接続先を入力:**
   ```
   <VPS_IP>:5999
   ```
   例: `203.0.113.42:5999`

3. **VNC パスワードを入力**
4. **接続！**

#### 接続方法（コマンドライン）

```bash
vncviewer <VPS_IP>:5999
```

例:
```bash
vncviewer 203.0.113.42:5999
```

---

## Instagram ログイン操作手順

### 📱 ログインフロー

#### Step 1: VNC 接続を確認
VNC Viewer でデスクトップが見えることを確認します。

#### Step 2: Instagram ログインスクリプトを実行

VPS 側で：
```bash
DISPLAY=:99 node /root/clawd/scripts/instagram-vnc-login.cjs
```

またはセットアップスクリプト経由：
```bash
bash /root/clawd/scripts/setup-vnc-instagram-login.sh start
# その後、別ターミナルで：
DISPLAY=:99 node /root/clawd/scripts/instagram-vnc-login.cjs
```

#### Step 3: VNC 経由でブラウザを操作

**スクリプト出力:**
```
[ℹ️  INFO] Playwright を起動中 (headful モード)...
[ℹ️  INFO] Instagram にアクセス中: https://www.instagram.com/
[ℹ️  INFO] ===== 以下の手順に従ってください =====
[ℹ️  INFO] 1. ブラウザの画面でInstagramにログインしてください
[ℹ️  INFO] 2. OTP/2FAが要求された場合は入力してください
[ℹ️  INFO] 3. ログイン後、「Enter キーを押す」と表示されたら Enter を押してください
[ℹ️  INFO] ======================================

✋ ログイン完了後、Enter キーを押してください:
```

**VNC で以下を操作:**
1. Chrome/Chromium ブラウザが起動
2. Instagram ログインページが開く
3. **ユーザー名 / メールアドレス** を入力
4. **パスワード** を入力
5. **ログインボタン** をクリック

#### Step 4: 2FA/OTP が要求された場合

**スクリプト側:**
```
✋ ログイン完了後、Enter キーを押してください:
```

**VNC 側 (ブラウザ):**
- **2FA コード入力画面** が表示される
- 認証アプリまたは SMS から 6 ケタのコードを取得
- ブラウザで入力
- **確認** をクリック

#### Step 5: フィード画面に進む

- Instagram フィードが表示される
- VPS 側のターミナルで **Enter キー** を押す

#### Step 6: Cookies が自動保存

```
[✅ SUCCESS] Cookies を保存しました: /root/clawd/cookies/instagram.json
[✅ SUCCESS] ✅ Instagram ログインが完了しました！
```

---

## VNC サーバーの管理

### ✅ ステータス確認
```bash
bash /root/clawd/scripts/setup-vnc-instagram-login.sh status
```

**出力例:**
```
[2026-02-23 12:35:00] ℹ️  ステータス確認中...

✅ Xvfb (DISPLAY=:99): 実行中
✅ VNC サーバー (ポート 5999): 実行中
   接続先: <VPS_IP>:5999
```

### 🛑 VNC サーバーを停止
```bash
bash /root/clawd/scripts/setup-vnc-instagram-login.sh stop
```

### 🔄 VNC サーバーを再起動
```bash
bash /root/clawd/scripts/setup-vnc-instagram-login.sh restart
```

---

## Cookies 管理

### 💾 保存位置
```
/root/clawd/cookies/instagram.json
```

### 🔄 次回ログイン時の復元

**スクリプトは自動的に以下を実行:**
1. 既存の Cookies を読み込む
2. Cookies をブラウザに復元
3. Instagram フィード に直接アクセス

> 💡 次回ログインでは、ユーザー名とパスワードの入力が不要になる場合があります（Cookies 有効期限による）。

### ⚠️ Cookies が期限切れの場合

Cookies が無効または期限切れの場合：
- スクリプトが自動的にログインページを表示
- 通常のログイン手順を実行
- 新しい Cookies が自動保存される

---

## トラブルシューティング

### ❌ 問題: VNC が接続できない

**原因と対策:**
1. **ファイアウォール設定** - ポート 5999 がブロックされていないか確認
   ```bash
   sudo ufw allow 5999/tcp
   ```

2. **VNC サーバーが起動していない** - ステータス確認
   ```bash
   bash /root/clawd/scripts/setup-vnc-instagram-login.sh status
   ```

3. **VNC パスワードが間違っている** - パスワードを再設定
   ```bash
   vncpasswd ~/.vnc/passwd
   ```

### ❌ 問題: Playwright ブラウザが起動しない

**原因と対策:**
1. **DISPLAY 環境変数が未設定**
   ```bash
   export DISPLAY=:99
   node /root/clawd/scripts/instagram-vnc-login.cjs
   ```

2. **Xvfb が起動していない** - セットアップスクリプトを再実行
   ```bash
   bash /root/clawd/scripts/setup-vnc-instagram-login.sh restart
   ```

3. **ログを確認**
   ```bash
   tail -f /root/clawd/logs/vnc/playwright.log
   ```

### ❌ 問題: Cookies の保存に失敗

**原因と対策:**
1. **ディレクトリが存在しない** - スクリプトが自動作成（通常は問題なし）
2. **パーミッションエラー** - 権限を確認
   ```bash
   ls -la /root/clawd/cookies/
   ```

3. **ディスク容量不足** - ディスク空き容量を確認
   ```bash
   df -h /root/clawd/
   ```

### ❌ 問題: VNC が遅い・応答が悪い

**最適化:**
1. **ネットワーク** - VPS とクライアント間のネットワークレーテンシーを確認
2. **解像度を下げる** - セットアップスクリプトの GEOMETRY を編集
   ```bash
   GEOMETRY="1280x720"  # または 1024x768
   ```

3. **圧縮を有効化** - VNC Viewer で圧縮オプションを有効にする

---

## ログファイル

### 📋 VNC ログ位置
```
/root/clawd/logs/vnc/
```

**ファイル:**
- `setup.log` - セットアップスクリプトログ
- `xvfb.log` - Xvfb ログ
- `vncserver.log` - VNC サーバーログ
- `playwright.log` - Playwright スクリプトログ

**ログ確認:**
```bash
tail -f /root/clawd/logs/vnc/playwright.log
```

---

## セキュリティに関する注意

### ⚠️ VNC パスワード

- デフォルトでは **パスワードなし** (SecurityTypes None)
- ファイアウォールで **ポート 5999 を制限** してください
- 本番環境では **VPN/SSH トンネル** の使用を推奨

### VPN トンネル経由での接続（推奨）

```bash
# SSH トンネル経由
ssh -L 5999:localhost:5999 user@<VPS_IP>

# その後、localhost:5999 で VNC 接続
vncviewer localhost:5999
```

---

## 自動化と統合

### 🚀 Cron ジョブで定期実行（オプション）

```bash
# 毎日 8:00 に Instagram Cookies を更新
0 8 * * * DISPLAY=:99 node /root/clawd/scripts/instagram-vnc-login.cjs >> /root/clawd/logs/vnc/cron.log 2>&1
```

### 📡 API 統合例

```javascript
const cookies = require('/root/clawd/cookies/instagram.json');
console.log(`Loaded ${cookies.length} Instagram cookies`);
```

---

## 参考資料

- **Xvfb ドキュメント**: https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml
- **TightVNC**: https://www.tightvnc.com/
- **Playwright**: https://playwright.dev/
- **VNC プロトコル**: https://tools.ietf.org/html/rfc6143

---

## よくある質問 (FAQ)

### Q: VNC 経由でも Playwright は動作しますか？
**A:** はい、DISPLAY 環境変数を設定すれば動作します。xvfb-run を使用する方法もあります。

### Q:複数の Instagram アカウントを管理できますか？
**A:** はい、別の DISPLAY (例: :100, :101) を使用して複数の VNC サーバーを起動できます。

### Q: Cookies の有効期限はどのくらいですか？
**A:** Instagram の Cookies の有効期限は通常 **90 日程度** です。定期的にリフレッシュすることをお勧めします。

### Q: Windows から VNC 接続できますか？
**A:** はい、TigerVNC Viewer や RealVNC などの Windows クライアントを使用してください。

---

## サポート

問題が発生した場合：

1. **ログファイルを確認**: `/root/clawd/logs/vnc/`
2. **ステータスを確認**: `bash /root/clawd/scripts/setup-vnc-instagram-login.sh status`
3. **スクリプトを再実行**: `bash /root/clawd/scripts/setup-vnc-instagram-login.sh restart`

---

**最終更新**: 2026-02-23  
**バージョン**: 1.0
