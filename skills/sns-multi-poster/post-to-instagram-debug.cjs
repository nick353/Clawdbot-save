#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - デバッグ版
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-debug.cjs <image_path> <caption>');
  process.exit(1);
}

async function debugInstagram(imagePath, caption) {
  console.log('🔍 Instagram UI デバッグ開始...');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await context.addCookies(cookies);

    const page = await context.newPage();
    
    console.log('📂 Instagram.comにアクセス...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    console.log('✅ ログイン確認完了');
    await page.screenshot({ path: '/tmp/debug-home.png' });
    
    console.log('➕ 新規投稿ボタンを探す...');
    
    // すべてのクリック可能な要素を列挙
    const clickableElements = await page.$$eval('[role="link"], [role="button"], a, button', elements => {
      return elements.map(el => ({
        tag: el.tagName,
        text: el.textContent?.substring(0, 50),
        ariaLabel: el.getAttribute('aria-label'),
        href: el.getAttribute('href'),
        role: el.getAttribute('role')
      })).filter(el => 
        el.text?.includes('New') || 
        el.text?.includes('Create') || 
        el.ariaLabel?.includes('New') ||
        el.ariaLabel?.includes('Create') ||
        el.href?.includes('/create/')
      );
    });
    
    console.log('\n📋 新規投稿関連の要素:');
    console.log(JSON.stringify(clickableElements, null, 2));
    
    // 最も可能性の高い要素をクリック
    const createLocator = page.locator('[aria-label*="New"], a[href*="/create/"]').first();
    const count = await createLocator.count();
    
    console.log(`\n🔍 新規投稿ボタン検出: ${count}個`);
    
    if (count > 0) {
      await createLocator.click();
      console.log('✅ クリック成功');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/tmp/debug-after-click.png' });
      
      // モーダル内の全要素を列挙
      const modalElements = await page.$$eval('div[role="dialog"] *, [aria-modal="true"] *', elements => {
        return elements.slice(0, 50).map(el => ({
          tag: el.tagName,
          type: el.getAttribute('type'),
          text: el.textContent?.substring(0, 30),
          ariaLabel: el.getAttribute('aria-label'),
          role: el.getAttribute('role'),
          className: el.className?.substring(0, 50)
        }));
      });
      
      console.log('\n📋 モーダル内の要素（最初の50個):');
      console.log(JSON.stringify(modalElements, null, 2));
      
      // input[type="file"]を探す
      const fileInputs = await page.$$('input[type="file"]');
      console.log(`\n🔍 ファイル入力検出: ${fileInputs.length}個`);
      
      if (fileInputs.length > 0) {
        console.log('✅ ファイル入力が見つかりました！');
      } else {
        console.log('❌ ファイル入力が見つかりません');
        
        // すべてのinput要素を確認
        const allInputs = await page.$$eval('input', inputs => {
          return inputs.map(input => ({
            type: input.getAttribute('type'),
            name: input.getAttribute('name'),
            id: input.id,
            className: input.className?.substring(0, 50),
            style: input.getAttribute('style')?.substring(0, 50)
          }));
        });
        
        console.log('\n📋 全input要素:');
        console.log(JSON.stringify(allInputs, null, 2));
      }
    } else {
      console.log('❌ 新規投稿ボタンが見つかりません');
    }
    
    console.log('\n✅ デバッグ完了');
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

debugInstagram(imagePath, caption).catch(console.error);
