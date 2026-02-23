#!/usr/bin/env node
/**
 * Instagram Master (Auto-Fallback)
 * 複数の方法を順番に試す：
 * 1. Simple Puppeteer (Reels-based, stable)
 * 2. Playwright with Cookies
 * 3. Facebook Graph API (if IG Business account)
 * 4. Fail with helpful message
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-master.cjs <image-path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePathArg)) {
  console.error(`❌ Image not found: ${imagePathArg}`);
  process.exit(1);
}

const SCRIPT_DIR = path.dirname(__filename);

// Method 1: Human-Like (最優先 - andoさんの指示)
function tryHumanLike() {
  console.log('\n【Method 1】Human-Like (Most Natural)');
  const script = path.join(SCRIPT_DIR, 'post-to-instagram-human-like.cjs');
  
  if (!fs.existsSync(script)) {
    console.log('⏭️  Script not found');
    return false;
  }

  try {
    const result = spawnSync('node', [script, imagePathArg, captionArg], {
      stdio: 'inherit',
      timeout: 180000,
    });
    
    if (result.status === 0) {
      console.log('✅ SUCCESS with Human-Like');
      return true;
    } else {
      console.log('❌ Failed with Human-Like');
      return false;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    return false;
  }
}

// Method 2: Simple Puppeteer-based
function trySimplePuppeteer() {
  console.log('\n【Method 2】Simple Puppeteer (Stable)');
  const script = path.join(SCRIPT_DIR, 'post-to-instagram-final-simple.cjs');
  
  if (!fs.existsSync(script)) {
    console.log('⏭️  Script not found');
    return false;
  }

  try {
    const result = spawnSync('node', [script, imagePathArg, captionArg], {
      stdio: 'inherit',
      timeout: 150000,
    });
    
    if (result.status === 0) {
      console.log('✅ SUCCESS with Simple Puppeteer');
      return true;
    } else {
      console.log('❌ Failed with Simple Puppeteer');
      return false;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    return false;
  }
}

// Method 2: Playwright with Home-First (Try Create from Home)
function tryPlaywrightHomeFirst() {
  console.log('\n【Method 2】Playwright Home-First');
  const script = path.join(SCRIPT_DIR, 'post-to-instagram-v14-home-first.cjs');
  
  if (!fs.existsSync(script)) {
    console.log('⏭️  Script not found');
    return false;
  }

  try {
    const result = spawnSync('node', [script, imagePathArg, captionArg], {
      stdio: 'inherit',
      timeout: 150000,
    });
    
    if (result.status === 0) {
      console.log('✅ SUCCESS with Playwright Home-First');
      return true;
    } else {
      console.log('❌ Failed with Playwright Home-First');
      return false;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    return false;
  }
}

// Method 3: Reels-based (from existing working script)
function tryReelsBased() {
  console.log('\n【Method 3】Reels-based (Proven Stable)');
  const script = path.join(SCRIPT_DIR, 'post-to-instagram-reels.cjs');
  
  if (!fs.existsSync(script)) {
    console.log('⏭️  Script not found');
    return false;
  }

  try {
    const result = spawnSync('node', [script, imagePathArg, captionArg], {
      stdio: 'inherit',
      timeout: 150000,
    });
    
    if (result.status === 0) {
      console.log('✅ SUCCESS with Reels-based');
      return true;
    } else {
      console.log('❌ Failed with Reels-based');
      return false;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    return false;
  }
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Instagram Poster - Master Auto-Fallback Version      ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`📸 Image: ${imagePathArg}`);
  console.log(`📝 Caption: ${captionArg.substring(0, 60)}...`);
  console.log('');
  console.log('Attempting 3 different methods...');
  console.log('═'.repeat(56));

  // Method 2: With Dismiss Modal
  function tryDismiss() {
    console.log('\n【Method 2】With Dismiss Modal (Modal-aware)');
    const script = path.join(SCRIPT_DIR, 'post-to-instagram-with-dismiss.cjs');
    
    if (!fs.existsSync(script)) {
      console.log('⏭️  Script not found');
      return false;
    }

    try {
      const result = spawnSync('node', [script, imagePathArg, captionArg], {
        stdio: 'inherit',
        timeout: 180000,
      });
      
      if (result.status === 0) {
        console.log('✅ SUCCESS with Dismiss Modal');
        return true;
      } else {
        console.log('❌ Failed with Dismiss Modal');
        return false;
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
      return false;
    }
  }

  // Method 3: Advanced Stealth
  function tryAdvancedStealth() {
    console.log('\n【Method 3】Advanced Stealth (Most Evasive)');
    const script = path.join(SCRIPT_DIR, 'post-to-instagram-stealth-advanced.cjs');
    
    if (!fs.existsSync(script)) {
      console.log('⏭️  Script not found');
      return false;
    }

    try {
      const result = spawnSync('node', [script, imagePathArg, captionArg], {
        stdio: 'inherit',
        timeout: 180000,
      });
      
      if (result.status === 0) {
        console.log('✅ SUCCESS with Advanced Stealth');
        return true;
      } else {
        console.log('❌ Failed with Advanced Stealth');
        return false;
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
      return false;
    }
  }

  const methods = [
    tryDismiss,           // 1. Dismiss modal first (simplest)
    tryAdvancedStealth,   // 2. Advanced stealth (most evasive)
    tryHumanLike,         // 3. Human-like (natural behavior)
    trySimplePuppeteer,   // 4. Simple Puppeteer (stable fallback)
    tryPlaywrightHomeFirst,
    tryReelsBased,
  ];

  for (const method of methods) {
    const success = method();
    if (success) {
      console.log('\n' + '═'.repeat(56));
      console.log('🎉 Post completed successfully!');
      process.exit(0);
    }
  }

  // All failed
  console.log('\n' + '═'.repeat(56));
  console.log('\n❌ All methods failed. Troubleshooting:');
  console.log('');
  console.log('1️⃣ Check Instagram cookies:');
  console.log(`   File: ${path.join(SCRIPT_DIR, 'cookies/instagram.json')}`);
  console.log('');
  console.log('2️⃣ Verify environment variables:');
  console.log('   - IG_USERNAME (Instagram username)');
  console.log('   - IG_PASSWORD (Instagram password)');
  console.log('');
  console.log('3️⃣ Check IP blocklist:');
  console.log('   VPS IP may be blocked by Instagram');
  console.log('   Try: Use proxy or VPN');
  console.log('');
  console.log('4️⃣ Update cookies manually:');
  console.log('   Log in to Instagram in a browser');
  console.log('   Export cookies and place in cookies/instagram.json');
  console.log('');
  console.log('5️⃣ Alternative - Use Facebook Graph API:');
  console.log('   node post-to-facebook-api.cjs <image> <caption>');
  console.log('   Requires IG Business Account + FACEBOOK_API_TOKEN');
  console.log('');
  
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
