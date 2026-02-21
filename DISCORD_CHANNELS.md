# Discord チャンネル ID 一覧

サブエージェント起動時に使用するチャンネルIDの参照リスト

## 主要チャンネル

| チャンネル名 | チャンネルID | 用途 |
|-------------|-------------|------|
| #一般 | `1464650064357232948` | デフォルト通知先 |
| #sns | `1470060780111007950` | SNS関連タスク |
| #bitget-trading | `1471389526592327875` | トレーディング関連 |
| #ai動画処理 | *(要確認)* | 動画処理完了通知 |

## サブエージェント起動テンプレート

```javascript
sessions_spawn({
  task: `<タスク内容>
【必須】完了後message toolで起動元チャンネルに報告（channel=discord, target=channel:<現在のチャンネルID>）`,
  cleanup: "delete",
  label: "task-name"
})
```

### 例: #snsチャンネルから起動

```javascript
sessions_spawn({
  task: `SNS投稿を分析してレポートを作成
【必須】完了後message toolで起動元チャンネルに報告（channel=discord, target=channel:1470060780111007950）`,
  cleanup: "delete",
  label: "sns-analysis"
})
```

### 例: #bitget-tradingチャンネルから起動

```javascript
sessions_spawn({
  task: `トレーディング戦略のバックテストを実行
【必須】完了後message toolで起動元チャンネルに報告（channel=discord, target=channel:1471389526592327875）`,
  cleanup: "delete",
  label: "backtest"
})
```

## 注意事項

- サブエージェントは独立したセッションのため、親セッションの情報は明示的に渡す必要があります
- チャンネルIDは起動時の実際のIDに置き換えてください
- `target=channel:<ID>` の形式で指定します（`#一般` などのチャンネル名ではなくIDを使用）
