#!/usr/bin/env python3
"""
RAG検索スクリプト
過去のタスク実装例をベクトル検索
"""

import sys
import argparse
from pathlib import Path

try:
    import lancedb
    from sentence_transformers import SentenceTransformer
except ImportError as e:
    print(f"❌ 必要なパッケージがインストールされていません: {e}", file=sys.stderr)
    print("実行: source /root/clawd/envs/rag/bin/activate && pip install lancedb sentence-transformers", file=sys.stderr)
    sys.exit(1)


class RAGSearcher:
    def __init__(self, db_path: str, collection_name: str):
        self.db_path = db_path
        self.collection_name = collection_name
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.db = lancedb.connect(db_path)
        
        # テーブル存在確認
        if collection_name not in self.db.table_names():
            print(f"❌ コレクション '{collection_name}' が存在しません", file=sys.stderr)
            print(f"💡 インデックス作成: bash /root/clawd/scripts/rag-index.sh", file=sys.stderr)
            sys.exit(1)
        
        self.table = self.db.open_table(collection_name)
    
    def search(self, query: str, limit: int = 5):
        """クエリに基づいて類似タスクを検索"""
        print(f"🔍 検索クエリ: {query}")
        print(f"📊 検索件数: 最大{limit}件\n")
        
        # クエリをベクトル化
        query_vector = self.model.encode(query).tolist()
        
        # ベクトル検索
        results = self.table.search(query_vector).limit(limit).to_list()
        
        if not results:
            print("⚠️ 検索結果がありませんでした")
            return
        
        # 結果表示
        print(f"✅ {len(results)}件の類似タスクが見つかりました\n")
        print("=" * 80)
        
        for i, result in enumerate(results, 1):
            distance = result.get('_distance', 0)
            similarity = 1 - distance  # 距離を類似度に変換
            
            print(f"\n【結果 {i}】類似度: {similarity:.2%}")
            print(f"📝 タイトル: {result.get('title', 'N/A')}")
            print(f"📂 ソース: {result.get('source', 'N/A')}")
            print(f"🏷️ タイプ: {result.get('type', 'N/A')}")
            print(f"\n内容:")
            print("-" * 80)
            # テキストの最初の500文字を表示
            text = result.get('text', '')
            preview = text[:500] + ('...' if len(text) > 500 else '')
            print(preview)
            print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description='RAG検索')
    parser.add_argument('--query', required=True, help='検索クエリ')
    parser.add_argument('--db', required=True, help='LanceDBディレクトリ')
    parser.add_argument('--collection', default='clawd_tasks', help='コレクション名')
    parser.add_argument('--limit', type=int, default=5, help='結果の最大件数')
    
    args = parser.parse_args()
    
    searcher = RAGSearcher(args.db, args.collection)
    searcher.search(args.query, args.limit)


if __name__ == '__main__':
    main()
