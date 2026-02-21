#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト V3 - 超強化版
 * 
 * - JavaScript直接実行でクリック
 * - 30秒待機＋ポーリング
 * - 複数回クリック試行
 * 
 * Usage: node post-to-instagram-v3.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-v3.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// モーダルが表示されるまでポーリング
async function waitForModal(page, maxWaitMs = 30000) {
  const startTime = Date.now();
  let attempt = 0;
  
  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    console.log(`  ⏳ モーダル確認 (試行 ${attempt})...`);
    
    const modalExists = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const modal = document.querySelector('[aria-modal="true"]');
      const fileInput = document.querySelector('input[type="file"]');
      return !!(dialog || modal || fileInput);
    });
    
    if (modalExists) {
      console.log('  ✅ モーダル検出！');
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return false;
}

async function postToInstagram(imagePath, caption) {
  console.log('📸 Instagram に投稿開始（V3 超強化版）...');
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
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // より本物に近いUser-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    // ビューポートを大きめに
    await page.setViewport({ width: 1920, height: 1080 });
    
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
    
    // ページが完全に読み込まれるまで待機
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/accounts/login');
    });
    
    if (!isLoggedIn) {
      console.error('❌ ログインしていません');
      await page.screenshot({ path: '/tmp/instagram-v3-login-error.png' });
      throw new Error('Not logged in');
    }
    
    console.log('✅ ログイン確認完了');
    
    // 新規投稿ボタンをJavaScriptで直接クリック
    console.log('➕ 新規投稿ボタンをクリック（JavaScript強制実行）...');
    
    const clickSuccess = await page.evaluate(() => {
      // 複数の方法でボタンを探す
      const selectors = [
        'svg[aria-label="New post"]',
        'a[href="#"]:has(svg[aria-label="New post"])',
        '[aria-label="New post"]'
      ];
      
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            // SVGの場合、親のaタグを探す
            let target = element;
            if (element.tagName === 'svg') {
              target = element.closest('a') || element;
            }
            
            // 複数のクリック方法を試す
            target.click();
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            
            console.log(`✅ クリック実行: ${selector}`);
            return true;
          }
        } catch (e) {
          console.log(`❌ 失敗: ${selector}`);
        }
      }
      return false;
    });
    
    if (!clickSuccess) {
      console.error('❌ ボタンのクリックに失敗しました');
      await page.screenshot({ path: '/tmp/instagram-v3-no-button.png' });
      throw new Error('ボタンが見つかりません');
    }
    
    console.log('✅ クリック成功');
    
    // モーダルが表示されるまで待機（ポーリング）
    console.log('⏳ モーダルの表示を待機中（最大30秒、ポーリング）...');
    const modalAppeared = await waitForModal(page, 30000);
    
    if (!modalAppeared) {
      console.error('❌ モーダルが30秒待っても表示されませんでした');
      await page.screenshot({ path: '/tmp/instagram-v3-no-modal.png', fullPage: true });
      
      // ページの状態をデバッグ
      const debugInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          dialogCount: document.querySelectorAll('[role="dialog"]').length,
          modalCount: document.querySelectorAll('[aria-modal="true"]').length,
          fileInputCount: document.querySelectorAll('input[type="file"]').length,
          bodyText: document.body.innerText.substring(0, 500)
        };
      });
      
      console.log('🔍 デバッグ情報:', JSON.stringify(debugInfo, null, 2));
      
      // HTMLを保存
      const html = await page.content();
      fs.writeFileSync('/tmp/instagram-v3-no-modal.html', html);
      
      throw new Error('モーダルが表示されません');
    }
    
    console.log('✅ モーダル表示確認');
    
    // モーダルが完全に描画されるまで待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // ファイル入力を探す
    console.log('📷 ファイル入力を探しています...');
    
    const fileInputSelectors = [
      'input[type="file"]',
      '[role="dialog"] input[type="file"]',
      'input[accept*="image"]'
    ];
    
    let fileInput = null;
    for (const selector of fileInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
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
      await page.screenshot({ path: '/tmp/instagram-v3-no-file-input.png', fullPage: true });
      
      // すべてのinput要素を確認
      const allInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          accept: input.accept,
          id: input.id,
          className: input.className,
          visible: input.offsetParent !== null
        }));
      });
      
      console.log('🔍 全input要素:', JSON.stringify(allInputs, null, 2));
      
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
    try {
      await page.waitForSelector('button:has-text("Next")', { timeout: 5000 });
      await page.click('button:has-text("Next")');
      console.log('✅ 次へ（1回目）');
    } catch (e) {
      console.log('⚠️  次へボタン（1回目）が見つかりません');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 「次へ」ボタンをクリック（2回目）
    console.log('⏭️  次へボタンをクリック（2回目）...');
    try {
      await page.waitForSelector('button:has-text("Next")', { timeout: 5000 });
      await page.click('button:has-text("Next")');
      console.log('✅ 次へ（2回目）');
    } catch (e) {
      console.log('⚠️  次へボタン（2回目）が見つかりません');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // キャプションを入力
    console.log('📝 キャプション入力中...');
    try {
      await page.waitForSelector('textarea', { timeout: 5000 });
      await page.type('textarea', caption);
      console.log('✅ キャプション入力完了');
    } catch (e) {
      console.log('⚠️  キャプション入力フィールドが見つかりません');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 「シェア」ボタンをクリック
    console.log('🚀 投稿中...');
    try {
      await page.waitForSelector('button:has-text("Share")', { timeout: 5000 });
      await page.click('button:has-text("Share")');
      console.log('✅ シェアボタンをクリック');
    } catch (e) {
      console.log('⚠️  シェアボタンが見つかりません');
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
      await page.screenshot({ path: '/tmp/instagram-v3-success.png' });
    } else {
      console.log('⚠️  投稿完了を確認できませんでした');
      await page.screenshot({ path: '/tmp/instagram-v3-final.png', fullPage: true });
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
