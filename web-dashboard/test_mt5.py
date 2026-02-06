import MetaTrader5 as mt5
import sys

if not mt5.initialize():
    print(f"MT5 Initialize failed: {mt5.last_error()}")
    sys.exit(1)

tick = mt5.symbol_info_tick("XAUUSD")
if tick:
    print(f"XAUUSD Tick: Bid={tick.bid}, Ask={tick.ask}")
else:
    print("Failed to get XAUUSD tick")

mt5.shutdown()
