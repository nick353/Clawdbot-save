#!/usr/bin/env python3
"""
RAGインデックス作成スクリプト
Clawdbot作業ログをLanceDBにベクトル化して保存
"""

import os
import sys
import argparse
import json
from pathlib import Path
from datetime import datetime
import hashlib

try:
    import lancedb
    from sentence_transformers import SentenceTransformer
except ImportError as e:
    print(f"❌ 必要なパッケージがインストールされていません: {e}", file=sys.stderr)
    print("実行: source /root/clawd/envs/rag/bin/activate && pip install lancedb sentence-transformers", file=sys.stderr)
    sys.exit(1)


class RAGIndexer:
    def __init__(self, db_path: str, collection_name: str):
        self.db_path = db_path
        self.collection_name = collection_name
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.db = lancedb.connect(db_path)
        
    def extract_tasks_from_file(self, filepath: Path) -> list:
        """ファイルからタスク情報を抽出"""
        tasks = []
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            # ファイルタイプに応じた抽出ロジック
            if filepath.suffix == '.md':
                tasks.extend(self._extract_from_markdown(content, filepath))
            elif filepath.suffix == '.sh':
                tasks.extend(self._extract_from_script(content, filepath))
            elif filepath.suffix in ['.js', '.py', '.ts']:
                tasks.extend(self._extract_from_code(content, filepath))
            elif filepath.name == 'lessons.md':
                tasks.extend(self._extract_from_lessons(content, filepath))
                
        except Exception as e:
            print(f"⚠️ {filepath} 読み込みエラー: {e}", file=sys.stderr)
            
        return tasks
    
    def _extract_from_markdown(self, content: str, filepath: Path) -> list:
        """Markdownファイルからタスクを抽出"""
        tasks = []
        lines = content.split('\n')
        
        current_section = ""
        current_content = []
        
        for line in lines:
            if line.startswith('##'):
                # 前のセクションを保存
                if current_section and current_content:
                    task_text = '\n'.join(current_content)
                    if len(task_text.strip()) > 50:  # 50文字以上のみ
                        tasks.append({
                            'text': task_text,
                            'title': current_section,
                            'source': str(filepath),
                            'type': 'markdown_section'
                        })
                
                # 新しいセクション開始
                current_section = line.strip('# ').strip()
                current_content = []
            else:
                current_content.append(line)
        
        # 最後のセクション
        if current_section and current_content:
            task_text = '\n'.join(current_content)
            if len(task_text.strip()) > 50:
                tasks.append({
                    'text': task_text,
                    'title': current_section,
                    'source': str(filepath),
                    'type': 'markdown_section'
                })
        
        return tasks
    
    def _extract_from_script(self, content: str, filepath: Path) -> list:
        """スクリプトファイルから実装パターンを抽出"""
        tasks = []
        
        # スクリプト全体を1つのタスクとして扱う
        if len(content.strip()) > 100:
            # コメントから説明を抽出
            description_lines = []
            for line in content.split('\n')[:20]:  # 最初の20行からコメント抽出
                if line.strip().startswith('#') and not line.strip().startswith('#!'):
                    description_lines.append(line.strip('# ').strip())
            
            description = ' '.join(description_lines) if description_lines else f"Script: {filepath.name}"
            
            tasks.append({
                'text': content[:2000],  # 最初の2000文字
                'title': description,
                'source': str(filepath),
                'type': 'script'
            })
        
        return tasks
    
    def _extract_from_code(self, content: str, filepath: Path) -> list:
        """コードファイルから実装パターンを抽出"""
        tasks = []
        
        # 関数・クラス定義を抽出（簡易版）
        if len(content.strip()) > 100:
            # ファイル全体を1タスクとして扱う
            tasks.append({
                'text': content[:2000],
                'title': f"Code: {filepath.name}",
                'source': str(filepath),
                'type': 'code'
            })
        
        return tasks
    
    def _extract_from_lessons(self, content: str, filepath: Path) -> list:
        """lessons.mdから失敗事例を抽出"""
        tasks = []
        lines = content.split('\n')
        
        current_lesson = {}
        for line in lines:
            if line.startswith('## '):
                # 前のレッスンを保存
                if current_lesson:
                    lesson_text = f"{current_lesson.get('title', '')}\n{current_lesson.get('symptom', '')}\n{current_lesson.get('cause', '')}\n{current_lesson.get('solution', '')}"
                    if len(lesson_text.strip()) > 50:
                        tasks.append({
                            'text': lesson_text,
                            'title': current_lesson.get('title', 'Unknown'),
                            'source': str(filepath),
                            'type': 'lesson'
                        })
                
                # 新しいレッスン開始
                current_lesson = {'title': line.strip('# ').strip()}
            elif line.startswith('**症状**:'):
                current_lesson['symptom'] = line.strip()
            elif line.startswith('**原因**:'):
                current_lesson['cause'] = line.strip()
            elif line.startswith('**解決策**:'):
                current_lesson['solution'] = line.strip()
        
        # 最後のレッスン
        if current_lesson:
            lesson_text = f"{current_lesson.get('title', '')}\n{current_lesson.get('symptom', '')}\n{current_lesson.get('cause', '')}\n{current_lesson.get('solution', '')}"
            if len(lesson_text.strip()) > 50:
                tasks.append({
                    'text': lesson_text,
                    'title': current_lesson.get('title', 'Unknown'),
                    'source': str(filepath),
                    'type': 'lesson'
                })
        
        return tasks
    
    def index_directory(self, source_dir: Path, force: bool = False):
        """ディレクトリを再帰的にスキャンしてインデックス作成"""
        print(f"📂 スキャン開始: {source_dir}")
        
        # 既存テーブルの処理
        if force and self.collection_name in self.db.table_names():
            print(f"🗑️ 既存コレクション削除: {self.collection_name}")
            self.db.drop_table(self.collection_name)
        
        all_tasks = []
        
        # 対象ファイル検索
        patterns = ['**/*.md', '**/*.sh', '**/*.js', '**/*.py', '**/*.ts']
        exclude_dirs = {'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'envs'}
        
        for pattern in patterns:
            for filepath in source_dir.glob(pattern):
                # 除外ディレクトリチェック
                if any(ex in filepath.parts for ex in exclude_dirs):
                    continue
                
                tasks = self.extract_tasks_from_file(filepath)
                all_tasks.extend(tasks)
        
        print(f"📊 抽出タスク数: {len(all_tasks)}")
        
        if not all_tasks:
            print("⚠️ タスクが見つかりませんでした")
            return
        
        # ベクトル化
        print("🔄 ベクトル化中...")
        for task in all_tasks:
            task['vector'] = self.model.encode(task['text']).tolist()
            task['id'] = hashlib.md5(task['text'].encode()).hexdigest()
            task['timestamp'] = datetime.now().isoformat()
        
        # LanceDBに保存
        print(f"💾 LanceDBに保存中...")
        if self.collection_name in self.db.table_names():
            table = self.db.open_table(self.collection_name)
            table.add(all_tasks)
        else:
            table = self.db.create_table(self.collection_name, all_tasks)
        
        print(f"✅ インデックス作成完了: {len(all_tasks)}件")


def main():
    parser = argparse.ArgumentParser(description='RAGインデックス作成')
    parser.add_argument('--source', required=True, help='ソースディレクトリ')
    parser.add_argument('--db', required=True, help='LanceDBディレクトリ')
    parser.add_argument('--collection', default='clawd_tasks', help='コレクション名')
    parser.add_argument('--force', action='store_true', help='強制再構築')
    
    args = parser.parse_args()
    
    source_path = Path(args.source)
    if not source_path.exists():
        print(f"❌ ソースディレクトリが存在しません: {args.source}", file=sys.stderr)
        sys.exit(1)
    
    indexer = RAGIndexer(args.db, args.collection)
    indexer.index_directory(source_path, force=args.force)


if __name__ == '__main__':
    main()
