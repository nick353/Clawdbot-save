import fs from 'fs';
import { google } from 'googleapis';
import readline from 'readline';

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets'
];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    console.log('✅ 既存のトークンを使用');
    return oAuth2Client;
  }

  // Get new token
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n📌 以下のURLにアクセスして認証してください:');
  console.log(authUrl);
  console.log('\n認証後に表示されるコードを入力してください:');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('コード: ', async (code) => {
      rl.close();
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('✅ トークンを保存しました');
        resolve(oAuth2Client);
      } catch (err) {
        reject(err);
      }
    });
  });
}

authorize()
  .then(() => console.log('✅ 認証完了！'))
  .catch(console.error);
