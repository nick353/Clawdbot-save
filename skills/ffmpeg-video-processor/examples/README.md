# Examples - ffmpeg-video-processor

このディレクトリには、実用的な使用例のサンプルスクリプトが含まれています。

## サンプルスクリプト一覧

### 1. youtube-optimize.sh
YouTube投稿用に動画を最適化します。

```bash
./youtube-optimize.sh input.mp4 youtube_ready.mp4
```

**処理内容:**
- 解像度を1080pに変更
- 中品質で圧縮（CRF 23）
- H.264/AAC形式で出力

**適用先:** YouTube, Vimeo

---

### 2. sns-optimize.sh
SNS投稿用に動画を軽量化します。

```bash
./sns-optimize.sh input.mp4 sns_ready.mp4
```

**処理内容:**
- 解像度を720pに変更
- 低品質で圧縮（ファイルサイズ優先）
- モバイル視聴に最適化

**適用先:** Instagram, X (Twitter), Facebook, TikTok

---

### 3. batch-process.sh
ディレクトリ内のすべての動画を一括処理します。

```bash
./batch-process.sh /path/to/videos/
```

**処理内容:**
- 指定ディレクトリ内のすべての.mp4ファイルを処理
- 720p + 中品質圧縮
- `*_processed.mp4` として保存

**用途:** 複数動画の一括変換、アーカイブ作成

---

## カスタマイズ方法

これらのスクリプトをコピーして、自分のニーズに合わせて編集できます。

### 例: 解像度を変更

```bash
# 1080pではなく480pにする
$PROCESSOR resize "$INPUT" "$TEMP1" 480p
```

### 例: 圧縮レベルを変更

```bash
# mediumではなくhighにする（高品質）
$PROCESSOR compress "$TEMP1" "$OUTPUT" high
```

### 例: 音声も抽出

```bash
# 動画処理後に音声も抽出
$PROCESSOR extract-audio "$OUTPUT" "${OUTPUT%.mp4}.mp3" 320k
```

## トラブルシューティング

### パスの問題

スクリプトは `examples/` ディレクトリから実行することを想定しています。
別の場所から実行する場合は、`PROCESSOR` 変数を調整してください:

```bash
# 絶対パスを使用
PROCESSOR="/root/clawd/skills/ffmpeg-video-processor/video-processor.sh"
```

### 権限エラー

```bash
# 実行権限を付与
chmod +x *.sh
```

### 動画が見つからない

バッチ処理で対象ファイルが見つからない場合:
- `.mp4` 拡張子を確認
- ディレクトリパスが正しいか確認
- 既に `_processed.mp4` で終わるファイルはスキップされます

## 参考資料

- 親ディレクトリの `SKILL.md`: 全コマンドの詳細
- `video-processor.sh help`: ヘルプを表示
