#!/usr/bin/env python3
"""
YouTube動画分析（トレード手法抽出）
Gemini APIを使用して動画から手法を分析
"""

import os
import sys
import json
import google.generativeai as genai
from pathlib import Path
import subprocess

def download_video(youtube_url, output_dir="/tmp"):
    """YouTube動画をダウンロード"""
    print(f"📥 動画ダウンロード中: {youtube_url}")
    
    output_path = f"{output_dir}/%(id)s.%(ext)s"
    cmd = [
        "yt-dlp",
        "-f", "best[ext=mp4]",  # MP4形式で最高品質
        "-o", output_path,
        youtube_url
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"ダウンロード失敗: {result.stderr}")
    
    # ダウンロードしたファイルパスを取得
    for line in result.stdout.split('\n'):
        if "Destination:" in line or "has already been downloaded" in line:
            # ファイル名を抽出
            video_id = youtube_url.split('v=')[-1].split('&')[0]
            video_path = f"{output_dir}/{video_id}.mp4"
            if os.path.exists(video_path):
                return video_path
    
    # フォールバック: 最新のmp4ファイルを探す
    mp4_files = list(Path(output_dir).glob("*.mp4"))
    if mp4_files:
        return str(max(mp4_files, key=os.path.getctime))
    
    raise Exception("ダウンロードしたファイルが見つかりません")

def analyze_trading_strategy(video_path, api_key):
    """Gemini APIで動画を分析してトレード手法を抽出"""
    print(f"🤖 Gemini APIで分析中...")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-pro')
    
    # 動画ファイルをアップロード
    print("📤 動画アップロード中...")
    video_file = genai.upload_file(video_path)
    
    # 待機（処理完了まで）
    print("⏳ 処理待機中...")
    import time
    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = genai.get_file(video_file.name)
    
    if video_file.state.name == "FAILED":
        raise Exception("動画処理失敗")
    
    # プロンプト作成
    prompt = """
この動画を詳細に分析して、説明されているトレード手法を抽出してください。

以下の形式でJSON形式で出力してください：

{
  "strategy_name": "手法の名称",
  "timeframe": "推奨時間足（例: 1時間足、15分足）",
  "indicators": [
    {
      "name": "インジケーター名（例: 移動平均線、RSI）",
      "settings": "設定値（例: MA(20), RSI(14)）"
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
  "notes": "その他の重要な注意点"
}

動画の内容を正確に反映してください。
"""
    
    # 分析実行
    print("🔍 手法分析中...")
    response = model.generate_content([prompt, video_file])
    
    return response.text

def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze-youtube-trading.py <YouTube URL>")
        sys.exit(1)
    
    youtube_url = sys.argv[1]
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("❌ エラー: GEMINI_API_KEY環境変数が設定されていません")
        sys.exit(1)
    
    try:
        # 1. 動画ダウンロード
        video_path = download_video(youtube_url)
        print(f"✅ ダウンロード完了: {video_path}")
        
        # 2. 手法分析
        result = analyze_trading_strategy(video_path, api_key)
        
        # 3. 結果を整形して表示
        print("\n" + "="*60)
        print("📊 トレード手法分析結果")
        print("="*60 + "\n")
        print(result)
        
        # 4. JSONファイルに保存
        output_file = "/root/clawd/trading-strategies/analysis-result.json"
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # JSONとして保存を試みる
        try:
            # レスポンスからJSONを抽出（```json ... ```の場合）
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
        
        # 5. クリーンアップ
        if os.path.exists(video_path):
            os.remove(video_path)
            print(f"🗑️ 一時ファイル削除: {video_path}")
        
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
