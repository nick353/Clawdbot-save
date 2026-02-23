#!/bin/bash

# VPS Puppeteer ネットワーク最適化スクリプト
# 目的: Instagram 60秒タイムアウト問題を解決

set -e

echo "🔧 VPS Puppeteer最適化を開始..."

# ============================================
# 1. TCP/ネットワークスタック最適化
# ============================================
echo "1️⃣ TCP設定最適化..."

# TCP接続タイムアウト短縮（デフォルト: 120秒 → 30秒）
sudo sysctl -w net.ipv4.tcp_syn_retries=5 2>/dev/null || echo "   ⚠️ tcp_syn_retries: スキップ（要root）"
sudo sysctl -w net.ipv4.tcp_retries2=10 2>/dev/null || echo "   ⚠️ tcp_retries2: スキップ（要root）"

# TCP接続確立時間短縮
sudo sysctl -w net.ipv4.tcp_keepalive_time=300 2>/dev/null || echo "   ⚠️ tcp_keepalive_time: スキップ"
sudo sysctl -w net.ipv4.tcp_keepalive_intvl=30 2>/dev/null || echo "   ⚠️ tcp_keepalive_intvl: スキップ"
sudo sysctl -w net.ipv4.tcp_tw_reuse=1 2>/dev/null || echo "   ⚠️ tcp_tw_reuse: スキップ"

# ============================================
# 2. Puppeteerタイムアウト設定
# ============================================
echo "2️⃣ Puppeteerタイムアウト設定ファイル作成..."

cat > /root/clawd/config/puppeteer-vps-config.json << 'EOF'
{
  "navigationTimeout": 30000,
  "defaultTimeout": 30000,
  "waitUntilOptions": "networkidle2",
  "launchOptions": {
    "headless": true,
    "args": [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-web-resources",
      "--disable-sync",
      "--disable-translate",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--disable-default-apps",
      "--disable-preconnect",
      "--enable-features=NetworkService,NetworkServiceInProcess",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process"
    ],
    "timeout": 30000,
    "protocolTimeout": 30000,
    "slowMo": 0
  },
  "navigationWaitUntil": "networkidle2",
  "networkTimeout": 30000,
  "dnsTimeout": 5000,
  "connectTimeout": 15000
}
EOF

echo "   ✅ Puppeteer設定: /root/clawd/config/puppeteer-vps-config.json"

# ============================================
# 3. DNS最適化（Google & Cloudflare キャッシュ）
# ============================================
echo "3️⃣ DNS解決速度最適化..."

# /etc/resolv.confをバックアップして最適化
if ! sudo test -f /etc/resolv.conf.bak 2>/dev/null; then
  sudo cp /etc/resolv.conf /etc/resolv.conf.bak 2>/dev/null || echo "   ⚠️ resolv.conf バックアップ: スキップ"
fi

# Cloudflare + Google DNS（順序：高速を優先）
cat > /tmp/resolv-optimized.conf << 'EOF'
nameserver 1.1.1.1
nameserver 8.8.8.8
nameserver 8.8.4.4
options timeout:2 attempts:3 rotate single-request-reopen
EOF

sudo cp /tmp/resolv-optimized.conf /etc/resolv.conf 2>/dev/null || echo "   ⚠️ DNS設定: スキップ（要root）"
echo "   ✅ DNS: Cloudflare (1.1.1.1) + Google (8.8.8.8)"

# ============================================
# 4. メモリ・リソース最適化確認
# ============================================
echo "4️⃣ VPSリソース確認..."

FREE_MEM=$(free -m | awk 'NR==2{print $7}')
AVAILABLE_CPU=$(nproc)

echo "   - 利用可能メモリ: ${FREE_MEM}MB"
echo "   - CPUコア数: ${AVAILABLE_CPU}"

if [ "$FREE_MEM" -lt 512 ]; then
  echo "   ⚠️ メモリ不足 (<512MB): Chromium --single-process 実行推奨"
fi

# ============================================
# 5. 既存プロセスのクリーンアップ
# ============================================
echo "5️⃣ 古いChrome/Chromiumプロセスをクリーンアップ..."

pkill -f "chrome-linux64|chromium" --older-than 1h 2>/dev/null || echo "   ✅ 既存プロセスはすべて最新"

# ============================================
# 6. Instagramアクセス用Puppeteerスクリプト生成
# ============================================
echo "6️⃣ Instagram最適化アクセススクリプト生成..."

mkdir -p /root/clawd/scripts/instagram-optimized

cat > /root/clawd/scripts/instagram-optimized/launch-browser.js << 'EOF'
const puppeteer = require('puppeteer');
const config = require('/root/clawd/config/puppeteer-vps-config.json');

async function launchOptimizedBrowser() {
  const browser = await puppeteer.launch({
    headless: config.launchOptions.headless,
    args: config.launchOptions.args,
    timeout: config.launchOptions.timeout,
    protocolTimeout: config.launchOptions.protocolTimeout,
  });

  const page = await browser.newPage();
  
  // タイムアウト設定
  page.setDefaultTimeout(config.defaultTimeout);
  page.setDefaultNavigationTimeout(config.navigationTimeout);
  
  // リクエストタイムアウト
  page.on('requestfailed', request => {
    console.log(`❌ Request failed: ${request.failure().errorText} (URL: ${request.url()})`);
  });

  return { browser, page };
}

async function navigateWithRetry(page, url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`📍 Navigating to ${url}... (Attempt ${i + 1}/${maxRetries})`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      console.log(`✅ Navigation successful`);
      return true;
    } catch (error) {
      console.log(`⚠️ Navigation failed (Attempt ${i + 1}): ${error.message}`);
      if (i < maxRetries - 1) {
        console.log(`   🔄 Retrying in 5 seconds...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  throw new Error(`Navigation failed after ${maxRetries} attempts`);
}

module.exports = { launchOptimizedBrowser, navigateWithRetry };
EOF

echo "   ✅ Instagramアクセススクリプト: /root/clawd/scripts/instagram-optimized/launch-browser.js"

# ============================================
# 7. テスト実行
# ============================================
echo ""
echo "🧪 **最適化完了！** 次のテストを実行してください:"
echo ""
echo "   node /root/clawd/scripts/instagram-optimized/launch-browser.js"
echo ""
echo "参考チャンネル: Instagram Graph API投稿テスト (ステップ1の並行実行可)"
