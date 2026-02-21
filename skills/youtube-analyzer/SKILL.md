---
name: youtube-analyzer
description: Analyze YouTube videos using Gemini API (supports video understanding)
---

# youtube-analyzer

Gemini APIを使ってYouTube動画を詳細分析するSkill

## Requirements

- Gemini API Key (環境変数: `GEMINI_API_KEY`)
- Python 3.x

## Usage

### 基本的な使い方

```bash
python3 /root/clawd/scripts/youtube-analyzer.py
```

または会話トリガー:
- "この動画を分析して [URL]"
- "[YouTube URL] の内容を教えて"

### Script Location

`/root/clawd/scripts/youtube-analyzer.py` (永続化済み)

## Features

- ✅ YouTube動画の直接分析
- ✅ 主なテーマと内容の抽出
- ✅ 重要ポイントの箇条書き
- ✅ 具体的な手法や戦略の解説
- ✅ 実用的な学びの提供

## Limitations

- レート制限あり（429エラー時は30秒待機）
- Gemini APIのクォータに依存
- 長時間動画は分析に時間がかかる場合あり

## Environment Setup

```bash
export GEMINI_API_KEY="YOUR_API_KEY"
```

## Example Output

動画タイトル、主なテーマ、重要ポイント（箇条書き）、具体的手法、実用的な学びを日本語で提供。

## Notes

- API呼び出し時に429エラーが出た場合は30秒待機して再試行
- 動画URLはYouTube形式 (https://youtu.be/VIDEO_ID または https://www.youtube.com/watch?v=VIDEO_ID)
