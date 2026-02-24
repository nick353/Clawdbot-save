#!/usr/bin/env node
/**
 * HyperAgent Instagram Login Test
 * 目的: AIがログインフォームを自動判断してログイン
 * Action Cacheを保存して次回から高速実行
 */

const { HyperAgent } = require("@hyperbrowser/agent");
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.env.DRY_RUN === "true";

(async () => {
  console.log("🤖 HyperAgent Instagram Login Test");
  
  if (DRY_RUN) {
    console.log("🔄 DRY RUN: スキップ");
    return;
  }

  // 認証情報チェック
  const IG_USERNAME = process.env.IG_USERNAME || "nisen_prints";
  const IG_PASSWORD = process.env.IG_PASSWORD;
  
  // LLM API Keyチェック（いずれか必須）
  const hasLlmKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!hasLlmKey) {
    console.error("❌ LLM API Key が設定されていません（GEMINI_API_KEY/ANTHROPIC_API_KEY/OPENAI_API_KEY のいずれか）");
    process.exit(1);
  }
  
  if (!IG_PASSWORD) {
    console.error("❌ IG_PASSWORD が設定されていません");
    process.exit(1);
  }

  // LLMプロバイダー選択（優先順位: Gemini > Anthropic > OpenAI）
  let llmConfig;
  if (process.env.GEMINI_API_KEY) {
    llmConfig = {
      provider: "gemini",
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY
    };
    console.log("🤖 LLM: Google Gemini 2.5 Flash");
  } else if (process.env.ANTHROPIC_API_KEY) {
    llmConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: process.env.ANTHROPIC_API_KEY
    };
    console.log("🤖 LLM: Anthropic Claude Sonnet 4.5");
  } else if (process.env.OPENAI_API_KEY) {
    llmConfig = {
      provider: "openai",
      model: "gpt-4o",
      apiKey: process.env.OPENAI_API_KEY
    };
    console.log("🤖 LLM: OpenAI GPT-4o");
  } else {
    console.error("❌ LLM API Key が設定されていません（GEMINI_API_KEY/ANTHROPIC_API_KEY/OPENAI_API_KEY）");
    process.exit(1);
  }

  const agent = new HyperAgent({
    llm: llmConfig,
    debug: true,
    headless: true // VPS環境でヘッドレスモード
  });

  try {
    const page = await agent.newPage();
    
    console.log("📱 Instagramにアクセス中...");
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    
    // 少し待つ（ページ読み込み完了）
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("🤖 AIがログインフォームを自動判断してログイン...");
    const { actionCache } = await page.ai(
      `ログインフォームに以下の情報を入力してログイン:
       - ユーザー名フィールドに「${IG_USERNAME}」を入力
       - パスワードフィールドに「${IG_PASSWORD}」を入力
       - ログインボタンをクリック`,
      {
        useDomCache: true
      }
    );
    
    console.log("⏳ ログイン処理完了待ち...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // ログイン成功確認
    const currentUrl = page.url();
    console.log(`📍 現在のURL: ${currentUrl}`);
    
    if (currentUrl.includes("instagram.com") && !currentUrl.includes("login")) {
      console.log("✅ ログイン成功！");
      
      // Action Cache保存
      const cachePath = path.join(__dirname, "action-cache", "instagram-login.json");
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(actionCache, null, 2));
      console.log(`💾 Action Cache保存: ${cachePath}`);
      console.log(`📊 ステップ数: ${actionCache.steps?.length || 0}`);
      
      // スクリーンショット保存
      const screenshotPath = path.join(__dirname, "test-screenshots", "instagram-logged-in.png");
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 スクリーンショット保存: ${screenshotPath}`);
      
    } else {
      console.error("❌ ログイン失敗（URLが変わっていない）");
      
      // エラー時のスクリーンショット
      const errorScreenshot = path.join(__dirname, "test-screenshots", "instagram-login-error.png");
      fs.mkdirSync(path.dirname(errorScreenshot), { recursive: true });
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.error(`📸 エラースクリーンショット: ${errorScreenshot}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ エラー:", error.message);
    process.exit(1);
  } finally {
    await agent.closeAgent();
    console.log("🔒 ブラウザクローズ");
  }
})();
