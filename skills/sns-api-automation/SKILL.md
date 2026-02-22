# SNS API 自動投稿・削除スキル

Python を使用して Instagram、Facebook、Threads、X、Pinterest に **自動投稿・削除**するスキルです。

## 📋 概要

- **対応 SNS**: Instagram、Facebook、Threads、X（Twitter）、Pinterest
- **実装方式**: 公式 API（RPA 廃止）
- **認可方式**: OAuth 2.0 + Bearer Token
- **言語**: Python 3.8+
- **主要機能**:
  - ✅ 複数 SNS への同時投稿
  - ✅ 投稿・ピンの削除
  - ✅ バズツイート・ピン検索
  - ✅ トレンド分析
  - ✅ 投稿スケジューリング
  - ✅ 自動リトライ + エラーハンドリング

---

## 🚀 インストール方法

### Step 1: 必要な Python パッケージをインストール

```bash
pip install requests schedule
```

### Step 2: API トークンを登録

各 SNS の Developer Portal でアプリを作成し、トークンを取得してください。

```bash
# Meta API トークン登録
bash /root/clawd/scripts/setup-sns-api-credentials.sh register-meta

# X API トークン登録
bash /root/clawd/scripts/setup-sns-api-credentials.sh register-x

# Pinterest API トークン登録
bash /root/clawd/scripts/setup-sns-api-credentials.sh register-pinterest
```

### Step 3: トークン検証

```bash
bash /root/clawd/scripts/setup-sns-api-credentials.sh validate
```

### ドキュメント参照

詳細な認可申請手順：

- **Meta API（Instagram/Facebook/Threads）**:
  ```
  /root/clawd/docs/sns-api-setup/meta-setup.md
  ```

- **X API（Twitter）**:
  ```
  /root/clawd/docs/sns-api-setup/x-setup.md
  ```

- **Pinterest API**:
  ```
  /root/clawd/docs/sns-api-setup/pinterest-setup.md
  ```

---

## 💡 使用例

### 1. 基本的な投稿

```python
from sns_api_unified import SNSUnifiedAPI, SNSPlatform

# API インスタンス作成
api = SNSUnifiedAPI()

# Instagram + X に同時投稿
results = api.post(
    platforms=[SNSPlatform.INSTAGRAM, SNSPlatform.X],
    text="Hello World!",
    image_url="https://example.com/image.jpg"
)

print(results)
# {
#   "instagram": {"success": True, "data": {...}},
#   "x": {"success": True, "data": {...}}
# }
```

### 2. Facebook + Pinterest に投稿

```python
results = api.post(
    platforms=[SNSPlatform.FACEBOOK, SNSPlatform.PINTEREST],
    text="Beautiful sunset",
    image_url="https://example.com/sunset.jpg",
    link_url="https://example.com"
)
```

### 3. 投稿を削除

```python
# Instagram の投稿を削除
success = api.delete(SNSPlatform.INSTAGRAM, "18000000000000001")

# X のツイートを削除
success = api.delete(SNSPlatform.X, "1234567890")

# Pinterest のピンを削除
success = api.delete(SNSPlatform.PINTEREST, "9876543210")
```

### 4. スケジュール投稿

```python
from datetime import datetime, timedelta

# 30 分後に投稿をスケジュール
schedule_time = datetime.now() + timedelta(minutes=30)

schedule_result = api.post(
    platforms=[SNSPlatform.INSTAGRAM],
    text="Scheduled post!",
    image_url="https://example.com/scheduled.jpg",
    schedule_time=schedule_time
)

print(schedule_result)
# {
#   "job_id": "post_1708610000_0",
#   "platforms": ["instagram"],
#   "scheduled_time": "2026-02-22T14:30:00",
#   "delay_seconds": 1800
# }

# スケジューラーを実行
# api.run_scheduler()  # バックグラウンドで継続実行
```

### 5. バズツイートを検索

```python
# X（Twitter）でバズツイートを検索
buzz_tweets = api.search_buzz(
    platform=SNSPlatform.X,
    query="AI OR machine learning",
    min_engagement=1000
)

for tweet in buzz_tweets:
    print(f"{tweet['username']}: {tweet['text']}")
    print(f"  いいね: {tweet['likes']}, リツイート: {tweet['retweets']}")
```

### 6. トレンドコンテンツを取得

```python
# X のトレンドツイートを取得
trending = api.get_trending(SNSPlatform.X)

for tweet in trending[:5]:
    print(f"[{tweet['engagement_score']}] @{tweet['username']}: {tweet['text']}")
```

### 7. Pinterest のボード一覧取得

```python
boards = api.config.pinterest.get_user_boards()

for board in boards:
    print(f"ボード: {board['name']}")
    print(f"  ID: {board['id']}")
    print(f"  プライバシー: {board['privacy']}")
```

### 8. 投稿統計を表示

```python
stats = api.get_stats()

print(f"総投稿数: {stats['total_posts']}")
print(f"成功: {stats['successful']}")
print(f"失敗: {stats['failed']}")
print(f"成功率: {stats['success_rate']:.1f}%")
print(f"\nプラットフォーム別:")
for platform, counts in stats['platform_stats'].items():
    print(f"  {platform}: 成功 {counts['success']}, 失敗 {counts['failed']}")
```

---

## 📚 詳細 API リファレンス

### SNSUnifiedAPI（統合インターフェース）

#### `post(platforms, text, image_url, video_url, link_url, schedule_time)`

複数 SNS に同時投稿

**パラメータ:**
- `platforms` (List[SNSPlatform]): 投稿先プラットフォーム
- `text` (str): 投稿テキスト
- `image_url` (str, optional): 画像 URL
- `video_url` (str, optional): 動画 URL
- `link_url` (str, optional): リンク URL
- `schedule_time` (datetime, optional): スケジュール時刻

**戻り値:**
```python
{
  "platform_name": {
    "success": bool,
    "data": {...}  # または
    "error": "error message"
  }
}
```

---

#### `delete(platform, post_id)`

投稿を削除

**パラメータ:**
- `platform` (SNSPlatform): プラットフォーム
- `post_id` (str): 投稿 ID

**戻り値:**
- `bool`: 成功時 True

---

#### `search_buzz(platform, query, min_engagement)`

バズコンテンツを検索

**パラメータ:**
- `platform` (SNSPlatform): プラットフォーム
- `query` (str): 検索クエリ
- `min_engagement` (int): 最小エンゲージメント数

**戻り値:**
```python
[
  {
    "id": "post_id",
    "text": "post text",
    "username": "author",
    "likes": 1500,
    "retweets": 300,
    ...
  }
]
```

---

#### `get_trending(platform)`

トレンドコンテンツを取得

**パラメータ:**
- `platform` (SNSPlatform): プラットフォーム

**戻り値:**
```python
[
  {
    "id": "post_id",
    "text": "post text",
    "engagement_score": 2400,
    ...
  }
]
```

---

### MetaGraphAPI（Instagram/Facebook/Threads）

#### `create_instagram_post(caption, image_url)`

Instagram に投稿

```python
result = api.config.meta.create_instagram_post(
    caption="Hello Instagram!",
    image_url="https://example.com/image.jpg"
)
print(result["id"])  # 投稿 ID
```

#### `delete_instagram_post(media_id)`

Instagram の投稿を削除

```python
success = api.config.meta.delete_instagram_post("18000000000000001")
```

#### `create_facebook_post(message, picture_url, link_url)`

Facebook に投稿

```python
result = api.config.meta.create_facebook_post(
    message="Check this out!",
    picture_url="https://example.com/pic.jpg",
    link_url="https://example.com"
)
```

---

### XApi（Twitter/X）

#### `create_tweet(text, media_ids, reply_to_tweet_id)`

ツイートを投稿

```python
result = api.config.x.create_tweet(text="Hello Twitter!")
print(result["data"]["id"])  # ツイート ID
```

#### `delete_tweet(tweet_id)`

ツイートを削除

```python
success = api.config.x.delete_tweet("1234567890")
```

#### `search_recent_tweets(query, max_results)`

過去 7 日間のツイートを検索

```python
results = api.config.x.search_recent_tweets(
    query="Python OR #python",
    max_results=50
)
```

#### `search_tweets_by_keyword(keyword, min_likes, min_retweets)`

バズツイートを検索

```python
buzz = api.config.x.search_tweets_by_keyword(
    keyword="AI",
    min_likes=1000,
    min_retweets=500
)
```

---

### PinterestApi

#### `create_pin(board_id, note, image_url, link_url)`

ピンを作成

```python
result = api.config.pinterest.create_pin(
    board_id="123456789",
    note="Beautiful sunset",
    image_url="https://example.com/sunset.jpg",
    link_url="https://example.com"
)
```

#### `delete_pin(pin_id)`

ピンを削除

```python
success = api.config.pinterest.delete_pin("9876543210")
```

#### `get_user_boards()`

ユーザーのボード一覧を取得

```python
boards = api.config.pinterest.get_user_boards()
for board in boards:
    print(f"{board['name']} (ID: {board['id']})")
```

#### `search_pins(query, limit)`

ピンを検索

```python
pins = api.config.pinterest.search_pins("sunset", limit=50)
```

---

## ⚠️ トラブルシューティング

### 「Invalid OAuth access token」エラー

**原因:**
- トークンが有効期限切れ
- トークンが正しく登録されていない

**対処:**
```bash
# トークンを再登録
bash /root/clawd/scripts/setup-sns-api-credentials.sh show

# トークンを更新
bash /root/clawd/scripts/setup-sns-api-credentials.sh register-meta
```

---

### 「Rate limit exceeded」エラー

**原因:**
- API 呼び出し頻度が高すぎる

**対処:**
各 SNS の制限：
- **Instagram**: 最小 2 秒間隔で投稿
- **X**: 300 リクエスト/15 分
- **Pinterest**: 1000 リクエスト/時間（最小 4 秒間隔）

自動リトライロジックが適用されます：
```python
api = SNSUnifiedAPI(
    retry_handler=RetryHandler(
        max_retries=3,
        strategy=RetryStrategy.EXPONENTIAL,
        base_delay=2
    )
)
```

---

### 「(#100) Requires one of these permissions」エラー

**原因:**
- Meta API の権限不足

**対処:**
Meta App Review で権限を再度申請してください（3〜7 日）。

参考: `/root/clawd/docs/sns-api-setup/meta-setup.md`

---

### 投稿が反映されない

**原因:**
- メディアサイズが不適切
- メディアフォーマットが未対応

**対処:**

| プラットフォーム | 推奨サイズ | 形式 |
|---|---|---|
| Instagram | 1080x1350px | JPG, PNG |
| Facebook | 1200x628px | JPG, PNG |
| X | - | JPG, PNG, GIF |
| Pinterest | 1000x1500px | JPG, PNG |

---

### 「403 Forbidden」エラー

**原因:**
- ビジネスアカウントが未接続
- アプリが本番モードでない

**対処:**
```bash
# トークン情報確認
bash /root/clawd/scripts/setup-sns-api-credentials.sh validate

# Clawdbot ログ確認
tail -f /root/clawd/logs/sns-api.log
```

---

## 🔄 自動化例

### 毎日定時に投稿

```python
import schedule
from datetime import datetime

api = SNSUnifiedAPI()

def daily_post():
    api.post(
        platforms=[SNSPlatform.INSTAGRAM, SNSPlatform.X],
        text="Good morning!",
        image_url="https://example.com/morning.jpg"
    )

# 毎日 09:00 に投稿
schedule.every().day.at("09:00").do(daily_post)

# スケジューラー実行
while True:
    schedule.run_pending()
    time.sleep(60)
```

### リトライ付き投稿

```python
api = SNSUnifiedAPI(
    retry_handler=RetryHandler(
        max_retries=5,  # 最大 5 回リトライ
        strategy=RetryStrategy.EXPONENTIAL,
        base_delay=3
    )
)

try:
    results = api.post(
        platforms=[SNSPlatform.X],
        text="Important announcement!"
    )
except Exception as e:
    print(f"Failed after retries: {e}")
```

---

## 📞 サポート

問題が発生した場合：

1. ログを確認
   ```bash
   tail -f /root/clawd/logs/sns-api.log
   ```

2. トークンを検証
   ```bash
   bash /root/clawd/scripts/setup-sns-api-credentials.sh validate
   ```

3. 公式ドキュメント確認
   - Meta: https://developers.facebook.com/docs
   - X: https://developer.twitter.com/en/docs
   - Pinterest: https://developers.pinterest.com/docs

4. コミュニティ質問
   - Meta Community: https://developers.facebook.com/community
   - X Community: https://twittercommunity.com/
   - Pinterest Community: https://community.pinterest.biz/t5/developer-corner

---

## 📄 ライセンス

MIT License

---

**最終更新**: 2026 年 2 月 22 日
**バージョン**: 1.0.0
