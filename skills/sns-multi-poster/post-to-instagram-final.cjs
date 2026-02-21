#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - 最終修正版
 * モーダル表示の待機時間を大幅に増加
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-final.cjs <image_path> <caption>');
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

    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await context.addCookies(cookies);

    const page = await context.newPage();
    
    console.log('📂 Instagram.comにアクセス中...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    console.log('✅ ログイン確認完了');
    await page.screenshot({ path: '/tmp/instagram-step1-home.png' });
    
    console.log('➕ 新規投稿ボタンをクリック...');
    const createButton = page.locator('a[role="link"]:has-text("New post"), a[role="link"]:has-text("Create")').first();
    
    if (await createButton.count() === 0) {
      throw new Error('新規投稿ボタンが見つかりません');
    }
    
    await createButton.click();
    console.log('✅ クリック完了、モーダル表示待機中...');
    
    // モーダルが完全に表示されるまで待機（最大15秒）
    await page.waitForTimeout(10000);
    await page.screenshot({ path: '/tmp/instagram-step2-modal.png' });
    
    console.log('📷 ファイル入力を探しています...');
    
    // 複数回試行
    let fileInput = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔍 試行 ${attempt}/3...`);
      
      fileInput = page.locator('input[type="file"]').first();
      const count = await fileInput.count();
      
      if (count > 0) {
        console.log('✅ ファイル入力を発見！');
        break;
      }
      
      console.log(`⏳ 待機中... (${attempt * 3}秒)`);
      await page.waitForTimeout(3000);
    }
    
    if (await fileInput.count() === 0) {
      console.error('❌ ファイル入力が見つかりません');
      
      // HTMLをダンプ
      const html = await page.content();
      fs.writeFileSync('/tmp/instagram-modal-final.html', html);
      console.log('💾 HTML保存: /tmp/instagram-modal-final.html');
      
      throw new Error('File input not found after 3 attempts');
    }
    
    if (DRY_RUN) {
      console.log('🧪 DRY_RUN: アップロードをスキップ');
      console.log('✅ 投稿準備完了（DRY_RUN）');
      return;
    }
    
    console.log('📤 画像アップロード中...');
    await fileInput.setInputFiles(imagePath);
    console.log('✅ アップロード完了');
    
    await page.waitForTimeout(7000);
    await page.screenshot({ path: '/tmp/instagram-step3-uploaded.png' });
    
    console.log('⏭️  次へボタンをクリック（1回目）...');
    const nextButton1 = page.locator('button:has-text("Next"), button:has-text("次へ")').first();
    if (await nextButton1.count() > 0) {
      await nextButton1.click();
      await page.waitForTimeout(3000);
      console.log('✅ 完了');
    }
    
    console.log('⏭️  次へボタンをクリック（2回目）...');
    const nextButton2 = page.locator('button:has-text("Next"), button:has-text("次へ")').first();
    if (await nextButton2.count() > 0) {
      await nextButton2.click();
      await page.waitForTimeout(3000);
      console.log('✅ 完了');
    }
    
    console.log('📝 キャプション入力中...');
    const captionField = page.locator('textarea[aria-label*="caption"], textarea[placeholder*="caption"]').first();
    
    if (await captionField.count() > 0) {
      await captionField.fill(caption);
      console.log('✅ 入力完了');
    } else {
      console.warn('⚠️  キャプション欄が見つかりません');
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/instagram-step4-caption.png' });
    
    console.log('📤 シェアボタンをクリック...');
    const shareButton = page.locator('button:has-text("Share"), button:has-text("シェア")').first();
    
    if (await shareButton.count() > 0) {
      await shareButton.click();
      console.log('✅ 投稿完了！');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/tmp/instagram-step5-done.png' });
    } else {
      throw new Error('シェアボタンが見つかりません');
    }
    
    console.log('✅ Instagram投稿成功！');
    
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
