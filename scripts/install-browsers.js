#!/usr/bin/env node
/**
 * Install Playwright browsers (Chromium) for Clawdbot browser automation
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getRepoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

function installBrowsers() {
  const repoRoot = getRepoRoot();
  console.log("[install-browsers] Installing Playwright browsers...");
  
  // Install Chromium only (lighter than all browsers)
  const result = spawnSync(
    "npx",
    ["playwright", "install", "--with-deps", "chromium"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
    }
  );
  
  if (result.status === 0) {
    console.log("✅ [install-browsers] Chromium installed successfully");
  } else {
    console.warn("⚠️ [install-browsers] Browser installation failed (non-fatal)");
  }
}

try {
  const skip =
    process.env.CLAWDBOT_SKIP_BROWSER_INSTALL === "1" ||
    process.env.VITEST === "true" ||
    process.env.NODE_ENV === "test";

  if (!skip) {
    installBrowsers();
  }
} catch (err) {
  console.warn(`[install-browsers] ${err}`);
  // Non-fatal: don't exit with error
}
