#!/usr/bin/env node
/**
 * Instagram Cookie Refresh
 * ブラウザでログインして、クッキーを更新
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const COOKIES_DIR = path.join(os.homedir(), '.clawdbot', 'auth');
const COOKIES_FILE = path.join(COOKIES_DIR, 'instagram.json');

// 環境変数から認証情報を取得
const IG_USERNAME = process.env.IG_USERNAME || 'nisen_prints';
const IG_PASSWORD = process.env.IG_PASSWORD;

if (!IG_PASSWORD) {
  console.error('❌ IG_PASSWORD not set in environment');
  process.exit(1);
}

async function main() {
  console.log('🚀 Instagram Cookie Refresh');
  console.log(`   Username: ${IG_USERNAME}`);
  console.log(`   Cookies will be saved to: ${COOKIES_FILE}`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    // Instagram にアクセス
    console.log('\n🌐 Loading Instagram...');
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    console.log('✅ Login page loaded');

    // ユーザーがマニュアルでログインするのを待つ
    console.log('\n⏳ Waiting for manual login (180s)...');
    console.log('   Please log in manually in the browser window');
    console.log('   This script will continue after you successfully log in');

    // ホームページへのリダイレクトを待つ
    await page.waitForURL('https://www.instagram.com/', {
      timeout: 180000,
    });
    console.log('✅ Login successful!');

    // 少し待機
    await page.waitForTimeout(3000);

    // クッキーを取得
    console.log('\n💾 Saving cookies...');
    const cookies = await context.cookies();
    console.log(`   Got ${cookies.length} cookies`);

    // ディレクトリを作成
    if (!fs.existsSync(COOKIES_DIR)) {
      fs.mkdirSync(COOKIES_DIR, { recursive: true });
    }

    // クッキーを保存
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`✅ Cookies saved to: ${COOKIES_FILE}`);

    // SNS skills ディレクトリにもコピー
    const skillsCookies = path.join('/root/clawd/skills/sns-multi-poster/cookies/instagram.json');
    fs.copyFileSync(COOKIES_FILE, skillsCookies);
    console.log(`✅ Copied to: ${skillsCookies}`);

    console.log('\n✨ Done! You can now close the browser.');
    console.log('🎉 Instagram cookies refreshed successfully');

    await context.close();
    await browser.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
