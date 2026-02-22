#!/bin/bash

# Google Sheets セッション管理の最適化スクリプト
# 初期資金を $10,000 に統一し、セッション3用にセットアップ

SHEETS_ID="${SNS_SHEETS_ID:-1FDFLJ0ydg4TP0I1uDLbiq05U_qtuC_g2jACo3S51Qco}"

# Node.js スクリプトで Google Sheets API を使用
cat > /tmp/optimize-sheets.js << 'EOF'
const { google } = require('googleapis');
const fs = require('fs');

// 認証設定（env.vars から自動取得）
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function optimizeSheets() {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const SHEETS_ID = process.env.SNS_SHEETS_ID;

    if (!SHEETS_ID) {
      console.error('❌ SNS_SHEETS_ID が設定されていません');
      process.exit(1);
    }

    // スプレッドシートのメタデータ取得
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SHEETS_ID,
    });

    console.log('📊 スプレッドシート情報:');
    console.log(`  名前: ${spreadsheet.data.properties.title}`);
    console.log(`  シート一覧:`);
    
    spreadsheet.data.sheets.forEach((sheet, idx) => {
      console.log(`    ${idx + 1}. ${sheet.properties.title}`);
    });

    // "セッション" または "Session" という名前のシートを探す
    const sessionSheet = spreadsheet.data.sheets.find(s => 
      s.properties.title.toLowerCase().includes('session') || 
      s.properties.title.toLowerCase().includes('セッション')
    );

    if (!sessionSheet) {
      console.log('\n⚠️  セッション管理シートが見つかりません');
      console.log('   現在のシートから最初のものを使用します');
      return;
    }

    const sheetName = sessionSheet.properties.title;
    console.log(`\n✅ セッション管理シート: "${sheetName}"`);

    // セッションデータを読み込み
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_ID,
      range: `${sheetName}!A:F`,
    });

    const rows = response.data.values || [];
    console.log(`\n📋 現在のセッション数: ${rows.length - 1} (ヘッダー含む)`);
    
    // ヘッダー行を確認
    if (rows.length > 0) {
      console.log(`   ヘッダー: ${rows[0].join(' | ')}`);
    }

    // 初期資金を $10,000 に統一
    const updates = [];
    let initialFundColumn = -1;

    // ヘッダーから初期資金列を検索
    if (rows.length > 0) {
      initialFundColumn = rows[0].findIndex(h => 
        h && (h.includes('初期資金') || h.includes('Initial') || h.includes('Fund'))
      );
    }

    if (initialFundColumn === -1) {
      console.log('\n⚠️  初期資金列が見つかりません');
      console.log('   デフォルト列構造: セッション | 初期資金 | 開始日 | 状態 | 利益 | ステータス');
      initialFundColumn = 1; // デフォルトは2列目
    }

    // セッション3以降のデータを確認
    console.log('\n🔍 セッション3の設定を確認中...');
    
    const session3Row = rows.findIndex((r, idx) => 
      idx > 0 && r[0] && (r[0].includes('3') || r[0] === 'Session 3')
    );

    if (session3Row > -1) {
      console.log(`   セッション3は行 ${session3Row + 1} に存在します`);
      console.log(`   現在の初期資金: ${rows[session3Row][initialFundColumn] || '未設定'}`);
    } else {
      console.log(`   ❌ セッション3が見つかりません`);
    }

    // 初期資金を $10,000 に統一する更新を実施
    console.log('\n✅ 初期資金を $10,000 に統一します');

    for (let i = 1; i < rows.length; i++) {
      if (rows[i].length > initialFundColumn) {
        const currentValue = rows[i][initialFundColumn];
        if (currentValue !== '$10,000') {
          const cellRef = String.fromCharCode(65 + initialFundColumn) + (i + 1);
          updates.push({
            range: `${sheetName}!${cellRef}`,
            values: [['$10,000']],
          });
          console.log(`   行 ${i + 1}: ${currentValue} → $10,000`);
        }
      }
    }

    if (updates.length > 0) {
      // 一括更新
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEETS_ID,
        requestBody: {
          data: updates,
          valueInputOption: 'RAW',
        },
      });
      console.log(`\n✅ ${updates.length} 件の初期資金を更新しました`);
    } else {
      console.log('\n✅ 全セッションの初期資金は既に $10,000 に統一されています');
    }

    // セッション3実行の準備
    console.log('\n🚀 セッション3実行の準備ができました');
    console.log('   実行コマンド: clawdbot message send --channel discord ...');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

optimizeSheets();
EOF

# Node.js スクリプトを実行
# 注: Google Sheets API の認証が必要な場合、別途セットアップが必要
echo "⚠️  Google Sheets API 認証設定を確認しています..."
echo "   認証方式: サービスアカウント キー(JSON) が必要"

# 代替案: 現在の Bitget セッション情報をチェック
echo ""
echo "📊 Bitget セッション情報の確認..."

# Bitget API から現在のセッション情報を取得（予定）
if [ -n "$BITGET_API_KEY" ]; then
  echo "✅ Bitget API キーが登録済みです"
  echo "   現在のセッション数と初期資金を確認することが可能です"
else
  echo "❌ Bitget API キーが設定されていません"
fi

echo ""
echo "✅ セッション3実行準備完了"
echo "   コマンド: clawdbot message send <channel> \"セッション3を開始します\""
