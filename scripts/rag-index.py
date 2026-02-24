#!/usr/bin/env python3
"""
RAG Indexing System - ナレッジベースのベクトル化
"""
import os
import json
import sys
from pathlib import Path
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# 設定
KNOWLEDGE_DIR = Path("/root/clawd/knowledge")
INDEX_PATH = KNOWLEDGE_DIR / "embeddings.index"
METADATA_PATH = KNOWLEDGE_DIR / "metadata.json"
MODEL_NAME = "all-MiniLM-L6-v2"  # 軽量・高速モデル

def load_documents():
    """ナレッジベースから文書を読み込む"""
    documents = []
    
    # lessons.md
    lessons_path = Path("/root/clawd/tasks/lessons.md")
    if lessons_path.exists():
        content = lessons_path.read_text()
        # セクションごとに分割
        sections = content.split("## ")
        for section in sections[1:]:  # 最初の空セクションをスキップ
            if section.strip():
                documents.append({
                    "source": "lessons.md",
                    "category": "failure",
                    "content": section.strip()
                })
    
    # successes.md
    successes_path = Path("/root/clawd/tasks/successes.md")
    if successes_path.exists():
        content = successes_path.read_text()
        sections = content.split("## ")
        for section in sections[1:]:
            if section.strip():
                documents.append({
                    "source": "successes.md",
                    "category": "success",
                    "content": section.strip()
                })
    
    # SKILL.md files
    skills_dir = Path("/root/clawd/skills")
    if skills_dir.exists():
        for skill_md in skills_dir.rglob("SKILL.md"):
            content = skill_md.read_text()
            documents.append({
                "source": f"skills/{skill_md.parent.name}/SKILL.md",
                "category": "skill",
                "content": content
            })
    
    return documents

def create_index(documents):
    """ベクトルインデックスを作成"""
    print(f"📚 {len(documents)} 件の文書を読み込みました")
    
    # モデルロード
    print(f"🤖 モデルロード中: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    
    # エンベディング生成
    print("🔄 エンベディング生成中...")
    texts = [doc["content"] for doc in documents]
    embeddings = model.encode(texts, show_progress_bar=True)
    
    # FAISSインデックス作成
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings.astype('float32'))
    
    # 保存
    KNOWLEDGE_DIR.mkdir(exist_ok=True)
    faiss.write_index(index, str(INDEX_PATH))
    
    # メタデータ保存
    metadata = {
        "documents": documents,
        "model": MODEL_NAME,
        "dimension": dimension,
        "count": len(documents)
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    print(f"✅ インデックス作成完了: {len(documents)} 件")
    print(f"   - Index: {INDEX_PATH}")
    print(f"   - Metadata: {METADATA_PATH}")

def search(query, top_k=3):
    """類似文書を検索"""
    if not INDEX_PATH.exists() or not METADATA_PATH.exists():
        print("❌ インデックスが見つかりません。先に rag-index.py を実行してください。")
        sys.exit(1)
    
    # メタデータ読み込み
    with open(METADATA_PATH) as f:
        metadata = json.load(f)
    
    # モデルロード
    model = SentenceTransformer(metadata["model"])
    
    # クエリのエンベディング
    query_embedding = model.encode([query])
    
    # 検索
    index = faiss.read_index(str(INDEX_PATH))
    distances, indices = index.search(query_embedding.astype('float32'), top_k)
    
    # 結果整形
    results = []
    for i, idx in enumerate(indices[0]):
        doc = metadata["documents"][idx]
        results.append({
            "rank": i + 1,
            "distance": float(distances[0][i]),
            "source": doc["source"],
            "category": doc["category"],
            "content": doc["content"][:500] + "..." if len(doc["content"]) > 500 else doc["content"]
        })
    
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方:")
        print("  インデックス作成: python3 rag-index.py index")
        print("  検索: python3 rag-index.py search 'クエリ'")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "index":
        documents = load_documents()
        if not documents:
            print("⚠️ 文書が見つかりませんでした")
            sys.exit(0)
        create_index(documents)
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("❌ クエリを指定してください")
            sys.exit(1)
        query = sys.argv[2]
        results = search(query)
        
        print(f"\n🔍 検索結果: '{query}'")
        print("=" * 80)
        for r in results:
            print(f"\n【{r['rank']}】 {r['source']} (距離: {r['distance']:.4f})")
            print(f"カテゴリ: {r['category']}")
            print(f"内容:\n{r['content']}\n")
            print("-" * 80)
    
    else:
        print(f"❌ 不明なコマンド: {command}")
        sys.exit(1)
