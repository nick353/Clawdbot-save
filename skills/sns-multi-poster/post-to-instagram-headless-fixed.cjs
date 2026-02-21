#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - ヘッドレスモード改良版
 * 
 * 改善点:
 * - より確実な要素待機
 * - デバッグ情報強化
 * - リトライロジック改善
 * 
 * Usage: node post-to-instagram-headless-fixed.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-headless-fixed.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// デバッグ情報をキャプチャ
async function captureDebugInfo(page, label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = `/tmp/instagram-headless-${label}-${timestamp}.png`;
  const htmlPath = `/tmp/instagram-headless-${label}-${timestamp}.html`;
  
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const html = await page.content();
  fs.writeFileSync(htmlPath, html);
  
  console.log(`📸 スクリーンショット: ${screenshotPath}`);
  console.log(`📄 HTML: ${htmlPath}`);
  
  return { screenshotPath, htmlPath };
}

// より確実な要素待機
async function waitForElement(page, selectors, description, timeout = 30000) {
  console.log(`⏳ ${description} を待機中...`);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, element);
          
          if (isVisible) {
            console.log(`✅ ${description} 発見: ${selector}`);
            return element;
          }
        }
      } catch (e) {
        // 要素がまだない場合は続行
      }
    }
    
    // 1秒待機してリトライ
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.error(`❌ タイムアウト: ${description} が見つかりません`);
  return null;
}

// ボタンをテキストで探してクリック
async function clickButtonWithText(page, texts, timeout = 10000) {
  console.log(`🔍 ボタンテキスト検索: ${texts.join(', ')}`);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
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
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.error(`❌ ボタンが見つかりません: ${texts.join(', ')}`);
  return false;
}

async function postToInstagram(imagePath, caption) {
  console.log('📸 Instagram に投稿開始（ヘッドレス改良版）...');
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
    
    // Step 1: まず Instagram.com に空でアクセス（ドメイン確立のため）
    console.log('📂 Instagram.com ドメイン確立中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 2: Cookieを設定（URL デコード済み）
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    const decodedCookies = cookiesData.map(cookie => ({
      ...cookie,
      value: decodeURIComponent(cookie.value)
    }));
    await page.setCookie(...decodedCookies);
    console.log('🔐 Cookie設定完了（URLデコード済み）');
    
    // Step 3: リロードしてCookieを適用
    console.log('🔄 Cookieを適用してリロード中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // より長く待機（JavaScriptの実行を確実にする）
    console.log('⏳ JavaScriptの実行を待機中...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // ページ状態をキャプチャ
    await captureDebugInfo(page, 'after-load');
    
    // アカウント選択画面の処理
    const pageContent = await page.content();
    const hasAccountSelector = pageContent.includes('nisen_prints') || pageContent.includes('Log into Instagram');
    
    if (hasAccountSelector) {
      console.log('👤 アカウント選択画面を検出 → nisen_prints を選択中...');
      
      // nisen_prints のリンクをクリック
      const accountClicked = await page.evaluate(() => {
        // テキストで探す
        const allLinks = Array.from(document.querySelectorAll('a, button, [role="button"], div[class*="account"]'));
        for (const el of allLinks) {
          if (el.textContent && el.textContent.includes('nisen_prints')) {
            el.click();
            return true;
          }
        }
        return false;
      });
      
      if (accountClicked) {
        console.log('✅ nisen_prints をクリック、ログイン待機中...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        await captureDebugInfo(page, 'after-account-select');
      } else {
        console.warn('⚠️  nisen_prints が見つからず、別の方法を試みます...');
        // XPathで試す
        const [el] = await page.$x('//*[contains(text(), "nisen_prints")]');
        if (el) {
          await el.click();
          console.log('✅ XPath でクリック成功');
          await new Promise(resolve => setTimeout(resolve, 8000));
        } else {
          throw new Error('nisen_prints account selector not found');
        }
      }
    }
    
    // ログイン確認
    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login')) {
      console.error('❌ ログインしていません');
      await captureDebugInfo(page, 'not-logged-in');
      throw new Error('Not logged in');
    }
    
    console.log('✅ ログイン確認完了');
    
    // 新規投稿ボタンを探す（より長いタイムアウト）
    console.log('➕ 新規投稿ボタンを探しています...');
    
    const createPostSelectors = [
      'svg[aria-label="New post"]',
      'svg[aria-label="新規投稿"]',
      'svg[aria-label="Create"]',
      'a[href="#"] svg',
      'svg[aria-label*="New"]',
      'svg[aria-label*="作成"]'
    ];
    
    const createButton = await waitForElement(page, createPostSelectors, '新規投稿ボタン', 60000);
    
    if (!createButton) {
      console.error('❌ 新規投稿ボタンが見つかりません');
      await captureDebugInfo(page, 'no-create-button');
      throw new Error('Create button not found');
    }
    
    // ボタンをクリック
    try {
      await createButton.click();
      console.log('✅ 新規投稿ボタンクリック成功');
    } catch (e) {
      // JavaScript経由でクリック
      await page.evaluate(el => el.click(), createButton);
      console.log('✅ JSクリック成功');
    }
    
    // モーダルが表示されるまで待機
    console.log('⏳ モーダルの表示を待機中...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await captureDebugInfo(page, 'after-create-click');
    
    // ファイル入力を探す
    console.log('📷 ファイル入力を探しています...');
    
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      '[role="dialog"] input[type="file"]'
    ];
    
    const fileInput = await waitForElement(page, fileInputSelectors, 'ファイル入力', 30000);
    
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
    
    // 「次へ」ボタンをクリック（1回目）
    console.log('⏭️  次へボタンをクリック（1回目）...');
    const next1 = await clickButtonWithText(page, ['Next', '次へ', 'Weiter']);
    if (!next1) {
      await captureDebugInfo(page, 'no-next-1');
      throw new Error('Next button 1 not found');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 「次へ」ボタンをクリック（2回目）
    console.log('⏭️  次へボタンをクリック（2回目）...');
    const next2 = await clickButtonWithText(page, ['Next', '次へ', 'Weiter']);
    if (!next2) {
      await captureDebugInfo(page, 'no-next-2');
      throw new Error('Next button 2 not found');
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
    
    const textarea = await waitForElement(page, textareaSelectors, 'キャプション入力欄', 10000);
    if (textarea) {
      await textarea.type(caption, { delay: 50 });
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力フィールドが見つかりませんでした');
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
    
    console.log('✅ Instagram投稿成功！');
    
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
