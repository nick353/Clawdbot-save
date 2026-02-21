#!/bin/bash
# ================================================================
# AI×個人開発 コンテンツ自動投稿パイプライン v1.0
# 英語インフルエンサー監視 → 要約・翻訳 → X/LinkedIn投稿文生成 → Discord通知
# ================================================================

set -uo pipefail

# ── 設定 ──────────────────────────────────────────────────────────
TODAY=$(date +%Y-%m-%d)
TEMP_DIR="/tmp/content-pipeline-$$"
LOG_DIR="/root/clawd/logs"
LOG_FILE="${LOG_DIR}/content-pipeline.log"
DISCORD_CHANNEL="1464650064357232948"

# 監視対象アカウント（Tier 1）
ACCOUNTS=(
  "levelsio"
  "tibo_maker"
  "emollick"
  "mattshumer_"
  "rowancheung_"
  "heykahn"
  "businessbarista"
  "theSamParr"
  "AlexHormozi"
  "sahilbloom"
)

mkdir -p "$TEMP_DIR" "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1

log() { echo "[$(date '+%H:%M:%S')] $*"; }
log "=== コンテンツパイプライン開始: $TODAY ==="

# ── 環境変数の読み込み ─────────────────────────────────────────────
CONFIG_FILE="/root/.clawdbot/clawdbot.json"

AUTH_TOKEN=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('env',{}).get('vars',{}).get('AUTH_TOKEN',''))" 2>/dev/null || echo "")
CT0=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('env',{}).get('vars',{}).get('CT0',''))" 2>/dev/null || echo "")
GEMINI_API_KEY=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('env',{}).get('vars',{}).get('GEMINI_API_KEY',''))" 2>/dev/null || echo "")
export AUTH_TOKEN CT0 GEMINI_API_KEY

if [[ -z "$AUTH_TOKEN" || -z "$CT0" ]]; then
  log "❌ ERROR: AUTH_TOKEN / CT0 が未設定です"
  exit 1
fi
if [[ -z "$GEMINI_API_KEY" ]]; then
  log "❌ ERROR: GEMINI_API_KEY が未設定です"
  exit 1
fi

# ── Phase 1: ツイート取得 ─────────────────────────────────────────
log "--- Phase 1: ツイート取得 ---"

TWEETS_JSONL="$TEMP_DIR/tweets.jsonl"
> "$TWEETS_JSONL"

for account in "${ACCOUNTS[@]}"; do
  log "  取得中: @$account"
  
  raw=$(bird search "from:$account" -n 10 --json 2>/dev/null || echo "[]")
  
  # URLを含むツイートのみ抽出してJSONLに書き込む
  echo "$raw" | python3 -c "
import json, sys, re

data = sys.stdin.read().strip()
try:
    tweets = json.loads(data)
except:
    tweets = []

url_pattern = re.compile(r'https?://\S+')
account = '$account'

for t in tweets:
    if not isinstance(t, dict):
        continue
    text = t.get('text', '')
    # URLが含まれるかチェック（リプライのURLも対象）
    if url_pattern.search(text):
        t['_account'] = account
        t['_tweet_url'] = f\"https://twitter.com/{account}/status/{t.get('id', '')}\"
        t['_engagement'] = (
            t.get('likeCount', 0) +
            t.get('retweetCount', 0) * 3 +
            t.get('replyCount', 0) * 2
        )
        print(json.dumps(t, ensure_ascii=False))
" >> "$TWEETS_JSONL" 2>/dev/null || true
  
  sleep 1
done

TWEET_COUNT=$(wc -l < "$TWEETS_JSONL" 2>/dev/null || echo "0")
log "  URL付きツイート取得数: ${TWEET_COUNT}件"

# JSONLをJSONに変換・エンゲージメント順にソート
TWEETS_JSON="$TEMP_DIR/tweets_sorted.json"
python3 -c "
import json, sys
lines = open('$TWEETS_JSONL').readlines()
tweets = []
for l in lines:
    l = l.strip()
    if l:
        try:
            tweets.append(json.loads(l))
        except:
            pass
tweets.sort(key=lambda x: x.get('_engagement', 0), reverse=True)
print(json.dumps(tweets, ensure_ascii=False, indent=2))
" > "$TWEETS_JSON" 2>/dev/null || echo "[]" > "$TWEETS_JSON"

# ── ツイート要約テキスト生成 ─────────────────────────────────────
SUMMARY_FILE="$TEMP_DIR/tweets_summary.txt"
python3 -c "
import json, re

tweets = json.load(open('$TWEETS_JSON'))
lines = []
for i, t in enumerate(tweets[:20]):
    text = t.get('text','')[:250]
    user = t.get('_account','')
    likes = t.get('likeCount', 0)
    rt = t.get('retweetCount', 0)
    tweet_url = t.get('_tweet_url', '')
    urls = re.findall(r'https?://\S+', t.get('text',''))
    ext_url = next((u for u in urls if 'twitter.com' not in u and 't.co' not in u), urls[0] if urls else tweet_url)
    lines.append(f'[{i+1}] @{user} (👍{likes} 🔁{rt}): {text} | 参照URL: {ext_url}')

print('\n'.join(lines))
" > "$SUMMARY_FILE" 2>/dev/null

SUMMARY_TEXT=$(cat "$SUMMARY_FILE" 2>/dev/null || echo "（ツイートなし）")

# ── Phase 2: Gemini でコンテンツ選定＆投稿文生成 ──────────────────────
log "--- Phase 2: AI投稿文生成 ---"

PROMPT_FILE="$TEMP_DIR/prompt.txt"
RESPONSE_FILE="$TEMP_DIR/gemini_response.json"

cat > "$PROMPT_FILE" << 'PROMPT_EOF'
あなたは「AI×個人開発」をテーマに日本の個人開発者・起業家向けに情報発信するキュレーター（andoさん）です。

以下は英語インフルエンサーの最新ツイート一覧です（エンゲージメント順）:
PROMPT_EOF

cat "$SUMMARY_FILE" >> "$PROMPT_FILE"

cat >> "$PROMPT_FILE" << 'PROMPT_EOF'

【タスク】
1. 上記から「AI活用度」「ビジネス価値」「個人開発者への有用性」が高い上位3件を選んでください
2. 各コンテンツについて、日本の個人開発者・起業家向けに2種類の投稿文を生成してください

【選定基準（優先順）】
- AI/ツールの紹介・具体的な活用事例
- 個人で再現できるビジネス手法・成功事例
- 具体的な数字・成果があるもの
- 単なる返信・議論・ミームは除外
- ツイートの内容が薄い場合はAI活用の汎用コンテンツで補完してOK

【出力（JSONのみ・余分な文章なし）】
{
  "picks": [
    {
      "rank": 1,
      "title": "タイトル（日本語・30文字以内）",
      "source_account": "@ユーザー名",
      "source_url": "URL",
      "summary": "要約（日本語・100文字以内）",
      "tweet_post": "🔥 フック行（数字or意外性）\n\n• ポイント1\n• ポイント2\n• ポイント3\n\n💡 個人開発者・起業家へのポイント：\n価値提案（1〜2行）\n\n詳細・AIコミュニティはDiscordで▼\nURL",
      "linkedin_post": "ストーリー形式のイントロ（2〜3行）\n\n• 概要1\n• 概要2\n• 概要3\n\n✅ これが個人開発者に使える理由：\nビジネス価値（数字込み）\n\n🔗 元情報: URL\n#AI #個人開発 #ソロ起業 #AIツール"
    }
  ]
}

【投稿文ルール】
- 自然な日本語口調（です・ます調）
- ビジネス価値を前面に（技術的説明より効果・成果）
- X投稿: 280文字以内目安
- LinkedIn投稿: 400〜600文字
PROMPT_EOF

log "  Gemini API呼び出し中..."

python3 - "$PROMPT_FILE" "$RESPONSE_FILE" "$GEMINI_API_KEY" << 'PYEOF'
import urllib.request, urllib.error, json, sys, time

prompt_file = sys.argv[1]
response_file = sys.argv[2]
api_key = sys.argv[3]

prompt_text = open(prompt_file, encoding='utf-8').read()

# モデル優先順（レート制限時にフォールバック）
models = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"]
success = False

for attempt, model in enumerate(models):
    try:
        print(f"  Gemini試行 {attempt+1}: {model}", flush=True)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json"
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.load(resp)
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            cleaned = text.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split('\n')
                cleaned = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
            parsed = json.loads(cleaned)
            with open(response_file, 'w', encoding='utf-8') as f:
                json.dump(parsed, f, ensure_ascii=False, indent=2)
            print(f"  SUCCESS: {len(parsed.get('picks',[]))} picks generated", flush=True)
            success = True
            break
    except urllib.error.HTTPError as e:
        if e.code == 429:
            wait = 15 * (attempt + 1)
            print(f"  429 レート制限 - {wait}秒待機してリトライ...", flush=True)
            time.sleep(wait)
        else:
            print(f"  HTTP Error {e.code}: {e}", file=sys.stderr)
            time.sleep(5)
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        time.sleep(5)

if not success:
    print("  全モデルで失敗。フォールバックレスポンスを使用", file=sys.stderr)
    with open(response_file, 'w') as f:
        json.dump({"picks": []}, f)
PYEOF

GEMINI_STATUS=$?
if [[ $GEMINI_STATUS -ne 0 ]]; then
  log "⚠️ Gemini API エラー（フォールバックコンテンツを使用）"
fi

PICKS_JSON="$TEMP_DIR/picks.json"
python3 -c "
import json
data = json.load(open('$RESPONSE_FILE'))
picks = data.get('picks', [])
print(json.dumps(picks, ensure_ascii=False, indent=2))
" > "$PICKS_JSON" 2>/dev/null || echo "[]" > "$PICKS_JSON"

PICKS_COUNT=$(python3 -c "import json; print(len(json.load(open('$PICKS_JSON'))))" 2>/dev/null || echo "0")
log "  生成ピック数: ${PICKS_COUNT}件"

# ── Phase 3: Discord投稿 ──────────────────────────────────────────
log "--- Phase 3: Discord投稿 ---"

MESSAGES_DIR="$TEMP_DIR/messages"
mkdir -p "$MESSAGES_DIR"

# メッセージファイルを生成
python3 - "$PICKS_JSON" "$MESSAGES_DIR" "$TODAY" << 'PYEOF'
import json, sys, os

picks_file = sys.argv[1]
msg_dir = sys.argv[2]
today = sys.argv[3]

picks = json.load(open(picks_file, encoding='utf-8'))
idx = 0

def write_msg(content):
    global idx
    if not content.strip():
        return
    fname = os.path.join(msg_dir, f"{idx:03d}.txt")
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
    idx += 1

# ヘッダー（ヘッダーは bash側で送信済み）

if not picks:
    write_msg("⚠️ 本日はコンテンツの生成に失敗しました。\n`bash /root/clawd/scripts/content-pipeline.sh` を再実行してください。")
else:
    for i, pick in enumerate(picks[:3]):
        rank = pick.get('rank', i + 1)
        title = pick.get('title', f'ピック {rank}')
        account = pick.get('source_account', '不明')
        url = pick.get('source_url', '')
        summary = pick.get('summary', '')
        tweet_post = pick.get('tweet_post', '（生成なし）')
        linkedin_post = pick.get('linkedin_post', '（生成なし）')

        # ピックヘッダー
        header = f"**ピック {rank}: {title}**\n👤 {account}"
        if url:
            header += f"\n📎 {url}"
        if summary:
            header += f"\n📝 {summary}"
        write_msg(header)

        # X投稿文
        x_body = f"**【X投稿文】**\n```\n{tweet_post[:1800]}\n```"
        write_msg(x_body)

        # LinkedIn投稿文
        li_body = f"**【LinkedIn投稿文】**\n```\n{linkedin_post[:1800]}\n```"
        write_msg(li_body)

        if i < len(picks[:3]) - 1:
            write_msg("━━━━━━━━━━━━━━━━━━━━━━")

# フッター
write_msg("━━━━━━━━━━━━━━━━━━━━━━\n✅ 使いたい投稿に「👍」を付けてください")
print(f"メッセージファイル生成完了: {idx}件")
PYEOF

# bashループでDiscord送信（clawdbot message send を直接呼び出し）
send_discord() {
  local msg_file="$1"
  local msg
  msg=$(cat "$msg_file")
  clawdbot message send \
    --channel discord \
    --target "$DISCORD_CHANNEL" \
    --message "$msg" || true
  sleep 2
}

# ヘッダーを最初に送信
clawdbot message send \
  --channel discord \
  --target "$DISCORD_CHANNEL" \
  --message "📰 **本日のコンテンツピックアップ** (${TODAY})
━━━━━━━━━━━━━━━━━━━━━━" || true
sleep 2

# 各メッセージを順番に送信
MSG_COUNT=0
for msg_file in $(ls "$MESSAGES_DIR"/*.txt 2>/dev/null | sort); do
  log "  Discord送信: $(basename $msg_file)"
  send_discord "$msg_file"
  MSG_COUNT=$((MSG_COUNT + 1))
done

log "  Discord送信完了: ${MSG_COUNT}件"

log "✅ コンテンツパイプライン完了: $TODAY"

# クリーンアップ
rm -rf "$TEMP_DIR"
log "=== 終了 ==="
