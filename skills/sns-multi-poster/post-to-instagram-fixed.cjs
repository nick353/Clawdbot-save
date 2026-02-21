#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - Cookie認証版（修正版）
 * 
 * Usage: node post-to-instagram-fixed.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-fixed.cjs <image_path> <caption>');
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
    if (!fs.existsSync(cookiesPath)) {
      console.error('❌ Cookieファイルが見つかりません:', cookiesPath);
      throw new Error('Cookie file not found');
    }
    
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookiesData);
    console.log('✅ Cookie設定完了');
    
    // Instagramにアクセス
    console.log('📂 Instagram.comにアクセス中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
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
    
    // スクリーンショット: ホーム画面
    await page.screenshot({ path: '/tmp/instagram-before-create.png' });
    console.log('📸 スクリーンショット: /tmp/instagram-before-create.png');
    
    // 新規投稿ボタンを探してクリック（SVG aria-label）
    console.log('➕ 新規投稿ボタンを探しています...');
    
    // 方法1: SVG aria-labelで探す
    let createButtonClicked = false;
    try {
      const createButton = await page.waitForSelector('svg[aria-label*="New"], svg[aria-label*="Create"], svg[aria-label*="新規"]', { timeout: 5000 });
      if (createButton) {
        await createButton.click();
        console.log('✅ 新規投稿ボタンをクリック（SVG aria-label）');
        createButtonClicked = true;
      }
    } catch (e) {
      console.log('⚠️  SVG aria-labelで見つかりませんでした');
    }
    
    // 方法2: XPathでテキスト検索
    if (!createButtonClicked) {
      try {
        const [createLink] = await page.$x("//a[contains(@href, '/create/')]");
        if (createLink) {
          await createLink.click();
          console.log('✅ 新規投稿ボタンをクリック（XPath href）');
          createButtonClicked = true;
        }
      } catch (e) {
        console.log('⚠️  XPath hrefで見つかりませんでした');
      }
    }
    
    // 方法3: ナビゲーションバーの「+」アイコン
    if (!createButtonClicked) {
      try {
        const plusButton = await page.$('a[href="#"] svg, [role="link"] svg');
        if (plusButton) {
          await plusButton.click();
          console.log('✅ 新規投稿ボタンをクリック（ナビゲーションSVG）');
          createButtonClicked = true;
        }
      } catch (e) {
        console.log('⚠️  ナビゲーションSVGで見つかりませんでした');
      }
    }
    
    if (!createButtonClicked) {
      await page.screenshot({ path: '/tmp/instagram-no-create-button.png' });
      console.error('❌ 新規投稿ボタンが見つかりません');
      throw new Error('新規投稿ボタンが見つかりません');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // スクリーンショット: モーダル表示後
    await page.screenshot({ path: '/tmp/instagram-after-create.png' });
    console.log('📸 スクリーンショット: /tmp/instagram-after-create.png');
    
    // ファイル入力を直接探す（モーダル内）
    console.log('📷 ファイル入力を探しています...');
    
    const fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      // 「Select from computer」ボタンを探してクリック
      console.log('🔍 Select from computerボタンを探しています...');
      
      // XPathでテキスト検索
      const selectButtons = await page.$x("//button[contains(., 'Select from computer')] | //button[contains(., 'コンピューターから選択')]");
      
      if (selectButtons.length > 0) {
        await selectButtons[0].click();
        console.log('✅ Select from computerボタンをクリック');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // ページのHTMLを保存（デバッグ用）
        const html = await page.content();
        fs.writeFileSync('/tmp/instagram-modal.html', html);
        console.log('💾 モーダルHTML保存: /tmp/instagram-modal.html');
        
        // 全てのボタンを探す
        const allButtons = await page.$$eval('button, [role="button"]', buttons => {
          return buttons.map(b => b.textContent?.substring(0, 50)).filter(t => t);
        });
        console.log('📋 モーダル内のボタン一覧:', allButtons);
        
        console.error('❌ Select from computerボタンが見つかりません');
      }
    }
    
    // ファイル入力を再度探す
    const fileInputFinal = await page.$('input[type="file"]');
    
    if (!fileInputFinal) {
      await page.screenshot({ path: '/tmp/instagram-no-file-input.png' });
      console.error('❌ ファイル入力が見つかりません');
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
    await fileInputFinal.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');
    
    // アップロード完了を待つ
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // スクリーンショット: アップロード後
    await page.screenshot({ path: '/tmp/instagram-after-upload.png' });
    console.log('📸 スクリーンショット: /tmp/instagram-after-upload.png');
    
    // 「次へ」ボタンをクリック（XPathでテキスト検索）
    console.log('⏭️  次へボタンをクリック...');
    
    const nextButtons1 = await page.$x("//button[contains(., 'Next')] | //button[contains(., '次へ')]");
    if (nextButtons1.length > 0) {
      await nextButtons1[0].click();
      console.log('✅ 次へボタンをクリック（1回目）');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // もう一度「次へ」をクリック（フィルター画面をスキップ）
    const nextButtons2 = await page.$x("//button[contains(., 'Next')] | //button[contains(., '次へ')]");
    if (nextButtons2.length > 0) {
      await nextButtons2[0].click();
      console.log('✅ 次へボタンをクリック（2回目）');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // キャプション入力
    console.log('📝 キャプション入力中...');
    const captionTextarea = await page.$('textarea[aria-label*="caption"], textarea[placeholder*="caption"]');
    
    if (captionTextarea) {
      await captionTextarea.type(caption);
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力欄が見つかりません');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // スクリーンショット: 投稿前
    await page.screenshot({ path: '/tmp/instagram-before-share.png' });
    console.log('📸 スクリーンショット: /tmp/instagram-before-share.png');
    
    // 「シェア」ボタンをクリック
    console.log('📤 投稿中...');
    const shareButtons = await page.$x("//button[contains(., 'Share')] | //button[contains(., 'シェア')]");
    
    if (shareButtons.length > 0) {
      await shareButtons[0].click();
      console.log('✅ シェアボタンをクリック');
    } else {
      console.error('❌ シェアボタンが見つかりません');
      throw new Error('Share button not found');
    }
    
    // 投稿完了を待つ
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // スクリーンショット: 投稿後
    await page.screenshot({ path: '/tmp/instagram-after-share.png' });
    console.log('📸 スクリーンショット: /tmp/instagram-after-share.png');
    
    console.log('✅ Instagram投稿完了！');
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    
    // エラー時のスクリーンショット
    try {
      await page.screenshot({ path: '/tmp/instagram-error.png' });
      console.log('📸 エラースクリーンショット: /tmp/instagram-error.png');
    } catch (e) {
      // スクリーンショット失敗は無視
    }
    
    throw error;
  } finally {
    await browser.close();
  }
}

postToInstagram(imagePath, caption).catch(error => {
  console.error('❌ 投稿失敗:', error.message);
  process.exit(1);
});
