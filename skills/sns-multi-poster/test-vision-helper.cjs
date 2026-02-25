#!/usr/bin/env node
/**
 * Vision Helper テストスクリプト
 * Usage: ANTHROPIC_API_KEY=xxx node test-vision-helper.cjs <screenshot_path> <target_text>
 */

const visionHelper = require('./vision-helper.cjs');
const fs = require('fs');
const path = require('path');

const [,, screenshotPath, targetText] = process.argv;

if (!screenshotPath || !targetText) {
  console.error('使い方: node test-vision-helper.cjs <screenshot_path> <target_text>');
  console.error('例: ANTHROPIC_API_KEY=xxx node test-vision-helper.cjs /tmp/screenshot.png "Create"');
  process.exit(1);
}

if (!fs.existsSync(screenshotPath)) {
  console.error(`❌ スクリーンショットが見つかりません: ${screenshotPath}`);
  process.exit(1);
}

async function test() {
  console.log('🧪 Vision Helper テスト開始');
  console.log(`📸 スクリーンショット: ${screenshotPath}`);
  console.log(`🎯 検出対象: "${targetText}"`);
  console.log('');

  // Vision API検出テスト
  const result = await visionHelper.detectUIElement(screenshotPath, targetText, {
    debug: true,
    maxRetries: 3
  });

  if (result) {
    console.log('\n✅ 検出成功！');
    console.log(`   座標: (${result.x}, ${result.y})`);
    console.log(`   確信度: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   検出テキスト: "${result.text}"`);

    // デバッグオーバーレイ作成
    const dir = path.dirname(screenshotPath);
    const basename = path.basename(screenshotPath, path.extname(screenshotPath));
    const overlayPath = path.join(dir, `${basename}-overlay.png`);
    
    await visionHelper.drawDebugOverlay(screenshotPath, [result], overlayPath);
    console.log(`\n📸 デバッグオーバーレイ: ${overlayPath}`);
    
  } else {
    console.log('\n❌ 検出失敗');
    console.log('   Vision APIで要素が見つかりませんでした');
  }
}

test().then(() => {
  console.log('\n🎉 テスト完了');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ エラー:', err.message);
  process.exit(1);
});
