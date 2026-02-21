#!/usr/bin/env node
/**
 * 全SNSログイン設定スクリプト
 * ブラウザプロファイルに全SNSのログイン状態を保存
 * 
 * Usage: node setup-all-logins.js
 */

const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupSNSLogin(browser, snsName, url, checkSelector) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔐 ${snsName} ログインセットアップ`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const page = await browser.newPage();
  
  console.log(`📂 ${url} にアクセス...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // ログイン状態を確認
  console.log('🔍 ログイン状態を確認...');
  const isLoggedIn = await page.locator(checkSelector).count() > 0;
  
  if (isLoggedIn) {
    console.log(`✅ ${snsName}: 既にログイン済みです！`);
    await page.close();
    return true;
  }
  
  console.log(`❌ ${snsName}: ログインが必要です`);
  console.log(`\n📝 ブラウザで手動ログインしてください:`);
  console.log(`   ${url}`);
  console.log('\n⚠️  このターミナルはそのままにして、別のブラウザでログインしてください。');
  console.log('   ログイン完了後、Enterキーを押してください。\n');
  
  await question('ログイン完了後、Enterキーを押してください: ');
  
  // 再度ログイン確認
  console.log('🔍 ログイン状態を再確認...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const isLoggedInNow = await page.locator(checkSelector).count() > 0;
  
  if (isLoggedInNow) {
    console.log(`✅ ${snsName}: ログイン確認完了！`);
    await page.close();
    return true;
  } else {
    console.log(`❌ ${snsName}: ログインを検出できませんでした`);
    await page.close();
    return false;
  }
}

(async () => {
  console.log('🚀 SNS Multi-Poster - 全SNSログインセットアップ');
  console.log('ブラウザプロファイル: browser-profile\n');
  
  const profileDir = path.join(__dirname, 'browser-profile');
  
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,  // 手動ログインのため表示モード
    viewport: { width: 1280, height: 720 }
  });
  
  const results = {};
  
  // 1. Instagram
  results.instagram = await setupSNSLogin(
    browser,
    'Instagram',
    'https://www.instagram.com/',
    'a[href*="/direct/"], svg[aria-label*="Home"]'
  );
  
  // 2. Threads
  results.threads = await setupSNSLogin(
    browser,
    'Threads',
    'https://www.threads.net/',
    'a[href="/"], svg[aria-label*="Home"]'
  );
  
  // 3. Facebook
  results.facebook = await setupSNSLogin(
    browser,
    'Facebook',
    'https://www.facebook.com/',
    'a[href*="/home"], a[aria-label*="Home"]'
  );
  
  // 4. Pinterest
  results.pinterest = await setupSNSLogin(
    browser,
    'Pinterest',
    'https://www.pinterest.com/',
    'a[href*="/today/"], button[aria-label*="Notifications"]'
  );
  
  // 5. X (Twitter)
  results.x = await setupSNSLogin(
    browser,
    'X (Twitter)',
    'https://twitter.com/',
    'a[href="/home"], a[aria-label*="Home"]'
  );
  
  await browser.close();
  
  // 結果サマリー
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 セットアップ結果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const [sns, success] of Object.entries(results)) {
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${sns}`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const successCount = Object.values(results).filter(v => v).length;
  console.log(`\n✅ 成功: ${successCount}/5`);
  
  if (successCount === 5) {
    console.log('\n🎉 全SNSのログイン設定完了！');
    console.log('   これで sns-multi-poster-profile.sh が使えます。');
  } else {
    console.log('\n⚠️ 一部のSNSでログインに失敗しました。');
    console.log('   再度このスクリプトを実行してください。');
  }
  
  rl.close();
})();
