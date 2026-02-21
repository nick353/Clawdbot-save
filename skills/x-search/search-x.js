#!/usr/bin/env node
/**
 * X (Twitter) 検索スクリプト - Puppeteer版
 * 
 * 使い方:
 *   node search-x.js "検索キーワード"
 */

const puppeteer = require('puppeteer');

async function searchX(query) {
  console.log(`🔍 X検索開始: "${query}"`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // X検索ページにアクセス
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
    console.log(`📂 URL: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // ログイン状態を確認（cookieがあれば使用）
    const authToken = process.env.AUTH_TOKEN;
    const ct0 = process.env.CT0;
    
    if (authToken && ct0) {
      await page.setCookie(
        { name: 'auth_token', value: authToken, domain: '.twitter.com' },
        { name: 'ct0', value: ct0, domain: '.twitter.com' }
      );
      await page.reload({ waitUntil: 'networkidle2' });
    }
    
    // ページが読み込まれるまで待機
    await page.waitForTimeout(3000);
    
    // ツイートを抽出
    const tweets = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const results = [];
      
      articles.forEach((article, index) => {
        if (index >= 10) return; // 最初の10件のみ
        
        try {
          // ユーザー名
          const usernameEl = article.querySelector('[data-testid="User-Name"] a[role="link"]');
          const username = usernameEl ? usernameEl.textContent.trim() : 'unknown';
          
          // ツイート本文
          const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
          const text = tweetTextEl ? tweetTextEl.textContent.trim() : '';
          
          // URL
          const tweetLinkEl = article.querySelector('a[href*="/status/"]');
          const url = tweetLinkEl ? 'https://twitter.com' + tweetLinkEl.getAttribute('href') : '';
          
          if (text) {
            results.push({ username, text, url });
          }
        } catch (e) {
          // エラーは無視
        }
      });
      
      return results;
    });
    
    // 結果を表示
    console.log(`\n✅ ${tweets.length}件のツイートを取得\n`);
    
    tweets.forEach((tweet, index) => {
      console.log(`--- ツイート ${index + 1} ---`);
      console.log(`👤 ${tweet.username}`);
      console.log(`📝 ${tweet.text.substring(0, 200)}${tweet.text.length > 200 ? '...' : ''}`);
      console.log(`🔗 ${tweet.url}`);
      console.log('');
    });
    
    // JSON出力
    if (process.argv.includes('--json')) {
      console.log('\n--- JSON出力 ---');
      console.log(JSON.stringify(tweets, null, 2));
    }
    
    return tweets;
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// コマンドライン引数から検索キーワードを取得
const query = process.argv[2];

if (!query) {
  console.error('使い方: node search-x.js "検索キーワード"');
  process.exit(1);
}

// 実行
searchX(query).catch(error => {
  console.error('検索失敗:', error);
  process.exit(1);
});
