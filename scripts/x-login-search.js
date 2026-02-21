#!/usr/bin/env node

/**
 * X(Twitter)ログイン検索スクリプト
 * ログインして投稿の詳細内容を取得
 */

import { Scraper } from '@the-convocation/twitter-scraper';

const USERNAME = 'Nichika0823';
const PASSWORD = 'Nichika0823';
const EMAIL = 'okinawa2000823@gmail.com';

async function main() {
  const scraper = new Scraper();
  
  console.log('🔐 Logging in to X...');
  
  try {
    await scraper.login(USERNAME, PASSWORD, EMAIL);
    console.log('✅ Login successful!\n');
    
    const query = process.argv[2] || 'Clawdbot OR Moltbot';
    console.log(`🔍 Searching for: ${query}\n`);
    
    const tweets = [];
    const searchIterator = scraper.searchTweets(query, 10);
    
    for await (const tweet of searchIterator) {
      tweets.push(tweet);
      if (tweets.length >= 10) break;
    }
    
    console.log(`📊 Found ${tweets.length} tweets:\n`);
    
    tweets.forEach((tweet, i) => {
      console.log(`${i + 1}. @${tweet.username} (${tweet.name})`);
      console.log(`   ${tweet.text}`);
      console.log(`   ❤️ ${tweet.likes || 0} | 🔁 ${tweet.retweets || 0} | 💬 ${tweet.replies || 0}`);
      console.log(`   🔗 https://x.com/${tweet.username}/status/${tweet.id}`);
      console.log('');
    });
    
    await scraper.logout();
    console.log('👋 Logged out.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Tip: If login fails, try using cookies instead.');
    process.exit(1);
  }
}

main();
