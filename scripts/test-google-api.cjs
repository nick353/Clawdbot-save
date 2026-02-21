// 簡易テスト: googleapis パッケージが使えるか確認

try {
  const { google } = require('googleapis');
  console.log('✅ googleapis パッケージが正常に読み込まれました');
  console.log('利用可能な API:', Object.keys(google).slice(0, 10).join(', '), '...');
} catch (err) {
  console.error('❌ エラー:', err.message);
  process.exit(1);
}
