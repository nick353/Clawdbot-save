# RAGシステム（Retrieval-Augmented Generation）

## 概要
過去のタスク実装例をベクトル検索して、新しいタスクの参考にするシステム

## アーキテクチャ

```
┌─────────────────┐
│ Clawdbot作業ログ │
│ (.md/.sh/.py等) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RAGインデクサー   │
│ (rag-indexer.py) │
│ - ファイルスキャン│
│ - テキスト抽出   │
│ - ベクトル化     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LanceDB        │
│ ベクトルストレージ │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RAG検索エンジン  │
│ (rag-searcher.py)│
│ - クエリベクトル化│
│ - 類似度検索     │
│ - 結果表示       │
└─────────────────┘
```

## 使い方

### 1️⃣ 初回インデックス作成
```bash
# デフォルト設定（/root/clawdをスキャン）
bash /root/clawd/scripts/rag-index.sh

# カスタムディレクトリを指定
bash /root/clawd/scripts/rag-index.sh --source /path/to/logs

# 既存インデックスを削除して再作成
bash /root/clawd/scripts/rag-index.sh --force
```

### 2️⃣ タスク検索
```bash
# 基本検索
bash /root/clawd/scripts/rag-search.sh "Discord BOT実装"

# 結果件数指定
bash /root/clawd/scripts/rag-search.sh "Instagram投稿" --limit 3

# カスタムコレクション
bash /root/clawd/scripts/rag-search.sh "エラーハンドリング" --collection custom_tasks
```

## インデックス対象ファイル

| ファイルタイプ | 抽出内容 |
|--------------|---------|
| `*.md` | セクションごとのテキスト |
| `*.sh` | スクリプト全体＋コメント |
| `*.py`, `*.js`, `*.ts` | コード全体 |
| `lessons.md` | 失敗事例（症状・原因・解決策） |

## ベクトルモデル

**使用モデル**: `sentence-transformers/all-MiniLM-L6-v2`
- サイズ: 約80MB
- 速度: 高速
- 精度: 汎用タスクに十分

## データベース

**LanceDB**
- 保存先: `/root/clawd/.lancedb`
- コレクション名: `clawd_tasks`（デフォルト）
- ストレージ: 約500KB/100タスク

## 仮想環境

```bash
# 仮想環境の場所
/root/clawd/envs/rag

# アクティベート
source /root/clawd/envs/rag/bin/activate

# パッケージ確認
pip list | grep -E "lancedb|sentence"
```

## HEARTBEAT統合

HEARTBEAT.mdに追加予定:
```bash
# RAGインデックス自動更新（日次）
TODAY=$(date +%Y-%m-%d)
LAST_RAG_INDEX=$(cat /root/clawd/.last_rag_index 2>/dev/null || echo "1970-01-01")
if [ "$TODAY" != "$LAST_RAG_INDEX" ]; then
    source /root/clawd/envs/rag/bin/activate
    bash /root/clawd/scripts/rag-index.sh
    echo "$TODAY" > /root/clawd/.last_rag_index
fi
```

## トラブルシューティング

### 問題: "No module named 'lancedb'"
```bash
# 仮想環境を有効化してからスクリプト実行
source /root/clawd/envs/rag/bin/activate
python3 /root/clawd/scripts/rag-indexer.py --source /root/clawd --db /root/clawd/.lancedb
```

### 問題: "コレクションが存在しません"
```bash
# インデックスを作成
bash /root/clawd/scripts/rag-index.sh
```

### 問題: 検索結果がない
```bash
# インデックスを再構築
bash /root/clawd/scripts/rag-index.sh --force
```

## 期待効果

| 指標 | 改善率 |
|------|-------|
| 成功率向上 | +30% |
| 実装時間短縮 | -40% |
| 品質向上 | +25% |

## 今後の拡張

- [ ] クエリ拡張（類義語展開）
- [ ] リランキング（関連度スコア調整）
- [ ] GitHub Issues/PRの検索対応
- [ ] Discord過去ログの検索対応
