#!/usr/bin/env bash
# Gemini APIで各SNS最適化キャプション生成（自然な文体・AI感排除）

set -e

MEDIA_PATH="$1"
SNS_PLATFORM="$2" # instagram, facebook, threads, pinterest, x

if [ -z "$MEDIA_PATH" ] || [ ! -f "$MEDIA_PATH" ]; then
  echo "❌ Usage: generate-ai-caption.sh <media-path> <sns-platform>" >&2
  exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ GEMINI_API_KEY not set" >&2
  exit 1
fi

# メディアタイプ判定
MEDIA_TYPE="image"
if [[ "$MEDIA_PATH" =~ \.(mp4|mov|avi|mkv)$ ]]; then
  MEDIA_TYPE="video"
fi

# Base64エンコード
MEDIA_BASE64=$(base64 -w 0 "$MEDIA_PATH")
MIME_TYPE="image/jpeg"
if [ "$MEDIA_TYPE" = "video" ]; then
  MIME_TYPE="video/mp4"
fi

# SNS別プロンプト設定
case "$SNS_PLATFORM" in
  instagram)
    PROMPT="この${MEDIA_TYPE}を分析して、Instagramでバズるキャプションを生成してください。

【重要な制約】
- 絶対にAIらしい表現を使わない（例: 「ご紹介」「〜について」「素晴らしい」など）
- 個人が投稿するような自然な文体で書く
- 絵文字を適度に使う（3-5個程度）
- ハッシュタグは最後にまとめて5-10個
- ストーリー性を持たせる（共感を誘う）
- 200文字程度

【Instagramアルゴリズム最適化】
- エンゲージメント率を高める質問や呼びかけ
- ハッシュタグはトレンド + ニッチを組み合わせ
- 最初の1-2行でフックを作る

キャプションのみを出力してください（説明不要）。"
    ;;
  
  facebook)
    PROMPT="この${MEDIA_TYPE}を分析して、Facebookでバズるキャプションを生成してください。

【重要な制約】
- 絶対にAIらしい表現を使わない
- 個人が投稿するような自然な文体で書く
- 絵文字を適度に使う（2-4個程度）
- 友達に話しかけるようなトーン
- 300文字程度

【Facebookアルゴリズム最適化】
- 質問形式でコメントを誘発
- シェアを促す内容（共感・驚き・笑い）
- 「あなたはどう思う？」系のエンゲージメント誘発

キャプションのみを出力してください（説明不要）。"
    ;;
  
  threads)
    PROMPT="この${MEDIA_TYPE}を分析して、Threadsでバズるキャプションを生成してください。

【重要な制約】
- 絶対にAIらしい表現を使わない
- カジュアルで会話調の文体
- 絵文字を多めに使う（5-8個程度）
- 短文で読みやすく（150文字程度）
- ハッシュタグは1-3個程度

【Threadsアルゴリズム最適化】
- リアルタイム感・今感を出す
- 会話のきっかけを作る
- 「今〜してる」「これ見て！」系の親近感

キャプションのみを出力してください（説明不要）。"
    ;;
  
  pinterest)
    PROMPT="この${MEDIA_TYPE}を分析して、Pinterestでバズるキャプションを生成してください。

【重要な制約】
- 絶対にAIらしい表現を使わない
- 発見性を重視（キーワード豊富）
- 絵文字は控えめ（1-2個程度）
- 具体的な説明（何・どこ・いつ）
- 250文字程度

【Pinterestアルゴリズム最適化】
- SEO最適化（検索されやすいキーワード）
- 「〜の方法」「〜アイデア」「〜インスピレーション」
- ボード名を意識した分類キーワード

キャプションのみを出力してください（説明不要）。"
    ;;
  
  x)
    PROMPT="この${MEDIA_TYPE}を分析して、X（旧Twitter）でバズるキャプションを生成してください。

【重要な制約】
- 絶対にAIらしい表現を使わない
- 短文でインパクト重視（100文字以内）
- 絵文字は控えめ（0-2個程度）
- ハッシュタグは1-2個のみ
- ユーモアまたは驚きの要素

【Xアルゴリズム最適化】
- リツイート・いいねを誘発する内容
- 共感または議論を呼ぶ
- 「これ〜すぎる」「まさか〜」系のフック

キャプションのみを出力してください（説明不要）。"
    ;;
  
  *)
    echo "❌ Unknown platform: $SNS_PLATFORM" >&2
    exit 1
    ;;
esac

# Gemini API呼び出し
RESPONSE=$(curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [
        {
          "inlineData": {
            "mimeType": "'"$MIME_TYPE"'",
            "data": "'"$MEDIA_BASE64"'"
          }
        },
        {
          "text": "'"$PROMPT"'"
        }
      ]
    }],
    "generationConfig": {
      "temperature": 0.8,
      "topK": 40,
      "topP": 0.95,
      "maxOutputTokens": 500
    }
  }')

# エラーチェック
if echo "$RESPONSE" | grep -q '"error"'; then
  echo "❌ Gemini API error:" >&2
  echo "$RESPONSE" | jq -r '.error.message' >&2
  exit 1
fi

# キャプション抽出
CAPTION=$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[0].text' 2>/dev/null || echo "")

if [ -z "$CAPTION" ]; then
  echo "❌ Failed to generate caption" >&2
  exit 1
fi

# 出力
echo "$CAPTION"
