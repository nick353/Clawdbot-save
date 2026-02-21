#!/usr/bin/env python3
"""
各SNS向けキャプション自動生成スクリプト
Gemini APIを使用して、各プラットフォームのアルゴリズムに最適化されたキャプションを生成
"""

import os
import sys
import json
from pathlib import Path

try:
    import google.generativeai as genai
except ImportError:
    print("❌ google-generativeai がインストールされていません")
    print("インストール: pip install google-generativeai")
    sys.exit(1)

class CaptionGenerator:
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
    
    def generate_all_captions(self, image_analysis, image_path=None):
        """
        全SNS向けのキャプションを一括生成
        
        Args:
            image_analysis: analyze-image.py の出力結果
            image_path: 画像パス（オプション、画像を再度読み込む場合）
        
        Returns:
            dict: 各SNS向けキャプション
        """
        captions = {}
        
        for platform in ['X', 'Threads', 'Instagram', 'Facebook', 'Pinterest']:
            try:
                caption = self.generate_caption(platform, image_analysis, image_path)
                captions[platform] = caption
            except Exception as e:
                print(f"⚠️  {platform}のキャプション生成失敗: {e}", file=sys.stderr)
                captions[platform] = {
                    'error': str(e),
                    'caption': '',
                    'hashtags': []
                }
        
        return captions
    
    def generate_caption(self, platform, image_analysis, image_path=None):
        """
        特定のSNS向けキャプションを生成
        
        Args:
            platform: SNSプラットフォーム名（X, Threads, Instagram, Facebook, Pinterest）
            image_analysis: 画像分析結果
            image_path: 画像パス（オプション）
        
        Returns:
            dict: キャプション情報
        """
        platform_config = self.config['captions'].get(platform, {})
        prompt = self._build_prompt(platform, platform_config, image_analysis)
        
        # 画像付きで生成する場合
        if image_path and Path(image_path).exists():
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            response = self.model.generate_content([
                prompt,
                {'mime_type': self._get_mime_type(image_path), 'data': image_data}
            ])
        else:
            # テキストのみで生成
            response = self.model.generate_content(prompt)
        
        # レスポンスをパース
        result = self._parse_caption_response(response.text, platform_config)
        result['platform'] = platform
        result['raw_response'] = response.text
        
        return result
    
    def _build_prompt(self, platform, platform_config, image_analysis):
        """プロンプトを構築"""
        # Algorithm optimization strategies (English)
        strategies = {
            'X': 'Question-based, thread format, data citation to spark conversations and encourage replies',
            'Threads': 'Conversational, reply-focused, casual tone asking for opinions',
            'Instagram': 'Carousel, DM-inducing, extended viewing time, save-worthy value',
            'Facebook': 'Reels, conversational, storytelling to encourage comments and shares',
            'Pinterest': 'SEO keywords, vertical format, text overlay for search optimization'
        }
        
        strategy = strategies.get(platform, '')
        
        description = image_analysis.get('description', 'No description')
        theme = image_analysis.get('theme', 'Unknown')
        mood = image_analysis.get('mood', 'Unknown')
        tags = image_analysis.get('tags', [])
        
        prompt = f"""You are an SNS marketer who deeply understands {platform}'s algorithm.

【Image Information】
- Theme: {theme}
- Mood: {mood}
- Description: {description}
- Tags: {', '.join(tags)}

【{platform} Algorithm Optimization Strategy】
{strategy}

【Constraints】
- Max length: {platform_config.get('max_length', 500)} characters
- Hashtags: {platform_config.get('hashtags', 3)}
- Style: {platform_config.get('style', 'Casual')}
- Features: {', '.join(platform_config.get('features', []))}

【Task】
Generate an engagement-maximizing caption optimized for {platform}'s algorithm for this image.

**IMPORTANT: Generate the caption in ENGLISH for an English-speaking audience.**

Output in the following JSON format:

{{
  "caption": "The actual caption text IN ENGLISH",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "engagement_tactics": ["tactic1", "tactic2", "tactic3"],
  "expected_engagement_rate": 15.5,
  "reasoning": "Explanation of why this caption is effective"
}}

Key requirements:
- Optimize for {platform}'s algorithm
- Encourage user actions (likes, comments, saves, shares)
- Write natural and compelling text IN ENGLISH
- Choose hashtags that are popular but not overly competitive
- Target English-speaking audience
"""
        
        return prompt
    
    def _parse_caption_response(self, response_text, platform_config):
        """Geminiのレスポンスをパース"""
        try:
            # JSONコードブロックを抽出
            if '```json' in response_text:
                json_str = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                json_str = response_text.split('```')[1].split('```')[0].strip()
            else:
                json_str = response_text.strip()
            
            data = json.loads(json_str)
            
            # 文字数チェック
            max_length = platform_config.get('max_length', 500)
            if len(data['caption']) > max_length:
                data['caption'] = data['caption'][:max_length-3] + '...'
                data['truncated'] = True
            
            return data
        
        except Exception as e:
            # パースに失敗した場合、デフォルト値を返す
            return {
                'caption': response_text[:platform_config.get('max_length', 500)],
                'hashtags': [],
                'engagement_tactics': [],
                'expected_engagement_rate': 0,
                'reasoning': 'パースエラー',
                'error': str(e),
                'parsed': False
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
        }
        return mime_types.get(ext, 'image/jpeg')
    
    def format_for_posting(self, caption_data, platform):
        """
        投稿用に整形
        
        Args:
            caption_data: generate_caption() の結果
            platform: SNSプラットフォーム名
        
        Returns:
            str: 投稿用テキスト（キャプション + ハッシュタグ）
        """
        caption = caption_data.get('caption', '')
        hashtags = caption_data.get('hashtags', [])
        
        # プラットフォームごとのフォーマット
        if platform == 'Pinterest':
            # Pinterestはハッシュタグを使わず、キーワードを本文に含める
            return caption
        else:
            # その他のSNSはハッシュタグを追加
            hashtag_str = ' '.join([f'#{tag}' for tag in hashtags])
            if hashtag_str:
                return f"{caption}\n\n{hashtag_str}"
            return caption

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("使い方: python generate-captions.py <analysis_json> [image_path] [platform]")
        print("platform を指定しない場合は全SNS向けに生成します")
        sys.exit(1)
    
    analysis_file = sys.argv[1]
    image_path = sys.argv[2] if len(sys.argv) > 2 else None
    platform = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        # 分析結果を読み込み
        with open(analysis_file, 'r', encoding='utf-8') as f:
            image_analysis = json.load(f)
        
        generator = CaptionGenerator()
        
        if platform:
            # 特定のプラットフォーム向けに生成
            result = generator.generate_caption(platform, image_analysis, image_path)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            # 全プラットフォーム向けに生成
            result = generator.generate_all_captions(image_analysis, image_path)
            print(json.dumps(result, ensure_ascii=False, indent=2))
    
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'analysis_file': analysis_file
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
