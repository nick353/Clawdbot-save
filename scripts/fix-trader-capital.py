#!/usr/bin/env python3
"""
トレーダーの資金管理バグ修正パッチ
"""

def create_fix_patch():
    """修正パッチ生成"""
    
    fixes = """
=== 修正内容 ===

1. エントリー前のチェック追加:
   - 最大ポジション数チェック（max_positions = 3）
   - 利用可能資金チェック（capital >= position_size）

2. エントリー時の資金減算:
   - self.capital -= position_size

3. ポジションサイズ計算の修正:
   - initial_capital → capital（現在の利用可能資金から計算）

=== 修正コード（562行目付近） ===

```python
# ポジションなし → エントリー判定
else:
    # 【追加】最大ポジション数チェック
    max_positions = self.config.get('max_positions', 3)
    if len(self.positions) >= max_positions:
        continue  # 次の銘柄へ
    
    can_enter, reason = self.check_entry_signal(df)
    
    if can_enter:
        # エントリー
        price = df.iloc[-1]['close']
        
        # 【修正】現在の資金から計算
        position_size = self.capital * (self.position_size_pct / 100.0)
        
        # 【追加】資金チェック
        if self.capital < position_size:
            print(f"  ⚠️  {symbol}: 資金不足（必要: ${position_size:.2f}, 利用可能: ${self.capital:.2f}）", flush=True)
            continue
        
        quantity = position_size / price
        
        # 【追加】資金減算
        self.capital -= position_size
        
        self.positions[symbol] = {
            'entry_time': datetime.now().isoformat(),
            'entry_price': price,
            'quantity': quantity,
            'position_size': position_size,
            'stop_loss': price * (1 - self.stop_loss_pct / 100.0),
            'take_profit': price * (1 + self.take_profit_pct / 100.0),
            'trailing_stop': None,
            'trailing_stop_used': False,
            'highest_price': price,
            'entry_reason': reason
        }
        
        print(f"  🟢 {symbol}: エントリー @ ${price:.6f} ({reason})", flush=True)
        print(f"     💰 資金減算: ${position_size:.2f} → 残高: ${self.capital:.2f}", flush=True)
        
        # （以下同じ）
```

=== エグジット時の修正（328行目付近） ===

```python
# 既存のコード:
self.capital += pnl

# 【修正】元本も戻す:
self.capital += position['position_size'] + pnl
```

=== 現在の状態を修正する方法 ===

現在5ポジション保有中で資金計算が狂っています。
オプション：

A) 全ポジションを強制クローズして初期化
B) 資金を手動で再計算（初期資金 - 投資額）

推奨: オプションA（クリーンスタート）
"""
    
    return fixes

if __name__ == "__main__":
    print(create_fix_patch())
    
    print("\n" + "="*80)
    print("🔧 修正を適用しますか？")
    print("="*80)
    print("\n1. トレーダー停止")
    print("2. コード修正適用")
    print("3. 全ポジションクローズ（クリーンスタート）")
    print("4. トレーダー再起動")
    print("\n実行する場合は別途指示をお願いしますっぴ！")
