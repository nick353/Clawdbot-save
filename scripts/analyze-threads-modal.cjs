#!/usr/bin/env node
/**
 * analyze-threads-modal.cjs
 * Threadsの投稿モーダルを開いて、内部のHTMLを解析する
 */

const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIE_PATH = '/root/clawd/skills/sns-multi-poster/cookies/threads.json';
const OUTPUT_PATH = '/tmp/threads-modal-analysis.json';

async function analyzeThreadsModal() {
  console.log('🔍 Threads投稿モーダル解析開始...');

  // Cookie読み込み
  if (!fs.existsSync(COOKIE_PATH)) {
    console.error(`❌ Cookie not found: ${COOKIE_PATH}`);
    process.exit(1);
  }
  const rawCookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf-8'));
  
  // sameSite を正規化（Playwright は Strict|Lax|None のみ受け付ける）
  const cookies = rawCookies.map(cookie => {
    const normalized = { ...cookie };
    if (!['Strict', 'Lax', 'None'].includes(normalized.sameSite)) {
      normalized.sameSite = 'Lax'; // デフォルト値
    }
    return normalized;
  });

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US'
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // Threadsホームページに移動
    console.log('📄 Loading https://www.threads.net/');
    await page.goto('https://www.threads.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.waitForTimeout(3000);

    // Createボタンをクリック
    console.log('🖱️ Clicking Create button...');
    const createButton = await page.locator('div[role="button"]').filter({ hasText: 'Create' }).first();
    
    if (await createButton.count() === 0) {
      // aria-labelで探す
      const createButtonAria = await page.locator('[aria-label="Create"]').first();
      if (await createButtonAria.count() > 0) {
        await createButtonAria.click();
      } else {
        console.error('❌ Create button not found');
        await page.screenshot({ path: '/tmp/threads-no-create-button.png' });
        process.exit(1);
      }
    } else {
      await createButton.click();
    }

    // モーダルが開くのを待つ
    console.log('⏳ Waiting for modal...');
    await page.waitForTimeout(3000);

    // スクリーンショット撮影
    await page.screenshot({ path: '/tmp/threads-modal.png' });
    console.log('📸 Screenshot saved: /tmp/threads-modal.png');

    // HTML解析
    const analysis = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      elements: {}
    };

    // ボタン一覧
    const buttons = await page.locator('button, div[role="button"]').all();
    const buttonData = [];
    for (const btn of buttons.slice(0, 30)) {
      const text = await btn.innerText().catch(() => '');
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
      if (text || ariaLabel) {
        buttonData.push({ text, ariaLabel });
      }
    }
    analysis.elements.buttons = buttonData;
    console.log(`🔘 Found ${buttonData.length} buttons`);

    // テキストエリア
    const textareas = await page.locator('textarea').all();
    const textareaData = [];
    for (const ta of textareas) {
      const placeholder = await ta.getAttribute('placeholder').catch(() => '');
      const ariaLabel = await ta.getAttribute('aria-label').catch(() => '');
      const id = await ta.getAttribute('id').catch(() => '');
      textareaData.push({ placeholder, ariaLabel, id });
    }
    analysis.elements.textareas = textareaData;
    console.log(`📝 Found ${textareaData.length} textareas`);

    // Contenteditable要素
    const editables = await page.locator('[contenteditable="true"]').all();
    const editableData = [];
    for (const edit of editables) {
      const ariaLabel = await edit.getAttribute('aria-label').catch(() => '');
      const role = await edit.getAttribute('role').catch(() => '');
      const text = await edit.innerText().catch(() => '');
      editableData.push({ ariaLabel, role, text });
    }
    analysis.elements.editables = editableData;
    console.log(`✏️ Found ${editableData.length} contenteditable elements`);

    // ファイル入力
    const fileInputs = await page.locator('input[type="file"]').all();
    const fileInputData = [];
    for (const input of fileInputs) {
      const accept = await input.getAttribute('accept').catch(() => '');
      const id = await input.getAttribute('id').catch(() => '');
      const multiple = await input.getAttribute('multiple').catch(() => '');
      fileInputData.push({ accept, id, multiple });
    }
    analysis.elements.fileInputs = fileInputData;
    console.log(`📁 Found ${fileInputData.length} file inputs`);

    // SVGアイコン
    const svgs = await page.locator('svg').all();
    const svgData = [];
    for (const svg of svgs.slice(0, 20)) {
      const ariaLabel = await svg.getAttribute('aria-label').catch(() => '');
      if (ariaLabel) {
        svgData.push({ ariaLabel });
      }
    }
    analysis.elements.svgs = svgData;
    console.log(`🎨 Found ${svgData.length} labeled SVGs`);

    // モーダル内の全テキスト
    const modalTexts = await page.locator('div[role="dialog"] *').allInnerTexts().catch(() => []);
    analysis.elements.modalTexts = modalTexts.slice(0, 50);

    // 結果を保存
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(analysis, null, 2));
    console.log(`💾 Analysis saved: ${OUTPUT_PATH}`);

    // 結果表示
    console.log('\n📊 解析結果:');
    console.log(`🔘 ボタン (${buttonData.length}個):`);
    buttonData.slice(0, 10).forEach((b, i) => {
      console.log(`  [${i + 1}] text="${b.text}" | aria="${b.ariaLabel}"`);
    });

    console.log(`\n📝 テキストエリア (${textareaData.length}個):`);
    textareaData.forEach((t, i) => {
      console.log(`  [${i + 1}] placeholder="${t.placeholder}" | aria="${t.ariaLabel}" | id="${t.id}"`);
    });

    console.log(`\n✏️ Contenteditable要素 (${editableData.length}個):`);
    editableData.forEach((e, i) => {
      console.log(`  [${i + 1}] aria="${e.ariaLabel}" | role="${e.role}"`);
    });

    console.log(`\n📁 ファイル入力 (${fileInputData.length}個):`);
    fileInputData.forEach((f, i) => {
      console.log(`  [${i + 1}] accept="${f.accept}" | id="${f.id}" | multiple="${f.multiple}"`);
    });

    console.log(`\n🎨 SVGアイコン (${svgData.length}個):`);
    svgData.slice(0, 10).forEach((s, i) => {
      console.log(`  [${i + 1}] aria-label="${s.ariaLabel}"`);
    });

    console.log('\n✅ 解析完了');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/threads-modal-error.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

analyzeThreadsModal().catch(console.error);
