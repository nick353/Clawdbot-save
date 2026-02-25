#!/usr/bin/env node
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const DEBUG_DIR = '/tmp/instagram-vision-debug';

async function takeScreenshot(page, name) {
  const filepath = path.join(DEBUG_DIR, `${name}.png`);
  await page.screenshot({ path: filepath });
  console.log(`📸 ${filepath}`);
  return filepath;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Cookie
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')).map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.instagram.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);

    // Instagram
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000));
    await takeScreenshot(page, '1-home');

    // Create
    const createBtn = await page.$('svg[aria-label="New post"]');
    if (createBtn) {
      await createBtn.click();
      console.log('✅ Createクリック');
      await new Promise(r => setTimeout(r, 4000));
      await takeScreenshot(page, '2-after-create');
    } else {
      console.error('❌ Createボタンなし');
      process.exit(1);
    }

    // Post直接クリック（座標指定）
    console.log('\n📋 Post直接クリック（座標: 33, 355）...');
    await page.mouse.click(33, 355);
    console.log('✅ Postクリック完了');
    
    await new Promise(r => setTimeout(r, 7000));
    await takeScreenshot(page, '3-after-post-direct-click');

    // ダイアログ確認
    const dialogExists = await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      return dialogs.length > 0;
    });

    if (dialogExists) {
      console.log('✅ アップロードダイアログ検出');
    } else {
      console.log('⚠️  アップロードダイアログ未検出');
    }

    // ファイル入力確認
    const hasFileInput = await page.evaluate(() => {
      return document.querySelector('input[type="file"]') !== null;
    });

    if (hasFileInput) {
      console.log('✅ ファイル入力検出');
    } else {
      console.log('⚠️  ファイル入力未検出');
    }

    console.log('\n✅ テスト完了');

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
