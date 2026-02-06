import MetaTrader5 as mt5
import requests
import time
import json
import logging
import sys
import pandas as pd
import joblib
import os
import numpy as np
import pytz
from news_engine import get_today_news
from strategy_v2 import is_ny_session, calc_indicators, analyze_breakout

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
SYMBOL = "XAUUSD"
POLL_INTERVAL = 1.0  # seconds

TIMEFRAMES = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15
}

def get_api_base():
    """Tries to find which port Next.js is running on (3000 or 3001)"""
    for port in [3000, 3001, 3002]:
        url = f"http://localhost:{port}/api/tick"
        try:
            # We don't send data here, just check if the endpoint exists
            requests.get(f"http://localhost:{port}/api/history", timeout=0.5)
            return f"http://localhost:{port}/api"
        except:
            continue
    return "http://localhost:3000/api" # Default fallback

API_BASE = get_api_base()
logger.info(f"Bridge target detected: {API_BASE}")

# --- STATE ---
last_candle_time = 0
current_model = None
model_features = []
today_news = []
last_news_sync = 0

def load_ai_model():
    global current_model, model_features
    if os.path.exists("trading_model.pkl"):
        try:
            data = joblib.load("trading_model.pkl")
            current_model = data['model']
            model_features = data['features']
            logger.info(f"AI Model loaded successfully. Last trained: {data.get('timestamp')}")
            return True
        except Exception as e:
            logger.error(f"Error loading model: {e}")
    return False

def send_to_api(endpoint, data):
    try:
        url = f"{API_BASE}/{endpoint}"
        logger.debug(f"Sending to {url}")
        response = requests.post(url, json=data, timeout=2)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"API Error ({endpoint}): {e}")
        return False

def sync_history(tf_name, mt5_tf):
    logger.info(f"Syncing history for {SYMBOL} [{tf_name}]...")
    
    # Get last 200 bars for better history
    rates = mt5.copy_rates_from_pos(SYMBOL, mt5_tf, 0, 200)
    if rates is None:
        logger.error(f"Failed to copy rates for {SYMBOL} [{tf_name}]")
        return
    
    candles = []
    for rate in rates:
        candles.append({
            "time": int(rate['time']),
            "open": float(rate['open']),
            "high": float(rate['high']),
            "low": float(rate['low']),
            "close": float(rate['close']),
            "volume": float(rate['tick_volume'])
        })
        
    if send_to_api("history", {"candles": candles, "timeframe": tf_name}):
        logger.info(f"Successfully synced {len(candles)} [{tf_name}] candles.")
    else:
        logger.warning(f"History sync failed for {tf_name} (API error).")

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

def poll_tick():
    # 1. Get Ticket Info
    tick = mt5.symbol_info_tick(SYMBOL)
    if tick is None:
        logger.warning(f"Could not get tick for {SYMBOL}")
        return

    # 2. Get Account Info
    account = mt5.account_info()
    if account is None:
        logger.warning("Could not get account info")
        return

    # 3. Prepare Data
    payload = {
        "symbol": SYMBOL,
        "bid": tick.bid,
        "ask": tick.ask,
        "equity": account.equity,
        "balance": account.balance,
        "profit": account.profit,
        "timestamp": int(time.time() * 1000)
    }

    # 4. Context & News Analysis
    global today_news, last_news_sync
    if time.time() - last_news_sync > 3600: # Sync news every hour
        today_news = get_today_news()
        last_news_sync = time.time()
        logger.info(f"Context Analysis: Today has {len(today_news)} key events.")

    # 4. AI & Strategy Inference
    prediction = {
        "status": "NEUTRAL",
        "long": 0.0, "long_hold": 0.0,
        "short": 0.0, "short_hold": 0.0,
        "flat": 0.0, "neutral": 100.0,
        "analysis": "No signal detected."
    }

    try:
        # Get last 200 bars to calc indicators
        rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M15, 0, 40) # M15 for Institutional Breakout
        if rates is not None:
            df = pd.DataFrame(rates)
            df['time'] = pd.to_datetime(df['time'], unit='s')
            df.set_index('time', inplace=True)
            
            # Apply Strategy V2
            df = calc_indicators(df)
            df = analyze_breakout(df)
            
            last_row = df.iloc[-1]
            signal = last_row['signal']
            vol_ratio = last_row['volume_ratio']
            
            # Check for News proximity (Safety override)
            news_danger = False
            for event in today_news:
                # Basic check: if event is within next 15 mins (mock logic)
                pass # TODO: Implement precise time check if needed
            
            if signal == 1:
                prediction.update({"status": "LONG", "long": 85.0, "neutral": 15.0, "analysis": f"Institutional BUY detected. Vol Ratio: {vol_ratio:.2f}"})
            elif signal == -1:
                prediction.update({"status": "SHORT", "short": 85.0, "neutral": 15.0, "analysis": f"Institutional SELL detected. Vol Ratio: {vol_ratio:.2f}"})
            else:
                # Provide smarter feedback for Neutral status
                current_time_utc = df.index[-1]
                if not is_ny_session(current_time_utc):
                    prediction.update({"analysis": "Aguardando Sessão de NY (08:00 - 10:00 EST) para operar."})
                elif vol_ratio < 1.3:
                    prediction.update({"analysis": f"Sessão Ativa, mas Volume Baixo ({vol_ratio:.2f}x). Aguardando surto institucional."})
                else:
                    prediction.update({"analysis": "Monitorando rompimento de Máxima/Mínima de 4H."})

    except Exception as e:
         logger.error(f"Inference error: {e}")

    payload["prediction"] = prediction
    if send_to_api("tick", payload):
        logger.info(f"Tick Broadcast: {SYMBOL} Bid={payload['bid']} AgentV2={prediction['status']}")
    else:
        logger.warning("Failed to broadcast tick.")

def load_config():
    try:
        with open('mt5_config.json', 'r') as f:
            return json.load(f)
    except Exception:
        return None

def main():
    logger.info("Initializing MT5 Bridge...")
    
    while True:
        config = load_config()
        
        authorized = False
        if config and config.get('login') and config.get('password') != '****':
            logger.info(f"Attempting login to account {config['login']} on {config['server']}...")
            authorized = mt5.initialize(
                login=int(config['login']),
                server=config['server'],
                password=config['password']
            )
            if not authorized:
                logger.error(f"Account-specific login failed: {mt5.last_error()}")
        
        # Fallback: Try general initialization (uses currently active account in MT5)
        if not authorized:
            logger.info("Trying to connect to the currently active MT5 account...")
            authorized = mt5.initialize()

        if not authorized:
            logger.error(f"MT5 Connection failed completely. Error: {mt5.last_error()}. Retrying in 10s...")
            mt5.shutdown()
            time.sleep(10)
            continue

        logger.info("MT5 Connected and Authorized.")
        load_ai_model()
        
        # Sync all timeframes on startup
        for tf_name, mt5_tf in TIMEFRAMES.items():
            sync_history(tf_name, mt5_tf)
        
        try:
            while True:
                poll_tick()
                current_time = int(time.time())
                
                # Sync history every 5 minutes for all TFs
                if current_time % 300 == 0: 
                     for tf_name, mt5_tf in TIMEFRAMES.items():
                        sync_history(tf_name, mt5_tf)
                        
                time.sleep(POLL_INTERVAL)
        except Exception as e:
            logger.error(f"Bridge loop error: {e}. Re-initializing in 5s...")
            mt5.shutdown()
            time.sleep(5)
            
    mt5.shutdown()

if __name__ == "__main__":
    main()
