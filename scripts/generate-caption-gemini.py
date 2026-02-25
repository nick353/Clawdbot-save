#!/usr/bin/env python3
"""
Gemini Vision APIを使用して画像・動画から自動キャプション生成
使い方: python3 generate-caption-gemini.py <画像ファイルパス>
"""

import os
import sys
import google.generativeai as genai
from pathlib import Path

def generate_caption(media_path: str) -> str:
    """
    Gemini Vision APIで画像・動画を分析してキャプション生成
    
    Args:
        media_path: 画像・動画ファイルのパス
    
    Returns:
        生成されたキャプション（日本語）
    """
    # API Key取得
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    # Gemini API初期化
    genai.configure(api_key=api_key)
    
    # モデル選択（Vision対応・無料枠大）
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    # ファイルアップロード
    media_file = genai.upload_file(media_path)
    
    # プロンプト（SNS投稿向け・日本語）
    prompt = """
この画像・動画を分析して、SNS投稿用のキャプションを生成してください。

【要件】
- 日本語で記述
- 150文字以内
- 絵文字を適度に使用（3-5個程度）
- ハッシュタグは含めない（後で自動追加）
- 画像・動画の内容を魅力的に説明
- SNSでエンゲージメントが得られる文章

【出力形式】
キャプションのみ（前置きや説明なし）
"""
    
    # Gemini Vision API呼び出し
    response = model.generate_content([prompt, media_file])
    
    # キャプション取得
    caption = response.text.strip()
    
    return caption

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 generate-caption-gemini.py <media_path>", file=sys.stderr)
        sys.exit(1)
    
    media_path = sys.argv[1]
    
    if not Path(media_path).exists():
        print(f"Error: File not found: {media_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        caption = generate_caption(media_path)
        print(caption)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
