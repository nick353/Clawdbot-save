#!/usr/bin/env node

/**
 * Threads投稿スクリプト (HTML解析 + スクリーンショット確認版)
 * 
 * 使い方:
 *   node post-to-threads-robust.cjs <画像パス> "キャプション" [--dry-run]
 * 
 * 特徴:
 * - 各ステップでHTML構造を分析
 * - スクリーンショットで視覚確認
 * - エラー時はHTML + スクリーンショットを保存
 * - Lexicalエディタ対応
 * - Trusted Types対応
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = '/root/clawd/browser-profiles/threads-profile';
const COOKIES_FILE = '/root/clawd/skills/sns-multi-poster/cookies/threads-playwright.json';
const DEBUG_DIR = '/root/clawd/debug/threads';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

async function saveDebugInfo(page, step, error = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = `${DEBUG_DIR}/${step}_${timestamp}`;
  
  try {
    // スクリーンショット保存
    await page.screenshot({ path: `${prefix}.png`, fullPage: true });
    console.log(`📸 Screenshot saved: ${prefix}.png`);
    
    // HTML保存
    const html = await page.content();
    fs.writeFileSync(`${prefix}.html`, html);
    console.log(`📄 HTML saved: ${prefix}.html`);
    
    // エラー情報保存
    if (error) {
      fs.writeFileSync(`${prefix}_error.txt`, error.toString());
      console.log(`❌ Error saved: ${prefix}_error.txt`);
    }
  } catch (e) {
    console.error(`Failed to save debug info: ${e.message}`);
  }
}

async function analyzeHTML(page, description) {
  console.log(`\n🔍 Analyzing HTML: ${description}`);
  
  try {
    const analysis = await page.evaluate(() => {
      const info = {
        url: window.location.href,
        title: document.title,
        modals: [],
        textboxes: [],
        buttons: []
      };
      
      // モーダル検索
      document.querySelectorAll('[role="dialog"]').forEach(modal => {
        info.modals.push({
          ariaLabel: modal.getAttribute('aria-label'),
          visible: modal.offsetParent !== null,
          classes: modal.className
        });
      });
      
      // テキストボックス検索
      document.querySelectorAll('[role="textbox"]').forEach(textbox => {
        info.textboxes.push({
          ariaLabel: textbox.getAttribute('aria-label'),
          contentEditable: textbox.getAttribute('contenteditable'),
          visible: textbox.offsetParent !== null,
          classes: textbox.className
        });
      });
      
      // ボタン検索
      document.querySelectorAll('[role="button"]').forEach(button => {
        const text = button.textContent?.trim();
        if (text && text.length < 20) {
          info.buttons.push({
            text: text,
            visible: button.offsetParent !== null,
            classes: button.className
          });
        }
      });
      
      return info;
    });
    
    console.log('📊 Analysis Results:');
    console.log(`  URL: ${analysis.url}`);
    console.log(`  Modals: ${analysis.modals.length}`);
    console.log(`  Textboxes: ${analysis.textboxes.length}`);
    console.log(`  Buttons: ${analysis.buttons.length}`);
    
    return analysis;
  } catch (e) {
    console.error(`Failed to analyze HTML: ${e.message}`);
    return null;
  }
}

async function postToThreads(imagePath, caption, dryRun = false) {
  let browser;
  
  try {
    console.log('🚀 Starting Threads posting process...');
    console.log(`  Image: ${imagePath}`);
    console.log(`  Caption: ${caption}`);
    console.log(`  Dry Run: ${dryRun}`);
    
    // ブラウザ起動
    browser = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = browser.pages()[0] || await browser.newPage();
    
    // Cookie読み込み
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
      await page.context().addCookies(cookies);
      console.log('✅ Cookies loaded');
    }
    
    // Step 1: Threadsにアクセス
    console.log('\n📍 Step 1: Navigate to Threads');
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await saveDebugInfo(page, 'step1_homepage');
    await analyzeHTML(page, 'Homepage');
    
    // Step 2: Createボタンをクリック
    console.log('\n📍 Step 2: Click Create button');
    const createButton = page.locator('[aria-label="Create"]').first();
    await createButton.waitFor({ state: 'attached', timeout: 10000 });
    await createButton.click({ force: true });
    await page.waitForTimeout(2000);
    
    await saveDebugInfo(page, 'step2_after_create_click');
    const analysisAfterCreate = await analyzeHTML(page, 'After Create Click');
    
    // Step 3: モーダル待機
    console.log('\n📍 Step 3: Wait for modal');
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ state: 'attached', timeout: 10000 });
    console.log('✅ Modal found');
    
    await saveDebugInfo(page, 'step3_modal_opened');
    await analyzeHTML(page, 'Modal Opened');
    
    // Step 4: 画像アップロード（オプション）
    if (imagePath && fs.existsSync(imagePath)) {
      console.log('\n📍 Step 4: Upload image');
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(imagePath);
      await page.waitForTimeout(3000);
      console.log('✅ Image uploaded');
      
      await saveDebugInfo(page, 'step4_image_uploaded');
      await analyzeHTML(page, 'After Image Upload');
    }
    
    // Step 5: テキスト入力
    console.log('\n📍 Step 5: Enter text');
    const textbox = page.locator('[role="textbox"][contenteditable="true"]').first();
    await textbox.waitFor({ state: 'attached', timeout: 10000 });
    
    // Lexicalエディタ対応: キーボード入力
    await textbox.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.type(caption, { delay: 50 });
    await page.waitForTimeout(1000);
    console.log('✅ Text entered');
    
    await saveDebugInfo(page, 'step5_text_entered');
    await analyzeHTML(page, 'After Text Entry');
    
    if (dryRun) {
      console.log('\n🔄 DRY RUN mode - skipping post');
      await saveDebugInfo(page, 'step_final_dryrun');
      return { success: true, dryRun: true };
    }
    
    // Step 6: Postボタンをクリック
    console.log('\n📍 Step 6: Click Post button');
    const postButton = page.locator('[role="button"]').filter({ hasText: 'Post' }).first();
    await postButton.waitFor({ state: 'attached', timeout: 10000 });
    await postButton.click({ force: true });
    await page.waitForTimeout(1000);
    console.log('✅ Post button clicked');
    
    await saveDebugInfo(page, 'step6_post_clicked');
    
    // Cookie保存
    const cookies = await page.context().cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log('✅ Session saved');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Threads 投稿が完了しました！');
    console.log('='.repeat(50));
    
    return { success: true };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (browser) {
      const page = browser.pages()[0];
      if (page) {
        await saveDebugInfo(page, 'error', error);
      }
    }
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// CLI実行
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(arg => arg !== '--dry-run');
  
  if (filteredArgs.length < 2) {
    console.error('Usage: node post-to-threads-robust.cjs <image> "caption" [--dry-run]');
    process.exit(1);
  }
  
  const [imagePath, caption] = filteredArgs;
  
  postToThreads(imagePath, caption, dryRun)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { postToThreads };
