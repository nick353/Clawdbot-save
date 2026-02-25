#!/usr/bin/env python3
"""
Gemini Visionでキャプション生成
使い方: python3 generate-caption-with-gemini.py <画像パス>
"""
import sys
import os
import google.generativeai as genai
from PIL import Image

def generate_caption(image_path):
    """画像からキャプションを生成"""
    # Gemini API設定
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("❌ エラー: GEMINI_API_KEYが設定されていません", file=sys.stderr)
        sys.exit(1)
    
    genai.configure(api_key=api_key)
    
    # 画像読み込み
    try:
        img = Image.open(image_path)
    except Exception as e:
        print(f"❌ エラー: 画像の読み込みに失敗しました: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Gemini Vision APIでキャプション生成
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content([
            """この画像を日本語で説明し、SNS投稿用の魅力的なキャプションを生成してください。

以下の形式で出力してください：

【キャプション】
（ここに魅力的なキャプションを記述）

【ハッシュタグ】
（関連するハッシュタグを5〜10個）

注意事項：
- 絵文字を適度に使用する
- ポジティブで共感を呼ぶ内容にする
- 具体的な描写を含める
- ハッシュタグは日本語と英語を混在させる""",
            img
        ])
        
        # キャプション出力
        caption = response.text.strip()
        print(caption)
        
    except Exception as e:
        print(f"❌ エラー: Gemini API呼び出しに失敗しました: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方: python3 generate-caption-with-gemini.py <画像パス>", file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"❌ エラー: 画像ファイルが見つかりません: {image_path}", file=sys.stderr)
        sys.exit(1)
    
    generate_caption(image_path)
