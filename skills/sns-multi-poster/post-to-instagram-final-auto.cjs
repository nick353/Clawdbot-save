#!/usr/bin/env node
/**
 * Instagram Post Final (Auto-Fallback)
 * 複数の方法を試す: Playwright Stealth → Puppeteer Stealth → Instagrapi
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-final-auto.cjs <image-path> [caption]');
  process.exit(1);
}

const SCRIPT_DIR = path.dirname(__filename);

// 試行1: Master Auto-Fallback (最新版)
async function tryMasterAutoFallback() {
  const script = path.join(SCRIPT_DIR, 'post-to-instagram-master.cjs');
  if (!fs.existsSync(script)) {
    console.log('⏭️  Master Auto-Fallback not available');
    return false;
  }

  console.log('\n🔄 Method 1: Master Auto-Fallback (Multi-method)...');
  try {
    execSync(`node "${script}" "${imagePathArg}" "${captionArg}"`, { 
      stdio: 'inherit', 
      timeout: 180000 
    });
    console.log('✅ Master Auto-Fallback succeeded');
    return true;
  } catch (e) {
    console.log(`❌ Master Auto-Fallback failed: ${e.message}`);
    return false;
  }
}

// 試行2: Playwright Stealth (v7)
async function tryPlaywrightStealth() {
  const script = path.join(SCRIPT_DIR, 'post-to-instagram-v7-direct-stealth.cjs');
  if (!fs.existsSync(script)) {
    console.log('⏭️  Playwright Stealth not available');
    return false;
  }

  console.log('\n🔄 Method 2: Playwright Direct Stealth (v7)...');
  try {
    execSync(`node "${script}" "${imagePathArg}" "${captionArg}"`, { 
      stdio: 'inherit', 
      timeout: 120000 
    });
    console.log('✅ Playwright Stealth succeeded');
    return true;
  } catch (e) {
    console.log(`❌ Playwright Stealth failed: ${e.message}`);
    return false;
  }
}

// 試行3: Instagrapi (Python)
async function tryInstagrapi() {
  const script = path.join(SCRIPT_DIR, 'post-to-instagram-instagrapi.py');
  if (!fs.existsSync(script)) {
    console.log('⏭️  Instagrapi not available');
    return false;
  }

  console.log('\n🔄 Method 3: Instagrapi (Python)...');
  try {
    // Instagrapi venv を作成 / 使用
    const venv_path = '/tmp/instagrapi_env';
    if (!fs.existsSync(venv_path)) {
      console.log('📦 Creating Instagrapi venv...');
      execSync(`python3 -m venv "${venv_path}"`, { stdio: 'pipe', timeout: 60000 });
      execSync(`source "${venv_path}/bin/activate" && pip install --upgrade instagrapi -q`, { 
        stdio: 'pipe', 
        timeout: 120000,
        shell: '/bin/bash'
      });
      console.log('✅ venv ready');
    }

    // 実行
    execSync(
      `source "${venv_path}/bin/activate" && python3 "${script}" "${imagePathArg}" "${captionArg}"`,
      { 
        stdio: 'inherit', 
        timeout: 120000,
        shell: '/bin/bash',
        env: {
          ...process.env,
          IG_USERNAME: process.env.IG_USERNAME || 'nisen_prints',
          IG_PASSWORD: process.env.IG_PASSWORD
        }
      }
    );
    console.log('✅ Instagrapi succeeded');
    return true;
  } catch (e) {
    console.log(`❌ Instagrapi failed: ${e.message}`);
    return false;
  }
}

// Main
(async () => {
  console.log('🚀 Instagram Post - Auto-Fallback Mode');
  console.log(`📸 Image: ${imagePathArg}`);
  console.log(`📝 Caption: ${captionArg.substring(0, 60)}...`);
  console.log('---');

  const methods = [
    { name: 'Master Auto-Fallback', fn: tryMasterAutoFallback },
    { name: 'Playwright Direct Stealth', fn: tryPlaywrightStealth },
    { name: 'Instagrapi', fn: tryInstagrapi },
  ];

  for (const method of methods) {
    console.log(`\n⏳ Trying: ${method.name}`);
    const success = await method.fn();
    if (success) {
      console.log('\n🎉 Post completed!');
      process.exit(0);
    }
  }

  console.error('\n❌ All methods failed');
  process.exit(1);
})();
