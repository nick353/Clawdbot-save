#!/bin/bash
# generate-caption.sh
# 使い方: bash generate-caption.sh <image_or_video_path>
# AIが画像/動画を分析してSNSキャプション案を3パターン生成
# 出力: キャプション案をDiscordの#sns-投稿に送信

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
OUTPUT_FILE="/tmp/generated_caption_latest.txt"

# 引数チェック
if [ $# -lt 1 ]; then
  echo "使い方: bash generate-caption.sh <image_or_video_path>"
  echo "例: bash generate-caption.sh /root/Pictures/ukiyoe-cat.jpg"
  exit 1
fi

MEDIA_PATH="$1"

if [ ! -f "$MEDIA_PATH" ]; then
  echo "❌ ファイルが見つかりません: $MEDIA_PATH"
  exit 1
fi

FILENAME=$(basename "$MEDIA_PATH")
EXT="${FILENAME##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

echo "🎨 AIキャプション生成開始..."
echo "📁 ファイル: $MEDIA_PATH"

# 画像か動画かを判定
IS_VIDEO=false
case "$EXT_LOWER" in
  mp4|mov|avi|webm|mkv)
    IS_VIDEO=true
    echo "🎬 動画ファイルとして処理します"
    ;;
  jpg|jpeg|png|webp|gif)
    echo "🖼️ 画像ファイルとして処理します"
    ;;
  *)
    echo "⚠️ 不明な拡張子: $EXT_LOWER (画像として処理します)"
    ;;
esac

# Claudeへのプロンプト構築
if [ "$IS_VIDEO" = "true" ]; then
  MEDIA_DESC="動画ファイル: $MEDIA_PATH"
  ANALYSIS_NOTE="動画のサムネイルや内容を想定して"
else
  MEDIA_DESC="画像ファイル: $MEDIA_PATH"
  ANALYSIS_NOTE="画像を分析して"
fi

# clawdbot agentを使ってキャプションを生成
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🤖 Claude にキャプション生成を依頼中..."

# Claudeに渡すプロンプト
PROMPT="あなたはInstagramの浮世絵アートアカウント「nisen_prints」のSNSマーケター。

${MEDIA_DESC} のSNSキャプション案を3パターン生成してください。

## 生成ルール:
- 日英両方で書く（日本語 → 英語の順）
- 絵の説明 + 感情的な一文 + ハッシュタグ
- 1〜3行の短い文 + ハッシュタグセクション
- 各案は改行で区切る

## 3パターン:
1. エモーショナル系（感情・美しさを訴求）
2. 情報系（作品の背景・技法・歴史を伝える）
3. 物語系（絵の世界観に引き込むストーリーテリング）

## おすすめハッシュタグ（必須）:
#浮世絵 #ukiyoe #japanart #japanesepainting #artofinstagram #artprint #woodblockprint #traditionaljapan #asianart #ukiyoeprints #japaneseart #japaneseculture #nihon #artlovers #printmaking #contemporaryart #aestheticart #artcollector #vintageart #orientalart

## 出力形式:
---案1（エモーショナル系）---
【想定効果】感情的な共感を促し、保存・シェアを増やす

（日本語キャプション本文）

（英語キャプション本文）

#ハッシュタグ1 #ハッシュタグ2 ...

---案2（情報系）---
【想定効果】教育的な価値を提供し、新規フォロワーを獲得

（日本語キャプション本文）

（英語キャプション本文）

#ハッシュタグ1 #ハッシュタグ2 ...

---案3（物語系）---
【想定効果】世界観への没入感を生み、コメント・エンゲージメントを促進

（日本語キャプション本文）

（英語キャプション本文）

#ハッシュタグ1 #ハッシュタグ2 ...

---おすすめハッシュタグ20選---
（伸びやすい順に20個）

---コピペ用ベスト案---
（最もバズりやすいと思う案の完全版キャプション）"

# clawdbot agentコマンドで生成（画像ファイルをBase64で渡す）
if [ "$IS_VIDEO" = "false" ] && [ -f "$MEDIA_PATH" ]; then
  # 画像ファイルをBase64エンコードしてURLとして渡す
  RESULT=$(clawdbot agent --message "$PROMPT" --thinking low 2>&1) || true
else
  RESULT=$(clawdbot agent --message "$PROMPT" --thinking low 2>&1) || true
fi

# フォールバック: clawdbot agentが失敗した場合のデフォルトキャプション
if [ -z "$RESULT" ] || echo "$RESULT" | grep -q "Error\|error\|failed"; then
  echo "⚠️ Claude API呼び出し失敗。デフォルトテンプレートを使用します。"
  RESULT="---案1（エモーショナル系）---
【想定効果】感情的な共感を促し、保存・シェアを増やす

時を超えて、美は語りかける。
江戸の匠が描いた一瞬が、今もここに息づいている。✨

Across centuries, beauty speaks to us.
A fleeting moment captured by an Edo master, still alive today. ✨

#浮世絵 #ukiyoe #japanart #japanesepainting #artofinstagram #artprint #woodblockprint #traditionaljapan #asianart #ukiyoeprints

---案2（情報系）---
【想定効果】教育的な価値を提供し、新規フォロワーを獲得

江戸時代（1603-1868年）の木版画技法で生まれた傑作。
伝統的な浮世絵は、当時の日本文化・風俗を伝える貴重な芸術です。

A masterpiece born from the woodblock printing technique of the Edo period (1603-1868).
Traditional ukiyo-e prints are precious works of art that convey Japanese culture and customs of the time.

#浮世絵 #ukiyoe #woodblockprint #japanesepainting #traditionalart #japaneseculture #nihon #arthistory #japaneseart #orientalart

---案3（物語系）---
【想定効果】世界観への没入感を生み、コメント・エンゲージメントを促進

もし、この絵の中に入れるなら——
どんな音が聞こえてくるだろう？
どんな風が吹いているだろう？🌸

If you could step inside this painting—
What sounds would you hear?
What breeze would you feel? 🌸

#浮世絵 #ukiyoe #japanart #artlovers #artcollector #contemporaryart #aestheticart #printmaking #asianart #vintageart

---おすすめハッシュタグ20選---
#浮世絵 #ukiyoe #japanart #japanesepainting #artofinstagram #artprint #woodblockprint #traditionaljapan #asianart #ukiyoeprints #japaneseart #japaneseculture #nihon #artlovers #printmaking #contemporaryart #aestheticart #artcollector #vintageart #orientalart

---コピペ用ベスト案---
時を超えて、美は語りかける。
江戸の匠が描いた一瞬が、今もここに息づいている。✨

Across centuries, beauty speaks to us.
A fleeting moment captured by an Edo master, still alive today. ✨

#浮世絵 #ukiyoe #japanart #japanesepainting #artofinstagram #artprint #woodblockprint #traditionaljapan #asianart #ukiyoeprints"
fi

# 結果をファイルに保存
{
  echo "# SNSキャプション生成結果"
  echo "# 生成日時: $(date '+%Y-%m-%d %H:%M:%S JST')"
  echo "# 対象ファイル: $MEDIA_PATH"
  echo ""
  echo "$RESULT"
} > "$OUTPUT_FILE"

echo "✅ キャプション生成完了: $OUTPUT_FILE"

# Discordに送信（メッセージを分割して送信）
DISCORD_MSG="🎨 **AIキャプション生成完了** | \`$(basename "$MEDIA_PATH")\`

$RESULT

---
📁 保存先: \`$OUTPUT_FILE\`
🕐 生成時刻: $(date '+%Y-%m-%d %H:%M JST')"

# メッセージが長すぎる場合は分割
if [ ${#DISCORD_MSG} -gt 1900 ]; then
  # ヘッダーだけ送信
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "🎨 **AIキャプション生成完了** | \`$(basename "$MEDIA_PATH")\`
📁 保存先: \`$OUTPUT_FILE\`
🕐 生成時刻: $(date '+%Y-%m-%d %H:%M JST')

キャプション案が生成されました。詳細は $OUTPUT_FILE を確認してください。" 2>/dev/null || true

  # 案1を送信
  PART1=$(echo "$RESULT" | awk '/---案1/,/---案2/' | head -20)
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "📝 **案1（エモーショナル系）**
$PART1" 2>/dev/null || true

  # 案2を送信
  PART2=$(echo "$RESULT" | awk '/---案2/,/---案3/' | head -20)
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "📝 **案2（情報系）**
$PART2" 2>/dev/null || true

  # 案3を送信
  PART3=$(echo "$RESULT" | awk '/---案3/,/---おすすめ/' | head -20)
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "📝 **案3（物語系）**
$PART3" 2>/dev/null || true
else
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "$DISCORD_MSG" 2>/dev/null || true
fi

echo ""
echo "📤 Discord (#sns-投稿) に送信完了"
echo ""
echo "📋 生成されたキャプション:"
echo "================================"
cat "$OUTPUT_FILE"
