# Googleスプレッドシート手動セットアップガイド

## 🎯 完成イメージ

### シート構成（4つのタブ）:

1. **Dashboard** - ダッシュボード（総合成績）
2. **Trades** - トレード記録（データは3行目から）
3. **Statistics** - 統計情報
4. **Charts** - グラフ

---

## 📝 手動セットアップ手順

### ステップ1: スプレッドシートを開く

https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo/edit

---

### ステップ2: シート（タブ）を追加

#### 2-1. 既存のシートを削除（Sheet1など）

1. シートタブを右クリック
2. 「削除」をクリック

#### 2-2. 新しいシートを4つ作成

左下の「+」ボタンをクリックして4つのシートを作成:

1. **Dashboard**
2. **Trades**
3. **Statistics**
4. **Charts**

（シート名を変更: シートタブを右クリック → 「名前を変更」）

---

### ステップ3: Dashboardシートの設定

#### A1セルから以下をコピペ:

```
🐥 Bitget自動トレーディング - ダッシュボード
```

**フォーマット:**
- 太字
- フォントサイズ: 16
- 背景色: 青（#4a86e8）
- 文字色: 白
- 中央揃え

#### A3セルから以下をコピペ:

```
📈 総合成績					📅 最近のトレード
総トレード数	=COUNTA(Trades!C3:C1000)				Symbol	Entry Time	PnL ($)	Win/Loss
勝率	=COUNTIF(Trades!I3:I1000,"Win")/COUNTA(Trades!I3:I1000)				=Trades!C3	=Trades!A3	=Trades!G3	=Trades!I3
総PnL ($)	=SUM(Trades!G3:G1000)				=Trades!C4	=Trades!A4	=Trades!G4	=Trades!I4
現在資金 ($)	=10000+SUM(Trades!G3:G1000)				=Trades!C5	=Trades!A5	=Trades!G5	=Trades!I5
							=Trades!C6	=Trades!A6	=Trades!G6	=Trades!I6
							=Trades!C7	=Trades!A7	=Trades!G7	=Trades!I7

💡 更新日時	=NOW()
```

**フォーマット:**
- A3, F3: 太字、背景色グレー
- 数値セル（B4〜B7）: 小数点2桁

---

### ステップ4: Tradesシートの設定

#### A1セルから以下をコピペ:

```
📊 Bitget自動トレーディング - トレード記録
```

**フォーマット:**
- 太字
- フォントサイズ: 14
- 背景色: 青（#4a86e8）
- 文字色: 白
- 中央揃え
- A1〜P1を結合

#### A2セルから以下をコピペ（ヘッダー行）:

```
Entry Time	Exit Time	Symbol	Entry Price	Exit Price	Quantity	PnL ($)	PnL (%)	Win/Loss	Entry Reason	Exit Reason	Hold Time (min)	Trailing Stop Used	Highest Price	Capital After	Notes
```

**フォーマット:**
- 太字
- 背景色: グレー（#d9d9d9）
- テキスト: 左揃え

#### 1〜2行目を固定:

1. 2行目を選択
2. 「表示」→「固定」→「2行まで」

#### Win/Loss列（I列）の条件付き書式:

1. I3〜I1000を選択
2. 「表示形式」→「条件付き書式」

**ルール1（Win = 緑）:**
- 条件: 「次と完全に一致する」→「Win」
- 背景色: 緑（#d9ead3）

**ルール2（Loss = 赤）:**
- 条件: 「次と完全に一致する」→「Loss」
- 背景色: 赤（#f4cccc）

---

### ステップ5: Statisticsシートの設定

#### A1セルから以下をコピペ:

```
📊 統計

📌 銘柄別成績
Symbol	トレード数	勝率 (%)	総PnL ($)	平均PnL ($)

（データは自動更新されます）


📌 エグジット理由別
Exit Reason	回数	総PnL ($)



📌 日別PnL
Date	総PnL ($)
```

**フォーマット:**
- A3, A9, A14: 太字、背景色グレー

---

### ステップ6: Chartsシートの設定

#### A1セルから以下をコピペ:

```
📈 グラフ

（グラフは手動で追加してください）

推奨グラフ:
1. 資金推移グラフ（Trades!O:O）
2. 勝率推移グラフ
3. 銘柄別PnL比較
```

---

## ✅ 完了チェックリスト

- [ ] 4つのシート（Dashboard, Trades, Statistics, Charts）が作成されている
- [ ] Dashboardに総合成績が表示される
- [ ] Tradesシートの1〜2行目が固定されている
- [ ] Tradesシートの3行目からデータを追加できる
- [ ] Win/Loss列が条件付き書式で色分けされている

---

## 🔄 データ追加方法

### 自動追加（推奨）:

```bash
python3 /root/clawd/scripts/sync-to-gsheet.py
```

CSVデータを自動的にTradesシートの3行目以降に追加します。

### 手動追加:

Tradesシートの3行目（A3セル）から下に向かってデータを入力。

**例:**
```
2026-02-11 13:30:00	2026-02-11 21:25:00	JASMYUSDT	0.005449	0.005994	1835.38	100.00	10.00	Win	全条件クリア	Take Profit	475	Yes	0.006000	10100.00	Screenshot: /root/clawd/data/screenshots/20260211_133000_JASMYUSDT.png
```

---

## 📊 Dashboardの使い方

### 自動更新される項目:

- **総トレード数**: Tradesシートのデータ数を自動カウント
- **勝率**: Win/Lossから自動計算
- **総PnL**: PnL列の合計
- **現在資金**: 初期資金 + 総PnL
- **最近のトレード**: Tradesシートの最新5件を自動表示

### 更新日時:

A11セルの `=NOW()` が自動で更新されます。

---

## 💡 次のステップ

1. **自動トレーダー起動**
   ```bash
   python3 /root/clawd/scripts/bitget-auto-trader.py
   ```

2. **トレード発生時**
   - CSVに自動記録
   - Googleスプレッドシートに同期

3. **Dashboardで確認**
   - リアルタイムで成績確認

---

## 📞 サポート

質問があれば、Discord #bitget-tradingで聞いてくださいっぴ！🐥
