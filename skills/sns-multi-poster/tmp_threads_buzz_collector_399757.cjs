const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/threads.json';
const IG_COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const OUTPUT_FILE = process.argv[2];
const KEYWORDS = ['浮世絵', 'japanart', 'ukiyoe'];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function collectBuzz() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,900'
    ]
  });

  const allPosts = [];

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    // Cookie読み込み（threadsがあればそれ、なければinstagram）
    let cookiesPath = fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : IG_COOKIES_PATH;
    if (!fs.existsSync(cookiesPath)) {
      throw new Error(`Cookieファイルなし: ${cookiesPath}`);
    }
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies);
    console.log(`🔐 Cookie設定完了: ${cookiesPath}`);

    for (const kw of KEYWORDS) {
      console.log(`\n🔍 キーワード "${kw}" を調査中...`);
      const url = `https://www.threads.net/search?q=${encodeURIComponent(kw)}&serp_type=default`;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4000);

        // ログイン確認
        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
          console.error('❌ ログイン必要 - Cookie期限切れ');
          continue;
        }

        // 投稿を取得
        const posts = await page.evaluate(() => {
          const items = [];
          // Threadsの投稿要素を探す
          const postEls = document.querySelectorAll('article, [data-pressable-container="true"], div[class*="post"]');
          postEls.forEach(el => {
            const text = el.querySelector('span[dir="auto"], p')?.textContent || '';
            const link = el.querySelector('a[href*="/post/"], a[href*="/@"]')?.getAttribute('href') || '';

            // いいね数・返信数・リポスト数の取得試行
            const nums = el.querySelectorAll('span[title], span[aria-label]');
            let likes = 0, replies = 0, reposts = 0;
            nums.forEach(n => {
              const label = (n.getAttribute('aria-label') || n.getAttribute('title') || '').toLowerCase();
              const val = parseInt((n.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
              if (label.includes('like') || label.includes('いいね')) likes = val;
              else if (label.includes('repl') || label.includes('返信')) replies = val;
              else if (label.includes('repost') || label.includes('リポスト')) reposts = val;
            });

            if (text.length > 5 || link) {
              items.push({
                text: text.substring(0, 300),
                url: link ? `https://www.threads.net${link}` : '',
                likes,
                replies,
                reposts,
              });
            }
          });
          return items.slice(0, 20);
        });

        console.log(`📊 "${kw}": ${posts.length}件取得`);
        posts.forEach(p => {
          p.keyword = kw;
          allPosts.push(p);
        });

      } catch (e) {
        console.error(`❌ "${kw}" 取得失敗: ${e.message}`);
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
      platform: 'threads',
      keywords: KEYWORDS,
      totalPosts: posts.length,
      posts: posts.sort((a, b) => b.likes - a.likes),
      maxLikes: posts.reduce((max, p) => Math.max(max, p.likes), 0),
      maxReposts: posts.reduce((max, p) => Math.max(max, p.reposts), 0),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ 保存完了: ${OUTPUT_FILE} (${posts.length}件)`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 収集失敗:', err.message);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      collectedAt: new Date().toISOString(),
      platform: 'threads',
      error: err.message,
      posts: [],
      totalPosts: 0,
      maxLikes: 0,
    }, null, 2));
    process.exit(1);
  });
