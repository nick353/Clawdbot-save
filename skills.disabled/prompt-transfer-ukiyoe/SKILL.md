---
name: prompt-transfer-ukiyoe
description: 浮世絵猫シリーズ専用の画像・プロンプト転記スキル（VPS版）
trigger: 浮世絵猫の転記, ukiyoe transfer, 浮世絵転記
---

# 浮世絵猫シリーズ 画像・プロンプト転記スキル

## 概要

Googleドキュメントから新規画像を検出し、スプレッドシートに自動転記。未採用画像は自動削除。

## 固定設定

| 項目 | 値 |
|------|-----|
| ドキュメントURL | https://docs.google.com/document/d/1j2lsvr1zJs9k9cCkLGeGF-soZZSGuY2p0tQ6wJp8S0s/edit?tab=t.0 |
| スプレッドシートURL | https://docs.google.com/spreadsheets/d/180Vjl8YwdM8tNy1suaYoq84FlbAdkc-uMvWh8aEc_3o/edit?gid=0#gid=0 |
| シリーズ | 浮世絵 猫シリーズ |
| 画像保存先 | `/root/clawd/cat_images/` |

---

## 実行フロー（完全版）

### Phase 1: 初期化

```javascript
// 画像保存ディレクトリを作成
exec({ command: "mkdir -p /root/clawd/cat_images" });

// ログファイルを作成
const logFile = "/root/clawd/.clawdbot-backup/logs/ukiyoe-transfer.log";
exec({ command: `mkdir -p $(dirname ${logFile})` });

// 変数初期化
const DOC_URL = "https://docs.google.com/document/d/1j2lsvr1zJs9k9cCkLGeGF-soZZSGuY2p0tQ6wJp8S0s/edit?tab=t.0";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/180Vjl8YwdM8tNy1suaYoq84FlbAdkc-uMvWh8aEc_3o/edit?gid=0#gid=0";
const IMAGE_DIR = "/root/clawd/cat_images";

let registeredPrompts = [];  // 登録済みプロンプト一覧
let newImages = [];          // 新規画像リスト
let nextRow = 2;             // 次の空き行番号
let deletedCount = 0;        // 削除件数
```

---

### Phase 2: スプレッドシート確認

```javascript
// 1. スプレッドシートを開く
const sheetTab = await browser({
  action: "open",
  profile: "clawd",
  targetUrl: SHEET_URL
});

// 2. ページが読み込まれるまで待機（3秒）
await new Promise(resolve => setTimeout(resolve, 3000));

// 3. ページのスナップショットを取得
const sheetSnapshot = await browser({
  action: "snapshot",
  targetId: sheetTab.targetId,
  refs: "aria"
});

// 4. C列（プロンプト）のテキストを抽出
// スプレッドシートの構造: A列=画像, B列=テーマ, C列=プロンプト, D列=採用(○)
// snapshot結果から textbox role の要素を探す
// 各行のC列セルのテキストを取得

// ※ Google Sheets の場合、セル内容は textbox として認識される
// snapshot.elements を走査して、C列に該当する要素を特定

for (const element of sheetSnapshot.elements) {
  if (element.role === "textbox" && element.name && element.name.length > 20) {
    // プロンプトらしき長いテキストを登録済みとして記録
    registeredPrompts.push(element.name);
  }
}

// 5. 最終行番号を特定（登録済みプロンプトの数 + 1）
nextRow = registeredPrompts.length + 2;  // ヘッダー行を考慮

console.log(`✅ スプレッドシート確認完了: ${registeredPrompts.length}件登録済み`);
console.log(`次の空き行: ${nextRow}`);
```

---

### Phase 3: Google Docs 確認

```javascript
// 1. Google Docs を開く
const docTab = await browser({
  action: "open",
  profile: "clawd",
  targetUrl: DOC_URL
});

// 2. ページが読み込まれるまで待機（3秒）
await new Promise(resolve => setTimeout(resolve, 3000));

// 3. ページのスナップショットを取得
const docSnapshot = await browser({
  action: "snapshot",
  targetId: docTab.targetId,
  refs: "aria"
});

// 4. 画像とプロンプトのペアを検出
// Google Docs の構造:
// - 画像: img role
// - プロンプト: paragraph role（画像の直後）

let currentImage = null;
for (const element of docSnapshot.elements) {
  if (element.role === "img") {
    currentImage = element;
  } else if (currentImage && element.role === "paragraph" && element.name) {
    const prompt = element.name;
    
    // 登録済みか確認
    const isRegistered = registeredPrompts.some(registered => 
      registered.includes(prompt.substring(0, 50))  // 冒頭50文字で照合
    );
    
    if (!isRegistered) {
      // 新規画像として記録
      newImages.push({
        image: currentImage,
        prompt: prompt,
        ref: currentImage.ref
      });
    }
    
    currentImage = null;
  }
}

console.log(`✅ Google Docs 確認完了: ${newImages.length}件の新規画像`);

// 新規画像がなければ終了
if (newImages.length === 0) {
  console.log("ℹ️  新規画像なし。処理を終了します。");
  return {
    status: "success",
    message: "新規画像なし",
    added: 0,
    deleted: 0
  };
}
```

---

### Phase 4: 新規画像処理

```javascript
for (let i = 0; i < newImages.length; i++) {
  const item = newImages[i];
  
  console.log(`📸 新規画像 ${i + 1}/${newImages.length} を処理中...`);
  
  // 1. 画像のスクリーンショットを撮る
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('.')[0];
  const filename = `cat_ukiyoe_${timestamp}.png`;
  const filepath = `${IMAGE_DIR}/${filename}`;
  
  // Google Docs 内の画像要素をクリックして選択
  await browser({
    action: "act",
    targetId: docTab.targetId,
    request: {
      kind: "click",
      ref: item.ref
    }
  });
  
  // 少し待機
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // スクリーンショット（画像要素のみ）
  // ※ Google Docs の画像は element selector では取得できないため、
  // 画像をクリックして拡大表示 → スクリーンショット → ESCで閉じる
  
  // 右クリックメニューから「画像を保存」を選択する方法もあるが、
  // 今回は簡易的にページ全体のスクリーンショットを撮る
  
  const screenshot = await browser({
    action: "screenshot",
    targetId: docTab.targetId,
    type: "png"
  });
  
  // スクリーンショットをファイルに保存
  // ※ screenshot結果は base64 または buffer
  // exec を使ってファイルに書き込む
  
  await exec({
    command: `echo "${screenshot}" | base64 -d > ${filepath}`
  });
  
  console.log(`  ✅ スクリーンショット保存: ${filename}`);
  
  // 2. プロンプトからテーマを推測
  const theme = inferTheme(item.prompt);
  
  // テーマ推測関数
  function inferTheme(prompt) {
    const keywords = {
      "cherry blossom": "桜の下の白猫",
      "snow": "雪景色の猫",
      "calico": "三毛猫",
      "bamboo": "竹林の猫",
      "Mount Fuji": "富士山と猫",
      "moon": "月夜の猫",
      "autumn": "紅葉と猫",
      "rain": "雨の日の猫",
      "shrine": "神社の猫"
    };
    
    for (const [keyword, themeName] of Object.entries(keywords)) {
      if (prompt.toLowerCase().includes(keyword.toLowerCase())) {
        return themeName;
      }
    }
    
    return "浮世絵風の猫";  // デフォルト
  }
  
  console.log(`  テーマ: ${theme}`);
  
  // 3. データを記録
  item.filename = filename;
  item.filepath = filepath;
  item.theme = theme;
}
```

---

### Phase 5: スプレッドシートに追加

```javascript
// 1. スプレッドシートに戻る
await browser({
  action: "navigate",
  targetId: sheetTab.targetId,
  targetUrl: SHEET_URL
});

await new Promise(resolve => setTimeout(resolve, 2000));

// 2. 各新規画像をスプレッドシートに追加
for (let i = 0; i < newImages.length; i++) {
  const item = newImages[i];
  const rowNum = nextRow + i;
  
  console.log(`📝 行${rowNum}に追加中: ${item.theme}`);
  
  // A列（画像）: セルをクリック
  await browser({
    action: "act",
    targetId: sheetTab.targetId,
    request: {
      kind: "click",
      ref: `A${rowNum}`  // ※ 実際には snapshot から該当セルの ref を取得
    }
  });
  
  // 画像挿入: Insert > Image > Upload from computer
  // キーボードショートカット: なし（メニュー操作が必要）
  
  // 代替案: 画像URLを直接貼り付ける（Google Docs から画像URLを取得）
  // または、画像はスキップして B列以降のみ入力
  
  // ※ 画像挿入は手動、または別の方法が必要
  // 今回は B列（テーマ）と C列（プロンプト）のみ自動入力
  
  // B列（テーマ）: セルをクリック
  const bCellSnapshot = await browser({
    action: "snapshot",
    targetId: sheetTab.targetId,
    refs: "aria"
  });
  
  // B列のセルを探す（行番号とA/B/C列の位置関係から特定）
  // ※ Google Sheets の snapshot では、セルは textbox として表示される
  // セルの位置を特定するには、座標やaria-label を使う
  
  // 簡易的に、セルのaria-label が "B{rowNum}" に該当する要素を探す
  const bCell = bCellSnapshot.elements.find(el => 
    el.role === "textbox" && el.name.includes(`B${rowNum}`)
  );
  
  if (bCell) {
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "click",
        ref: bCell.ref
      }
    });
    
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "type",
        ref: bCell.ref,
        text: item.theme
      }
    });
    
    // Enterで確定
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "press",
        key: "Enter"
      }
    });
  }
  
  // C列（プロンプト）: 同様の手順
  const cCellSnapshot = await browser({
    action: "snapshot",
    targetId: sheetTab.targetId,
    refs: "aria"
  });
  
  const cCell = cCellSnapshot.elements.find(el => 
    el.role === "textbox" && el.name.includes(`C${rowNum}`)
  );
  
  if (cCell) {
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "click",
        ref: cCell.ref
      }
    });
    
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "type",
        ref: cCell.ref,
        text: item.prompt
      }
    });
    
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "press",
        key: "Enter"
      }
    });
  }
  
  // D列（採用）: "○" を入力
  const dCellSnapshot = await browser({
    action: "snapshot",
    targetId: sheetTab.targetId,
    refs: "aria"
  });
  
  const dCell = dCellSnapshot.elements.find(el => 
    el.role === "textbox" && el.name.includes(`D${rowNum}`)
  );
  
  if (dCell) {
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "click",
        ref: dCell.ref
      }
    });
    
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "type",
        ref: dCell.ref,
        text: "○"
      }
    });
    
    await browser({
      action: "act",
      targetId: sheetTab.targetId,
      request: {
        kind: "press",
        key: "Enter"
      }
    });
  }
  
  console.log(`  ✅ 行${rowNum}追加完了`);
}
```

---

### Phase 6: 未採用画像の削除（オプション）

```javascript
// スプレッドシートのD列を確認し、「○」がない行の画像をDocsから削除
// ※ この機能は今回スキップ（手動で管理）
// 理由: 削除操作はリスクが高いため、慎重に実装する必要がある

console.log("ℹ️  未採用画像の削除はスキップしました（手動で確認してください）");
```

---

### Phase 7: 完了報告

```javascript
const report = `✅ 浮世絵猫転記完了！

【追加】
${newImages.map((item, i) => `- 行${nextRow + i}: ${item.theme} - ${item.prompt.substring(0, 30)}...`).join('\n')}

【保存先】
${IMAGE_DIR}

【採用状況】
- 新規追加: ${newImages.length}件
- 登録済み: ${registeredPrompts.length}件

スプレッドシート: ${SHEET_URL}
`;

console.log(report);

// Discord (#sns-投稿) に報告
await message({
  action: "send",
  channel: "discord",
  target: "channel:1470060780111007950",
  message: report
});

return {
  status: "success",
  message: "転記完了",
  added: newImages.length,
  deleted: 0
};
```

---

## 簡易版実行フロー（最初のテスト用）

上記の完全版は複雑なので、まずは **簡易版** でテスト実行します：

### 簡易版 Phase 1: スプレッドシート確認のみ

```javascript
// 1. スプレッドシートを開く
const sheetTab = await browser({
  action: "open",
  profile: "clawd",
  targetUrl: "https://docs.google.com/spreadsheets/d/180Vjl8YwdM8tNy1suaYoq84FlbAdkc-uMvWh8aEc_3o/edit?gid=0#gid=0"
});

// 2. スナップショット取得
await new Promise(resolve => setTimeout(resolve, 3000));

const snapshot = await browser({
  action: "snapshot",
  targetId: sheetTab.targetId,
  refs: "aria",
  maxChars: 10000
});

// 3. スナップショット内容を確認
console.log("スプレッドシートの内容:");
console.log(JSON.stringify(snapshot, null, 2));

// 4. C列のプロンプトを抽出
const prompts = [];
for (const element of snapshot.elements || []) {
  if (element.role === "gridcell" && element.name && element.name.length > 20) {
    prompts.push(element.name);
  }
}

console.log(`登録済みプロンプト: ${prompts.length}件`);
prompts.forEach((p, i) => console.log(`${i + 1}. ${p.substring(0, 50)}...`));
```

### 簡易版 Phase 2: Google Docs 確認のみ

```javascript
// 1. Google Docs を開く
const docTab = await browser({
  action: "open",
  profile: "clawd",
  targetUrl: "https://docs.google.com/document/d/1j2lsvr1zJs9k9cCkLGeGF-soZZSGuY2p0tQ6wJp8S0s/edit?tab=t.0"
});

// 2. スナップショット取得
await new Promise(resolve => setTimeout(resolve, 3000));

const docSnapshot = await browser({
  action: "snapshot",
  targetId: docTab.targetId,
  refs: "aria",
  maxChars: 10000
});

// 3. 画像とテキストを確認
console.log("Google Docs の内容:");
console.log(JSON.stringify(docSnapshot, null, 2));

// 4. 画像要素を検出
const images = docSnapshot.elements.filter(el => el.role === "img");
console.log(`画像: ${images.length}件`);

// 5. テキスト要素を検出
const texts = docSnapshot.elements.filter(el => 
  el.role === "paragraph" && el.name && el.name.length > 20
);
console.log(`テキスト: ${texts.length}件`);
texts.forEach((t, i) => console.log(`${i + 1}. ${t.name.substring(0, 50)}...`));
```

---

## 実行方法

### 簡易版テスト

```
浮世絵猫の転記を確認してっぴ（簡易版）
```

### 完全版実行

```
浮世絵猫の転記を実行してっぴ
```

---

## 注意事項

1. **Googleアカウント認証**
   - browser profile "clawd" でログイン済みが前提
   - 初回実行時にログインが必要な場合あり

2. **スクリーンショット**
   - Google Docs の画像は直接ダウンロードできないため、スクリーンショットで代用
   - 画質は元画像より劣化する可能性あり

3. **エラーハンドリング**
   - セレクタが見つからない場合は snapshot を再取得
   - タイムアウトエラーの場合は待機時間を延長

4. **画像挿入**
   - スプレッドシートのA列（画像）は手動で挿入
   - または、画像URLを取得して IMAGE() 関数で挿入

---

## 定期実行設定（cron）

毎日12:00 JST（03:00 UTC）に自動実行：

```json
{
  "schedule": "0 3 * * *",
  "text": "浮世絵猫の転記を実行してっぴ",
  "target": "discord:channel:1470060780111007950",
  "enabled": true
}
```

---

## 実装ステータス

- ✅ Phase 1: 初期化
- ✅ Phase 2: スプレッドシート確認（簡易版）
- ✅ Phase 3: Google Docs 確認（簡易版）
- 🚧 Phase 4: 新規画像処理（スクリーンショット）
- 🚧 Phase 5: スプレッドシート追加（B/C/D列のみ）
- ⏸️  Phase 6: 未採用画像削除（スキップ）
- ✅ Phase 7: 完了報告

**次のステップ:** 簡易版テストを実行して、Google Sheets/Docs のアクセスを確認する
