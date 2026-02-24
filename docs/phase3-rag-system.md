# Phase 3: RAGシステム統合（学習強化）

## 概要

Phase 3では、失敗だけでなく成功パターンも学習し、過去の実装例を参照できるRAG（Retrieval-Augmented Generation）システムを実装しました。

## 主な機能

### 1. 成功パターン記録（successes.md）

成功した実装・調査・修正のパターンを記録します。

**記録方法:**
```bash
bash /root/clawd/scripts/success-pattern-extractor.sh record \
  "タスク名" \
  "実装内容" \
  "アプローチ" \
  "成功要因" \
  "関連スキル"
```

**フォーマット:**
```markdown
## YYYY-MM-DD - <タスク名>

**実装内容**: <何を実装したか>
**アプローチ**: <どのように実装したか>
**成功要因**: <なぜ成功したか>
**再利用可能なパターン**: <今後使えるテクニック>
**関連スキル**: <使用したskill/ツール>
```

### 2. RAG検索システム（rag-search.sh）

過去の実装例・成功パターン・失敗事例をセマンティック検索で参照できます。

**初回セットアップ:**
```bash
# インデックス作成
bash /root/clawd/scripts/rag-search.sh index
```

**検索:**
```bash
# 類似タスク検索
bash /root/clawd/scripts/rag-search.sh search "Discord BOT実装"
```

**検索対象:**
- `lessons.md` - 失敗パターン
- `successes.md` - 成功パターン
- `skills/*/SKILL.md` - スキル定義

**技術スタック:**
- **Embedding**: sentence-transformers（all-MiniLM-L6-v2）
- **Vector DB**: FAISS（軽量・高速）
- **メタデータ**: JSON

### 3. プロンプト最適化（prompt-optimizer.sh）

タスクカテゴリ別に最適なプロンプトテンプレートを管理し、成功率をトラッキングします。

**初期化:**
```bash
bash /root/clawd/scripts/prompt-optimizer.sh init
```

**テンプレート取得:**
```bash
bash /root/clawd/scripts/prompt-optimizer.sh get research "Brave検索の代替"
```

**成功率トラッキング:**
```bash
# タスク完了後
bash /root/clawd/scripts/prompt-optimizer.sh update research success
```

**ベストテンプレート選択:**
```bash
bash /root/clawd/scripts/prompt-optimizer.sh best
```

**テンプレートカテゴリ:**
- `research` - 調査タスク
- `implementation` - 実装タスク
- `verification` - 検証タスク

## ワークフロー統合

### タスク開始時（推奨フロー）

1. **過去の事例を検索**
   ```bash
   bash rag-search.sh search "<タスク名>"
   ```

2. **最適なプロンプトテンプレート取得**
   ```bash
   bash prompt-optimizer.sh get <category> "<タスク概要>"
   ```

3. **実装実行**（通常通り）

4. **成功パターン記録**
   ```bash
   bash success-pattern-extractor.sh record "<タスク名>" "..." "..." "..." "..."
   ```

5. **プロンプト統計更新**
   ```bash
   bash prompt-optimizer.sh update <category> success
   ```

6. **RAGインデックス更新**（成功パターン追加後）
   ```bash
   bash rag-search.sh index
   ```

## ファイル構成

| ファイル | 用途 |
|---------|------|
| `/root/clawd/tasks/successes.md` | 成功パターン記録 |
| `/root/clawd/knowledge/embeddings.index` | FAISSインデックス |
| `/root/clawd/knowledge/metadata.json` | メタデータ |
| `/root/clawd/config/prompt-templates/*.txt` | プロンプトテンプレート |
| `/root/clawd/config/prompt-stats.json` | 成功率統計 |
| `/root/clawd/scripts/rag-search.sh` | RAG検索スクリプト |
| `/root/clawd/scripts/rag-index.py` | RAGインデックス作成 |
| `/root/clawd/scripts/success-pattern-extractor.sh` | 成功パターン記録 |
| `/root/clawd/scripts/prompt-optimizer.sh` | プロンプト最適化 |

## 期待効果

- **成功率向上**: 過去の成功パターン参照で初回成功率+30%
- **実装時間短縮**: 類似タスクの実装例参照で-40%
- **品質向上**: ベストプラクティスの自動適用

## トラブルシューティング

### インデックス作成エラー

**症状**: `ModuleNotFoundError: No module named 'sentence_transformers'`

**解決策**:
```bash
# 仮想環境にインストール
cd /root/venv
bin/pip install sentence-transformers faiss-cpu
```

### 検索結果が空

**原因**: インデックスが未作成

**解決策**:
```bash
bash /root/clawd/scripts/rag-search.sh index
```

### ディスク容量不足

**症状**: インストール失敗（torch、transformers等の大容量パッケージ）

**解決策**:
```bash
# ディスク容量確認
df -h /root

# 不要ファイル削除
bash /root/clawd/scripts/cleanup-disk.sh
```

## 実装履歴

- **2026-02-24**: Phase 3実装開始
  - RAG検索システム構築
  - 成功パターン記録システム追加
  - プロンプト最適化システム実装

## 参考

- **Boris Chernyワークフロー**: https://paddo.dev/blog/how-boris-uses-claude-code/
- **sentence-transformers**: https://www.sbert.net/
- **FAISS**: https://github.com/facebookresearch/faiss
