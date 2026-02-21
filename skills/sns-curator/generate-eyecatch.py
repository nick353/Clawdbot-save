#!/usr/bin/env python3
"""
SNSアイキャッチ画像生成スクリプト
Pillow を使用してインフォグラフィック風の画像を生成

Usage: python3 generate-eyecatch.py "タイトル" "ポイント1" "ポイント2" "ポイント3"
Output: /tmp/curator/eyecatch-YYYY-MM-DD-N.png (パスを stdout に出力)
"""

import sys
import os
from datetime import datetime
from pathlib import Path

def find_japanese_font():
    """利用可能な日本語フォントを検索"""
    candidates = [
        # IPAフォント
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
        "/usr/share/fonts/truetype/fonts-japanese-mincho.ttf",
        "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
        "/usr/share/fonts/opentype/ipafont-mincho/ipam.ttf",
        # Noto Sans CJK
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf",
        "/usr/share/fonts/truetype/noto/NotoSansCJKjp-Regular.ttf",
        # その他
        "/usr/share/fonts/truetype/takao-gothic/TakaoGothic.ttf",
        "/usr/share/fonts/truetype/vlgothic/VL-Gothic-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # フォールバック
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None

def wrap_text(text, max_chars=28):
    """テキストを指定文字数で折り返す（日本語対応）"""
    lines = []
    current_line = ""
    for char in text:
        current_line += char
        if len(current_line) >= max_chars or char in "。！？\n":
            lines.append(current_line.strip())
            current_line = ""
    if current_line.strip():
        lines.append(current_line.strip())
    return lines

def generate_eyecatch(title, points, output_path):
    """アイキャッチ画像を生成"""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("ERROR: Pillow not installed. Run: pip3 install Pillow", file=sys.stderr)
        sys.exit(1)

    # キャンバスサイズ (Twitter/X 推奨: 1200x675, LinkedIn: 1200x628)
    WIDTH, HEIGHT = 1200, 675

    # カラーパレット (@darshal_ スタイル)
    BG_COLOR = (26, 26, 46)          # #1a1a2e ダークネイビー
    ACCENT1 = (16, 185, 129)         # エメラルドグリーン
    ACCENT2 = (99, 102, 241)         # インディゴ
    WHITE = (255, 255, 255)
    LIGHT_GRAY = (200, 210, 230)
    POINT_BG = (40, 40, 70)          # ポイント背景色

    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # フォント設定
    font_path = find_japanese_font()
    EMOJI_FONT_PATH = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
    try:
        if font_path:
            font_title = ImageFont.truetype(font_path, 50)
            font_subtitle = ImageFont.truetype(font_path, 28)
            font_point = ImageFont.truetype(font_path, 30)
            font_footer = ImageFont.truetype(font_path, 24)
        else:
            font_title = ImageFont.load_default()
            font_subtitle = font_title
            font_point = font_title
            font_footer = font_title
    except Exception:
        font_title = ImageFont.load_default()
        font_subtitle = font_title
        font_point = font_title
        font_footer = font_title
    # NotoColorEmoji（絵文字用）
    try:
        font_icon = ImageFont.truetype(EMOJI_FONT_PATH, 32) if os.path.exists(EMOJI_FONT_PATH) else font_point
        USE_EMOJI_FONT = os.path.exists(EMOJI_FONT_PATH)
    except Exception:
        font_icon = font_point
        USE_EMOJI_FONT = False

    # ---- 背景デコレーション ----
    # 左サイドバー（グラデーション風）
    for i in range(8):
        alpha = 255 - i * 25
        color = (ACCENT2[0], ACCENT2[1], ACCENT2[2])
        draw.rectangle([i, 0, i, HEIGHT], fill=color)

    # 右側にサークル装飾（抽象的な背景）
    for cx, cy, r, opacity in [
        (1050, 100, 200, 30), (1100, 500, 150, 20), (900, 600, 100, 15)
    ]:
        overlay = Image.new("RGB", img.size, ACCENT2)
        mask = Image.new("L", img.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=opacity)
        img.paste(overlay, mask=mask)

    draw = ImageDraw.Draw(img)  # redraw after paste

    # ---- タイトルバー ----
    TITLE_BAR_HEIGHT = 140
    # グラデーション風タイトルバー（横方向）
    for x in range(WIDTH):
        ratio = x / WIDTH
        r = int(ACCENT2[0] * (1 - ratio) + ACCENT1[0] * ratio)
        g = int(ACCENT2[1] * (1 - ratio) + ACCENT1[1] * ratio)
        b = int(ACCENT2[2] * (1 - ratio) + ACCENT1[2] * ratio)
        draw.line([(x, 0), (x, TITLE_BAR_HEIGHT)], fill=(r, g, b))

    # タイトルテキスト（折り返し対応）
    title_lines = wrap_text(title, max_chars=22)
    title_y = 20
    for line in title_lines[:2]:  # 最大2行
        try:
            bbox = draw.textbbox((0, 0), line, font=font_title)
            text_w = bbox[2] - bbox[0]
        except Exception:
            text_w = len(line) * 30
        x_pos = max(20, (WIDTH - text_w) // 2)
        draw.text((x_pos, title_y), line, fill=WHITE, font=font_title)
        title_y += 65

    # ---- ポイントセクション ----
    POINTS_START_Y = TITLE_BAR_HEIGHT + 30
    POINT_HEIGHT = 115
    POINT_MARGIN = 15
    CORNER_R = 12

    # アイコン番号（シンプルな数字バッジ）
    ICON_LABELS = ["01", "02", "03", "04"]

    for idx, point_text in enumerate(points[:4]):  # 最大4ポイント
        py = POINTS_START_Y + idx * (POINT_HEIGHT + POINT_MARGIN)

        # ポイントカード背景（角丸風）
        card_x1 = 30
        card_x2 = WIDTH - 30
        card_y1 = py
        card_y2 = py + POINT_HEIGHT

        # 角丸矩形（簡易版）
        draw.rectangle([card_x1 + CORNER_R, card_y1, card_x2 - CORNER_R, card_y2], fill=POINT_BG)
        draw.rectangle([card_x1, card_y1 + CORNER_R, card_x2, card_y2 - CORNER_R], fill=POINT_BG)
        draw.ellipse([card_x1, card_y1, card_x1 + CORNER_R*2, card_y1 + CORNER_R*2], fill=POINT_BG)
        draw.ellipse([card_x2 - CORNER_R*2, card_y1, card_x2, card_y1 + CORNER_R*2], fill=POINT_BG)
        draw.ellipse([card_x1, card_y2 - CORNER_R*2, card_x1 + CORNER_R*2, card_y2], fill=POINT_BG)
        draw.ellipse([card_x2 - CORNER_R*2, card_y2 - CORNER_R*2, card_x2, card_y2], fill=POINT_BG)

        # 左アクセントライン
        draw.rectangle([card_x1, card_y1, card_x1 + 5, card_y2], fill=ACCENT1)

        # 番号バッジ（円形）
        badge_cx = card_x1 + 50
        badge_cy = py + POINT_HEIGHT // 2
        badge_r = 24
        draw.ellipse(
            [badge_cx - badge_r, badge_cy - badge_r, badge_cx + badge_r, badge_cy + badge_r],
            fill=ACCENT1
        )
        label = ICON_LABELS[idx % len(ICON_LABELS)]
        try:
            lbbox = draw.textbbox((0, 0), label, font=font_footer)
            lw = lbbox[2] - lbbox[0]
            lh = lbbox[3] - lbbox[1]
        except Exception:
            lw, lh = 28, 20
        draw.text((badge_cx - lw // 2, badge_cy - lh // 2 - 2), label, fill=WHITE, font=font_footer)

        # ポイントテキスト（折り返し対応）
        point_lines = wrap_text(point_text, max_chars=36)
        text_start_x = card_x1 + 95
        text_y = py + 15

        for line in point_lines[:2]:  # 最大2行
            draw.text((text_start_x, text_y), line, fill=WHITE, font=font_point)
            text_y += 40

    # ---- フッター ----
    FOOTER_Y = HEIGHT - 55
    draw.rectangle([0, FOOTER_Y - 5, WIDTH, HEIGHT], fill=(15, 15, 35))
    draw.line([(0, FOOTER_Y - 5), (WIDTH, FOOTER_Y - 5)], fill=ACCENT1, width=2)

    footer_text = "by @ando_x | AI & 個人開発"
    try:
        bbox = draw.textbbox((0, 0), footer_text, font=font_footer)
        fw = bbox[2] - bbox[0]
    except Exception:
        fw = len(footer_text) * 15
    draw.text(((WIDTH - fw) // 2, FOOTER_Y + 10), footer_text, fill=LIGHT_GRAY, font=font_footer)

    # ---- 右上バッジ ----
    badge_text = "AI活用"
    badge_x, badge_y = WIDTH - 130, TITLE_BAR_HEIGHT + 15
    draw.rounded_rectangle([badge_x, badge_y, badge_x + 100, badge_y + 38], radius=8, fill=ACCENT1)
    try:
        bbox = draw.textbbox((0, 0), badge_text, font=font_footer)
        bw = bbox[2] - bbox[0]
    except Exception:
        bw = len(badge_text) * 14
    draw.text((badge_x + (100 - bw) // 2, badge_y + 8), badge_text, fill=WHITE, font=font_footer)

    # 保存
    img.save(output_path, "PNG", quality=95)
    return output_path


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate-eyecatch.py \"タイトル\" \"ポイント1\" [\"ポイント2\"] [\"ポイント3\"]", file=sys.stderr)
        sys.exit(1)

    title = sys.argv[1]
    points = sys.argv[2:]  # 残りはポイントとして扱う

    if not points:
        points = ["AIツールで効率化", "個人開発で収益化", "グローバルで挑戦"]

    # 出力先
    output_dir = Path("/tmp/curator")
    output_dir.mkdir(parents=True, exist_ok=True)

    date_str = datetime.now().strftime("%Y-%m-%d")

    # 重複しないファイル名を生成
    n = 1
    while True:
        output_path = output_dir / f"eyecatch-{date_str}-{n}.png"
        if not output_path.exists():
            break
        n += 1

    try:
        result = generate_eyecatch(title, points, str(output_path))
        print(result)  # stdout にパスを出力
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
