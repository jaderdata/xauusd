import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import joblib
import os
import json
import logging
import sys
from datetime import datetime
from xgboost import XGBClassifier

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', handlers=[logging.StreamHandler(sys.stdout)])
logger = logging.getLogger(__name__)

SYMBOL = "XAUUSD"
MODEL_PATH = "trading_model.pkl"

def load_mt5_config():
    try:
        if os.path.exists('mt5_config.json'):
            with open('mt5_config.json', 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading config: {e}")
    return None

def connect_mt5():
    config = load_mt5_config()
    if config and config.get('login'):
        logger.info(f"Connecting to MT5 for Data Collection [Account {config['login']}]...")
        return mt5.initialize(
            login=int(config['login']),
            server=config['server'],
            password=config['password']
        )
    return mt5.initialize()

def get_training_data(timeframe=mt5.TIMEFRAME_M5, count=5000):
    logger.info(f"Fetching {count} bars for {SYMBOL}...")
    rates = mt5.copy_rates_from_pos(SYMBOL, timeframe, 0, count)
    if rates is None:
        logger.error(f"Failed to copy rates: {mt5.last_error()}")
        return None
    
    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    return df

def calc_ema(series, span):
    return series.ewm(span=span, adjust=False).mean()

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

def prepare_features(df):
    logger.info("Calculating technical indicators...")
    # EMAs
    df['EMA_20'] = calc_ema(df['close'], 20)
    df['EMA_50'] = calc_ema(df['close'], 50)
    df['EMA_200'] = calc_ema(df['close'], 200)
    
    # RSI
    df['RSI_14'] = calc_rsi(df['close'], 14)
    
    # ATR
    df['ATR_14'] = calc_atr(df, 14)
    
    # VWAP (Approximate intraday)
    df['typical_price'] = (df['high'] + df['low'] + df['close']) / 3
    df['vwap'] = (df['typical_price'] * df['tick_volume']).cumsum() / df['tick_volume'].cumsum()
    df['vwap_dist'] = (df['close'] - df['vwap']) / df['vwap'] * 100
    
    # Time Features
    df['hour'] = df['time'].dt.hour
    
    # Target Generation (Look ahead 5 bars)
    # 1: Long (Price +300 pips), 2: Short (Price -300 pips), 0: Neutral
    look_ahead = 5
    pip_threshold = 0.30 # 300 pips for XAUUSD (approx)
    
    df['future_close'] = df['close'].shift(-look_ahead)
    df['diff'] = df['future_close'] - df['close']
    
    df['target'] = 0
    df.loc[df['diff'] > pip_threshold, 'target'] = 1
    df.loc[df['diff'] < -pip_threshold, 'target'] = 2
    
    # Cleanup
    df.dropna(inplace=True)
    
    feature_cols = [
        'EMA_20', 'EMA_50', 'EMA_200', 'RSI_14', 'ATR_14', 
        'vwap_dist', 'hour', 'close'
    ]
    
    X = df[feature_cols]
    y = df['target']
    
    return X, y, feature_cols

def train_model():
    if not connect_mt5():
        logger.error("MT5 not connected")
        return False
    
    try:
        # Use M5 for more stable training patterns
        df = get_training_data(timeframe=mt5.TIMEFRAME_M5, count=10000)
        if df is None: return False
        
        X, y, features = prepare_features(df)
        
        logger.info(f"Training XGBoost Model on {len(X)} samples...")
        model = XGBClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            objective='multi:softprob',
            num_class=3,
            random_state=42
        )
        
        model.fit(X, y)
        
        # Save model and feature names
        model_data = {
            'model': model,
            'features': features,
            'timestamp': datetime.now().isoformat()
        }
        joblib.dump(model_data, MODEL_PATH)
        
        logger.info(f"Model saved to {MODEL_PATH}")
        return True
        
    except Exception as e:
        logger.error(f"Training Error: {e}")
        return False
    finally:
        mt5.shutdown()

if __name__ == "__main__":
    train_model()
