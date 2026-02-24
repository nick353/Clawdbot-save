#!/usr/bin/env python3
"""
Gemini Vision APIでスクリーンショットを解析してエラー原因を特定
"""
import sys
import os
import json
import google.generativeai as genai
from pathlib import Path

def analyze_screenshot(image_path: str, platform: str) -> dict:
    """
    スクリーンショットを解析してエラー原因を特定
    
    Args:
        image_path: スクリーンショットのパス
        platform: プラットフォーム名 (instagram/threads/facebook/x)
    
    Returns:
        {
            "error_type": "cookie_expired|selector_changed|rate_limit|unknown",
            "description": "エラーの詳細説明",
            "retry_strategy": "reauth|wait|alternative_selector|manual"
        }
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {
            "error_type": "unknown",
            "description": "GEMINI_API_KEY not set",
            "retry_strategy": "manual"
        }
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    # 画像読み込み
    if not Path(image_path).exists():
        return {
            "error_type": "unknown",
            "description": f"Screenshot not found: {image_path}",
            "retry_strategy": "manual"
        }
    
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    # プラットフォーム別のプロンプト
    prompts = {
        "instagram": """
This is a screenshot from Instagram automation. Analyze the image and determine:
1. Is there a login page or session expired error?
2. Is there a "Try Again" or error message visible?
3. Is the page loading correctly?
4. Are there any rate limit warnings?
5. Is the post upload interface visible?

Return a JSON response with:
{
    "error_type": "cookie_expired|selector_changed|rate_limit|loading|success|unknown",
    "description": "Brief description of what you see",
    "retry_strategy": "reauth|wait|alternative_selector|none"
}
""",
        "threads": """
This is a screenshot from Threads automation. Analyze the image and determine:
1. Is there a login page or session expired error?
2. Is there a "Try Again" or error message visible?
3. Is the page loading correctly?
4. Are there any rate limit warnings?
5. Is the post composer visible?

Return a JSON response with:
{
    "error_type": "cookie_expired|selector_changed|rate_limit|loading|success|unknown",
    "description": "Brief description of what you see",
    "retry_strategy": "reauth|wait|alternative_selector|none"
}
""",
        "facebook": """
This is a screenshot from Facebook automation. Analyze the image and determine:
1. Is there a login page or session expired error?
2. Is there a "Try Again" or error message visible?
3. Is the page loading correctly?
4. Are there any rate limit warnings?
5. Is the post creation interface visible?

Return a JSON response with:
{
    "error_type": "cookie_expired|selector_changed|rate_limit|loading|success|unknown",
    "description": "Brief description of what you see",
    "retry_strategy": "reauth|wait|alternative_selector|none"
}
""",
        "x": """
This is a screenshot from X (Twitter) automation. Analyze the image and determine:
1. Is there a login page or session expired error?
2. Is there a "Try Again" or error message visible?
3. Is the page loading correctly?
4. Are there any rate limit warnings?
5. Is the tweet composer visible?

Return a JSON response with:
{
    "error_type": "cookie_expired|selector_changed|rate_limit|loading|success|unknown",
    "description": "Brief description of what you see",
    "retry_strategy": "reauth|wait|alternative_selector|none"
}
"""
    }
    
    prompt = prompts.get(platform, prompts["instagram"])
    
    try:
        response = model.generate_content([
            prompt,
            {"mime_type": "image/png", "data": image_data}
        ])
        
        text = response.text.strip()
        # JSON部分を抽出（```json ... ``` で囲まれている可能性がある）
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(text)
        return result
    except Exception as e:
        return {
            "error_type": "unknown",
            "description": f"Analysis failed: {str(e)}",
            "retry_strategy": "manual"
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: analyze-error-frame.py <image_path> <platform>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    platform = sys.argv[2]
    
    result = analyze_screenshot(image_path, platform)
    print(json.dumps(result, indent=2, ensure_ascii=False))
