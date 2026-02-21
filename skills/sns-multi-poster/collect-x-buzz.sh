#!/bin/bash
# collect-x-buzz.sh
# X(Twitter)でハッシュタグのバズ投稿を収集
# bird CLI優先、フォールバックでPuppeteer
# Usage: bash collect-x-buzz.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATE_STR=$(date '+%Y%m%d')
OUTPUT_DIR="/root/clawd/data/buzz"
OUTPUT_FILE="$OUTPUT_DIR/x_${DATE_STR}.json"
NODE_SCRIPT="/tmp/x_buzz_collector_$$.cjs"

mkdir -p "$OUTPUT_DIR"

echo "🐦 X バズ調査開始..."
echo "📅 日付: $DATE_STR"

# bird CLIで収集を試みる
BIRD_SUCCESS=false
BIRD_RESULT=""

if command -v bird &>/dev/null; then
  echo "🔍 bird CLI で収集中..."

  # 複数クエリを試す
  for QUERY in "#浮世絵 #ukiyoe" "#ukiyoe" "#japanart woodblock"; do
    echo "  検索: $QUERY"
    RAW=$(AUTH_TOKEN="${AUTH_TOKEN:-}" CT0="${CT0:-}" bird search "$QUERY" -n 20 --json 2>&1) || true
    if echo "$RAW" | grep -q "text\|tweet\|id"; then
      BIRD_RESULT="$RAW"
      BIRD_SUCCESS=true
      echo "  ✅ bird 成功"
      break
    fi
    sleep 2
  done
fi

if [ "$BIRD_SUCCESS" = "true" ]; then
  # bird JSON結果をパース（bird --json 形式対応）
  cat > /tmp/x_buzz_parse_$$.js << 'PARSE_EOF'
const raw = require('fs').readFileSync('/dev/stdin', 'utf8');
let posts = [];

try {
  const arr = JSON.parse(raw);
  if (Array.isArray(arr)) {
    posts = arr.map(t => ({
      text: t.text || '',
      likes: t.likeCount || t.favorite_count || 0,
      retweets: t.retweetCount || t.retweet_count || 0,
      replies: t.replyCount || 0,
      impressions: t.viewCount || t.impression_count || 0,
      url: t.id ? `https://x.com/i/status/${t.id}` : '',
      author: t.author?.username || '',
    }));
  }
} catch(e) {
  console.error('JSON parse error:', e.message);
}

const result = {
  collectedAt: new Date().toISOString(),
  platform: 'x',
  method: 'bird',
  totalPosts: posts.length,
  posts: posts.sort((a, b) => (b.likes||0) - (a.likes||0)),
  maxLikes: posts.reduce((m, p) => Math.max(m, p.likes||0), 0),
  maxRetweets: posts.reduce((m, p) => Math.max(m, p.retweets||0), 0),
};
console.log(JSON.stringify(result, null, 2));
PARSE_EOF

  echo "$BIRD_RESULT" | node /tmp/x_buzz_parse_$$.js > "$OUTPUT_FILE"
  rm -f /tmp/x_buzz_parse_$$.js
  echo "✅ bird CLIでX バズ調査完了: $OUTPUT_FILE"

else
  echo "⚠️  bird CLI 失敗 → Puppeteerフォールバック"

  cat > "$NODE_SCRIPT" << 'JSEOF'
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/x.json';
const OUTPUT_FILE = process.argv[2];
const QUERIES = ['#浮世絵 #ukiyoe', '#ukiyoe', '#japanart woodblock print'];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function collectBuzz() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  const allPosts = [];

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await page.setCookie(...cookies);
      console.log('🔐 X Cookie設定完了');
    } else {
      console.log('⚠️  X Cookie なし（未ログイン状態で試行）');
    }

    for (const q of QUERIES) {
      console.log(`\n🔍 検索: "${q}"`);
      const url = `https://x.com/search?q=${encodeURIComponent(q)}&f=top&src=typed_query`;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4000);

        const currentUrl = page.url();
        if (currentUrl.includes('/login') || currentUrl.includes('/i/flow')) {
          console.error('❌ ログイン必要');
          continue;
        }

        // スクロールして更多くの投稿を読み込む
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 800));
          await sleep(1500);
        }

        const posts = await page.evaluate(() => {
          const articles = document.querySelectorAll('article[data-testid="tweet"]');
          return Array.from(articles).slice(0, 20).map(article => {
            const textEl = article.querySelector('[data-testid="tweetText"]');
            const text = textEl ? textEl.textContent : '';

            const likeEl = article.querySelector('[data-testid="like"] span[data-testid="app-text-transition-container"]');
            const rtEl = article.querySelector('[data-testid="retweet"] span[data-testid="app-text-transition-container"]');
            const replyEl = article.querySelector('[data-testid="reply"] span[data-testid="app-text-transition-container"]');

            const parseCount = (el) => {
              if (!el) return 0;
              const t = el.textContent.replace(/[^0-9KMkm.]/g, '');
              if (t.includes('K') || t.includes('k')) return Math.round(parseFloat(t) * 1000);
              if (t.includes('M') || t.includes('m')) return Math.round(parseFloat(t) * 1000000);
              return parseInt(t, 10) || 0;
            };

            const linkEl = article.querySelector('a[href*="/status/"]');
            const url = linkEl ? `https://x.com${linkEl.getAttribute('href')}` : '';

            return {
              text: text.substring(0, 300),
              likes: parseCount(likeEl),
              retweets: parseCount(rtEl),
              replies: parseCount(replyEl),
              url,
            };
          });
        });

        console.log(`📊 "${q}": ${posts.length}件`);
        posts.forEach(p => {
          p.query = q;
          allPosts.push(p);
        });

      } catch (e) {
        console.error(`❌ "${q}" 失敗: ${e.message}`);
      }

      await sleep(3000);
    }

    return allPosts;
  } finally {
    await browser.close();
  }
}

collectBuzz()
  .then(posts => {
    const result = {
      collectedAt: new Date().toISOString(),
      platform: 'x',
      method: 'puppeteer',
      totalPosts: posts.length,
      posts: posts.sort((a, b) => b.likes - a.likes),
      maxLikes: posts.reduce((m, p) => Math.max(m, p.likes), 0),
      maxRetweets: posts.reduce((m, p) => Math.max(m, p.retweets), 0),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ 保存完了: ${OUTPUT_FILE} (${posts.length}件)`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 収集失敗:', err.message);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      collectedAt: new Date().toISOString(),
      platform: 'x',
      error: err.message,
      posts: [],
      totalPosts: 0,
      maxLikes: 0,
    }, null, 2));
    process.exit(1);
  });
JSEOF

  cd "$SCRIPT_DIR"
  if node "$NODE_SCRIPT" "$OUTPUT_FILE"; then
    echo "✅ X バズ調査完了（Puppeteer）: $OUTPUT_FILE"
  else
    echo "⚠️  X バズ調査エラー（空JSONを保存済み）"
  fi
  rm -f "$NODE_SCRIPT"
fi
