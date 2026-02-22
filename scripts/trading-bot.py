#!/usr/bin/env python3
"""
Bitget Trading Bot with Dynamic Stop Loss Strategy
Phase 1: Dynamic Stop Loss Implementation
"""

import json
import csv
import math
from datetime import datetime
from typing import Dict, List, Tuple

class DynamicStopLossBot:
    """Bot with volatility-aware dynamic stop loss"""
    
    def __init__(self, config_path: str):
        """Initialize bot with configuration"""
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        self.base_sl = self.config['stoploss']['base_level']
        self.high_vol_sl = self.config['stoploss']['high_volatility_level']
        self.vol_threshold = self.config['stoploss']['volatility_threshold']
    
    def calculate_volatility(self, prices: List[float]) -> float:
        """Calculate volatility using ATR approximation"""
        if len(prices) < 2:
            return 0.0
        
        # Calculate simple volatility as standard deviation
        mean = sum(prices) / len(prices)
        variance = sum((p - mean) ** 2 for p in prices) / len(prices)
        return math.sqrt(variance) / mean if mean > 0 else 0.0
    
    def calculate_atr(self, high_prices: List[float], low_prices: List[float], 
                      close_prices: List[float], period: int = 14) -> float:
        """Calculate Average True Range"""
        if len(high_prices) < period:
            return 0.0
        
        tr_values = []
        for i in range(len(close_prices)):
            h = high_prices[i] if i < len(high_prices) else close_prices[i]
            l = low_prices[i] if i < len(low_prices) else close_prices[i]
            c_prev = close_prices[i-1] if i > 0 else close_prices[i]
            
            tr = max(
                h - l,
                abs(h - c_prev),
                abs(l - c_prev)
            )
            tr_values.append(tr)
        
        atr = sum(tr_values[-period:]) / period if len(tr_values) >= period else 0.0
        return atr / close_prices[-1] if close_prices[-1] > 0 else 0.0
    
    def calculate_dynamic_stop_loss(self, entry_price: float, 
                                    volatility: float) -> float:
        """
        Calculate dynamic stop loss level based on volatility
        
        Returns: Stop loss percentage (negative value)
        """
        if volatility >= self.vol_threshold:
            # High volatility: use -4.0%
            return self.high_vol_sl
        else:
            # Normal volatility: use -3.0%
            return self.base_sl
    
    def backtest_trade(self, entry_price: float, exit_price: float,
                       volatility: float, original_sl_pct: float) -> Dict:
        """
        Backtest a single trade with dynamic stop loss
        
        Returns: Dict with original and new results
        """
        dynamic_sl = self.calculate_dynamic_stop_loss(entry_price, volatility)
        
        # Calculate stop loss trigger prices
        original_sl_price = entry_price * (1 + original_sl_pct)
        dynamic_sl_price = entry_price * (1 + dynamic_sl)
        
        # Check if trade would hit stop loss
        original_hit_sl = exit_price <= original_sl_price
        dynamic_hit_sl = exit_price <= dynamic_sl_price
        
        # Calculate PnL
        original_pnl_pct = original_sl_pct if original_hit_sl else (exit_price / entry_price - 1)
        dynamic_pnl_pct = dynamic_sl if dynamic_hit_sl else (exit_price / entry_price - 1)
        
        # Estimate quantity for $100 position
        qty_estimate = 100 / entry_price
        original_pnl = qty_estimate * entry_price * original_pnl_pct
        dynamic_pnl = qty_estimate * entry_price * dynamic_pnl_pct
        
        return {
            'entry_price': entry_price,
            'exit_price': exit_price,
            'volatility': volatility,
            'dynamic_sl_level': dynamic_sl,
            'original_sl_level': original_sl_pct,
            'original_hit_sl': original_hit_sl,
            'dynamic_hit_sl': dynamic_hit_sl,
            'original_pnl': original_pnl,
            'dynamic_pnl': dynamic_pnl,
            'improvement': dynamic_pnl - original_pnl
        }
    
    def backtest_from_log(self, log_path: str) -> Dict:
        """Backtest dynamic stop loss against historical trades"""
        with open(log_path, 'r') as f:
            reader = csv.DictReader(f)
            trades = list(reader)
        
        # Filter only closed trades with Stop Loss
        sl_trades = [t for t in trades if t['Exit Reason'] == 'Stop Loss' and t['Exit Time']]
        
        total_results = {
            'original_pnl': 0.0,
            'dynamic_pnl': 0.0,
            'total_trades': len(sl_trades),
            'would_still_sl': 0,
            'prevented_sl': 0,
            'trades': []
        }
        
        # Simulate each stop loss trade
        for trade in sl_trades:
            try:
                entry_price = float(trade['Entry Price'])
                exit_price = float(trade['Exit Price'])
                pnl_dollars = float(trade['PnL ($)'])
                
                # Estimate volatility from price movement
                price_change = abs(exit_price - entry_price) / entry_price
                volatility = price_change / 0.05  # Normalize
                
                result = self.backtest_trade(
                    entry_price=entry_price,
                    exit_price=exit_price,
                    volatility=volatility,
                    original_sl_pct=-0.05
                )
                
                total_results['trades'].append({
                    'symbol': trade['Symbol'],
                    'entry_price': entry_price,
                    'exit_price': exit_price,
                    'original_pnl': pnl_dollars,
                    'result': result
                })
                
                total_results['original_pnl'] += pnl_dollars
                total_results['dynamic_pnl'] += result['dynamic_pnl']
                
                if result['dynamic_hit_sl']:
                    total_results['would_still_sl'] += 1
                else:
                    total_results['prevented_sl'] += 1
                    
            except (ValueError, KeyError):
                continue
        
        return total_results


def run_backtest():
    """Run comprehensive backtest analysis"""
    print("=" * 60)
    print("PHASE 1: Dynamic Stop Loss Implementation")
    print("=" * 60)
    
    bot = DynamicStopLossBot('/root/clawd/data/trading-config.json')
    results = bot.backtest_from_log('/root/clawd/data/trade-log.csv')
    
    # Save results
    output_file = '/root/clawd/data/backtest-dynamic-sl-phase1.json'
    with open(output_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'phase': 'Phase 1: Dynamic Stop Loss Implementation',
            'summary': {
                'total_stop_loss_trades': results['total_trades'],
                'original_total_pnl': results['original_pnl'],
                'dynamic_total_pnl': results['dynamic_pnl'],
                'total_improvement': results['dynamic_pnl'] - results['original_pnl'],
                'improvement_percentage': ((results['dynamic_pnl'] - results['original_pnl']) / abs(results['original_pnl']) * 100) if results['original_pnl'] != 0 else 0,
                'trades_prevented_from_sl': results['prevented_sl'],
                'trades_would_still_hit_sl': results['would_still_sl'],
                'base_sl_level': -0.03,
                'high_vol_sl_level': -0.04,
                'volatility_threshold': 0.02
            },
            'detailed_trades': [
                {
                    'symbol': t['symbol'],
                    'entry_price': t['entry_price'],
                    'exit_price': t['exit_price'],
                    'original_pnl': round(t['original_pnl'], 2),
                    'dynamic_pnl': round(t['result']['dynamic_pnl'], 2),
                    'improvement': round(t['result']['improvement'], 2),
                    'volatility': round(t['result']['volatility'], 4),
                    'dynamic_sl_level': round(t['result']['dynamic_sl_level'], 2),
                    'would_prevent_sl': not t['result']['dynamic_hit_sl']
                }
                for t in results['trades']
            ]
        }, f, indent=2)
    
    # Print summary
    print(f"\nBacktest Results:")
    print(f"  Total Stop Loss trades analyzed: {results['total_trades']}")
    print(f"  Original PnL from SL trades: ${results['original_pnl']:.2f}")
    print(f"  Dynamic SL PnL: ${results['dynamic_pnl']:.2f}")
    print(f"  Total Improvement: ${results['dynamic_pnl'] - results['original_pnl']:.2f}")
    if results['original_pnl'] != 0:
        improvement_pct = (results['dynamic_pnl'] - results['original_pnl']) / abs(results['original_pnl']) * 100
        print(f"  Improvement %: {improvement_pct:.1f}%")
    print(f"  Trades prevented from SL: {results['prevented_sl']}")
    print(f"  Trades would still hit SL: {results['would_still_sl']}")
    print(f"\nResults saved to: {output_file}")
    
    return results


if __name__ == '__main__':
    run_backtest()
