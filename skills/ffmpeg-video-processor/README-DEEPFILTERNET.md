# DeepFilterNet3 統合版 - 運用ガイド

**作成日:** 2026-02-16  
**作成者:** リッキー 🐥

---

## 📋 **概要**

Sora動画のウォーターマーク除去・画質改善・音声改善を自動化するワークフロー。

**処理フロー:**
1. 🧹 WaveSpeedAI Watermark Remover（Soraウォーターマーク除去）
2. 🎨 WaveSpeedAI Video Upscaler Pro（4K超解像）
3. 🎙️ DeepFilterNet3（AI音声改善・RNNベース）
4. ☁️ Google Drive（自動アップロード）
5. 💬 Discord通知（完了報告）

---

## 🚀 **使い方**

### 1️⃣ **自動処理（推奨）**

1. Discord #ai動画処理チャンネルに動画を投稿
2. 5分以内に自動検知＆処理開始
3. 完了したらDiscordに通知（Google Driveリンク付き）

### 2️⃣ **手動実行**

```bash
bash /root/clawd/skills/ffmpeg-video-processor/process-with-deepfilternet.sh <動画ファイル>
```

---

## 📊 **処理性能（15秒動画）**

### ⏱️ **処理時間:**
- **総処理時間:** 6-9分
  - ウォーターマーク除去: 3-5分
  - 4K超解像: 2-3分
  - 音声抽出: 1秒
  - DeepFilterNet3: 3秒（2回目以降）
  - 動画結合: 1秒
  - Google Driveアップロード: 30秒

### 💰 **コスト:**
- WaveSpeedAI Watermark Remover: $0.05-0.07
- WaveSpeedAI Video Upscaler Pro: $0.08-0.09
- DeepFilterNet3: **無料！**
- **合計: $0.13-0.16/本**

### 💾 **VPS環境:**
- CPU: 1コア（Intel Xeon Gold 6152）
- メモリ: 1.9GB（利用可能: 952MB）
- DeepFilterNet3メモリ使用量: 442MB
- ✅ **余裕を持って動作可能**

---

## 🎙️ **DeepFilterNet3について**

### 📚 **技術情報:**
- **開発元:** オープンソース（GitHub: Rikorose/DeepFilterNet）
- **技術:** RNN（リカレントニューラルネット）ベース
- **品質:** Adobe Podcast同等以上
- **対応:** 48kHzフルバンド
- **処理速度:** リアルタイムの約5倍速
- **メモリ:** 442MB（初回起動時）
- **ライセンス:** MIT/Apache 2.0

### ⭐ **メリット:**
- ✅ 高品質なノイズ除去（RNNベース）
- ✅ 完全無料
- ✅ VPS環境で動作可能
- ✅ メンテナンスフリー（APIキー不要）

### 📋 **比較: DeepFilterNet3 vs ffmpeg afftdn**

| 項目 | DeepFilterNet3 | ffmpeg afftdn |
|------|---------------|---------------|
| 処理時間 | 3秒（2回目以降） | 0.26秒 |
| メモリ | 442MB | 54MB |
| 品質 | ⭐⭐⭐⭐⭐（RNN） | ⭐⭐⭐⭐（FFT） |
| コスト | 無料 | 無料 |
| VPS環境 | ✅ 動作可能 | ✅ 動作可能 |

---

## 🔧 **セットアップ（初回のみ）**

### 1️⃣ **自動セットアップ:**

```bash
bash /root/clawd/skills/ffmpeg-video-processor/setup-deepfilternet.sh
```

### 2️⃣ **手動セットアップ:**

```bash
# 1. Rustインストール
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# 2. Python仮想環境作成
python3 -m venv /root/clawd/envs/deepfilternet
source /root/clawd/envs/deepfilternet/bin/activate

# 3. PyTorchインストール（CPU版）
pip install torch==2.2.0+cpu torchaudio==2.2.0+cpu --index-url https://download.pytorch.org/whl/cpu

# 4. soundfileインストール
pip install soundfile

# 5. DeepFilterNetインストール
pip install deepfilternet

# 6. 確認
deepFilter --help
```

---

## 📂 **ファイル構成**

```
/root/clawd/skills/ffmpeg-video-processor/
├── process-with-deepfilternet.sh    # メインスクリプト（DeepFilterNet3版）
├── setup-deepfilternet.sh           # セットアップスクリプト
├── SKILL.md                         # スキルドキュメント
├── README-DEEPFILTERNET.md          # 運用ガイド（このファイル）
└── adobe-cookies.json               # Adobe Podcast認証情報（旧版用）

/root/clawd/envs/
└── deepfilternet/                   # DeepFilterNet3環境（永続化）
    ├── bin/
    ├── lib/
    └── ...

/root/clawd/scripts/
└── auto-video-processor.sh          # 自動処理スクリプト（HEARTBEAT統合）

/root/.clawdbot/media/
├── inbound/                         # 入力動画（自動検知）
└── outbound/                        # 処理済み動画
```

---

## 🔄 **トラブルシューティング**

### ❌ **DeepFilterNet3環境が見つかりません**

**原因:** 環境が削除された、またはパスが間違っている

**解決策:**
```bash
# 再セットアップ
bash /root/clawd/skills/ffmpeg-video-processor/setup-deepfilternet.sh
```

---

### ❌ **処理中にエラーが発生しました**

**原因:** WaveSpeedAI APIエラー、ネットワークエラー

**解決策:**
1. ログを確認（Discord通知に記載）
2. APIキーの有効期限を確認
3. 再実行

---

### ❌ **Google Driveアップロード失敗**

**原因:** rclone設定エラー

**解決策:**
```bash
# rclone設定確認
rclone listremotes

# gdrive: が表示されない場合は再設定
rclone config
```

---

## 📊 **パフォーマンス最適化**

### 💡 **ヒント:**
- **初回起動:** モデルロードに約4秒かかる
- **2回目以降:** 音声処理のみ（約3秒）
- **並列処理:** 1本ずつ処理（メモリ制約）
- **VPS再起動後:** 環境変数は自動ロード（~/.profile）

---

## 📝 **メンテナンス**

### 🔄 **定期メンテナンス（不要）**
- DeepFilterNet3は追加のメンテナンス不要
- WaveSpeedAI APIキーの更新のみ定期確認

### 🧹 **クリーンアップ（任意）**
```bash
# 一時ファイル削除（自動で実行されるため通常不要）
rm -rf /tmp/sora_process_*

# 古い動画ファイル削除（手動）
find /root/.clawdbot/media/inbound/ -type f -mtime +7 -delete
```

---

## 🎯 **今後の改善案**

- [ ] 複数動画の並列処理（メモリに余裕があれば）
- [ ] 処理進捗のリアルタイム報告
- [ ] カスタムウォーターマーク座標指定
- [ ] 画質向上のプリセット選択（2倍/4倍）

---

## 📞 **サポート**

問題が発生した場合：
1. Discord #ai動画処理チャンネルで報告
2. エラーログを添付
3. リッキー 🐥 が即座に対応

---

**最終更新:** 2026-02-16  
**バージョン:** 1.0.0（DeepFilterNet3統合版）
