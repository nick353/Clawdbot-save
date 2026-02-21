#!/usr/bin/env python3
"""
YouTube動画分析 v2（新しいgoogle-genai使用）
YouTube URLを直接Gemini APIに渡して分析
"""

import os
import sys
import json
from google import genai
from google.genai import types

def analyze_youtube_video(youtube_url, api_key):
    """YouTube URLを直接Gemini APIで分析"""
    
    print(f"🔍 動画分析開始: {youtube_url}")
    
    # クライアント作成
    client = genai.Client(api_key=api_key)
    
    # プロンプト作成
    prompt = """
この動画を詳細に分析して、説明されているトレード手法（特に銘柄選定の手法）を抽出してください。

以下の形式でJSON形式で出力してください：

```json
{
  "strategy_name": "手法の名称",
  "coin_selection": {
    "method": "銘柄選定の具体的な方法",
    "criteria": ["選定基準1", "選定基準2", "選定基準3"],
    "tools": ["使用するツール・指標"],
    "process": "選定プロセスの詳細"
  },
  "timeframe": "推奨時間足",
  "indicators": [
    {
      "name": "インジケーター名",
      "settings": "設定値"
    }
  ],
  "entry_conditions": {
    "long": ["買いエントリー条件1", "買いエントリー条件2"],
    "short": ["売りエントリー条件1", "売りエントリー条件2"]
  },
  "exit_conditions": {
    "stop_loss": "損切り条件",
    "take_profit": "利確条件"
  },
  "risk_management": "リスク管理の方法",
  "key_points": ["重要なポイント1", "重要なポイント2", "重要なポイント3"]
}
```

特に「銘柄選定（coin_selection）」の部分を詳細に記述してください。
"""
    
    # 動画を分析
    print("⏳ Gemini APIで分析中...")
    response = client.models.generate_content(
        model='gemini-2.0-flash-exp',
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(prompt),
                    types.Part.from_uri(
                        file_uri=youtube_url,
                        mime_type="video/*"
                    )
                ]
            )
        ]
    )
    
    return response.text

def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze-youtube-v2.py <YouTube URL>")
        sys.exit(1)
    
    youtube_url = sys.argv[1]
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("❌ エラー: GEMINI_API_KEY環境変数が設定されていません")
        sys.exit(1)
    
    try:
        # 分析実行
        result = analyze_youtube_video(youtube_url, api_key)
        
        # 結果を表示
        print("\n" + "="*60)
        print("📊 トレード手法分析結果")
        print("="*60 + "\n")
        print(result)
        
        # JSONファイルに保存
        output_file = "/root/clawd/trading-strategies/youtube-analysis.json"
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # JSONとして保存を試みる
        try:
            # レスポンスからJSONを抽出
            if "```json" in result:
                json_str = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                json_str = result.split("```")[1].split("```")[0].strip()
            else:
                json_str = result
            
            strategy_data = json.loads(json_str)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(strategy_data, f, ensure_ascii=False, indent=2)
            
            print(f"\n✅ 結果を保存しました: {output_file}")
        except json.JSONDecodeError:
            # JSON形式でない場合はテキストとして保存
            output_file = output_file.replace('.json', '.txt')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(result)
            print(f"\n✅ 結果を保存しました: {output_file}")
        
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
