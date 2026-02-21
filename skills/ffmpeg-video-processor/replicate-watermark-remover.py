#!/usr/bin/env python3
"""
Replicate LaMA ウォーターマーク除去スクリプト
動画からフレームを抽出 → LaMA inpainting → 動画再構成
"""

import os
import sys
import cv2
import replicate
from pathlib import Path
import tempfile
import shutil
from PIL import Image
import base64
from io import BytesIO

def extract_frames(video_path, output_dir):
    """動画からフレームを抽出"""
    print(f"📹 フレーム抽出中: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    print(f"   解像度: {width}x{height}")
    print(f"   FPS: {fps}")
    print(f"   総フレーム数: {total_frames}")
    
    frames = []
    frame_idx = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_path = os.path.join(output_dir, f"frame_{frame_idx:05d}.png")
        cv2.imwrite(frame_path, frame)
        frames.append(frame_path)
        frame_idx += 1
        
        if frame_idx % 30 == 0:
            print(f"\r   進捗: {frame_idx}/{total_frames} フレーム", end='', flush=True)
    
    cap.release()
    print(f"\n✅ フレーム抽出完了: {len(frames)} フレーム")
    
    return frames, fps, width, height


def create_watermark_mask(width, height, positions):
    """
    ウォーターマークのマスク画像を作成
    positions: [(x, y, w, h), ...] のリスト
    """
    # 白い背景（マスクなし）
    mask = Image.new('RGB', (width, height), (255, 255, 255))
    
    # ウォーターマーク位置を黒く塗りつぶす
    from PIL import ImageDraw
    draw = ImageDraw.Draw(mask)
    
    for x, y, w, h in positions:
        # マスクを少し拡張（ウォーターマーク周辺も含める）
        expand = 5
        draw.rectangle(
            [x - expand, y - expand, x + w + expand, y + h + expand],
            fill=(0, 0, 0)
        )
    
    return mask


def image_to_data_url(image_path):
    """画像をdata URLに変換"""
    with open(image_path, 'rb') as f:
        img_data = f.read()
    
    b64 = base64.b64encode(img_data).decode('utf-8')
    return f"data:image/png;base64,{b64}"


def pil_to_data_url(pil_image):
    """PIL ImageをdataURLに変換"""
    buffered = BytesIO()
    pil_image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{img_str}"


def remove_watermark_lama(frame_path, mask, output_path):
    """
    Replicate LaMAでウォーターマーク除去
    """
    frame_url = image_to_data_url(frame_path)
    mask_url = pil_to_data_url(mask)
    
    output = replicate.run(
        "andreasjansson/lama:eef0b26b01ef88daff11a0f2fe6fca8c06a9e0a5e52aacfa8023d05bb3368a21",
        input={
            "image": frame_url,
            "mask": mask_url
        }
    )
    
    # 出力URLから画像をダウンロード
    import requests
    response = requests.get(output)
    with open(output_path, 'wb') as f:
        f.write(response.content)


def frames_to_video(frames_dir, output_path, fps):
    """フレームから動画を再構成"""
    print(f"🎬 動画再構成中...")
    
    frames = sorted([f for f in os.listdir(frames_dir) if f.endswith('.png')])
    
    if not frames:
        raise ValueError("フレームが見つかりません")
    
    # 最初のフレームから解像度を取得
    first_frame = cv2.imread(os.path.join(frames_dir, frames[0]))
    height, width, _ = first_frame.shape
    
    # VideoWriterで動画作成
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    for frame_name in frames:
        frame_path = os.path.join(frames_dir, frame_name)
        frame = cv2.imread(frame_path)
        out.write(frame)
    
    out.release()
    print(f"✅ 動画再構成完了: {output_path}")


def remove_watermark_from_video(video_path, output_path, watermark_positions):
    """
    動画からウォーターマークを除去するメイン関数
    
    Args:
        video_path: 入力動画パス
        output_path: 出力動画パス
        watermark_positions: [(x, y, w, h), ...] ウォーターマーク位置リスト
    """
    # 一時ディレクトリ作成
    temp_dir = tempfile.mkdtemp()
    frames_dir = os.path.join(temp_dir, "frames")
    processed_dir = os.path.join(temp_dir, "processed")
    os.makedirs(frames_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)
    
    try:
        # 1. フレーム抽出
        frames, fps, width, height = extract_frames(video_path, frames_dir)
        
        # 2. マスク作成
        print(f"🎭 マスク作成中...")
        mask = create_watermark_mask(width, height, watermark_positions)
        print(f"✅ マスク作成完了")
        
        # 3. 各フレームをLaMAで処理
        print(f"🎨 ウォーターマーク除去中（{len(frames)} フレーム）...")
        for idx, frame_path in enumerate(frames):
            output_frame = os.path.join(processed_dir, f"frame_{idx:05d}.png")
            
            try:
                remove_watermark_lama(frame_path, mask, output_frame)
                print(f"\r   進捗: {idx + 1}/{len(frames)} フレーム", end='', flush=True)
            except Exception as e:
                print(f"\n⚠️ Warning: フレーム {idx} 処理失敗: {e}")
                # 失敗した場合は元のフレームをコピー
                shutil.copy(frame_path, output_frame)
        
        print(f"\n✅ ウォーターマーク除去完了")
        
        # 4. 動画再構成
        frames_to_video(processed_dir, output_path, fps)
        
        print(f"🎉 処理完了: {output_path}")
        
    finally:
        # 一時ディレクトリ削除
        shutil.rmtree(temp_dir)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python replicate-watermark-remover.py <input_video> <output_video> [watermark_positions]")
        print("Example: python replicate-watermark-remover.py input.mp4 output.mp4 '[(35,585,141,53)]'")
        sys.exit(1)
    
    input_video = sys.argv[1]
    output_video = sys.argv[2]
    
    # デフォルトのSora2ウォーターマーク位置（横向き）
    # 実際の位置は動画を確認して調整してください
    watermark_positions = [
        (35, 585, 141, 53),   # 左下
        (30, 68, 149, 50),    # 左上
        (1112, 321, 154, 46)  # 右下
    ]
    
    # カスタム位置が指定されている場合
    if len(sys.argv) > 3:
        import ast
        watermark_positions = ast.literal_eval(sys.argv[3])
    
    # Replicate APIキー確認
    if not os.environ.get('REPLICATE_API_TOKEN'):
        print("❌ Error: REPLICATE_API_TOKEN環境変数が設定されていません")
        print("以下のコマンドで設定してください:")
        print("export REPLICATE_API_TOKEN='your_token_here'")
        sys.exit(1)
    
    remove_watermark_from_video(input_video, output_video, watermark_positions)
