#!/bin/bash
# Instagram Playwright Codegen Session Generator (alternative method)
# 用途: npx @playwright/test codegen を使用してInstagram ログインセッションを記録
# 実行: bash instagram-codegen-session.sh
# 出力: /root/clawd/auth/instagram.json + /root/clawd/auth/instagram-storage-state.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AUTH_DIR="$PROJECT_ROOT/auth"
PROFILE_FILE="$AUTH_DIR/instagram.json"
STORAGE_STATE_FILE="$AUTH_DIR/instagram-storage-state.json"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}🔐 Instagram Playwright Codegen セッション生成${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# チェック: @playwright/test がインストール済みか
if ! npm list @playwright/test &>/dev/null && ! npm list -g @playwright/test &>/dev/null; then
    echo -e "${YELLOW}📦 @playwright/test をインストール中...${NC}"
    cd "$PROJECT_ROOT"
    npm install @playwright/test --save-dev
fi

echo -e "${GREEN}✅ @playwright/test インストール確認完了${NC}"
echo ""

# Codegen スクリプト（ブラウザコンテキスト + セッション保存）
CODEGEN_SCRIPT="$AUTH_DIR/instagram-session-capture.js"

cat > "$CODEGEN_SCRIPT" << 'CODEGEN_JS'
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.dirname(__filename);
const STORAGE_STATE_FILE = path.join(AUTH_DIR, 'instagram-storage-state.json');
const PROFILE_FILE = path.join(AUTH_DIR, 'instagram.json');

(async () => {
  console.log('\n🎬 Playwright Codegen + Session Capture Mode');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📱 ブラウザが起動します。以下の手順を実行してください:');
  console.log('');
  console.log('  1️⃣ Instagram ホームページに移動（https://www.instagram.com）');
  console.log('  2️⃣ ログイン画面から、あなたのInstagramアカウント認証情報を入力');
  console.log('  3️⃣ OTP(ワンタイムパスワード)がある場合は入力');
  console.log('  4️⃣ ログイン後、ホームフィード が表示されることを確認');
  console.log('  5️⃣ 操作が完了したら、ブラウザを閉じる');
  console.log('');
  console.log('⚠️ 重要: ブラウザを閉じるまで、このプロセスは自動的に');
  console.log('         全てのセッション情報を記録し、保存します。');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ページ操作を記録するイベントリスナー
  let recordedActions = [];

  page.on('popup', async (popup) => {
    const popupPage = popup;
    console.log(`🔗 ポップアップを検出: ${popupPage.url()}`);
    recordedActions.push({
      type: 'popup',
      url: popupPage.url()
    });
  });

  // Instagram に移動
  console.log('⏳ Instagram にアクセス中...\n');
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });

  // セッションが確立されるまで待機
  console.log('⏳ セッション確立待機中...\n');
  
  let sessionEstablished = false;
  const startTime = Date.now();
  const timeout = 60 * 60 * 1000; // 60分

  while (!sessionEstablished && (Date.now() - startTime) < timeout) {
    await page.waitForTimeout(5000); // 5秒ごとに確認

    // ログイン確認ロジック
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'sessionid');
    const currentUrl = page.url();

    // ログイン成功の兆候
    if (sessionCookie || (currentUrl.includes('/accounts/') && !currentUrl.includes('/accounts/login'))) {
      console.log('✅ セッション確立を確認!\n');
      sessionEstablished = true;
      break;
    }

    // ログインページのまま確認
    if (currentUrl.includes('/accounts/login')) {
      // まだログイン中
      continue;
    }
  }

  if (!sessionEstablished) {
    console.warn('⚠️ セッション確立を自動確認できませんでした。');
    console.warn('   ただし、手動ログインが完了している場合は、引き続き進めます。\n');
  }

  // ページを待機後、セッション情報を取得
  console.log('💾 セッション情報を取得中...');
  
  const storageState = await context.storageState();
  const cookies = await context.cookies();

  // ストレージ状態をファイルに保存
  fs.writeFileSync(STORAGE_STATE_FILE, JSON.stringify(storageState, null, 2));
  console.log(`✅ ストレージ状態を保存: ${STORAGE_STATE_FILE}`);

  // プロファイル JSON を生成
  const sessionidCookie = cookies.find(c => c.name === 'sessionid');
  const csrftokenCookie = cookies.find(c => c.name === 'csrftoken');

  const profile = {
    type: 'instagram',
    method: 'playwright-codegen',
    generated_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    
    // ストレージ状態全体
    storage_state: storageState,
    
    // 重要なクッキー
    session_id: sessionidCookie?.value || null,
    csrf_token: csrftokenCookie?.value || null,
    
    // その他のクッキー情報
    cookies_snapshot: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite
    })),

    // セッション情報
    session_info: {
      is_authenticated: !!sessionidCookie,
      session_established_at: new Date().toISOString(),
      expires_at: sessionidCookie?.expires ? new Date(sessionidCookie.expires * 1000).toISOString() : null
    },

    // 使用方法
    usage: {
      storage_state: 'playwright context.addInitScript()で使用',
      session_id: 'HTTP ヘッダーまたはクッキーとして使用',
      csrf_token: 'POST リクエストで使用'
    }
  };

  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
  console.log(`✅ プロファイルを保存: ${PROFILE_FILE}`);

  console.log('\n🛑 ブラウザを閉じています...');
  await browser.close();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ セッション生成完了!');
  console.log('');
  console.log('📁 生成されたファイル:');
  console.log(`  • プロファイル: ${PROFILE_FILE}`);
  console.log(`  • ストレージ状態: ${STORAGE_STATE_FILE}`);
  console.log('');
  console.log('次のステップ: post-to-instagram-v5.cjs で自動投稿テスト可能');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
})().catch(error => {
  console.error('\n❌ エラーが発生しました:');
  console.error(error);
  process.exit(1);
});
CODEGEN_JS

chmod +x "$CODEGEN_SCRIPT"

echo -e "${GREEN}✅ Codegen スクリプト作成完了${NC}"
echo "📁 スクリプト: $CODEGEN_SCRIPT"
echo ""

# 実行ガイド
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📝 実行ガイド${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  このスクリプトを実行するには:"
echo ""
echo -e "    ${YELLOW}node $CODEGEN_SCRIPT${NC}"
echo ""
echo "または"
echo ""
echo -e "    ${YELLOW}cd $PROJECT_ROOT${NC}"
echo -e "    ${YELLOW}npx playwright codegen https://www.instagram.com --save-storage=auth/instagram-storage-state.json${NC}"
echo ""
echo "ブラウザが起動します。Instagram にログインしてください。"
echo ""
