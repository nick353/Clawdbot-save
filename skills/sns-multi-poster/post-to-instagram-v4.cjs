#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト V4 - 最新UI対応・安定版
 * 
 * 改善点:
 * - より安定したセレクタ使用
 * - Instagram最新UI対応
 * - デバッグ情報強化
 * - エラーハンドリング改善
 * 
 * Usage: node post-to-instagram-v4.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-v4.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// デバッグ情報をキャプチャ
async function captureDebugInfo(page, label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = `/tmp/instagram-v4-${label}-${timestamp}.png`;
  const htmlPath = `/tmp/instagram-v4-${label}-${timestamp}.html`;
  
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const html = await page.content();
  fs.writeFileSync(htmlPath, html);
  
  const pageInfo = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
      modalCount: document.querySelectorAll('[aria-modal="true"]').length,
      fileInputCount: document.querySelectorAll('input[type="file"]').length,
      buttonCount: document.querySelectorAll('button').length,
      bodyPreview: document.body.innerText.substring(0, 300)
    };
  });
  
  console.log(`📊 デバッグ情報 (${label}):`, JSON.stringify(pageInfo, null, 2));
  console.log(`📸 スクリーンショット: ${screenshotPath}`);
  console.log(`📄 HTML: ${htmlPath}`);
}

// 要素を待機してクリック（リトライ付き）
async function waitAndClick(page, selectors, description, maxRetries = 3) {
  for (let retry = 0; retry < maxRetries; retry++) {
    console.log(`🖱️  ${description} をクリック試行 (${retry + 1}/${maxRetries})...`);
    
    for (const selector of selectors) {
      try {
        // 要素が存在するか確認
        const element = await page.$(selector);
        if (element) {
          // 要素が表示されているか確認
          const isVisible = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.top >= 0;
          }, element);
          
          if (isVisible) {
            console.log(`  ✅ 要素発見: ${selector}`);
            
            // クリック試行（複数の方法）
            try {
              await element.click();
              console.log(`  ✅ クリック成功: ${selector}`);
              return true;
            } catch (clickError) {
              // JavaScript経由でクリック
              await page.evaluate(el => el.click(), element);
              console.log(`  ✅ JSクリック成功: ${selector}`);
              return true;
            }
          }
        }
      } catch (e) {
        console.log(`  ⏭️  ${selector}: ${e.message}`);
      }
    }
    
    // リトライ前に待機
    if (retry < maxRetries - 1) {
      console.log(`  ⏳ 3秒待機してリトライ...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.error(`❌ ${description} のクリックに失敗しました`);
  return false;
}

// テキストを含むボタンを探してクリック
async function clickButtonWithText(page, texts, maxRetries = 3) {
  for (let retry = 0; retry < maxRetries; retry++) {
    console.log(`🔍 ボタンテキスト検索 (${retry + 1}/${maxRetries}): ${texts.join(', ')}`);
    
    const clicked = await page.evaluate((textsToFind) => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      
      for (const button of buttons) {
        const buttonText = button.innerText.trim().toLowerCase();
        
        for (const searchText of textsToFind) {
          if (buttonText.includes(searchText.toLowerCase())) {
            console.log(`✅ ボタン発見: "${buttonText}"`);
            button.click();
            return true;
          }
        }
      }
      
      return false;
    }, texts);
    
    if (clicked) {
      console.log(`✅ ボタンクリック成功`);
      return true;
    }
    
    if (retry < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.error(`❌ ボタンが見つかりません: ${texts.join(', ')}`);
  return false;
}

async function postToInstagram(imagePath, caption) {
  console.log('📸 Instagram に投稿開始（V4 安定版）...');
  console.log(`📝 キャプション: ${caption.substring(0, 100)}...`);
  console.log(`🖼️  画像: ${imagePath}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // User-Agent設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Cookieを読み込み
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    if (!fs.existsSync(cookiesPath)) {
      console.error('❌ Cookieファイルが見つかりません:', cookiesPath);
      throw new Error('Cookie file not found');
    }
    
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookiesData);
    console.log('🔐 Cookie設定完了');
    
    // Instagramにアクセス
    console.log('📂 Instagram.comにアクセス中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // ページ読み込み完了を待つ
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/accounts/login');
    });
    
    if (!isLoggedIn) {
      console.error('❌ ログインしていません');
      await captureDebugInfo(page, 'not-logged-in');
      throw new Error('Not logged in');
    }
    
    console.log('✅ ログイン確認完了');
    await captureDebugInfo(page, 'logged-in');
    
    // 新規投稿ボタンをクリック
    console.log('➕ 新規投稿ボタンを探しています...');
    
    const createPostSelectors = [
      'svg[aria-label="New post"]',
      'svg[aria-label="新規投稿"]',
      'svg[aria-label="Create"]',
      'a[href="#"] svg[aria-label*="New"]',
      'a[href="#"] svg[aria-label*="作成"]'
    ];
    
    const createButtonClicked = await waitAndClick(page, createPostSelectors, '新規投稿ボタン', 5);
    
    if (!createButtonClicked) {
      console.error('❌ 新規投稿ボタンが見つかりません');
      await captureDebugInfo(page, 'no-create-button');
      throw new Error('Create button not found');
    }
    
    console.log('✅ 新規投稿ボタンクリック成功');
    
    // モーダルが表示されるまで待機
    console.log('⏳ モーダルの表示を待機中...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // モーダル内のファイル入力を探す
    console.log('📷 ファイル入力を探しています...');
    
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      '[role="dialog"] input[type="file"]'
    ];
    
    let fileInput = null;
    for (const selector of fileInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        fileInput = await page.$(selector);
        if (fileInput) {
          console.log(`✅ ファイル入力発見: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`  ⏭️  ${selector}: 見つかりません`);
      }
    }
    
    if (!fileInput) {
      console.error('❌ ファイル入力が見つかりません');
      await captureDebugInfo(page, 'no-file-input');
      throw new Error('File input not found');
    }
    
    // ファイルをアップロード
    console.log('📤 画像アップロード中...');
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');
    
    // アップロード処理を待つ
    await new Promise(resolve => setTimeout(resolve, 5000));
    await captureDebugInfo(page, 'after-upload');
    
    // 「次へ」ボタンをクリック（1回目 - 編集画面へ）
    console.log('⏭️  次へボタンをクリック（1回目）...');
    const next1 = await clickButtonWithText(page, ['Next', '次へ', 'Weiter']);
    if (!next1) {
      await captureDebugInfo(page, 'no-next-1');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 「次へ」ボタンをクリック（2回目 - キャプション入力画面へ）
    console.log('⏭️  次へボタンをクリック（2回目）...');
    const next2 = await clickButtonWithText(page, ['Next', '次へ', 'Weiter']);
    if (!next2) {
      await captureDebugInfo(page, 'no-next-2');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    await captureDebugInfo(page, 'caption-screen');
    
    // キャプションを入力
    console.log('📝 キャプション入力中...');
    const textareaSelectors = [
      'textarea[aria-label*="caption"]',
      'textarea[aria-label*="キャプション"]',
      'textarea[placeholder*="caption"]',
      'textarea'
    ];
    
    let captionEntered = false;
    for (const selector of textareaSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.type(selector, caption, { delay: 50 });
        console.log(`✅ キャプション入力完了: ${selector}`);
        captionEntered = true;
        break;
      } catch (e) {
        console.log(`  ⏭️  ${selector}: 見つかりません`);
      }
    }
    
    if (!captionEntered) {
      console.warn('⚠️  キャプション入力フィールドが見つかりませんでした');
      await captureDebugInfo(page, 'no-caption-field');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 「シェア」ボタンをクリック
    console.log('🚀 投稿中...');
    const shareClicked = await clickButtonWithText(page, ['Share', 'シェア', 'Teilen', 'Post']);
    
    if (!shareClicked) {
      console.error('❌ シェアボタンが見つかりません');
      await captureDebugInfo(page, 'no-share-button');
      throw new Error('Share button not found');
    }
    
    console.log('✅ シェアボタンクリック成功');
    
    // 投稿完了を待つ
    console.log('⏳ 投稿完了を待機（15秒）...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    await captureDebugInfo(page, 'after-share');
    
    // 投稿完了確認
    const postSuccessful = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return bodyText.includes('shared') || 
             bodyText.includes('シェアされました') ||
             bodyText.includes('投稿') ||
             window.location.href.includes('/p/');
    });
    
    if (postSuccessful) {
      console.log('✅ Instagram投稿成功！');
    } else {
      console.log('⚠️  投稿完了を確認できませんでした（投稿は成功している可能性があります）');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('📚 スタックトレース:', error.stack);
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
