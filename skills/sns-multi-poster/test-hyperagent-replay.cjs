#!/usr/bin/env node
/**
 * HyperAgent Action Cache Replay Test
 * 目的: 保存したAction Cacheからリプレイ（LLM呼び出しなし）
 */

const { HyperAgent } = require("@hyperbrowser/agent");
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.env.DRY_RUN === "true";

(async () => {
  console.log("🔄 HyperAgent Action Cache Replay Test");
  
  if (DRY_RUN) {
    console.log("🔄 DRY RUN: スキップ");
    return;
  }

  const cachePath = path.join(__dirname, "action-cache", "instagram-login.json");
  
  if (!fs.existsSync(cachePath)) {
    console.error(`❌ Action Cacheが見つかりません: ${cachePath}`);
    console.error("先に test-hyperagent-instagram.cjs を実行してください");
    process.exit(1);
  }

  const loginCache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  console.log(`📂 Action Cache読み込み: ${loginCache.steps?.length || 0} ステップ`);

  // LLMプロバイダー選択
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
    console.error("❌ LLM API Key が設定されていません");
    process.exit(1);
  }

  const agent = new HyperAgent({
    llm: llmConfig,
    debug: true,
    launchOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  try {
    const page = await agent.newPage();
    
    console.log("📱 Instagramにアクセス中...");
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("🚀 Action Cacheからリプレイ（LLM呼び出しなし）...");
    const startTime = Date.now();
    
    const replay = await page.runFromActionCache(loginCache, {
      maxXPathRetries: 3,
      debug: true
    });
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️ 実行時間: ${elapsedTime}秒`);
    console.log(`📊 リプレイ結果:`);
    console.log(`  - Status: ${replay.status}`);
    console.log(`  - ステップ数: ${replay.steps?.length || 0}`);
    
    const xpathSuccessRate = replay.steps?.filter(s => s.usedXPath).length / replay.steps?.length * 100 || 0;
    console.log(`  - XPath成功率: ${xpathSuccessRate.toFixed(1)}%`);
    
    if (xpathSuccessRate === 100) {
      console.log("✅ 完全にXPathベース実行（LLMコスト: $0）");
    } else {
      console.log(`⚠️ 一部LLMフォールバック使用`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // スクリーンショット保存
    const screenshotPath = path.join(__dirname, "test-screenshots", "instagram-replay-result.png");
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 スクリーンショット保存: ${screenshotPath}`);
    
  } catch (error) {
    console.error("❌ エラー:", error.message);
    process.exit(1);
  } finally {
    await agent.closeAgent();
    console.log("🔒 ブラウザクローズ");
  }
})();
