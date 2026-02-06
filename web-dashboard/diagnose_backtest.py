import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime
from strategy_v2 import calc_indicators, analyze_breakout, is_ny_session

def diagnose():
    if not mt5.initialize():
        print("MT5 Init Failed")
        return

    symbol = "XAUUSD"
    start_dt = datetime(2025, 1, 1)
    end_dt = datetime(2026, 1, 1)
    
    print(f"Diagnostics: Fetching {symbol} M15 from {start_dt} to {end_dt}")
    rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_M15, start_dt, end_dt)
    
    if rates is None or len(rates) == 0:
        print("No data found!")
        mt5.shutdown()
        return

    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    df.set_index('time', inplace=True)
    
    print(f"Total Rows Fetched: {len(df)}")
    print(f"Date Range in Data: {df.index.min()} to {df.index.max()}")
    
    df = calc_indicators(df)
    
    # Test multiple volume thresholds
    thresholds = [1.2, 1.3, 1.5, 1.8, 2.0]
    for t in thresholds:
        count = 0
        for i in range(1, len(df)):
            if not is_ny_session(df.index[i]): continue
            if (df['close'].iloc[i] > df['h4_high'].iloc[i-1] or df['close'].iloc[i] < df['h4_low'].iloc[i-1]) and df['volume_ratio'].iloc[i] > t:
                count += 1
        print(f"Signals with Volume Ratio > {t}: {count}")

    mt5.shutdown()

if __name__ == "__main__":
    diagnose()
