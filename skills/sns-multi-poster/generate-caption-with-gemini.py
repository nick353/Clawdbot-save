#!/usr/bin/env python3
"""
Gemini Visionでプラットフォーム別最適化キャプション生成
使い方: python3 generate-caption-with-gemini.py <画像パス> [--platform <platform>]
プラットフォーム: instagram, x, threads, facebook, pinterest (デフォルト: instagram)
"""
import sys
import os
import argparse
import google.generativeai as genai
from PIL import Image

# プラットフォーム別戦略
PLATFORM_STRATEGIES = {
    'instagram': {
        'name': 'Instagram',
        'strategy': """
- リール（ショート動画）最優先でエンゲージメント25%アップ
- ハッシュタグで発見性向上（5-10個）
- 開封動画・アニメーションが効果的
- 絵文字を多めに使用
- ストーリーテリング重視
        """
    },
    'x': {
        'name': 'X (Twitter)',
        'strategy': """
- 動画が最高パフォーマンス
- 質問ツイート形式が効果的（例: 「どの猫アートがお気に入り?」）
- ユーモラスな表現でバズる
- 短いテキスト（280文字以内）
- ハッシュタグは2-3個程度
        """
    },
    'threads': {
        'name': 'Threads',
        'strategy': """
- 画像と動画がほぼ同等（画像わずかに上）
- 会話重視、質問スレッドが効果的
- ビハインドシーン（制作過程）でコミュニティ構築
- カジュアルなトーン
- ハッシュタグは控えめ（1-2個）
        """
    },
    'facebook': {
        'name': 'Facebook',
        'strategy': """
- ショート動画→画像の順で効果的
- ルール・オブ・サード: 1/3プロモ、1/3他者コンテンツ、1/3価値提供
- ストーリー性重視
- 長めのキャプションOK
- コミュニティ感を大切に
        """
    },
    'pinterest': {
        'name': 'Pinterest',
        'strategy': """
- 画像が最適（ビジュアル検索エンジン）
- 縦型ピンが効果的
- キーワード最適化重視（例: 「Ukiyo-e cat print」）
- 詳細な説明文
- 検索を意識したハッシュタグ（5-10個）
        """
    }
}

def generate_caption(image_path, platform='instagram'):
    """画像からプラットフォーム別最適化キャプションを生成"""
    # Gemini API設定
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("❌ エラー: GEMINI_API_KEYが設定されていません", file=sys.stderr)
        sys.exit(1)
    
    genai.configure(api_key=api_key)
    
    # プラットフォーム戦略取得
    if platform not in PLATFORM_STRATEGIES:
        print(f"❌ エラー: 不明なプラットフォーム: {platform}", file=sys.stderr)
        print(f"利用可能: {', '.join(PLATFORM_STRATEGIES.keys())}", file=sys.stderr)
        sys.exit(1)
    
    strategy = PLATFORM_STRATEGIES[platform]
    
    # 画像読み込み
    try:
        img = Image.open(image_path)
    except Exception as e:
        print(f"❌ エラー: 画像の読み込みに失敗しました: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Gemini Vision APIでキャプション生成
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""この画像を{strategy['name']}に投稿するための魅力的なキャプションを日本語で生成してください。

## {strategy['name']}の戦略
{strategy['strategy']}

## 出力形式

【キャプション】
（ここに{strategy['name']}向けに最適化されたキャプションを記述）

【ハッシュタグ】
（{strategy['name']}に適したハッシュタグを記述）

## 注意事項
- {strategy['name']}のアルゴリズムとユーザー行動を考慮する
- 絵文字を適度に使用する（プラットフォームに応じて調整）
- ポジティブで共感を呼ぶ内容にする
- 具体的な描写を含める
- エンゲージメントを促す工夫をする"""

        response = model.generate_content([prompt, img])
        
        # キャプション出力
        caption = response.text.strip()
        print(caption)
        
    except Exception as e:
        print(f"❌ エラー: Gemini API呼び出しに失敗しました: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Gemini Visionでプラットフォーム別最適化キャプション生成'
    )
    parser.add_argument('image_path', help='画像ファイルのパス')
    parser.add_argument(
        '--platform',
        choices=list(PLATFORM_STRATEGIES.keys()),
        default='instagram',
        help='投稿先プラットフォーム（デフォルト: instagram）'
    )
    
    args = parser.parse_args()
    
    if not os.path.exists(args.image_path):
        print(f"❌ エラー: 画像ファイルが見つかりません: {args.image_path}", file=sys.stderr)
        sys.exit(1)
    
    generate_caption(args.image_path, args.platform)
