#!/usr/bin/env node
/**
 * Claude Vision API Helper（Clawdbot統合版）
 * Anthropic Messages APIを直接呼び出してVision機能を使用
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * スクリーンショットからUI要素の座標を検出
 * @param {string} imagePath - スクリーンショットのパス
 * @param {string} targetDescription - 検出したい要素の説明
 * @param {Object} options - オプション設定
 * @returns {Promise<{x: number, y: number, confidence: number, description: string} | null>}
 */
async function detectUIElement(imagePath, targetDescription, options = {}) {
  const {
    debug = false,
    maxRetries = 2,
  } = options;

  if (!fs.existsSync(imagePath)) {
    throw new Error(`画像が見つかりません: ${imagePath}`);
  }

  // 画像をBase64エンコード
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const prompt = `この画面で "${targetDescription}" の中心座標 (x, y) を検出してください。

画像サイズ: 1920x1080
座標系: 左上が原点 (0, 0)、右下が (1920, 1080)

以下のJSON形式で返してください（他のテキストは不要）:
{"x": 数値, "y": 数値, "confidence": 0-1, "description": "検出した要素の説明"}

見つからない場合:
{"x": null, "y": null, "confidence": 0, "description": "要素が見つかりません"}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (debug) {
        console.log(`🔍 Claude Vision API呼び出し (試行 ${attempt}/${maxRetries}): "${targetDescription}"`);
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const responseText = message.content[0].text.trim();
      
      if (debug) {
        console.log(`📥 Claude Vision API応答: ${responseText}`);
      }

      // JSON抽出（```json ... ``` または直接JSON）
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const result = JSON.parse(jsonText);

      if (result.x !== null && result.y !== null && result.confidence > 0) {
        if (debug) {
          console.log(`✅ Claude Vision API: "${targetDescription}" 検出成功 (x:${result.x}, y:${result.y}, 確信度:${result.confidence})`);
        }
        return result;
      } else {
        if (debug) {
          console.log(`⚠️ Claude Vision API: "${targetDescription}" が見つかりませんでした`);
        }
        return null;
      }

    } catch (error) {
      if (attempt === maxRetries) {
        if (debug) {
          console.error(`❌ Claude Vision API失敗 (${maxRetries}回試行): ${error.message}`);
        }
        throw error;
      }
      
      if (debug) {
        console.log(`⚠️ 試行 ${attempt} 失敗、リトライ中...`);
      }
      await new Promise(r => setTimeout(r, 2000)); // 2秒待機
    }
  }

  return null;
}

module.exports = {
  detectUIElement,
};

// CLI実行
if (require.main === module) {
  const [,, imagePath, targetDescription] = process.argv;
  
  if (!imagePath || !targetDescription) {
    console.error('使い方: node claude-vision-helper.cjs <image_path> <target_description>');
    process.exit(1);
  }

  detectUIElement(imagePath, targetDescription, { debug: true })
    .then(result => {
      if (result) {
        console.log('\n✅ 検出成功:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n⚠️ 要素が見つかりませんでした');
      }
    })
    .catch(error => {
      console.error('\n❌ エラー:', error.message);
      process.exit(1);
    });
}
