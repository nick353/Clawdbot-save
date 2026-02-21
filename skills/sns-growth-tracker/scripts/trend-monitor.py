#!/usr/bin/env python3
"""
トレンド監視スクリプト
各SNSのトレンド投稿を監視し、Gemini APIで分析
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

try:
    import google.generativeai as genai
except ImportError:
    print("❌ google-generativeai がインストールされていません")
    sys.exit(1)

class TrendMonitor:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY が設定されていません")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-flash-latest')
        
        # config.json を読み込み
        config_path = Path(__file__).parent.parent / 'config.json'
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        self.data_dir = Path(self.config['paths']['trends_dir'])
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def monitor_all_platforms(self):
        """
        全プラットフォームのトレンドを監視
        
        Returns:
            dict: 各プラットフォームのトレンド分析結果
        """
        results = {}
        platforms = self.config['sns']['platforms']
        
        for platform in platforms:
            try:
                print(f"🔍 {platform} のトレンドを監視中...", file=sys.stderr)
                trends = self.collect_trends(platform)
                results[platform] = trends
            except Exception as e:
                print(f"⚠️  {platform} の監視失敗: {e}", file=sys.stderr)
                results[platform] = {
                    'error': str(e),
                    'trends': []
                }
        
        # 結果を保存
        self._save_trends(results)
        
        return results
    
    def collect_trends(self, platform):
        """
        特定のプラットフォームのトレンドを収集
        
        Args:
            platform: SNSプラットフォーム名
        
        Returns:
            dict: トレンドデータ
        """
        # プラットフォームごとのトレンドURL
        trend_urls = {
            'X': 'https://x.com/explore/tabs/trending',
            'Threads': 'https://www.threads.net/',
            'Instagram': 'https://www.instagram.com/explore/',
            'Facebook': 'https://www.facebook.com/',
            'Pinterest': 'https://www.pinterest.com/today/'
        }
        
        url = trend_urls.get(platform)
        if not url:
            raise ValueError(f"不明なプラットフォーム: {platform}")
        
        # browserツールを使用してスクリーンショット取得
        # 注: Clawdbot環境では clawdbot browser コマンドを使用
        screenshot_path = self._capture_trends_screenshot(platform, url)
        
        if not screenshot_path or not Path(screenshot_path).exists():
            return {
                'platform': platform,
                'url': url,
                'trends': [],
                'error': 'スクリーンショット取得失敗'
            }
        
        # スクリーンショットをGeminiで分析
        trends = self._analyze_trends_screenshot(platform, screenshot_path)
        
        return {
            'platform': platform,
            'url': url,
            'screenshot': screenshot_path,
            'trends': trends,
            'collected_at': datetime.now().isoformat()
        }
    
    def _capture_trends_screenshot(self, platform, url):
        """
        browserツールでトレンドページのスクリーンショットを取得
        
        Args:
            platform: プラットフォーム名
            url: トレンドページのURL
        
        Returns:
            str: スクリーンショットのパス
        """
        try:
            # 出力パス
            output_dir = self.data_dir / 'screenshots'
            output_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            screenshot_path = output_dir / f'{platform}_{timestamp}.png'
            
            # clawdbot browser コマンドを実行
            # 注: 実際の環境では、Pythonから直接 browser ツールを呼び出すことができないため、
            # シェルスクリプト経由で実行するか、Node.js経由で実行する必要があります
            # ここでは簡易的にプレースホルダーとして実装
            
            cmd = [
                'clawdbot', 'browser', 'screenshot',
                '--url', url,
                '--output', str(screenshot_path),
                '--wait', '5000'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and screenshot_path.exists():
                return str(screenshot_path)
            else:
                print(f"⚠️  スクリーンショット取得失敗: {result.stderr}", file=sys.stderr)
                return None
        
        except Exception as e:
            print(f"⚠️  スクリーンショット取得エラー: {e}", file=sys.stderr)
            return None
    
    def _analyze_trends_screenshot(self, platform, screenshot_path):
        """
        スクリーンショットをGeminiで分析してトレンドを抽出
        
        Args:
            platform: プラットフォーム名
            screenshot_path: スクリーンショットのパス
        
        Returns:
            list: トレンド投稿のリスト
        """
        try:
            with open(screenshot_path, 'rb') as f:
                image_data = f.read()
            
            prompt = f"""このスクリーンショットは{platform}のトレンドページです。
バズっている投稿やトレンドトピックを分析してください。

以下のJSON形式で、トップ5のトレンド投稿を抽出してください：

{{
  "trends": [
    {{
      "title": "投稿のタイトルまたは主要テキスト",
      "description": "投稿内容の説明",
      "engagement_score": 95,
      "visual_elements": ["要素1", "要素2"],
      "caption_style": "キャプションのスタイル",
      "why_viral": "なぜバズっているのかの分析",
      "learnings": ["学び1", "学び2", "学び3"],
      "replicable": true
    }}
  ]
}}

注: engagement_score は 0-100 の推定値です。"""
            
            response = self.model.generate_content([
                prompt,
                {'mime_type': 'image/png', 'data': image_data}
            ])
            
            # レスポンスをパース
            result = self._parse_trends_response(response.text)
            return result.get('trends', [])
        
        except Exception as e:
            print(f"⚠️  トレンド分析エラー: {e}", file=sys.stderr)
            return []
    
    def _parse_trends_response(self, response_text):
        """Geminiのレスポンスをパース"""
        try:
            # JSONコードブロックを抽出
            if '```json' in response_text:
                json_str = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                json_str = response_text.split('```')[1].split('```')[0].strip()
            else:
                json_str = response_text.strip()
            
            return json.loads(json_str)
        
        except Exception as e:
            print(f"⚠️  パースエラー: {e}", file=sys.stderr)
            return {'trends': []}
    
    def _save_trends(self, trends_data):
        """トレンドデータを保存"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = self.data_dir / f'trends_{timestamp}.json'
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(trends_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ トレンドデータ保存: {output_file}", file=sys.stderr)
    
    def get_top_trends(self, limit=10):
        """
        最新のトレンドデータから上位を取得
        
        Args:
            limit: 取得件数
        
        Returns:
            list: トレンド投稿のリスト
        """
        # 最新のトレンドファイルを取得
        trend_files = sorted(self.data_dir.glob('trends_*.json'), reverse=True)
        
        if not trend_files:
            return []
        
        with open(trend_files[0], 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 全プラットフォームのトレンドを統合
        all_trends = []
        for platform, platform_data in data.items():
            if 'error' not in platform_data:
                for trend in platform_data.get('trends', []):
                    trend['platform'] = platform
                    all_trends.append(trend)
        
        # エンゲージメントスコアでソート
        all_trends.sort(key=lambda x: x.get('engagement_score', 0), reverse=True)
        
        return all_trends[:limit]
    
    def analyze_trend_patterns(self):
        """
        過去のトレンドデータからパターンを分析
        
        Returns:
            dict: パターン分析結果
        """
        trend_files = sorted(self.data_dir.glob('trends_*.json'))[-7:]  # 過去7日分
        
        if not trend_files:
            return {'patterns': [], 'recommendations': []}
        
        # トレンドデータを収集
        all_trends = []
        for file in trend_files:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for platform, platform_data in data.items():
                    if 'error' not in platform_data:
                        all_trends.extend(platform_data.get('trends', []))
        
        # Geminiでパターン分析
        prompt = f"""以下の{len(all_trends)}件のトレンド投稿データを分析してください：

{json.dumps(all_trends, ensure_ascii=False, indent=2)[:8000]}

以下のJSON形式で回答してください：

{{
  "common_patterns": [
    {{
      "pattern": "パターンの説明",
      "frequency": 15,
      "platforms": ["Instagram", "Threads"],
      "effectiveness": 85
    }}
  ],
  "recommendations": [
    "推奨事項1",
    "推奨事項2",
    "推奨事項3"
  ],
  "emerging_trends": [
    "新しいトレンド1",
    "新しいトレンド2"
  ]
}}"""
        
        try:
            response = self.model.generate_content(prompt)
            result = self._parse_trends_response(response.text)
            return result
        except Exception as e:
            print(f"⚠️  パターン分析エラー: {e}", file=sys.stderr)
            return {'patterns': [], 'recommendations': [], 'emerging_trends': []}

def main():
    """メイン関数"""
    if len(sys.argv) > 1:
        action = sys.argv[1]
    else:
        action = 'monitor'
    
    try:
        monitor = TrendMonitor()
        
        if action == 'monitor':
            # 全プラットフォームを監視
            result = monitor.monitor_all_platforms()
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif action == 'top':
            # トップトレンドを取得
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            result = monitor.get_top_trends(limit)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif action == 'patterns':
            # パターン分析
            result = monitor.analyze_trend_patterns()
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        else:
            print(f"不明なアクション: {action}")
            print("使い方: python trend-monitor.py [monitor|top|patterns] [limit]")
            sys.exit(1)
    
    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
