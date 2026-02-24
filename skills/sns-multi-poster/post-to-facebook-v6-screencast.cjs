#!/usr/bin/env node

/**
 * post-to-facebook-v6-screencast.cjs
 * Facebook投稿スクリプト（画面録画機能付き）
 * 
 * 使い方: node post-to-facebook-v6-screencast.cjs <動画パス> <キャプション>
 * 
 * 機能:
 * - Puppeteerで画面録画しながら投稿操作を実行
 * - 録画ファイルを /tmp/facebook-recording-{timestamp}.webm に保存
 * - エラー時もスクリーンショット + 録画ファイルを保存
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cookie sameSite正規化（Chromium互換）
function normalizeCookie(cookie) {
  let sameSite = cookie.sameSite;
  if (sameSite === 'no_restriction') sameSite = 'None';
  if (sameSite === null || sameSite === undefined) sameSite = 'Lax';
  if (!['Strict', 'Lax', 'None'].includes(sameSite)) sameSite = 'Lax';
  return {
    name: cookie.name,
    value: decodeURIComponent(cookie.value),
    domain: cookie.domain || '.facebook.com',
    path: cookie.path || '/',
    secure: cookie.secure !== false,
    httpOnly: cookie.httpOnly === true,
    sameSite: sameSite,
    expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined,
  };
}

// ランダム遅延
function randomDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function postToFacebook(videoPath, caption) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const recordingPath = `/tmp/facebook-recording-${timestamp}.webm`;
  
  let browser;
  let recorder;
  
  try {
    console.log('📘 Facebook に投稿開始 (v6 - 画面録画版)');
    console.log(`🖼️ ${videoPath}`);
    console.log(`📝 ${caption}`);
    
    // Cookie読み込み
    const cookiesPath = path.join(__dirname, 'cookies/facebook.json');
    if (!fs.existsSync(cookiesPath)) {
      throw new Error(`❌ Cookieファイルが見つかりません: ${cookiesPath}`);
    }
    
    const rawCookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    const cookies = rawCookies.map(normalizeCookie);
    
    // Puppeteer起動（画面録画設定）
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);
    
    // 画面録画開始
    const client = await page.target().createCDPSession();
    await client.send('Page.startScreencast', {
      format: 'png',
      quality: 80,
      everyNthFrame: 1
    });
    
    const frames = [];
    client.on('Page.screencastFrame', async ({ data, sessionId }) => {
      frames.push(data);
      await client.send('Page.screencastFrameAck', { sessionId });
    });
    
    console.log('🎬 画面録画開始');
    
    // Facebook にアクセス
    console.log('🌐 Facebook にアクセス中...');
    await page.goto('https://www.facebook.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await randomDelay(2000, 3000);
    
    // スクリーンショット（初期状態）
    await page.screenshot({ path: `/tmp/facebook-screencast-initial-${timestamp}.png`, fullPage: true });
    console.log('📸 初期画面のスクリーンショット保存');
    
    // 「What's on your mind」をクリックして投稿フォームを開く
    console.log('📝 投稿フォームを開く...');
    await randomDelay(2000, 3000);
    
    // ページのHTMLを確認
    const pageHTML = await page.content();
    const hasReelsButton = pageHTML.includes('Create reel') || pageHTML.includes('Reel');
    console.log(`📊 ページ内容: Reelsボタン=${hasReelsButton}`);
    
    // 投稿ボタンを探す（複数のパターン）
    const createPostButtonSelectors = [
      'div[role="button"][aria-label*="Create"]',
      'div[role="button"]:has-text("Create")',
      'span:has-text("What\'s on your mind")',
      'div[aria-label="Create a post"]',
    ];
    
    let clicked = false;
    for (const selector of createPostButtonSelectors) {
      try {
        const elements = await page.$$(selector);
        console.log(`🔍 ${selector}: ${elements.length}件`);
        if (elements.length > 0) {
          await elements[0].click();
          console.log(`✅ 投稿フォームを開きました: ${selector}`);
          clicked = true;
          break;
        }
      } catch (e) {
        console.log(`⚠️ ${selector} でクリック失敗: ${e.message}`);
      }
    }
    
    if (!clicked) {
      // 最終手段: XPath
      try {
        const xpathButton = await page.$x('//span[contains(text(), "What")]');
        if (xpathButton.length > 0) {
          await xpathButton[0].click();
          console.log('✅ XPathで投稿フォームを開きました');
          clicked = true;
        }
      } catch (e) {
        console.log(`⚠️ XPath でクリック失敗: ${e.message}`);
      }
    }
    
    if (!clicked) {
      throw new Error('❌ 投稿フォームを開けませんでした');
    }
    
    await randomDelay(3000, 5000);
    
    // ファイルアップロード
    console.log('📁 ファイルアップロード開始...');
    const fileInputSelectors = [
      'input[type="file"][accept*="video"]',
      'input[type="file"]',
      'input[accept*="video"]',
      'input[data-testid="media-upload-input"]',
      'input[aria-label*="Add"]',
    ];
    
    let fileInputSelector = null;
    for (const selector of fileInputSelectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`✅ ファイル入力を発見: ${selector}`);
        fileInputSelector = selector;
        break;
      }
      await randomDelay(1000, 2000);
    }
    
    if (!fileInputSelector) {
      // 最終手段: すべてのinput[type="file"]を探す
      const allFileInputs = await page.$$('input[type="file"]');
      console.log(`🔍 全input[type="file"]: ${allFileInputs.length}件`);
      if (allFileInputs.length > 0) {
        console.log(`✅ input[type="file"] を発見 (${allFileInputs.length}件)`);
        fileInputSelector = 'input[type="file"]';
      }
    }
    
    if (!fileInputSelector) {
      // HTMLを出力してデバッグ
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log('❌ ファイル入力が見つかりません。ページHTML:');
      console.log(bodyHTML.substring(0, 2000));
      throw new Error('❌ ファイル入力が見つかりません');
    }
    
    // Puppeteerの正しい方法: waitForSelectorで取得してからuploadFile
    const fileInput = await page.waitForSelector(fileInputSelector, { timeout: 10000 });
    await fileInput.uploadFile(videoPath);
    console.log('✅ ファイルアップロード完了');
    await randomDelay(5000, 8000);
    
    // スクリーンショット（アップロード後）
    await page.screenshot({ path: `/tmp/facebook-screencast-uploaded-${timestamp}.png`, fullPage: true });
    console.log('📸 アップロード後のスクリーンショット保存');
    
    // キャプション入力
    console.log('📝 キャプション入力中...');
    const captionSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[aria-label*="説明"]',
      'div[aria-placeholder*="説明"]',
      'textarea[placeholder*="説明"]',
      'div[data-testid="reel-composer-description"]',
    ];
    
    let captionInput = null;
    for (const selector of captionSelectors) {
      captionInput = await page.$(selector);
      if (captionInput) {
        console.log(`✅ キャプション入力を発見: ${selector}`);
        break;
      }
      await randomDelay(1000, 2000);
    }
    
    if (captionInput) {
      await captionInput.click();
      await randomDelay(1000, 2000);
      await captionInput.type(caption, { delay: 100 });
      console.log('✅ キャプション入力完了');
    } else {
      console.log('⚠️ キャプション入力が見つかりませんでした');
    }
    
    await randomDelay(2000, 3000);
    
    // スクリーンショット（キャプション入力後）
    await page.screenshot({ path: `/tmp/facebook-screencast-caption-${timestamp}.png`, fullPage: true });
    console.log('📸 キャプション入力後のスクリーンショット保存');
    
    // 投稿ボタンを探す（複数セレクタ + スクロール）
    console.log('🔍 投稿ボタンを探索中...');
    
    const postButtonSelectors = [
      'div[aria-label="Next"]',
      'div[aria-label="Post"]',
      'div[aria-label="公開"]',
      'div[aria-label="シェア"]',
      'div[aria-label="Share"]',
      '//div[@role="button" and contains(text(), "Next")]',
      '//div[@role="button" and contains(text(), "Post")]',
      '//div[@role="button" and contains(text(), "公開")]',
      '//div[@role="button" and contains(text(), "シェア")]',
      '//div[@role="button" and contains(text(), "Share")]',
    ];
    
    // "Next" ボタンを探す
    console.log('🔍 "Next" ボタンを探す...');
    const nextButtonSelectors = [
      'div[aria-label="Next"]',
      '//div[@role="button" and contains(text(), "Next")]',
    ];
    
    let nextButton = null;
    for (const selector of nextButtonSelectors) {
      try {
        if (selector.startsWith('//')) {
          const elements = await page.$x(selector);
          if (elements.length > 0) {
            nextButton = elements[0];
            console.log(`✅ "Next"ボタン発見（XPath）: ${selector}`);
            break;
          }
        } else {
          nextButton = await page.$(selector);
          if (nextButton) {
            console.log(`✅ "Next"ボタン発見: ${selector}`);
            break;
          }
        }
      } catch (err) {
        console.log(`⚠️ ${selector} でエラー: ${err.message}`);
      }
      await randomDelay(1000, 2000);
    }
    
    // "Next" ボタンが見つかった場合、クリックして画面遷移を待つ
    if (nextButton) {
      console.log('🖱️ "Next"ボタンをクリック...');
      await nextButton.click();
      await randomDelay(3000, 5000); // 画面遷移を待つ
      
      // スクリーンショット（Next後）
      await page.screenshot({ path: `/tmp/facebook-screencast-after-next-${timestamp}.png`, fullPage: true });
      console.log('📸 "Next"後のスクリーンショット保存');
    }
    
    // 左側パネルをスクロール（Reels編集画面の場合、左側パネルに"Post"ボタンがある可能性）
    console.log('📜 左側パネルをスクロール...');
    await page.evaluate(() => {
      const leftPanel = document.querySelector('div[role="dialog"]');
      if (leftPanel) {
        leftPanel.scrollTo({ top: leftPanel.scrollHeight, behavior: 'smooth' });
      }
    });
    await randomDelay(2000, 3000);
    
    // スクリーンショット（スクロール後）
    await page.screenshot({ path: `/tmp/facebook-screencast-scrolled-${timestamp}.png`, fullPage: true });
    console.log('📸 スクロール後のスクリーンショット保存');
    
    // 投稿ボタンを探す
    console.log('🔍 "Post"ボタンを探す...');
    let postButton = null;
    for (const selector of postButtonSelectors) {
      try {
        if (selector.startsWith('//')) {
          const elements = await page.$x(selector);
          if (elements.length > 0) {
            postButton = elements[0];
            console.log(`✅ 投稿ボタン発見（XPath）: ${selector}`);
            break;
          }
        } else {
          postButton = await page.$(selector);
          if (postButton) {
            console.log(`✅ 投稿ボタン発見: ${selector}`);
            break;
          }
        }
      } catch (err) {
        console.log(`⚠️ ${selector} でエラー: ${err.message}`);
      }
      await randomDelay(1000, 2000);
    }
    
    if (!postButton) {
      // 全てのボタンをリスト化
      console.log('📋 ページ内の全ボタンをリスト化:');
      const allButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
        return buttons.map((btn, idx) => ({
          index: idx,
          text: btn.innerText?.substring(0, 50) || '(no text)',
          ariaLabel: btn.getAttribute('aria-label') || 'null',
        }));
      });
      allButtons.forEach(btn => {
        console.log(`${btn.index}. "${btn.text}" (aria: "${btn.ariaLabel}")`);
      });
      
      throw new Error('❌ 投稿ボタンが見つかりません');
    }
    
    // DRY_RUN チェック
    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: 投稿ボタンクリックをスキップ');
      
      // 画面録画停止
      await client.send('Page.stopScreencast');
      console.log('🎬 画面録画停止');
      
      // 録画フレームを保存
      if (frames.length > 0) {
        const framesDir = `/tmp/facebook-screencast-frames-${timestamp}`;
        fs.mkdirSync(framesDir, { recursive: true });
        
        console.log(`📹 ${frames.length} フレームを保存中...`);
        for (let i = 0; i < frames.length; i++) {
          const framePath = path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`);
          fs.writeFileSync(framePath, frames[i], 'base64');
        }
        
        // ffmpegで動画に変換
        const videoPath = `/tmp/facebook-screencast-${timestamp}.webm`;
        console.log('🎬 ffmpegで動画に変換中...');
        const ffmpegCmd = `ffmpeg -framerate 2 -i ${framesDir}/frame-%05d.png -c:v libvpx-vp9 -pix_fmt yuva420p ${videoPath} -y`;
        
        try {
          execSync(ffmpegCmd, { stdio: 'ignore' });
          console.log(`✅ 動画保存完了: ${videoPath}`);
          
          // フレーム画像削除
          execSync(`rm -rf ${framesDir}`, { stdio: 'ignore' });
        } catch (err) {
          console.log(`⚠️ ffmpeg変換エラー: ${err.message}`);
          console.log(`📁 フレーム画像: ${framesDir}/frame-*.png`);
        }
      }
      
      console.log(`✅ スクリーンショット保存完了: /tmp/facebook-screencast-*.png`);
      
      return;
    }
    
    // 1回目のNextボタンクリック（詳細設定画面へ）
    console.log('👆 1回目のNextボタンをクリック...');
    await postButton.click();
    await randomDelay(3000, 5000);
    
    // スクリーンショット（1回目のNext後）
    await page.screenshot({ path: `/tmp/facebook-screencast-after-first-next-${timestamp}.png`, fullPage: true });
    console.log('📸 1回目のNext後のスクリーンショット保存');
    
    // 2回目のNextまたはPostボタンを探す
    console.log('🔍 2回目のNextまたはPostボタンを探索中...');
    const secondButtonSelectors = [
      'div[aria-label="Next"]',
      'div[aria-label="Post"]',
      'div[aria-label="公開"]',
      'div[aria-label="Share"]',
      '//div[@role="button" and contains(text(), "Next")]',
      '//div[@role="button" and contains(text(), "Post")]',
    ];
    
    let secondButton = null;
    for (const selector of secondButtonSelectors) {
      try {
        if (selector.startsWith('//')) {
          const elements = await page.$x(selector);
          if (elements.length > 0) {
            secondButton = elements[0];
            console.log(`✅ 2回目のボタン発見（XPath）: ${selector}`);
            break;
          }
        } else {
          secondButton = await page.$(selector);
          if (secondButton) {
            console.log(`✅ 2回目のボタン発見: ${selector}`);
            break;
          }
        }
      } catch (err) {
        console.log(`⚠️ ${selector} でエラー: ${err.message}`);
      }
      await randomDelay(1000, 2000);
    }
    
    if (!secondButton) {
      console.log('⚠️ 2回目のボタンが見つかりません（1回目のNextで完了した可能性）');
    } else {
      // 2回目のNextまたはPostボタンクリック
      console.log('👆 2回目のNextまたはPostボタンをクリック...');
      await secondButton.click();
      await randomDelay(3000, 5000);
    }
    
    // スクリーンショット（投稿後）
    await page.screenshot({ path: `/tmp/facebook-screencast-posted-${timestamp}.png`, fullPage: true });
    console.log('📸 投稿後のスクリーンショット保存');
    
    // 画面録画停止
    await client.send('Page.stopScreencast');
    console.log('🎬 画面録画停止');
    
    // 録画フレームを保存
    if (frames.length > 0) {
      const framesDir = `/tmp/facebook-screencast-frames-${timestamp}`;
      fs.mkdirSync(framesDir, { recursive: true });
      
      console.log(`📹 ${frames.length} フレームを保存中...`);
      for (let i = 0; i < frames.length; i++) {
        const framePath = path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`);
        fs.writeFileSync(framePath, frames[i], 'base64');
      }
      
      // ffmpegで動画に変換
      const videoPath = `/tmp/facebook-screencast-${timestamp}.webm`;
      console.log('🎬 ffmpegで動画に変換中...');
      const ffmpegCmd = `ffmpeg -framerate 2 -i ${framesDir}/frame-%05d.png -c:v libvpx-vp9 -pix_fmt yuva420p ${videoPath} -y`;
      
      try {
        execSync(ffmpegCmd, { stdio: 'ignore' });
        console.log(`✅ 動画保存完了: ${videoPath}`);
        
        // フレーム画像削除
        execSync(`rm -rf ${framesDir}`, { stdio: 'ignore' });
      } catch (err) {
        console.log(`⚠️ ffmpeg変換エラー: ${err.message}`);
        console.log(`📁 フレーム画像: ${framesDir}/frame-*.png`);
      }
    }
    
    console.log('✅ Facebook への投稿が完了しました！');
    console.log(`📸 スクリーンショット: /tmp/facebook-screencast-*.png`);
    
  } catch (error) {
    console.error('❌ 投稿失敗:', error.message);
    
    // エラー時もスクリーンショット + 録画保存
    if (browser) {
      const page = (await browser.pages())[0];
      if (page) {
        await page.screenshot({ path: `/tmp/facebook-screencast-error-${timestamp}.png`, fullPage: true });
        console.log('📸 エラー時のスクリーンショット保存');
        
        // エラー時も録画停止 + 保存
        try {
          const client = await page.target().createCDPSession();
          await client.send('Page.stopScreencast');
          console.log('🎬 画面録画停止（エラー時）');
          
          // 録画フレームを保存
          if (frames.length > 0) {
            const framesDir = `/tmp/facebook-screencast-frames-${timestamp}`;
            fs.mkdirSync(framesDir, { recursive: true });
            
            console.log(`📹 ${frames.length} フレームを保存中（エラー時）...`);
            for (let i = 0; i < frames.length; i++) {
              const framePath = path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`);
              fs.writeFileSync(framePath, frames[i], 'base64');
            }
            
            // ffmpegで動画に変換
            const videoPath = `/tmp/facebook-screencast-error-${timestamp}.webm`;
            console.log('🎬 ffmpegで動画に変換中（エラー時）...');
            const ffmpegCmd = `ffmpeg -framerate 2 -i ${framesDir}/frame-%05d.png -c:v libvpx-vp9 -pix_fmt yuva420p ${videoPath} -y`;
            
            try {
              execSync(ffmpegCmd, { stdio: 'ignore' });
              console.log(`✅ エラー時の動画保存完了: ${videoPath}`);
              
              // フレーム画像削除
              execSync(`rm -rf ${framesDir}`, { stdio: 'ignore' });
            } catch (err) {
              console.log(`⚠️ ffmpeg変換エラー: ${err.message}`);
              console.log(`📁 フレーム画像: ${framesDir}/frame-*.png`);
            }
          }
        } catch (recordErr) {
          console.log(`⚠️ 録画保存エラー: ${recordErr.message}`);
        }
      }
    }
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// メイン実行
if (require.main === module) {
  const [videoPath, caption] = process.argv.slice(2);
  
  if (!videoPath || !caption) {
    console.error('使い方: node post-to-facebook-v6-screencast.cjs <動画パス> <キャプション>');
    process.exit(1);
  }
  
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ ファイルが見つかりません: ${videoPath}`);
    process.exit(1);
  }
  
  postToFacebook(videoPath, caption)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { postToFacebook };
