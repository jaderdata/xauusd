import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import json
import sys
from datetime import datetime, timedelta
from strategy_v2 import calc_indicators, analyze_breakout

def run_backtest(symbol, start_date_str, end_date_str, timeframe_str="M15"):
    if not mt5.initialize():
        return {"error": "MT5 Init Failed"}

    # Timeframes mapping
    tf_map = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "H1": mt5.TIMEFRAME_H1
    }
    mt5_tf = tf_map.get(timeframe_str, mt5.TIMEFRAME_M15)

    # Convert dates
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date_str, "%Y-%m-%d") + timedelta(days=1)


    rates = mt5.copy_rates_range(symbol, mt5_tf, start_dt, end_dt)
    
    if rates is None or len(rates) == 0:
        mt5.shutdown()
        return {"error": "No data found for period"}

    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    df.set_index('time', inplace=True)

    # Run Strategy
    df = calc_indicators(df)
    df = analyze_breakout(df)

    # Simulate Trades
    trades = []
    equity = 10000.0
    balance = 10000.0
    total_profit = 0
    wins = 0
    losses = 0
    
    active_trade = None
    
    for i in range(len(df)):
        current_price = df['close'].iloc[i]
        current_time = df.index[i]
        signal = df['signal'].iloc[i]
        
        # 1. Check for Exit if trade active
        if active_trade:
            entry_price = active_trade['entry_price']
            tp = active_trade['tp']
            sl = active_trade['sl']
            
            # --- BREAK-EVEN LOGIC ---
            if not active_trade.get('be_triggered', False):
                # 1:1 Level reached? (Distance between entry and original SL)
                dist_to_sl = abs(entry_price - active_trade['original_sl'])
                if active_trade['type'] == 'BUY' and current_price >= (entry_price + dist_to_sl):
                    active_trade['be_triggered'] = True
                    active_trade['sl'] = entry_price
                elif active_trade['type'] == 'SELL' and current_price <= (entry_price - dist_to_sl):
                    active_trade['be_triggered'] = True
                    active_trade['sl'] = entry_price

            # Refresh SL from active_trade (might have been updated by BE)
            sl = active_trade['sl']

            # SL hit (or Break-Even)
            if (active_trade['type'] == 'BUY' and current_price <= sl) or \
               (active_trade['type'] == 'SELL' and current_price >= sl):
                
                profit = 0 if active_trade.get('be_triggered', False) else -100
                balance += profit
                active_trade['exit_price'] = sl
                active_trade['exit_time'] = current_time.strftime("%Y-%m-%d %H:%M")
                active_trade['profit'] = profit
                trades.append(active_trade)
                active_trade = None
                if profit < 0: losses += 1
            
            # TP hit
            elif (active_trade['type'] == 'BUY' and current_price >= tp) or \
                 (active_trade['type'] == 'SELL' and current_price <= tp):
                profit = 300 # 3R
                balance += profit
                active_trade['exit_price'] = tp
                active_trade['exit_time'] = current_time.strftime("%Y-%m-%d %H:%M")
                active_trade['profit'] = profit
                trades.append(active_trade)
                active_trade = None
                wins += 1
                
        # 2. Check for Entry if no trade active
        if not active_trade and signal != 0:
            atr = df['ATR_14'].iloc[i] if 'ATR_14' in df.columns else 2.0 # Fallback
            if signal == 1: # LONG
                sl = current_price - (atr * 2)
                tp = current_price + (atr * 6) # 3:1 Reward (3R)
                active_trade = {
                    "type": "BUY",
                    "entry_price": current_price,
                    "entry_time": current_time.strftime("%Y-%m-%d %H:%M"),
                    "sl": sl,
                    "original_sl": sl,
                    "tp": tp,
                    "motive": "Institutional Bullish Breakout (H4 High + Volume)",
                    "be_triggered": False
                }
            elif signal == -1: # SHORT
                sl = current_price + (atr * 2)
                tp = current_price - (atr * 6) # 3:1 Reward (3R)
                active_trade = {
                    "type": "SELL",
                    "entry_price": current_price,
                    "entry_time": current_time.strftime("%Y-%m-%d %H:%M"),
                    "sl": sl,
                    "original_sl": sl,
                    "tp": tp,
                    "motive": "Institutional Bearish Breakout (H4 Low + Volume)",
                    "be_triggered": False
                }

    mt5.shutdown()

    # Post-process trades for grouping
    daily_stats = {}
    for t in trades:
        day = t['entry_time'].split(' ')[0]
        if day not in daily_stats:
            daily_stats[day] = {"trades": 0, "wins": 0, "losses": 0, "profit": 0}
        
        daily_stats[day]["trades"] += 1
        if t['profit'] > 0:
            daily_stats[day]["wins"] += 1
        else:
            daily_stats[day]["losses"] += 1
        daily_stats[day]["profit"] += t['profit']

    results = {
        "summary": {
            "total_trades": len(trades),
            "wins": wins,
            "losses": losses,
            "win_rate": (wins / len(trades) * 100) if len(trades) > 0 else 0,
            "final_balance": balance,
            "profit": balance - 10000.0,
            "daily_breakdown": daily_stats
        },
        "trades": trades # Return ALL trades
    }
    
    return results

if __name__ == "__main__":
    # CLI usage
    if len(sys.argv) >= 3:
        sym = sys.argv[1]
        start = sys.argv[2]
        end = sys.argv[3]
        res = run_backtest(sym, start, end)
        print(json.dumps(res, indent=2))
