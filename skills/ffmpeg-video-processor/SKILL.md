# ffmpeg-video-processor

Sora動画のウォーターマーク除去・画質改善を自動化するスキル

## 🏆 WaveSpeedAI + DeepFilterNet3統合版（最新・推奨 - 2026-02-16）

**完全自動・プロ品質処理：**
1. 🧹 **WaveSpeedAI Watermark Remover** - Soraウォーターマーク自動除去
2. 🎨 **WaveSpeedAI Video Upscaler Pro** - 4K超解像（2倍）
3. 🎙️ **DeepFilterNet3** - AI音声改善（RNNベース・Adobe Podcast同等以上）

### 使い方
```bash
bash /root/clawd/skills/ffmpeg-video-processor/process-with-deepfilternet.sh input.mp4
```

### コスト（15秒動画）
- Watermark Remover: $0.05-0.07
- Video Upscaler Pro: $0.08-0.09
- DeepFilterNet3: **無料！**
- **合計: $0.13-0.16/本**

### 処理時間（15秒動画）
- 約6-9分
  - ウォーターマーク除去: 3-5分
  - 4K超解像: 2-3分
  - 音声改善（DeepFilterNet3）: 3秒（2回目以降）

### 自動実行
Discord #ai動画処理チャンネルに動画投稿で自動実行（5分ごとに監視）

### メリット
- ✅ 最高品質の音声改善（RNNベース）
- ✅ Adobe Podcast同等以上の品質
- ✅ DeepFilterNet3は無料
- ✅ VPS環境で余裕を持って動作（442MB）
- ✅ 完全自動化
- ✅ Google Drive自動アップロード

### セットアップ（初回のみ）
```bash
bash /root/clawd/skills/ffmpeg-video-processor/setup-deepfilternet.sh
```

### DeepFilterNet3について
- **開発元:** オープンソース（GitHub: Rikorose/DeepFilterNet）
- **技術:** RNN（リカレントニューラルネット）ベース
- **品質:** 論文ベースの高品質ノイズ除去
- **対応:** 48kHzフルバンド
- **処理速度:** リアルタイムの約5倍速（VPS環境）
- **メモリ:** 442MB（初回起動時）
- **ライセンス:** MIT/Apache 2.0

---

## 🔧 Adobe Podcast版（旧版・参考用）

**完全自動・プロ品質処理：**
1. 🧹 **WaveSpeedAI Watermark Remover** - Soraウォーターマーク自動除去
2. 🎨 **WaveSpeedAI Video Upscaler Pro** - 4K超解像（2倍）
3. 🎙️ **Adobe Podcast AI** - 音声改善（ノイズ除去・音量正規化）

### 使い方
```bash
bash /root/clawd/skills/ffmpeg-video-processor/process-sora-complete.sh input.mp4
```

### コスト（15秒動画）
- Watermark Remover: $0.05
- Video Upscaler Pro: $0.075
- Adobe Podcast: $0.0125
- **合計: $0.1375/本**

### 処理時間（15秒動画）
- 約5-8分
  - ウォーターマーク除去: 2-3分
  - 4K超解像: 2-3分
  - 音声改善: 1-2分

### 注意
- Adobe Podcast APIは公式には存在しない
- ブラウザ自動化（Playwright）が必要
- UIの変更により動作しない場合あり
- **推奨: DeepFilterNet3版を使用**

---

## 機能

### 1. 動画品質改善（ffmpeg）
- ノイズ除去
- シャープ化
- 色補正
- ビットレート最適化

### 2. 音声処理（Adobe Podcast Enhance統合）
- 音声抽出
- Adobe Podcast Enhanceで音声品質向上
- 音声を動画に結合
- ノイズ除去
- 音量正規化

### 3. 統合処理
- 画質改善 + 音声改善を1コマンドで実行
- プリセット設定（YouTube, Instagram, X）

## 使い方

### 基本的な画質改善
```bash
./video-processor.sh improve input.mp4 output.mp4
```

### カスタム設定
```bash
./video-processor.sh custom input.mp4 output.mp4 \
  --denoise high \
  --sharpen medium \
  --bitrate 5000k
```

### バッチ処理
```bash
./video-processor.sh batch /path/to/videos/*.mp4
```

## 処理パラメータ

### ノイズ除去（--denoise）
- `low`: 軽度のノイズ除去（速い）
- `medium`: 標準的なノイズ除去（推奨）
- `high`: 強力なノイズ除去（遅い）

### シャープ化（--sharpen）
- `low`: 軽度のシャープ化
- `medium`: 標準的なシャープ化（推奨）
- `high`: 強力なシャープ化

### ビットレート（--bitrate）
- `3000k`: 低画質（小ファイル）
- `5000k`: 標準（推奨）
- `8000k`: 高画質（大ファイル）

## 出力設定

### プリセット
- `youtube`: YouTube最適化（1080p, 5000k）
- `instagram`: Instagram最適化（720p, 3500k）
- `twitter`: X最適化（720p, 2500k）

## 依存関係

- ffmpeg 4.0+（インストール済み）
- Adobe Podcast Enhance（音声処理用、オプション）

## トラブルシューティング

### エラー: ffmpeg not found
```bash
# VPSにffmpegをインストール
apt-get update && apt-get install -y ffmpeg
```

### エラー: 処理が遅い
- ノイズ除去を `low` に設定
- プリセットを `fast` に変更
- 解像度を下げる

## 例

### YouTube用に最適化
```bash
./video-processor.sh improve input.mp4 output.mp4 --preset youtube
```

### Instagram Reels用に最適化
```bash
./video-processor.sh improve input.mp4 output.mp4 --preset instagram
```

### X用に最適化
```bash
./video-processor.sh improve input.mp4 output.mp4 --preset twitter
```

## 自動化

このスキルは他のスキルと連携できます：

1. 動画処理（このスキル）
2. 字幕追加（手動）
3. SNS投稿（sns-multi-poster）

## メンテナンス

定期的に以下を確認：
- ffmpegのバージョン
- 処理時間のモニタリング
- 出力品質のチェック

---

**作成日**: 2026-02-14
**作成者**: リッキー 🐥
**バージョン**: 1.0.0
