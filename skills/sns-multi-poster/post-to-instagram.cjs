#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - Cookie認証版
 * 
 * Usage: node post-to-instagram.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram.cjs <image_path> <caption>');
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
    
    // User-Agent設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Cookieを読み込み
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    
    // Cookieを設定
    await page.setCookie(...cookiesData);
    console.log('🔐 Cookie設定完了');
    
    // Instagramにアクセス
    console.log('📂 Instagram.comにアクセス中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // ページが読み込まれるまで待機
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/accounts/login');
    });
    
    if (!isLoggedIn) {
      console.error('❌ ログインしていません。Cookieが無効の可能性があります。');
      await page.screenshot({ path: '/tmp/instagram-login-error.png' });
      console.log('📸 スクリーンショット保存: /tmp/instagram-login-error.png');
      throw new Error('Not logged in');
    }
    
    console.log('✅ ログイン確認完了');
    
    // 新規投稿ボタンを探してクリック
    console.log('➕ 新規投稿ボタンを探しています...');
    
    // 「作成」ボタン（Create post）を探す
    const createButtonSelectors = [
      'svg[aria-label="New post"]',
      'a[href="#"]',
      '[aria-label="新規投稿"]',
      '[aria-label="Create"]'
    ];
    
    let createButtonClicked = false;
    for (const selector of createButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        console.log(`✅ 新規投稿ボタンをクリック: ${selector}`);
        createButtonClicked = true;
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    if (!createButtonClicked) {
      // ナビゲーションバーの「+」アイコンを探す
      const plusButton = await page.$('svg[aria-label="New post"]');
      if (plusButton) {
        await plusButton.click();
        console.log('✅ 新規投稿ボタンをクリック（SVG）');
      } else {
        await page.screenshot({ path: '/tmp/instagram-no-create-button.png' });
        throw new Error('新規投稿ボタンが見つかりません');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ファイル選択ダイアログを開く
    console.log('📷 ファイル選択ダイアログを開いています...');
    
    // 「Select from computer」ボタンを探してクリック
    const selectButtonSelectors = [
      'button:has-text("Select from computer")',
      'button:has-text("コンピューターから選択")',
      '[role="button"]:has-text("Select")'
    ];
    
    for (const selector of selectButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        console.log(`✅ Select from computerボタンをクリック: ${selector}`);
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ファイル入力を探す
    const fileInputSelectors = [
      'input[type="file"][accept="image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime"]',
      'input[type="file"]',
      'input[accept*="image"]'
    ];
    
    let fileInput = null;
    for (const selector of fileInputSelectors) {
      fileInput = await page.$(selector);
      if (fileInput) {
        console.log(`✅ ファイル入力を発見: ${selector}`);
        break;
      }
    }
    
    if (!fileInput) {
      console.error('❌ ファイル入力が見つかりません');
      await page.screenshot({ path: '/tmp/instagram-no-file-input.png' });
      
      // ページのHTMLを保存（デバッグ用）
      const html = await page.content();
      fs.writeFileSync('/tmp/instagram-page.html', html);
      console.log('💾 ページHTML保存: /tmp/instagram-page.html');
      
      throw new Error('File input not found');
    }
    
    // ファイルをアップロード
    console.log('📤 画像アップロード中...');
    await fileInput.uploadFile(imagePath);
    
    console.log('✅ 画像アップロード開始');
    
    // アップロード完了を待つ
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 「次へ」ボタンをクリック
    console.log('⏭️  次へボタンをクリック...');
    const nextButtonSelectors = [
      'button:has-text("Next")',
      'button:has-text("次へ")',
      '[role="button"]:has-text("Next")'
    ];
    
    for (const selector of nextButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        console.log('✅ 次へボタンをクリック（1回目）');
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // もう一度「次へ」をクリック（フィルター画面をスキップ）
    for (const selector of nextButtonSelectors) {
      try {
        await page.click(selector);
        console.log('✅ 次へボタンをクリック（2回目）');
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // キャプションを入力
    console.log('📝 キャプション入力中...');
    const captionTextarea = await page.$('textarea[aria-label="Write a caption..."], textarea[placeholder="Write a caption..."]');
    
    if (captionTextarea) {
      await captionTextarea.type(caption, { delay: 50 });
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力欄が見つかりません（スキップ）');
    }
    
    // スクリーンショット（投稿前の確認）
    await page.screenshot({ path: '/tmp/instagram-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/instagram-before-post.png');
    
    // DRY RUN: 実際には投稿しない
    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: 投稿ボタンは押しません');
      console.log('✅ テスト完了（投稿なし）');
      return { success: true, dryRun: true };
    }
    
    // 「シェア」ボタンをクリック
    console.log('📤 シェアボタンをクリック...');
    const shareButtonSelectors = [
      'button:has-text("Share")',
      'button:has-text("シェア")',
      '[role="button"]:has-text("Share")'
    ];
    
    for (const selector of shareButtonSelectors) {
      try {
        await page.click(selector);
        console.log('✅ シェアボタンをクリック');
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    // 投稿完了を待つ
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 投稿後のスクリーンショット
    await page.screenshot({ path: '/tmp/instagram-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/instagram-after-post.png');
    
    console.log('✅ Instagram投稿完了！');
    
    return { 
      success: true, 
      platform: 'Instagram', 
      screenshot: '/tmp/instagram-after-post.png' 
    };
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    
    // エラー時のスクリーンショット
    try {
      await page.screenshot({ path: '/tmp/instagram-error.png' });
      console.log('📸 エラースクリーンショット: /tmp/instagram-error.png');
    } catch (e) {
      // スクリーンショット取得失敗は無視
    }
    
    throw error;
  } finally {
    await browser.close();
  }
}

// 実行
postToInstagram(imagePath, caption)
  .then(result => {
    console.log('\n✅ 投稿成功！');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 投稿失敗:', error.message);
    process.exit(1);
  });
