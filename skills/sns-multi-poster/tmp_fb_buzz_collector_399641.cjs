const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/facebook.json';
const OUTPUT_FILE = process.argv[2];
const HASHTAGS = ['japanart', 'ukiyoe', 'japaneseartwork'];

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
      console.log('🔐 Facebook Cookie設定完了');
    } else {
      throw new Error(`Cookieファイルなし: ${COOKIES_PATH}`);
    }

    for (const tag of HASHTAGS) {
      console.log(`\n🔍 ハッシュタグ #${tag} を調査中...`);
      const url = `https://www.facebook.com/hashtag/${tag}`;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4000);

        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
          console.error('❌ ログイン必要 - Cookie期限切れ');
          continue;
        }

        // スクロール
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 1000));
          await sleep(1500);
        }

        const posts = await page.evaluate(() => {
          const results = [];
          // Facebookの投稿を探す
          const feedItems = document.querySelectorAll('[data-pagelet*="FeedUnit"], [role="article"], div[id*="post"]');
          feedItems.forEach(item => {
            const textEl = item.querySelector('div[data-ad-comet-preview="message"], [data-testid="post_message"], span[dir="auto"]');
            const text = textEl ? textEl.textContent.substring(0, 300) : '';

            // いいね数
            const reactionEl = item.querySelector('[aria-label*="reaction"], [aria-label*="いいね"], span[class*="count"]');
            let likes = 0;
            if (reactionEl) {
              const m = (reactionEl.textContent || '').match(/[\d,]+/);
              if (m) likes = parseInt(m[0].replace(/,/g, ''), 10);
            }

            // コメント数
            const commentEl = item.querySelector('[aria-label*="comment"], [aria-label*="コメント"]');
            let comments = 0;
            if (commentEl) {
              const m = (commentEl.textContent || '').match(/[\d,]+/);
              if (m) comments = parseInt(m[0].replace(/,/g, ''), 10);
            }

            // シェア数
            const shareEl = item.querySelector('[aria-label*="share"], [aria-label*="シェア"]');
            let shares = 0;
            if (shareEl) {
              const m = (shareEl.textContent || '').match(/[\d,]+/);
              if (m) shares = parseInt(m[0].replace(/,/g, ''), 10);
            }

            const linkEl = item.querySelector('a[href*="/posts/"], a[href*="story_fbid"]');
            const url = linkEl ? linkEl.getAttribute('href') : '';

            if (text.length > 5 || url) {
              results.push({ text, likes, comments, shares, url });
            }
          });
          return results.slice(0, 20);
        });

        console.log(`📊 #${tag}: ${posts.length}件`);
        posts.forEach(p => {
          p.hashtag = tag;
          allPosts.push(p);
        });

      } catch (e) {
        console.error(`❌ #${tag} 失敗: ${e.message}`);
      }

      await sleep(4000);
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
      platform: 'facebook',
      hashtags: HASHTAGS,
      totalPosts: posts.length,
      posts: posts.sort((a, b) => b.likes - a.likes),
      maxLikes: posts.reduce((m, p) => Math.max(m, p.likes), 0),
      maxShares: posts.reduce((m, p) => Math.max(m, p.shares), 0),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ 保存完了: ${OUTPUT_FILE} (${posts.length}件)`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 収集失敗:', err.message);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      collectedAt: new Date().toISOString(),
      platform: 'facebook',
      error: err.message,
      posts: [],
      totalPosts: 0,
      maxLikes: 0,
    }, null, 2));
    process.exit(1);
  });
