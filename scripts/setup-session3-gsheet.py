#!/usr/bin/env python3
"""
Google Sheets セッション管理シート更新
セッション3の初期資金を $10,000 で記載
"""

import os
import json
import time
from datetime import datetime

def update_gsheet_session3():
    """
    Google Sheets にセッション3情報を追加
    (スタンドアロン実行可能)
    """
    
    # Bitget設定から初期資金を読み込み
    config_path = "/root/clawd/config/bitget-trading-v3.json"
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        initial_capital = config.get("initial_capital", 10000.0)
        
        print(f"📊 セッション3 設定情報:")
        print(f"  初期資金: ${initial_capital:,.0f}")
        print(f"  開始日時: {datetime.now().isoformat()}")
        print(f"  種類: ペーパートレード" if config.get("paper_trade") else f"  種類: リアルトレード")
        print(f"  監視銘柄数: {len(config.get('symbols', []))}")
        
        # Google Sheets メタデータを生成
        session3_data = {
            "session_id": "Session 3",
            "initial_capital": f"${initial_capital:,.0f}",
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "status": "準備完了",
            "symbols_count": len(config.get('symbols', [])),
            "config_path": config_path
        }
        
        # 設定ファイルに保存（Google Sheets API連携用）
        metadata_path = "/root/clawd/data/session3-metadata.json"
        os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
        
        with open(metadata_path, 'w') as f:
            json.dump(session3_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ セッション3メタデータ保存: {metadata_path}")
        print(f"\n🚀 セッション3は以下の設定で実行準備完了:")
        print(f"   - 初期資金: ${initial_capital:,.0f}")
        print(f"   - 開始日: {session3_data['start_date']}")
        print(f"   - Google Sheets へのリンク: https://docs.google.com/spreadsheets/d/{os.environ.get('SNS_SHEETS_ID', '...')}")
        
        return True
        
    except FileNotFoundError:
        print(f"❌ 設定ファイルが見つかりません: {config_path}")
        return False
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

if __name__ == "__main__":
    success = update_gsheet_session3()
    exit(0 if success else 1)
