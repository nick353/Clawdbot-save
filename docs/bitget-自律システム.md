# Bitget自動トレーダー自律システム

## 概要

Bitget自動トレーダーが**自己診断・自動修正**を行うシステムです。

### 目的
- 問題を自動検出
- 修正案を自動生成
- Discord報告＋承認フロー
- 自動修正＋再起動

---

## システム構成

### 1. 自己診断スクリプト
**ファイル:** `/root/clawd/scripts/bitget-self-diagnosis.py`

**実行タイミング:** 1時間ごと（cron）

**診断項目:**
- ログ分析
  - エラーパターン検出
  - クラッシュ検出
  - タイムアウト検出
- コード分析
  - 例外処理の網羅性
  - 永続化の有無
  - タイムアウト設定
- 設定分析
  - 監視銘柄の妥当性

**出力:**
- `/root/clawd/data/diagnosis-report.json`
- Discord通知（問題検出時のみ）

---

### 2. 自動修正スクリプト
**ファイル:** `/root/clawd/scripts/bitget-auto-fix.py`

**実行方法:**
```bash
# 自動適用可能な修正のみ
python3 /root/clawd/scripts/bitget-auto-fix.py auto

# 全ての修正を適用（承認済み）
python3 /root/clawd/scripts/bitget-auto-fix.py all
```

**機能:**
- コードバックアップ
- 修正適用
- 修正履歴保存
- Discord報告
- トレーダー再起動

---

## 使用方法

### 通常フロー

#### 1. 自動診断（1時間ごと）
cronが自動実行 → 問題検出 → Discord報告

#### 2. Discord通知を確認
```
🔍 **自己診断レポート**

**検出した問題: 3件**
- 🔴 高: 2件
- 🟡 中: 1件

1. 🔴 **予期しない再起動を検出**
   詳細: 再起動回数: 5

2. 🟡 **タイムアウトが頻発しています**
   詳細: ...

**修正案: 2件**

1. ✅ 自動適用可: 詳細クラッシュログ追加
2. ⏳ 承認必要: タイムアウト延長

**承認方法:**
「承認」→ 全修正を適用
「却下」→ 保留
```

#### 3. 承認
Discordで「承認」と返信 → リッキーが自動修正実行

#### 4. 修正完了報告
```
✅ **自動修正完了**

**適用した修正: 2件**
1. ✅ 詳細クラッシュログ追加: トレースバック出力を強化
2. ✅ タイムアウト延長: subprocess タイムアウトを30秒に延長

**再起動完了: PID 123456**
```

---

## 修正レベル

### レベル1: 即座に自動修正（承認不要）
- ログローテーション
- プロセス再起動（クラッシュ時）
- 一時ファイルのクリーンアップ

### レベル2: 提案＋承認後実施
- コード修正
- 設定変更
- パラメータ調整

### レベル3: 報告のみ（手動対応）
- アーキテクチャ変更が必要
- 外部サービス連携変更

---

## ファイル一覧

### スクリプト
- `/root/clawd/scripts/bitget-self-diagnosis.py` - 自己診断
- `/root/clawd/scripts/bitget-auto-fix.py` - 自動修正

### データ
- `/root/clawd/data/diagnosis-report.json` - 診断レポート
- `/root/clawd/data/fix-history.json` - 修正履歴
- `/root/clawd/data/backups/` - コードバックアップ
- `/root/clawd/data/self-diagnosis.log` - 診断ログ

---

## トラブルシューティング

### 診断が実行されない
```bash
# cron確認
crontab -l | grep diagnosis

# 手動実行
python3 /root/clawd/scripts/bitget-self-diagnosis.py

# ログ確認
tail -f /root/clawd/data/self-diagnosis.log
```

### 修正が適用されない
```bash
# 診断レポート確認
cat /root/clawd/data/diagnosis-report.json | python3 -m json.tool

# 手動修正実行（自動適用可能なもののみ）
python3 /root/clawd/scripts/bitget-auto-fix.py auto

# 手動修正実行（全て）
python3 /root/clawd/scripts/bitget-auto-fix.py all
```

### バックアップから復元
```bash
# バックアップ一覧
ls -lh /root/clawd/data/backups/

# 復元
cp /root/clawd/data/backups/bitget-trader-v2_YYYYMMDD_HHMMSS.py \
   /root/clawd/scripts/bitget-trader-v2.py

# 再起動
pkill -f bitget-trader-v2.py
cd /root/clawd && nohup python3 -u scripts/bitget-trader-v2.py >> /root/clawd/data/trader-v2.log 2>&1 &
```

---

## 今後の拡張

### Phase 2: 全システムへの展開
- 毎朝リサーチの自己診断
- バックアップスクリプトの自己診断
- スクリーニングの自己診断

### Phase 3: 予測的な問題検出
- パフォーマンス劣化の早期検出
- API変更の事前検知
- リスク設定の最適化提案

---

**作成日:** 2026-02-13  
**バージョン:** 1.0  
**担当:** リッキー 🐥
