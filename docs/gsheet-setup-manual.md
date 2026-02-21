# Googleスプレッドシート手動セットアップ

## 🚀 クイックセットアップ（手動）

### 方法1: CSVインポート（最速）

1. **スプレッドシートを開く**
   - https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo/edit

2. **CSVをインポート**
   - 「ファイル」→「インポート」
   - 「アップロード」タブ
   - `/root/clawd/data/gsheet-template.csv` をアップロード
   - インポート場所：「新しいシートに挿入」または「データを置き換える」
   - 区切り文字：カンマ
   - 「データをインポート」をクリック

3. **条件付き書式設定**
   - I列（Win/Loss）を選択
   - 「表示形式」→「条件付き書式」
   
   **ルール1（Win = 緑）:**
   - 範囲：I2:I1000
   - 条件：「次と完全に一致する」→「Win」
   - 書式：背景色を緑（#d9ead3）に設定
   
   **ルール2（Loss = 赤）:**
   - 範囲：I2:I1000
   - 条件：「次と完全に一致する」→「Loss」
   - 書式：背景色を赤（#f4cccc）に設定

4. **ヘッダー行の書式設定**
   - 1行目を選択
   - 太字（Ctrl+B）
   - 背景色を青（#4a86e8）
   - 文字色を白（#ffffff）

5. **列幅調整**
   - 列名をダブルクリックして自動調整

---

### 方法2: 手動入力

#### 1. ヘッダー行（A1セルから）

```
Entry Time | Exit Time | Symbol | Entry Price | Exit Price | Quantity | PnL ($) | PnL (%) | Win/Loss | Entry Reason | Exit Reason | Hold Time (min) | Trailing Stop Used | Highest Price | Capital After | Notes
```

#### 2. サンプルデータ（A2セルから）

**行1:**
```
2026-02-11 13:30:00 | 2026-02-11 21:25:00 | JASMYUSDT | 0.005449 | 0.005994 | 1835.38 | 100.00 | 10.00 | Win | 全条件クリア | Take Profit | 475 | Yes | 0.006000 | 10100.00 | Screenshot: /root/clawd/data/screenshots/20260211_133000_JASMYUSDT.png
```

**行2:**
```
2026-02-11 14:10:00 | 2026-02-11 23:00:00 | XVGUSDT | 0.005827 | 0.005987 | 1717.20 | 27.43 | 2.74 | Win | 全条件クリア | Trailing Stop | 530 | Yes | 0.006120 | 10127.43 | Screenshot: /root/clawd/data/screenshots/20260211_141000_XVGUSDT.png
```

**行3:**
```
2026-02-11 14:55:00 | 2026-02-11 20:20:00 | OGUSDT | 4.920000 | 4.674000 | 203.25 | -50.00 | -5.00 | Loss | 全条件クリア | Stop Loss | 325 | No | 4.920000 | 10077.43 | Screenshot: /root/clawd/data/screenshots/20260211_145500_OGUSDT.png
```

#### 3. 書式設定

**ヘッダー行（1行目）:**
- 太字
- 背景色：青（#4a86e8）
- 文字色：白（#ffffff）

**Win/Loss列（I列）:**
- 条件付き書式で色分け（上記参照）

**数値列:**
- G列（PnL ($)）：通貨形式（$）
- H列（PnL (%)）：パーセント形式

---

## 🔄 自動同期設定（オプション）

### Google Sheets API認証（高度）

1. **Google Cloud Console**
   - https://console.cloud.google.com/

2. **プロジェクト作成**
   - 「プロジェクトを選択」→「新しいプロジェクト」
   - プロジェクト名：「Bitget Trading Bot」

3. **Google Sheets API有効化**
   - 「APIとサービス」→「ライブラリ」
   - 「Google Sheets API」を検索
   - 「有効にする」をクリック

4. **サービスアカウント作成**
   - 「APIとサービス」→「認証情報」
   - 「認証情報を作成」→「サービスアカウント」
   - サービスアカウント名：「bitget-trader」
   - 作成

5. **JSONキー作成**
   - サービスアカウントをクリック
   - 「キー」タブ→「キーを追加」→「新しいキーを作成」
   - 形式：JSON
   - ダウンロード

6. **認証情報を配置**
   ```bash
   mkdir -p ~/.clawdbot
   cp ~/Downloads/bitget-trader-xxxxx.json ~/.clawdbot/google-credentials.json
   ```

7. **スプレッドシートに共有**
   - サービスアカウントのメールアドレスをコピー
     - 例: `bitget-trader@project-id.iam.gserviceaccount.com`
   - スプレッドシートを開く
   - 「共有」ボタン
   - メールアドレスを貼り付け
   - 権限：「編集者」
   - 「送信」

8. **自動同期スクリプト実行**
   ```bash
   python3 /root/clawd/scripts/setup-gsheet.py
   ```

---

## ✅ 完了チェックリスト

- [ ] スプレッドシートにヘッダー行が表示されている
- [ ] サンプルデータが3件表示されている
- [ ] Win行が緑背景、Loss行が赤背景になっている
- [ ] ヘッダー行が太字＋青背景になっている
- [ ] 列幅が適切に調整されている

---

## 💡 次のステップ

1. **手動同期テスト**
   ```bash
   python3 /root/clawd/scripts/sync-to-gsheet.py
   ```

2. **自動トレーダー起動**
   ```bash
   python3 /root/clawd/scripts/bitget-auto-trader.py
   ```

3. **トレード発生時**
   - CSVに自動記録
   - Googleスプレッドシートに同期（認証設定済みの場合）

---

## 📞 サポート

質問があれば、Discord #bitget-tradingで聞いてくださいっぴ！🐥
