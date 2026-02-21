#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - Playwright版（最新UI対応）
 * 
 * Usage: node post-to-instagram-playwright.cjs <image_path> <caption>
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-playwright.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

async function postToInstagram(imagePath, caption) {
  console.log('📸 Instagram に投稿開始...');
  console.log(`📝 キャプション: ${caption.substring(0, 100)}...`);
  console.log(`🖼️  画像: ${imagePath}`);
  if (DRY_RUN) console.log('🧪 DRY_RUN モード: 実際には投稿しません');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    // Cookieを読み込み
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await context.addCookies(cookies);
      console.log('✅ Cookie設定完了');
    } else {
      console.error('❌ Cookieファイルが見つかりません:', cookiesPath);
      throw new Error('Cookie file not found');
    }

    const page = await context.newPage();
    
    // Instagramにアクセス
    console.log('📂 Instagram.comにアクセス中...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 30000 });
    
    await page.waitForTimeout(3000);
    
    // ログイン確認
    const isLoggedIn = !page.url().includes('/accounts/login');
    if (!isLoggedIn) {
      console.error('❌ ログインしていません。Cookieが無効の可能性があります。');
      await page.screenshot({ path: '/tmp/instagram-login-error.png' });
      throw new Error('Not logged in');
    }
    
    console.log('✅ ログイン確認完了');
    await page.screenshot({ path: '/tmp/instagram-before-create.png' });
    
    // 新規投稿ボタンを探してクリック
    console.log('➕ 新規投稿ボタンを探しています...');
    
    // 方法1: aria-label
    const createButton = await page.locator('[aria-label*="New post"], [aria-label*="Create"], [aria-label*="新規"], a[href*="/create/"]').first();
    
    if (await createButton.count() > 0) {
      await createButton.click();
      console.log('✅ 新規投稿ボタンをクリック');
    } else {
      await page.screenshot({ path: '/tmp/instagram-no-create-button.png' });
      throw new Error('新規投稿ボタンが見つかりません');
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/instagram-after-create-click.png' });
    
    // ファイル入力を探す（非表示でもOK）
    console.log('📷 ファイル入力を探しています...');
    
    const fileInput = await page.locator('input[type="file"]').first();
    
    if (await fileInput.count() === 0) {
      console.error('❌ ファイル入力が見つかりません');
      await page.screenshot({ path: '/tmp/instagram-no-file-input.png' });
      
      // HTMLをダンプ
      const html = await page.content();
      fs.writeFileSync('/tmp/instagram-modal.html', html);
      console.log('💾 ページHTML保存: /tmp/instagram-modal.html');
      
      throw new Error('File input not found');
    }
    
    console.log('✅ ファイル入力を発見');
    
    if (DRY_RUN) {
      console.log('🧪 DRY_RUN: ファイルアップロードをスキップ');
      console.log('✅ 投稿準備完了（DRY_RUN）');
      return;
    }
    
    // ファイルをアップロード
    console.log('📤 画像アップロード中...');
    await fileInput.setInputFiles(imagePath);
    console.log('✅ 画像アップロード完了');
    
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/instagram-after-upload.png' });
    
    // 「次へ」ボタンをクリック
    console.log('⏭️  次へボタンをクリック...');
    const nextButton1 = await page.locator('button:has-text("Next"), button:has-text("次へ")').first();
    if (await nextButton1.count() > 0) {
      await nextButton1.click();
      console.log('✅ 次へボタンをクリック（1回目）');
      await page.waitForTimeout(2000);
    }
    
    // もう一度「次へ」をクリック（フィルター画面）
    const nextButton2 = await page.locator('button:has-text("Next"), button:has-text("次へ")').first();
    if (await nextButton2.count() > 0) {
      await nextButton2.click();
      console.log('✅ 次へボタンをクリック（2回目）');
      await page.waitForTimeout(2000);
    }
    
    // キャプション入力
    console.log('📝 キャプション入力中...');
    const captionTextarea = await page.locator('textarea[aria-label*="caption"], textarea[placeholder*="caption"]').first();
    
    if (await captionTextarea.count() > 0) {
      await captionTextarea.fill(caption);
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力欄が見つかりません');
    }
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/instagram-before-share.png' });
    
    // 「シェア」ボタンをクリック
    console.log('📤 投稿中...');
    const shareButton = await page.locator('button:has-text("Share"), button:has-text("シェア")').first();
    
    if (await shareButton.count() > 0) {
      await shareButton.click();
      console.log('✅ シェアボタンをクリック');
    } else {
      console.error('❌ シェアボタンが見つかりません');
      throw new Error('Share button not found');
    }
    
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/instagram-after-share.png' });
    
    console.log('✅ Instagram投稿完了！');
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

postToInstagram(imagePath, caption).catch(error => {
  console.error('❌ 投稿失敗:', error.message);
  process.exit(1);
});
