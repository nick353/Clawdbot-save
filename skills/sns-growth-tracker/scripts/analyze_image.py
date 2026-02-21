#!/usr/bin/env python3
"""
Gemini画像分析スクリプト
画像・動画を分析してSNS投稿に最適な情報を抽出
"""

import os
import sys
import json
import base64
from pathlib import Path

# Gemini API（google.generativeai）
try:
    import google.generativeai as genai
except ImportError:
    print("❌ google-generativeai がインストールされていません")
    print("インストール: pip install google-generativeai")
    sys.exit(1)

class ImageAnalyzer:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY が設定されていません")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-flash-latest')
    
    def analyze_image(self, image_path, analysis_type='content'):
        """
        画像を分析
        
        Args:
            image_path: 画像ファイルのパス
            analysis_type: 分析タイプ（'content', 'trend', 'engagement'）
        
        Returns:
            dict: 分析結果
        """
        if not Path(image_path).exists():
            raise FileNotFoundError(f"画像が見つかりません: {image_path}")
        
        # 画像を読み込み
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # 分析プロンプト
        prompts = {
            'content': self._get_content_prompt(),
            'trend': self._get_trend_prompt(),
            'engagement': self._get_engagement_prompt()
        }
        
        prompt = prompts.get(analysis_type, prompts['content'])
        
        try:
            # Gemini APIで分析
            response = self.model.generate_content([
                prompt,
                {'mime_type': self._get_mime_type(image_path), 'data': image_data}
            ])
            
            # 結果をパース
            result = self._parse_response(response.text, analysis_type)
            result['raw_response'] = response.text
            result['image_path'] = image_path
            
            return result
        
        except Exception as e:
            print(f"❌ Gemini分析エラー: {e}")
            return {
                'error': str(e),
                'image_path': image_path
            }
    
    def _get_content_prompt(self):
        """コンテンツ分析プロンプト"""
        return """この画像を詳しく分析してください。以下の形式でJSON形式で回答してください：

{
  "description": "画像の詳細な説明（200文字程度）",
  "theme": "メインテーマ（浮世絵、風景、人物など）",
  "colors": ["主要な色1", "主要な色2", "主要な色3"],
  "composition": "構図の説明（シンメトリー、ダイナミックなど）",
  "mood": "雰囲気（穏やか、ダイナミック、神秘的など）",
  "subjects": ["被写体1", "被写体2"],
  "style": "スタイル（写実的、抽象的など）",
  "quality_score": 85,
  "engagement_prediction": {
    "instagram": 80,
    "x": 70,
    "threads": 75,
    "facebook": 65,
    "pinterest": 90
  },
  "recommended_platforms": ["Pinterest", "Instagram", "Threads"],
  "tags": ["タグ1", "タグ2", "タグ3"]
}

数値は0-100のスコアです。"""
    
    def _get_trend_prompt(self):
        """トレンド分析プロンプト"""
        return """このバズっている投稿を分析してください。以下の形式でJSON形式で回答してください：

{
  "engagement_factors": ["要因1", "要因2", "要因3"],
  "why_viral": "なぜバズったのかの説明",
  "visual_elements": ["視覚的要素1", "要素2"],
  "caption_style": "キャプションのスタイル",
  "learnings": ["学び1", "学び2", "学び3"],
  "replicable_elements": ["再現可能な要素1", "要素2"],
  "confidence_score": 85
}"""
    
    def _get_engagement_prompt(self):
        """エンゲージメント予測プロンプト"""
        return """この画像のSNSエンゲージメントを予測してください。以下の形式でJSON形式で回答してください：

{
  "predicted_engagement": {
    "instagram": {"likes": 1000, "comments": 50, "saves": 200},
    "x": {"likes": 500, "retweets": 100, "replies": 30},
    "threads": {"likes": 800, "reposts": 150, "replies": 60},
    "facebook": {"likes": 300, "comments": 20, "shares": 50},
    "pinterest": {"saves": 1500, "clicks": 800}
  },
  "best_platform": "Instagram",
  "engagement_rate_prediction": 18.5,
  "reasons": ["理由1", "理由2", "理由3"]
}"""
    
    def _parse_response(self, response_text, analysis_type):
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
            # パースに失敗した場合、テキストとして返す
            return {
                'parsed': False,
                'text': response_text,
                'error': str(e)
            }
    
    def _get_mime_type(self, file_path):
        """ファイルのMIMEタイプを取得"""
        ext = Path(file_path).suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo'
        }
        return mime_types.get(ext, 'image/jpeg')

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("使い方: python analyze-image.py <image_path> [analysis_type]")
        print("analysis_type: content (デフォルト), trend, engagement")
        sys.exit(1)
    
    image_path = sys.argv[1]
    analysis_type = sys.argv[2] if len(sys.argv) > 2 else 'content'
    
    try:
        analyzer = ImageAnalyzer()
        result = analyzer.analyze_image(image_path, analysis_type)
        
        # JSON形式で出力
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'image_path': image_path
        }, ensure_ascii=False, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()
