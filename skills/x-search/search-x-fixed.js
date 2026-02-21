#!/usr/bin/env node
/**
 * X (Twitter) 検索スクリプト - 修正版
 * より堅牢なセレクタとデバッグ機能付き
 */

const puppeteer = require('puppeteer');

async function searchX(query) {
  console.log(`🔍 X検索開始: "${query}"`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // User-Agent設定（より現実的に）
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Cookieを設定（ログイン状態）
    const authToken = process.env.AUTH_TOKEN;
    const ct0 = process.env.CT0;
    
    if (authToken && ct0) {
      await page.setCookie(
        { name: 'auth_token', value: authToken, domain: '.twitter.com' },
        { name: 'ct0', value: ct0, domain: '.twitter.com' }
      );
      console.log('🔐 Cookie設定済み（ログイン状態）');
    } else {
      console.log('⚠️ Cookie未設定（ログインなし）');
    }
    
    // X検索ページにアクセス
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
    console.log(`📂 URL: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // ページタイトル確認
    const title = await page.title();
    console.log(`📄 ページタイトル: ${title}`);
    
    // ページが読み込まれるまで待機（長めに）
    await page.waitForTimeout(5000);
    
    // スクリーンショット保存（デバッグ用）
    if (process.env.DEBUG) {
      await page.screenshot({ path: '/tmp/x-search-debug.png' });
      console.log('📸 スクリーンショット保存: /tmp/x-search-debug.png');
    }
    
    // ツイートを抽出（複数のセレクタパターンを試行）
    const tweets = await page.evaluate(() => {
      const results = [];
      
      // パターン1: article[data-testid="tweet"]
      let articles = document.querySelectorAll('article[data-testid="tweet"]');
      
      // パターン2: article (data-testid なし)
      if (articles.length === 0) {
        articles = document.querySelectorAll('article');
      }
      
      // デバッグ: 見つかった要素数
      console.log(`Found ${articles.length} articles`);
      
      articles.forEach((article, index) => {
        if (index >= 10) return;
        
        try {
          // ユーザー名（複数パターン試行）
          let username = '';
          const usernameSelectors = [
            '[data-testid="User-Name"] a[role="link"]',
            'a[href^="/"]:not([href*="/status/"])',
            '[dir="ltr"] span'
          ];
          
          for (const selector of usernameSelectors) {
            const el = article.querySelector(selector);
            if (el && el.textContent.startsWith('@')) {
              username = el.textContent.trim();
              break;
            }
          }
          
          // ツイート本文（複数パターン試行）
          let text = '';
          const textSelectors = [
            '[data-testid="tweetText"]',
            '[lang]',
            'div[dir="auto"]'
          ];
          
          for (const selector of textSelectors) {
            const el = article.querySelector(selector);
            if (el && el.textContent.length > 10) {
              text = el.textContent.trim();
              break;
            }
          }
          
          // URL
          const tweetLinkEl = article.querySelector('a[href*="/status/"]');
          let url = '';
          if (tweetLinkEl) {
            const href = tweetLinkEl.getAttribute('href');
            url = href.startsWith('http') ? href : 'https://twitter.com' + href;
          }
          
          // デバッグ出力
          if (text) {
            console.log(`Tweet ${index + 1}: ${text.substring(0, 50)}...`);
            results.push({ username: username || 'unknown', text, url });
          }
        } catch (e) {
          console.error(`Error parsing article ${index}:`, e.message);
        }
      });
      
      return results;
    });
    
    // 結果を表示
    console.log(`\n✅ ${tweets.length}件のツイートを取得\n`);
    
    if (tweets.length === 0) {
      console.log('⚠️ ツイートが見つかりませんでした');
      console.log('考えられる原因:');
      console.log('  - Xの仕様変更');
      console.log('  - レート制限');
      console.log('  - ログインが必要');
      console.log('  - セレクタの変更');
      console.log('\nデバッグモードで実行: DEBUG=1 node search-x-fixed.js "query"');
    } else {
      tweets.forEach((tweet, index) => {
        console.log(`--- ツイート ${index + 1} ---`);
        console.log(`👤 ${tweet.username}`);
        console.log(`📝 ${tweet.text.substring(0, 200)}${tweet.text.length > 200 ? '...' : ''}`);
        console.log(`🔗 ${tweet.url}`);
        console.log('');
      });
    }
    
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
  console.error('使い方: node search-x-fixed.js "検索キーワード"');
  console.error('デバッグ: DEBUG=1 node search-x-fixed.js "検索キーワード"');
  process.exit(1);
}

// 実行
searchX(query).catch(error => {
  console.error('検索失敗:', error);
  process.exit(1);
});
