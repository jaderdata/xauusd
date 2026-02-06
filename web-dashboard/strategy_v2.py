import pandas as pd
import numpy as np
import pytz
from datetime import datetime, time as dtime

def calc_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def calc_atr(df, period=14):
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    return true_range.rolling(window=period).mean()

def calc_indicators(df):
    """Calculates indicators needed for Institutional Breakout"""
    # Volume Average (20 periods)
    df['vol_avg_20'] = df['tick_volume'].rolling(window=20).mean()
    df['volume_ratio'] = df['tick_volume'] / df['vol_avg_20']
    
    # ATR
    df['ATR_14'] = calc_atr(df, 14)
    
    # 4-hour High/Low range
    df['h4_high'] = df['high'].rolling(window=16).max()
    df['h4_low'] = df['low'].rolling(window=16).min()
    
    return df

def is_ny_session(dt_utc):
    """Checks if UTC datetime is within 08:00 - 10:00 NY time"""
    ny_tz = pytz.timezone('America/New_York')
    dt_ny = dt_utc.replace(tzinfo=pytz.utc).astimezone(ny_tz)
    
    start_time = dtime(8, 0)
    end_time = dtime(10, 0)
    
    return start_time <= dt_ny.time() <= end_time

def analyze_breakout(df):
    """Institutional Breakout Logic: Rompimento com volume atípico"""
    # 1. Price breaks H4 high/low
    # 2. Volume is > 2x average
    
    df['signal'] = 0 # 0: Neutral, 1: Long, -1: Short
    
    for i in range(1, len(df)):
        # Check NY session
        if not is_ny_session(df.index[i]):
            continue
            
        # Long Breakout
        if df['close'].iloc[i] > df['h4_high'].iloc[i-1] and df['volume_ratio'].iloc[i] > 1.3:
            df.at[df.index[i], 'signal'] = 1
            
        # Short Breakout
        elif df['close'].iloc[i] < df['h4_low'].iloc[i-1] and df['volume_ratio'].iloc[i] > 1.3:
            df.at[df.index[i], 'signal'] = -1
            
    return df
