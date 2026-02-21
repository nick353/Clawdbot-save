#!/usr/bin/env node

/**
 * X(Twitter) Cookie認証検索スクリプト
 * Cookiesを使ってログインし、投稿の詳細内容を取得
 */

import { Scraper } from '@the-convocation/twitter-scraper';

// Cookies (環境変数または直接指定)
const AUTH_TOKEN = process.env.X_AUTH_TOKEN || 'c41f221b78c39097420346a2346e9a6a9431e615';
const CT0 = process.env.X_CT0 || 'd8fd50475309b3ec41072902857fff63c0e3f3985a039eec1be0278cd865e1a84f9edef2c8a2a51f9d8f47d702f508ecb50ec532fdadebeddecd38be025c24b87d6b0e6480ab0f2ac52b42548a978ec7';

async function main() {
  const scraper = new Scraper();
  
  console.log('🍪 Setting up cookies for X authentication...');
  
  try {
    // Cookiesでログイン
    await scraper.setCookies([
      {
        name: 'auth_token',
        value: AUTH_TOKEN,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None'
      },
      {
        name: 'ct0',
        value: CT0,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax'
      }
    ]);
    
    console.log('✅ Cookies set successfully!\n');
    
    // ログイン確認
    const isLoggedIn = await scraper.isLoggedIn();
    if (!isLoggedIn) {
      console.error('❌ Login verification failed. Cookies may be invalid or expired.');
      process.exit(1);
    }
    
    console.log('✅ Login verified!\n');
    
    const query = process.argv[2] || 'Clawdbot OR Moltbot';
    console.log(`🔍 Searching for: ${query}\n`);
    
    const tweets = [];
    const searchIterator = scraper.searchTweets(query, 10);
    
    for await (const tweet of searchIterator) {
      tweets.push(tweet);
      if (tweets.length >= 10) break;
    }
    
    if (tweets.length === 0) {
      console.log('No tweets found.');
      return;
    }
    
    console.log(`📊 Found ${tweets.length} tweets:\n`);
    console.log('='.repeat(80) + '\n');
    
    tweets.forEach((tweet, i) => {
      console.log(`${i + 1}. @${tweet.username || 'unknown'} (${tweet.name || 'Unknown User'})`);
      console.log(`   📅 ${tweet.timeParsed || tweet.timestamp || 'Unknown date'}`);
      console.log(`   💬 ${tweet.text || '(no text)'}`);
      console.log(`   ❤️  ${tweet.likes || 0} likes | 🔁 ${tweet.retweets || 0} retweets | 💬 ${tweet.replies || 0} replies`);
      
      if (tweet.photos && tweet.photos.length > 0) {
        console.log(`   🖼️  ${tweet.photos.length} photo(s)`);
      }
      if (tweet.videos && tweet.videos.length > 0) {
        console.log(`   🎥 ${tweet.videos.length} video(s)`);
      }
      
      console.log(`   🔗 https://x.com/${tweet.username}/status/${tweet.id || tweet.rest_id}`);
      console.log('');
    });
    
    console.log('='.repeat(80));
    console.log('✅ Search completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Tips:');
    console.error('  - Cookies may have expired. Get fresh ones from your browser.');
    console.error('  - Make sure you are logged in to X in your browser.');
    console.error('  - Try logging out and back in to X, then get new cookies.');
    process.exit(1);
  }
}

main();
