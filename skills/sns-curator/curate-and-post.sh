#!/bin/bash
# ============================================================
# SNSコンテンツキュレーター v2
# 英語インフルエンサー監視 → 日本語コンテンツ生成 → X/LinkedIn自動投稿
#
# Usage: bash curate-and-post.sh [--dry-run] [--no-post] [--x-only] [--li-only]
#
# Options:
#   --dry-run   投稿せずに生成コンテンツを確認のみ
#   --no-post   収集・生成のみ行い投稿しない
#   --x-only    Xのみに投稿
#   --li-only   LinkedInのみに投稿
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
COOKIES_DIR="$SCRIPT_DIR/cookies"
GENERATED_DIR="$SCRIPT_DIR/generated"
TMP_DIR="/tmp/curator"
DATE=$(date +%Y-%m-%d)
DISCORD_CHANNEL="1464650064357232948"

# オプション解析
DRY_RUN=false
NO_POST=false
X_ONLY=false
LI_ONLY=false

for arg in "$@"; do
  case $arg in
    --dry-run)  DRY_RUN=true ;;
    --no-post)  NO_POST=true ;;
    --x-only)   X_ONLY=true ;;
    --li-only)  LI_ONLY=true ;;
  esac
done

export DRY_RUN

# ============================================================
# カラー出力ヘルパー
# ============================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================
# 初期化
# ============================================================
mkdir -p "$TMP_DIR" "$GENERATED_DIR" "$LIB_DIR"
OUTPUT_FILE="$GENERATED_DIR/${DATE}.json"
RAW_POSTS="$TMP_DIR/raw_posts.json"
BIRD_TMP="$TMP_DIR/bird_posts.json"
BRAVE_TMP="$TMP_DIR/brave_posts.json"
EYECATCH_PATHS="$TMP_DIR/eyecatch_paths.json"

log_info "==============================="
log_info " SNSコンテンツキュレーター v2"
log_info " 実行日時: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "==============================="

# ============================================================
# Phase 1: 情報収集
# ============================================================
log_info "=== Phase 1: 情報収集 ==="

INFLUENCERS=(
  # AI/ツール系
  "levelsio"
  "tibo_maker"
  "emollick"
  "mattshumer_"
  "rowancheung_"
  "heykahn"
  "mreflow"        # Matt Wolfe - AIツール解説
  "aiexplained_"   # AI Explained
  "dotey"          # ProductHunt founder
  # ビジネス/成功事例系
  "theSamParr"
  "AlexHormozi"
  "sahilbloom"
  "naval"
  "businessbarista"
  # インディーハッカー系
  "IndieHackers"
  "patio11"        # Patrick McKenzie - SaaS
  "jackbutcher"    # Visualize Value
)

KEYWORDS=(
  "new AI tool"
  "AI startup revenue"
  "indie hacker success"
  "solopreneur"
  "AI automation 2024"
  "build in public"
)

# 一時ファイルの初期化
echo "[]" > "$BIRD_TMP"
echo "[]" > "$BRAVE_TMP"

# ---- bird CLIで収集 ----
if command -v bird &>/dev/null && [ -n "${AUTH_TOKEN:-}" ] && [ -n "${CT0:-}" ]; then
  log_info "bird CLIを使用してインフルエンサー投稿を収集..."

  for username in "${INFLUENCERS[@]}"; do
    log_info "  取得中: @${username}"
    set +e
    BIRD_OUT=$(timeout 30 bird search "from:${username}" -n 5 --json 2>/dev/null)
    BIRD_EXIT=$?
    set -e

    if [ $BIRD_EXIT -eq 0 ] && [ -n "$BIRD_OUT" ]; then
      echo "$BIRD_OUT" | python3 "$LIB_DIR/parse-bird.py" "$username" "$BIRD_TMP"
      log_ok "    @${username}: 取得完了"
    else
      log_warn "    @${username}: 取得失敗（スキップ）"
    fi
    sleep 1
  done

  # キーワード検索
  for kw in "${KEYWORDS[@]}"; do
    log_info "  キーワード検索: \"${kw}\""
    set +e
    BIRD_KW=$(timeout 30 bird search "${kw} lang:en" -n 5 --json 2>/dev/null)
    KW_EXIT=$?
    set -e

    if [ $KW_EXIT -eq 0 ] && [ -n "$BIRD_KW" ]; then
      echo "$BIRD_KW" | python3 "$LIB_DIR/parse-bird.py" "keyword:${kw}" "$BIRD_TMP"
    fi
    sleep 1
  done

  BIRD_COUNT=$(python3 -c "import json; print(len(json.load(open('$BIRD_TMP'))))" 2>/dev/null || echo 0)
  log_ok "bird CLI収集完了: ${BIRD_COUNT}件"

else
  log_warn "bird CLIが利用不可（AUTH_TOKEN未設定またはbird未インストール）"
fi

# ---- Brave Searchで補完収集 ----
log_info "Brave Searchでウェブ情報を収集..."

if [ -n "${BRAVE_API_KEY:-}" ]; then
  SEARCH_QUERIES=(
    "AI tool startup productivity 2025 site:x.com OR site:producthunt.com"
    "indie hacker AI tool launch success revenue"
    "solopreneur AI automation revenue 2025"
    "new AI tool site:bensbites.beehiiv.com OR site:tldr.tech"
    "AI productivity tool site:producthunt.com"
    "build in public AI startup 2025"
    "AI agent automation solopreneur"
  )

  for query in "${SEARCH_QUERIES[@]}"; do
    log_info "  検索: \"${query}\""
    ENCODED_Q=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$query" 2>/dev/null || echo "${query// /+}")
    set +e
    BRAVE_OUT=$(curl -s \
      "https://api.search.brave.com/res/v1/web/search?q=${ENCODED_Q}&count=5&freshness=pw" \
      -H "Accept: application/json" \
      -H "Accept-Encoding: gzip" \
      -H "X-Subscription-Token: ${BRAVE_API_KEY}" \
      --compressed 2>/dev/null)
    BRAVE_EXIT=$?
    set -e

    if [ $BRAVE_EXIT -eq 0 ] && [ -n "$BRAVE_OUT" ]; then
      echo "$BRAVE_OUT" | python3 "$LIB_DIR/parse-brave.py" "$BRAVE_TMP"
    fi
    sleep 0.5
  done

  BRAVE_COUNT=$(python3 -c "import json; print(len(json.load(open('$BRAVE_TMP'))))" 2>/dev/null || echo 0)
  log_ok "Brave Search収集完了: ${BRAVE_COUNT}件"
else
  log_warn "BRAVE_API_KEY未設定 - Brave Searchをスキップ"
fi

# 全収集データをマージ
TIER2_TMP="$TMP_DIR/tier2_tier3.json"

# ---- Tier2/3: ニュースレター・YouTube収集（Braveとは別タイミングで実行）----
log_info "Tier2/3（ニュースレター・YouTube）を収集..."
sleep 3  # Braveレート制限回避
set +e
python3 "$SCRIPT_DIR/fetch-tier2-tier3.py" "$TIER2_TMP" 2>/dev/null
set -e
TIER2_COUNT=$(python3 -c "import json; print(len(json.load(open('$TIER2_TMP'))))" 2>/dev/null || echo 0)
log_ok "Tier2/3収集完了: ${TIER2_COUNT}件"

TOTAL_COLLECTED=$(python3 "$LIB_DIR/merge-posts.py" "$BIRD_TMP" "$BRAVE_TMP" "$RAW_POSTS" "$TIER2_TMP" 2>/dev/null || echo 0)
log_ok "収集完了: 合計 ${TOTAL_COLLECTED}件"

if [ "${TOTAL_COLLECTED}" -eq 0 ]; then
  log_warn "収集データが0件です。デモコンテンツを使用します。"
  cat > "$RAW_POSTS" << 'DEMO'
{
  "collected_at": "demo",
  "total": 3,
  "posts": [
    {
      "source": "levelsio",
      "platform": "X",
      "text": "Just crossed $100k MRR with my AI tool! Built it solo in 3 months using GPT-4 API. The key was validating with 10 paying customers before building the full product.",
      "url": "https://x.com/levelsio"
    },
    {
      "source": "tibo_maker",
      "platform": "X",
      "text": "New AI tool drops: This week's top 5 AI productivity tools that actually save time. My favorite is the one that automates email replies using your own writing style.",
      "url": "https://x.com/tibo_maker"
    },
    {
      "source": "emollick",
      "platform": "X",
      "text": "Research finding: People who use AI tools daily for 3 months see 40% productivity gains. But the top 10% of users see 3x productivity gains. The difference is how they prompt.",
      "url": "https://x.com/emollick"
    }
  ]
}
DEMO
  TOTAL_COLLECTED=3
fi

# ============================================================
# Phase 2: コンテンツ生成（AI）
# ============================================================
log_info "=== Phase 2: 日本語コンテンツ生成 ==="

# プロンプト用テキスト生成
python3 - "$RAW_POSTS" > "$TMP_DIR/raw_posts_text.txt" << 'PYEOF'
import json, sys

data = json.load(open(sys.argv[1]))
posts = data.get('posts', [])[:15]
output = []
for i, p in enumerate(posts, 1):
    output.append(f"[{i}] Source: {p.get('source','?')}\nText: {p.get('text','')}\nURL: {p.get('url','')}")
print('\n\n'.join(output))
PYEOF

RAW_POSTS_TEXT=$(cat "$TMP_DIR/raw_posts_text.txt")

# プロンプトをファイルに保存（ヒアドキュメントで特殊文字を安全に処理）
{
cat << 'HEADER'
あなたはSNSコンテンツキュレーターです。
以下の英語圏インフルエンサー・AIスタートアップの投稿から、
日本の個人開発者・フリーランス・起業志望者・AI興味者に価値のある情報を3件選び、
日本語の投稿文を生成してください。

【収集した投稿】
HEADER
echo "$RAW_POSTS_TEXT"
cat << 'FOOTER'

【生成ルール】
- 3件を選ぶ（最も実用的・インパクトのあるもの）
- 各件について X用（280文字以内）と LinkedIn用（長文）の2バージョン
- フォーマットは厳守（下記参照）

【X用フォーマット（必ず280文字以内）】
🔥 [インパクトある1行タイトル]

[解説 2-3行]

→ [日本の個人開発者/起業家への応用例]

#AI活用 #個人開発 #ソロ起業

【LinkedIn用フォーマット】
[ストーリー性のある冒頭1-2行]

[海外事例の詳細解説 3-5行]

日本での応用ポイント:
・[ポイント1]
・[ポイント2]
・[ポイント3]

[締めくくり + 問いかけ]

#AI活用 #個人開発 #スタートアップ #ソロ起業 #AIツール

【出力形式】（JSONで出力。posts配列のみ）
{
  "posts": [
    {
      "source": "元の投稿者ユーザー名",
      "original_text": "元の英語テキスト（要約）",
      "url": "元のツイートURL（https://x.com/username/status/xxxから収集した場合はそのURL）",
      "title": "投稿タイトル（アイキャッチ画像用・20文字以内）",
      "points": ["ポイント1（30文字以内）", "ポイント2（30文字以内）", "ポイント3（30文字以内）"],
      "x_post": "X用投稿文（280文字以内）",
      "linkedin_post": "LinkedIn用投稿文"
    }
  ]
}
FOOTER
} > "$TMP_DIR/prompt.txt"

log_info "プロンプト作成完了 ($(wc -c < "$TMP_DIR/prompt.txt") bytes)"

# Gemini APIリクエスト生成
python3 - "$TMP_DIR/prompt.txt" "$TMP_DIR/gemini_request.json" << 'PYEOF'
import json, sys

prompt = open(sys.argv[1]).read()
request = {
    'contents': [{'parts': [{'text': prompt}]}],
    'generationConfig': {
        'temperature': 0.7,
        'maxOutputTokens': 4096,
        'responseMimeType': 'application/json'
    }
}
with open(sys.argv[2], 'w') as f:
    json.dump(request, f)
PYEOF

# Gemini APIで生成
GENERATED_JSON=""

if [ -n "${GEMINI_API_KEY:-}" ]; then
  log_info "Gemini APIでコンテンツ生成中..."

  set +e
  GEMINI_RESPONSE=$(curl -s \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d @"$TMP_DIR/gemini_request.json" \
    --max-time 60 2>/dev/null)
  GEMINI_EXIT=$?
  set -e

  if [ $GEMINI_EXIT -eq 0 ] && [ -n "$GEMINI_RESPONSE" ]; then
    GENERATED_JSON=$(echo "$GEMINI_RESPONSE" | python3 "$LIB_DIR/parse-gemini.py" 2>"$TMP_DIR/gemini_error.txt" || true)
    if [ -n "$GENERATED_JSON" ]; then
      log_ok "Gemini APIでコンテンツ生成完了"
    else
      GEMINI_ERR=$(cat "$TMP_DIR/gemini_error.txt" 2>/dev/null || echo "unknown error")
      log_warn "Gemini APIのレスポンスのパースに失敗: ${GEMINI_ERR}"
    fi
  else
    log_warn "Gemini API呼び出し失敗 (exit: $GEMINI_EXIT)"
  fi
fi

# フォールバック
if [ -z "$GENERATED_JSON" ]; then
  log_warn "AIAPIが利用不可またはエラー - デモコンテンツを使用"
  GENERATED_JSON='{"posts":[{"source":"levelsio","original_text":"Just crossed $100k MRR with AI tool built solo in 3 months","title":"AIソロ開発で月100万円","points":["10人の有料ユーザーで先に検証","GPT-4 APIで3ヶ月で構築","完璧より速さを優先"],"x_post":"🔥 ソロで3ヶ月、月収100万円超えのAIツール\n\n@levelsioが「10人の有料ユーザーで検証してから本格開発」という手法でAIツールを$100k MRR達成。\n\n→ MVPは10人から。完璧より速さを選ぼう\n\n#AI活用 #個人開発 #ソロ起業","linkedin_post":"「3ヶ月で月収1000万円超え」 ソロ開発者の戦略を解剖\n\n@levelsioが、AIツールで$100k MRR（月約1500万円）を達成しました。\n\n彼の手法:\n・まず10人の有料ユーザーを獲得\n・実際にお金を払う人の声で製品を磨く\n・GPT-4 APIで3ヶ月で構築\n・完璧を求めず、速くリリース\n\n日本での応用ポイント:\n・完璧なプロダクトより、早い検証が重要\n・AIツールはコストが下がり、参入障壁が低下\n・ニッチな課題解決でも十分なMRRが狙える\n\n「いつか起業したい」ではなく、今すぐ10人を見つけることから始めませんか？\n\n#AI活用 #個人開発 #スタートアップ #ソロ起業 #AIツール"}]}'
fi

# ============================================================
# Phase 3: 結果保存
# ============================================================
log_info "=== Phase 3: 生成コンテンツ保存 ==="

echo "$GENERATED_JSON" | python3 "$LIB_DIR/save-output.py" "$OUTPUT_FILE" "$RAW_POSTS"

POST_COUNT=$(python3 -c "import json; d=json.load(open('$OUTPUT_FILE')); print(len(d.get('generated_posts',[])))" 2>/dev/null || echo 0)
log_ok "保存完了: $OUTPUT_FILE (${POST_COUNT}件)"

# ============================================================
# Phase 3.5: アイキャッチ画像生成
# ============================================================
log_info "=== Phase 3.5: アイキャッチ画像生成 ==="

EYECATCH_SCRIPT="$SCRIPT_DIR/generate-eyecatch.py"
echo "[]" > "$EYECATCH_PATHS"

if [ -f "$EYECATCH_SCRIPT" ]; then
  python3 "$LIB_DIR/generate-images.py" "$OUTPUT_FILE" "$EYECATCH_SCRIPT" "$EYECATCH_PATHS"
  EYECATCH_COUNT=$(python3 -c "import json; print(len(json.load(open('$EYECATCH_PATHS'))))" 2>/dev/null || echo 0)
  log_ok "アイキャッチ画像生成完了: ${EYECATCH_COUNT}枚"
else
  log_warn "generate-eyecatch.py が見つかりません - 画像生成スキップ"
  EYECATCH_COUNT=0
fi

# ============================================================
# Phase 4: 投稿実行
# ============================================================
if [ "$NO_POST" = true ]; then
  log_info "=== --no-post オプション: 投稿スキップ ==="
else
  log_info "=== Phase 4: SNS投稿 ==="
  python3 "$LIB_DIR/post-all.py" \
    "$OUTPUT_FILE" \
    "$SCRIPT_DIR" \
    "$X_ONLY" \
    "$LI_ONLY" \
    "$EYECATCH_PATHS"
fi

# ============================================================
# Phase 5: Discord報告
# ============================================================
log_info "=== Phase 5: Discord報告 ==="

SUMMARY=$(python3 - "$OUTPUT_FILE" << 'PYEOF'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    posts = d.get('generated_posts', [])
    lines = []
    for i, p in enumerate(posts, 1):
        x = p.get('x_post', '')[:100].replace('\n', ' ')
        lines.append(f'**{i}.** {x}...')
    print('\n'.join(lines) if lines else '（生成なし）')
except Exception as e:
    print(f'（サマリー生成エラー: {e}）')
PYEOF
)

EYECATCH_COUNT=$(python3 -c "import json; print(len(json.load(open('$EYECATCH_PATHS'))))" 2>/dev/null || echo 0)

DRY_RUN_NOTE=""
[ "$DRY_RUN" = true ] && DRY_RUN_NOTE=" [DRY RUN]"
NO_POST_NOTE=""
[ "$NO_POST" = true ] && NO_POST_NOTE=" [投稿なし]"

DISCORD_MSG="📰 **SNSコンテンツキュレーター 実行完了**${DRY_RUN_NOTE}${NO_POST_NOTE}

📅 日時: $(date '+%Y-%m-%d %H:%M') JST
📊 収集: ${TOTAL_COLLECTED}件 → 生成: ${POST_COUNT}件
🖼️ アイキャッチ画像: ${EYECATCH_COUNT}枚

**今日の投稿コンテンツ:**
${SUMMARY}

📁 詳細: \`${OUTPUT_FILE}\`"

# Discord通知は無効化（andoさんリクエスト 2026-02-17）
# if command -v clawdbot &>/dev/null; then
#   set +e
#   clawdbot message send --channel discord --target "$DISCORD_CHANNEL" --message "$DISCORD_MSG" 2>/dev/null
#   [ $? -eq 0 ] && log_ok "Discord報告完了" || log_warn "Discord報告失敗（続行）"
#   set -e
# else
#   log_warn "clawdbot CLIが見つかりません - Discord報告スキップ"
# fi
log_ok "Discord通知スキップ（無効化済み）"

log_ok "==============================="
log_ok " 全処理完了！"
log_ok " 生成ファイル: $OUTPUT_FILE"
log_ok "==============================="
