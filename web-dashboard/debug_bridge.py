import MetaTrader5 as mt5
import requests
import time
import sys

SYMBOL = "XAUUSD"
API_URL = "http://localhost:3000/api/tick"

def main():
    if not mt5.initialize():
        print(f"Failed to initialize MT5: {mt5.last_error()}")
        return

    print("Diagnostic Bridge Running...")
    try:
        while True:
            tick = mt5.symbol_info_tick(SYMBOL)
            if tick:
                payload = {
                    "symbol": SYMBOL,
                    "bid": tick.bid,
                    "ask": tick.ask,
                    "equity": 0.0,
                    "balance": 0.0,
                    "profit": 0.0,
                    "timestamp": int(time.time() * 1000),
                    "prediction": {
                        "status": "DEBUG",
                        "long": 50, "long_hold": 20,
                        "short": 50, "short_hold": 20,
                        "flat": 0, "neutral": 100
                    }
                }
                try:
                    requests.post(API_URL, json=payload, timeout=1)
                    print(f"Sent Tick: {tick.bid}")
                except Exception as e:
                    print(f"API Error: {e}")
            else:
                print("No tick received")
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        mt5.shutdown()

if __name__ == "__main__":
    main()
