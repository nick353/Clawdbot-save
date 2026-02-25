#!/usr/bin/env node
/**
 * Vision Helper - Gemini Vision API統合
 * スクリーンショット → Gemini Vision API → UI要素座標検出
 * 
 * Features:
 * - Base64エンコーディング
 * - リトライロジック（最大3回）
 * - デバッグオーバーレイ（座標確認用）
 * - ハイブリッド方式対応
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY が設定されていません（Vision機能無効）');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 画像をBase64エンコード
 * @param {string} imagePath - 画像ファイルパス
 * @returns {string} base64エンコードされた画像データ
 */
function encodeImageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

/**
 * スクリーンショットからUI要素を検出（Gemini Vision API）
 * @param {string} screenshotPath - スクリーンショットのパス
 * @param {string} targetText - 検出したいUI要素のテキスト（例: "Create", "Next", "Share"）
 * @param {Object} options - オプション
 * @param {number} options.maxRetries - 最大リトライ回数（デフォルト: 3）
 * @param {boolean} options.debug - デバッグモード（デフォルト: false）
 * @returns {Promise<{x: number, y: number, confidence: number, text: string}|null>} 座標情報またはnull
 */
async function detectUIElement(screenshotPath, targetText, options = {}) {
  const { maxRetries = 3, debug = false } = options;
  
  if (!GEMINI_API_KEY) {
    console.log('⚠️  Vision API無効: GEMINI_API_KEY未設定');
    return null;
  }

  if (!fs.existsSync(screenshotPath)) {
    console.error(`❌ スクリーンショットが見つかりません: ${screenshotPath}`);
    return null;
  }

  const base64Image = encodeImageToBase64(screenshotPath);
  const mimeType = screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (debug) {
        console.log(`🔍 Gemini Vision API呼び出し (試行 ${attempt}/${maxRetries}): "${targetText}"`);
      }

      // Gemini 2.0 Flash (最新・高速)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `この画像から、テキスト「${targetText}」を含むボタンまたはUI要素を探してください。

要素が見つかった場合、以下のJSON形式で座標を返してください:
{
  "found": true,
  "x": <中心のX座標（ピクセル）>,
  "y": <中心のY座標（ピクセル）>,
  "confidence": <確信度 0.0-1.0>,
  "text": "<検出されたテキスト>"
}

要素が見つからなかった場合:
{
  "found": false,
  "reason": "<見つからなかった理由>"
}

JSONのみを返してください（他の説明は不要）。`;

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const responseText = response.text().trim();

      if (debug) {
        console.log('📥 Gemini Vision API応答:', responseText);
      }

      // JSONパース（```json ... ``` を除去）
      const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/) || 
                        responseText.match(/```\n([\s\S]+?)\n```/) ||
                        [null, responseText];
      const jsonText = jsonMatch[1] || responseText;
      
      const parsedResult = JSON.parse(jsonText);

      if (parsedResult.found) {
        console.log(`✅ Gemini Vision API: "${targetText}" 検出成功 (x:${parsedResult.x}, y:${parsedResult.y}, 確信度:${parsedResult.confidence})`);
        return {
          x: parsedResult.x,
          y: parsedResult.y,
          confidence: parsedResult.confidence || 0.9,
          text: parsedResult.text || targetText,
        };
      } else {
        console.log(`⚠️  Gemini Vision API: "${targetText}" が見つかりませんでした（${parsedResult.reason}）`);
        return null;
      }

    } catch (error) {
      console.error(`❌ Gemini Vision API エラー (試行 ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2秒、4秒、6秒...
        console.log(`⏳ ${waitTime / 1000}秒待機してリトライ...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('❌ Gemini Vision API: 最大リトライ回数に到達');
        return null;
      }
    }
  }

  return null;
}

/**
 * 検出された座標にデバッグオーバーレイを描画
 * @param {string} screenshotPath - 元のスクリーンショット
 * @param {Array<{x: number, y: number, text: string}>} detections - 検出結果の配列
 * @param {string} outputPath - 出力先パス
 */
async function drawDebugOverlay(screenshotPath, detections, outputPath) {
  try {
    const image = await loadImage(screenshotPath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // 元の画像を描画
    ctx.drawImage(image, 0, 0);

    // 検出結果をオーバーレイ
    detections.forEach((detection, index) => {
      const { x, y, text, confidence } = detection;

      // 十字マーク
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x + 20, y);
      ctx.moveTo(x, y - 20);
      ctx.lineTo(x, y + 20);
      ctx.stroke();

      // 円
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, 2 * Math.PI);
      ctx.stroke();

      // ラベル背景
      const label = `${index + 1}. ${text} (${(confidence * 100).toFixed(0)}%)`;
      ctx.font = 'bold 16px Arial';
      const metrics = ctx.measureText(label);
      const padding = 4;
      
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.fillRect(
        x - metrics.width / 2 - padding,
        y - 50 - padding,
        metrics.width + padding * 2,
        20 + padding * 2
      );

      // ラベルテキスト
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x - metrics.width / 2, y - 40);
    });

    // 画像を保存
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`📸 デバッグオーバーレイ保存: ${outputPath}`);

  } catch (error) {
    console.error('❌ デバッグオーバーレイ描画エラー:', error.message);
  }
}

/**
 * 複数のUI要素を順番に検出（ハイブリッド方式対応）
 * @param {Object} page - Puppeteer page オブジェクト
 * @param {Array<string>} targetTexts - 検出したいテキストの配列
 * @param {string} debugDir - デバッグ用ディレクトリ
 * @param {Object} fallbackSelectors - フォールバックセレクタ（テキスト → セレクタ配列のマップ）
 * @returns {Promise<Array<{text: string, x: number, y: number, method: 'vision'|'selector'}>>}
 */
async function detectMultipleElements(page, targetTexts, debugDir, fallbackSelectors = {}) {
  const results = [];
  
  // デバッグディレクトリ作成
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  for (const targetText of targetTexts) {
    console.log(`\n🔍 "${targetText}" を検出中...`);
    
    // スクリーンショット撮影
    const screenshotPath = path.join(debugDir, `detect-${targetText.toLowerCase().replace(/\s+/g, '-')}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 スクリーンショット: ${screenshotPath}`);

    // Gemini Vision APIで検出試行
    const visionResult = await detectUIElement(screenshotPath, targetText, { 
      debug: true,
      maxRetries: 2 
    });

    if (visionResult) {
      results.push({
        text: targetText,
        x: visionResult.x,
        y: visionResult.y,
        confidence: visionResult.confidence,
        method: 'vision'
      });
      
      // デバッグオーバーレイ作成
      const overlayPath = path.join(debugDir, `overlay-${targetText.toLowerCase().replace(/\s+/g, '-')}.png`);
      await drawDebugOverlay(screenshotPath, [visionResult], overlayPath);
      
    } else {
      console.log(`⚠️  Gemini Vision API失敗 → セレクタフォールバック試行`);
      
      // フォールバック: 従来のセレクタ方式
      const selectors = fallbackSelectors[targetText] || [];
      let found = false;
      
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const box = await element.boundingBox();
            if (box) {
              results.push({
                text: targetText,
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
                method: 'selector',
                selector: selector
              });
              console.log(`✅ セレクタで検出: ${selector}`);
              found = true;
              break;
            }
          }
        } catch (err) {
          // 次のセレクタを試行
        }
      }
      
      if (!found) {
        console.error(`❌ "${targetText}" の検出に失敗（Gemini Vision + セレクタ両方失敗）`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

module.exports = {
  encodeImageToBase64,
  detectUIElement,
  drawDebugOverlay,
  detectMultipleElements,
};
