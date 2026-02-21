#!/bin/bash
# analyze-sns-performance.sh
# SNS投稿データをPDCA分析してDiscordにレポート送信
# Usage: bash analyze-sns-performance.sh [--force]
# --force: 7投稿未満でも実行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
POSTS_DIR="/root/clawd/data/sns-posts"
PERF_DIR="/root/clawd/data/sns-performance"
REPORT_DIR="/root/clawd/data/reports"
DATE_STR=$(date '+%Y%m%d')
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

FORCE_RUN=false
[ "${1:-}" = "--force" ] && FORCE_RUN=true

mkdir -p "$REPORT_DIR"

echo "📊 SNS PDCA分析開始..."
echo "📅 日付: $DATE_STR"

# 投稿データ確認
POST_COUNT=$(ls "$POSTS_DIR"/*.json 2>/dev/null | wc -l || echo "0")
echo "📝 投稿記録数: $POST_COUNT"

# 7投稿未満なら警告（--forceで強制実行可能）
if [ "$POST_COUNT" -lt 7 ] && [ "$FORCE_RUN" = "false" ]; then
  echo "⚠️ 投稿データが7件未満です ($POST_COUNT件)。分析には最低7投稿のデータが必要です。"
  echo "   強制実行: bash analyze-sns-performance.sh --force"
  
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "⚠️ **PDCA分析スキップ** | データ不足
📝 現在の投稿記録: ${POST_COUNT}件（最低7件必要）
💡 あと$((7 - POST_COUNT))件投稿が溜まると分析開始します。" 2>/dev/null || true
  
  exit 0
fi

echo "🤖 データ集計中..."

# Python でデータ集計・分析
ANALYSIS_DATA=$(python3 << 'PYEOF'
import json
import glob
import os
import re
from datetime import datetime, timezone
from collections import defaultdict

posts_dir = os.environ.get('POSTS_DIR', '/root/clawd/data/sns-posts')
perf_dir = os.environ.get('PERF_DIR', '/root/clawd/data/sns-performance')

# 全投稿データ読み込み
posts = []
for f in sorted(glob.glob(f"{posts_dir}/*.json")):
    try:
        with open(f) as fp:
            data = json.load(fp)
            posts.append(data)
    except Exception as e:
        print(f"# エラー: {f}: {e}", flush=True)

print(f"# 投稿数: {len(posts)}", flush=True)

if not posts:
    print(json.dumps({"error": "投稿データなし", "posts": []}))
    exit()

# パフォーマンスデータを持つ投稿のみフィルタ
posts_with_perf = [p for p in posts if p.get('performance', {}).get('instagram', {}).get('likes', 0) > 0]

# いいね数でソート
sorted_by_likes = sorted(posts, key=lambda p: p.get('performance', {}).get('instagram', {}).get('likes', 0), reverse=True)

# 上位3・下位3
top3 = sorted_by_likes[:3]
bottom3 = sorted_by_likes[-3:] if len(sorted_by_likes) >= 3 else sorted_by_likes

# ハッシュタグ分析
hashtag_perf = defaultdict(list)
for post in posts:
    likes = post.get('performance', {}).get('instagram', {}).get('likes', 0)
    for tag in post.get('hashtags', []):
        hashtag_perf[tag].append(likes)

# ハッシュタグ平均いいね数
hashtag_avg = {tag: sum(likes)/len(likes) for tag, likes in hashtag_perf.items() if likes}
best_hashtags = sorted(hashtag_avg.items(), key=lambda x: x[1], reverse=True)[:10]

# 投稿時間帯分析
hour_perf = defaultdict(list)
for post in posts:
    ts = post.get('timestamp', '')
    if ts:
        try:
            dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            hour_jst = (dt.hour + 9) % 24
            likes = post.get('performance', {}).get('instagram', {}).get('likes', 0)
            hour_perf[hour_jst].append(likes)
        except:
            pass

hour_avg = {h: sum(l)/len(l) for h, l in hour_perf.items() if l}
best_hours = sorted(hour_avg.items(), key=lambda x: x[1], reverse=True)[:3]

# キャプション長分析
caption_perf = []
for post in posts:
    caption = post.get('caption', '')
    likes = post.get('performance', {}).get('instagram', {}).get('likes', 0)
    emoji_count = len(re.findall(r'[\U0001F000-\U0001FFFF\U0000200D\U00002600-\U000026FF\U00002700-\U000027BF]', caption))
    caption_perf.append({
        'length': len(caption),
        'emoji_count': emoji_count,
        'likes': likes
    })

# 平均統計
all_ig_likes = [p.get('performance', {}).get('instagram', {}).get('likes', 0) for p in posts]
all_x_likes = [p.get('performance', {}).get('x', {}).get('likes', 0) for p in posts]
all_pin_saves = [p.get('performance', {}).get('pinterest', {}).get('saves', 0) for p in posts]

avg_ig_likes = int(sum(all_ig_likes)/len(all_ig_likes)) if all_ig_likes else 0
avg_x_likes = int(sum(all_x_likes)/len(all_x_likes)) if all_x_likes else 0
avg_pin_saves = int(sum(all_pin_saves)/len(all_pin_saves)) if all_pin_saves else 0

# 結果出力
result = {
    "total_posts": len(posts),
    "posts_with_data": len(posts_with_perf),
    "top3": [
        {
            "post_id": p.get("post_id", ""),
            "likes": p.get("performance", {}).get("instagram", {}).get("likes", 0),
            "caption_preview": p.get("caption", "")[:80],
            "timestamp": p.get("timestamp", ""),
            "hashtags": p.get("hashtags", [])[:5]
        }
        for p in top3
    ],
    "bottom3": [
        {
            "post_id": p.get("post_id", ""),
            "likes": p.get("performance", {}).get("instagram", {}).get("likes", 0),
            "caption_preview": p.get("caption", "")[:80]
        }
        for p in bottom3
    ],
    "best_hashtags": [{"tag": t, "avg_likes": round(avg, 1)} for t, avg in best_hashtags],
    "best_posting_hours_jst": [{"hour": h, "avg_likes": round(avg, 1)} for h, avg in best_hours],
    "caption_analysis": {
        "avg_length": int(sum(c['length'] for c in caption_perf)/len(caption_perf)) if caption_perf else 0,
        "avg_emoji": round(sum(c['emoji_count'] for c in caption_perf)/len(caption_perf), 1) if caption_perf else 0
    },
    "averages": {
        "instagram_likes": avg_ig_likes,
        "x_likes": avg_x_likes,
        "pinterest_saves": avg_pin_saves
    }
}

print(json.dumps(result, ensure_ascii=False, indent=2))
PYEOF
) || ANALYSIS_DATA="{}"

export POSTS_DIR PERF_DIR

# 分析データをClaudeに渡してレポート生成
echo "🤖 Claude によるレポート生成中..."

REPORT_PROMPT="あなたはSNSマーケターです。以下のInstagram・X・Pinterest投稿分析データをもとに、来週の改善提案を含む週次PDCAレポートを作成してください。

アカウント: nisen_prints（浮世絵アートのInstagramアカウント）

## 分析データ:
$ANALYSIS_DATA

## レポート形式（必ずこのフォーマット）:
📊 SNS成長レポート
━━━━━━━━━━━━━━━━

【今週のハイライト】
🏆 最高パフォーマンス投稿: [投稿IDと内容] → いいね [N]個

【SNS別パフォーマンス】
📸 Instagram: 平均[N]いいね
🐦 X: 平均[N]いいね
📌 Pinterest: 平均[N]保存

【バズった投稿のパターン】
✅ [データから見つけたパターン1]
✅ [データから見つけたパターン2]
✅ [データから見つけたパターン3]

【伸びるハッシュタグ TOP5】
1. [タグ] → 平均[N]いいね
2. [タグ] → 平均[N]いいね
3. [タグ] → 平均[N]いいね
4. [タグ] → 平均[N]いいね
5. [タグ] → 平均[N]いいね

【ベスト投稿時間帯 (JST)】
🕐 [時間帯] → 平均[N]いいね

【来週の改善提案】
💡 [具体的な改善提案1]
💡 [具体的な改善提案2]
💡 [具体的な改善提案3]

【今週試すべきこと (Plan)】
→ [具体的なアクション1]
→ [具体的なアクション2]

※データが少ない項目は「データ蓄積中」と記載してください。"

# clawdbot agentでレポート生成
REPORT=$(clawdbot agent --message "$REPORT_PROMPT" --thinking low 2>&1) || REPORT=""

# レポートが空の場合はデフォルト生成
if [ -z "$REPORT" ]; then
  # Python でデフォルトレポート生成
  REPORT=$(python3 << PYEOF
import json

try:
    data = json.loads('''$ANALYSIS_DATA''')
except:
    data = {}

top3 = data.get('top3', [])
avgs = data.get('averages', {})
best_tags = data.get('best_hashtags', [])
best_hours = data.get('best_posting_hours_jst', [])

top_post = top3[0] if top3 else {}
top_likes = top_post.get('likes', 0)
top_id = top_post.get('post_id', 'なし')

ig_avg = avgs.get('instagram_likes', 0)
x_avg = avgs.get('x_likes', 0)
pin_avg = avgs.get('pinterest_saves', 0)

tags_str = ""
for i, t in enumerate(best_tags[:5], 1):
    tags_str += f"{i}. {t['tag']} → 平均{t['avg_likes']}いいね\n"

hours_str = ""
for h in best_hours[:2]:
    hours_str += f"🕐 {h['hour']}時台 → 平均{h['avg_likes']}いいね\n"

report = f"""📊 SNS成長レポート
━━━━━━━━━━━━━━━━

【今週のハイライト】
🏆 最高パフォーマンス投稿: {top_id} → いいね {top_likes}個

【SNS別パフォーマンス】
📸 Instagram: 平均{ig_avg}いいね
🐦 X: 平均{x_avg}いいね
📌 Pinterest: 平均{pin_avg}保存

【バズった投稿のパターン】
✅ いいね数の多い投稿の共通パターンを分析中
✅ ハッシュタグの効果を計測中
✅ 投稿時間帯の最適化データ収集中

【伸びるハッシュタグ TOP5】
{tags_str if tags_str else "データ蓄積中..."}

【ベスト投稿時間帯 (JST)】
{hours_str if hours_str else "データ蓄積中..."}

【来週の改善提案】
💡 エモーショナル系キャプションを優先（いいね保存に効果的）
💡 投稿時間を分析結果のベスト時間帯に揃える
💡 人気ハッシュタグを毎投稿に3〜5個含める

【今週試すべきこと (Plan)】
→ キャプションの日英両方の長さを統一する
→ 絵の描写に加えて、作品の時代背景を1行追加する"""

print(report)
PYEOF
)
fi

# レポートをファイルに保存
REPORT_FILE="$REPORT_DIR/weekly_report_${DATE_STR}.txt"
{
  echo "# SNS週次分析レポート"
  echo "# 生成日時: $(date '+%Y-%m-%d %H:%M:%S JST')"
  echo ""
  echo "$REPORT"
  echo ""
  echo "---"
  echo "# 生データ:"
  echo "$ANALYSIS_DATA"
} > "$REPORT_FILE"

echo "💾 レポート保存: $REPORT_FILE"

# Discordにレポート送信
# 2000文字制限に対応して分割送信
REPORT_LEN=${#REPORT}

if [ $REPORT_LEN -le 1800 ]; then
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "$REPORT" 2>/dev/null || true
else
  # 分割送信
  echo "$REPORT" | head -50 | clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "$(cat)" 2>/dev/null || true
fi

# フッター送信
clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "📁 レポート保存先: \`$REPORT_FILE\`
📊 分析対象: ${POST_COUNT}件の投稿" 2>/dev/null || true

echo ""
echo "✅ PDCA分析レポート完了"
echo "📁 保存先: $REPORT_FILE"
