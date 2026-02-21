#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - ブラウザプロファイル版
 * 
 * Cookie JSONではなく、永続的なブラウザプロファイルを使用
 * これにより、ログインセッションが維持されます
 * 
 * Usage: node post-to-instagram-profile.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-profile.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

async function postToInstagram(imagePath, caption) {
  console.log('📸 Instagram に投稿開始（ブラウザプロファイル版）...');
  console.log(`📝 キャプション: ${caption.substring(0, 100)}...`);
  console.log(`🖼️  画像: ${imagePath}`);
  
  const profileDir = path.join(__dirname, 'browser-profile');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: profileDir,  // 永続的なプロファイルを使用
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Instagramにアクセス
    console.log('📂 Instagram.comにアクセス中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // ログイン確認
    const currentUrl = await page.url();
    const isLoggedIn = !currentUrl.includes('/accounts/login');
    
    console.log(`現在のURL: ${currentUrl}`);
    console.log(`ログイン状態: ${isLoggedIn ? '✅ ログイン済み' : '❌ ログインが必要'}`);
    
    if (!isLoggedIn) {
      console.error('❌ ログインしていません');
      console.error('⚠️  以下のコマンドで手動ログインしてください:');
      console.error('   node setup-instagram-login.js');
      throw new Error('Not logged in - please run setup-instagram-login.js first');
    }
    
    console.log('✅ ログイン確認完了');
    
    // 新規投稿ボタンを探す
    console.log('➕ 新規投稿ボタンを探しています...');
    
    // ページ内の全SVG要素を確認
    const svgInfo = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg'));
      return svgs.map(svg => ({
        ariaLabel: svg.getAttribute('aria-label'),
        parentTag: svg.parentElement?.tagName,
        parentHref: svg.closest('a')?.getAttribute('href')
      })).filter(s => s.ariaLabel);
    });
    
    console.log('📋 利用可能なSVGボタン:');
    svgInfo.forEach(info => {
      console.log(`  - ${info.ariaLabel}`);
    });
    
    // 新規投稿ボタンをクリック
    const createPostSelectors = [
      'svg[aria-label="New post"]',
      'svg[aria-label="新規投稿"]',
      'svg[aria-label="Create"]',
      'svg[aria-label="作成"]'
    ];
    
    let clicked = false;
    for (const selector of createPostSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ ボタン発見: ${selector}`);
          
          // 親のaタグをクリック
          const parent = await page.evaluateHandle(el => el.closest('a'), element);
          await parent.click();
          console.log('✅ クリック成功');
          clicked = true;
          break;
        }
      } catch (e) {
        console.log(`  ⏭️  ${selector}: ${e.message}`);
      }
    }
    
    if (!clicked) {
      console.error('❌ 新規投稿ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/instagram-profile-no-button.png', fullPage: true });
      throw new Error('Create button not found');
    }
    
    // モーダルが表示されるまで待機
    console.log('⏳ モーダルの表示を待機中...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // ファイル入力を探す
    console.log('📷 ファイル入力を探しています...');
    await page.waitForSelector('input[type="file"]', { timeout: 10000 });
    
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      console.error('❌ ファイル入力が見つかりません');
      await page.screenshot({ path: '/tmp/instagram-profile-no-input.png', fullPage: true });
      throw new Error('File input not found');
    }
    
    console.log('✅ ファイル入力発見');
    
    // ファイルをアップロード
    console.log('📤 画像アップロード中...');
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 「次へ」ボタンをクリック（テキストベース検索）
    async function clickNextButton() {
      return await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          const text = btn.innerText.toLowerCase();
          if (text.includes('next') || text.includes('次へ')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
    }
    
    // 次へ（1回目）
    console.log('⏭️  次へボタンをクリック（1回目）...');
    const next1 = await clickNextButton();
    console.log(next1 ? '✅ クリック成功' : '⚠️  ボタンが見つかりません');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 次へ（2回目）
    console.log('⏭️  次へボタンをクリック（2回目）...');
    const next2 = await clickNextButton();
    console.log(next2 ? '✅ クリック成功' : '⚠️  ボタンが見つかりません');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // キャプションを入力
    console.log('📝 キャプション入力中...');
    try {
      await page.waitForSelector('textarea', { timeout: 5000 });
      await page.type('textarea', caption, { delay: 50 });
      console.log('✅ キャプション入力完了');
    } catch (e) {
      console.warn('⚠️  キャプション入力フィールドが見つかりませんでした');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 「シェア」ボタンをクリック
    console.log('🚀 投稿中...');
    const shared = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.innerText.toLowerCase();
        if (text.includes('share') || text.includes('シェア')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    if (!shared) {
      console.error('❌ シェアボタンが見つかりません');
      await page.screenshot({ path: '/tmp/instagram-profile-no-share.png', fullPage: true });
      throw new Error('Share button not found');
    }
    
    console.log('✅ シェアボタンクリック成功');
    
    // 投稿完了を待つ
    console.log('⏳ 投稿完了を待機（15秒）...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    await page.screenshot({ path: '/tmp/instagram-profile-final.png', fullPage: true });
    
    console.log('✅ Instagram投稿完了！');
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

postToInstagram(imagePath, caption)
  .then(() => {
    console.log('✅ 処理完了');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 処理失敗:', error.message);
    process.exit(1);
  });
