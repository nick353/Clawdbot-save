#!/usr/bin/env python3
"""
週次トレーディングレビュー
- 過去7日間のトレード履歴を分析
- パフォーマンス指標を計算
- 改善提案を生成
- Discord通知
"""
import csv
import json
import subprocess
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Tuple

def load_recent_trades(days: int = 7) -> List[Dict]:
    """過去N日間のトレードを読み込み"""
    trades = []
    cutoff_date = datetime.now() - timedelta(days=days)
    
    with open('/root/clawd/data/trade-log.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Win/Loss'] not in ['Win', 'Loss']:
                continue
            
            exit_time = datetime.fromisoformat(row['Exit Time'])
            if exit_time >= cutoff_date:
                trades.append({
                    'symbol': row['Symbol'],
                    'entry_time': datetime.fromisoformat(row['Entry Time']),
                    'exit_time': exit_time,
                    'pnl': float(row['PnL ($)']),
                    'pnl_pct': float(row['PnL (%)']),
                    'win_loss': row['Win/Loss'],
                    'exit_reason': row['Exit Reason'],
                    'hold_time': int(row['Hold Time (min)']),
                    'trailing_used': row['Trailing Stop Used'] == 'Yes'
                })
    
    return trades

def analyze_performance(trades: List[Dict]) -> Dict:
    """パフォーマンス指標を計算"""
    if not trades:
        return {
            'total_trades': 0,
            'win_count': 0,
            'loss_count': 0,
            'win_rate': 0,
            'total_pnl': 0,
            'avg_win': 0,
            'avg_loss': 0,
            'avg_hold_time': 0,
            'best_trade': None,
            'worst_trade': None
        }
    
    wins = [t for t in trades if t['win_loss'] == 'Win']
    losses = [t for t in trades if t['win_loss'] == 'Loss']
    
    return {
        'total_trades': len(trades),
        'win_count': len(wins),
        'loss_count': len(losses),
        'win_rate': (len(wins) / len(trades) * 100) if trades else 0,
        'total_pnl': sum(t['pnl'] for t in trades),
        'avg_win': sum(t['pnl'] for t in wins) / len(wins) if wins else 0,
        'avg_loss': sum(t['pnl'] for t in losses) / len(losses) if losses else 0,
        'avg_hold_time': sum(t['hold_time'] for t in trades) / len(trades),
        'best_trade': max(trades, key=lambda t: t['pnl']),
        'worst_trade': min(trades, key=lambda t: t['pnl'])
    }

def analyze_by_exit_reason(trades: List[Dict]) -> Dict:
    """エグジット理由別の分析"""
    by_reason = defaultdict(lambda: {'count': 0, 'pnl': 0, 'trades': []})
    
    for trade in trades:
        reason = trade['exit_reason']
        by_reason[reason]['count'] += 1
        by_reason[reason]['pnl'] += trade['pnl']
        by_reason[reason]['trades'].append(trade)
    
    return dict(by_reason)

def analyze_by_symbol(trades: List[Dict]) -> Dict:
    """銘柄別の分析"""
    by_symbol = defaultdict(lambda: {'count': 0, 'wins': 0, 'pnl': 0})
    
    for trade in trades:
        symbol = trade['symbol']
        by_symbol[symbol]['count'] += 1
        if trade['win_loss'] == 'Win':
            by_symbol[symbol]['wins'] += 1
        by_symbol[symbol]['pnl'] += trade['pnl']
    
    return dict(by_symbol)

def analyze_by_hold_time(trades: List[Dict]) -> Dict:
    """ホールド時間別の分析"""
    buckets = {
        '0-30分': [],
        '30-60分': [],
        '1-2時間': [],
        '2-4時間': [],
        '4時間以上': []
    }
    
    for trade in trades:
        hold = trade['hold_time']
        if hold < 30:
            buckets['0-30分'].append(trade)
        elif hold < 60:
            buckets['30-60分'].append(trade)
        elif hold < 120:
            buckets['1-2時間'].append(trade)
        elif hold < 240:
            buckets['2-4時間'].append(trade)
        else:
            buckets['4時間以上'].append(trade)
    
    result = {}
    for name, bucket_trades in buckets.items():
        if bucket_trades:
            wins = [t for t in bucket_trades if t['win_loss'] == 'Win']
            result[name] = {
                'count': len(bucket_trades),
                'win_rate': len(wins) / len(bucket_trades) * 100,
                'avg_pnl': sum(t['pnl'] for t in bucket_trades) / len(bucket_trades)
            }
    
    return result

def load_current_config() -> Dict:
    """現在の設定を読み込み"""
    with open('/root/clawd/config/bitget-trading-v3.json', 'r') as f:
        return json.load(f)

def generate_recommendations(
    trades: List[Dict],
    perf: Dict,
    by_exit: Dict,
    by_symbol: Dict,
    by_hold_time: Dict,
    config: Dict
) -> List[Dict]:
    """改善提案を生成"""
    recommendations = []
    
    # 最低トレード数のチェック
    if perf['total_trades'] < 10:
        return [{
            'type': 'insufficient_data',
            'message': f"トレード数が少なすぎます（{perf['total_trades']}回）。最低10回のトレードが必要です。",
            'action': 'none'
        }]
    
    strategy = config.get('strategy', {})
    
    # 1. トレイリングストップ発動タイミングの分析
    trailing_trades = [t for t in trades if t['trailing_used']]
    if trailing_trades:
        avg_trailing_pnl = sum(t['pnl'] for t in trailing_trades) / len(trailing_trades)
        trailing_win_rate = len([t for t in trailing_trades if t['win_loss'] == 'Win']) / len(trailing_trades) * 100
        
        # トレイリングストップが効果的なら維持、そうでなければ調整を提案
        if trailing_win_rate < 60 or avg_trailing_pnl < perf['avg_win'] * 0.8:
            current_activation = strategy.get('trailing_stop_activation_pct', 1.5)
            new_activation = current_activation * 1.2  # 20%増やす
            
            recommendations.append({
                'type': 'trailing_stop_activation',
                'current': f"{current_activation}%",
                'proposed': f"{new_activation:.1f}%",
                'reason': f"トレイリングストップの勝率が低い（{trailing_win_rate:.1f}%）。発動を遅らせて利益を伸ばす。",
                'expected_effect': f"平均利益+${abs(perf['avg_win'] - avg_trailing_pnl):.2f}",
                'confidence': 'medium'
            })
    
    # 2. ストップロスの分析
    stop_loss_trades = [t for t in by_exit.get('Stop Loss', {}).get('trades', [])]
    if stop_loss_trades:
        avg_stop_loss = sum(t['pnl'] for t in stop_loss_trades) / len(stop_loss_trades)
        current_stop_loss = strategy.get('stop_loss_pct', 3.0)
        
        # ストップロスの平均損失が設定値より大きい場合
        expected_loss = -current_stop_loss / 100 * 1000  # 仮の基準
        if abs(avg_stop_loss) > abs(expected_loss) * 1.2:
            new_stop_loss = current_stop_loss * 1.1
            
            recommendations.append({
                'type': 'stop_loss',
                'current': f"-{current_stop_loss}%",
                'proposed': f"-{new_stop_loss:.1f}%",
                'reason': f"ストップロスヒット時の平均損失が大きい（${avg_stop_loss:.2f}）。余裕を持たせる。",
                'expected_effect': f"損失を${abs(avg_stop_loss - expected_loss):.2f}削減",
                'confidence': 'high'
            })
    
    # 3. 最大ホールド時間の分析
    long_hold_trades = by_hold_time.get('4時間以上', {})
    if long_hold_trades and long_hold_trades['count'] > 0:
        if long_hold_trades['win_rate'] < 40 or long_hold_trades['avg_pnl'] < 0:
            current_max_hold = strategy.get('max_hold_time_minutes', 240)
            new_max_hold = int(current_max_hold * 0.8)  # 20%短縮
            
            recommendations.append({
                'type': 'max_hold_time',
                'current': f"{current_max_hold}分",
                'proposed': f"{new_max_hold}分",
                'reason': f"4時間以上のトレードの勝率が低い（{long_hold_trades['win_rate']:.1f}%）。早期撤退を強化。",
                'expected_effect': f"長時間損失を削減",
                'confidence': 'high'
            })
    
    # 4. 勝率が低い銘柄の除外
    poor_symbols = [
        symbol for symbol, data in by_symbol.items()
        if data['count'] >= 3 and (data['wins'] / data['count'] < 0.3 or data['pnl'] < -50)
    ]
    if poor_symbols:
        recommendations.append({
            'type': 'symbol_exclusion',
            'current': f"{len(config['symbols'])}銘柄",
            'proposed': f"{len(config['symbols']) - len(poor_symbols)}銘柄",
            'reason': f"勝率が低い銘柄を除外: {', '.join(poor_symbols)}",
            'expected_effect': f"不採算トレードを削減",
            'confidence': 'medium'
        })
    
    # 5. 全体的なパフォーマンスが良好な場合
    if perf['win_rate'] >= 55 and perf['total_pnl'] > 0:
        recommendations.append({
            'type': 'maintain',
            'message': f"現在の設定が良好に機能しています（勝率{perf['win_rate']:.1f}%、総損益+${perf['total_pnl']:.2f}）。変更は不要です。",
            'action': 'none'
        })
    
    return recommendations

def send_discord_notification(report: str, channel_id: str = "1471389526592327875"):
    """Discord通知を送信"""
    cmd = [
        'clawdbot', 'message', 'send',
        '--channel', 'discord',
        '--target', channel_id,
        '--message', report
    ]
    subprocess.run(cmd, check=True)

def main():
    print("📊 週次トレーディングレビュー開始")
    
    # データ読み込み
    trades = load_recent_trades(days=7)
    print(f"📈 過去7日間のトレード: {len(trades)}件")
    
    if not trades:
        print("⚠️  トレードデータなし")
        return
    
    # 分析
    perf = analyze_performance(trades)
    by_exit = analyze_by_exit_reason(trades)
    by_symbol = analyze_by_symbol(trades)
    by_hold_time = analyze_by_hold_time(trades)
    config = load_current_config()
    
    # 改善提案
    recommendations = generate_recommendations(
        trades, perf, by_exit, by_symbol, by_hold_time, config
    )
    
    # レポート生成
    report = f"""
📊 **週次トレーディングレビュー**
期間: {(datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')} ～ {datetime.now().strftime('%Y-%m-%d')}

**📈 パフォーマンスサマリー**
- トレード数: {perf['total_trades']}回
- 勝率: {perf['win_rate']:.1f}% ({perf['win_count']}勝{perf['loss_count']}敗)
- 総損益: ${perf['total_pnl']:+.2f}
- 平均勝ち: +${perf['avg_win']:.2f}
- 平均負け: ${perf['avg_loss']:.2f}
- 平均ホールド時間: {perf['avg_hold_time']:.0f}分

**🏆 ベストトレード**
{perf['best_trade']['symbol']}: +${perf['best_trade']['pnl']:.2f} ({perf['best_trade']['exit_reason']})

**❌ ワーストトレード**
{perf['worst_trade']['symbol']}: ${perf['worst_trade']['pnl']:.2f} ({perf['worst_trade']['exit_reason']})

**📊 エグジット理由別**
"""
    
    for reason, data in sorted(by_exit.items(), key=lambda x: x[1]['pnl'], reverse=True):
        avg_pnl = data['pnl'] / data['count']
        report += f"- {reason}: {data['count']}回, 平均${avg_pnl:+.2f}\n"
    
    report += "\n**🎯 改善提案**\n"
    
    if not recommendations:
        report += "✅ 現状維持を推奨（データ不足または良好なパフォーマンス）\n"
    else:
        has_actionable = False
        for i, rec in enumerate(recommendations, 1):
            if rec.get('action') == 'none':
                report += f"{i}. {rec['message']}\n"
            else:
                has_actionable = True
                report += f"{i}. **{rec['type']}**\n"
                report += f"   現在: {rec['current']}\n"
                report += f"   提案: {rec['proposed']}\n"
                report += f"   理由: {rec['reason']}\n"
                report += f"   期待効果: {rec['expected_effect']}\n"
                report += f"   信頼度: {rec['confidence']}\n\n"
        
        if not has_actionable:
            report += "\n**✅ 結論: 現状維持を推奨**\n"
        else:
            report += "\n**📝 実装は承認後に行います。**\n"
    
    report += f"\n---\n生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
    
    # レポート保存
    report_path = f"/root/clawd/data/weekly-review-{datetime.now().strftime('%Y%m%d')}.txt"
    with open(report_path, 'w') as f:
        f.write(report)
    print(f"✅ レポート保存: {report_path}")
    
    # Discord通知
    try:
        send_discord_notification(report)
        print("✅ Discord通知送信完了")
    except Exception as e:
        print(f"⚠️  Discord通知失敗: {e}")
    
    print("✅ 週次レビュー完了")

if __name__ == "__main__":
    main()
