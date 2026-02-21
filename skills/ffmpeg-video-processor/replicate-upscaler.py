#!/usr/bin/env python3
"""
Replicate Real-ESRGAN 画質改善スクリプト
動画を4倍アップスケール
"""

import os
import sys
import replicate
import requests
import tempfile
import subprocess


def upscale_video_realESRGAN(input_path, output_path, scale=4):
    """
    Real-ESRGANで動画をアップスケール
    
    Args:
        input_path: 入力動画パス
        output_path: 出力動画パス
        scale: スケール倍率（2 or 4）
    """
    print(f"🚀 Real-ESRGAN 画質改善開始...")
    print(f"   入力: {input_path}")
    print(f"   出力: {output_path}")
    print(f"   スケール: {scale}x")
    
    # 動画をdata URLに変換（またはアップロード）
    # Real-ESRGANは動画URLまたはファイルパスを受け取る
    
    try:
        # Replicate Real-ESRGANモデル実行
        print(f"⏳ 処理中（数分かかります）...")
        
        output = replicate.run(
            "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
            input={
                "image": open(input_path, "rb"),
                "scale": scale,
                "face_enhance": False
            }
        )
        
        # 出力URLから動画をダウンロード
        print(f"⬇️ ダウンロード中...")
        response = requests.get(output)
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ Real-ESRGAN処理完了: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Real-ESRGAN処理失敗: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python replicate-upscaler.py <input_video> <output_video> [scale]")
        print("Example: python replicate-upscaler.py input.mp4 output.mp4 4")
        sys.exit(1)
    
    input_video = sys.argv[1]
    output_video = sys.argv[2]
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    
    # Replicate APIキー確認
    if not os.environ.get('REPLICATE_API_TOKEN'):
        print("❌ Error: REPLICATE_API_TOKEN環境変数が設定されていません")
        print("以下のコマンドで設定してください:")
        print("export REPLICATE_API_TOKEN='your_token_here'")
        sys.exit(1)
    
    success = upscale_video_realESRGAN(input_video, output_video, scale)
    sys.exit(0 if success else 1)
