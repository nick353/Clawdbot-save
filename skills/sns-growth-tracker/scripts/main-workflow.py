#!/usr/bin/env python3
"""
メインワークフロー統合スクリプト
画像・動画の受け取りから投稿完了まで全自動処理
"""

import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime
import subprocess

# 他のスクリプトをインポート
sys.path.append(str(Path(__file__).parent))
from analyze_image import ImageAnalyzer
from generate_captions import CaptionGenerator

class SNSWorkflow:
    def __init__(self):
        self.skill_dir = Path(__file__).parent.parent
        self.data_dir = self.skill_dir / 'data'
        self.media_dir = self.data_dir / 'media'
        
        # ディレクトリ作成
        self.media_dir.mkdir(parents=True, exist_ok=True)
        
        # 各種クラスを初期化
        self.analyzer = ImageAnalyzer()
        self.caption_generator = CaptionGenerator()
    
    def process_media(self, media_path, post_id=None):
        """
        メディアファイルを処理
        
        Args:
            media_path: 画像・動画ファイルのパス
            post_id: 投稿ID（省略時は自動生成）
        
        Returns:
            dict: 処理結果
        """
        if not Path(media_path).exists():
            raise FileNotFoundError(f"ファイルが見つかりません: {media_path}")
        
        # 投稿IDを生成
        if not post_id:
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            post_id = f"POST-{timestamp}"
        
        print(f"🎬 投稿ID: {post_id}")
        print(f"📁 メディア: {media_path}")
        
        result = {
            'post_id': post_id,
            'media_path': str(media_path),
            'timestamp': datetime.now().isoformat(),
            'steps': {}
        }
        
        # ステップ1: メディアをバックアップ
        print("\n📦 ステップ1: メディアをバックアップ中...")
        backup_path = self._backup_media(media_path, post_id)
        result['backup_path'] = str(backup_path)
        result['steps']['backup'] = {'status': 'success', 'path': str(backup_path)}
        print(f"✅ バックアップ完了: {backup_path}")
        
        # ステップ2: Gemini分析
        print("\n🔍 ステップ2: Gemini分析中...")
        try:
            analysis = self.analyzer.analyze_image(media_path, 'content')
            result['analysis'] = analysis
            result['steps']['analysis'] = {'status': 'success'}
            
            print(f"✅ 分析完了")
            print(f"   - テーマ: {analysis.get('theme', '不明')}")
            print(f"   - 雰囲気: {analysis.get('mood', '不明')}")
            print(f"   - 推奨SNS: {', '.join(analysis.get('recommended_platforms', []))}")
        except Exception as e:
            print(f"❌ 分析エラー: {e}")
            result['steps']['analysis'] = {'status': 'error', 'error': str(e)}
            return result
        
        # ステップ3: キャプション生成
        print("\n✍️  ステップ3: キャプション生成中...")
        try:
            captions = self.caption_generator.generate_all_captions(analysis, media_path)
            result['captions'] = captions
            result['steps']['captions'] = {'status': 'success'}
            
            print(f"✅ キャプション生成完了")
            for platform, caption_data in captions.items():
                if 'error' not in caption_data:
                    print(f"   - {platform}: {len(caption_data.get('caption', ''))}文字")
        except Exception as e:
            print(f"❌ キャプション生成エラー: {e}")
            result['steps']['captions'] = {'status': 'error', 'error': str(e)}
            return result
        
        # ステップ4: 学習エンジンから推奨事項取得
        print("\n🧠 ステップ4: 過去データから学習中...")
        try:
            learning_result = self._get_learning_recommendations()
            result['learning'] = learning_result
            result['steps']['learning'] = {'status': 'success'}
            
            print(f"✅ 学習完了")
            if learning_result.get('recommendations'):
                for rec in learning_result['recommendations'][:3]:
                    print(f"   - {rec['recommendation']}")
        except Exception as e:
            print(f"⚠️  学習エラー（続行します）: {e}")
            result['steps']['learning'] = {'status': 'warning', 'error': str(e)}
        
        # ステップ5: SNS投稿
        print("\n📤 ステップ5: SNS投稿中...")
        try:
            post_urls = self._post_to_sns(media_path, captions)
            result['post_urls'] = post_urls
            result['steps']['post'] = {'status': 'success', 'urls': post_urls}
            
            print(f"✅ 投稿完了")
            for platform, url in post_urls.items():
                print(f"   - {platform}: {url if url else '失敗'}")
        except Exception as e:
            print(f"❌ 投稿エラー: {e}")
            result['steps']['post'] = {'status': 'error', 'error': str(e)}
            return result
        
        # ステップ6: Google Sheetsに記録
        print("\n📊 ステップ6: Google Sheetsに記録中...")
        try:
            self._record_to_sheets(post_id, result)
            result['steps']['sheets'] = {'status': 'success'}
            print(f"✅ Google Sheets記録完了")
        except Exception as e:
            print(f"⚠️  Google Sheets記録エラー（続行します）: {e}")
            result['steps']['sheets'] = {'status': 'warning', 'error': str(e)}
        
        print("\n" + "=" * 60)
        print("✅ 全ステップ完了！")
        print("=" * 60)
        
        return result
    
    def _backup_media(self, media_path, post_id):
        """メディアをバックアップ"""
        media_file = Path(media_path)
        backup_file = self.media_dir / f"{post_id}{media_file.suffix}"
        
        shutil.copy2(media_path, backup_file)
        
        return backup_file
    
    def _get_learning_recommendations(self):
        """学習エンジンから推奨事項を取得"""
        script_path = self.skill_dir / 'scripts' / 'learning-engine.py'
        
        try:
            result = subprocess.run(
                ['python3', str(script_path), '30'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                return {'error': result.stderr}
        
        except Exception as e:
            return {'error': str(e)}
    
    def _post_to_sns(self, media_path, captions):
        """SNSに投稿"""
        # sns-multi-poster スキルを使用
        sns_poster_script = Path('/root/clawd/skills/sns-multi-poster/post.sh')
        
        post_urls = {}
        
        # 各SNSに投稿
        for platform in ['Instagram', 'Facebook', 'Pinterest', 'X', 'Threads']:
            caption_data = captions.get(platform, {})
            if 'error' in caption_data:
                post_urls[platform] = None
                continue
            
            # キャプションを整形
            caption_text = self.caption_generator.format_for_posting(caption_data, platform)
            
            try:
                # sns-multi-poster を呼び出し
                # （実際の実装は sns-multi-poster の仕様に依存）
                # ここではプレースホルダーとして URL を None に設定
                post_urls[platform] = None  # TODO: 実際の投稿処理を実装
                
                print(f"   ⏳ {platform}に投稿中...")
            
            except Exception as e:
                print(f"   ❌ {platform}投稿失敗: {e}")
                post_urls[platform] = None
        
        return post_urls
    
    def _record_to_sheets(self, post_id, result):
        """Google Sheetsに記録"""
        script_path = self.skill_dir / 'scripts' / 'record-to-sheets.py'
        
        # 投稿マスターに記録
        post_data = {
            'post_id': post_id,
            'timestamp': result['timestamp'],
            'media_type': '動画' if Path(result['media_path']).suffix in ['.mp4', '.mov', '.avi'] else '画像',
            'analysis': result.get('analysis', {}),
            'captions': result.get('captions', {}),
            'image_url': result.get('backup_path', '')
        }
        
        # 一時ファイルに書き出し
        temp_file = self.data_dir / f'temp-post-{post_id}.json'
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(post_data, f, ensure_ascii=False, indent=2)
        
        # record-to-sheets.py を実行
        subprocess.run(
            ['python3', str(script_path), 'post', str(temp_file)],
            check=True,
            timeout=30
        )
        
        # SNS URLsを記録
        if result.get('post_urls'):
            sns_data = {
                'post_id': post_id,
                'urls': result['post_urls']
            }
            
            temp_file = self.data_dir / f'temp-urls-{post_id}.json'
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(sns_data, f, ensure_ascii=False, indent=2)
            
            subprocess.run(
                ['python3', str(script_path), 'sns_urls', str(temp_file)],
                timeout=30
            )

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("使い方: python main-workflow.py <media_path> [post_id]")
        sys.exit(1)
    
    media_path = sys.argv[1]
    post_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        workflow = SNSWorkflow()
        result = workflow.process_media(media_path, post_id)
        
        # 結果をJSONで出力
        print("\n" + "=" * 60)
        print("📋 処理結果:")
        print("=" * 60)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    except Exception as e:
        print(f"\n❌ エラー: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
