#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト V2 - 改良版
 * 
 * Usage: node post-to-instagram-v2.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-v2.cjs <image_path> <caption>');
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
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // ページが読み込まれるまで待機
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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
    
    // 新規投稿ボタンを探してクリック（改良版）
    console.log('➕ 新規投稿ボタンを探しています...');
    
    // 複数のセレクタを試す（優先順位順）
    const createButtonSelectors = [
      // 左サイドバーの「Create」ボタン（最優先）
      'a[href="#"]:has(svg[aria-label="New post"])',
      'a[role="link"] svg[aria-label="New post"]',
      // 代替セレクタ
      'svg[aria-label="New post"]',
      '[aria-label="New post"]',
      'a[href*="/create"]',
      // 日本語版
      '[aria-label="新規投稿"]',
      'svg[aria-label="作成"]'
    ];
    
    let createButtonClicked = false;
    
    for (const selector of createButtonSelectors) {
      try {
        console.log(`  🔍 試行中: ${selector}`);
        await page.waitForSelector(selector, { timeout: 3000 });
        
        // SVGの場合、親のaタグをクリック
        if (selector.includes('svg')) {
          const svgElement = await page.$(selector);
          if (svgElement) {
            // 親のaタグを探す
            const parentLink = await page.evaluateHandle(
              el => el.closest('a'),
              svgElement
            );
            if (parentLink) {
              await parentLink.click();
              console.log(`✅ 新規投稿ボタンをクリック（親要素経由）: ${selector}`);
              createButtonClicked = true;
              break;
            }
          }
        } else {
          await page.click(selector);
          console.log(`✅ 新規投稿ボタンをクリック: ${selector}`);
          createButtonClicked = true;
          break;
        }
      } catch (e) {
        console.log(`  ❌ 失敗: ${e.message}`);
      }
    }
    
    if (!createButtonClicked) {
      console.error('❌ 新規投稿ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/instagram-no-create-button.png' });
      throw new Error('新規投稿ボタンが見つかりません');
    }
    
    // モーダルの読み込みを待つ（長めに）
    console.log('⏳ モーダルの読み込みを待機（10秒）...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // モーダルが表示されたか確認
    console.log('🔍 モーダルの存在を確認...');
    const modalExists = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const modal = document.querySelector('[aria-modal="true"]');
      const fileInput = document.querySelector('input[type="file"]');
      return !!(dialog || modal || fileInput);
    });
    
    if (!modalExists) {
      console.error('❌ モーダルが表示されませんでした');
      await page.screenshot({ path: '/tmp/instagram-no-modal.png' });
      const html = await page.content();
      fs.writeFileSync('/tmp/instagram-no-modal.html', html);
      throw new Error('モーダルが表示されません');
    }
    
    console.log('✅ モーダル表示確認');
    
    // ファイル入力を探す
    console.log('📷 ファイル入力を探しています...');
    
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      '[role="dialog"] input[type="file"]'
    ];
    
    let fileInput = null;
    for (const selector of fileInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        fileInput = await page.$(selector);
        if (fileInput) {
          console.log(`✅ ファイル入力発見: ${selector}`);
          break;
        }
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    if (!fileInput) {
      console.error('❌ ファイル入力が見つかりません');
      await page.screenshot({ path: '/tmp/instagram-no-file-input.png' });
      const html = await page.content();
      fs.writeFileSync('/tmp/instagram-no-file-input.html', html);
      throw new Error('ファイル入力が見つかりません');
    }
    
    // ファイルをアップロード
    console.log('📤 画像アップロード中...');
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');
    
    // アップロード完了を待つ
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 「次へ」ボタンをクリック（1回目）
    console.log('⏭️  次へボタンをクリック（1回目）...');
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
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 「次へ」ボタンをクリック（2回目: フィルター画面をスキップ）
    console.log('⏭️  次へボタンをクリック（2回目）...');
    for (const selector of nextButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        console.log('✅ 次へボタンをクリック（2回目）');
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // キャプションを入力
    console.log('📝 キャプション入力中...');
    const captionInputSelectors = [
      'textarea[aria-label="Write a caption..."]',
      'textarea[placeholder="Write a caption..."]',
      'textarea'
    ];
    
    for (const selector of captionInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.type(selector, caption);
        console.log('✅ キャプション入力完了');
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 「シェア」ボタンをクリック
    console.log('🚀 投稿中...');
    const shareButtonSelectors = [
      'button:has-text("Share")',
      'button:has-text("シェア")',
      '[role="button"]:has-text("Share")'
    ];
    
    for (const selector of shareButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        console.log('✅ シェアボタンをクリック');
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }
    
    // 投稿完了を待つ
    console.log('⏳ 投稿完了を待機（10秒）...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 投稿完了確認
    const postSuccessful = await page.evaluate(() => {
      const successText = document.body.innerText;
      return successText.includes('Your post has been shared') || 
             successText.includes('投稿がシェアされました') ||
             window.location.href.includes('/p/');
    });
    
    if (postSuccessful) {
      console.log('✅ Instagram投稿成功！');
      await page.screenshot({ path: '/tmp/instagram-success.png' });
    } else {
      console.error('⚠️  投稿完了を確認できませんでした（タイムアウトの可能性）');
      await page.screenshot({ path: '/tmp/instagram-timeout.png' });
    }
    
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
