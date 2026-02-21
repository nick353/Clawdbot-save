# SNS Content Curator Skill

## 概要
英語インフルエンサー監視 → 日本語コンテンツ生成 → X・LinkedIn自動投稿

## ステータス
- ✅ X個人アカウント投稿: Cookie設定済み（15件）
- ⏳ LinkedIn投稿: Cookie待ち（明日設定予定）
- ✅ 毎日JST 9:00 自動実行（cronジョブ: sns-x-linkedin-curator）

## 情報収集パイプライン（127件/日）
| Tier | 情報源 | 件数 |
|------|-------|------|
| Tier1 | X インフルエンサー17名 + キーワード6種（bird CLI） | ~95件 |
| Tier1補完 | Brave Web検索 7クエリ | ~27件 |
| Tier2 | tldr.tech, bensbites, therundown, IndieHackers, ProductHunt | ~5件 |
| Tier3 | Matt Wolfe YouTube最新動画 | ~3件 |

## 監視インフルエンサー一覧
**AI/ツール系:** @levelsio, @tibo_maker, @emollick, @mattshumer_, @rowancheung_, @heykahn, @mreflow, @aiexplained_, @dotey
**ビジネス/成功事例:** @theSamParr, @AlexHormozi, @sahilbloom, @naval, @businessbarista
**インディーハッカー:** @IndieHackers, @patio11, @jackbutcher

## 生成コンテンツ
- X用（280文字以内）+ アイキャッチ画像 or 元ツイート動画/画像
- LinkedIn用（長文・ストーリー形式）
- 毎日3投稿生成

## ファイル構成
```
sns-curator/
├── curate-and-post.sh      # メインスクリプト
├── generate-eyecatch.py    # アイキャッチ画像生成（1200x675px）
├── fetch-tweet-media.py    # ツイートから動画/画像取得（yt-dlp）
├── fetch-tier2-tier3.py    # Tier2/3収集（ニュースレター・YouTube）
├── post-to-x-personal.cjs  # X投稿（画像/動画対応）
├── post-to-linkedin.cjs    # LinkedIn投稿（Cookie待ち）
├── cookies/
│   ├── x-personal.json     ✅ 設定済み
│   └── linkedin.json       ⏳ 明日設定
├── generated/              # 生成コンテンツ保存
└── lib/                    # ユーティリティモジュール
```

## 使い方
```bash
# テスト（投稿なし）
bash curate-and-post.sh --no-post

# X のみ投稿
bash curate-and-post.sh --x-only

# LinkedIn のみ投稿
bash curate-and-post.sh --li-only

# フル実行
bash curate-and-post.sh
```

## LinkedInのCookie設定方法
1. Chrome で linkedin.com にログイン
2. Chrome拡張「Cookie-Editor」をインストール
3. linkedin.com を開いた状態で拡張を開く
4. 「Export」→「Export as JSON」→ コピー
5. `/root/clawd/skills/sns-curator/cookies/linkedin.json` に保存
   または Discord #x-linkedin-管理 に貼り付け → 自動設定

## cronジョブ
- 名前: `sns-x-linkedin-curator`
- スケジュール: 毎日 UTC 0:00（JST 9:00）
- 報告先: Discord #x-linkedin-管理 (1473350580750651568)
