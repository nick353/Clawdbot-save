#!/usr/bin/env python3
"""
rag-index.py - RAG検索システム（インデックス作成・検索）
"""

import sys
import json
import os
from pathlib import Path
import numpy as np

# sentence-transformersとFAISSのインポート
try:
    from sentence_transformers import SentenceTransformer
    import faiss
except ImportError as e:
    print(f"⚠️ 必要なパッケージがインストールされていません: {e}")
    print("以下を実行してください:")
    print("  source /root/venv/bin/activate && pip install sentence-transformers faiss-cpu numpy")
    sys.exit(1)

# 設定
KNOWLEDGE_DIR = Path("/root/clawd/knowledge")
INDEX_FILE = KNOWLEDGE_DIR / "embeddings.index"
METADATA_FILE = KNOWLEDGE_DIR / "metadata.json"
MODEL_NAME = "all-MiniLM-L6-v2"  # 軽量で高速なモデル

class RAGSystem:
    def __init__(self):
        self.model = None
        self.index = None
        self.metadata = []
        
    def load_model(self):
        """埋め込みモデルの読み込み"""
        if self.model is None:
            print(f"🔄 モデル読み込み中: {MODEL_NAME}")
            self.model = SentenceTransformer(MODEL_NAME)
            print("✅ モデル読み込み完了")
    
    def chunk_text(self, text: str, chunk_size: int = 500) -> list[str]:
        """テキストをチャンクに分割"""
        # 改行で分割して、空行を削除
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        chunks = []
        current_chunk = []
        current_size = 0
        
        for line in lines:
            line_size = len(line)
            if current_size + line_size > chunk_size and current_chunk:
                chunks.append('\n'.join(current_chunk))
                current_chunk = [line]
                current_size = line_size
            else:
                current_chunk.append(line)
                current_size += line_size
        
        if current_chunk:
            chunks.append('\n'.join(current_chunk))
        
        return chunks
    
    def create_index(self, file_paths: list[str]):
        """インデックス作成"""
        self.load_model()
        
        all_chunks = []
        metadata = []
        
        print(f"📄 ファイル処理中...")
        for file_path in file_paths:
            path = Path(file_path)
            if not path.exists():
                print(f"⚠️ ファイルが存在しません: {file_path}")
                continue
            
            print(f"  - {path.name}")
            
            # ファイル読み込み
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # チャンク分割
            chunks = self.chunk_text(content)
            
            for i, chunk in enumerate(chunks):
                all_chunks.append(chunk)
                metadata.append({
                    'file': str(path),
                    'chunk_id': i,
                    'text': chunk[:200]  # プレビュー用（最初の200文字）
                })
        
        print(f"✅ 総チャンク数: {len(all_chunks)}")
        
        # 埋め込みベクトル生成
        print("🔄 埋め込みベクトル生成中...")
        embeddings = self.model.encode(all_chunks, show_progress_bar=True)
        embeddings = np.array(embeddings).astype('float32')
        
        # FAISSインデックス作成
        print("🔄 FAISSインデックス作成中...")
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(embeddings)
        
        # 保存
        KNOWLEDGE_DIR.mkdir(exist_ok=True)
        faiss.write_index(index, str(INDEX_FILE))
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        print(f"✅ インデックス保存: {INDEX_FILE}")
        print(f"✅ メタデータ保存: {METADATA_FILE}")
    
    def search(self, query: str, top_k: int = 3):
        """検索"""
        self.load_model()
        
        # インデックス読み込み
        if not INDEX_FILE.exists():
            print("⚠️ インデックスファイルが存在しません")
            return
        
        self.index = faiss.read_index(str(INDEX_FILE))
        
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            self.metadata = json.load(f)
        
        # クエリの埋め込みベクトル生成
        query_embedding = self.model.encode([query])
        query_embedding = np.array(query_embedding).astype('float32')
        
        # 検索実行
        distances, indices = self.index.search(query_embedding, top_k)
        
        # 結果表示
        print(f"\n📊 検索結果 (Top {top_k}):\n")
        for i, (idx, distance) in enumerate(zip(indices[0], distances[0])):
            meta = self.metadata[idx]
            print(f"【結果 {i+1}】")
            print(f"  ファイル: {Path(meta['file']).name}")
            print(f"  距離: {distance:.4f}")
            print(f"  プレビュー: {meta['text']}")
            print()

def main():
    if len(sys.argv) < 2:
        print("使い方: python3 rag-index.py {index|search} [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    rag = RAGSystem()
    
    if command == "index":
        if len(sys.argv) < 3:
            print("使い方: python3 rag-index.py index <file1> <file2> ...")
            sys.exit(1)
        
        file_paths = sys.argv[2:]
        rag.create_index(file_paths)
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("使い方: python3 rag-index.py search <query> [top_k]")
            sys.exit(1)
        
        query = sys.argv[2]
        top_k = int(sys.argv[3]) if len(sys.argv) > 3 else 3
        rag.search(query, top_k)
    
    else:
        print(f"⚠️ 未知のコマンド: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
