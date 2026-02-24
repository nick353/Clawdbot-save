#!/usr/bin/env node
/**
 * SNSページのHTML解析スクリプト
 * 投稿ボタン・入力欄のセレクタを特定
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , snsName] = process.argv;

if (!snsName) {
  console.error('使い方: node analyze-sns-page.cjs <threads|instagram|x|facebook|pinterest>');
  process.exit(1);
}

const CONFIG = {
  threads: {
    url: 'https://www.threads.net',
    profileDir: '/root/clawd/browser-profiles/threads'
  },
  instagram: {
    url: 'https://www.instagram.com',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/instagram.json'
  },
  x: {
    url: 'https://twitter.com/home',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/x.json'
  },
  facebook: {
    url: 'https://www.facebook.com',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/facebook.json'
  },
  pinterest: {
    url: 'https://www.pinterest.com/pin-builder/',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/pinterest.json'
  }
};

const config = CONFIG[snsName];
if (!config) {
  console.error(`❌ 未対応のSNS: ${snsName}`);
  process.exit(1);
}

(async () => {
  console.log(`🌐 ${snsName} のページ解析を開始...`);
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = config.profileDir
    ? await browser.newContext({
        userDataDir: config.profileDir
      })
    : await browser.newContext();
  
  const page = await context.newPage();
  
  // Cookie読み込み（プロファイルでない場合）
  if (config.cookiePath && fs.existsSync(config.cookiePath)) {
    const cookies = JSON.parse(fs.readFileSync(config.cookiePath));
    await context.addCookies(cookies);
    console.log('✅ Cookie読み込み完了');
  }
  
  console.log(`🌐 ${config.url} にアクセス...`);
  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000); // 追加の読み込み待機
  
  // ページHTML保存
  const html = await page.content();
  const htmlPath = `/tmp/${snsName}-page.html`;
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ HTML保存: ${htmlPath} (${(html.length / 1024).toFixed(1)} KB)`);
  
  // スクリーンショット
  const screenshotPath = `/tmp/${snsName}-page.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 スクリーンショット: ${screenshotPath}`);
  
  // 投稿関連の要素を探索
  console.log('\n🔍 投稿関連の要素を探索...\n');
  
  const analysis = await page.evaluate(() => {
    const result = {
      buttons: [],
      textareas: [],
      inputs: [],
      fileInputs: []
    };
    
    // ボタン候補
    const buttons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
    buttons.forEach((btn, i) => {
      if (i >= 20) return; // 最初の20個だけ
      const text = btn.textContent?.trim().substring(0, 80) || '';
      const aria = btn.getAttribute('aria-label') || '';
      const classes = btn.className;
      
      // 投稿関連のキーワード
      const keywords = ['post', 'new', 'thread', 'create', 'compose', 'tweet', 'pin', 'what', 'share'];
      const relevant = keywords.some(k => 
        text.toLowerCase().includes(k) || aria.toLowerCase().includes(k)
      );
      
      if (relevant || i < 10) {
        result.buttons.push({
          index: i,
          tag: btn.tagName,
          text: text,
          ariaLabel: aria,
          className: classes,
          role: btn.getAttribute('role'),
          dataTestId: btn.getAttribute('data-testid'),
          id: btn.id
        });
      }
    });
    
    // テキストエリア
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((ta, i) => {
      result.textareas.push({
        index: i,
        placeholder: ta.placeholder,
        ariaLabel: ta.getAttribute('aria-label'),
        className: ta.className,
        id: ta.id,
        name: ta.name
      });
    });
    
    // contenteditable要素
    const editables = document.querySelectorAll('[contenteditable="true"]');
    editables.forEach((el, i) => {
      result.inputs.push({
        index: i,
        type: 'contenteditable',
        tag: el.tagName,
        placeholder: el.getAttribute('placeholder'),
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className,
        role: el.getAttribute('role'),
        dataTestId: el.getAttribute('data-testid')
      });
    });
    
    // ファイル入力
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input, i) => {
      result.fileInputs.push({
        index: i,
        accept: input.accept,
        className: input.className,
        id: input.id,
        name: input.name,
        multiple: input.multiple
      });
    });
    
    return result;
  });
  
  console.log('📊 ボタン候補 (' + analysis.buttons.length + '個):');
  analysis.buttons.forEach(b => {
    console.log(`  [${b.index}] ${b.tag} | text="${b.text}" | aria="${b.ariaLabel}"`);
    if (b.dataTestId) console.log(`      data-testid="${b.dataTestId}"`);
    if (b.id) console.log(`      id="${b.id}"`);
  });
  
  console.log('\n📝 テキストエリア (' + analysis.textareas.length + '個):');
  analysis.textareas.forEach(t => {
    console.log(`  [${t.index}] placeholder="${t.placeholder}" | aria="${t.ariaLabel}"`);
  });
  
  console.log('\n✏️ Contenteditable要素 (' + analysis.inputs.length + '個):');
  analysis.inputs.forEach(i => {
    console.log(`  [${i.index}] ${i.tag} | aria="${i.ariaLabel}" | placeholder="${i.placeholder}"`);
    if (i.dataTestId) console.log(`      data-testid="${i.dataTestId}"`);
  });
  
  console.log('\n📁 ファイル入力 (' + analysis.fileInputs.length + '個):');
  analysis.fileInputs.forEach(f => {
    console.log(`  [${f.index}] accept="${f.accept}" | id="${f.id}" | multiple=${f.multiple}`);
  });
  
  // 結果をJSON保存
  const resultPath = `/tmp/${snsName}-analysis.json`;
  fs.writeFileSync(resultPath, JSON.stringify(analysis, null, 2));
  console.log(`\n💾 解析結果保存: ${resultPath}`);
  
  await browser.close();
  console.log('\n✅ 解析完了');
})();
