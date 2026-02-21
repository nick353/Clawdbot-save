#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - ドライランテスト版
 * 
 * シェアボタンを押さずに、デバッグ情報だけ収集します
 * 
 * Usage: node post-to-instagram-dryrun.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3] || 'Test caption from dry run';

if (!imagePath) {
  console.error('使い方: node post-to-instagram-dryrun.cjs <image_path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// デバッグ情報をキャプチャ
async function captureDebugInfo(page, label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = `/tmp/instagram-dryrun-${label}-${timestamp}.png`;
  const htmlPath = `/tmp/instagram-dryrun-${label}-${timestamp}.html`;
  
  try {
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
        textareaCount: document.querySelectorAll('textarea').length,
        allButtons: Array.from(document.querySelectorAll('button, [role="button"]'))
          .slice(0, 20)
          .map(btn => ({
            text: btn.innerText.trim().substring(0, 50),
            ariaLabel: btn.getAttribute('aria-label')
          })),
        bodyPreview: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log(`\n📊 ========== デバッグ情報 (${label}) ==========`);
    console.log(JSON.stringify(pageInfo, null, 2));
    console.log(`📸 スクリーンショット: ${screenshotPath}`);
    console.log(`📄 HTML: ${htmlPath}`);
    console.log(`================================================\n`);
    
    return pageInfo;
  } catch (e) {
    console.error(`❌ デバッグ情報取得失敗 (${label}):`, e.message);
  }
}

// 要素を探す（クリックしない）
async function findElement(page, selectors, description) {
  console.log(`🔍 ${description} を探しています...`);
  
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, element);
        
        if (isVisible) {
          console.log(`  ✅ 要素発見: ${selector}`);
          return { found: true, selector };
        } else {
          console.log(`  ⚠️  要素は存在するが非表示: ${selector}`);
        }
      } else {
        console.log(`  ❌ 要素なし: ${selector}`);
      }
    } catch (e) {
      console.log(`  ❌ エラー (${selector}):`, e.message);
    }
  }
  
  console.log(`❌ ${description} が見つかりません\n`);
  return { found: false };
}

// テキストを含むボタンを探す
async function findButtonWithText(page, texts) {
  console.log(`🔍 ボタンテキスト検索: ${texts.join(', ')}`);
  
  const result = await page.evaluate((textsToFind) => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    const found = [];
    
    for (const button of buttons) {
      const buttonText = button.innerText.trim().toLowerCase();
      
      for (const searchText of textsToFind) {
        if (buttonText.includes(searchText.toLowerCase())) {
          found.push({
            text: button.innerText.trim(),
            ariaLabel: button.getAttribute('aria-label'),
            className: button.className
          });
        }
      }
    }
    
    return found;
  }, texts);
  
  if (result.length > 0) {
    console.log(`✅ ボタン発見 (${result.length}個):`);
    result.forEach((btn, i) => {
      console.log(`  ${i + 1}. "${btn.text}" (aria-label: ${btn.ariaLabel})`);
    });
  } else {
    console.log(`❌ ボタンが見つかりません\n`);
  }
  
  return result;
}

async function dryRunTest(imagePath, caption) {
  console.log('🧪 Instagram ドライランテスト開始...');
  console.log(`📝 キャプション: ${caption.substring(0, 100)}...`);
  console.log(`🖼️  画像: ${imagePath}`);
  console.log('⚠️  注意: 実際の投稿は行いません\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
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
    
    // Cookieを読み込み
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    if (!fs.existsSync(cookiesPath)) {
      console.error('❌ Cookieファイルが見つかりません:', cookiesPath);
      throw new Error('Cookie file not found');
    }
    
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookiesData);
    console.log('🔐 Cookie設定完了\n');
    
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
    console.log(`ログイン状態: ${isLoggedIn ? '✅ ログイン済み' : '❌ ログインしていません'}\n`);
    
    if (!isLoggedIn) {
      await captureDebugInfo(page, 'not-logged-in');
      throw new Error('Not logged in');
    }
    
    await captureDebugInfo(page, '1-logged-in');
    
    // 新規投稿ボタンを探す
    console.log('========== STEP 1: 新規投稿ボタン ==========\n');
    
    const createPostSelectors = [
      'svg[aria-label="New post"]',
      'svg[aria-label="新規投稿"]',
      'svg[aria-label="Create"]',
      'svg[aria-label="作成"]',
      'a[href="#"] svg[aria-label*="New"]',
      'a[href="#"] svg[aria-label*="作成"]'
    ];
    
    const createButtonResult = await findElement(page, createPostSelectors, '新規投稿ボタン');
    
    if (!createButtonResult.found) {
      console.log('⚠️  標準的なセレクタで見つかりません。全SVG要素を確認...\n');
      
      const allSvgs = await page.evaluate(() => {
        const svgs = Array.from(document.querySelectorAll('svg'));
        return svgs.map(svg => ({
          ariaLabel: svg.getAttribute('aria-label'),
          parentHref: svg.closest('a')?.getAttribute('href'),
          visible: svg.offsetParent !== null
        })).filter(s => s.ariaLabel);
      });
      
      console.log('📋 全SVG要素 (aria-label付き):');
      console.log(JSON.stringify(allSvgs, null, 2));
      console.log('');
    }
    
    // 新規投稿ボタンをクリック（実際にクリックする）
    if (createButtonResult.found) {
      console.log('🖱️  新規投稿ボタンをクリック...');
      await page.click(createButtonResult.selector);
      console.log('✅ クリック実行\n');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('⚠️  新規投稿ボタンが見つからないため、スキップ\n');
    }
    
    await captureDebugInfo(page, '2-after-create-click');
    
    // モーダル/ダイアログを確認
    console.log('========== STEP 2: モーダル確認 ==========\n');
    
    const modalInfo = await page.evaluate(() => {
      return {
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        modals: document.querySelectorAll('[aria-modal="true"]').length,
        fileInputs: document.querySelectorAll('input[type="file"]').length
      };
    });
    
    console.log('モーダル情報:', modalInfo);
    console.log('');
    
    // ファイル入力を探す
    console.log('========== STEP 3: ファイル入力 ==========\n');
    
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      '[role="dialog"] input[type="file"]'
    ];
    
    const fileInputResult = await findElement(page, fileInputSelectors, 'ファイル入力');
    
    if (!fileInputResult.found) {
      console.log('⚠️  全input要素を確認...\n');
      
      const allInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          accept: input.accept,
          visible: input.offsetParent !== null,
          id: input.id,
          name: input.name
        }));
      });
      
      console.log('📋 全input要素:');
      console.log(JSON.stringify(allInputs, null, 2));
      console.log('');
    } else {
      // ファイルアップロード（実際に実行）
      console.log('📤 画像アップロード中...');
      const fileInput = await page.$(fileInputResult.selector);
      await fileInput.uploadFile(imagePath);
      console.log('✅ 画像アップロード完了\n');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      await captureDebugInfo(page, '3-after-upload');
      
      // 「次へ」ボタンを探す（1回目）
      console.log('========== STEP 4: 次へボタン（1回目） ==========\n');
      await findButtonWithText(page, ['Next', '次へ', 'Weiter']);
      console.log('');
      
      // 実際にクリック
      const next1Buttons = await page.$$('button');
      for (const btn of next1Buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.toLowerCase().includes('next') || text.includes('次へ')) {
          console.log('🖱️  次へボタン（1回目）をクリック...');
          await btn.click();
          console.log('✅ クリック実行\n');
          break;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      await captureDebugInfo(page, '4-after-next-1');
      
      // 「次へ」ボタンを探す（2回目）
      console.log('========== STEP 5: 次へボタン（2回目） ==========\n');
      await findButtonWithText(page, ['Next', '次へ', 'Weiter']);
      console.log('');
      
      // 実際にクリック
      const next2Buttons = await page.$$('button');
      for (const btn of next2Buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.toLowerCase().includes('next') || text.includes('次へ')) {
          console.log('🖱️  次へボタン（2回目）をクリック...');
          await btn.click();
          console.log('✅ クリック実行\n');
          break;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      await captureDebugInfo(page, '5-after-next-2');
      
      // キャプション入力欄を探す
      console.log('========== STEP 6: キャプション入力 ==========\n');
      
      const textareaSelectors = [
        'textarea[aria-label*="caption"]',
        'textarea[aria-label*="キャプション"]',
        'textarea'
      ];
      
      const textareaResult = await findElement(page, textareaSelectors, 'キャプション入力欄');
      
      if (textareaResult.found) {
        console.log('📝 キャプション入力中...');
        await page.type(textareaResult.selector, caption, { delay: 50 });
        console.log('✅ キャプション入力完了\n');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      await captureDebugInfo(page, '6-after-caption');
      
      // 「シェア」ボタンを探す
      console.log('========== STEP 7: シェアボタン（クリックしない） ==========\n');
      await findButtonWithText(page, ['Share', 'シェア', 'Teilen', 'Post']);
      
      console.log('\n⚠️  ドライランのため、シェアボタンはクリックしません');
    }
    
    console.log('\n✅ ドライランテスト完了！');
    console.log('📁 デバッグファイルは /tmp/instagram-dryrun-*.png と *.html に保存されています');
    
  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    console.error('📚 スタックトレース:', error.stack);
    throw error;
  } finally {
    await browser.close();
  }
}

dryRunTest(imagePath, caption)
  .then(() => {
    console.log('\n✅ 処理完了');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 処理失敗:', error.message);
    process.exit(1);
  });
